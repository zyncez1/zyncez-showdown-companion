/* Canonical modern type matchup multipliers; independent of generation-specific special cases. */
(function (root) {
  'use strict';
  const types = ["Normal","Fire","Water","Electric","Grass","Ice","Fighting","Poison","Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"];
  // Attacking type -> [super effective targets, resisted targets, immune targets]
  const table = {
    Normal:[[],["Rock","Steel"],["Ghost"]],
    Fire:[["Grass","Ice","Bug","Steel"],["Fire","Water","Rock","Dragon"],[]],
    Water:[["Fire","Ground","Rock"],["Water","Grass","Dragon"],[]],
    Electric:[["Water","Flying"],["Electric","Grass","Dragon"],["Ground"]],
    Grass:[["Water","Ground","Rock"],["Fire","Grass","Poison","Flying","Bug","Dragon","Steel"],[]],
    Ice:[["Grass","Ground","Flying","Dragon"],["Fire","Water","Ice","Steel"],[]],
    Fighting:[["Normal","Ice","Rock","Dark","Steel"],["Poison","Flying","Psychic","Bug","Fairy"],["Ghost"]],
    Poison:[["Grass","Fairy"],["Poison","Ground","Rock","Ghost"],["Steel"]],
    Ground:[["Fire","Electric","Poison","Rock","Steel"],["Grass","Bug"],["Flying"]],
    Flying:[["Grass","Fighting","Bug"],["Electric","Rock","Steel"],[]],
    Psychic:[["Fighting","Poison"],["Psychic","Steel"],["Dark"]],
    Bug:[["Grass","Psychic","Dark"],["Fire","Fighting","Poison","Flying","Ghost","Steel","Fairy"],[]],
    Rock:[["Fire","Ice","Flying","Bug"],["Fighting","Ground","Steel"],[]],
    Ghost:[["Psychic","Ghost"],["Dark"],["Normal"]],
    Dragon:[["Dragon"],["Steel"],["Fairy"]],
    Dark:[["Psychic","Ghost"],["Fighting","Dark","Fairy"],[]],
    Steel:[["Ice","Rock","Fairy"],["Fire","Water","Electric","Steel"],[]],
    Fairy:[["Fighting","Dragon","Dark"],["Fire","Poison","Steel"],[]]
  };
  function normalize(name) { return types.find(t => t.toLowerCase() === String(name || '').trim().toLowerCase()) || null; }
  function multiplier(attack, defenders) {
    const name = normalize(attack);
    if (!name || !Array.isArray(defenders) || !defenders.length) return null;
    let result = 1;
    for (const defender of defenders) {
      const d = normalize(defender);
      if (!d) return null;
      if (table[name][0].includes(d)) result *= 2;
      if (table[name][1].includes(d)) result *= 0.5;
      if (table[name][2].includes(d)) result *= 0;
    }
    return result;
  }
  const api = {types, table, normalize, multiplier};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ZyncezTypes = api;
})(typeof window !== 'undefined' ? window : globalThis);
