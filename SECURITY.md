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

LoKey Typer is a **fully offline** typing practice web app (PWA + Microsoft Store).

- **Data touched:** Browser localStorage (preferences, run history, personal bests)
- **Data NOT touched:** No cloud sync. No telemetry. No analytics. No accounts. No tracking
- **Network:** Only for initial page load and service worker cache. Zero runtime network calls
- **No secrets handling** — does not read, store, or transmit credentials
- **No telemetry** is collected or sent
