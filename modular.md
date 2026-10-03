# Modularity contracts

Purpose: this repository is designed to scale by **addition**, not by repeated refactors.

Phase 3 work (personalization, daily sets, more content, more settings, more audio profiles) should plug into stable contracts and must not bypass boundaries.

## High-level architecture

```
src/
  app/           # Composition root (shell + providers)
  features/      # Feature modules (UI + orchestration)
  lib/           # Core services (logic + side effects)
    public/      # Public API surface (@lib)
  content/       # Content gateway (packs/types/loaders)
```

## Boundaries are enforced

Boundaries are not “best effort”; they’re enforced via:

- TypeScript/Vite aliases (`@lib`, `@lib-internal`, `@content`, `@app`, `@features`)
- ESLint import restrictions (`no-restricted-imports`)

## Import rules (non-negotiable)

### 1) Feature modules use public surfaces only

`src/features/**` may import:

- `@lib` (public lib API; `src/lib/public/index.ts`)
- `@content` (content gateway; `src/content/*`)
- `@app` (app-level public exports, e.g. `usePreferences`)
- `@features/*` (within-feature imports)

`src/features/**` must NOT import:

- `@lib-internal/*`
- deep paths like `@lib/*`
- `src/lib/*` or any relative `../lib/*` / `../../lib/*`

These rules are enforced by ESLint.

### 2) App providers may use internals (localized)

`src/app/**` (providers/composition) may import `@lib-internal/*` when needed.

Rule of thumb:

- If it persists data, touches browser APIs, or manages long-lived engines, it should live behind a provider/service boundary.
- Keep internal imports localized to the provider/service that owns the side effects.

### 3) Lib internals don’t import `@lib`

Code inside `src/lib/**` should use relative imports (e.g. `./storage`) rather than importing its own public surface (`@lib`).

This prevents accidental dependency cycles and keeps “public API” vs “implementation” clean.

## Public vs internal APIs

### Public API (`@lib`)

The only supported surface for UI/features is:

- `@lib` → `src/lib/public/index.ts`

If something is not exported here, it is not part of the feature contract.

Note: in this repo, some persistence helpers are intentionally public (exported via `@lib`) even though their implementation lives in the internal `storage` module. The contract is: features may call the exported functions, but may not import the underlying modules.

### Internal API (`@lib-internal/*`)

`@lib-internal/*` exposes `src/lib/*` for core wiring/providers only.

It exists as an escape hatch for platform code, but is:

- unstable
- subject to refactor
- not allowed in feature modules

## Settings & accessibility contract (single source of truth)

No module computes “effective” settings locally.

- Effective behavior is derived centrally in `src/lib/effectivePrefs.ts`.
- Accessibility locks override user preferences.

This prevents “settings drift” where the UI displays one state but runtime engines behave differently.

## Content contract (gateway, load-once, validated)

Content is accessed through `src/content/*` (imported via `@content`).

Rules:

- Packs load once per session and are cached.
- Exercise lookup is O(1) by id (Map-based).
- Templates are validated at load time (invalid templates are filtered out before runtime).
- Template rendering must never leak `{slot}` tokens to the UI.

Features must never load JSON packs directly.

## Audio contract

- Audio engines read only effective settings.
- Ambient enablement is computed via `getEffectiveAmbientEnabled`.
- Missing audio assets fail safe (silent fallbacks rather than crashes).

Features do not hardcode audio asset paths and do not manage audio engines directly.

## Fail-safe contract

When something is missing or invalid (content/audio/prefs), the app should:

- degrade gracefully
- avoid crashes
- avoid leaking raw placeholders/tokens

## Refactors policy (safe, “no UX change”)

Boundary-tightening refactors are encouraged if they:

- keep `npm run lint` and `npm run build` green
- do not change runtime behavior
- tighten contracts / reduce coupling
- preserve fail-safe fallbacks

## Checklist for new Phase 3 work

Before merging:

- Feature imports only public surfaces (`@lib`, `@content`, `@app`)
- No duplicated “effective settings” logic (use effective prefs helpers)
- Content access goes through `@content` (cached + validated)
- Missing data fails safe

## How to add a feature (template)

This repo’s feature pattern is:

- feature-owned UI + orchestration in `src/features/<feature>/...`
- stable contracts consumed via `@lib` (public lib API), `@content` (content gateway), and `@app` (app contexts)

### Folder + files

Create:

```
src/features/<feature-name>/
  index.ts
  pages/
    <FeatureName>Page.tsx
  ui/
    <FeatureName>View.tsx         # optional (presentation-only)
  model.ts                        # optional (pure logic only)
```

Then export it:

