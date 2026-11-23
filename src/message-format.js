/* Safe, dependency-free Markdown rendering for assistant messages.
   Never interprets raw HTML, JavaScript URLs, or arbitrary CSS from a model. */
(function (root) {
  'use strict';
  const MAX_DEPTH = 6;
  function inline(target, text, doc, depth = 0) {
    const input = String(text ?? '');
    if (depth > MAX_DEPTH) { target.appendChild(doc.createTextNode(input)); return; }
    let position = 0, pending = '';
    const flush = () => { if (pending) { target.appendChild(doc.createTextNode(pending)); pending = ''; } };
    while (position < input.length) {
      if (input[position] === '\\' && position + 1 < input.length && /[\\*_=~`\[\]()#]/.test(input[position + 1])) {
        pending += input[position + 1]; position += 2; continue;
      }
      if (input[position] === '[') {
        const match = /^\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]+)\)/.exec(input.slice(position));
        if (match) {
          try {
            const url = new URL(match[2]);
            if (url.protocol === 'https:') {
              flush(); const link = doc.createElement('a'); link.href = url.href;
              link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = match[1];
              target.appendChild(link); position += match[0].length; continue;
            }
          } catch { /* Treat an invalid link as literal text. */ }
        }
      }
      const tags = [['**', 'strong'], ['__', 'strong'], ['==', 'mark'], ['~~', 'del'], ['`', 'code'], ['*', 'em'], ['_', 'em']];
      let matched = false;
      for (const [marker, tag] of tags) {
        if (!input.startsWith(marker, position)) continue;
        let end = input.indexOf(marker, position + marker.length);
        // In '**bold *italic***' the first star of the final three closes the inner italic span.
        if (marker === '**' && end !== -1 && input[end + 2] === '*' &&
            input.slice(position + 2, end).split('*').length % 2 === 0) end++;
        if (end <= position + marker.length) continue;
        const inner = input.slice(position + marker.length, end);
        if (inner.includes('\n') || /^\s|\s$/.test(inner)) continue;
        flush(); const el = doc.createElement(tag);
        if (tag === 'code') el.textContent = inner;
        else inline(el, inner, doc, depth + 1);
        target.appendChild(el); position = end + marker.length; matched = true; break;
      }
      if (!matched) pending += input[position++];
    }
    flush();
  }
  function renderMarkdown(text, doc = document) {
    const fragment = doc.createDocumentFragment();
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    const isSpecial = line => /^\s*$/.test(line) || /^\s*```/.test(line) || /^\s*#{1,3}\s+/.test(line) || /^\s*>\s?/.test(line) || /^\s*[-*+]\s+/.test(line) || /^\s*\d{1,3}[.)]\s+/.test(line) || /^\s*(?:---+|\*\*\*+)\s*$/.test(line);
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\s*```/.test(line)) {
        const opener = line.match(/^\s*```([\w-]*)/); const code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
        if (i < lines.length) i++;
        const pre = doc.createElement('pre'), content = doc.createElement('code');
        if (opener?.[1]) content.setAttribute('data-language', opener[1]);
        content.textContent = code.join('\n'); pre.appendChild(content); fragment.appendChild(pre); continue;
      }
      const heading = /^\s*(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        // Small headings for a messenger window, even if the model uses '#'.
        const el = doc.createElement('h' + heading[1].length);
        inline(el, heading[2].replace(/\s+#+\s*$/, ''), doc);
        fragment.appendChild(el); i++; continue;
      }
      if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { fragment.appendChild(doc.createElement('hr')); i++; continue; }
      if (/^\s*>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        const el = doc.createElement('blockquote'); inline(el, quote.join(' '), doc); fragment.appendChild(el); continue;
      }
      const bullet = /^\s*([-*+]|\d{1,3}[.)])\s+(.+)$/.exec(line);
      if (bullet) {
        const numbered = /^\d/.test(bullet[1]);
        const list = doc.createElement(numbered ? 'ol' : 'ul');
        if (numbered) list.start = Number.parseInt(bullet[1], 10);
        while (i < lines.length) {
          const item = /^\s*([-*+]|\d{1,3}[.)])\s+(.+)$/.exec(lines[i]);
          if (!item || /^\d/.test(item[1]) !== numbered) break;
          const li = doc.createElement('li'); inline(li, item[2], doc); list.appendChild(li); i++;
        }
        fragment.appendChild(list); continue;
      }
      const paragraph = [line]; i++;
      while (i < lines.length && !isSpecial(lines[i])) paragraph.push(lines[i++]);
      const p = doc.createElement('p');
      // Preserve explicit line breaks in chat without converting them to literal Markdown.
      paragraph.forEach((part, index) => { if (index) p.appendChild(doc.createElement('br')); inline(p, part, doc); });
      fragment.appendChild(p);
    }
    return fragment;
  }
  const api = {renderMarkdown};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZyncezFormat = api;
})(typeof self !== 'undefined' ? self : globalThis);
