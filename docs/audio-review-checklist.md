# Audio Review Checklist (Required)

This checklist applies to **every new ambient stem** added under `public/audio/ambient/**`.

Passing this checklist is required in addition to automated checks.

## Manual audio review checklist

A reviewer must confirm:

- No identifiable BPM, pulse, or groove
- No repeating transient patterns
- No obvious loop seam
- No melodic foreground / “hook”
- Comfortable at 30+ minutes at the intended in-app volume

## Required gates for new stems

Any new stem must pass:

1) Loudness gate (LUFS)
2) Spectral balance gate (centroid + energy ratios)
3) This manual checklist

See also:

- `docs/sound-design-manifesto.md` (formal policy + numeric acceptance tests)
- `docs/sound-design.md` (audit framework and rationale)
