---
title: Getting Started
description: Install LoKey Typer and start your first typing session.
sidebar:
  order: 1
---

LoKey Typer is on the Microsoft Store. The browser build is a Pages target once this repository is public, and you can run it locally while you develop.

## Microsoft Store (recommended)

Search **LoKey Typer** in the Microsoft Store or visit the [store listing](https://apps.microsoft.com/detail/9NRVWM08HQC4). Install and launch -- no account required.

## Browser

The Pages workflow publishes the app at [the Pages target](https://mcp-tool-shop-org.github.io/lokey-typer/) once this repository is public. The handbook is served under `/handbook/` on that same site. Until then, that address is not a live app. Use the local steps below.

## Run locally (development)

```bash
git clone https://github.com/mcp-tool-shop-org/lokey-typer.git
cd lokey-typer
npm ci
npm run dev
```

The dev server starts at `http://localhost:5173` by default.

## Your first session

1. Pick a practice mode from the home screen (Focus is a good starting point).
2. Choose an exercise.
3. Start typing. Your metrics appear in real time.
4. Optionally enable ambient sound from the settings panel.

All preferences, run history, and personal bests are stored locally in your browser. Nothing leaves your device.
