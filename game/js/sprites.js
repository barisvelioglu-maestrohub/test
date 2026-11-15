'use strict';
/* Original pixel art, drawn in code: unit sprites from character grids, terrain and cities procedurally. */

const PAL = { k: '#1a1423', w: '#f2efe6', g: '#9aa0a8', d: '#5b6068', s: '#e2b48c', b: '#7a4e2a', B: '#4d2f18', y: '#e8c04a',
  r: '#c0392b', o: '#e67e22', n: '#5aa845', N: '#2f6b2b', u: '#3d7dd8', p: '#7d4fb3', e: '#d9d4b8', t: '#3aa39a' };

const ART = {
  levy: ['.....kk.....', '....kssk..g.', '....kssk..g.', '...kFFFFk.b.', '..kFFFFFFkb.', '..kFfFFfFsb.', '..ksFFFFk.b.', '...kFFFFk.b.', '...kbbbbk.b.', '...kb..bk...', '...kb..bk...', '..kkk..kkk..'],
  pike: ['.g...kkk....', '.g..kgggk...', '.g..kgssk...', '.g..kkssk...', '.b.kFFFFFk..', '.bskFFwwFFk.', '.b.kFwFFwFk.', '.b.kFFwwFFk.', '.b..kffffk..', '.b..kd..dk..', '.b..kd..dk..', '...kkk..kkk.'],
  archer: ['....kkk.....', '...kNNNk..k.', '...kssNk.kb.', '...kssk.k.b.', '..kFFFFk..b.', '.kFFFFFsyyb.', '.kFfFFFk..b.', '..kFFFFk.kb.', '..kbffbk..k.', '..kb..bk....', '..kb..bk....', '.kkk..kkk...'],
  rider: ['......kk....', '.....kggk...', '.....kssk...', '..kk.kFFk...', '.kbbkFFFFk..', 'kbbbbkFFkbk.', 'kbkbbbbbbbbk', '.k.kbbbbbbbk', '...kbbbbbbk.', '...kbk..kbk.', '...kbk..kbk.', '...kk...kk..'],
  warden: ['....kkkk....', '...kNNNNk...', '...kNssNk.k.', '...kNssk.kn.', '..kNNNNk.kn.', '.kNFFFNsttn.', '.kNFFFNk.kn.', '..kNFFNk.kn.', '..kNNNNk..k.', '..kn..nk....', '..kn..nk....', '.kkk..kkk...'],
  reaver: ['............', '..kk..kkkk..', '.kggk.kggk..', '.kggkkkssk..', '..kb.koook..', '..kbkFoooFk.', '..kskFFooFk.', '..kb.kFFFFk.', '..kb.kFffFk.', '.....kd..dk.', '....kkd..dkk', '....kkk..kkk'],
  wolf: ['............', '............', '.k.......kk.', 'kgk.....kggk', 'kggkkkkkgkgk', '.kgggggggggk', '.kggggggggk.', '.kgdggggdgk.', '.kgkkggkkgk.', '.kgk.kk.kgk.', '.kgk....kgk.', '.kk......kk.'],
  ram: ['............', '.kkkkkkkkkk.', 'kFFFFFFFFFFk', 'kFffFFFFffFk', '.kkkkkkkkkk.', 'kbbbbbbbbkgk', 'kBBBBBBBBkgk', 'kbbbbbbbbkgk', '.kkkkkkkkkk.', '.kddk..kddk.', '.kddk..kddk.', '..kk....kk..'],
  bearer: ['.kkkkkk.....', '.kFFFFFk....', '.kFyyFFk.kk.', '.kFFyFFkkssk', '.kFFFFk.kssk', '.kkkkk.kFFFk', '.b....kFFFFk', '.b....sFFFFk', '.b....kFffk.', '.b....kd.dk.', '.b....kd.dk.', '.....kkk.kkk'],
  gryphon: ['k.........k.', 'kw.......kwk', 'kwwk.kkk.kwk', 'kwwwkyyykwwk', '.kwwkyykywk.', '.kwwbbbbwwk.', '..kkbbbbkk..', '..kbbbbbbk..', '..kbbkkbbk..', '..kyk..kyk..', '..kyk..kyk..', '..kk....kk..'],
  troll: ['...kkkk.....', '..knnnnk..kk', '..knrnrk.kbk', '..knnnnk.kbk', '.knnnnnnkkbk', 'knnnNNnnnnbk', 'knnkNNknnkk.', 'knnkNNkk....', '.kkknnk.....', '..knkknk....', '..knk.knk...', '.kkk..kkk...'],
  drake: ['.....kk...k.', '....krrk.krk', '.kk.krykkrrk', 'krrkkrrkrrrk', 'krrrkrrrrrk.', '.krrrrrrrrk.', '..krroorrk..', '..krroorrkk.', '..krrrrrkrk.', '..krk.krkkrk', '..krk.krk.kk', '..kk..kk....'],
  champion: ['.....yy...w.', '....kyyk..w.', '...kggggk.w.', '...kgkkgk.w.', '...kggggk.w.', '..kFFFFFFkyk', '.kFFyFFyFFbk', '.kgFFyyFFgk.', '..kgFFFFgk..', '...kggggk...', '...kg..gk...', '..kkk..kkk..'],
  seer: ['.y...kk.....', 'yty.kppk....', '.y.kppppk...', '.b.kpsspk...', '.b.kwsswk...', '.bkpwwwwpk..', '.bspFwwFppk.', '.bkpFFFFpk..', '.b.kpFFpk...', '.b.kppppk...', '.b.kppppk...', '...kkkkkk...'],
};

