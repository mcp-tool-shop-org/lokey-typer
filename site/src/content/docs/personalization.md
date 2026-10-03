---
title: Personalization
description: How daily sets adapt to your recent typing sessions.
sidebar:
  order: 4
---

LoKey Typer adapts in small ways based on your recent sessions. The personalization system is designed to be optional, local-only, quiet, and suitable for long sessions.

## What it does

- Picks a daily set that stays stable for the entire day.
- Avoids repeating the same exercises too often (novelty tracking remembers your last 20 exercises per mode).
- Includes a small amount of targeted practice when a pattern shows up in recent runs.
- Adjusts exercise difficulty to stay near your current skill level.

## Skill model

LoKey Typer maintains a local skill model that tracks your progress using exponential moving averages (EMA). After each run, the model updates:

- **Overall EMA** for WPM, accuracy, and backspace rate.
- **Per-mode EMA** so each practice mode has its own difficulty calibration.
- **Performance by exercise length** (short, medium, long, and multiline).
- **Error hotspots** by character class (letters, numbers, punctuation, brackets, symbols, and others).
- **Weak tags** derived from exercises where your error rate is higher.

The skill model determines your difficulty band center. Exercises are rated 1 through 5 in difficulty, and the engine prefers exercises near your current band rather than exercises far above or below your level.

## Daily Set session types

When you open the Daily Set, the app selects one of three session types:

- **Reset** (5 exercises) -- a lighter session that starts with a confidence-building warm-up.
- **Mix** (8 exercises) -- a balanced session blending focus, real-life, and targeted exercises.
- **Deep** (10 exercises) -- a longer session that includes challenge exercises from competitive mode.

Each daily set is deterministic: the same user on the same day with the same session type always gets the same set. The exercises are a mix of confidence items (easier), targeted items (matching your weak tags), challenge items (harder), real-life scenarios, and general mix items.

## Recommendations

Outside of Daily Set, each mode has a recommendation engine that suggests exercises. Recommendations avoid your most recent 30 exercises, prefer exercises near your difficulty band, and give a small weight boost to exercises matching your weak tags. Template exercises get a slight preference because they render differently each time.

## What it does not do

- No accounts.
- No cloud profile.
- No hidden scoring system.
- No promises about productivity or cognition.

## Your control

You can ignore personalization entirely. The app remains fully usable without it. You can pick exercises manually in any mode, or let the recommendation engine handle selection.

## How data is stored

All personalization data lives in browser localStorage on your device. This includes preferences, run history (capped at 5,000 runs), personal bests, and the skill model. Nothing is sent to a server. There is no cloud sync, no telemetry, and no analytics.

## Privacy guarantee

LoKey Typer collects no data. The privacy policy in this repository is `public/privacy.html`. The Pages copy will be at the [privacy page](https://mcp-tool-shop-org.github.io/lokey-typer/privacy.html) once this repository is public. Until then, that address is not a live page.
