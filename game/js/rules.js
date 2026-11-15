'use strict';
/* Game state and rules: movement, battle, cities, heroes, turns. */

let G = null, MAP = null, AUTO = false;
const UI = { showBattle: async () => {}, askHero: async () => false, refresh() {}, onHumanTurn() {}, gameOver() {}, tick: async () => {} };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const idx = (x, y) => y * MAP_W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const fac = o => (o >= 0 ? FACTIONS[o] : NEUTRAL);
const isHuman = o => o >= 0 && G.players[o].human;

function logMsg(text, owner = -2) {
  G.log.push({ t: G.turn, text, owner }); if (G.log.length > 60) G.log.shift();
}

/* ---------- units ---------- */
const U = u => UNITS[u.type];
const has = (u, ab) => UNITS[u.type].abil.includes(ab);
const itemSum = (u, k) => (u.hero ? u.hero.items.reduce((s, key) => s + (ITEMS.find(i => i.key === key)[k] || 0), 0) : 0);
const uStr = u => U(u).str + (u.hero ? u.hero.level - 1 + itemSum(u, 'str') : 0);
const uMaxHp = u => U(u).hp + (u.hero ? Math.floor((u.hero.level - 1) / 2) + itemSum(u, 'hp') : 0);
const uMaxMp = u => U(u).mv + itemSum(u, 'mv');
const uMaxMana = u => U(u).mana + u.hero.level * 2 + itemSum(u, 'mana');
const heroLead = u => (u.hero.level >= 3 ? 1 : 0) + (u.hero.level >= 6 ? 1 : 0) + itemSum(u, 'lead');
const uName = u => (u.hero ? u.hero.name : U(u).name);
const upkeep = u => (u.hero ? 0 : Math.max(1, Math.round(U(u).cost / 40)));
const xpFor = level => 10 * level * level;

function makeUnit(type) { const u = { id: G.nextId++, type, mp: 0 }; u.mp = uMaxMp(u); return u; }
function makeHero(owner, cls) {
  const used = new Set(); G.stacks.forEach(s => s.units.forEach(u => u.hero && used.add(u.hero.name)));
  const names = FACTIONS[owner].heroes.filter(n => !used.has(n));
  const u = { id: G.nextId++, type: cls, mp: 0, hero: { name: names.length ? pick(names) : 'Wanderer ' + (G.nextId), level: 1, xp: 0, mana: 0, items: [] } };
  u.hero.mana = Math.floor(uMaxMana(u) / 2); u.mp = uMaxMp(u); return u;
}

/* ---------- lookups ---------- */
const stackAt = (x, y) => G.stacks.find(s => s.x === x && s.y === y) || null;
const stackById = id => G.stacks.find(s => s.id === id) || null;
const cityAt = (x, y) => { const i = MAP.cityGrid[idx(x, y)]; return i >= 0 ? G.cities[i] : null; };
const ruinAt = (x, y) => { const i = MAP.ruinGrid[idx(x, y)]; return i >= 0 ? G.ruins[i] : null; };
/* A city covers four tiles; every army standing in it defends it together. */
const CITY_TILES = [[0, 0], [1, 0], [0, 1], [1, 1]];
const TIER_NAMES = ['', 'Palisade town', 'Walled city', 'Citadel'];
const cityStacks = c => CITY_TILES.map(([a, b]) => stackAt(c.x + a, c.y + b)).filter(Boolean);
const cityUnits = c => cityStacks(c).flatMap(s => s.units);
function cityRoom(c) {
  for (const [a, b] of CITY_TILES) {
    let s = stackAt(c.x + a, c.y + b);
    if (!s) { s = { id: G.nextId++, x: c.x + a, y: c.y + b, owner: c.owner, units: [] }; G.stacks.push(s); return s; }
    if (s.units.length < MAX_STACK) return s;
  }
  return null;
}
function removeStack(s) { const i = G.stacks.indexOf(s); if (i >= 0) G.stacks.splice(i, 1); }

