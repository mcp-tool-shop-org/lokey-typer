# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

Email: **64996768+mcp-tool-shop@users.noreply.github.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Version affected
- Potential impact

### Response timeline

| Action | Target |
|--------|--------|
| Acknowledge report | 48 hours |
| Assess severity | 7 days |
| Release fix | 30 days |

## Scope

LoKey Typer is a typing practice web app (PWA + Microsoft Store) with no accounts and no telemetry.

- **Data touched:** Browser localStorage (preferences, run history, personal bests) and the IndexedDB database `lokey-study` (text you add on the Study page)
- **Data NOT touched:** No cloud sync. No telemetry. No analytics. No accounts. No tracking
- **Network:** The app loads its own pages and audio from the same origin. It does not call an account service, a telemetry endpoint, or any third-party API.
- **No secrets handling** — does not read, store, or transmit credentials
- **No telemetry** is collected or sent