const spriteCache = {};
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function unitSprite(type, owner) {
  const key = type + ':' + owner; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(12, 12), x = c.getContext('2d'), rows = ART[type];
  for (let r = 0; r < 12; r++) for (let q = 0; q < 12; q++) {
    const ch = (rows[r] || '')[q] || '.'; if (ch === '.') continue;
    x.fillStyle = ch === 'F' ? f.color : ch === 'f' ? f.dark : PAL[ch] || '#f0f'; x.fillRect(q, r, 1, 1);
  }
  return (spriteCache[key] = c);
}

/* Army token: the unit's figure on a bevelled plate in its owner's colours. */
function tokenSprite(type, owner) {
  const key = 'tok:' + type + ':' + owner; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(46, 48), x = c.getContext('2d');
  x.fillStyle = 'rgba(8,10,12,.45)'; x.beginPath(); x.ellipse(24, 43, 19, 5, 0, 0, 7); x.fill();
  const plate = (r, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(3 + r, 2); x.lineTo(43 - r, 2); x.quadraticCurveTo(43, 2, 43, 2 + r); x.lineTo(43, 30); x.quadraticCurveTo(43, 40, 23, 44); x.quadraticCurveTo(3, 40, 3, 30); x.lineTo(3, 2 + r); x.quadraticCurveTo(3, 2, 3 + r, 2); x.fill(); };
  plate(5, '#14110f');
  x.save(); x.translate(23, 23); x.scale(0.9, 0.9); x.translate(-23, -23);
  const g = x.createLinearGradient(0, 0, 46, 46); g.addColorStop(0, '#fff'); g.addColorStop(0.08, f.color); g.addColorStop(1, f.dark); plate(5, g);
  x.restore();
  x.save(); x.translate(23, 23); x.scale(0.78, 0.78); x.translate(-23, -23);
  const g2 = x.createLinearGradient(0, 0, 0, 46); g2.addColorStop(0, 'rgba(20,18,16,.62)'); g2.addColorStop(1, 'rgba(20,18,16,.38)'); plate(4, g2);
  x.restore();
  x.imageSmoothingEnabled = false; x.drawImage(unitSprite(type, owner), 8, 5, 30, 30);
  return (spriteCache[key] = c);
}

