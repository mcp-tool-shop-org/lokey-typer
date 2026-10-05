<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/LoKey-Typer/readme.png" alt="LoKey Typer" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml"><img src="https://github.com/mcp-tool-shop-org/lokey-typer/actions/workflows/deploy.yml/badge.svg" alt="Deploy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/lokey-typer/"><img src="https://img.shields.io/badge/Pages-target-blue" alt="Pages target"></a>
  <a href="https://apps.microsoft.com/detail/9NRVWM08HQC4"><img src="https://img.shields.io/badge/Microsoft_Store-available-blue" alt="Microsoft Store"></a>
</p>

Une application de pratique de frappe relaxante, avec des paysages sonores ambiants, des exercices quotidiens personnalisés et sans besoin de créer un compte.

## Description

LoKey Typer est une application de pratique de frappe conçue pour les adultes qui souhaitent des sessions calmes et concentrées, sans éléments de gamification, classements ou distractions.

Toutes les données restent sur votre appareil. Pas de comptes. Pas de cloud. Pas de suivi.

## Modes de pratique

- **Concentration** — Exercices calmes et sélectionnés pour développer le rythme et la précision.
- **Réalité** — Pratique avec des e-mails, des formulaires, des messages, des notes et d’autres types d’écriture courants.
- **Compétition** — Sprints chronométrés avec enregistrement des meilleurs temps personnels.
- **Exercice quotidien** — Un nouvel ensemble d’exercices généré chaque jour, adapté à vos sessions récentes.
- **Étude** — Ajoutez votre propre texte. Il reste sur cet appareil et est présenté progressivement, dans l’ordre ou de manière aléatoire.

## Fonctionnalités

- Paysages sonores ambiants conçus pour une concentration soutenue. Les paramètres affichent uniquement les catégories pour lesquelles il existe une piste audio.
- Audio de frappe de machine à écrire mécanique (facultatif), ainsi que les options « Clicky », « Tick » et « Muted ». Le clavier que vous choisissez est utilisé pour l’enregistrement. L’option « Mécanique » est l’option par défaut.
- Exercices quotidiens personnalisés basés sur les sessions récentes.
- Prise en charge complète hors ligne après le premier chargement.
- Accessible : mode lecteur d’écran, réduction des mouvements, son facultatif.

## Installation

**Microsoft Store** (recommandé) :
[Téléchargez-la depuis le Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navigateur :**
Exécutez `npm run dev` et ouvrez l’adresse locale. Le flux de travail Pages publie l’application sur [le site Pages](https://mcp-tool-shop-org.github.io/lokey-typer/). Le manuel d’utilisation est accessible à l’adresse `/handbook/` sur le même site.

**Docker (auto-hébergement) :**

```bash
docker run -d --name lokey-typer -p 8080:8080 --restart unless-stopped ghcr.io/mcp-tool-shop-org/lokey-typer:latest
```

Ouvrez ensuite `http://localhost:8080/`. Le manuel d’utilisation est disponible à l’adresse `/lokey-typer/handbook/`. Vos progrès sont conservés par votre navigateur pour cette adresse, et non à l’intérieur du conteneur. Par conséquent, l’arrêt, la mise à niveau ou le remplacement du conteneur les conserve. Ouvrez le même hôte et le même port à chaque fois ; une adresse différente démarre une nouvelle session.

## Confidentialité

LoKey Typer ne collecte aucune donnée. Les préférences, l’historique des sessions, les meilleurs temps personnels et le texte que vous ajoutez pour l’exercice d’étude sont stockés dans ce navigateur. Consultez la [politique de confidentialité](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html). Cette page est fournie avec le site.

## Licence

MIT. Consultez [LICENSE](LICENSE).

---

## Développement

### Exécution locale

```bash
npm ci
npm run dev
```

### Compilation

```bash
npm run build
npm run preview
```

### Scripts

- `npm run dev` — serveur de développement
- `npm run build` — vérification du type et compilation pour la production
- `npm run verify` — vérification du contenu, validation des sons, vérification du type, couverture et compilation pour la production
- `npm run typecheck` — compilation TypeScript uniquement pour la vérification du type
- `npm run lint` — ESLint
- `npm run preview` — aperçu de la compilation pour la production en local
- `npm run validate:content` — validation du schéma et de la structure pour tous les packs de contenu
- `npm run gen:phase2-content` — régénération des packs de la phase 2
- `npm run smoke:rotation` — test de nouveauté/rotation
- `npm run qa:ambient:assets` — vérification des éléments audio ambiants au format WAV
- `npm run qa:sound-design` — validation de la conception sonore
- `npm run qa:phase3:novelty` — simulation de la nouveauté de l’exercice quotidien
- `npm run qa:phase3:recommendation` — simulation de la pertinence des recommandations

### Structure du code

- `src/app` — câblage de l’application (routeur, shell/mise en page, fournisseurs globaux)
- `src/features` — interface utilisateur spécifique à chaque fonctionnalité (pages + composants de fonctionnalité)
- `src/lib` — logique de domaine partagée (stockage, métriques de frappe, audio/ambiance, etc.)
- `src/content` — types de contenu + chargement des packs de contenu

Consultez `modular.md` pour connaître les contrats d’architecture et les limites d’importation.

### Alias d’importation

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (surface d’API publique)
- `@lib-internal` → `src/lib` (restreint au câblage/fournisseurs de l’application)

### Routes

- `/` — Accueil
- `/daily` — Exercice quotidien
- `/focus` — Mode Concentration
- `/real-life` — Mode Réalité
- `/competitive` — Mode Compétition
- `/study` — Étude, pour le texte que vous ajoutez
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — exécution d’un exercice
- `/practice` redirige vers `/focus`. `/arcade` redirige vers `/competitive`

Les paramètres s’ouvrent à partir de l’en-tête. Il n’y a pas de page de liste d’exercices.

### Documentation

- `modular.md` — architecture + contrats de limite d’importation
- `docs/sound-design.md` — cadre de conception sonore ambiant
- `docs/sound-design-manifesto.md` — manifeste de conception sonore + tests d’acceptation
- `docs/sound-philosophy.md` — philosophie sonore publique
- `docs/accessibility-commitment.md` — engagement en matière d’accessibilité
- `docs/how-personalization-works.md` — explication de la personnalisation

---

## Sécurité et portée des données

LoKey Typer est une application web de pratique de frappe (PWA + Microsoft Store) sans compte et sans télémétrie.

- **Données accessibles :** localStorage du navigateur (préférences, historique des sessions, meilleurs temps personnels) et la base de données IndexedDB `lokey-study` (texte que vous ajoutez dans la page Étude)
- **Données NON accessibles :** pas de synchronisation dans le cloud, pas de télémétrie, pas d’analyse, pas de compte, pas de suivi
- **Réseau :** l’application charge ses propres pages et son propre audio à partir de la même origine. Elle n’appelle pas de service de compte, de point de terminaison de télémétrie ou d’API tierce.
- **Aucune télémétrie** n’est collectée ou envoyée

Politique complète : [SECURITY.md](SECURITY.md)

---

## Tableau de bord

| Catégorie | Score |
|----------|-------|
| A. Sécurité | 10/10 |
| B. Gestion des erreurs | 10/10 |
| C. Documentation pour les opérateurs | 10/10 |
| D. Hygiène de publication | 10/10 |
| E. Identité (souple) | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
