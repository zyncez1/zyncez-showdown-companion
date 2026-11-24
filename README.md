# Zyncez AI Battle Companion (v0.17)

A Chrome / Opera Manifest V3 extension that adds a **toggleable, on-demand messenger** to Pokémon Showdown. Connect **OpenRouter from the browser toolbar popup (or in-page ⚙ Settings)**; no local server, Node.js, command window, pairing code, or separate OpenAI API account needed. The assistant replies **only when you click Send**. It never clicks moves or plays automatically.

## Setup (Chrome / Opera)

1. Extract the ZIP to a permanent directory. Open the inner `zyncez-showdown-companion` folder containing `manifest.json`, `popup.html`, and `src/`.
2. Open `chrome://extensions` (or `opera://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the extracted `zyncez-showdown-companion` directory containing `manifest.json`.
3. If upgrading v0.3, **replace the old unpacked extension files in the same folder** and click **Reload** on the extensions page. This preserves your extension ID and already saved settings. If you load a new folder instead, Chrome/Opera may treat it as a separate installation; then enter the key again.
4. Click the **Extensions (puzzle piece)** icon in your browser toolbar, pin **Zyncez AI Companion**, and click its icon. **The OpenRouter API key field appears right in this popup.**
5. Keep **OpenRouter AI** as the mode, choose a **ready-to-use model** from the offline preset dropdown (or enter a custom model ID), and paste your **OpenRouter API key** from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
6. Click **Save settings & personality**. Open or refresh [Pokémon Showdown](https://play.pokemonshowdown.com/), click the floating **⚡** bubble, ask a question, and press **Send**. The model's response appears in the same messenger window.
7. You can manage all settings by **right-clicking the floating bubble or an empty part of the chat** and choosing **Settings & appearance**. The **⋯** menu button is an accessible alternative. The messenger rechecks saved settings when opened or when you send a question.

You only need to paste the key once per browser profile/extension installation. The **model selector now lives beside the typing box**, not above the conversation. **Changing models doesn't fetch a catalog or start an AI request**: presets are included in the extension. You can use a custom or recent model ID via Settings. A listed model may no longer be available or may change price on OpenRouter; the list is offline, not a live pricing guarantee.

## v0.17 — Pokémon-style battle recommendations

Direct tactical requests may now return compact visual action cards with Showdown-hosted static Gen V sprites (40 px, or 28 px in Compact), move type accents, targeting, and switch/ally-safety labels. The model emits a narrowly scoped action marker for its actual final choice; the renderer checks current actors, available moves, targets and switches before styling it. Plain text remains available under right-click Settings → Battle recommendation style. If a model does not emit the marker, the original Markdown reply remains. Missing sprite assets fall back to a neutral icon; no custom image URLs or HTML from the AI are rendered. Sprite artwork is provided by Pokémon Showdown and its contributors; Pokémon assets belong to their respective owners. No additional AI call is made.

## v0.16 — Invisible battle context

Removed the expandable opponent/party summary from the messenger. The same on-demand battle reader, Speed and damage calculations, and tactical justification are still used in the AI request when you send a relevant question. The refresh button remains an optional local chat status command. No automatic AI calls are introduced.

## v0.15 — Minimal draggable chat and contextual customization

- **Click the floating bubble** to open or close your messenger. The panel eases in/out with an iOS-like transform and opacity transition; a reduced-motion setting disables the animation.
- **Drag the bubble** to move it around the page, with the chat staying attached. Click and drag are distinguished by a movement threshold so a drag does not accidentally open/close the chat. The chat header is an optional drag handle. The bubble location is saved as a bounded viewport-relative position and restored after reload, including window resizing.
- **Right-click the bubble/chat**, or use the small **⋯** header menu, to open a contextual menu: Settings & appearance, Clear chat, Reset position. Native right-click still works inside text fields and links.
- **Instant model picker in the composer**: a compact model label is displayed beside the input and reply-length selector. Clicking it shows bundled models such as GPT-5 Mini, Claude Sonnet, Claude Opus, Gemini Flash and Llama. No network request is made to load them. Previously selected custom IDs are retained.
- **Appearance settings:** Midnight, Light and Frosted Glass themes; five accent colors; compact/normal/wide width; short/regular/tall height; text size; bubble size and opacity. Selections persist in extension storage, alongside existing personality, reply length and API key settings.
- **Quiet chat view:** no intrusive model list, giant battle-state banner, or permanent control strip. The former expandable battle details strip is removed as of v0.16. AI requests occur only when you press **Send** or Enter, while Shift+Enter inserts a newline. The ⟳ button reads battle details locally, not through OpenRouter.
- **Security:** appearance values are validated against a whitelist; no CSS or code from user input is injected. The OpenRouter API key is stored in trusted extension storage and never displayed in the chat bubble or committed to the repository.

**Upgrade without losing your key:** extract this package and replace files inside the **same existing unpacked extension folder**, then click Reload under `opera://extensions` and refresh Showdown. Don't remove and re-add the extension unless needed because a new installation might get a new ID and lose local settings.

**Testing:** `node --test tests/*.test.js` plus a simulated Chromium browser test covering click/open/close, dragging, right-click Settings, immediate model switching, theme saves, and zero AI calls during UI interactions. Live Opera and your personal OpenRouter model still require real-world testing.

## v0.14 — Unified recommendation and evidence-based justification

When you ask a tactical question such as **“What is my next best move?”**, the extension uses **one connected on-demand decision pipeline**, not separate calculator answers:

1. Read the active battle, your full party and available move request, revealed opponent moves, field conditions, Speed matchups, and recent battle events.
2. Generate legal candidate moves, switches, targets, and Doubles combinations. Locally compute supported damage ranges with bundled `@smogon/calc` and estimate turn order with known Speed information.
3. Estimate potential retaliation **only from opponent moves already revealed**. Unknown attacks/items/sets remain unknown. Compare potential pressure, risk of being knocked out before acting, protecting a teammate, future speed control, and possible opponent switches/Protect.
4. Choose a bounded heuristic recommendation and an alternative. A separate `justification-engine.js` rechecks move/switch availability and composes **observable supporting evidence**, a meaningful tradeoff, and circumstances that could reverse the choice. If the action cannot be verified, it returns insufficient information rather than a false best move.
5. Send that combined recommendation **inside the same battle snapshot** to your chosen OpenRouter model in **one request when you press Send**. GPT receives instructions to reconcile the summary with battle facts and communicate its conclusion naturally, respecting Short / Medium / Long and personality preferences. Internal scores and checklists are *not* shown in chat.

**Examples:** A fast high-damage move can beat a defensive option if the modeled damage secures a possible KO first. If your Pokémon is low on HP and an opponent has revealed a dangerous faster attack, protecting can become the preferred choice. These are conditional estimates, not guaranteed outcomes or human cognition.

**Limitations:** This is an evidence-based tactical heuristic, not perfect opponent prediction or a real win-probability simulator. Smogon calculations depend on inferred stats, unknown items/abilities and supported move mechanics. GPT may still make mistakes or deviate from the local recommendation; there is no automatic move selection or second paid verification request. Always follow applicable Showdown/tournament outside-assistance rules.

## v0.12 — Layered tactical evaluation and evidence-based justifications

The companion has a new **local, bounded decision engine** (`src/decision-engine.js`). It runs **only when you press Send with a tactical battle question**. It does *not* issue additional OpenRouter requests, click moves, monitor the match in the background, or display its internal checklist in conversation.

The silent decision layers work as follows:

1. **Verified game evidence:** use the current player decision request, own team, active foes, revealed opponent moves, known types, speed comparisons, Tailwind/Trick Room, and event history. Missing or hidden information remains missing.
2. **Legal candidate generation:** enumerate currently offered non-disabled moves with PP and legal known switches. Respect forced-switch and trapped slots. Do not invent an unavailable move. For Doubles, create bounded joint actions and forbid two partners switching into the same reserve.
3. **Matchup and speed evaluation:** compare the known type chart, move category/power as a **relative pressure proxy**, priority, accuracy, available Speed estimates and field effects. The earlier version used these as estimates; **v0.13 supplements them with Smogon-calculated damage ranges when supported**. Neither system provides actual opponent-choice probabilities or win chances. Abilities/items that are unobserved can invalidate a type-only or Speed-based comparison.
4. **Opponent countermove scenarios:** consider an opposing attack, possible switches, revealed Protect variants, and revealed Speed control moves. A defensive Protect from a damaged opponent may be considered as a **hypothetical, explicitly unconfirmed** possibility, not stated as a known move.
5. **Doubles synergy and friendly-fire audit:** consider coordinated targeting, a Protect paired with an attack, Helping Hand, spread moves, teammate susceptibility to allied area damage, and known normal-condition immunities. Some exceptions (e.g. Gravity/Mold Breaker, spread move quirks) remain unmodeled.
6. **Conservative ranking and contrastive justification:** compare upside against bad counterplays, preserve strategic diversity (attacks, defense, support, switches), select a suggested action pair, inspect a runner-up alternative, and produce **short, evidence-based reasons and cautions** for the LLM.

The AI receives a **sanitized compact verdict**, not numeric scores, scoring weights, candidate enumerations, private internal reasoning, or hidden opponent information. The model is instructed to explain recommendations naturally: e.g. "I'd use Protect here because you likely move second, while your partner can attack," instead of reciting a numbered internal report. Your **Short / Medium / Long and personality settings** remain unchanged.

If the engine lacks a current legal request or current foe data, it explicitly reports **insufficient evidence**. Its advice is heuristic and cannot guarantee the objectively best move. Generation-aware damage ranges are now modeled using bundled @smogon/calc, but comprehensive hidden ability/item interactions and fully exact KO probabilities remain unresolved. Unit tests + local Chromium smoke check cover the new core; live Opera and your paid OpenRouter model still need a real-battle check.

To update: replace files in your **existing unpacked extension directory**, reload it under `opera://extensions`, then refresh Showdown. Try: **"What's the best play this turn, considering what my opponent might do?"**

## v0.11: On-demand Speed-aware battle decisions

When you ask a question or press refresh, the extension reads your battle's visible team and current field, and calculates **Speed tiers**. It uses your actual unboosted Speed from Showdown's own player-side battle request, your on-field Speed stages, status, held item and known ability, and visible Tailwind/Trick Room/weather/terrain. For an opponent it looks up the **public species base Speed** through Showdown's client Dex and computes an **estimated min–max** at the displayed level (0–31 IVs, 0–252 Speed EVs, Speed-lowering to Speed-boosting natures). Unknown enemy abilities/items, and unsupported effects are **not invented**. A Speed comparison assumes **equal priority**, no unforeseen abilities or item effects, and no speed ties; switches and priority moves can override it. Trick Room reverses the direction. In v0.13, supported attacks are also scored with local @smogon/calc ranges (read the limitations below); turn order and damage alone do not determine the optimal play.

Ask **`speed`** in Local mode for a Speed summary, or **“Who moves first and what's my best play?”** in OpenRouter mode. It still makes **zero AI calls** until you press Send.

**Supported baseline:** modern standard Pokémon rules, with on-demand reading and conservative fallbacks. Unusual abilities, moves and nonstandard/metagame effects may require confirmation. OpenRouter API key stays in local browser extension storage. Live Opera compatibility still needs verification.


## v0.11 — Short, Medium, and Long conversation controls

- Choose **Short** for quick, human-style conversational replies (normally 1–3 sentences), **Medium** for a little extra reasoning, or **Long** for detailed explanations when a question warrants it. A basic greeting stays a greeting in every mode.
- Change the response length **instantly from the messenger's Reply length selector** without opening settings. It's also available under personality settings in both the in-page ⚙ panel and the Opera/Chrome toolbar popup.
- Each choice is saved in the existing browser extension storage; no extra OpenRouter request happens when changing length. AI still answers only when you press **Send**.
- Personality and response length work independently. Existing v0.9 Natural maps to Medium; existing Detailed maps to Long. New installations default to Short.
- Length changes control **reply style**, not the API's reasoning/output token budget. Keeping the existing budget avoids accidentally cutting off reasoning-model answers. Explicit requests for shorter/longer explanations in chat also work.
- Verify with `node --test tests/*.test.js`; browser compatibility with your Opera installation and paid OpenRouter model has to be confirmed locally.

## v0.9 — Natural chat, rich formatting, and personality controls

- Replies appear like real chat instead of literal `**bold**`, `## headings`, or `==highlights==`. The messenger now safely renders **bold**, *italics*, headings, lists, quotes, `inline code`, fenced code blocks, highlights, and HTTPS Markdown links. Untrusted HTML is displayed as text, never executed.
- The AI prompt favors **normal back-and-forth conversation** rather than textbook-style reports. It can give complete explanations when asked. The former **9,000-character reply cut-off is removed**, the output-token ceiling is increased to **8,192**, and history includes up to 12 recent messages (provider limits and charges still apply).
- Choose **Friendly gaming buddy**, **Competitive Pokémon coach**, **Excited/playful teammate**, **Calm and relaxed**, or **Custom personality**. Add up to 1,600 characters of your own personality guidance. Optional **Response depth**: natural conversation or more detailed explanations.
- Set your personality in the **browser-toolbar popup** or via the messenger's **⚙ Settings**. Click **Save settings & personality** to persist it in trusted extension storage. No API call happens until you press **Send**.
- The chat window is slightly wider and uses larger, more readable text. None of the existing party, move, opponent, battle-history, model-picker, or on-demand behavior was removed.
- Tests: `node --test tests/*.test.js`. A Chromium mock test verified personality saving/reloading, visually formatted AI replies, and that pressing Send is the only trigger for an AI request. Real Opera + OpenRouter integration still needs an end-to-end check on your machine.

## Important behavior

- No background chat, polling, AI analysis, automatic messages, or automatic gameplay. **AI generation requests** are made only when you press **Send**. Model presets are included offline and selecting one only changes the locally saved model. No catalog fetch is needed.
- Each request includes the user's question, up to twelve recent AI chat messages, and a **limited sanitized snapshot** containing your full own party and known moves, active Pokémon and their available move PP, active opponents, previously revealed opponents, revealed opponent moves, and structured battle events. No **raw** battle logs, player chat, usernames, or room URLs are forwarded. Only selected structured battle actions are sent (e.g. moves, switches, statuses).
- The OpenRouter endpoint is `https://openrouter.ai/api/v1/chat/completions`, called **from the extension's service worker**, not from the page. The API key is not hardcoded in the extension files and never sent to the Showdown web page itself.
- The key is kept in **`chrome.storage.local` restricted to trusted extension contexts**. It survives browser restarts but is **not encrypted against someone who can access your local browser profile or computer**. Use a private, low-limit API key. Never share a profile, screenshots showing the key, source files with keys added, or export sensitive browser data. You may revoke the key in OpenRouter if it is exposed.
- Requests can incur OpenRouter usage charges, depending on model and account limits. Your OpenRouter balance is separate from any ChatGPT subscription.
- This build distinguishes opposing and friendly Pokémon from Showdown's far/near statbars, uses disclosed opposing team icons, and retains earlier sightings within a battle. It does not read hidden team details or guarantee all conditional move modifiers. AI advice may be imperfect; event/tournament policies may forbid live coaching.
- **Do not publish this unpacked developer extension as a shared build with a saved key.** Before public release, consider a user-authenticated backend to keep keys off client machines entirely.


## v0.7 — Full party, benched moves, and battle history

- When you click **Send** or **↻**, the extension reads Showdown's own **player battle request** using a read-only `chrome.scripting.executeScript` call in the active tab. It does not run a server or send gameplay commands.
- The personal battle request provides **all disclosed party Pokémon**, including benched Pokémon, plus each member's known move IDs (including Random Battles), ability, item, tera type and HP when available. Active move requests provide PP and disabled flags; these are matched against active field Pokémon in Singles and Doubles.
- The same on-demand read obtains **public battle protocol events** and converts the most recent moves, switches, fainting, damage, status, weather, terrain, items and abilities into compact, structured events.
- The companion remembers only **opponent moves that have actually appeared in battle**. It never claims to see unrevealed opposing moves.
- Ordinary public player messages, private messages, opponent usernames and raw battle logs are **not included** in the OpenRouter AI payload. The curated battle-event summary *is* included so the model can reason about prior actions.
- In **Local mode**, try `party` to list your entire disclosed team and moves or `history` for recent game actions. In **OpenRouter AI mode**, ask **“What's my best move? Consider my full party and everything revealed so far.”**
- If Showdown's in-page battle request is inaccessible in a particular version, the previous DOM battle reader still works for active/revealed opposing Pokémon, but full bench moves may be unavailable. Live Opera testing is still required.
- The extension now needs `scripting` permission plus Showdown-site host access exclusively to run the on-demand read. **No timers, automatic gameplay actions, or AI calls are added.**

## v0.6 opponent awareness (still included)

- When you **send a message or press ↻**, the extension scans the displayed battle locally and updates an info strip showing **Opponent active**, **Revealed**, and **Hidden slots**. No polling or automatic advice.
- Showdown's far-side (`lstatbar`) represents the opponent, and near-side (`rstatbar`) represents you. We read opponent team icons from `.rightbar`, including known species attached to nicknames; `Not revealed` icons are **not** treated as known Pokémon.
- We retain previously observed opposing Pokémon in the current battle even after they switch out (if information remains in the battle log or prior on-demand scans). The current foe(s) are labeled **active** distinctly from previously seen bench Pokémon. Doubles displays both active opponents.
- The raw battle log, player names, browser URL, private chat, and API key are **not forwarded** to OpenRouter. Only curated Pokémon data and your chat question are sent.
- An on-demand prompt such as **“What's my best move against the current opponent?”** now provides GPT the active enemy, revealed opponent roster, your active Pokémon and your available move/switch options. GPT can still be wrong about mechanics; unknown information must stay unknown.
- Team preview species may be visible before a Pokémon has entered battle, so the **Revealed** roster means *visible to you*, not necessarily *has entered play*. Pokémon with Illusion or Transform can complicate identity; those require further handling.
- Browser simulations cover opponent switch persistence and Doubles, but live Play Pokémon Showdown compatibility must be confirmed in a real match after installation.

## Model picker details

- Click the small model name **inside the message composer**, next to where you type. The menu opens instantly from a bundled list, without contacting OpenRouter.
- Select a model to save the choice, or use **Settings > Custom OpenRouter model ID** to supply a new ID. Recent custom IDs stay available.
- OpenRouter may change model availability, naming or pricing after the extension was built. An entry in this preset list does not guarantee a model will accept an API request. For current models, check [OpenRouter](https://openrouter.ai/models) separately when desired.
- The toolbar popup also uses the offline list. It is still useful for setting a key when your Showdown tab is closed.

## Questions and troubleshooting

| Problem | Fix |
|---|---|
| Can't see ⚡ | Reload Pokémon Showdown after enabling the extension. Check the `manifest.json` folder you loaded. The toolbar icon opens settings, while ⚡ opens the chat inside Showdown. |
| "API key missing" | Right-click the chat bubble, choose Settings & appearance, paste a key, and click Save settings (or use the toolbar popup). |
| Invalid model / 404 | Use an exact OpenRouter model ID, like `openai/gpt-5-mini`, found at [OpenRouter Models](https://openrouter.ai/models). |
| 401 / 402 / credits | Confirm your API key is active and your account has credits/limits sufficient for the selected model. |
| Network error | Confirm access to `openrouter.ai`, then retry with a short message. |
| No battle detected | Open an active battle room. Showdown UI updates may require reader changes. |

## Local development and saved Git progress

```bash
node --test tests/*.test.js
node --check src/content.js
node --check src/background.js
node --check src/ai-core.js
node --check src/game-capture.js
node --check src/battle-state.js
```

This ZIP is the **installable extension source**. Local Git history is kept in the development project, and the remote repository is `zyncez1/zyncez-showdown-companion`. To connect it manually from the local project folder:

```bash
git remote add origin https://github.com/zyncez1/zyncez-showdown-companion.git
git branch -M main
git push -u origin main
# If GitHub already contains a different root commit, fetch and reconcile first rather than force-pushing
```

Do not commit API keys to Git. All API credentials belong in the extension's Settings UI, not source code.

## v0.8 — Reasoning model response fix

- Fixed an overly restrictive `max_tokens: 1200` limit that could be exhausted by reasoning models (such as Claude Opus) before producing visible text. The request now provides an 8192-token **maximum** with low reasoning effort and asks for a concise user-visible answer. Higher capacity is not a guarantee of a reply and may increase the maximum potential bill for a request.
- Handles ordinary string answers, text content-part arrays, and common completion text wrappers while explicitly avoiding hidden reasoning output.
- If OpenRouter still returns empty content, the messenger reports the selected model, completion finish reason, and any output-token count available instead of incorrectly suggesting the model ID is invalid. Responses that end at the token limit display specific guidance.
- There are no automatic retries or extra provider calls. AI requests still happen only when **Send** is pressed; each request can incur charges.
- This version is tested with simulated OpenRouter responses and extension code checks. A real response using your personal key cannot be tested from this environment.

### Updating safely

Replace the extension files **in the exact same unpacked extension folder** to preserve its browser extension ID and stored key, then open `opera://extensions` and press **Reload**. Refresh Pokémon Showdown afterward. You do not need to share or re-enter your OpenRouter key if your original extension storage is retained.


## v0.13: Smogon damage calculations

This build includes `@smogon/calc` v0.12.0 browser bundles under `vendor/smogon-calc` from the user-provided npm package. When you ask a tactical question, the extension estimates attack damage using species, move, generation, observed player stats where reconstructible, and min/max opponent stat spreads. A range is **not** a guarantee against hidden items, abilities, EVs, IVs or mechanics. When the calculator cannot model a move/format reliably it leaves damage unknown rather than inventing a percentage.

Damage calculations use a bounded per-question cache and are performed locally; OpenRouter still receives just the compact decision support snapshot after you press Send. No automatic moves, no API key changes.
