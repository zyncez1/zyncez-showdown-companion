# Zyncez AI Battle Companion (v0.7)

A Chrome / Opera Manifest V3 extension that adds a **toggleable, on-demand messenger** to Pokémon Showdown. Connect **OpenRouter from the browser toolbar popup (or in-page ⚙ Settings)**; no local server, Node.js, command window, pairing code, or separate OpenAI API account needed. The assistant replies **only when you click Send**. It never clicks moves or plays automatically.

## Setup (Chrome / Opera)

1. Extract the ZIP to a permanent directory. Open the inner `zyncez-showdown-companion` folder containing `manifest.json`, `popup.html`, and `src/`.
2. Open `chrome://extensions` (or `opera://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the extracted `zyncez-showdown-companion` directory containing `manifest.json`.
3. If upgrading v0.3, **replace the old unpacked extension files in the same folder** and click **Reload** on the extensions page. This preserves your extension ID and already saved settings. If you load a new folder instead, Chrome/Opera may treat it as a separate installation; then enter the key again.
4. Click the **Extensions (puzzle piece)** icon in your browser toolbar, pin **Zyncez AI Companion**, and click its icon. **The OpenRouter API key field appears right in this popup.**
5. Keep **OpenRouter AI** as the mode, choose a model from **Quick switch** or click **Browse OpenRouter models** to search the catalog, and paste your **OpenRouter API key** from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
6. Click **Save OpenRouter settings**. Open or refresh [Pokémon Showdown](https://play.pokemonshowdown.com/), click the floating **⚡** bubble, ask a question, and press **Send**. The model's response appears in the same messenger window.
7. If you prefer, the exact same settings are also behind **⚙** inside the in-game messenger. The message panel rechecks saved settings when you open it or send a question.

You only need to paste the key once per browser profile/extension installation. **To change models, use the quick-switch dropdown or Browse button at the top of the Showdown messenger, or use the extension toolbar popup.** Browse provides search, a Free only checkbox, and available token prices. Model selection saves immediately without making an AI request. The exact model ID field remains available as an advanced fallback. You can replace/remove the key later in ⚙ Settings. **Local commands** can be selected for basic offline type matchups, and need no API key.

## Important behavior

- No background chat, polling, AI analysis, automatic messages, or automatic gameplay. **AI generation requests** are made only when you press **Send**. Clicking **Browse** explicitly fetches the OpenRouter model catalog; clicking a model only changes the locally saved selection.
- Each request includes the user's question, up to eight recent AI chat messages, and a **limited sanitized snapshot** containing your full own party and known moves, active Pokémon and their available move PP, active opponents, previously revealed opponents, revealed opponent moves, and structured battle events. No **raw** battle logs, player chat, usernames, or room URLs are forwarded. Only selected structured battle actions are sent (e.g. moves, switches, statuses).
- The OpenRouter endpoint is `https://openrouter.ai/api/v1/chat/completions`, called **from the extension's service worker**, not from the page. The API key is not hardcoded in the extension files and never sent to the Showdown web page itself.
- The key is kept in **`chrome.storage.local` restricted to trusted extension contexts**. It survives browser restarts but is **not encrypted against someone who can access your local browser profile or computer**. Use a private, low-limit API key. Never share a profile, screenshots showing the key, source files with keys added, or export sensitive browser data. You may revoke the key in OpenRouter if it is exposed.
- Requests can incur OpenRouter usage charges, depending on model and account limits. Your OpenRouter balance is separate from any ChatGPT subscription.
- This build distinguishes opposing and friendly Pokémon from Showdown's far/near statbars, uses disclosed opposing team icons, and retains earlier sightings within a battle. It does not read hidden team details or calculate all move modifiers. AI advice may be imperfect; event/tournament policies may forbid live coaching.
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

- The selected model appears in a dropdown **inside the messenger**, immediately above the chat area. Choose a recently used model in one click.
- Click **Browse**, search by name or provider, optionally check **Free only**, and click a model to select it immediately. Prices shown come from the catalog and may change; actual charges follow OpenRouter pricing.
- The extension fetches the catalog on demand from `https://openrouter.ai/api/v1/models`, filtered to chat-completion-compatible models. It uses your saved key for that fetch, but never sends your key to the Pokémon Showdown page.
- You can also browse or quick-switch from the browser toolbar extension popup.

## Questions and troubleshooting

| Problem | Fix |
|---|---|
| Can't see ⚡ | Reload Pokémon Showdown after enabling the extension. Check the `manifest.json` folder you loaded. The toolbar icon opens settings, while ⚡ opens the chat inside Showdown. |
| "API key missing" | Click the Zyncez toolbar icon (Extensions puzzle button if unpinned), paste a key, and click Save OpenRouter settings. |
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
