# Settings — Rebuild Guide

## Why settings were removed

The original settings page was a full-page route (`/settings`, `/focus/settings`, etc.)
with a bunch of controls that duplicated things already accessible elsewhere or that
nobody ever needed to change. It lived behind a wrench icon in the nav bar that looked
like a sun (light/dark toggle) and broke the minimal zen aesthetic. Every mode page also
had its own Settings link. The result: lots of UI surface with very little user value.

**Lesson:** Don't ship a "settings page" just because apps have one. Only surface a
control when a user has a real reason to reach for it.

---

## What was there (and what actually matters)

| Preference | Type | Used? | Verdict |
|---|---|---|---|
| `soundEnabled` | `boolean` | Yes | Keep — but expose inline, not on a page |
| `volume` | `number` | Barely | Defer — browser/OS volume is fine |
| `bellOnCompletion` | `boolean` | Yes | Keep — inline toggle |
| `ambientEnabled` | `boolean` | Yes | **Already in nav bar** (mute button) |
| `ambientCategory` | `AmbientCategory \| 'all'` | Yes | Worth exposing — small popover or menu |
| `ambientVolume` | `number` | Yes | Defer — independent ambient volume is nice but not essential |
| `ambientPauseOnTyping` | `boolean` | Barely | Defer |
| `fontScale` | `0.9 \| 1 \| 1.1` | No | Defer — browser zoom exists |
| `screenReaderMode` | `boolean` | Phase 3 | Keep when accessibility lands |
| `reducedMotion` | `boolean` | Phase 3 | Keep when accessibility lands |
| `showLiveWpm` | `per-mode bool` | Yes | Worth exposing — per-mode toggle |
| `focusMinimalHud` | `boolean` | Yes | Worth exposing — Focus-only |
| `competitiveSprintDurationMs` | `SprintDurationMs` | Yes | **Already inline** on Competitive page |
| `competitiveGhostEnabled` | `boolean` | Yes | **Already inline** on Competitive page |

### Already handled without a settings page
- **Ambient on/off** — mute button in the nav bar
- **Ambient skip** — shuffle button in the nav bar
- **Sprint duration + ghost** — inline on Competitive idle screen
- **Reset to defaults** — `Ctrl+Alt+R` keyboard shortcut (keep this, wire it globally)

---

## How to add settings back properly

### Principle: Inline > Popover > Drawer > Page

1. **Inline** — put the control right where it matters (sprint duration on Competitive)
2. **Popover** — small floating panel for a cluster of 2-4 related toggles
3. **Drawer** — slide-in panel for fuller config (ambient category + volume + pause)
4. **Full page** — only if there are 10+ settings with sections (we're not there)

### Recommended approach

#### 1. Ambient popover (nav bar)
Attach a small popover/dropdown to the mute button (or add a chevron next to it):

```
┌──────────────────────────┐
│  Ambient                 │
│  ☑ Enabled               │
│  Category: [Focus ▾]     │
│  Volume:   ────●──       │
│  ☐ Pause when typing     │
└──────────────────────────┘
```

- Triggered by clicking the mute icon (toggle) or a small `▾` arrow
- Closes on outside click or Escape
- No route, no navigation, no page — just a floating panel

#### 2. Typing HUD popover (per-mode)
A small gear or `···` button near the typing area (visible only during a session):

```
┌──────────────────────────┐
│  Display                 │
│  ☑ Show live WPM         │
│  ☐ Minimal HUD           │
│  Font: [Default ▾]       │
└──────────────────────────┐
```

- Context-aware: only shows settings relevant to the current mode
- Appears near the typing area, not in the nav bar

#### 3. Sound toggle
- Add a small speaker icon next to the mute button (or combine them)
- Keystroke sounds + completion bell are distinct from ambient

#### 4. Global reset
- Keep `Ctrl+Alt+R` wired globally (in `PreferencesProvider` or `AppShell`)
- No UI needed — power-user shortcut

### Implementation notes

- **No new routes.** Settings should never be a page again.
- **Use `usePreferences()` directly.** The `patchPrefs` helper already handles
  partial updates — just wire it to the popover controls.
- **Popover component:** Use Radix `@radix-ui/react-popover` or build a minimal
  one with a portal + outside-click hook. Keep it unstyled + Tailwind.
- **Animate with CSS only.** `transition-opacity` + `scale-95 → scale-100` on
  open. No framer-motion dependency.
- **Mobile:** Popovers should become bottom sheets on small screens (`sm:` breakpoint).

---

## Files reference

| File | Purpose |
|---|---|
| `src/lib/storage.ts` | `Preferences` type + `DEFAULT_PREFS` + localStorage persistence |
| `src/app/providers/PreferencesProvider.tsx` | React context — `usePreferences()` with `prefs`, `setPrefs`, `patchPrefs` |
| `src/features/settings/` | **Dead code** — old settings pages, safe to delete entirely |
| `src/app/shell/AppShell.tsx` | Nav bar — mute + shuffle buttons already live here |
| `src/features/modes/pages/ModePage.tsx` | Competitive config already inline here |

---

## Cleanup

The `src/features/settings/` directory is dead code (no imports reference it).
Delete it when ready:

```bash
rm -rf src/features/settings
```

No other files need to change — the barrel export in `src/features/index.ts` was
already updated to exclude it.
