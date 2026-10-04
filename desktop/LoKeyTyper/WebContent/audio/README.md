Letter recordings are four locked keyboards. The app preloads all four and plays only the one that was chosen. It does not rotate them.

- key_3.wav — Mechanical, the default. Rich, old switch.
- key_2.wav — Clicky. Bright snap.
- key_1.wav — Tick. Short click.
- key_4.wav — Muted. Quiet strike.
- spacebar.wav, backspace.wav, and return_bell.wav are shared by every keyboard.
- A missed letter plays the chosen keyboard. error.wav is not that strike.

If a file is missing, that one sound uses a short synthesized fallback.

## Ambient tracks

The player does not swap layers. It reads `audio/ambient/manifest.json` (version 3). Each entry is one whole track. See `audio/ambient/README.md`. A missing file stays silent.
