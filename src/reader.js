/* Explicit read only; called when the user sends a question or presses Refresh. */
(function (root) {
  'use strict';
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const visible = e => !!e && e.getClientRects().length > 0;
  function read() {
    // Showdown can have multiple rooms; prefer the visible battle room rather than offscreen tabs.
    const rooms = Array.from(document.querySelectorAll('.ps-room')).filter(visible);
    const room = rooms.find(r => r.querySelector('.battle')) || document;
    const battle = room.querySelector('.battle');
    const log = room.querySelector('.battle-log, .battle-log-add, .battle-history');
    const lines = log ? (log.innerText || '').split('\n').map(clean).filter(Boolean).slice(-40) : [];
    const statbars = battle ? Array.from(battle.querySelectorAll('.statbar')) : [];
    const pokemon = statbars.map(e => {
      const name = clean(e.querySelector('strong, .name')?.textContent || e.getAttribute('title') || '');
      const hp = clean(e.querySelector('.hptext, .hp, .hpbar')?.textContent || '');
      return {name, hp};
    }).filter(x => x.name).slice(0, 6);
    const buttons = Array.from(room.querySelectorAll('button[name="chooseMove"], button[name="chooseSwitch"], .movemenu button, .switchmenu button'))
      .filter(visible).map(b => ({name:clean(b.textContent).slice(0, 90), action:b.getAttribute('name') || ''})).filter(b => b.name).slice(0, 16);
    const header = clean(room.querySelector('h2, .battle-header, .roomtitle')?.textContent || '');
    const turnMatches = [...lines.join(' ').matchAll(/\bTurn\s+(\d+)\b/gi)];
    const turn = turnMatches.length ? Number(turnMatches[turnMatches.length - 1][1]) : null;
    return {battleFound:!!battle, url:location.href, header, turn, pokemon, buttons, lines, sampledAt:new Date().toISOString()};
  }
  const api = {read};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZyncezReader = api;
})(typeof window !== 'undefined' ? window : globalThis);
