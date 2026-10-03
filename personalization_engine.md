# Phase 3 — Personalization Engine (Rules + Metrics)

This document is the Phase 3 handoff for implementing **adaptive exercise selection** (not generative AI) plus a **daily ritual loop**, **competitive v2**, and **accessibility locks**.

North Star: *Make the trainer feel like it learns you — quietly chooses better exercises, supports a calm daily ritual, enables competitive intensity when requested, and remains accessibility-first.*

## Repo integration contract (read this first)

This repo is contract-driven. Before implementing Phase 3 work, read `modular.md`.

Non-negotiables:

- Feature/UI code in `src/features/**` only imports public surfaces: `@lib`, `@content`, `@app`.
- Implementation details and engines live in `src/lib/**` and are exposed selectively via `src/lib/public/index.ts` (`@lib`).
- Content access goes through the content gateway (`@content`). Features must not load packs directly.
- “Effective settings” (accessibility locks) are derived centrally (no local drift).

## Current status (already implemented foundations)

These are already present in code and should be extended rather than re-created:

- **Skill model storage + self-heal:** `UserSkillModel` is persisted locally and loaded with corruption-safe defaults.
- **Skill model update logic:** `updateSkillModelFromRun` computes the next model from a `RunResult`.
- **Run-time integration:** typing sessions update and persist the skill model after a run.
- **Schema stub:** `src/content/phase3/schemas/user_skill_model.schema.json` exists as the shape contract.

Phase 3 work should build on top of these pieces (and keep imports within the modularity rules).

## Scope and non-goals

**In scope**

- Adaptive selection based on local run history + a local skill model
- Daily sets seeded by `date + user_id`
- Competitive training improvements that reward clean speed
- Accessibility presets that constrain both UI + recommendation outputs

**Not in scope**

- Any content generation beyond existing packs/templates
- Online accounts / server persistence
- Any ML model training; this is deterministic rules + metrics

## Deliverables

### 1) Local skill model + persistence

- `UserSkillModel` persisted locally and updated after each run
- JSON Schema: `src/content/phase3/schemas/user_skill_model.schema.json`
- Update logic that tracks:
  - rolling WPM and rolling accuracy
  - rolling backspace rate
  - error hotspots by character class (punctuation, numbers, quotes, apostrophes, dashes, etc.)
  - performance by length type (short / medium / long / multiline)

Acceptance

- After 1 run: skill model exists and has plausible values
- After 10 runs: weak hotspots are stable (top classes stop fluctuating wildly)
- Skill model remains valid across app reloads, and corrupt storage self-heals

### 2) Recommendation engine (adaptive selection)

Inputs

- `mode` (focus / real-life / competitive)
- `UserSkillModel`
- recent history for novelty
- accessibility preset locks (see workstream 4)

Rules (baseline)

- **Novelty constraint:** no repeats within last `N` plays for the given mode
- **Spaced repetition:** bias toward exercises matching weak tags/classes
- **Difficulty auto-banding:** pick within a comfort band, with occasional stretch
- **Competitive PB validity gate:** PB WPM only updates when accuracy $\ge 95\%$ (already enforced)

Acceptance

- After ~10 sessions, “next best” avoids repeats and increasingly targets weak tags
- If rolling accuracy drops below a threshold (ex: 93%), next picks shift to calmer/easier items

### 3) Daily ritual + replay loops (non-gamified)

Daily Set

- Generator for 3 session types:
  - **3-minute reset** (5 items)
  - **10-minute mix** (8 items)
  - **20-minute deep focus** (10 items)
- Seeded by `dateKey + userId` so it’s stable across refreshes but unique per user
- Must include:
  - 1 confidence win (comfort)
  - 1 challenge (stretch)
  - 1 real-life scenario

Streaks without pressure

- “Days practiced” counter
- “Best week” (max days practiced in any rolling 7-day window)
- No loss framing; missing a day does not show negative messaging

Acceptance

- Daily set feels fresh for 14 consecutive days (low duplication rate)
- Missing a day doesn’t punish/shame the user

### 4) Accessibility locks (personalization-aware)

Goal: personalization must **never** break accessibility.

Locks

- SR mode: chunked content + minimal HUD by default
- Reduced motion: disable animated recommendation transitions
- High contrast: force non-color error markers (already present in overlay, must stay enforced)

Preset overrides

- Dyslexia preset example rules:
  - prefer shorter items
  - increase spacing
  - avoid dense punctuation packs when accuracy is low

Acceptance

- Any preset results in coherent recommendations
- No setting combination blocks starting, completing, or exiting a session

### 5) Competitive Layer v2

Challenges

- accuracy streak
- backspace budget
- tempo hold (consistency score)

Ghost improvements

- compare WPM + accuracy + backspaces vs PB

Local leagues (optional)

- today / week / all-time panels
- per-mode PBs + trends

Acceptance

- Competitive visibly encourages clean speed (accuracy gate, backspace control)
- Users can tell what to improve next without reading a tutorial

### 6) Premium polish (performance + feel)

- sound profiles (calm mechanical / crisp competitive)
- preloaded audio and stable render pipeline to avoid stutters
- minimal transitions, respects reduced motion

Acceptance

- No input lag on long sessions
- Audio toggles are instant and never stutter

## QA / scripts

- Novelty test: simulate 14 days of daily sets; measure duplicates
- Accessibility stress test: randomize presets + selection inputs; ensure no empty pools
- Recommendation sanity test: simulate N sessions; confirm repeats drop and weak-tag hits rise

## Implementation notes

- Keep everything local-only. `userId` is a local stable identifier stored in `localStorage`.
- Template rendering must be seeded with `dateKey + userId` (not just date) so daily ritual is personal.
- Guardrails:
  - if a constraint results in an empty pool, relax constraints in a deterministic order (novelty first)
  - never produce an empty daily set; always fall back to safe baseline exercises
