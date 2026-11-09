"""Calcul du thème astral d'une entreprise (ou d'une personne).

POST /api/theme
{ "date": "2025-09-09", "time": "15:21" | null, "lat": 49.44, "lon": 1.09, "tz": "Europe/Paris" }

Calcul avec Swiss Ephemeris (le moteur d'astro.com), maisons Placidus, Nœud vrai.
"""
from http.server import BaseHTTPRequestHandler
from datetime import datetime
from zoneinfo import ZoneInfo
import json, os, math

import swisseph as swe

EPHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ephe")
swe.set_ephe_path(EPHE)

SIGNES = ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge", "Balance",
          "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"]
PLANETES = [
    ("soleil", "Soleil", "☉", swe.SUN), ("lune", "Lune", "☽", swe.MOON),
    ("mercure", "Mercure", "☿", swe.MERCURY), ("venus", "Vénus", "♀", swe.VENUS),
    ("mars", "Mars", "♂", swe.MARS), ("jupiter", "Jupiter", "♃", swe.JUPITER),
    ("saturne", "Saturne", "♄", swe.SATURN), ("uranus", "Uranus", "♅", swe.URANUS),
    ("neptune", "Neptune", "♆", swe.NEPTUNE), ("pluton", "Pluton", "♇", swe.PLUTO),
    ("noeud_nord", "Nœud Nord", "☊", swe.TRUE_NODE), ("chiron", "Chiron", "⚷", swe.CHIRON),
    ("lilith", "Lilith", "⚸", swe.MEAN_APOG),
]
# angle, nom, orbe
ASPECTS = [(0, "conjonction", 8), (180, "opposition", 8), (90, "carré", 6), (120, "trigone", 6), (60, "sextile", 4)]


def signe(lon):
    return SIGNES[int(lon // 30) % 12]


def maison(lon, cusps):
    for i in range(12):
        a, b = cusps[i], cusps[(i + 1) % 12]
        if (lon - a) % 360 < (b - a) % 360:
            return i + 1
    return None


def ecart(a, b):
    return abs((a - b + 180) % 360 - 180)


def calc_lon(jd, body):
    try:
        return swe.calc_ut(jd, body, swe.FLG_SWIEPH)[0][0]
    except Exception:
        return swe.calc_ut(jd, body, swe.FLG_MOSEPH)[0][0]


def calculer(data):
    swe.set_ephe_path(EPHE)  # réglage par fil d'exécution : à refaire à chaque appel
    tz =ZoneInfo(data.get("tz") or "Europe/Paris")
    has_time = bool(data.get("time"))
    hh, mm = (data["time"].split(":") if has_time else ("12", "00"))
    y, mo, d = [int(x) for x in data["date"].split("-")]
    local = datetime(y, mo, d, int(hh), int(mm), tzinfo=tz)
    ut = local.astimezone(ZoneInfo("UTC"))
    jd = swe.julday(ut.year, ut.month, ut.day, ut.hour + ut.minute / 60)
    lat, lon = float(data["lat"]), float(data["lon"])

    cusps = asc = mc = None
    if has_time:
        c, ascmc = swe.houses(jd, lat, lon, b"P")
        cusps, asc, mc = list(c), ascmc[0], ascmc[1]

    # bornes de la journée locale, pour repérer les planètes « à cheval » sans heure
    jd0 = jd1 = None
    if not has_time:
        a = datetime(y, mo, d, 0, 0, tzinfo=tz).astimezone(ZoneInfo("UTC"))
        b = datetime(y, mo, d, 23, 59, tzinfo=tz).astimezone(ZoneInfo("UTC"))
        jd0 = swe.julday(a.year, a.month, a.day, a.hour + a.minute / 60)
        jd1 = swe.julday(b.year, b.month, b.day, b.hour + b.minute / 60)

    planetes = []
    for key, nom, glyphe, body in PLANETES:
        l = calc_lon(jd, body)
        p = {"cle": key, "nom": nom, "glyphe": glyphe, "lon": round(l, 4),
             "signe": signe(l), "degre": int(l % 30)}
        if cusps:
            p["maison"] = maison(l, cusps)
        if not has_time:
            s0, s1 = signe(calc_lon(jd0, body)), signe(calc_lon(jd1, body))
            if s0 != s1:
                p["a_cheval"] = [s0, s1]
        planetes.append(p)
    pos = {p["cle"]: p for p in planetes}
    noeud_sud = (pos["noeud_nord"]["lon"] + 180) % 360

    aspects = []
    principales = [p for p in planetes if p["cle"] != "lilith"]
    for i in range(len(principales)):
        for j in range(i + 1, len(principales)):
            e = ecart(principales[i]["lon"], principales[j]["lon"])
            for ang, nom, orbe in ASPECTS:
                if abs(e - ang) <= orbe:
                    aspects.append({"a": principales[i]["cle"], "b": principales[j]["cle"],
                                    "type": nom, "orbe": round(abs(e - ang), 1)})

    res = {
        "heure_connue": has_time,
        "planetes": planetes,
        "noeud_sud": {"lon": round(noeud_sud, 4), "signe": signe(noeud_sud)},
        "aspects": aspects,
    }
    if has_time:
        res["ascendant"] = {"lon": round(asc, 4), "signe": signe(asc)}
        res["mc"] = {"lon": round(mc, 4), "signe": signe(mc)}
        res["cuspides"] = [round(c, 4) for c in cusps]
    return res


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
            for champ in ("date", "lat", "lon"):
                if data.get(champ) in (None, ""):
                    return self._send(400, {"erreur": f"Champ manquant : {champ}"})
            self._send(200, calculer(data))
        except Exception as e:
            self._send(500, {"erreur": str(e)})
