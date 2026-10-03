# Scorecard

> Score a repo before remediation. Fill this out first, then use SHIP_GATE.md to fix.

**Repo:** lokey-typer
**Date:** 2026-02-27
**Type tags:** [npm] [desktop]

## Pre-Remediation Assessment

| Category | Score | Notes |
|----------|-------|-------|
| A. Security | 6/10 | Privacy section in README but no formal SECURITY.md |
| B. Error Handling | 8/10 | Web PWA with graceful browser-based error handling |
| C. Operator Docs | 8/10 | Good README, minimal CHANGELOG, no SHIP_GATE |
| D. Shipping Hygiene | 7/10 | CI, Microsoft Store listing — no SHIP_GATE or SCORECARD |
| E. Identity (soft) | 10/10 | Logo, translations, web app live, Microsoft Store |
| **Overall** | **39/50** | |

## Key Gaps

1. No SECURITY.md with formal scope documentation
2. No SHIP_GATE.md or SCORECARD.md
3. README missing Security & Data Scope section and scorecard table

## Remediation Priority

| Priority | Item | Estimated effort |
|----------|------|-----------------|
| 1 | Add SECURITY.md with data scope | 5 min |
| 2 | Fill SHIP_GATE.md and SCORECARD.md | 10 min |
| 3 | Update README with Security section + scorecard | 5 min |

## Post-Remediation

| Category | Before | After |
|----------|--------|-------|
| A. Security | 6/10 | 10/10 |
| B. Error Handling | 8/10 | 10/10 |
| C. Operator Docs | 8/10 | 10/10 |
| D. Shipping Hygiene | 7/10 | 10/10 |
| E. Identity (soft) | 10/10 | 10/10 |
| **Overall** | 39/50 | 50/50 |
