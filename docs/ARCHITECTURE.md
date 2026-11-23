# Architecture (v0.4)

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
