# Architectural Patterns

## 1. Two-Class Content Script Split

All content-script logic is split between exactly two classes injected on every target page:

- **`StateDetector`** ([src/content/detector.js](../../src/content/detector.js)) — owns only detection and timing. It never touches the DOM beyond reading it.
- **`OverlayManager`** ([src/content/renderer.js](../../src/content/renderer.js)) — owns all DOM creation, chess game state, and video embedding. It never does detection.

`StateDetector` holds a reference to `OverlayManager` and calls `overlay.show()` / `overlay.hide()` as its only output. Keep this boundary clean — detection logic belongs in `detector.js`, rendering logic belongs in `renderer.js`.

### 1a. Overlay sub-split: modes vs. services

`OverlayManager` is a thin coordinator. The work is delegated to six classes under [src/content/overlay/](../../src/content/overlay/), grouped into two roles:

- **Mode classes** (frontend only) — `ChessMode`, `VideoMode`. They render DOM, handle events, and hold per-session UI state. They never call `chrome.runtime.sendMessage`, `chrome.storage`, or `fetch`.
- **Service classes** (backend boundary) — `PuzzleService` (Lichess API + daily-puzzle storage + PGN→FEN), `StatsService` (session totals + streak storage). They never touch the DOM.
- **Utilities** — `OverlayStyles` (CSS inject/remove), `SoundPlayer` (audio loading and playback).

`OverlayManager` instantiates the services once in its constructor and passes them by constructor injection into the active mode (`new ChessMode(host, sounds, puzzles, stats)`). To trace how data enters the UI, follow the constructor args — mode classes name their dependencies explicitly rather than reaching for globals. Each class is also attached to `window` for debuggability.

Script load order in [manifest.json](../../manifest.json) matters: utilities and services must load before the modes, and `renderer.js` must load last because its bottom-of-file `new OverlayManager()` references all of them.

## 2. Background Script as Fetch Proxy

Content scripts cannot call the Lichess API directly due to CORS. The pattern used throughout:

1. `renderer.js` sends a message via `chrome.runtime.sendMessage({ action: 'FETCH_DAILY_PUZZLE' | 'FETCH_TRAINING_PUZZLE' })`
2. `background.js` ([src/background/background.js](../../src/background/background.js)) performs the `fetch()` and returns `{ success, data }` or `{ success: false, error }`
3. `renderer.js` handles the response in the `sendMessage` callback

All external API calls must go through this proxy pattern — add new message action strings in both files when introducing new endpoints.

## 3. Dual Detection: MutationObserver + Polling

`StateDetector` uses both techniques in parallel for reliability across ChatGPT and Gemini's differing DOM structures:

- **MutationObserver** — reacts immediately to DOM changes (stop-button appearance/disappearance)
- **`setInterval` at 500 ms** — catches cases where mutations are missed or batched

Both paths call the same `checkThinkingState()` method, which is idempotent. A 2-second debounce (`lastOverlayTime`) prevents the overlay from firing repeatedly on rapid DOM churn.

## 4. Chrome Storage Split: `sync` vs `local`

User **preferences** are stored in `chrome.storage.sync` (roam across devices):
- `chessEnabled`, `videoEnabled` — read by both `popup.js` and `renderer.js`

Session **statistics and puzzle tracking** are stored in `chrome.storage.local` (device-only):
- `streak`, `lastActiveDate`, `totalPuzzlesSolved`, `totalTimeSpent`, `avgTimePerPuzzle`, `mostPuzzlesInSession`
- `solvedPuzzleId`, `solvedPuzzleDate` — prevent re-showing the daily puzzle
- `lastVideoDate` — video streak tracking

Always use `chrome.storage.sync` for settings the popup exposes; use `chrome.storage.local` for everything else.

## 5. Puzzle Queue with Prefetching

`OverlayManager` maintains a `puzzleQueue` array. When the queue length drops to 1, it triggers a background fetch for the next puzzle proactively. This prevents the user ever waiting on a network round-trip mid-session. The daily puzzle is injected at the front of the queue if it hasn't been solved today (keyed by `solvedPuzzleDate` matching today's date string).

## 6. Mutually Exclusive Modes

Chess and video modes cannot both be active. This constraint is enforced in `popup.js` ([popup/popup.js](../../popup/popup.js)): checking one checkbox immediately unchecks and disables the other, then saves both values to `chrome.storage.sync`. `renderer.js` reads these flags at overlay-show time to decide which mode to render.

## 7. Dynamic CSS Injection

The overlay's styles are injected as a `<style>` tag into the host page's `<head>` at `OverlayManager` initialization time. This avoids conflicts with the host page's stylesheet cascade and ensures styles are self-contained. The overlay uses `z-index: 2147483647` (JavaScript's max safe integer for 32-bit) to guarantee it renders above all host-page elements.

## 8. Chess Game State Machine

Puzzle playback in `renderer.js` follows a fixed sequence:

1. **Load** — parse Lichess PGN into FEN, set board position, determine player color
2. **Player move** — validated against the solution move list; wrong moves are reversed
3. **Opponent reply** — played automatically after a short delay
4. **Loop** — repeat until all solution moves are exhausted
5. **Complete** — update stats, advance queue, load next puzzle

Sound effects are keyed to move type (capture, castle, promotion, check) and player vs. opponent, all preloaded as `Audio` objects at init time.