# Architecture (v0.13)

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


## v0.12 layered tactical decision support (silent)

- At explicit tactical **Send**, `content.js` calls `ZyncezDecision.analyze(state, question)` after the one-shot Showdown read, before the existing `ZYNCEZ_ASK` call. Greetings and unrelated messages bypass the evaluator. The engine is deterministic and local; no additional API calls, background polling, or automated move commands.
- `game-capture.js` reads **only public opposing details and the player's own battle request**. It adds safe move metadata (type, category, basePower, accuracy, priority, targeting), current choice type, trapped flags and type information. It does not access hidden opposing sets.
- `battle-state.js` merges and normalizes these facts with the DOM-based reader, preserving existing opponent move history and speed analysis. `ai-core.js` allowlists the extra metadata and only a **compact verdict** (`decisionSupport`), excluding numerical weights and all temporary candidate score internals.
- `decision-engine.js`: candidate generator → type/priority/speed comparison → opponent-response scenarios → bounded doubles combinations → partner-friendly-fire and defensive-risk checks → conservative action ranking → evidence audit with a plain-language recommendation + contrasting alternative. Scores are internal heuristics, never true probabilities.
- The LLM prompt in `ai-core.js` treats this verdict as fallible advice. The AI should give a **normal conversational answer**, not reveal the rankings, internal criteria/weights, or a verbose analysis checklist. It may briefly explain the observable reason for a move when asked "why".
- Constraints: statuses, targets, unusual abilities/items, format-specific mechanics, redirection and full damage rolls are **not** fully simulated. Without visible move/type data, output low confidence or insufficient evidence. For live competitive tournaments, check third-party assistance rules.


## v0.13 Smogon calculator integration

- `vendor/smogon-calc/data.min.js` and `calc.min.js` are the **prebuilt browser distributions** of the uploaded `@smogon/calc` 0.12.0. They are packaged locally, with no CDN or installation step at runtime. Their license is MIT, per the npm package metadata; see `vendor/smogon-calc/NOTICE.md`.
- A single, isolated content-script calculator context exposes `ZyncezDamage`. It runs **only when a user sends a tactical question**. Base Pokémon/move data is loaded with the extension, but no network calls or speculative background analysis run automatically.
- The on-demand game reader brings forward your disclosed stats, your Pokémon's boost stages, and known screens. For unknown opposing spreads, the adapter calculates broad IV/EV/nature scenarios rather than pretending to access hidden data. Support moves and unknown generations cannot be scored as direct damage.
- The ranked-action evaluator uses the calculator's output to compare confirmed moves and takes spread damage into account. It keeps alternative moves, counterplay scenarios, ally-friendly-fire checking and Speed reasoning. Each evaluation has a 48-calculation ceiling and caches repeated matchup checks.
- The AI sees only the selected play, limited per-target damage ranges, uncertainty indicators, brief reasons and cautions, **not** internal scoring or the full data tables.
- **Limitations:** damaging behavior can change based on unobserved abilities, items, field modifiers, status quirks, unusual move mechanics or format rules. `all-modeled` only means all considered scenarios under these assumptions, NOT a guaranteed KO against an unknown opponent. There is no true opponent-prediction probability or globally optimal-play guarantee.

## v0.14 decision and justification pipeline

On the player's Send only: `src/content.js` gathers Showdown state, runs `ZyncezDecision.analyze`, then forwards a single sanitized snapshot to `src/background.js` for one OpenRouter completion.

- `src/damage-engine.js` wraps bundled `@smogon/calc` (conditional modeled damage, local cache and budgets).
- `src/speed.js` estimates Speed and conditional turn order.
- `src/decision-engine.js` constructs candidate actions, evaluates opponent counterplays and newly revealed incoming attacks, and compares legal Singles/Doubles options.
- `src/justification-engine.js` rechecks legality and produces a compact, grounded decision certificate: objective, evidence, comparison to the alternative, known counterplays, uncertainty and counterfactual conditions. It explicitly **does not** expose private model reasoning or numeric heuristic scores.
- `src/ai-core.js` passes the summary **inside the same model call** and asks for a natural, concise recommendation using the chosen personality and reply length. GPT may disagree when it sees contradictory confirmed mechanics.

This is not tree-search optimization against every possible hidden set. Opponent counters are plausible scenarios; estimates can be inaccurate due to hidden abilities/items or missing mechanics. No background polling, auto-play or extra API calls.


## v0.15 conversation UI

- `src/chat-ui.js`: scoped Shadow DOM stylesheet with spring-like open/close transitions, themes and OS reduced-motion support.
- `src/content.js`: draggable bubble + attached panel, read-only context menu, accessible settings panel, near-input model picker, preserved on-demand battle/action workflow.
- `src/model-catalog.js`: a bundled, static preset list used by in-game chat and extension popup. There is **no model-catalog network fetch in either UI**. The older explicit `ZYNCEZ_LIST_MODELS` background message remains for compatibility only.
- `src/background.js`: whitelist/validate and persist appearance, size and normalized bubble coordinates. `chrome.storage.local` remains limited to trusted extension contexts.

Customization and model switches are local browser-extension messages only. They must never trigger `ZYNCEZ_ASK` or any chargeable API request. Current gameplay data is read only when the user explicitly sends a question or presses refresh.
