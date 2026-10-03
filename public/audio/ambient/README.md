# Ambient audio assets

Phase 3.4 uses a **manifest-driven** ambient system.

- Manifest: `public/audio/ambient/manifest.json`
- Runtime loads stems from manifest paths.

## Expected stem fields

Each stem entry in the manifest should include:

- `id`: stable stem id (string)
- `mode`: `focus` | `competitive` (optionally `real_life` treated as focus)
- `profile`: e.g. `focus_soft`, `focus_warm`, `competitive_clean`, `nature_air`
- `layer`: `low_bed` | `mid_texture` | `mid_presence` | `air` | `room`
- `path`: public URL path (e.g. `audio/ambient/focus/.../file.wav`)

## Notes

- Missing/invalid assets should fail-safe to silence (no crash).
- Accessibility: Screen Reader Mode forces ambient off; Reduced Motion disables macro evolutions (micro drift only).
- For debugging: set `localStorage.lkt_ambient_debug = "1"` and watch console logs.
