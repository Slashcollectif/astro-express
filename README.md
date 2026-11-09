# Astro Express · Slash Collectif

Le thème astral business offert de Slash Collectif : calcul du thème de la boîte, lecture en 3 temps par l'IA, story à partager, commande de l'Astro Business complet (244 € TTC, Klarna possible).

## Ce que fait chaque fichier

| Fichier | Rôle |
|---|---|
| `public/index.html`, `style.css`, `app.js` | L'outil que voient tes visiteuses |
| `public/assets/` | Fonds de story (jour et night) et soleils |
| `api/theme.py` | Calcule le thème (Swiss Ephemeris, le moteur d'astro.com) |
| `api/lecture.js` | Demande la lecture à Claude à partir du thème |
| `prompts/systeme.md` | Les consignes de l'IA : ta voix, les 3 temps, les règles. **C'est ici que tu ajustes le ton.** |
| `ephe/seas_18.se1` | Fichier d'éphémérides pour Chiron |

## Mise en ligne, étape par étape

### 1. GitHub
1. Sur github.com, **New repository** → nom `astro-express` → **Public** → Create.
2. **uploading an existing file** → glisse **tout le contenu** du dossier décompressé (pas le dossier lui-même) → **Commit changes**.

### 2. Ta clé Claude
console.anthropic.com → **API Keys** → **Create Key**. Ajoute du crédit dans **Billing** (une lecture coûte environ 2 à 3 centimes, donc 10 € ≈ 400 lectures). Dans **Limits**, fixe un plafond mensuel (par ex. 20 €) : tu ne seras jamais prélevée au-delà.

### 3. Vercel
1. vercel.com → **Add New › Project** → importe `astro-express` depuis GitHub.
2. Avant de cliquer sur Deploy, ouvre **Environment Variables** et ajoute une seule variable :

| Nom | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | ta clé Claude (sk-ant-…) |

3. **Deploy**. Tu obtiens une adresse du type `https://astro-express.vercel.app`. Teste-la directement avant de l'intégrer.

### 4. Stripe
- **Paramètres › Moyens de paiement** → active **Klarna**.
- Le bouton est déjà branché, le mail de la cliente est pré-rempli.
- **Où retrouver les infos de la cliente** : dans le détail de chaque paiement, la **référence client** (client_reference_id) contient tout, par exemple :
  `BOITE_L-Arbre-de-Coeur_09092025_15h21_Rouen_PERSO_Amandine_04051990_sansheure_Chartres`
  → la boîte (nom, date, heure, ville) puis la cliente (prénom, date, heure, ville). Stripe t'envoie déjà une notif à chaque paiement.

### 5. Dans Circle
Crée une page publique (ou un post dans un espace public), ajoute un bloc **HTML personnalisé** (Embed) et colle :

```html
<iframe src="https://astro-express.vercel.app" style="width:100%;height:1400px;border:0;border-radius:24px" allow="clipboard-write; web-share" loading="lazy"></iframe>
```

Remplace l'adresse par celle que Vercel t'a donnée. Personne ne la voit : l'outil s'affiche dans ta page Circle.

### 6. Les tests à faire une fois en ligne
- [ ] Une lecture avec heure, une sans heure, une en mode « date de lancement ».
- [ ] Le formulaire Circle : la suite se débloque-t-elle toute seule après l'envoi ? Sinon, le lien « J'ai bien envoyé mon mail, je découvre la suite » apparaît au bout de quelques secondes. Dis-le moi, j'ajuste.
- [ ] La story sur ton téléphone : partage direct vers Instagram.
- [ ] Une commande test : la référence avec les infos apparaît-elle dans le paiement Stripe ?

## Modifier les textes
- Les textes de l'outil : `public/index.html`.
- La voix et les règles de l'IA : `prompts/systeme.md`.
- Sur GitHub, ouvre le fichier → crayon → modifie → Commit. Vercel remet en ligne tout seul en une minute.

## Licence
Le calcul utilise Swiss Ephemeris (licence AGPL). Le code de cet outil est donc publié sous AGPL-3.0 : le dépôt GitHub doit rester public. Les textes, visuels et le prompt restent la propriété de Slash Collectif.
