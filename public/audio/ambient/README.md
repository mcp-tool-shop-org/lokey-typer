# Ambient audio assets

The player reads version 3 of `manifest.json`. Each entry is a track.

## Track fields

- `id` and `title`
- `category`: one of the categories in `src/lib/ambientManifest.ts`. Settings only offers a category that has a track in the live manifest.
- `path`: a site path beginning with `/audio/ambient/`
- `duration_sec`
- `lufs_i`: integrated loudness, accepted about −35 to −29
- `tags`

`scripts/audio/generate_ambient_stems.py` writes `manifest.generated.json` next to this file. It does not replace `manifest.json`.

Screen reader mode forces ambient off. A bed under three minutes is heard once, then the player moves on. A bed of three minutes or longer keeps the five-to-ten minute hold. Reduced motion starts on a long bed when the catalog has one, and it does not rotate on its own. A missing file fails safe to silence.
