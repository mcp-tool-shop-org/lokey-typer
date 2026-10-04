---
title: Sound Design
description: How ambient soundscapes work in LoKey Typer and why they are different from background music.
sidebar:
  order: 3
---

Most typing tools treat sound as an afterthought. LoKey Typer treats it as a core part of the experience.

## An environment, not a playlist

LoKey Typer does not play songs. It creates a quiet acoustic environment designed to stay out of the way while you type. There is no rhythm to follow and no beat to lock onto. A track stays for several minutes, then crossfades into the next one.

## Design principles

The ambient system is built around four rules:

1. **No rhythmic entrainment.** No audible tempo, no repeating transient patterns, no regular amplitude modulation. The soundscape never competes with your typing cadence.

2. **Keystroke-safe mixing.** Ambient energy is kept lower in the frequency ranges where click and presence cues live. Typing feedback always stays clear.

3. **Long-session safe.** Volume levels are kept low and stable. Frequency ranges associated with fatigue are avoided. Crossfades are long and smooth -- no hard cuts.

4. **Subtle evolution.** The current track changes every 5 to 10 minutes, with a crossfade of 6 to 8 seconds. Reduced motion keeps the current track.

## The library

The live catalog is `public/audio/ambient/manifest.json`. Settings only lists a category when that file contains a track for it. Campfire, café, and night stay hidden until a track arrives.

The tracks are non-rhythmic. They are not music. If you forget the sound is there until you turn it off, it is doing its job.

## Typewriter keystrokes

Optional mechanical typewriter keystroke audio is available. It is mixed to never compete with ambient sound and never reacts to your typing rhythm. The letter strike is the keyboard you picked, and it does not change from key to key. Mechanical is the default.

## Accessibility

When Screen Reader Mode is enabled, ambient sound is automatically disabled. When Reduced Motion is enabled, the soundscape stays on the current track. Sound is always optional -- the app remains fully usable without it.

## What we do not claim

LoKey Typer does not promise productivity hacks, brainwave tuning, or cognitive optimization. The goal is simpler: a calm, unobtrusive environment where typing feels easier to sustain.
