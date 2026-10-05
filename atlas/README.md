# lokey-typer: how it works

Mapped at 2026-10-05 from commit 6b47e2c.

## What this is

LoKey Typer is a calm typing practice app: a browser client, a Windows shell for the Store package, and ambient audio that stays on the device. (written by a person)

12 parts, mostly TypeScript (88 files). Work enters through 3 doors; the busiest is CI, which reaches 6 parts. It publishes a container image.

## What changed since 2026-10-05 (aae2f56)

- Docker (.github/workflows/docker.yml) is a new door. It starts when a release is published; or by hand. It runs no file this map can see.
- package.json is now read by .github/workflows/docker.yml.
- docker/nginx.conf is new and belongs to no part, so atlas check fails on it against the previous map.
- 14 files added and 60 changed content, across 10 parts.

## What comes in

1. **CI.** On a pull request touching 18 paths; on a push touching 18 paths; or by hand. Runs scripts/qaAmbientAssets.mjs, scripts/qaSoundDesignManifesto.mjs, scripts/validatePhase2Content.mjs and 3 more; checks desktop/LoKeyTyper.Tests/LoKeyTyper.Tests.csproj, desktop/LoKeyTyper.sln, scripts/audio/check_bed_policy.py and 5 more.
2. **Deploy to GitHub Pages.** On a push to main touching 11 paths; or by hand. Runs scripts/qaAmbientAssets.mjs, scripts/qaSoundDesignManifesto.mjs, scripts/validatePhase2Content.mjs and 3 more; checks scripts/audio/check_bed_policy.py, scripts/audio/check_loudness.py, scripts/audio/check_spectrum.py and 3 more.
3. **Docker.** When a release is published; or by hand. Runs no file this map can see.

## What happens through CI

1. The workflow runs scripts/qaAmbientAssets.mjs, scripts/qaSoundDesignManifesto.mjs and scripts/validatePhase2Content.mjs in scripts, site/astro.config.mjs and site/src/ in the site, and tests/ in tests; it checks desktop/LoKeyTyper.Tests/LoKeyTyper.Tests.csproj and desktop/LoKeyTyper.sln in desktop, vite.config.ts in the repository root, 4 files in scripts, and src/ in src.

## Who reads the results

CI writes nothing this map can see.

## The other doors

**Deploy to GitHub Pages** runs scripts/qaAmbientAssets.mjs, scripts/qaSoundDesignManifesto.mjs, scripts/validatePhase2Content.mjs and 3 more, checks scripts/audio/check_bed_policy.py, scripts/audio/check_loudness.py, scripts/audio/check_spectrum.py and 3 more, and deploys the site.

**Docker** runs no file this map can see and publishes a container image.

## What breaks what

- **src** is imported only from tests, by 1 part (tests), and sits on the path of 2 doors.
- **the repository root** is imported by no other part and sits on the path of 2 doors.
- **scripts** is imported by no other part and sits on the path of 2 doors.
- **the site** is imported by no other part and sits on the path of 2 doors.
- **tests** is imported by no other part and sits on the path of 2 doors.
- **src/assets/icons/** is written by scripts and read by scripts; a hand edit reaches every reader.

## What tends to change together

- **src/features/home/pages/HomePage.tsx** and **src/features/modes/pages/ModePage.tsx** changed together in 5 of 6 commits, inside the src part.
- **tests/pages.test.tsx** and **tests/typingSession.test.tsx** changed together in 8 of 13 commits, inside the tests part.
- **src/features/daily/pages/DailySetPage.tsx** and **src/features/run/pages/RunPage.tsx** changed together in 9 of 16 commits, inside the src part.
- **src/app/components/AudioSettingsPanel.tsx** and **src/app/shell/AppShell.tsx** changed together in 6 of 11 commits, inside the src part.
- **src/features/daily/pages/DailySetPage.tsx** and **src/features/typing/TypingSession.tsx** changed together in 9 of 18 commits, inside the src part.

Confidence is low: fewer than 25 source files reach 10 revisions in the window.

Window: 180 days; a pair counts from 3 shared commits, since 5 source files reach 10 revisions; the floor rises to 10 when 25 do.

## What no test touches

- **desktop** is imported by no test.
- **scripts** is imported by no test.

## Written but never read

- **src/app/components/Icon.tsx** is written by scripts/icons/generate_react_icons.py and read by nothing else in this repository.

## Helpers that look duplicated

No two parts export a helper that looks alike.

## Generated, never hand-edited

- **src/app/components/Icon.tsx** is written by scripts/icons/generate_react_icons.py.
- **src/assets/icons/** is written by scripts/icons/generate_icons.py.

## Hand-authored

People write .github/, assets/, docs/, msix-package/, public/, the repository root, site/ and store-assets/; 3 writes with paths built at run time may land here.

## Where to start

.github/workflows/ci.yml → scripts/qaAmbientAssets.mjs

Read those in order to follow one pull request end to end.

## What this map cannot see

- 42 import sites could not be resolved.
- 3 writes and 20 reads use paths built at run time and are not named here.
- 1 write goes to places this repository does not track, so it is not listed as generated.
- 2 writes and 9 reads go to the directory the command is run in or the home directory, not to this repository.
- Statistics confidence is low: fewer than 25 source files reach 10 revisions in the window.

Regenerate with `npx --yes @dogfood-lab/atlas map`.