/* ---------- movement ---------- */
function stepCost(u, x, y) {
  if (!inb(x, y)) return Infinity;
  const i = idx(x, y), road = MAP.road[y][x] || MAP.cityGrid[i] >= 0, t = MAP.t[y][x];
  if (road) return 1;
  if (has(u, 'flying')) return 2;
  if (t === 'w' || t === 'm') return Infinity;
  if (t === 'f') return has(u, 'forester') ? 2 : 4;
  if (t === 'h') return has(u, 'hillfolk') ? 2 : 5;
  if (t === 's') return 5;
  return 2;
}

function dijkstraMap(units, owner, sx, sy) {
  const N = MAP_W * MAP_H, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const occ = new Array(N); for (const s of G.stacks) occ[idx(s.x, s.y)] = s;
  const heap = new Heap(), n = units.length; dist[idx(sx, sy)] = 0; heap.push(0, idx(sx, sy));
  while (heap.size) {
    const [d, i] = heap.pop(); if (d > dist[i]) continue;
    const x = i % MAP_W, y = (i - x) / MAP_W;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue; const nx = x + ox, ny = y + oy; if (!inb(nx, ny)) continue;
      let c = 0; for (const u of units) { const k = stepCost(u, nx, ny); if (k > c) c = k; }
      if (c === Infinity) continue;
      const j = idx(nx, ny), nd = d + c; if (nd >= dist[j]) continue;
      const o = occ[j], ci = MAP.cityGrid[j]; let terminal = false;
      if (o && o.owner !== owner) terminal = true;
      else if (o && o.units.length + n > MAX_STACK) continue;
      if (ci >= 0 && G.cities[ci].owner !== owner) terminal = true;
      dist[j] = nd; prev[j] = i; if (!terminal) heap.push(nd, j);
    }
  }
  return { dist, prev, sx, sy };
}
function pathTo(dm, tx, ty) {
  let i = idx(tx, ty); if (dm.dist[i] === Infinity) return null;
  const p = []; const s = idx(dm.sx, dm.sy);
  while (i !== s && i >= 0) { const x = i % MAP_W; p.push([x, (i - x) / MAP_W]); i = dm.prev[i]; }
  return p.reverse();
}

function relocate(from, units, x, y) {
  from.units = from.units.filter(u => !units.includes(u));
  if (!from.units.length) removeStack(from);
  let to = stackAt(x, y);
  if (!to) { to = { id: G.nextId++, x, y, owner: from.owner, units: [] }; G.stacks.push(to); }
  to.units.push(...units); return to;
}

/* Moves the given unit ids along a path as far as their movement allows. Returns the stack they end in (or null). */
async function moveGroup(stack, ids, path, delay = 0) {
  let cur = stack; const idset = new Set(ids);
  for (const [nx, ny] of path) {
    const units = cur.units.filter(u => idset.has(u.id));
    if (!units.length) return null;
    if (units.some(u => u.mp < stepCost(u, nx, ny))) return cur;
    const o = stackAt(nx, ny), city = cityAt(nx, ny);
    if ((o && o.owner !== cur.owner) || (city && city.owner !== cur.owner)) {
      units.forEach(u => { u.mp -= stepCost(u, nx, ny); });
      return await attack(cur, units, nx, ny);
    }
    if (o && o.units.length + units.length > MAX_STACK) return cur;
    units.forEach(u => { u.mp -= stepCost(u, nx, ny); });
    cur = relocate(cur, units, nx, ny);
    if (delay) await UI.tick(delay, cur);
    if (G.over) return cur;
  }
  return cur;
}

/* ---------- battle ---------- */
function wallBonus(city) { return city.level; }

