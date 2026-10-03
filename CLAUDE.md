# lokey-typer

Calm typing practice. The sound is the product: a mechanical keybed, other keyboard voices, and ambient beds quiet enough to type under.

## What it is

A Vite + React app, plus a WinUI shell that hosts it for Windows. No accounts. Session data stays on the device.

Modes are Focus, Real Life, Competitive, and a daily set.

## Sound

- Keystrokes: `src/lib/audio.ts`
- Ambient: `src/lib/ambient/ambientPlayerV3.ts`
- Live catalog: `public/audio/ambient/manifest.json` (version 3, a `tracks` array)
- `scripts/audio/generate_ambient_stems.py` writes `manifest.generated.json`. It does not replace the live manifest.

## Package

The Store submission is `LoKeyTyper_1.1.0.0_x64.msix` for product `9NRVWM08HQC4`. The package identity name is `mcp-tool-shop.LoKeyTyper`. The publisher subject is the one in `desktop/LoKeyTyper/Package.appxmanifest`. A later Rust executable can take that package's entry point. Keep the name and the publisher, or the Store product will not update.

The hosted StartPage manifest under `msix-package/` is not that package.

## Commands

Node 22.

- `npm run dev`
- `npm test`
- `npm run qa:sound-design`
- `npm run qa:ambient:assets`
