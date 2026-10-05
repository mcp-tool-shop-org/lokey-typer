# Changelog

## 2.0.0 — 2026-10-05

The version now matches the Microsoft Store package, 2.0.0.0.

### Added
- **Study**: a library that keeps your own text and lets you practise it.
- A Docker image, `ghcr.io/mcp-tool-shop-org/lokey-typer`, that serves the app and its handbook on port 8080. Progress stays in the browser, so replacing the container keeps it.
- A packaged Windows shell for the Store (WinUI with WebView2), with its own tests.
- A pace mark and an end-of-run board; a missed letter stays marked on the keyboard.
- Spoken passages for screen readers, which can start the passage over.

### Changed
- The ambient catalog is mastered to a measured loudness and plays at a level a normal speaker setting can hear; long beds hold, and each keyboard sound is locked to one recording.
- A finish is called clean only above an accuracy floor.
- A setting or run that did not save says so, instead of failing quietly.
- New waveform-and-sprig mark, and refreshed public pages.

### Fixed
- Day counts, sound unlocks and saves stay aligned with what the typist sees.
- Ambient sound does not start until a track is playing.

## 1.0.2 — 2026-03-25

### Added
- Template render test suite (7 tests): slot replacement, deterministic seeding, empty slot fallback, repeated slot consistency

### Note
- The current ambient catalog is `public/audio/ambient/manifest.json`. The 42-track line under 1.0.0 describes that release, not the library in this tree.

## 1.0.0 — 2026-02-07

Initial release.

### Features

- Four practice modes: Focus, Real-Life, Competitive, Daily Set
- Curated content packs with exercises across multiple categories
- Personalized daily exercise sets adapted to recent sessions
- Ambient sound system with 42 non-rhythmic soundscape tracks
- Mechanical typewriter keystroke audio with synth fallback
- WPM and accuracy metrics with end-of-run feedback
- Personal best tracking per exercise
- Local-only persistence (preferences, run history, personal bests)
- Full offline support via service worker
- Accessible: screen reader mode, reduced motion, sound-optional
- Available on Microsoft Store and as a browser PWA