function battleStr(u, own, enemy, x, y, isDef, city) {
  let s = uStr(u);
  if (own.some(v => has(v, 'banner'))) s += 1;
  let lead = 0; for (const v of own) if (v.hero) lead = Math.max(lead, heroLead(v));
  s += lead;
  const t = MAP.t[y][x];
  if (!city) { if (t === 'f' && has(u, 'forester')) s += 1; if (t === 'h' && has(u, 'hillfolk')) s += 1; }
  if (isDef && city) {
    let w = wallBonus(city); if (enemy.some(v => has(v, 'siege'))) w = Math.max(0, w - 2);
    s += w; if (has(u, 'guard')) s += 1;
  }
  if (u.bless) s += 1;
  if (enemy.some(v => has(v, 'terror'))) s -= 1;
  return Math.max(1, s);
}

function simulateBattle(att, def, x, y, city) {
  const order = (a, b) => (a.hero ? 100 : 0) + uStr(a) - ((b.hero ? 100 : 0) + uStr(b));
  const A = att.slice().sort(order), D = def.slice().sort(order);
  const str = {}, hp = {};
  A.forEach(u => { str[u.id] = battleStr(u, att, def, x, y, false, city); hp[u.id] = uMaxHp(u); });
  D.forEach(u => { str[u.id] = battleStr(u, def, att, x, y, true, city); hp[u.id] = uMaxHp(u); });
  const events = [], aDead = new Set(), dDead = new Set();
  let ai = 0, di = 0;
  const hit = (u, dead) => { hp[u.id]--; events.push({ k: 'hit', id: u.id, hp: hp[u.id] }); if (hp[u.id] <= 0) { dead.add(u.id); events.push({ k: 'die', id: u.id }); return true; } return false; };
  while (ai < A.length && di < D.length) {
    const a = A[ai], d = D[di]; events.push({ k: 'duel', a: a.id, d: d.id });
    let over = false;
    if (has(a, 'volley') && Math.random() < 0.3 && hit(d, dDead)) { di++; over = true; }
    if (!over && has(d, 'volley') && Math.random() < 0.3 && hit(a, aDead)) { ai++; over = true; }
    while (!over) {
      if (Math.random() < str[a.id] / (str[a.id] + str[d.id])) { if (hit(d, dDead)) { di++; over = true; } }
      else if (hit(a, aDead)) { ai++; over = true; }
    }
  }
  return { win: di >= D.length, events, aDead, dDead, str, A, D };
}
function estimateWin(att, def, x, y, city, n = 14) {
  let w = 0; for (let i = 0; i < n; i++) if (simulateBattle(att, def, x, y, city).win) w++;
  return w / n;
}

function gainXp(heroes, amount) {
  for (const h of heroes) {
    h.hero.xp += amount;
    while (h.hero.xp >= xpFor(h.hero.level)) {
      h.hero.level++; logMsg(`${h.hero.name} rises to level ${h.hero.level}.`, -2);
    }
  }
}

async function attack(from, units, x, y) {
  const city = cityAt(x, y), owner = from.owner, here = stackAt(x, y);
  const defStacks = city && city.owner !== owner ? cityStacks(city) : here ? [here] : [];
  const defUnits = defStacks.flatMap(s => s.units), def = { owner: defStacks.length ? defStacks[0].owner : -1 };
  let res = null;
  if (defUnits.length) {
    res = simulateBattle(units, defUnits, x, y, city);
    const where = city ? city.name : TERRAIN_NAMES[MAP.t[y][x]].toLowerCase();
    if (!AUTO && (isHuman(owner) || isHuman(def.owner))) await UI.showBattle(res, owner, def.owner, city, x, y);
    const killedD = defUnits.filter(u => res.dDead.has(u.id)), killedA = units.filter(u => res.aDead.has(u.id));
    from.units = from.units.filter(u => !res.aDead.has(u.id));
    for (const s of defStacks) { s.units = s.units.filter(u => !res.dDead.has(u.id)); if (!s.units.length) removeStack(s); }
    gainXp(units.filter(u => u.hero && !res.aDead.has(u.id)), killedD.reduce((s, u) => s + U(u).str, 0));
    gainXp(defUnits.filter(u => u.hero && !res.dDead.has(u.id)), killedA.reduce((s, u) => s + U(u).str, 0));
    [...killedA, ...killedD].forEach(u => { if (u.hero) logMsg(`${u.hero.name} has fallen in battle.`, -2); });
    if (!res.win) {
      logMsg(`${fac(owner).short} is beaten back at ${where} by ${fac(def.owner).short}.`, def.owner);
      if (!from.units.length) removeStack(from);
      return G.stacks.includes(from) ? from : null;
    }
    logMsg(`${fac(owner).short} defeats ${fac(def.owner).short} at ${where}.`, owner);
  }
  const survivors = units.filter(u => !res || !res.aDead.has(u.id));
  const to = relocate(from, survivors, x, y);
  if (city && city.owner !== owner) captureCity(city, owner, survivors);
  return to;
}

