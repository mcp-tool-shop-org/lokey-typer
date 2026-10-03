# Ambient audio assets

The player reads version 3 of `manifest.json`. Each entry is a track. This packaged copy matches that. It is not a layer engine, and the minified app bundles were not rebuilt for this note.

## Track fields

- `id` and `title`
- `category`: settings lists a category only when the manifest has a track for it
- `path`: a path to one whole track
- `duration_sec`
- `lufs_i`
- `tags`

## Notes

- A missing or invalid file stays silent.
- Screen reader mode keeps the soundscape off. Reduced motion keeps the current track.
