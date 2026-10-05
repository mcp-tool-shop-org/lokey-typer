<p align="center">
  <a href="README.md">English</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

A calm typing practice app with ambient soundscapes, personalized daily sets, and no accounts required.

## What it is

LoKey Typer is a typing practice app built for adults who want quiet, focused sessions without gamification, leaderboards, or distractions.

All data stays on your device. No accounts. No cloud. No tracking.

## Practice modes

- **Focus** — Calm, curated exercises for building rhythm and accuracy
- **Real-Life** — Practice with emails, forms, messages, notes, and other everyday writing
- **Competitive** — Timed sprints with personal bests
- **Daily Set** — A fresh set of exercises generated each day, adapted to your recent sessions
- **Study** — Add your own text. It stays on this device and comes back one piece at a time, in order or shuffled.

## Features

- Ambient soundscapes designed for sustained focus. Settings lists only categories that have a track.
- Mechanical typewriter keystroke audio (optional), plus Clicky, Tick, and Muted. The keyboard you pick stays on that recording. Mechanical is the default.
- Personalized daily exercises based on recent sessions
- Full offline support after first load
- Accessible: screen reader mode, reduced motion, sound-optional

## Install

**Microsoft Store** (recommended):
[Get it from the Microsoft Store](https://apps.microsoft.com/detail/9NRVWM08HQC4)

**Browser:**
Run `npm run dev` and open the local address. The Pages workflow publishes the app at [the Pages site](https://mcp-tool-shop-org.github.io/lokey-typer/). The handbook is served under `/handbook/` on that same site.

## Privacy

LoKey Typer collects no data. Preferences, run history, personal bests, and text you add for Study stay in this browser. See the full [privacy policy](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html). That page ships with the site.

## License

MIT. See [LICENSE](LICENSE).

---

## Development

### Run locally

```bash
npm ci
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run verify` — content checks, sound gates, typecheck, coverage, and the production build
- `npm run typecheck` — TypeScript build-only typecheck
- `npm run lint` — ESLint
- `npm run preview` — preview production build locally
- `npm run validate:content` — schema + structural validation for all content packs
- `npm run gen:phase2-content` — regenerate Phase 2 packs
- `npm run smoke:rotation` — novelty/rotation smoke test
- `npm run qa:ambient:assets` — ambient WAV asset checks
- `npm run qa:sound-design` — sound design acceptance gates
- `npm run qa:phase3:novelty` — daily set novelty simulation
- `npm run qa:phase3:recommendation` — recommendation sanity simulation

### Code structure

- `src/app` — app wiring (router, shell/layout, global providers)
- `src/features` — feature-owned UI (pages + feature components)
- `src/lib` — shared domain logic (storage, typing metrics, audio/ambient, etc.)
- `src/content` — content types + content pack loading

See `modular.md` for architecture contracts and import boundaries.

### Import aliases

- `@app` → `src/app`
- `@features` → `src/features`
- `@content` → `src/content`
- `@lib` → `src/lib/public` (public API surface)
- `@lib-internal` → `src/lib` (restricted to app wiring/providers)

### Routes

- `/` — Home
- `/daily` — Daily Set
- `/focus` — Focus mode
- `/real-life` — Real-Life mode
- `/competitive` — Competitive mode
- `/study` — Study, for text you add
- `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` — run an exercise
- `/practice` redirects to `/focus`. `/arcade` redirects to `/competitive`

Settings open from the header. There is no exercise-list page.

### Docs

- `modular.md` — architecture + import boundary contracts
- `docs/sound-design.md` — ambient sound design framework
- `docs/sound-design-manifesto.md` — sound design manifesto + acceptance tests
- `docs/sound-philosophy.md` — public-facing sound philosophy
- `docs/accessibility-commitment.md` — accessibility commitment
- `docs/how-personalization-works.md` — personalization explainer

---

## Security & Data Scope

LoKey Typer is a typing practice web app (PWA + Microsoft Store) with no accounts and no telemetry.

- **Data accessed:** Browser localStorage (preferences, run history, personal bests) and the IndexedDB database `lokey-study` (text you add on the Study page)
- **Data NOT accessed:** No cloud sync. No telemetry. No analytics. No accounts. No tracking
- **Network:** The app loads its own pages and audio from the same origin. It does not call an account service, a telemetry endpoint, or any third-party API.
- **No telemetry** is collected or sent

Full policy: [SECURITY.md](SECURITY.md)

---

## Scorecard

| Category | Score |
|----------|-------|
| A. Security | 10/10 |
| B. Error Handling | 10/10 |
| C. Operator Docs | 10/10 |
| D. Shipping Hygiene | 10/10 |
| E. Identity (soft) | 10/10 |
| **Overall** | **50/50** |

---

<p align="center">
  Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
</p>