function captureCity(city, owner, units) {
  const old = city.owner, loot = 15 * city.level + rnd(25);
  city.owner = owner; city.cur = null; city.left = 0;
  G.players[owner].gold += loot;
  logMsg(`${fac(owner).short} takes ${city.name} and seizes ${loot} gold.`, owner);
  gainXp(units.filter(u => u.hero), 6 + 2 * city.level);
  if (old >= 0 && !G.cities.some(c => c.owner === old)) eliminate(old);
}
function eliminate(p) {
  G.players[p].alive = false;
  G.stacks = G.stacks.filter(s => s.owner !== p);
  logMsg(`${FACTIONS[p].name} has been destroyed.`, p);
  const alive = G.players.filter(q => q.alive);
  if (alive.length === 1) { G.over = true; G.winner = alive[0].id; }
  else if (!AUTO && G.players[p].human) { G.over = true; G.winner = -1; }
}

/* ---------- cities ---------- */
const cityIncome = c => 8 + 7 * c.level + (c.capital >= 0 ? 10 : 0);
const upgradeCost = c => 150 * c.level;
function income(p) {
  let inc = 0, up = 0;
  for (const c of G.cities) if (c.owner === p) inc += cityIncome(c);
  for (const s of G.stacks) if (s.owner === p) for (const u of s.units) { up += upkeep(u); inc += itemSum(u, 'gold'); }
  return { inc, up, net: inc - up };
}
function setProduction(city, type) {
  const pl = G.players[city.owner];
  if (city.cur && city.left === UNITS[city.cur].turns) pl.gold += UNITS[city.cur].cost; // nothing built yet: refund
  city.cur = null;
  if (!type) return true;
  if (pl.gold < UNITS[type].cost) return false;
  pl.gold -= UNITS[type].cost; city.cur = type; city.left = UNITS[type].turns; return true;
}
function upgradeCity(city) {
  const pl = G.players[city.owner], cost = upgradeCost(city);
  if (city.level >= 3 || pl.gold < cost) return false;
  pl.gold -= cost; city.level++; logMsg(`${city.name} is raised to a ${TIER_NAMES[city.level].toLowerCase()}.`, city.owner); return true;
}

/* ---------- heroes ---------- */
function castSpell(stack, hero, key) {
  const sp = SPELLS.find(s => s.key === key); if (!sp || hero.hero.mana < sp.cost) return false;
  if (key === 'pack' && stack.units.length >= MAX_STACK) return false;
  hero.hero.mana -= sp.cost;
  if (key === 'march') stack.units.forEach(u => { u.mp += 6; });
  if (key === 'ward') stack.units.forEach(u => { u.bless = true; });
  if (key === 'pack') stack.units.push(makeUnit('wolf'));
  return true;
}

