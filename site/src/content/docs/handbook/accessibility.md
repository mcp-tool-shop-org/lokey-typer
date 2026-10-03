---
title: Accessibility
description: Screen reader mode, reduced motion, and sound-optional design in LoKey Typer.
sidebar:
  order: 5
---

LoKey Typer is designed to be usable without relying on sound, animation, or hidden cues.

## Sound is optional

- The app remains fully usable with sound off.
- No progress or state is conveyed only through audio.
- Ambient sound can be turned off at any time.

## Screen Reader Mode

When Screen Reader Mode is enabled, LoKey Typer automatically disables ambient sound. No audio-only cues are used for state changes. All information is available through the DOM and ARIA attributes.

## Reduced Motion

When Reduced Motion is enabled, dynamic behavior is reduced or removed. Ambient macro evolution is disabled (micro drift only). The app stays conservative and predictable.

## Font scale

The text display supports three font scale options: 90%, 100% (default), and 110%. This is set in preferences and applies to the typing area.

## Screen reader exercise filter

When Screen Reader Mode is enabled, the exercise picker automatically filters out multiline exercises and exercises longer than 60 seconds. This keeps the typing experience predictable and manageable for screen reader users. If filtering removes all candidates, the full pool is used as a fallback.

## Cognitive predictability

- No surprise sounds.
- No notification-like cues embedded in ambience.
- Defaults aim to stay quiet, predictable, and non-fatiguing.

## Design commitment

If a setting or feature makes the app harder to use, that is a bug. LoKey Typer is built for extended practice sessions, and accessibility is enforced at the system level -- not bolted on as an afterthought.
