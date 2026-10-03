<p align="center">
  <strong>English</strong> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português</a>
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

Une application de pratique de la dactylographie, conçue pour la détente, avec des paysages sonores d'ambiance, des exercices quotidiens personnalisés et ne nécessitant aucun compte.

## Qu'est-ce que c'est ?

LoKey Typer est une application de formation à la dactylographie conçue pour les adultes qui souhaitent des séances calmes et concentrées, sans éléments de gamification, classements ou distractions.

Toutes les données restent sur votre appareil. Pas de comptes, pas de stockage en nuage, pas de suivi.

## Modes d'entraînement

- **Concentration** — Exercices calmes et structurés pour améliorer le rythme et la précision.
- **Réaliste** — Entraînement avec des exemples de courriels, de fragments de code et de textes courants.
- **Compétitif** — Sprints chronométrés avec enregistrement des meilleurs résultats personnels.
- **Programme quotidien** — Un ensemble d'exercices renouvelé chaque jour, adapté à vos sessions précédentes.

## Caractéristiques

- Paysages sonores conçus pour favoriser la concentration (42 pistes, non rythmiques).
- Sons de frappe de machine à écrire (optionnel).
- Exercices quotidiens personnalisés basés sur les séances précédentes.
- Fonctionnement hors ligne complet après le premier chargement.
- Accessibilité : mode lecteur d'écran, réduction des animations, option de désactivation du son.

## Installer

**Microsoft Store** (recommandé) :
[Téléchargez-le depuis le Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Navigateur :**
Lancez `npm run dev` et ouvrez l'adresse locale. Le workflow Pages publie l'application à [la cible Pages](https://mcp-tool-shop-org.github.io/lokey-typer/) une fois ce dépôt public. Le manuel est servi sous `/handbook/` sur le même site. D'ici là, cette adresse n'est pas une application en ligne.

## Confidentialité

LoKey Typer ne collecte aucune donnée. Toutes les préférences, l'historique des sessions et les meilleurs scores sont stockés localement dans votre navigateur. Consultez la [politique de confidentialité](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) complète. Cette page est publiée avec le site. Tant que ce dépôt n'est pas public, cette adresse n'est pas en ligne.

## Licence

MIT. Voir [LICENSE](LICENSE).

---

## Développement

### Exécuter localement

```bash
npm ci
npm run dev
```

### Construire

```bash
npm run build
npm run preview
```

### Scénarios.
Textes de pièces.
Programmes informatiques.
Écritures.
Manuscrits.
Scripts (informatique)

- `npm run dev` : serveur de développement
- `npm run build` : vérification des types + construction pour la production
- `npm run typecheck` : vérification des types uniquement pour TypeScript
- `npm run lint` : ESLint
- `npm run preview` : aperçu de la construction pour la production, localement
- `npm run validate:content` : validation du schéma et de la structure pour tous les ensembles de contenu
- `npm run gen:phase2-content` : régénération des ensembles de contenu de la phase 2
- `npm run smoke:rotation` : test de nouveauté/rotation
- `npm run qa:ambient:assets` : vérifications des ressources audio ambiantes (WAV)
- `npm run qa:sound-design` : tests d'acceptation de la conception sonore
- `npm run qa:phase3:novelty` : simulation quotidienne des nouveautés
- `npm run qa:phase3:recommendation` : simulation de la cohérence des recommandations

### Structure du code

- `src/app` : configuration de l'application (routeur, structure générale/interface utilisateur, fournisseurs globaux).
- `src/features` : interface utilisateur spécifique à chaque fonctionnalité (pages et composants liés aux fonctionnalités).
- `src/lib` : logique métier partagée (stockage, métriques, audio/ambiance, etc.).
- `src/content` : types de contenu et chargement des ensembles de contenu.

Consultez le fichier `modular.md` pour connaître les contrats d'architecture et les limites d'importation.

### Alias d'importation

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (surface de l'API publique)
- `@lib-internal` → `src/lib` (réservé au fonctionnement interne de l'application/aux fournisseurs)

### Itinéraires

- `/` — Accueil
- `/daily` — Programme quotidien
- `/focus` — Mode concentration
- `/real-life` — Mode "vie réelle"
- `/competitive` — Mode compétitif
- `/<mode>/exercises` — Liste des exercices
- `/<mode>/settings` — Paramètres
- `/<mode>/run/:exerciseId` — Exécuter un exercice

### Documents

- `modular.md` — architecture et contrats de délimitation des modules
- `docs/sound-design.md` — cadre de conception sonore ambiante
- `docs/sound-design-manifesto.md` — manifeste de la conception sonore + tests d'acceptation
- `docs/sound-philosophy.md` — philosophie sonore destinée au grand public
- `docs/accessibility-commitment.md` — engagement en faveur de l'accessibilité
- `docs/how-personalization-works.md` — explication du fonctionnement de la personnalisation.
