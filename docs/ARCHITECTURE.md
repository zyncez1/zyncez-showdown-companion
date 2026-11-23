# Architecture (v0.9)

## Interaction flow

- The **browser-toolbar popup** (`popup.html`, `src/popup.js`, `src/popup.css`) provides a directly accessible OpenRouter API key field, model picker, AI/local switch, and remove-key button. It does not initiate AI requests.
- The Showdown **floating ⚡ messenger** (`src/content.js`) is the only interface that can submit AI requests. Its ⚙ panel provides the same settings.
- The messenger reads visible battle state on demand via `src/reader.js`. It refreshes extension settings when opened and immediately before sending, so settings changed through the toolbar appear without reloading the battle page.
- The MV3 background service worker (`src/background.js`) validates the sender origin and message action. Popup requests can only read/save/remove settings. Showdown content-script requests may additionally ask questions.
- API keys are stored via `chrome.storage.local` after restricting its access to trusted extension contexts; they are never returned to the content script or put in the repository. Direct requests to `https://openrouter.ai/api/v1/chat/completions` occur **only after the user presses Send**.
- `src/ai-core.js` sanitizes the on-demand snapshot (Pokémon names, visible HP, turn, move/switch buttons), plus bounded chat context and user question. Chat logs, usernames, URLs, and hidden Pokémon information are not forwarded.
- Offline type-matchup commands live in `src/coach.js` and `src/types.js`.

## Limits and privacy

- A direct-from-extension API key is recoverable by someone with access to the user's browser profile. Use a personal low-limit OpenRouter key and never commit it. A future hosted account-based setup would provide stronger protection.
- Battle parsing is best-effort and requires live Showdown regression tests. No automatic move submission or background analysis.
- Live coaching may be disallowed in competitive events; follow event rules.


## v0.6 battle state

On demand: `content.js` calls `reader.js` which scans `.statbar.rstatbar` (player), `.statbar.lstatbar` (opponent), `.rightbar .teamicons` (publicly visible opponent roster) and selected battle narrative events. Pure parsing and in-battle reveal retention live in `battle-state.js`. `ai-core.js` restricts the OpenRouter snapshot to these curated fields. Full log text, URLs, player account names and chat are excluded. The companion acts only after Send or local Refresh. Do not introduce automated requests or uncontrolled game actions.


## v0.7 on-demand client state

On explicit **Send** or **Refresh**, `src/content.js` calls `ZyncezReader.read()` and requests `ZYNCEZ_READ_GAME` from the trusted extension service worker. The worker uses MV3 `chrome.scripting.executeScript` in the Showdown page MAIN world with the self-contained function in `src/game-capture.js`. This one-off read extracts `room.request.side.pokemon` (own full party and moves), `room.request.active` (active move PP/disabled flags), and filtered public actions from `room.battle.stepQueue`. `src/battle-state.js` merges them with the DOM, separates player versus opponent actions, and constructs a sanitized event history. `src/ai-core.js` explicitly whitelists only game fields into the model payload, excluding original protocol lines, player chat and account information. If no accessible game room is available, the UI degrades to DOM-only information and should clearly report missing bench data.

## v0.9 formatting and personality

- `src/message-format.js`: dependency-free DOM Markdown renderer for assistant messages, never uses model-provided HTML. Supports bold, italics, headings, lists, safe HTTPS links, code, and highlight notation (`==text==`). In-game `src/content.js` renders only assistant bubbles as formatted content. User input remains plain text.
- `src/content.js`, `popup.html`, and `src/popup.js` expose personality presets, a free-text custom style field (1,600 characters), and response depth. Both settings interfaces save via `ZYNCEZ_SAVE_SETTINGS` and do not trigger AI analysis.
- `src/background.js` stores preferences (`zyncezPersonality`, `zyncezPersonalityNotes`, `zyncezReplyStyle`) in restricted `chrome.storage.local`. The background also retrieves these choices and passes them only to `src/ai-core.js` when `ZYNCEZ_ASK` is explicitly requested.
- `src/ai-core.js` changes its system prompt to naturally conversational replies, applies preset/custom persona guidance while preserving battle-data caveats, expands maximum visible output budget to 8,192 tokens, and removes the former hard 9,000-character output truncation.
- All rendering uses DOM creation and `textContent`, not assigning the LLM reply to `innerHTML`. The renderer does not execute HTML in responses, nor open unsafe URI schemes.
