/* No model calls in v0.1. Always clearly label what is unknown. */
(function (root) {
  'use strict';
  const T = typeof require === 'function' && typeof window === 'undefined' ? require('./types') : root.ZyncezTypes;
  function analyze(question, state, context) {
    const q = String(question || '').trim();
    const lower = q.toLowerCase();
    if (!q) return 'Ask me a question to start.';
    if (/^(help|\/help|what can you do)\??$/i.test(q))
      return 'Try: “battle status”, “what moves can I click?”, “fire vs grass/steel”, “set opponent type water flying”, “weaknesses”, or “best move”. I only inspect the battle when you send a message or tap Refresh. Full LLM reasoning is planned for a later version.';
    const setTypes = q.match(/^(?:set opponent type|\/type)\s+(.+)$/i);
    if (setTypes) {
      const names = setTypes[1].replace(/[,/+-]/g, ' ').split(/\s+/).map(T.normalize).filter(Boolean).slice(0,2);
      if (!names.length) return 'I could not find a valid type. Example: set opponent type water flying';
      context.opponentTypes = [...new Set(names)];
      return `Opponent type set manually to ${context.opponentTypes.join(' / ')}. This is your assumption, not an automatically confirmed battle fact.`;
    }
    const matchup = q.match(/\b(normal|fire|water|electric|grass|ice|fighting|poison|ground|flying|psychic|bug|rock|ghost|dragon|dark|steel|fairy)\s+(?:vs\.?|versus|against)\s+([a-z\s/,+-]+)/i);
    if (matchup) {
      const defending = matchup[2].replace(/[,/+-]/g, ' ').split(/\s+/).map(T.normalize).filter(Boolean).slice(0,2);
      const m = T.multiplier(matchup[1], defending);
      return m === null ? 'Specify a valid defending Pokémon type, for example: Fire vs Grass Steel.' : `${T.normalize(matchup[1])} against ${defending.join(' / ')}: ${m}× type effectiveness (modern chart, ignoring abilities, items, Terastallization, and other modifiers).`;
    }
    if (/weak|resist|immune|best move|what should i (?:do|use)|which move/i.test(lower)) {
      if (!context.opponentTypes?.length) return 'I need the opponent’s current type(s) before I can compare matchups reliably. Type “set opponent type water flying” (replace with the real types), then ask again. I will not guess its type from its name in v0.1.';
      const effective = T.types.map(attack => ({attack, value:T.multiplier(attack,context.opponentTypes)}));
      const weak = effective.filter(e=>e.value>1).map(e=>`${e.attack} ${e.value}×`);
      const resist = effective.filter(e=>e.value<1 && e.value>0).map(e=>`${e.attack} ${e.value}×`);
      const immune = effective.filter(e=>e.value===0).map(e=>e.attack);
      const moves = state.buttons.filter(b=>b.action==='chooseMove').map(b=>b.name);
      return `Against ${context.opponentTypes.join(' / ')}: super-effective attacking types: ${weak.join(', ') || 'none'}. Resisted: ${resist.join(', ') || 'none'}. Immune: ${immune.join(', ') || 'none'}.${moves.length ? `\nVisible move buttons: ${moves.join(', ')}.` : ''}\nI cannot choose a reliable best move yet: move typing, damage, abilities, speed, and ally targeting are not fully integrated. This is matchup information, not a ranked recommendation.`;
    }
    if (/move|switch|button|option/i.test(lower)) {
      return state.buttons.length ? `Visible battle choices: ${state.buttons.map(b=>b.name).join('; ')}. These are read-only; I will never click them.` : 'I cannot see any move or switch buttons in the currently selected battle view.';
    }
    if (/status|battle|turn|what.*happen|update/i.test(lower)) {
      if (!state.battleFound) return 'No active battle field found in the visible Showdown room. Open a battle, then ask again.';
      return `Battle detected${state.header?` (${state.header})`:''}. ${state.turn ? `Last visible turn: ${state.turn}.` : 'Turn number not found.'} ${state.pokemon.length ? `Visible Pokémon: ${state.pokemon.map(p=>p.name+(p.hp?` (${p.hp})`:'' )).join(', ')}.` : 'Active Pokémon not reliably detected.'} ${state.lines.length ? `Recent visible log: ${state.lines.slice(-4).join(' | ')}` : 'No readable log entries.'}`;
    }
    if (!state.battleFound) return 'I am ready, but I cannot see a battle right now. Open Pokémon Showdown and join a battle. Type “help” to see available commands.';
    return 'I can read the current battle, but this prototype does not yet have a language-model connection. Ask “battle status”, “moves”, “weaknesses”, or “fire vs grass”. I won’t invent a strategy answer.';
  }
  const api = {analyze};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZyncezCoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
