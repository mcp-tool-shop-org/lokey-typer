Place optional typewriter sound samples here.

The app will try to preload these files:
- key_1.wav, key_2.wav, key_3.wav, key_4.wav
- spacebar.wav
- backspace.wav
- return_bell.wav
- error.wav

If files are missing, the app uses a low-latency synthesized fallback (Web Audio) so sound still works.

## Ambient tracks

The player does not swap layers. It reads `audio/ambient/manifest.json` (version 3). Each entry is one whole track. See `audio/ambient/README.md`. A missing file stays silent. This note is the packaged copy of the same correction. The minified app bundles were not rebuilt for it.
