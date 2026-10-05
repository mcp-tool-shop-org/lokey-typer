# lokey-typer

Calm typing practice. The sound is the product: a mechanical keybed, other keyboard voices, and ambient beds quiet enough to type under.

## What it is

A Vite + React app, plus a WinUI shell that hosts it for Windows. No accounts. Session data stays on the device.

Modes are Focus, Real Life, Competitive, and a daily set. Study is its own page, not a fourth mode. Text you add stays in IndexedDB on this device.

## Sound

- Keystrokes: `src/lib/audio.ts`
- Ambient: `src/lib/ambient/ambientPlayerV3.ts`
- Live catalog: `public/audio/ambient/manifest.json` (version 3, a `tracks` array)
- `scripts/audio/generate_ambient_stems.py` writes `manifest.generated.json`. It does not replace the live manifest.

## Package

The package version is `2.0.0.0` for product `9NRVWM08HQC4`. The earlier submission was `LoKeyTyper_1.1.0.0_x64.msix`. The package identity name is `mcp-tool-shop.LoKeyTyper`. The publisher subject is the one in `desktop/LoKeyTyper/Package.appxmanifest`. A later Rust executable can take that package's entry point. Keep the name and the publisher, or the Store product will not update.

The hosted StartPage manifest under `msix-package/` is not that package. Its identity name is `mcp-tool-shop.LoKeyTyper.WebHost`, so installing it cannot update the Store product. It does not grant Windows Runtime access to the site.

## Site

One Pages workflow, `.github/workflows/deploy.yml`, builds the app and the handbook together. The app is the site root. The handbook is the Starlight build at `/lokey-typer/handbook/`. `dist/404.html` is a copy of the app, so a refresh on a client route still opens the typer. The repository is public. The Pages workflow publishes that URL.

Content packs repeat passages. The loader keeps one copy, chooses a stable difficulty when the copies disagree, and still opens every old id.

## Commands

Node 22.

- `npm run dev`
- `npm test`
- `npm run verify`
- `npm run qa:sound-design`
- `npm run qa:ambient:assets`
