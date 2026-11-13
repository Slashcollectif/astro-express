// POST /api/lecture
// { marque, activite, theme }  ->  { message, difference, mission, story }
// L'IA ne calcule rien : elle lit uniquement les positions calculées par /api/theme.
const fs = require('fs');
const path = require('path');

const MODELE = process.env.MODELE_IA || 'claude-sonnet-5-5';
const SYSTEME = fs.readFileSync(path.join(process.cwd(), 'prompts', 'systeme.md'), 'utf8');
const UTILES = ['soleil', 'mercure', 'uranus', 'neptune', 'noeud_nord', 'chiron'];

function decrireTheme(t) {
  const lignes = [];
  const pos = Object.fromEntries(t.planetes.map((p) => [p.cle, p]));
  for (const cle of UTILES) {
    const p = pos[cle];
    let l = `- ${p.nom} en ${p.signe}`;
    if (p.maison) l += `, maison ${p.maison}`;
    if (p.a_cheval) l += ` (change de signe ce jour-là : ${p.a_cheval.join(' ou ')}, heure inconnue)`;
    lignes.push(l);
  }
  for (const cible of ['uranus', 'neptune']) {
    const a = t.aspects.find((x) => (x.a === 'soleil' && x.b === cible) || (x.b === 'soleil' && x.a === cible));
    lignes.push(a ? `- Soleil en ${a.type} avec ${pos[cible].nom} (orbe ${a.orbe}°)` : `- Aucun aspect majeur entre le Soleil et ${pos[cible].nom}`);
  }
  lignes.push('Pour le teaser seulement :');
  for (const cle of ['lune', 'venus', 'mars', 'jupiter', 'saturne']) {
    const p = pos[cle];
    if (!p) continue;
    let l = `- ${p.nom} en ${p.signe}`;
    if (p.maison) l += `, maison ${p.maison}`;
    lignes.push(l);
  }
  if (t.heure_connue) {
    lignes.push(`- Ascendant en ${t.ascendant.signe}`);
    lignes.push(`- MC en ${t.mc.signe}`);
  } else {
    lignes.push("- Heure inconnue : pas d'Ascendant, pas de MC, pas de maisons. N'en parle pas.");
  }
  return lignes.join('\n');
}

// L'IA répond via un « outil » : le format JSON est alors garanti propre.
const CARTE = {
  type: 'object',
  properties: {
    titre: { type: 'string' },
    texte: { type: 'string' },
    mot_fort: { type: 'string' },
  },
  required: ['titre', 'texte', 'mot_fort'],
};
const OUTIL = {
  name: 'ecrire_lecture',
  description: "Enregistre la lecture Astro Express : les 3 cartes et les 3 phrases de story.",
  input_schema: {
    type: 'object',
    properties: {
      message: CARTE,
      difference: CARTE,
      mission: CARTE,
      teaser: { type: 'string' },
      story: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          difference: { type: 'string' },
          mission: { type: 'string' },
        },
        required: ['message', 'difference', 'mission'],
      },
    },
    required: ['message', 'difference', 'mission', 'teaser', 'story'],
  },
};

async function demanderLecture(demande) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELE,
      max_tokens: 4000,
      system: SYSTEME,
      messages: [{ role: 'user', content: demande }],
      tools: [OUTIL],
      tool_choice: { type: 'auto' },
    }),
  });
  if (!r.ok) throw new Error(`IA indisponible (${r.status}) : ${await r.text()}`);
  const data = await r.json();
  const contenu = data.content || [];
  const bloc = contenu.find((b) => b.type === 'tool_use' && b.name === 'ecrire_lecture');
  if (bloc) return bloc.input;
  // Filet de sécurité : l'IA a répondu en texte, on récupère le JSON.
  const texte = contenu.map((b) => b.text || '').join('');
  const a = texte.indexOf('{'), z = texte.lastIndexOf('}');
  if (a < 0 || z < a) throw new Error("L'IA n'a pas rendu de lecture");
  return JSON.parse(texte.slice(a, z + 1));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'POST uniquement' });
  try {
    const { marque = '', activite = '', theme } = req.body || {};
    if (!theme || !theme.planetes) return res.status(400).json({ erreur: 'Thème manquant' });

    const demande =
      `Marque : ${marque || 'non précisée'}\n` +
      `Activité : ${activite || 'non précisée'}\n\n` +
      `Positions du thème de l'entreprise :\n${decrireTheme(theme)}\n\n` +
      `Écris l'Astro Express de cette boîte.`;

    let lecture = null, derniere = '';
    for (let essai = 0; essai < 2 && !lecture; essai++) {
      try { lecture = await demanderLecture(demande); } catch (e) { derniere = e.message; if (/IA indisponible \((400|401|403)\)/.test(e.message)) break; }
    }
    if (!lecture) throw new Error(derniere || 'Lecture impossible');
    for (const k of ['message', 'difference', 'mission', 'story']) {
      if (!lecture[k]) throw new Error(`Réponse incomplète : ${k}`);
    }
    res.status(200).json(lecture);
  } catch (e) {
    res.status(500).json({ erreur: e.message });
  }
};
