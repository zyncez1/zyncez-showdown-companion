# Zyncez AI Battle Companion (v0.4)

A Chrome / Opera Manifest V3 extension that adds a **toggleable, on-demand messenger** to Pokémon Showdown. Connect **OpenRouter from the browser toolbar popup (or in-page ⚙ Settings)**; no local server, Node.js, command window, pairing code, or separate OpenAI API account needed. The assistant replies **only when you click Send**. It never clicks moves or plays automatically.

## Setup (Chrome / Opera)

1. Extract the ZIP to a permanent directory. Open the inner `zyncez-showdown-companion` folder containing `manifest.json`, `popup.html`, and `src/`.
2. Open `chrome://extensions` (or `opera://extensions`), turn on **Developer mode**, click **Load unpacked**, and choose the extracted `zyncez-showdown-companion` directory containing `manifest.json`.
3. If upgrading v0.3, **replace the old unpacked extension files in the same folder** and click **Reload** on the extensions page. This preserves your extension ID and already saved settings. If you load a new folder instead, Chrome/Opera may treat it as a separate installation; then enter the key again.
4. Click the **Extensions (puzzle piece)** icon in your browser toolbar, pin **Zyncez AI Companion**, and click its icon. **The OpenRouter API key field appears right in this popup.**
5. Keep **OpenRouter AI** as the mode, optionally adjust the model ID (default `openai/gpt-5-mini`), and paste your **OpenRouter API key** from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys).
6. Click **Save OpenRouter settings**. Open or refresh [Pokémon Showdown](https://play.pokemonshowdown.com/), click the floating **⚡** bubble, ask a question, and press **Send**. The model's response appears in the same messenger window.
7. If you prefer, the exact same settings are also behind **⚙** inside the in-game messenger. The message panel rechecks saved settings when you open it or send a question.

You only need to paste the key once per browser profile/extension installation. You can change the model or replace/remove the key later in ⚙ Settings. **Local commands** can be selected for basic offline type matchups, and need no API key.

## Important behavior

- No background chat, polling, AI analysis, automatic messages, or automatic gameplay. No requests are made to OpenRouter until the user actually presses **Send**.
- Each request includes the user's question, up to eight recent AI chat messages, and a **limited sanitized snapshot** of visible Pokémon names/HP, turn number, and offered move/switch buttons. No battle logs, usernames, room URLs, or Showdown chat are forwarded.
- The OpenRouter endpoint is `https://openrouter.ai/api/v1/chat/completions`, called **from the extension's service worker**, not from the page. The API key is not hardcoded in the extension files and never sent to the Showdown web page itself.
- The key is kept in **`chrome.storage.local` restricted to trusted extension contexts**. It survives browser restarts but is **not encrypted against someone who can access your local browser profile or computer**. Use a private, low-limit API key. Never share a profile, screenshots showing the key, source files with keys added, or export sensitive browser data. You may revoke the key in OpenRouter if it is exposed.
- Requests can incur OpenRouter usage charges, depending on model and account limits. Your OpenRouter balance is separate from any ChatGPT subscription.
- This prototype can't reliably infer hidden opponent information, calculate every damage modifier, or distinguish every battle format. AI advice may be imperfect; event/tournament policies may forbid live coaching.
- **Do not publish this unpacked developer extension as a shared build with a saved key.** Before public release, consider a user-authenticated backend to keep keys off client machines entirely.

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

The **official project source is on GitHub** at [zyncez1/zyncez-showdown-companion](https://github.com/zyncez1/zyncez-showdown-companion). Clone it to continue development with Git:

```bash
git clone https://github.com/zyncez1/zyncez-showdown-companion.git
cd zyncez-showdown-companion
node --test tests/*.test.js
```

The installable ZIP is an extension distribution, **not a Git clone**. The GitHub repository holds the current source; use `git clone` for future development. Avoid saving API keys in the repository, source code, screenshots, or chat messages.
