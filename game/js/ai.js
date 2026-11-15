'use strict';
/* Computer opponents. */

function aiEconomy(p) {
  const pl = G.players[p];
  const mine = G.cities.filter(c => c.owner === p).sort((a, b) => (b.capital >= 0) - (a.capital >= 0));
  for (const c of mine) {
    if (c.cur) continue;
    const opts = c.prod.filter(t => UNITS[t].cost <= pl.gold);
    if (!opts.length) continue;
    opts.sort((a, b) => UNITS[b].str * UNITS[b].hp - UNITS[a].str * UNITS[a].hp);
    const choice = Math.random() < 0.3 ? pick(opts) : opts[0];
    setProduction(c, choice);
  }
  for (const c of mine) if (c.level < 3 && pl.gold >= upgradeCost(c) + 160) upgradeCity(c);
}

function aiCityTile(dm, c) {
  let best = { d: Infinity, x: c.x, y: c.y };
  for (const [a, b] of CITY_TILES) { const d = dm.dist[idx(c.x + a, c.y + b)]; if (d < best.d) best = { d, x: c.x + a, y: c.y + b }; }
  return best;
}

function aiGarrison(p, city) {
  let need = city.capital >= 0 ? 2 : 1;
  for (const s of G.stacks) {
    if (s.owner === p || s.owner < 0) continue;
    if (Math.max(Math.abs(s.x - city.x), Math.abs(s.y - city.y)) <= 5) { need += 1; break; }
  }
  return need;
}

async function aiStack(p, s) {
  const city = cityAt(s.x, s.y);
  let movers = s.units.filter(u => u.mp >= 2);
  if (city && city.owner === p) {
    const need = aiGarrison(p, city);
    const sorted = cityUnits(city).sort((a, b) => (a.hero ? 50 : 0) + uStr(a) - ((b.hero ? 50 : 0) + uStr(b)));
    const stay = new Set(sorted.slice(0, need).map(u => u.id));
    movers = movers.filter(u => !stay.has(u.id));
  } else if (movers.length < s.units.length) return; // keep field armies together
  if (!movers.length) return;

  const dm = dijkstraMap(movers, p, s.x, s.y);
  const hero = movers.find(u => u.hero), cands = [];
  for (const c of G.cities) {
    if (c.owner === p) continue; const near = aiCityTile(dm, c), d = near.d; if (d === Infinity) continue;
    cands.push({ x: near.x, y: near.y, d, v: (c.capital >= 0 ? 260 : 110) + 30 * c.level, city: c });
  }
  for (const o of G.stacks) {
    if (o.owner === p || o.owner < 0 || cityAt(o.x, o.y)) continue; const d = dm.dist[idx(o.x, o.y)]; if (d === Infinity) continue;
    cands.push({ x: o.x, y: o.y, d, v: 40 + o.units.reduce((n, u) => n + uStr(u) * 4, 0) });
  }
  if (hero && uStr(hero) >= 5) for (const r of G.ruins) {
    if (r.explored) continue; const d = dm.dist[idx(r.x, r.y)]; if (d === Infinity || d === 0) continue;
    cands.push({ x: r.x, y: r.y, d, v: 130, ruin: r });
  }
  cands.forEach(c => { c.score = c.v / (c.d + 8); });
  cands.sort((a, b) => b.score - a.score);
  let target = null;
  for (const c of cands.slice(0, 6)) {
    const def = stackAt(c.x, c.y), defU = c.city ? cityUnits(c.city) : def && def.owner !== p ? def.units : [];
    if (defU.length) {
      const need = movers.length >= 6 ? 0.55 : 0.68;
      if (estimateWin(movers, defU, c.x, c.y, c.city || null) < need) continue;
    } else if (c.ruin && def) continue;
    target = c; break;
  }
  let path = null;
  if (target) path = pathTo(dm, target.x, target.y);
  else if (!(city && city.owner === p)) {
    // Nothing worth attacking: fall back to the nearest friendly city and regroup.
    let best = null;
    for (const c of G.cities) { if (c.owner !== p) continue; const near = aiCityTile(dm, c); if (near.d < Infinity && (!best || near.d < best.d)) best = near; }
    if (best) path = pathTo(dm, best.x, best.y);
  }
  if (!path || !path.length) return;
  if (target && hero && hero.hero.mana >= 5 && !hero.bless && (target.city ? cityUnits(target.city).length : stackAt(target.x, target.y)) && target.d <= Math.min(...movers.map(u => u.mp))) {
    movers.forEach(u => { u.bless = true; }); hero.hero.mana -= 5;
  }
  const end = await moveGroup(s, movers.map(u => u.id), path, AUTO ? 0 : 28);
  if (end && !G.over) {
    const h = end.units.find(u => u.hero), r = ruinAt(end.x, end.y);
    if (h && r && !r.explored && end.owner === p && uStr(h) >= 5) searchRuin(end, h);
  }
}

async function aiTurn(p) {
  aiEconomy(p);
  for (let pass = 0; pass < 2; pass++) {
    const ids = G.stacks.filter(s => s.owner === p).map(s => s.id);
    for (const id of ids) {
      const s = stackById(id); if (!s || s.owner !== p) continue;
      await aiStack(p, s); if (G.over) return;
    }
  }
  aiEconomy(p);
}
