# LoKey-Typer

## What This Does

A keyboard typing automation and key binding tool for Windows.
Provides keyboard simulation, macro recording, and hotkey support.

## Architecture

- Windows-native keyboard input simulation
- Macro recording and playback
- Hotkey registration and event handling
- Configuration via JSON hotkey maps

## Building & Deployment

- GitHub Pages deployment via npm build
- Static site generation from source
- Automated CI/CD on push to main

## Dependencies

- Node.js >= 18
- npm
- Python 3.10+ (if running backend services)

## Key Notes

- Primarily a frontend/CLI tool
- Windows-only (uses Windows APIs)
- Deployed to GitHub Pages at https://mcp-tool-shop-org.github.io/lokey-typer/
- Configuration in .claude/config.json
