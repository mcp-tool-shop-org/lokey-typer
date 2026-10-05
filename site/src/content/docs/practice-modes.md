---
title: Practice Modes
description: The four practice modes in LoKey Typer and when to use each one.
sidebar:
  order: 2
---

LoKey Typer has four practice modes. Each one is designed for a different mindset.

## Focus

Calm, curated exercises for building rhythm and accuracy. This is the default mode and a good starting point for new users. Exercises are short and predictable, letting you settle into a comfortable typing cadence. Focus mode uses a minimal HUD by default, and live WPM is hidden to keep the experience distraction-free.

## Real-Life

Practice with emails, forms, messages, notes, and other everyday writing. This mode pulls from that kind of writing rather than artificial drills.

## Competitive

Timed sprints with personal bests. When you want measurable progress, Competitive mode tracks your speed and accuracy across runs. Personal bests are stored locally -- no leaderboards, no accounts.

Sprint durations are 30 seconds, 60 seconds (default), or 120 seconds. The text repeats as needed so the sprint never runs out of content. A ghost indicator shows your pace relative to your personal best. Live WPM is shown by default in this mode.

## Daily Set

A fresh set of exercises generated each day, adapted to your recent sessions. Daily Set keeps practice varied without requiring you to choose exercises manually. The selection is stable for the entire day (it will not change mid-session) and includes a small amount of targeted practice when patterns show up in your recent runs.

Daily sets come in three session types: Reset (5 exercises), Mix (8 exercises), and Deep (10 exercises). Each set blends confidence warm-ups, targeted practice for your weak areas, real-life scenarios, and optional challenge items.

See the [Personalization](/lokey-typer/handbook/personalization/) page for details on how daily sets are built.

## Study

Study is not a practice mode. Add a text file or paste a passage, then type it one piece at a time, in order or shuffled. The text stays on this device, including after a restart. Finishing a piece does not save a Focus run.

## Routes

The app mounts these routes:

| Route | Purpose |
|-------|---------|
| `/` | Home |
| `/daily` | Daily set |
| `/focus`, `/real-life`, `/competitive` | Mode pages. Start typing begins a session |
| `/study` | Study, for text you add |
| `/focus/run/:exerciseId`, `/real-life/run/:exerciseId`, `/competitive/run/:exerciseId` | A direct run |
| `/practice` | Redirects to `/focus` |
| `/arcade` | Redirects to `/competitive` |

Settings open from the header. There is no exercise-list page.
