# Ambient audio assets

The player reads version 3 of `manifest.json`. Each entry is a track.

## Track fields

- `id` and `title`
- `category`: one of the categories in `src/lib/ambientManifest.ts`
- `path`: a site path beginning with `/audio/ambient/`
- `duration_sec`
- `lufs_i`: integrated loudness, accepted about −35 to −29
- `tags`

`scripts/audio/generate_ambient_stems.py` writes `manifest.generated.json` next to this file. It does not replace `manifest.json`.

Screen reader mode forces ambient off. Reduced motion turns rotation off. A missing file fails safe to silence.
