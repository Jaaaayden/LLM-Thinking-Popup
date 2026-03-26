# BrainTease Chrome Extension

A Chrome extension that detects when ChatGPT or Google Gemini is generating a response and displays an interactive chess puzzle or YouTube video overlay to keep the user engaged while waiting.

## Tech Stack

- **Vanilla JavaScript** — no framework, no build tools, no npm
- **Chrome Extension Manifest V3** — service worker, content scripts, popup
- **Chess.js** + **Chessboard.js** + **jQuery** — bundled in `lib/` (minified)
- **Lichess API** — puzzle data source
- **YouTube iFrame API** — video mode

## Project Structure

| Path | Purpose |
|------|---------|
| `manifest.json` | Extension entry point — permissions, host patterns, script registration |
| `src/background/background.js` | Service worker; proxies Lichess API fetch requests |
| `src/content/detector.js` | `StateDetector` class — MutationObserver + polling to detect LLM thinking state |
| `src/content/renderer.js` | `OverlayManager` class — full overlay UI, chess game loop, video embed, stats |
| `popup/` | Settings UI (chess vs. video toggle, stats display) |
| `lib/` | Vendored third-party libraries |
| `assets/` | Icons and chess move sound effects (MP3) |

## Adding New Features or Fixing Bugs

**IMPORTANT**: When you work on a new feature or bug, create a git branch first. Then work on changes in that branch for the remainder of the session.

## Build & Test

No build step — the extension runs source files directly.

**Load in Chrome:**
1. Navigate to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select this directory

**Reload after changes:** Click the refresh icon on the extension card, then reload the target page.

There is no automated test suite.

## Additional Documentation

Check these files when working on the relevant area:

| File | When to read |
|------|-------------|
| [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) | Before modifying any cross-component logic, storage, messaging, or the overlay lifecycle |