1) `src/features/<feature-name>/index.ts` exports your page(s)
2) `src/features/index.ts` re-exports the feature’s public exports so the router can import from `@features`

### Rules

- Feature UI imports only from:
  - `@lib` (public-only)
  - `@content` (content gateway)
  - `@app` (contexts like `usePreferences`)
- No imports from `@lib-internal/*`, `src/lib/*`, or relative `../lib/*` paths.
- No local “effective settings” math. Use helpers from `@lib` (e.g. `getEffectiveAmbientEnabled`, `isAmbientLockedOff`).
- No JSON pack loading in feature code (always go through `@content`).

### Minimal skeleton

`src/features/<feature-name>/pages/<FeatureName>Page.tsx`:

```tsx
import { useMemo } from 'react'
import { loadExercisesByMode } from '@content'
import { getEffectiveAmbientEnabled } from '@lib'
import { usePreferences } from '@app'

export function FeatureNamePage() {
  const { prefs } = usePreferences()
  const ambientEnabled = getEffectiveAmbientEnabled(prefs)

  const exercises = useMemo(() => loadExercisesByMode('real_life'), [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Feature Name</h1>
      <p className="text-sm text-zinc-400">Ambient: {ambientEnabled ? 'on' : 'off'}</p>

      <ul className="space-y-2">
        {exercises.slice(0, 10).map((ex) => (
          <li key={ex.id} className="text-sm text-zinc-200">
            {ex.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### Feature acceptance checklist

- Imports only from `@lib` / `@content` / `@app` (+ local feature files)
- Uses effective prefs helpers; no duplicated settings logic
- Uses the content gateway; no direct JSON reads
- No internal imports (`@lib-internal/*` or `src/lib/*`)
- Missing content/audio fails gracefully (no crash)

## Phase 3 personalization module contract

Personalization should be a **service** in core lib code, not something computed in UI.

### Module locations

- UI/controls (if any): `src/features/personalization/` (UI + orchestration only)
- Core service (internal): `src/lib/personalization/*` (imported via `@lib-internal/personalization/*`)
- Public API exposure: export a small stable surface from `src/lib/public/index.ts` (consumed via `@lib`)

### Core idea

Personalization is responsible for:

- reading local history + skill signals
- selecting exercises via the content gateway (`@content`)
- respecting novelty rules (avoid repeats)
- respecting accessibility locks via effective prefs helpers

Feature/UI must not compute recommendations itself.

### Suggested public API (exported from `@lib`)

```ts
export type RecommendationContext = {
  mode: 'focus' | 'real_life' | 'competitive'
  goal?: 'calm' | 'balanced' | 'challenge'
  sessionMinutes?: number
  seed?: string // optional: for determinism (e.g. daily sets)
}

export type Recommendation = {
  exerciseId: string
  reasonTags: string[]
  reasonText: string
}

export function getNextRecommendations(
  ctx: RecommendationContext,
  prefs: { screenReaderMode: boolean; reducedMotion: boolean }
): Recommendation[]
```

Notes:

- The service should use `@content` for exercise access (load-once cache, O(1) lookup).
- The service should be deterministic when `seed` is provided.
- The service must degrade gracefully: empty history → sensible defaults.

### Hard constraints

- Must not load JSON directly; must use the content gateway APIs.
- Must not bypass effective prefs / accessibility locks.
- Must be local-only (offline-safe).

### Acceptance tests (guidance)

- Empty history → returns a sane mix for each mode
- Repeated sessions → avoids repeats within N
- Accuracy drop → suggests calmer/lower difficulty next
- Screen reader mode → prefers shorter/chunkable content

## Pre-merge checklist (tied to these contracts)

### A) Architecture + boundaries

- No feature imports from `@lib-internal/*`
- No feature imports from `src/lib/*` via relative or absolute paths
- No feature deep-imports `@lib/*` (import from `@lib` only)
- No duplicated “effective settings” logic in UI

### B) Accessibility non-regression

- Screen reader preset can complete a run end-to-end
- Reduced motion preset avoids animation-dependent UI affordances
- Text scaling (150–200%) doesn’t break essential controls

Note: if/when a high-contrast preset is added, ensure correctness is readable without color alone.

### C) Content safety

- No direct JSON reads from features/UI
- Template rendering cannot leak `{slot}` tokens
- Content loads once per session; exercise lookup remains O(1)

### D) Audio safety

- Ambient enablement uses `getEffectiveAmbientEnabled`
- Missing audio files fail silently (no crash)

### E) Persistence safety

- Saved settings are sanitized and validated
- No new storage keys without documenting schema/migration notes
- “Reset to safe defaults” still works

### F) Quality gates

- `npm run lint` passes
- `npm run build` passes