function citySprite(owner, level) {
  const key = 'city:' + owner + ':' + level; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(64, 64), x = c.getContext('2d'), ink = '#221d18';
  const stone = (x0, x1) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#e6dfcc'); g.addColorStop(0.55, '#c2baa5'); g.addColorStop(1, '#8a8371'); return g; };
  const box = (a, b, w, h) => { x.fillStyle = stone(a, a + w); x.fillRect(a, b, w, h); x.strokeStyle = ink; x.lineWidth = 1.5; x.strokeRect(a, b, w, h); };
  const cren = (a, b, w) => { for (let i = a; i < a + w - 2; i += 6) { x.fillStyle = stone(a, a + w); x.fillRect(i, b - 4, 4, 4); x.strokeStyle = ink; x.lineWidth = 1; x.strokeRect(i, b - 4, 4, 4); } };
  const roof = (cx, base, w, h) => {
    x.beginPath(); x.moveTo(cx - w / 2 - 2, base); x.lineTo(cx, base - h); x.lineTo(cx + w / 2 + 2, base); x.closePath(); x.fillStyle = f.color; x.fill();
    x.beginPath(); x.moveTo(cx, base - h); x.lineTo(cx + w / 2 + 2, base); x.lineTo(cx + 1, base); x.closePath(); x.fillStyle = f.dark; x.fill();
    x.beginPath(); x.moveTo(cx - w / 2 - 2, base); x.lineTo(cx, base - h); x.lineTo(cx + w / 2 + 2, base); x.closePath(); x.strokeStyle = ink; x.lineWidth = 1.5; x.stroke();
  };
  const slit = (a, b) => { x.fillStyle = ink; x.fillRect(a, b, 2, 5); };
  const flag = (px, top) => { x.strokeStyle = ink; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, top + 12); x.lineTo(px, top); x.stroke();
    x.beginPath(); x.moveTo(px, top); x.lineTo(px + 10, top + 3); x.lineTo(px, top + 6); x.closePath(); x.fillStyle = f.color; x.fill(); x.lineWidth = 1; x.stroke(); };
  x.fillStyle = 'rgba(8,10,12,.4)'; x.beginPath(); x.ellipse(34, 58, 29, 6, 0, 0, 7); x.fill();
  if (level >= 2) { box(22, 18, 20, 24); roof(32, 18, 20, level >= 3 ? 14 : 9); slit(27, 24); slit(35, 24); }
  if (level >= 3) flag(32, level >= 4 ? -2 : 0);
  box(10, 36, 44, 20); cren(10, 36, 44);
  if (level >= 4) { x.fillStyle = '#e8c04a'; x.fillRect(11, 41, 42, 2); }
  x.fillStyle = ink; x.beginPath(); x.moveTo(27, 56); x.lineTo(27, 47); x.arc(32, 47, 5, Math.PI, 0); x.lineTo(37, 56); x.closePath(); x.fill();
  x.strokeStyle = '#6b5a3c'; x.lineWidth = 1; for (let i = 29; i < 37; i += 3) { x.beginPath(); x.moveTo(i, 44); x.lineTo(i, 56); x.stroke(); }
  box(4, 28, 13, 29); roof(10.5, 28, 13, 11); slit(9, 36);
  box(47, 28, 13, 29); roof(53.5, 28, 13, 11); slit(52, 36);
  if (level >= 4) { flag(10.5, 6); flag(53.5, 6); }
  return (spriteCache[key] = c);
}

function ruinSprite(explored) {
  const key = 'ruin:' + explored; if (spriteCache[key]) return spriteCache[key];
  const c = mk(48, 48), x = c.getContext('2d'), ink = '#221d18';
  x.fillStyle = 'rgba(8,10,12,.4)'; x.beginPath(); x.ellipse(25, 41, 20, 5, 0, 0, 7); x.fill();
  const col = (a, top, w) => { const g = x.createLinearGradient(a, 0, a + w, 0); g.addColorStop(0, explored ? '#9d998d' : '#e2dccb'); g.addColorStop(1, explored ? '#55524a' : '#857f70');
    x.fillStyle = g; x.beginPath(); x.moveTo(a, 40); x.lineTo(a, top + 3); x.lineTo(a + w * 0.4, top); x.lineTo(a + w * 0.7, top + 4); x.lineTo(a + w, top + 1); x.lineTo(a + w, 40); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = g; x.fillRect(a - 2, 38, w + 4, 4); x.strokeRect(a - 2, 38, w + 4, 4); };
  col(7, 12, 8); col(21, 24, 7); col(33, 17, 8);
  x.fillStyle = explored ? '#6f6c62' : '#b9b3a2'; for (const [a, b, r] of [[18, 42, 3], [30, 43, 2.5], [14, 44, 2]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); x.stroke(); }
  if (!explored) { const g = x.createRadialGradient(25, 30, 0, 25, 30, 9); g.addColorStop(0, 'rgba(255,240,170,.95)'); g.addColorStop(1, 'rgba(255,210,80,0)'); x.fillStyle = g; x.fillRect(14, 19, 22, 22); }
  return (spriteCache[key] = c);
}

/* Paints the whole land once as a shaded relief map: per-pixel terrain blending, a height field lit from the north-west,
   then forests, reeds and roads drawn on top. */