function searchRuin(stack, hero) {
  const ruin = ruinAt(stack.x, stack.y); if (!ruin || ruin.explored) return null;
  const guardians = ['a barrow wight', 'a nest of cave spiders', 'a stone sentinel', 'a mad hermit-mage', 'a pack of ghouls', 'an ancient wyrmling'];
  const g = 3 + rnd(5), who = pick(guardians), s = uStr(hero);
  let hh = uMaxHp(hero), gh = 3;
  while (hh > 0 && gh > 0) { if (Math.random() < s / (s + g)) gh--; else hh--; }
  if (hh <= 0) {
    stack.units = stack.units.filter(u => u !== hero); if (!stack.units.length) removeStack(stack);
    const text = `${hero.hero.name} enters ${ruin.name} and is slain by ${who}.`;
    logMsg(text, stack.owner); return { ok: false, text };
  }
  ruin.explored = true; gainXp([hero], 8 + g);
  let text = `${hero.hero.name} defeats ${who} in ${ruin.name}`;
  const free = ITEMS.filter(i => !G.itemsFound.includes(i.key)), roll = Math.random();
  if (roll < 0.4 && free.length) {
    const it = pick(free); G.itemsFound.push(it.key); hero.hero.items.push(it.key);
    text += ` and finds the ${it.name} (${it.desc}).`;
  } else if (roll < 0.65 && stack.units.length < MAX_STACK) {
    const type = pick(['troll', 'gryphon', 'drake', 'reaver']), n = type === 'drake' ? 1 : Math.min(2, MAX_STACK - stack.units.length);
    for (let i = 0; i < n; i++) stack.units.push(makeUnit(type));
    text += ` and wins the loyalty of ${n === 1 ? 'a' : 'two'} ${UNITS[type].name}${n > 1 ? 's' : ''}.`;
  } else {
    const gold = 90 + rnd(140); G.players[stack.owner].gold += gold; text += ` and carries off ${gold} gold.`;
  }
  logMsg(text, stack.owner); return { ok: true, text };
}

/* ---------- turns ---------- */
function newGame(human) {
  MAP = genMap();
  G = { turn: 0, cur: -1, nextId: 1, over: false, winner: null, log: [], itemsFound: [], stacks: [], cities: [], ruins: [],
    players: FACTIONS.map((f, i) => ({ id: i, human: i === human, gold: 150, alive: true, heroOffer: 5 + rnd(4) })) };
  let ni = 0; const pool = ['levy', 'pike', 'archer', 'wolf', 'rider', 'ram', 'bearer', 'reaver', 'troll', 'gryphon', 'warden'];
  MAP.cities.forEach((c, i) => {
    const city = { id: i, x: c.x, y: c.y, capital: c.cap, owner: c.cap, level: 1, prod: [], cur: null, left: 0, name: '' };
    if (c.cap >= 0) {
      const f = FACTIONS[c.cap]; city.name = f.capital; city.level = 2;
      city.prod = ['levy', 'pike', 'archer', f.special];
      const s = { id: G.nextId++, x: c.x, y: c.y, owner: c.cap, units: [] }; G.stacks.push(s);
      s.units.push(makeHero(c.cap, f.heroCls), makeUnit('levy'), makeUnit('levy'), makeUnit('pike'));
    } else {
      city.name = CITY_NAMES[ni++ % CITY_NAMES.length];
      const central = Math.abs(c.x - MAP_W / 2) < 9 && Math.abs(c.y - MAP_H / 2) < 7;
      city.level = central ? 2 : 1 + (rnd(4) === 0 ? 1 : 0); if (central && rnd(3) === 0) city.level = 3;
      const set = new Set(['levy']); while (set.size < 4) set.add(pick(pool)); city.prod = [...set].sort((a, b) => UNITS[a].cost - UNITS[b].cost);
      const s = { id: G.nextId++, x: c.x, y: c.y, owner: -1, units: [] }; G.stacks.push(s);
      const n = central ? 3 : 1 + rnd(2); for (let k = 0; k < n; k++) s.units.push(makeUnit(pick(central ? ['pike', 'archer', 'reaver'] : ['levy', 'levy', 'pike', 'archer'])));
    }
    G.cities.push(city);
  });
  MAP.ruins.forEach((r, i) => G.ruins.push({ x: r.x, y: r.y, name: RUIN_NAMES[i % RUIN_NAMES.length], explored: false }));
  logMsg(`War comes to ${MAP_NAME}.`);
}

