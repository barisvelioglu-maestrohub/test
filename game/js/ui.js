'use strict';
/* Rendering, input and panels. */

(() => {
  const $ = id => document.getElementById(id);
  const cv = $('map'), ctx = cv.getContext('2d'), mini = $('mini'), mctx = mini.getContext('2d');
  let terrain = null, HUMAN = 0, sel = null, selCity = null, busy = true, hover = null, preview = null, cam = { x: 0, y: 0 }, vw = 0, vh = 0;
  const urlCache = {};
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const spriteURL = (type, owner) => urlCache[type + owner] || (urlCache[type + owner] = unitSprite(type, owner).toDataURL());

  /* ---------- camera ---------- */
  function resize() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    vw = Math.max(50, Math.floor(r.width)); vh = Math.max(50, Math.floor(r.height));
    cv.width = vw * dpr; cv.height = vh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); clampCam();
  }
  function clampCam() {
    const mw = MAP_W * TS, mh = MAP_H * TS;
    cam.x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, cam.x));
    cam.y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, cam.y));
  }
  function centerOn(x, y) { cam.x = x * TS + TS / 2 - vw / 2; cam.y = y * TS + TS / 2 - vh / 2; clampCam(); }
  const onScreen = (x, y) => x * TS + TS > cam.x && x * TS < cam.x + vw && y * TS + TS > cam.y && y * TS < cam.y + vh;

  /* ---------- drawing ---------- */
  function label(text, x, y, color) {
    ctx.font = '700 12px "Alegreya Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,18,20,.85)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function badge(px, py, n, owner, dim) {
    const f = fac(owner);
    ctx.fillStyle = '#14161a'; ctx.fillRect(px + TS - 17, py + 1, 16, 15);
    ctx.fillStyle = dim ? f.dark : f.color; ctx.fillRect(px + TS - 16, py + 2, 14, 13);
    ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#14161a'; ctx.fillText(String(n), px + TS - 9, py + 9);
  }
  function render() {
    if (!G || !terrain) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#12161a'; ctx.fillRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    ctx.drawImage(terrain, 0, 0, MAP_W * TS, MAP_H * TS);
    for (const r of G.ruins) if (onScreen(r.x, r.y)) ctx.drawImage(ruinSprite(r.explored), r.x * TS, r.y * TS);
    for (const c of G.cities) if (onScreen(c.x, c.y)) ctx.drawImage(citySprite(c.owner, c.level), c.x * TS, c.y * TS - 10);
    for (const o of G.drops) { // relics left by a fallen hero
      if (!onScreen(o.x, o.y)) continue; const a = o.x * TS + 14, b = o.y * TS + 24;
      ctx.fillStyle = 'rgba(8,10,12,.4)'; ctx.beginPath(); ctx.ellipse(a + 10, b + 15, 13, 4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#1d1712'; ctx.lineWidth = 1.5; ctx.fillStyle = '#8a5a2b'; ctx.fillRect(a, b + 5, 20, 10); ctx.strokeRect(a, b + 5, 20, 10);
      ctx.fillStyle = '#a8703a'; ctx.fillRect(a, b, 20, 6); ctx.strokeRect(a, b, 20, 6); ctx.fillStyle = '#f3cf5b'; ctx.fillRect(a + 8, b + 3, 4, 6); ctx.strokeRect(a + 8, b + 3, 4, 6);
    }
    for (const s of G.stacks) {
      if (!onScreen(s.x, s.y)) continue;
      const px = s.x * TS, py = s.y * TS, inCity = MAP.cityGrid[idx(s.x, s.y)] >= 0, f = fac(s.owner);
      const idle = s.owner === HUMAN && !s.units.some(u => u.mp >= 1);
      const top = s.units.reduce((a, b) => ((b.hero ? 100 : 0) + uStr(b) > (a.hero ? 100 : 0) + uStr(a) ? b : a));
      if (inCity) { // a pale halo lifts the garrison off the stonework
        const hl = ctx.createRadialGradient(px + 24, py + 22, 6, px + 24, py + 22, 27);
        hl.addColorStop(0, 'rgba(255,250,225,.9)'); hl.addColorStop(0.7, 'rgba(255,250,225,.45)'); hl.addColorStop(1, 'rgba(255,250,225,0)');
        ctx.fillStyle = hl; ctx.fillRect(px - 4, py - 6, 56, 56);
      }
      ctx.drawImage(tokenSprite(top.type, s.owner), px + 1, py);
      if (s.units.some(u => u.hero)) { // a crown marks an army led by a hero
        ctx.beginPath(); ctx.moveTo(px - 1, py + 9); ctx.lineTo(px - 2, py - 2); ctx.lineTo(px + 3, py + 3); ctx.lineTo(px + 7, py - 4); ctx.lineTo(px + 11, py + 3); ctx.lineTo(px + 16, py - 2); ctx.lineTo(px + 15, py + 9); ctx.closePath();
        ctx.fillStyle = '#f3cf5b'; ctx.fill(); ctx.strokeStyle = '#1d1712'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#c0392b'; ctx.fillRect(px + 6, py + 4, 2.5, 2.5);
      }
      badge(px, py, s.units.length, s.owner, idle);
    }
    for (const c of G.cities) if (onScreen(c.x, c.y)) label(c.name, c.x * TS + TS, c.y * TS + 2 * TS + 1, c.owner >= 0 ? fac(c.owner).color : '#e9e4d2');
    if (preview && preview.path) {
      for (let i = 0; i < preview.path.length; i++) {
        const [x, y] = preview.path[i], last = i === preview.path.length - 1, ok = i < preview.reach;
        ctx.fillStyle = '#14161a'; ctx.beginPath(); ctx.arc(x * TS + 24, y * TS + 24, last ? 8 : 5, 0, 7); ctx.fill();
        ctx.fillStyle = preview.attack && last ? '#ff6b5a' : ok ? '#f3cf5b' : '#8b9096';
        ctx.beginPath(); ctx.arc(x * TS + 24, y * TS + 24, last ? 6 : 3, 0, 7); ctx.fill();
      }
    }
    const mark = (x, y, col, size = 1) => {
      const p = 2 + Math.round(2 * Math.sin(performance.now() / 220)), px = x * TS - p, py = y * TS - p, w = TS * size + 2 * p, L = 12;
      ctx.strokeStyle = '#14161a'; ctx.lineWidth = 5;
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        ctx.moveTo(px, py + L); ctx.lineTo(px, py); ctx.lineTo(px + L, py); ctx.moveTo(px + w - L, py); ctx.lineTo(px + w, py); ctx.lineTo(px + w, py + L);
        ctx.moveTo(px + w, py + w - L); ctx.lineTo(px + w, py + w); ctx.lineTo(px + w - L, py + w); ctx.moveTo(px + L, py + w); ctx.lineTo(px, py + w); ctx.lineTo(px, py + w - L);
        ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2;
      }
    };
    const ss = sel && stackById(sel.stackId);
    if (ss) mark(ss.x, ss.y, '#ffe27a'); else if (selCity) mark(selCity.x, selCity.y, '#e9e4d2', 2);
    ctx.restore();
    drawMini();
  }
  const MINI_COL = { g: '#4f9a3c', f: '#2d6e2a', h: '#8aa64a', m: '#8d8a84', w: '#2a66ab', s: '#56703b' };
  let miniBase = null;
  function drawMini() {
    const k = mini.width / MAP_W;
    if (!miniBase) {
      miniBase = mk(mini.width, mini.height); const m = miniBase.getContext('2d');
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { m.fillStyle = MAP.road[y][x] ? '#d2b077' : MINI_COL[MAP.t[y][x]]; m.fillRect(x * k, y * k, k, k); }
    }
    mctx.drawImage(miniBase, 0, 0);
    for (const s of G.stacks) { if (MAP.cityGrid[idx(s.x, s.y)] >= 0) continue; mctx.fillStyle = fac(s.owner).color; mctx.fillRect(s.x * k + 1, s.y * k + 1, k - 2, k - 2); }
    for (const c of G.cities) { mctx.fillStyle = '#14161a'; mctx.fillRect(c.x * k - 1, c.y * k - 1, 2 * k + 2, 2 * k + 2); mctx.fillStyle = fac(c.owner).color; mctx.fillRect(c.x * k, c.y * k, 2 * k, 2 * k); }
    mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.strokeRect(cam.x / TS * k + .5, cam.y / TS * k + .5, Math.min(MAP_W, vw / TS) * k, Math.min(MAP_H, vh / TS) * k);
  }
  function loop() { render(); requestAnimationFrame(loop); }

  /* ---------- side panel ---------- */
  function unitCard(u, owner, picked, clickable) {
    const ab = U(u).abil.map(a => ABILITIES[a]).join(' · ');
    const extra = u.hero ? `Lv ${u.hero.level} · mana ${u.hero.mana}/${uMaxMana(u)}` : '';
    return `<button type="button" class="unit${u.hero ? ' hero' : ''}${picked ? ' on' : ''}" ${clickable ? `data-unit="${u.id}"` : 'disabled'} title="${esc(ab || 'No special ability')}">
      <img src="${spriteURL(u.type, owner)}" alt=""><span class="un">${esc(uName(u))}${u.bless ? ' ✦' : ''}</span>
      <span class="us">Str ${uStr(u)} · Hits ${uMaxHp(u)} · Move ${Math.max(0, Math.floor(u.mp))}/${uMaxMp(u)}</span>${extra ? `<span class="us">${extra}</span>` : ''}</button>`;
  }
  function panelHTML() {
    let h = '';
    const s = sel && stackById(sel.stackId);
    if (s) {
      h += `<h2>Army <span class="muted">${s.units.length}/${MAX_STACK}</span></h2><div class="units">`;
      for (const u of s.units.slice().sort((a, b) => !!b.hero - !!a.hero)) h += unitCard(u, s.owner, sel.ids.has(u.id), true);
      h += '</div><p class="hint">Click a unit to leave it behind. Click the map to march.</p>';
      const hero = s.units.find(u => u.hero && sel.ids.has(u.id));
      if (hero) {
        h += `<h3>${esc(hero.hero.name)}</h3><p class="muted">Level ${hero.hero.level} ${U(hero).name} · ${hero.hero.xp}/${xpFor(hero.hero.level)} xp${heroLead(hero) ? ` · command +${heroLead(hero)}` : ''}</p>`;
        if (hero.hero.pending > 0) {
          h += `<p class="advance">New level reached. Choose an advance${hero.hero.pending > 1 ? ` (${hero.hero.pending} to spend)` : ''}:</p><div class="row">`;
          for (const k of perkOptions(hero)) h += `<button type="button" class="primary" data-perk="${k}" data-hero="${hero.id}">${PERKS[k].name} <small>${PERKS[k].desc}</small></button>`;
          h += '</div>';
        }
        const got = Object.keys(PERKS).filter(k => hero.hero.perks[k]).map(k => `${PERKS[k].name} ×${hero.hero.perks[k]}`);
        if (got.length) h += `<p class="muted">Advances: ${got.join(', ')}</p>`;
        const q = hero.hero.quest, home = cityAt(s.x, s.y);
        if (q) h += `<p class="quest"><b>Quest.</b> ${esc(q.text)}${q.type === 'slay' ? ` (${q.left} to go)` : ''} <span class="muted">Reward: ${QUEST_REWARDS[q.reward]}.</span></p>`;
        else if (home && home.owner === HUMAN) h += `<div class="row"><button type="button" data-quest="${hero.id}">Seek a quest in ${esc(home.name)}</button></div>`;
        if (hero.hero.items.length) h += '<p class="muted">' + hero.hero.items.map(k => { const it = ITEMS.find(i => i.key === k); return `${esc(it.name)} (${esc(it.desc)})`; }).join('<br>') + '</p>';
        h += '<div class="row">';
        for (const sp of SPELLS) h += `<button type="button" data-spell="${sp.key}" data-hero="${hero.id}" title="${esc(sp.desc)}" ${hero.hero.mana < sp.cost ? 'disabled' : ''}>${sp.name} <small>${sp.cost}</small></button>`;
        h += '</div>';
        const r = ruinAt(s.x, s.y);
        if (r && !r.explored) h += `<div class="row"><button type="button" class="primary" data-search="${hero.id}">Search ${esc(r.name)}</button></div>`;
      }
    }
    const c = selCity || (s && cityAt(s.x, s.y));
    if (c) {
      const mine = c.owner === HUMAN;
      h += `<h2 style="color:${fac(c.owner).color}">${esc(c.name)}</h2><p class="muted">${esc(fac(c.owner).name)}${c.capital >= 0 ? ' · capital' : ''}<br>${TIER_NAMES[c.level]} (tier ${c.level} of 3) · walls +${wallBonus(c)} · ${cityIncome(c)} gold/turn</p>`;
      const gar = cityUnits(c);
      h += `<h3>Garrison <span class="muted">${gar.length}</span></h3>` + (gar.length ? '<div class="units">' + gar.map(u => unitCard(u, c.owner, false, false)).join('') + '</div>' : '<p class="muted">Undefended.</p>');
      if (mine) {
        h += '<h3>Muster</h3><div class="prod">';
        for (const t of c.prod) {
          const d = UNITS[t], on = c.cur === t;
          h += `<button type="button" class="unit${on ? ' on' : ''}" data-prod="${t}" data-city="${c.id}" title="${esc(d.abil.map(a => ABILITIES[a]).join(' · ') || 'No special ability')}">
            <img src="${spriteURL(t, HUMAN)}" alt=""><span class="un">${d.name}</span><span class="us">Str ${d.str} · Hits ${d.hp} · Move ${d.mv}</span>
            <span class="us">${d.cost} gold · ${on ? `ready in ${c.left}` : `${d.turns} turn${d.turns > 1 ? 's' : ''}`}</span></button>`;
        }
        h += '</div><div class="row">';
        if (c.cur) h += `<button type="button" data-prod="" data-city="${c.id}">Stop muster</button>`;
        if (c.level < 3) h += `<button type="button" data-upgrade="${c.id}" ${G.players[HUMAN].gold < upgradeCost(c) ? 'disabled' : ''}>Build ${TIER_NAMES[c.level + 1].toLowerCase()} <small>${upgradeCost(c)} gold</small></button>`;
        h += '</div>';
      }
    }
    if (!h) h = '<p class="hint">Select one of your armies or cities. Right-click (or click) the map to march there. Drag to scroll.</p>';
    return h;
  }
  function refresh() {
    if (!G) return;
    const pl = G.players[HUMAN], inc = income(HUMAN), cur = G.cur >= 0 ? FACTIONS[G.cur] : FACTIONS[HUMAN];
    $('turnbar').innerHTML = `<span>Turn ${Math.max(1, G.turn)}</span><span class="who" style="color:${cur.color}">${G.cur === HUMAN && !busy ? 'Your move' : esc(cur.short) + ' is moving…'}</span>`;
    $('treasury').innerHTML = `<span class="coin"></span><b>${pl.gold}</b> gold <span class="muted">(${inc.net >= 0 ? '+' : ''}${inc.net} per turn: ${inc.inc} income, ${inc.up} upkeep)</span>`;
    $('panel').innerHTML = panelHTML();
    $('log').innerHTML = G.log.slice(-9).reverse().map(l => `<li><span class="muted">T${Math.max(1, l.t)}</span> <span style="color:${l.owner >= 0 ? fac(l.owner).color : 'inherit'}">${esc(l.text)}</span></li>`).join('');
    $('bEnd').disabled = $('bNext').disabled = busy || G.cur !== HUMAN;
  }

  /* ---------- selection and orders ---------- */
  function selectStack(s) { sel = { stackId: s.id, ids: new Set(s.units.filter(u => u.mp >= 1).map(u => u.id)) }; if (!sel.ids.size) sel.ids = new Set(s.units.map(u => u.id)); selCity = null; preview = null; refresh(); }
  function deselect() { sel = null; selCity = null; preview = null; refresh(); }
  function selUnits() { const s = sel && stackById(sel.stackId); return s ? s.units.filter(u => sel.ids.has(u.id)) : []; }
  function nextArmy() {
    const list = G.stacks.filter(s => s.owner === HUMAN && s.units.some(u => u.mp >= 2)); if (!list.length) { deselect(); return; }
    const i = sel ? list.findIndex(s => s.id === sel.stackId) : -1, s = list[(i + 1) % list.length];
    selectStack(s); if (!onScreen(s.x, s.y)) centerOn(s.x, s.y); else centerOn(s.x, s.y);
  }
  function setHoverText(t) { $('hover').textContent = t; }
  function describe(x, y) {
    const parts = [], c = cityAt(x, y), r = ruinAt(x, y), s = stackAt(x, y);
    parts.push(c ? `${c.name} (${fac(c.owner).short} ${TIER_NAMES[c.level].toLowerCase()}, walls +${wallBonus(c)}, garrison ${cityUnits(c).length})` : TERRAIN_NAMES[MAP.t[y][x]] + (MAP.road[y][x] ? ' · road' : ''));
    if (r) parts.push(r.name + (r.explored ? ' (searched)' : ' (unsearched ruin)'));
    if (G.drops.some(o => o.x === x && o.y === y)) parts.push('relics of a fallen hero lie here');
    if (s) parts.push(`${fac(s.owner).short}: ` + s.units.map(u => `${uName(u)} ${uStr(u)}`).join(', '));
    return parts.join(' — ');
  }
  function updatePreview() {
    preview = null; if (!hover || !G) return;
    let text = describe(hover.x, hover.y);
    const s = sel && stackById(sel.stackId), units = selUnits();
    if (s && units.length && !busy && !(s.x === hover.x && s.y === hover.y)) {
      if (!sel.dm) sel.dm = dijkstraMap(units, HUMAN, s.x, s.y);
      const path = pathTo(sel.dm, hover.x, hover.y);
      if (path && path.length) {
        const mp = units.map(u => u.mp); let reach = 0;
        for (const [x, y] of path) { let ok = true; units.forEach((u, i) => { mp[i] -= stepCost(u, x, y); if (mp[i] < 0) ok = false; }); if (!ok) break; reach++; }
        const t = stackAt(hover.x, hover.y), c = cityAt(hover.x, hover.y), enemy = (t && t.owner !== HUMAN) || (c && c.owner !== HUMAN);
        preview = { path, reach, attack: enemy };
        const defU = c && c.owner !== HUMAN ? cityUnits(c) : t && t.owner !== HUMAN ? t.units : [];
        if (defU.length) text += ` — odds of victory about ${Math.round(100 * estimateWin(units, defU, hover.x, hover.y, c, 40))}%`;
        if (reach < path.length) text += ' — more than one turn away';
      } else text += ' — no route';
    }
    setHoverText(text);
  }
  async function orderMove(tx, ty) {
    const s = stackById(sel.stackId), units = selUnits(); if (!s || !units.length) return;
    const dm = dijkstraMap(units, HUMAN, s.x, s.y), path = pathTo(dm, tx, ty);
    if (!path || !path.length) { setHoverText('No route there for this army.'); return; }
    const ids = units.map(u => u.id); busy = true; preview = null; refresh();
    const end = await moveGroup(s, ids, path, 55);
    busy = false;
    const left = end && end.owner === HUMAN ? end.units.filter(u => ids.includes(u.id)) : [];
    sel = left.length ? { stackId: end.id, ids: new Set(left.map(u => u.id)) } : null; selCity = null;
    if (G.over) { UI.gameOver(); return; }
    refresh(); updatePreview(); showNotices();
  }
  function clickTile(x, y, right) {
    if (!G || busy || G.cur !== HUMAN || !inb(x, y)) return;
    const s = stackAt(x, y), c = cityAt(x, y), mine = s && s.owner === HUMAN;
    if (sel && stackById(sel.stackId)) {
      if (mine && s.id === sel.stackId) { selectStack(s); return; }
      if (mine && !right) { selectStack(s); return; }
      orderMove(x, y); return;
    }
    if (mine) selectStack(s);
    else if (c) { sel = null; selCity = c; refresh(); }
    else deselect();
  }

  /* ---------- modal helpers ---------- */
  function modal(html) { $('mbox').innerHTML = html; $('modal').hidden = false; const b = $('mbox').querySelector('button.primary') || $('mbox').querySelector('button'); if (b) b.focus(); }
  function closeModal() { $('modal').hidden = true; $('mbox').innerHTML = ''; }
  const waitClick = sel => new Promise(res => { $('mbox').addEventListener('click', function h(e) { const b = e.target.closest(sel); if (!b) return; $('mbox').removeEventListener('click', h); res(b); }); });

  function showNotices() {
    if (!G.notices.length || !$('modal').hidden) return;
    const list = G.notices.splice(0);
    modal(`<h2>News of your heroes</h2>${list.map(t => `<p>${esc(t)}</p>`).join('')}<div class="row"><button type="button" class="primary" data-a="ok">Continue</button></div>`);
    waitClick('button[data-a]').then(closeModal);
  }
  UI.tick = async (delay, stack) => { if (stack && onScreen(stack.x, stack.y)) await sleep(delay); };
  UI.refresh = refresh;
  UI.onHumanTurn = () => {
    busy = false; sel = null; selCity = null;
    const first = G.stacks.find(s => s.owner === HUMAN && s.units.some(u => u.mp >= 2));
    if (first) { selectStack(first); centerOn(first.x, first.y); } else refresh();
    showNotices();
  };
  UI.askHero = async (cls, cost, home) => {
    modal(`<h2>A hero seeks your banner</h2><div class="offer"><img src="${spriteURL(cls, HUMAN)}" alt=""><p>A wandering ${UNITS[cls].name.toLowerCase()} waits at the gates of ${esc(home.name)} and will swear to you for <b>${cost} gold</b>.<br><span class="muted">${cls === 'seer' ? 'Seers fight poorly but hold twice the mana.' : 'Champions are strong fighters with little mana.'}</span></p></div>
      <div class="row"><button type="button" class="primary" data-a="y">Accept (${cost} gold)</button><button type="button" data-a="n">Send away</button></div>`);
    const b = await waitClick('button[data-a]'); closeModal(); return b.dataset.a === 'y';
  };
  UI.showBattle = async (res, attOwner, defOwner, city, x, y) => {
    centerOn(x, y);
    const side = (units, owner) => units.map(u => `<div class="bu" id="bu${u.id}"><img src="${spriteURL(u.type, owner)}" alt=""><span class="un">${esc(uName(u))}</span><span class="us">Str ${res.str[u.id]}</span><span class="pips" data-max="${uMaxHp(u)}">${'<i></i>'.repeat(uMaxHp(u))}</span></div>`).join('');
    modal(`<h2>Battle ${city ? 'for ' + esc(city.name) : 'in the ' + TERRAIN_NAMES[MAP.t[y][x]].toLowerCase()}</h2>
      <div class="battle"><div><h3 style="color:${fac(attOwner).color}">${esc(fac(attOwner).name)} <span class="muted">attacks</span></h3><div class="bside">${side(res.A, attOwner)}</div></div>
      <div><h3 style="color:${fac(defOwner).color}">${esc(fac(defOwner).name)} <span class="muted">defends</span></h3><div class="bside">${side(res.D, defOwner)}</div></div></div>
      <p id="bres" class="bres">&nbsp;</p><div class="row"><button type="button" class="primary" data-a="go">Skip</button></div>`);
    let skip = false, done = false; const btn = $('mbox').querySelector('button[data-a]');
    const finished = new Promise(resolve => btn.addEventListener('click', () => { if (done) resolve(); else skip = true; }));
    for (const e of res.events) {
      if (e.k === 'duel') { $('mbox').querySelectorAll('.bu.act').forEach(n => n.classList.remove('act')); for (const id of [e.a, e.d]) { const n = $('bu' + id); if (n) n.classList.add('act'); } }
      else if (e.k === 'hit') { const n = $('bu' + e.id); if (n) { const pips = n.querySelectorAll('.pips i'); pips.forEach((p, i) => p.classList.toggle('lost', i >= e.hp)); n.classList.add('hit'); setTimeout(() => n.classList.remove('hit'), 120); } }
      else if (e.k === 'die') { const n = $('bu' + e.id); if (n) n.classList.add('dead'); }
      if (!skip) await sleep(e.k === 'duel' ? 260 : 190);
    }
    const humanWon = (attOwner === HUMAN) === res.win;
    $('bres').textContent = res.win ? `${fac(attOwner).short} carries the field.` : `${fac(defOwner).short} holds firm.`;
    $('bres').className = 'bres ' + (humanWon ? 'good' : 'bad');
    done = true; btn.textContent = 'Continue'; await finished; closeModal();
  };
  UI.gameOver = () => {
    busy = true; refresh(); try { localStorage.removeItem('ashen-crowns-save-v3'); } catch (e) { /* ignore */ }
    const won = G.winner === HUMAN;
    modal(`<h2>${won ? 'The Vale is yours' : 'Your banner has fallen'}</h2><p>${won ? `After ${G.turn} turns every rival crown lies in the ash. ${esc(FACTIONS[HUMAN].name)} rules ${MAP_NAME}.` : `${esc(FACTIONS[HUMAN].name)} holds no city in ${MAP_NAME}. The war goes on without you.`}</p><div class="row"><button type="button" class="primary" data-a="new">New war</button></div>`);
    waitClick('button[data-a]').then(() => title());
  };

  function title() {
    busy = true;
    const cards = FACTIONS.map((f, i) => `<button type="button" class="fcard" data-f="${i}" style="--fc:${f.color}"><img src="${spriteURL(f.heroCls, i)}" alt=""><img src="${spriteURL(f.special, i)}" alt=""><b>${esc(f.name)}</b><span>${esc(f.blurb)}</span><span class="muted">Seat: ${esc(f.capital)} · Hero: ${UNITS[f.heroCls].name} · ${UNITS[f.special].name}</span></button>`).join('');
    modal(`<p class="eyebrow">A turn-based war for ${MAP_NAME}</p><h1 class="logo">Ashen Crowns</h1><p>Four crowns, one valley. Raise armies, send heroes into the old ruins and take every rival seat. Choose your banner.</p>
      <div class="fgrid">${cards}</div>${hasSave() ? '<div class="row"><button type="button" class="primary" data-f="load">Continue saved war</button></div>' : ''}`);
    waitClick('button[data-f]').then(async b => {
      closeModal();
      if (b.dataset.f === 'load' && loadGame()) { HUMAN = G.players.findIndex(p => p.human); start(); UI.onHumanTurn(); return; }
      HUMAN = +b.dataset.f || 0; newGame(HUMAN); start();
      const cap = G.cities.find(c => c.capital === HUMAN); centerOn(cap.x, cap.y);
      await runTurns();
    });
  }
  function start() { terrain = paintTerrain(); miniBase = null; resize(); refresh(); }
  function help() {
    modal(`<h2>How to play</h2><ul class="help">
      <li><b>Goal.</b> Capture every rival city. A crown with no cities is destroyed.</li>
      <li><b>Armies.</b> Click an army to select it, then click (or right-click) a destination. Up to ${MAX_STACK} units share a tile. Click a unit in the panel to leave it behind. Right-click a friendly army to merge.</li>
      <li><b>Terrain.</b> Roads are fastest. Forest, hills and marsh are slow. Only flyers cross water and mountains; bridges carry everyone.</li>
      <li><b>Battle.</b> Units duel one at a time, weakest first. The chance to land a hit is your strength against theirs. City walls, banners, heroes and terrain all add strength. Hover an enemy to see the odds.</li>
      <li><b>Cities.</b> A city covers four tiles and every army inside defends it together. Each city musters one unit type at a time and repeats it while you can pay. Cities have three tiers: palisade town, walled city and citadel. Each tier adds gold and +1 to the walls.</li>
      <li><b>Heroes.</b> An army led by a hero wears a crown. Heroes gain experience and choose an advance at each new level, cast spells with mana, and can search ruins (golden glow) for gold, relics or allies, which can kill them. In one of your cities a hero can seek a quest for a reward. A fallen hero's relics stay on the tile until another hero collects them.</li>
      <li><b>Keys.</b> N next army · E end turn · Esc deselect · arrows scroll.</li></ul>
      <div class="row"><button type="button" class="primary" data-a="ok">Back to the war</button></div>`);
    waitClick('button[data-a]').then(closeModal);
  }

  /* ---------- events ---------- */
  let down = null;
  const tileOf = e => { const r = cv.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left + cam.x) / TS), y: Math.floor((e.clientY - r.top + cam.y) / TS) }; };
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, pan: false, btn: e.button }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (down.pan || Math.hypot(dx, dy) > 7) { down.pan = true; cam.x = down.cx - dx; cam.y = down.cy - dy; clampCam(); return; } }
    if (!G) return; const t = tileOf(e); if (!inb(t.x, t.y)) return;
    if (!hover || hover.x !== t.x || hover.y !== t.y) { hover = t; updatePreview(); }
  });
  cv.addEventListener('pointerup', e => { const d = down; down = null; if (!d || d.pan) return; const t = tileOf(e); clickTile(t.x, t.y, d.btn === 2); });
  cv.addEventListener('pointercancel', () => { down = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.x += e.deltaX; cam.y += e.deltaY; clampCam(); }, { passive: false });
  mini.addEventListener('pointerdown', e => { const r = mini.getBoundingClientRect(); centerOn(Math.floor((e.clientX - r.left) / r.width * MAP_W), Math.floor((e.clientY - r.top) / r.height * MAP_H)); });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', e => {
    if (!$('modal').hidden || !G) return;
    const k = e.key.toLowerCase();
    if (k === 'n' && !busy) nextArmy(); else if (k === 'e' && !busy) endTurn(); else if (k === 'escape') deselect();
    else if (k.startsWith('arrow')) { e.preventDefault(); cam.x += k === 'arrowleft' ? -TS * 2 : k === 'arrowright' ? TS * 2 : 0; cam.y += k === 'arrowup' ? -TS * 2 : k === 'arrowdown' ? TS * 2 : 0; clampCam(); }
  });
  async function endTurn() { if (busy || G.cur !== HUMAN) return; busy = true; sel = null; selCity = null; preview = null; refresh(); await runTurns(); }
  $('bEnd').addEventListener('click', endTurn);
  $('bNext').addEventListener('click', () => { if (!busy) nextArmy(); });
  $('bHelp').addEventListener('click', help);
  $('panel').addEventListener('click', e => {
    if (busy || !G) return;
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset, s = sel && stackById(sel.stackId);
    if (d.perk && s) { const h = s.units.find(u => u.id === +d.hero); if (h) applyPerk(h, d.perk); sel.dm = null; }
    else if (d.quest && s) {
      const h = s.units.find(u => u.id === +d.quest), q = h && offerQuest(s, h);
      if (q) { modal(`<h2>A quest for ${esc(h.hero.name)}</h2><p>${esc(q.text)}</p><p class="muted">Reward: ${QUEST_REWARDS[q.reward]}. A hero carries one quest at a time.</p><div class="row"><button type="button" class="primary" data-a="ok">Accept</button></div>`); waitClick('button[data-a]').then(closeModal); }
    }
    else if (d.unit && s) { const id = +d.unit; if (sel.ids.has(id)) sel.ids.delete(id); else sel.ids.add(id); sel.dm = null; }
    else if (d.spell && s) { const h = s.units.find(u => u.id === +d.hero); if (h && !castSpell(s, h, d.spell)) setHoverText('That spell cannot be cast now.'); if (d.spell === 'pack') selectStack(s); sel.dm = null; }
    else if (d.search && s) {
      const h = s.units.find(u => u.id === +d.search), r = h && searchRuin(s, h);
      if (r) { const more = G.notices.splice(0).filter(t => t !== r.text).map(t => `<p>${esc(t)}</p>`).join(''); modal(`<h2>${r.ok ? 'The ruin gives up its secret' : 'The ruin keeps its secret'}</h2><p>${esc(r.text)}</p>${more}<div class="row"><button type="button" class="primary" data-a="ok">Continue</button></div>`); waitClick('button[data-a]').then(closeModal); }
      const again = stackById(s.id); if (again) selectStack(again); else sel = null;
    }
    else if ('prod' in d) { const c = G.cities[+d.city]; if (!setProduction(c, d.prod || null)) setHoverText(`Not enough gold for ${UNITS[d.prod].name}.`); }
    else if (d.upgrade) upgradeCity(G.cities[+d.upgrade]);
    refresh();
  });

  /* ---------- boot ---------- */
  resize(); loop();
  if (location.search.includes('auto')) {
    AUTO = true; newGame(-1); HUMAN = 0; start(); window.__done = runTurns().then(() => ({ turn: G.turn, winner: G.winner }));
  } else title();
  window.__dbg = { get G() { return G; }, centerOn, screen: (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + x * TS + TS / 2 - cam.x, r.top + y * TS + TS / 2 - cam.y]; } };
})();
