/* Astro Express · Slash Collectif */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const STRIPE_BUTTON_ID = 'buy_btn_1UZrpRJBDC82NqmfH7SZR9uY';
  const STRIPE_KEY = 'pk_live_51PsiLAJBDC82NqmfUJJBBe2TnGFx9KOmwjHjQaWhDO3Ziw31ndSpjhkoAH8E3ru0k9iTcBr3fyLw7GmGq5cxIUS6007OV4jSyy';
  const CIRCLE_SCRIPT = 'https://slash-collectif-1708fe.circle.so/external/form-embeds.js';

  // Quand Circle redirige après l'envoi vers ?debloque=1, cette page s'ouvre
  // DANS le cadre du formulaire : elle prévient l'outil, qui affiche la suite.
  const parametres = new URLSearchParams(location.search);
  if (parametres.has('debloque')) {
    let parentOutil = false;
    try { parentOutil = window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { /* autre site */ }
    if (parentOutil) {
      window.parent.postMessage({ astro: 'debloque' }, location.origin);
      document.body.innerHTML = '<p style="font:700 18px Montserrat,sans-serif;color:#3F231C;text-align:center;padding:30px 10px">C\'est noté ✨</p>';
      document.body.style.background = '#fff';
      return;
    }
  }

  const etat = {
    mode: 'boite', marque: '', activite: '', ville: null, villePerso: null,
    theme: null, lecture: null, deverrouille: false, email: '', prenom: '',
  };

  /* ---------- navigation ---------- */
  function aller(nom) {
    $$('.ecran').forEach((e) => e.classList.remove('actif'));
    $(`#ecran-${nom}`).classList.add('actif');
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (nom === 'resultat') chargerCircle();
    if (nom === 'commande') preparerCommande();
  }
  $$('[data-aller]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode) choisirMode(b.dataset.mode);
    aller(b.dataset.aller);
  }));

  function choisirMode(mode) {
    etat.mode = mode;
    const lancement = mode === 'lancement';
    $('#titre-saisie').textContent = lancement ? 'Teste ta future date de lancement' : 'Parle-moi de la naissance de ta boîte';
    $('#label-date').textContent = lancement ? 'La date dont tu rêves pour te lancer' : 'Date de naissance de ton entreprise';
    $('#intro-lancement').classList.toggle('cache', !lancement);
    $('#date').max = lancement ? '2035-12-31' : new Date().toISOString().slice(0, 10);
  }

  /* ---------- villes (Open-Meteo, monde entier, avec fuseau horaire) ---------- */
  function autocompleteVille(inputSel, listeSel, okSel, cle) {
    const input = $(inputSel), liste = $(listeSel), ok = $(okSel);
    let minuteur;
    input.addEventListener('input', () => {
      etat[cle] = null; input.classList.remove('ok'); ok.classList.add('cache');
      clearTimeout(minuteur);
      const q = input.value.trim();
      if (q.length < 2) { liste.classList.add('cache'); return; }
      minuteur = setTimeout(async () => {
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=fr&format=json`);
          const d = await r.json();
          const res = d.results || [];
          liste.innerHTML = '';
          res.forEach((v) => {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button'; b.setAttribute('role', 'option');
            const region = [v.admin1, v.country].filter(Boolean).join(', ');
            b.innerHTML = `${v.name}<span>${region}</span>`;
            b.addEventListener('click', () => {
              etat[cle] = { nom: v.name, region, lat: v.latitude, lon: v.longitude, tz: v.timezone };
              input.value = `${v.name}, ${region}`;
              input.classList.add('ok'); ok.classList.remove('cache'); liste.classList.add('cache');
            });
            li.appendChild(b); liste.appendChild(li);
          });
          liste.classList.toggle('cache', res.length === 0);
        } catch (e) { liste.classList.add('cache'); }
      }, 250);
    });
  }
  autocompleteVille('#ville', '#ville-liste', '#ville-ok', 'ville');
  autocompleteVille('#cmd-ville', '#cmd-ville-liste', '#cmd-ville-ok', 'villePerso');

  $('#sans-heure').addEventListener('change', (e) => {
    $('#heure').disabled = e.target.checked;
    $('#alerte-heure').classList.toggle('cache', !e.target.checked);
  });
  $('#cmd-sans-heure').addEventListener('change', (e) => { $('#cmd-heure').disabled = e.target.checked; });

  /* ---------- API ---------- */
  async function api(url, corps) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) });
    const brut = await r.text();
    let d; try { d = JSON.parse(brut); } catch (e) { d = { erreur: brut.slice(0, 160) }; }
    if (!r.ok) throw new Error(`${url} ${r.status} : ${d.erreur || 'Erreur'}`);
    return d;
  }

  /* ---------- saisie ---------- */
  $('#form-saisie').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#erreur-saisie');
    const date = $('#date').value;
    const sansHeure = $('#sans-heure').checked;
    const heure = sansHeure ? null : $('#heure').value || null;
    let msg = '';
    if (!date) msg = 'Il me manque la date.';
    else if (!etat.ville) msg = 'Choisis ta ville dans la liste qui apparaît quand tu écris.';
    else if (!heure && !sansHeure) msg = "Indique l'heure, ou coche « Je n'ai pas l'heure ».";
    if (msg) { err.textContent = msg; err.classList.remove('cache'); return; }
    err.classList.add('cache');
    etat.marque = $('#marque').value.trim();
    etat.activite = $('#activite').value.trim();
    etat.boite = { date, time: heure, ville: $('#ville').value };
    aller('chargement');
    try {
      etat.theme = await api('/api/theme', { date, time: heure, lat: etat.ville.lat, lon: etat.ville.lon, tz: etat.ville.tz });
      etat.lecture = await api('/api/lecture', { marque: etat.marque, activite: etat.activite, theme: etat.theme });
      try { sessionStorage.setItem('astro', JSON.stringify({ marque: etat.marque, activite: etat.activite, mode: etat.mode, boite: etat.boite, ville: etat.ville, theme: etat.theme, lecture: etat.lecture })); } catch (x) { /* navigation privée */ }
      afficherResultat();
      aller('resultat');
    } catch (ex) {
      aller('saisie');
      err.textContent = "Oups, la lecture n'a pas pu se faire. (" + ex.message + ")";
      err.classList.remove('cache');
      console.error(ex);
    }
  });

  /* ---------- résultat ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function premierePhrase(t) { const m = t.match(/^[\s\S]*?[.!?…](\s|$)/); return m ? m[0] : t; }
  const sansEtoiles = (t) => String(t ?? '').replace(/\*\*/g, '');
  // **mot** -> gras, ligne vide -> petit espace entre paragraphes
  function miseEnForme(t) {
    let h = esc(t);
    if ((h.match(/\*\*/g) || []).length % 2) h = h.replace(/\*\*/g, '');
    return h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').trim().replace(/\s*\n\s*\n?\s*/g, '<span class="respire"></span>');
  }

  function afficherResultat() {
    const t = etat.theme, l = etat.lecture;
    $('#res-marque').textContent = etat.marque || (etat.mode === 'lancement' ? 'Ta future boîte' : 'Ta boîte');
    const soleil = t.planetes.find((p) => p.cle === 'soleil');
    let pastilles = `<span>Soleil ${esc(soleil.signe)}</span>`;
    if (t.heure_connue) pastilles += `<span>Ascendant ${esc(t.ascendant.signe)}</span>`;
    $('#res-pastilles').innerHTML = pastilles;
    const cartes = [['01 · TON MESSAGE', l.message], ['02 · TA DIFFÉRENCE', l.difference], ['03 · TA MISSION', l.mission]];
    $('#res-cartes').innerHTML = cartes.map(([num, c], i) => {
      // on coupe après la 1re phrase, sans casser un passage en gras
      let debut = premierePhrase(c.texte);
      if ((debut.match(/\*\*/g) || []).length % 2) debut = c.texte;
      const suite = c.texte.slice(debut.length);
      const verrou = i > 0 && !etat.deverrouille;
      return `<article class="carte"><span class="num">${num}</span><h2>${esc(sansEtoiles(c.titre))}</h2>
        <p>${miseEnForme(debut)} <span class="${verrou ? 'flou' : ''}" ${verrou ? 'aria-hidden="true"' : ''}>${/^\s*\n/.test(suite) ? '<span class="respire"></span>' : ''}${miseEnForme(suite)}</span></p>
        <span class="mot ${verrou ? 'flou' : ''}">${esc(sansEtoiles(c.mot_fort))}</span></article>`;
    }).join('');
  }

  function deverrouiller() {
    if (etat.deverrouille) return;
    etat.deverrouille = true;
    afficherResultat();
    $('#porte').classList.add('cache');
    $('#apres-porte').classList.remove('cache');
    const carte2 = $$('#res-cartes .carte')[1];
    if (carte2) carte2.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let circleCharge = false;
  function chargerCircle() {
    if (circleCharge || etat.deverrouille) return;
    circleCharge = true;
    if (!window.circleFormsScriptLoaded) {
      window.circleFormsScriptLoaded = true;
      const s = document.createElement('script'); s.src = CIRCLE_SCRIPT; s.defer = true; document.head.appendChild(s);
    }
    // Si le formulaire Circle est rendu dans la page, on capte son envoi.
    document.addEventListener('submit', (e) => {
      const zone = $('#circle-form-zone');
      if (!zone.contains(e.target)) return;
      const mail = e.target.querySelector('input[type=email]');
      const nom = e.target.querySelector('input[type=text]');
      if (mail) etat.email = mail.value;
      if (nom) etat.prenom = nom.value;
      setTimeout(deverrouiller, 1200);
    }, true);
    // La suite s'affiche uniquement quand le formulaire est envoyé :
    // - via la page de redirection ?debloque=1 (réglage du formulaire dans Circle)
    // - ou si Circle prévient lui-même la page.
    window.addEventListener('message', (e) => {
      if (e.origin === location.origin && e.data && e.data.astro === 'debloque') { deverrouiller(); return; }
      let hote = ''; try { hote = new URL(e.origin).hostname; } catch (x) { return; }
      if (!/circle\.so$/.test(hote)) return;
      const txt = typeof e.data === 'string' ? e.data : JSON.stringify(e.data || '');
      if (/submit|success|subscrib|thank|merci/i.test(txt)) setTimeout(deverrouiller, 1500);
    });
  }
  $('#secours-porte').addEventListener('click', deverrouiller);

  if (parametres.has('debloque')) {
    try {
      const m = JSON.parse(sessionStorage.getItem('astro') || 'null');
      if (m && m.lecture) {
        Object.assign(etat, m, { deverrouille: true });
        afficherResultat();
        $('#porte').classList.add('cache'); $('#apres-porte').classList.remove('cache');
        aller('resultat');
        const carte2 = $$('#res-cartes .carte')[1];
        if (carte2) setTimeout(() => carte2.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      }
    } catch (x) { /* rien à restaurer */ }
  }

  /* ---------- story ---------- */
  $$('[data-story]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await creerStory(b.dataset.story === 'nuit'); } finally { b.disabled = false; }
  }));

  function chargerImage(src) {
    return new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  }

  const C = { BR: '#3F231C', PK: '#F49AC1', HP: '#E0459B', OR: '#E8590C', CR: '#FFF8EC', MU: '#F5AC1F' };
  const SIGNES_G = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  const SYM = '"Noto Sans Symbols 2","Noto Sans Symbols",sans-serif';

  function texteEspace(ctx, txt, x, y, espace, align = 'center') {
    const chars = [...txt];
    const larg = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + espace * (chars.length - 1);
    let cx = align === 'center' ? x - larg / 2 : x;
    ctx.textAlign = 'left';
    chars.forEach((ch) => { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + espace; });
    return larg;
  }
  function lignes(ctx, txt, largMax) {
    const mots = txt.split(/\s+/); const out = []; let l = '';
    mots.forEach((m) => { const t = l ? l + ' ' + m : m; if (ctx.measureText(t).width > largMax && l) { out.push(l); l = m; } else l = t; });
    if (l) out.push(l); return out;
  }
  function rectArrondi(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cartouche(ctx, x, y, w, h) {
    ctx.fillStyle = C.OR; rectArrondi(ctx, x, y + 6, w, h, 40); ctx.fill();
    ctx.fillStyle = C.CR; rectArrondi(ctx, x, y, w, h, 40); ctx.fill();
    ctx.strokeStyle = C.PK; ctx.lineWidth = 4; rectArrondi(ctx, x, y, w, h, 40); ctx.stroke();
  }

  function dessinerRoue(ctx, t, miniSoleil) {
    const CX = 553, CY = 1060, R = 374, S = 0.78, TY = -80;
    const asc = t.heure_connue ? t.ascendant.lon : 0;
    const xy = (lv, r) => { const a = (180 + (lv - asc)) * Math.PI / 180; return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
    const ang = (lv) => -((180 + (lv - asc)) * Math.PI / 180);
    const rz = R - 58, rg = rz - 46, rn = rz - 82, rc = 58;
    const pos = Object.fromEntries(t.planetes.map((p) => [p.cle, p]));
    const signeSoleil = Math.floor(pos.soleil.lon / 30);
    ctx.save();
    ctx.translate(CX, CY + TY); ctx.scale(S, S); ctx.translate(-CX, -CY);
    // disque
    ctx.fillStyle = C.CR; ctx.strokeStyle = C.BR; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    // secteur du signe solaire
    ctx.fillStyle = C.PK; ctx.beginPath();
    ctx.arc(CX, CY, R, ang(signeSoleil * 30), ang(signeSoleil * 30 + 30), true);
    ctx.arc(CX, CY, rz, ang(signeSoleil * 30 + 30), ang(signeSoleil * 30), false);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFFDF7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(CX, CY, rz, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    // signes, graduations
    ctx.strokeStyle = C.BR;
    for (let i = 0; i < 12; i++) {
      let [x1, y1] = xy(i * 30, rz), [x2, y2] = xy(i * 30, R);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 1; k < 30; k++) {
        [x1, y1] = xy(i * 30 + k, rz); [x2, y2] = xy(i * 30 + k, rz + (k % 5 === 0 ? 9 : 5));
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      const [gx, gy] = xy(i * 30 + 15, (rz + R) / 2 + 3);
      ctx.fillStyle = C.BR; ctx.font = `34px ${SYM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(SIGNES_G[i] + '︎', gx, gy);
    }
    // maisons
    if (t.heure_connue) {
      t.cuspides.forEach((c, i) => {
        const fort = [0, 3, 6, 9].includes(i);
        const [x1, y1] = xy(c, rc), [x2, y2] = xy(c, rz);
        ctx.globalAlpha = fort ? 0.9 : 0.4; ctx.lineWidth = fort ? 2.4 : 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 0.6;
        const suiv = t.cuspides[(i + 1) % 12]; const mil = c + (((suiv - c) % 360) + 360) % 360 / 2;
        const [hx, hy] = xy(mil, rc + 30);
        ctx.fillStyle = C.BR; ctx.font = '700 15px Montserrat'; ctx.fillText(String(i + 1), hx, hy);
        ctx.globalAlpha = 1;
      });
    }
    // aspects
    const prin = t.planetes.filter((p) => p.cle !== 'lilith');
    t.aspects.forEach((a) => {
      if (a.type === 'conjonction') return;
      const [x1, y1] = xy(pos[a.a].lon, rn), [x2, y2] = xy(pos[a.b].lon, rn);
      ctx.strokeStyle = (a.type === 'opposition' || a.type === 'carré') ? C.OR : C.HP;
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    prin.forEach((p) => { const [x, y] = xy(p.lon, rn); ctx.fillStyle = p.cle === 'soleil' ? C.HP : C.BR; ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill(); });
    // centre : étoile à 8 branches
    ctx.fillStyle = C.CR; ctx.strokeStyle = C.BR; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(CX, CY, rc, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    const etoile = (r, ri, rot) => { ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = (rot - 90 + k * 22.5) * Math.PI / 180, rr = k % 2 ? ri : r; ctx[k ? 'lineTo' : 'moveTo'](CX + rr * Math.cos(a), CY + rr * Math.sin(a)); } ctx.closePath(); };
    ctx.fillStyle = C.MU; ctx.strokeStyle = '#D4AE62'; ctx.lineWidth = 2; etoile(50, 30, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.PK; etoile(32, 19, 22.5); ctx.fill();
    ctx.fillStyle = C.CR; ctx.beginPath(); ctx.arc(CX, CY, 9, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = C.OR; for (let k = 0; k < 8; k++) { const a = (k * 45 + 22.5 - 90) * Math.PI / 180; ctx.beginPath(); ctx.arc(CX + 44 * Math.cos(a), CY + 44 * Math.sin(a), 2.6, 0, 2 * Math.PI); ctx.fill(); }
    // glyphes des planètes (sans le Soleil), écartés pour ne pas se chevaucher
    const autres = t.planetes.filter((p) => p.cle !== 'soleil').sort((a, b) => a.lon - b.lon);
    const disp = autres.map((p) => p.lon);
    for (let n = 0; n < 300; n++) {
      let bouge = false;
      for (let k = 0; k < disp.length; k++) {
        const s = (k + 1) % disp.length;
        if (((disp[s] - disp[k]) % 360 + 360) % 360 < 8.5) { disp[k] -= 0.25; disp[s] += 0.25; bouge = true; }
      }
      if (!bouge) break;
    }
    ctx.fillStyle = C.BR; ctx.font = `30px ${SYM}`;
    autres.forEach((p, k) => { const [gx, gy] = xy(disp[k], rg); ctx.fillText(p.glyphe + '︎', gx, gy); });
    // AC et Soleil en pastilles sur l'anneau rose
    const pastille = (lv, couleur, rayon) => {
      const [x, y] = xy(lv, R + rayon), [tx, ty] = xy(lv, R);
      ctx.strokeStyle = C.OR; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = couleur; ctx.strokeStyle = C.CR; ctx.beginPath(); ctx.arc(x, y, couleur === C.HP ? 27 : 24, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      return [x, y];
    };
    if (t.heure_connue) {
      const [x, y] = pastille(asc, C.OR, 30);
      ctx.fillStyle = C.CR; ctx.font = '800 16px Montserrat'; ctx.fillText('AC', x, y + 1);
    }
    const [sx, sy] = pastille(pos.soleil.lon, C.HP, 32);
    ctx.drawImage(miniSoleil, sx - 22, sy - 22, 44, 44);
    ctx.restore();
  }

  async function creerStory(nuit) {
    await Promise.all(['400 34px "Noto Sans Symbols"', '400 34px "Noto Sans Symbols 2"', 'italic 76px "DM Serif Display"', '27px "DM Serif Display"', '800 18px Montserrat', '500 18px Montserrat']
      .map((f) => document.fonts.load(f).catch(() => null)));
    const [fond, mini] = await Promise.all([chargerImage(nuit ? '/assets/bg-nuit.svg' : '/assets/bg-jour.svg'), chargerImage('/assets/soleil-mini.svg')]);
    const cv = $('#toile'), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.drawImage(fond, 0, 0, 1080, 1920);
    dessinerRoue(ctx, etat.theme, mini);
    ctx.textBaseline = 'alphabetic';
    // cartouche du haut
    cartouche(ctx, 150, 262, 780, 232);
    ctx.fillStyle = C.OR; ctx.font = '800 18px Montserrat'; texteEspace(ctx, 'MON ASTRO EXPRESS', 540, 318, 8);
    ctx.fillStyle = C.BR; let taille = 76; const nom = etat.marque || 'Ma boîte';
    do { ctx.font = `italic ${taille}px "DM Serif Display"`; taille -= 2; } while (ctx.measureText(nom).width > 720 && taille > 36);
    ctx.textAlign = 'center'; ctx.fillText(nom, 540, 404);
    const sol = etat.theme.planetes.find((p) => p.cle === 'soleil').signe.toUpperCase();
    const sous = etat.theme.heure_connue ? `SOLEIL ${sol} · ASCENDANT ${etat.theme.ascendant.signe.toUpperCase()}` : `SOLEIL ${sol}`;
    ctx.font = '700 17px Montserrat'; texteEspace(ctx, sous, 540, 460, 3);
    // cartouche du bas
    const phrases = [['MON MESSAGE', sansEtoiles(etat.lecture.story.message)], ['MA DIFFÉRENCE', sansEtoiles(etat.lecture.story.difference)], ['MA MISSION', sansEtoiles(etat.lecture.story.mission)]];
    ctx.font = '27px "DM Serif Display"';
    const blocs = phrases.map(([lab, txt]) => [lab, lignes(ctx, txt, 830)]);
    const hauteur = 26 + blocs.reduce((s, [, l]) => s + 26 + l.length * 32 + 10, 0) + 84;
    const y0 = Math.min(1362, 1690 - hauteur);
    cartouche(ctx, 90, y0, 900, hauteur);
    let y = y0 + 44;
    blocs.forEach(([lab, ls]) => {
      ctx.fillStyle = C.OR; ctx.font = '800 17px Montserrat'; texteEspace(ctx, lab, 124, y, 3, 'left');
      y += 34; ctx.fillStyle = C.BR; ctx.font = '27px "DM Serif Display"'; ctx.textAlign = 'left';
      ls.forEach((l) => { ctx.fillText(l, 124, y); y += 32; });
      y += 10;
    });
    // pied : Calcule le tien sur @slash.collectif · SLASH collectif
    y += 8;
    ctx.fillStyle = C.BR; ctx.font = '700 19px Montserrat'; ctx.textAlign = 'left'; ctx.fillText('Calcule le tien sur', 124, y);
    const dx = 124 + ctx.measureText('Calcule le tien sur ').width;
    ctx.font = '800 19px Montserrat'; const lp = ctx.measureText('@slash.collectif').width + 32;
    ctx.fillStyle = C.OR; rectArrondi(ctx, dx, y - 25, lp, 36, 18); ctx.fill();
    ctx.fillStyle = C.CR; ctx.fillText('@slash.collectif', dx + 16, y);
    // logo « SLASH collectif » aligné à droite
    const largeur = (txt, font, esp) => { ctx.font = font; return [...txt].reduce((s, ch) => s + ctx.measureText(ch).width, 0) + esp * ([...txt].length - 1); };
    const fS = '800 18px Montserrat', fC = '500 18px Montserrat';
    const lC = largeur('collectif', fC, 2), lS = largeur('SLASH', fS, 4);
    const xFin = 956;
    ctx.font = fC; ctx.fillStyle = '#FF7FF2'; texteEspace(ctx, 'collectif', xFin - lC, y, 2, 'left');
    ctx.font = fS; ctx.fillStyle = C.BR; texteEspace(ctx, 'SLASH', xFin - lC - 8 - lS, y, 4, 'left');

    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    const url = URL.createObjectURL(blob);
    const apercu = $('#apercu-story'); apercu.src = url; apercu.classList.remove('cache');
    const fichier = new File([blob], `astro-express-${nuit ? 'night' : 'jour'}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: 'Mon Astro Express' }); } catch (e) { /* partage annulé */ }
    } else {
      const a = document.createElement('a'); a.href = url; a.download = fichier.name; a.click();
    }
    $('#apres-story').classList.remove('cache');
  }

  /* ---------- commande ---------- */
  function preparerCommande() {
    const b = etat.boite || {};
    $('#rappel-boite').innerHTML = `<b>TA BOÎTE · DÉJÀ ENREGISTRÉE</b>${esc(etat.marque || 'Ta boîte')}<br>${esc(b.date || '')} · ${b.time ? esc(b.time) : 'heure inconnue'} · ${esc(b.ville || '')}`;
    if (etat.prenom && !$('#cmd-prenom').value) $('#cmd-prenom').value = etat.prenom;
    if (etat.email && !$('#cmd-email').value) $('#cmd-email').value = etat.email;
  }

  $('#form-commande').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#erreur-commande');
    const prenom = $('#cmd-prenom').value.trim(), email = $('#cmd-email').value.trim(), date = $('#cmd-date').value;
    const sansHeure = $('#cmd-sans-heure').checked, heure = sansHeure ? null : $('#cmd-heure').value || null;
    let msg = '';
    if (!prenom || !/^\S+@\S+\.\S+$/.test(email)) msg = 'Indique ton prénom et ton mail.';
    else if (!date) msg = 'Il me manque ta date de naissance.';
    else if (!etat.villePerso) msg = 'Choisis ta ville de naissance dans la liste.';
    else if (!heure && !sansHeure) msg = "Indique ton heure, ou coche « Je ne connais pas mon heure ».";
    if (msg) { err.textContent = msg; err.classList.remove('cache'); return; }
    err.classList.add('cache');
    // Toutes les infos voyagent dans la référence Stripe (200 caractères max,
    // lettres, chiffres, - et _ seulement). Tu la lis dans le détail du paiement.
    const b = etat.boite || {};
    const reference = [
      'BOITE', propre(etat.marque, 40), jjmmaaaa(b.date), b.time ? b.time.replace(':', 'h') : 'sansheure', propre(etat.ville && etat.ville.nom, 30),
      'PERSO', propre(prenom, 25), jjmmaaaa(date), heure ? heure.replace(':', 'h') : 'sansheure', propre(etat.villePerso.nom, 30),
    ].join('_').slice(0, 200);
    afficherStripe(email, reference);
  });

  function jjmmaaaa(d) { return d ? d.split('-').reverse().join('') : 'x'; }

  function propre(txt, max) {
    return (txt || 'x').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'x';
  }

  function afficherStripe(email, reference) {
    $('#form-commande').classList.add('cache');
    $('#zone-paiement').classList.remove('cache');
    if (!document.querySelector('script[src*="buy-button.js"]')) {
      const s = document.createElement('script'); s.async = true; s.src = 'https://js.stripe.com/v3/buy-button.js'; document.head.appendChild(s);
    }
    const btn = document.createElement('stripe-buy-button');
    btn.setAttribute('buy-button-id', STRIPE_BUTTON_ID);
    btn.setAttribute('publishable-key', STRIPE_KEY);
    btn.setAttribute('customer-email', email);
    btn.setAttribute('client-reference-id', reference);
    $('#stripe-zone').innerHTML = ''; $('#stripe-zone').appendChild(btn);
  }
})();