function paintTerrain() {
  const W = MAP_W * TS, H = MAP_H * TS, c = mk(W, H), x = c.getContext('2d'), rng = mulberry32(MAP_SEED ^ 0x51ab);
  const nF = valueNoise(W, H, 3, rng), nM = valueNoise(W, H, 14, rng), nB = valueNoise(W, H, 64, rng), nR = valueNoise(W, H, 30, rng);
  const wX = valueNoise(W, H, 20, rng), wY = valueNoise(W, H, 20, rng);
  const TI = { g: 0, f: 1, h: 2, m: 3, w: 4, s: 5 }, tt = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let q = 0; q < MAP_W; q++) tt[y * MAP_W + q] = TI[MAP.t[y][q]];
  const hgt = new Float32Array(W * H), img = x.createImageData(W, H), d = img.data, wg = new Float32Array(6);
  const sm = t => t * t * (3 - 2 * t);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, u = px / TS - 0.5 + (wX[i] - 0.5) * 0.9, v = py / TS - 0.5 + (wY[i] - 0.5) * 0.9;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = sm(u - x0), fy = sm(v - y0);
    wg[0] = wg[1] = wg[2] = wg[3] = wg[4] = wg[5] = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const tx = Math.min(MAP_W - 1, Math.max(0, x0 + a)), ty = Math.min(MAP_H - 1, Math.max(0, y0 + b));
      wg[tt[ty * MAP_W + tx]] += (a ? fx : 1 - fx) * (b ? fy : 1 - fy);
    }
    const f = nF[i], m = nM[i], big = nB[i], ridge = 1 - Math.abs(2 * nR[i] - 1), water = wg[4];
    let r, g, bl;
    if (water > 0.5) {
      const dp = Math.min(1, (water - 0.5) * 2.4), wv = (m - 0.5) * 16 + (f - 0.5) * 8;
      r = 78 - 50 * dp + wv; g = 158 - 86 * dp + wv; bl = 176 - 44 * dp + wv;
      if (water < 0.56) { const k = 1 - (water - 0.5) / 0.06; r += (235 - r) * k * 0.7; g += (245 - g) * k * 0.7; bl += (250 - bl) * k * 0.7; }
      hgt[i] = -1;
    } else {
      const inv = 1 / (1 - water), a0 = wg[0] * inv, a1 = wg[1] * inv, a2 = wg[2] * inv, a3 = wg[3] * inv, a5 = wg[5] * inv;
      const gk = big * 0.7 + f * 0.3, mh = 0.26 + 0.40 * nR[i] + 0.24 * m + 0.10 * ridge, rk = f * 0.45 + nR[i] * 0.55;
      let mr = 108 + 44 * rk, mg = 102 + 44 * rk, mb = 96 + 40 * rk;
      if (mh > 0.7) { const k = Math.min(1, (mh - 0.7) * 9); mr += (240 - mr) * k; mg += (243 - mg) * k; mb += (248 - mb) * k; }
      const pud = f > 0.6 && m > 0.45;
      r = a0 * (74 + 36 * gk) + a1 * (50 + 14 * f) + a2 * (118 + 38 * m) + a3 * mr + a5 * (pud ? 50 : 84 + 20 * m);
      g = a0 * (128 + 30 * gk) + a1 * (94 + 16 * f) + a2 * (142 + 4 * m) + a3 * mg + a5 * (pud ? 84 : 108 + 12 * m);
      bl = a0 * (56 + 14 * gk) + a1 * (44 + 10 * f) + a2 * (72 + 20 * m) + a3 * mb + a5 * (pud ? 94 : 62 + 8 * m);
      if (water > 0.34) { const k = Math.min(1, (water - 0.34) / 0.1); r += (216 + 14 * f - r) * k; g += (198 + 12 * f - g) * k; bl += (142 + 10 * f - bl) * k; }
      hgt[i] = a0 * (0.10 + 0.02 * f) + a1 * (0.12 + 0.03 * f) + a5 * (0.07 + (pud ? -0.02 : 0.01 * f)) + a2 * (0.14 + 0.24 * m + 0.03 * f) + a3 * (mh + 0.04 * f);
    }
    const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
  }
  for (let py = 1; py < H - 1; py++) for (let px = 1; px < W - 1; px++) {
    const i = py * W + px, h = hgt[i]; if (h < 0) continue;
    const l = hgt[i - 1], rr = hgt[i + 1], up = hgt[i - W], dn = hgt[i + W];
    let s = 1 + ((rr < 0 ? h : rr) - (l < 0 ? h : l) + (dn < 0 ? h : dn) - (up < 0 ? h : up)) * 7;
    s = s < 0.5 ? 0.5 : s > 1.45 ? 1.45 : s;
    const o = i * 4; d[o] = Math.min(255, d[o] * s); d[o + 1] = Math.min(255, d[o + 1] * s); d[o + 2] = Math.min(255, d[o + 2] * s);
  }
  x.putImageData(img, 0, 0);

  // Roads: soft earthen tracks through tile centres; plank bridges over water.
  const isRoad = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && (MAP.road[ty][tx] || MAP.cityGrid[ty * MAP_W + tx] >= 0);
  const strokeRoads = (wantWater, width, style, dash) => {
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = width; x.strokeStyle = style; x.setLineDash(dash || []); x.beginPath();
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      if (!isRoad(tx, ty)) continue; const cx = tx * TS + 24, cy = ty * TS + 24;
      for (const [ox, oy] of [[1, 0], [0, 1]]) {
        if (!isRoad(tx + ox, ty + oy)) continue;
        const wet = MAP.t[ty][tx] === 'w' || MAP.t[ty + oy][tx + ox] === 'w'; if (wet !== wantWater) continue;
        x.moveTo(cx, cy); x.lineTo(cx + ox * TS, cy + oy * TS);
      }
    }
    x.stroke(); x.setLineDash([]);
  };
  strokeRoads(false, 9, 'rgba(70,52,28,.55)'); strokeRoads(false, 6, '#c8a971'); strokeRoads(false, 2, 'rgba(232,210,160,.7)', [5, 9]);
  x.lineCap = 'butt'; strokeRoads(true, 12, '#3b2816'); strokeRoads(true, 9, '#9a6c3a'); strokeRoads(true, 9, 'rgba(50,32,16,.6)', [1, 4]);

  // Forests and marsh reeds, drawn back to front.
  const things = [];
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = MAP.t[ty][tx], road = MAP.road[ty][tx];
    if (t === 'f') for (let k = 0; k < (road ? 5 : 11); k++) {
      const ax = tx * TS + rng() * TS, ay = ty * TS + rng() * TS;
      if (road && Math.min(Math.abs(ax - tx * TS - 24), Math.abs(ay - ty * TS - 24)) < 11) continue;
      things.push({ k: rng() < 0.3 ? 'pine' : 'tree', x: ax, y: ay, r: 6 + rng() * 4 });
    }
    if (t === 's' && !road) for (let k = 0; k < 6; k++) things.push({ k: 'reed', x: tx * TS + rng() * TS, y: ty * TS + rng() * TS, r: 4 + rng() * 4 });
    if (t === 'g' && !road && rng() < 0.12) things.push({ k: rng() < 0.5 ? 'tree' : 'pine', x: tx * TS + 8 + rng() * 32, y: ty * TS + 8 + rng() * 32, r: 5 + rng() * 3 });
  }
  things.sort((a, b) => a.y - b.y);
  for (const o of things) {
    if (o.k === 'reed') { x.strokeStyle = '#b7b560'; x.lineWidth = 1; for (let j = -1; j <= 1; j++) { x.beginPath(); x.moveTo(o.x + j * 2, o.y); x.lineTo(o.x + j * 3, o.y - o.r); x.stroke(); } x.fillStyle = '#6a4a2a'; x.fillRect(o.x - 1, o.y - o.r - 2, 2, 3); continue; }
    x.fillStyle = 'rgba(8,24,12,.33)'; x.beginPath(); x.ellipse(o.x + o.r * 0.5, o.y + o.r * 0.55, o.r, o.r * 0.55, 0, 0, 7); x.fill();
    if (o.k === 'pine') {
      for (let j = 0; j < 3; j++) { const w = o.r * (1 - j * 0.24), top = o.y - o.r * 1.5 - j * o.r * 0.5 + o.r;
        x.beginPath(); x.moveTo(o.x - w, top + o.r * 0.8); x.lineTo(o.x, top - o.r * 0.5); x.lineTo(o.x + w, top + o.r * 0.8); x.closePath(); x.fillStyle = '#1f4f2c'; x.fill();
        x.beginPath(); x.moveTo(o.x - w, top + o.r * 0.8); x.lineTo(o.x, top - o.r * 0.5); x.lineTo(o.x, top + o.r * 0.8); x.closePath(); x.fillStyle = '#3a7a3e'; x.fill(); }
    } else {
      const g = x.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.45, 1, o.x, o.y, o.r);
      g.addColorStop(0, '#86bf58'); g.addColorStop(0.55, '#3f8438'); g.addColorStop(1, '#1b4722');
      x.fillStyle = g; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill();
    }
  }
  return c;
}