async function beginTurn(p) {
  const pl = G.players[p], net = income(p).net;
  if (G.turn > 1) pl.gold += net;
  if (pl.gold < 0) {
    pl.gold = 0; let worst = null, ws = null;
    for (const s of G.stacks) if (s.owner === p) for (const u of s.units) if (!u.hero && (!worst || upkeep(u) > upkeep(worst))) { worst = u; ws = s; }
    if (worst) { ws.units = ws.units.filter(u => u !== worst); if (!ws.units.length) removeStack(ws); logMsg(`Unpaid, a ${U(worst).name} deserts ${fac(p).short}.`, p); }
  }
  for (const s of G.stacks) if (s.owner === p) for (const u of s.units) {
    u.mp = uMaxMp(u); u.bless = false;
    if (u.hero) u.hero.mana = Math.min(uMaxMana(u), u.hero.mana + 2);
  }
  for (const c of G.cities) {
    if (c.owner !== p || !c.cur) continue;
    if (c.left > 0) c.left--;
    if (c.left > 0) continue;
    const s = cityRoom(c); if (!s) continue; // no room: wait
    s.units.push(makeUnit(c.cur));
    const type = c.cur; c.cur = null;
    if (!setProduction(c, type)) logMsg(`${c.name} halts production: not enough gold.`, p);
  }
  if (G.turn >= pl.heroOffer) {
    const heroes = G.stacks.filter(s => s.owner === p).reduce((n, s) => n + s.units.filter(u => u.hero).length, 0);
    const home = G.cities.find(c => c.owner === p && c.capital === p) || G.cities.find(c => c.owner === p);
    const cost = 80 + 60 * heroes;
    pl.heroOffer = G.turn + 6 + rnd(5);
    if (home && heroes < 3 && cityUnits(home).length < 4 * MAX_STACK && pl.gold >= cost) {
      const cls = pick(['champion', 'seer']);
      const yes = pl.human && !AUTO ? await UI.askHero(cls, cost, home) : pl.gold >= cost + 60;
      if (yes) {
        pl.gold -= cost; const h = makeHero(p, cls);
        cityRoom(home).units.push(h); logMsg(`${h.hero.name}, a ${U(h).name.toLowerCase()}, joins ${fac(p).short} at ${home.name}.`, p);
      }
    }
  }
}

/* Runs turns until it is a human's move (or the game ends). */
async function runTurns() {
  while (!G.over) {
    G.cur = (G.cur + 1) % FACTIONS.length; if (G.cur === 0) G.turn++;
    if (AUTO && G.turn > 150) { G.over = true; G.winner = -2; break; }
    if (!G.players[G.cur].alive) continue;
    await beginTurn(G.cur);
    if (G.players[G.cur].human && !AUTO) { saveGame(); UI.onHumanTurn(); return; }
    UI.refresh();
    await aiTurn(G.cur);
  }
  UI.gameOver();
}

function saveGame() { try { localStorage.setItem('ashen-crowns-save-v2', JSON.stringify(G)); } catch (e) { /* storage unavailable */ } }
function loadGame() {
  try {
    const raw = localStorage.getItem('ashen-crowns-save-v2'); if (!raw) return false;
    const g = JSON.parse(raw); if (!g || !g.cities || g.over) return false;
    MAP = genMap(); G = g; return true;
  } catch (e) { return false; }
}
function hasSave() { try { const r = localStorage.getItem('ashen-crowns-save-v2'); return !!r && !JSON.parse(r).over; } catch (e) { return false; } }
