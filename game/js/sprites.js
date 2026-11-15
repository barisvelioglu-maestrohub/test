'use strict';
/* Original pixel art, drawn in code: unit sprites from character grids, terrain and cities procedurally. */

const INK = '#2b211a', WOOD = '#8a5a2b', STEEL = '#b9bec6', MAIL = '#8d9299', SKIN = '#e8bd95', BONE = '#f2efe6', GOLD = '#e8c04a';
const spriteCache = {};
function tone(hex, k) {
  if (hex[0] !== '#') return hex; const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/* Finishing pass for drawn art: pull the colours back and light the piece from the upper left. */
function finish(c, sat = 0.7) {
  const x = c.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; d[i] = l + (d[i] - l) * sat; d[i + 1] = l + (d[i + 1] - l) * sat; d[i + 2] = l + (d[i + 2] - l) * sat; }
  x.putImageData(im, 0, 0); x.globalCompositeOperation = 'source-atop';
  const g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, 'rgba(255,240,210,.20)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(18,10,2,.42)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height); x.restore(); return c;
}

/* Small drawing kit: every figure is laid out in a 64 x 64 box with inked outlines. */
function pen(x) {
  const g = { x };
  const vol = (fill, x0, x1) => (typeof fill === 'string' && fill.length === 7 && fill[0] === '#' ? g.grad(x0, x1, fill) : fill);
  g.P = (pts, fill, close = true) => { if (fill) { const xs = pts.map(q => q[0]); fill = vol(fill, Math.min(...xs), Math.max(...xs)); } x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); if (close) x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } x.stroke(); };
  g.C = (cx, cy, r, fill) => { if (fill) fill = vol(fill, cx - r, cx + r); x.beginPath(); x.arc(cx, cy, r, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } x.stroke(); };
  g.E = (cx, cy, rx, ry, fill, stroke = true) => { fill = vol(fill, cx - rx, cx + rx); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fillStyle = fill; x.fill(); if (stroke) x.stroke(); };
  g.L = (x1, y1, x2, y2, col, w = 2.5) => { x.save(); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.lineWidth = w + 1.6; x.strokeStyle = INK; x.stroke(); x.lineWidth = w; x.strokeStyle = col; x.stroke(); x.restore(); };
  g.dot = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  g.shade = pts => { x.save(); x.globalAlpha = 0.24; x.fillStyle = '#000'; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.fill(); x.restore(); };
  g.arm = (x1, y1, x2, y2, col, w = 5) => { g.L(x1, y1, x2, y2, col, w); g.C(x2, y2, 2.6, SKIN); };
  g.cap = (cx, cy, r, col) => { x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.closePath(); x.fillStyle = vol(col, cx - r, cx + r); x.fill(); x.stroke(); };
  g.eyes = (cx, cy) => { x.fillStyle = 'rgba(43,33,26,.8)'; x.fillRect(cx - 2.9, cy + 0.4, 1.2, 1.3); x.fillRect(cx + 1.7, cy + 0.4, 1.2, 1.3); };
  g.grad = (x0, x1, col) => { const q = x.createLinearGradient(x0, 0, x1, 0); q.addColorStop(0, tone(col, 0.3)); q.addColorStop(0.5, col); q.addColorStop(1, tone(col, -0.4)); return q; };
  g.limb = (x1, y1, x2, y2, w1, w2, col) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.P([[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]], g.grad(Math.min(x1, x2) - w1 / 2, Math.max(x1, x2) + w1 / 2, col));
  };
  g.mail = pts => { x.save(); x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.clip(); x.fillStyle = 'rgba(24,24,30,.42)';
    for (let r = 0; r < 64; r += 1.8) for (let q = (r / 1.8) % 2 ? 0.9 : 0; q < 64; q += 1.8) x.fillRect(q, r, 0.8, 0.8); x.restore(); };
  /* A standing figure with human proportions. Hooks: back (behind the body), head (headgear), mid (held behind the arms), front. */
  g.fig = o => {
    const cx = o.cx ?? 32, st = o.stout ? 1 : 0, hy = (o.hy ?? 11) + st * 5, sy = hy + 7, sw = o.sw ?? (st ? 9.5 : 7), wy = sy + (st ? 14 : 15), hem = o.hem ?? wy + 7, foot = 58;
    const skin = o.skin || SKIN, sl = o.sleeve || o.body, boots = o.boots || '#33261a';
    const aL = o.armL || [[cx - sw - 2.2, sy + 9], [cx - sw - 1.4, sy + 17]], aR = o.armR || [[cx + sw + 2.2, sy + 9], [cx + sw + 1.4, sy + 17]];
    const arm = (shx, a) => { g.limb(shx, sy + 1.8, a[0][0], a[0][1], 4.8, 4, sl); g.limb(a[0][0], a[0][1], a[1][0], a[1][1], 4, 3.2, o.fore || sl); g.C(a[1][0], a[1][1], 1.9, o.glove || skin); };
    if (o.cape) g.P([[cx - sw - 1, sy + 0.5], [cx + sw + 1, sy + 0.5], [cx + sw + 5.5, foot - 3], [cx - sw - 5.5, foot - 3]], g.grad(cx - sw - 5, cx + sw + 5, o.cape));
    if (o.back) o.back(cx, hy);
    if (!o.robe) for (const d of [-1, 1]) {
      g.limb(cx + d * 3, wy + 2, cx + d * 4, foot - 8, 5.4, 4.2, o.legs); g.limb(cx + d * 4, foot - 9, cx + d * 4.2, foot - 1, 4.4, 4, boots);
      g.P([[cx + d * 4.2 - 2.6, foot - 1.6], [cx + d * 4.2 + 2.6, foot - 1.6], [cx + d * 4.2 + 2.6 + d * 2, foot + 1.2], [cx + d * 4.2 - 2.6 + (d < 0 ? d * 2 : 0), foot + 1.2]], boots);
    }
    const flare = o.robe ? sw + 3.5 : sw - 0.3, body = [[cx - sw, sy], [cx + sw, sy], [cx + sw - 1.6, wy], [cx + flare, hem], [cx - flare, hem], [cx - sw + 1.6, wy]];
    g.P(body, g.grad(cx - sw - 1, cx + sw + 1, o.body)); if (o.mailTex) { g.mail(body); g.P(body, null); }
    if (o.tabard) g.P([[cx - 3.6, sy], [cx + 3.6, sy], [cx + 4.2, hem + (o.tabLen || 0)], [cx - 4.2, hem + (o.tabLen || 0)]], g.grad(cx - 5, cx + 5, o.tabard));
    if (o.belt) { x.fillStyle = o.belt; x.fillRect(cx - sw + 1.5, wy - 1.2, 2 * sw - 3, 2.4); x.fillStyle = GOLD; x.fillRect(cx - 1.2, wy - 1.2, 2.4, 2.4); }
    x.fillStyle = tone(skin, -0.25); x.fillRect(cx - 1.8, sy - 2.6, 3.6, 3);
    const hg = x.createRadialGradient(cx - 1.5, hy - 1.5, 0.5, cx, hy, 4.6); hg.addColorStop(0, tone(skin, 0.2)); hg.addColorStop(1, tone(skin, -0.22));
    g.C(cx, hy, 4.4, hg); x.fillStyle = 'rgba(43,33,26,.85)'; x.fillRect(cx - 2.2, hy + 0.1, 1, 1); x.fillRect(cx + 1.2, hy + 0.1, 1, 1);
    if (o.head) o.head(cx, hy);
    if (o.mid) o.mid(cx, hy);
    arm(cx - sw + 0.6, aL); arm(cx + sw - 0.6, aR);
    if (o.front) o.front(cx, hy);
  };
  g.kettle = (cx, hy) => { g.cap(cx, hy - 1, 4.9, g.grad(cx - 5, cx + 5, STEEL)); g.P([[cx - 7.2, hy - 1.2], [cx + 7.2, hy - 1.2], [cx + 6, hy + 0.8], [cx - 6, hy + 0.8]], g.grad(cx - 7, cx + 7, STEEL)); };
  g.nasal = (cx, hy) => { g.cap(cx, hy - 0.2, 4.9, g.grad(cx - 5, cx + 5, STEEL)); x.fillStyle = tone(STEEL, -0.3); x.fillRect(cx - 0.8, hy - 0.4, 1.6, 4.2); };
  g.hood = (cx, hy, col) => g.P([[cx - 5.6, hy + 4.4], [cx - 5.2, hy - 3], [cx, hy - 6.6], [cx + 5.2, hy - 3], [cx + 5.6, hy + 4.4], [cx + 3.3, hy - 1.4], [cx, hy - 3], [cx - 3.3, hy - 1.4]], g.grad(cx - 6, cx + 6, col));
  g.shield = (pts, col) => { const xs = pts.map(q => q[0]); g.P(pts, g.grad(Math.min(...xs), Math.max(...xs), col)); };
  g.bow = (bx, dir, col, hand) => {
    x.save(); x.beginPath(); x.moveTo(bx, 7); x.quadraticCurveTo(bx + dir * 10, 26, bx, 45); x.lineWidth = 3.4; x.strokeStyle = INK; x.stroke(); x.lineWidth = 2; x.strokeStyle = col; x.stroke();
    x.lineWidth = 0.7; x.strokeStyle = '#e9e2cc'; x.beginPath(); x.moveTo(bx, 7); x.lineTo(hand[0], hand[1]); x.lineTo(bx, 45); x.stroke(); x.restore();
    g.L(hand[0], hand[1], bx + dir * 9, hand[1], '#c9b48a', 0.9); g.P([[bx + dir * 9, hand[1] - 1.6], [bx + dir * 12.5, hand[1]], [bx + dir * 9, hand[1] + 1.6]], STEEL);
  };
  g.horse = (col, mane, cloth) => {
    g.P([[13, 35], [5, 40], [7, 55], [12, 46]], mane);
    for (const lx of [14, 22, 37, 44]) { g.P([[lx, 43], [lx + 4.4, 43], [lx + 3.8, 57], [lx + 0.6, 57]], tone(col, -0.2)); g.P([[lx, 56.5], [lx + 4.6, 56.5], [lx + 4.9, 59.6], [lx - 0.3, 59.6]], '#2a1c12'); }
    g.E(30, 40, 17.5, 9, col); g.P([[40, 37], [47, 22], [55, 24], [49, 43]], col);
    g.P([[46, 20], [57, 18], [63, 27], [59, 31], [50, 29]], col); g.P([[48, 20], [49, 13], [53, 19]], col);
    g.P([[41, 34], [46, 21], [43, 21], [38, 32]], mane); g.dot(56, 22.5, 1.1, INK);
    if (cloth) g.P(cloth.pts || [[21, 32], [37, 32], [38, 45], [20, 45]], cloth.col || cloth);
  };
  g.seat = o => {
    g.limb(29, 33, 31.5, 46, 5, 4, o.legs || '#4f4a44'); g.P([[29, 45], [35, 45], [35.5, 48], [29, 48]], '#33261a');
    const body = [[23.5, 18], [34.5, 18], [33.5, 34], [24.5, 34]]; g.P(body, o.body); if (o.mailTex) { g.mail(body); g.P(body, null); }
    if (o.tabard) g.P([[26.6, 18], [31.4, 18], [31.6, 34], [26.4, 34]], o.tabard);
    g.C(29, 12.5, 4.3, SKIN); x.fillStyle = 'rgba(43,33,26,.85)'; x.fillRect(29.6, 12.4, 1, 1); x.fillRect(32, 12.4, 1, 1);
    if (o.head) o.head(29, 12.5);
  };
  g.brute = o => {
    g.P([[19, 44], [30, 44], [30, 59], [17, 59]], tone(o.skin, -0.15)); g.P([[34, 44], [45, 44], [47, 59], [34, 59]], tone(o.skin, -0.15));
    g.E(32, 34, 16.5, 14, o.skin); g.E(31, 38, 9, 8, o.belly, false);
    g.P([[19, 43], [45, 43], [41, 53], [32, 49], [23, 53]], o.cloth);
    g.arm(17, 29, 10, 47, o.skin, 7); g.arm(47, 29, 52, 40, o.skin, 7); g.C(10, 47, 3, o.skin); g.C(52, 40, 3, o.skin);
    if (o.ears) { g.P([[24, 14], [18, 10], [23, 19]], o.skin); g.P([[40, 14], [46, 10], [41, 19]], o.skin); }
    g.C(32, 16, o.head || 8, o.skin); g.L(27.5, 13.4, 36.5, 13.4, tone(o.skin, -0.4), 1.2); g.dot(29, 15.6, 1.1, o.eye); g.dot(35, 15.6, 1.1, o.eye);
  };
  g.wyrm = o => {
    g.P([[26, 32], [9, 3], [21, 12], [30, 1], [34, 14], [45, 6], [41, 32]], o.wing);
    g.L(27, 30, 21, 12, tone(o.wing, -0.4), 1); g.L(31, 30, 34, 14, tone(o.wing, -0.4), 1);
    g.P([[16, 45], [1, 51], [4, 42], [14, 36]], o.body);
    g.P([[17, 46], [25, 46], [26, 59], [16, 59]], tone(o.body, -0.2)); g.P([[33, 46], [41, 46], [42, 59], [32, 59]], tone(o.body, -0.2));
    g.E(28, 42, 16.5, 10, o.body); g.E(28, 47.5, 11, 3.6, o.belly, false);
    g.P([[36, 39], [42, 18], [52, 16], [49, 41]], o.body); g.P([[39.5, 26], [36, 22], [41, 21]], BONE); g.P([[38, 33], [34, 30], [39, 28]], BONE);
    g.P([[43, 10], [56, 9], [63.5, 18], [58, 23.5], [45, 22]], o.body); g.P([[45, 11], [39, 2], [50, 9]], BONE);
    g.dot(53, 14.5, 1.6, '#f3cf5b'); g.dot(53.3, 14.5, 0.7, INK); g.dot(60.5, 18, 0.8, INK);
    g.P([[37.5, 33], [49.5, 30.5], [49.5, 36], [37, 38.5]], o.band);
  };
  g.man = o => {
    const cx = o.cx ?? 32, w = o.w ?? 9, top = o.top ?? 25, hip = o.hip ?? 44, foot = 58;
    g.P([[cx - w + 2, hip - 1], [cx - 1, hip - 1], [cx - 2, foot], [cx - w, foot]], o.legs);
    g.P([[cx + 1, hip - 1], [cx + w - 2, hip - 1], [cx + w, foot], [cx + 2, foot]], o.legs);
    g.P([[cx - w - 1, foot - 3], [cx - 1, foot - 3], [cx - 1, foot + 1], [cx - w - 2, foot + 1]], '#3a2a1c');
    g.P([[cx + 1, foot - 3], [cx + w + 1, foot - 3], [cx + w + 2, foot + 1], [cx + 1, foot + 1]], '#3a2a1c');
    g.P([[cx - w, top], [cx + w, top], [cx + w - 1, hip + 2], [cx - w + 1, hip + 2]], o.body);
    if (o.tabard) g.P([[cx - 5, top], [cx + 5, top], [cx + 4, hip + 3], [cx - 4, hip + 3]], o.tabard);
    g.shade([[cx + 2, top + 1], [cx + w - 1, top + 1], [cx + w - 2, hip + 1], [cx + 2, hip + 1]]);
    if (o.belt) { x.fillStyle = o.belt; x.fillRect(cx - w + 1.5, hip - 4, 2 * w - 3, 3); }
    g.C(cx, top - 7, 6.5, o.skin || SKIN); g.eyes(cx, top - 8);
  };
  return g;
}

const DRAW = {
  levy(g, f) {
    g.fig({ body: f.color, legs: '#6a5536', belt: '#33261a', hem: 41, armR: [[43, 27], [45.5, 31]],
      head: (cx, hy) => g.cap(cx, hy - 0.8, 4.7, '#4a3018'),
      mid: () => { g.L(45.5, 7, 45.5, 59, WOOD, 1.7); g.P([[45.5, 0], [48, 8], [43, 8]], g.grad(43, 48, STEEL)); },
      front: () => { g.shield([[14, 24], [24, 22], [26, 33], [20, 39], [13, 34]], '#7a5632'); g.C(19.5, 30, 2, STEEL); } });
  },
  pike(g, f) {
    g.fig({ body: MAIL, mailTex: true, tabard: f.color, legs: '#4f4a44', hem: 41, belt: '#33261a', armL: [[22, 26], [18.5, 30]],
      head: (cx, hy) => g.kettle(cx, hy),
      mid: () => { g.L(18.5, 9, 18.5, 59, WOOD, 1.7); g.P([[18.5, 0], [21, 10], [16, 10]], g.grad(16, 21, STEEL)); },
      front: () => { g.shield([[35, 20], [50, 20], [50, 31], [42.5, 44], [35, 31]], f.color); g.L(38.5, 25, 42.5, 30, BONE, 1.3); g.L(42.5, 30, 46.5, 25, BONE, 1.3); } });
  },
  archer(g, f) {
    g.fig({ body: f.color, legs: '#4a4a30', belt: '#33261a', hem: 40, armR: [[43, 23], [48, 24]], armL: [[25, 25], [38, 24]],
      back: () => { g.P([[21, 14], [25.5, 14], [24.5, 31], [21.8, 31]], g.grad(21, 26, '#6b4424')); g.L(22.3, 14, 21.5, 9, BONE, 0.9); g.L(24.5, 14, 25.2, 8.5, BONE, 0.9); },
      head: (cx, hy) => { g.cap(cx, hy - 0.9, 4.8, '#3f5f34'); g.P([[cx - 5.5, hy - 1], [cx + 6.5, hy - 1], [cx + 8, hy + 0.4], [cx - 5, hy + 0.4]], '#3f5f34'); g.L(cx + 2, hy - 4, cx + 6.5, hy - 9, GOLD, 1.1); },
      mid: () => g.bow(49, 1, WOOD, [38, 24]) });
  },
  warden(g, f) {
    g.fig({ cape: '#2d4a30', body: f.color, legs: '#3d3a2a', belt: '#2a2118', hem: 40, sw: 6.5, armL: [[21, 23], [16, 24]], armR: [[39, 25], [26, 24]],
      head: (cx, hy) => g.hood(cx, hy, '#2d4a30'),
      mid: () => g.bow(15, -1, '#3aa39a', [26, 24]) });
  },
  reaver(g, f) {
    g.fig({ stout: true, body: MAIL, mailTex: true, tabard: f.color, legs: '#4a3828', belt: '#2a2118', armR: [[45, 33], [43, 39]], armL: [[19, 34], [27, 42]],
      head: (cx, hy) => {
        g.P([[cx - 3.5, hy - 3], [cx - 9, hy - 9], [cx - 4.6, hy - 0.5]], BONE); g.P([[cx + 3.5, hy - 3], [cx + 9, hy - 9], [cx + 4.6, hy - 0.5]], BONE); g.nasal(cx, hy);
        g.P([[cx - 4.2, hy + 1.6], [cx + 4.2, hy + 1.6], [cx + 3.2, hy + 9], [cx, hy + 12.5], [cx - 3.2, hy + 9]], g.grad(cx - 4, cx + 4, '#c9662a')); g.L(cx, hy + 6, cx, hy + 11, '#8a4218', 0.8);
      },
      mid: () => { g.L(24, 46, 51, 13, WOOD, 2.2); g.P([[47, 9], [57, 4], [61, 15], [53, 20]], g.grad(47, 61, STEEL)); g.P([[49, 16], [44, 22], [42, 14]], g.grad(42, 49, STEEL)); } });
  },
  bearer(g, f) {
    g.L(22, 3, 22, 60, WOOD, 1.8); g.C(22, 2.2, 1.8, GOLD);
    g.P([[22, 4], [2.5, 4], [8, 11.5], [2.5, 19], [22, 19]], g.grad(2, 22, f.color)); g.C(14, 11.5, 3.4, GOLD); g.L(22, 19.2, 3, 19.2, f.dark, 0.9);
    g.fig({ cx: 38, body: MAIL, mailTex: true, tabard: f.color, legs: '#4f4a44', belt: '#33261a', hem: 41, armL: [[26.5, 27], [22, 30]],
      head: (cx, hy) => g.nasal(cx, hy) });
  },
  champion(g, f) {
    g.fig({ cape: f.color, body: STEEL, sleeve: STEEL, legs: MAIL, boots: '#5b6068', glove: MAIL, tabard: f.color, tabLen: 3, hem: 39, armR: [[45, 24], [47, 18]], armL: [[22, 27], [21, 31]],
      head: (cx, hy) => {
        g.P([[cx - 4.8, hy - 5], [cx + 4.8, hy - 5], [cx + 4.3, hy + 4.8], [cx - 4.3, hy + 4.8]], g.grad(cx - 5, cx + 5, '#c9ced6'));
        g.x.fillStyle = INK; g.x.fillRect(cx - 3.5, hy - 1, 7, 1.4); g.x.fillRect(cx - 0.6, hy + 0.4, 1.2, 3.4);
        g.P([[cx - 4.8, hy - 5], [cx - 4.2, hy - 9.5], [cx - 2, hy - 6.6], [cx, hy - 10.5], [cx + 2, hy - 6.6], [cx + 4.2, hy - 9.5], [cx + 4.8, hy - 5]], GOLD);
      },
      mid: () => { g.L(47.2, 17, 48.8, 0.5, '#e6eaef', 2); g.L(44, 17.8, 50.6, 16.6, GOLD, 1.5); g.C(25, 19.5, 3, g.grad(22, 28, STEEL)); g.C(39, 19.5, 3, g.grad(36, 42, STEEL)); },
      front: () => { g.shield([[12, 21], [27, 21], [27, 31], [19.5, 42], [12, 31]], f.color); g.L(19.5, 23, 19.5, 38, GOLD, 1.3); g.L(14.5, 28, 24.5, 28, GOLD, 1.3); } });
  },
  seer(g, f) {
    const x = g.x; g.L(17.5, 10, 17.5, 60, WOOD, 1.7);
    const gl = x.createRadialGradient(17.5, 6, 0, 17.5, 6, 11); gl.addColorStop(0, 'rgba(150,255,240,.9)'); gl.addColorStop(1, 'rgba(150,255,240,0)'); x.fillStyle = gl; x.fillRect(6, -5, 23, 23);
    g.C(17.5, 6, 3.4, '#8ff0e2');
    g.fig({ robe: true, hem: 58, body: '#5d4d7c', tabard: f.color, armL: [[22, 27], [17.5, 31]], armR: [[43, 27], [44, 35]],
      head: (cx, hy) => {
        g.P([[cx - 3.6, hy + 1.8], [cx + 3.6, hy + 1.8], [cx + 3, hy + 11], [cx, hy + 16], [cx - 3, hy + 11]], g.grad(cx - 4, cx + 4, BONE));
        g.P([[cx - 7.5, hy - 2], [cx + 7.5, hy - 2], [cx + 3, hy - 4.6], [cx - 0.5, hy - 16], [cx - 3.4, hy - 4.6]], g.grad(cx - 7, cx + 7, '#5d4d7c')); g.L(cx - 3.2, hy - 4, cx + 2.8, hy - 4, f.color, 1.3);
      } });
  },
  rider(g, f) {
    g.horse('#8a5a32', '#3a2416', f.color); g.L(18, 31, 61, 3, WOOD, 1.8); g.P([[52, 9], [41, 5], [45, 15]], f.color);
    g.seat({ body: MAIL, mailTex: true, tabard: f.color, head: (cx, hy) => g.nasal(cx, hy) }); g.arm(33, 21, 38, 23, MAIL, 4);
  },
  wolf(g, f) {
    g.P([[11, 34], [1, 27], [6, 41]], '#7c828a');
    for (const lx of [13, 20, 37, 43]) g.P([[lx, 42], [lx + 5, 42], [lx + 5.5, 59], [lx + 0.5, 59]], '#6a7078');
    g.E(28, 38, 17.5, 9.5, '#9aa0a8'); g.E(28, 43, 12, 4, '#c5cad0', false);
    g.P([[39, 30], [46, 21], [53, 25], [63, 33], [59, 39], [46, 41]], '#9aa0a8'); g.P([[44, 24], [45, 13], [51, 23]], '#7c828a');
    g.P([[52, 37.5], [54, 41], [56, 38]], BONE, true); g.dot(61.5, 33.5, 1.9, INK); g.dot(52.5, 29.5, 1.8, '#f3cf5b'); g.dot(52.8, 29.5, 0.8, INK);
    g.P([[39.5, 30], [44, 28.5], [46.5, 40.5], [42, 41]], f.color);
  },
  gryphon(g, f) {
    g.P([[27, 36], [4, 5], [13, 10], [15, 2], [22, 10], [26, 1], [31, 13], [38, 30]], '#e9e4d6');
    g.L(27, 34, 13, 11, '#a9a392', 1.2); g.L(30, 32, 22, 11, '#a9a392', 1.2); g.L(33, 30, 30, 14, '#a9a392', 1.2);
    g.L(14, 42, 6, 50, '#c99a52', 3); g.C(5, 51, 3.2, '#8a5a2b');
    g.P([[17, 45], [23, 45], [23.5, 59], [16.5, 59]], '#b58842'); g.P([[35, 45], [41, 45], [42, 59], [34, 59]], GOLD);
    g.E(28, 42, 15.5, 8.5, '#c99a52');
    g.P([[35, 46], [37, 27], [47, 21], [53, 34], [47, 47]], BONE); g.C(49, 20, 7.2, BONE);
    g.P([[54, 16.5], [63.5, 22.5], [54, 26]], GOLD); g.dot(51, 18.5, 1.6, INK); g.P([[44, 15], [41, 8], [47, 13]], BONE);
    g.P([[36.5, 38], [51.5, 35.5], [50.5, 41], [36.5, 43.5]], f.color);
  },
  troll(g, f) {
    g.L(53, 16, 51, 40, '#6b4a2a', 5); g.C(53.5, 10, 6.5, '#7a5632'); g.dot(51, 8, 1.3, '#4d3520'); g.dot(56, 12, 1.3, '#4d3520');
    g.brute({ skin: '#5a9a48', belly: '#7cb663', cloth: f.color, ears: true, eye: '#e8c04a' });
    g.P([[27, 22], [26, 15.5], [29.5, 21]], BONE); g.P([[37, 22], [38, 15.5], [34.5, 21]], BONE);
  },
  drake(g, f) { g.wyrm({ body: '#b5382b', wing: '#8f2418', belly: '#e8a23a', band: f.color }); },
  ram(g, f) {
    g.P([[38, 33], [63, 33], [63, 43], [38, 43]], '#6b4a2a'); g.P([[57, 31], [64, 34.5], [64, 41.5], [57, 45]], MAIL);
    g.P([[6, 30], [56, 30], [56, 47], [6, 47]], WOOD); g.L(6, 38.5, 56, 38.5, '#5e3d1c', 1.2);
    g.P([[2, 30], [13, 13], [47, 13], [60, 30]], f.color); g.shade([[31, 14], [47, 14], [59, 29.5], [31, 29.5]]);
    g.L(22, 13, 18, 30, f.dark, 1.3); g.L(38, 13, 41, 30, f.dark, 1.3);
    for (const wx of [17, 45]) { g.C(wx, 51, 7.5, '#5a4028'); g.C(wx, 51, 2.4, MAIL); }
  },
  crossbow(g, f) {
    g.fig({ body: '#5a4634', tabard: f.color, legs: '#4f4a44', belt: '#33261a', hem: 41, armR: [[42, 26], [44, 27]], armL: [[24, 27], [36, 27.5]],
      head: (cx, hy) => g.kettle(cx, hy),
      mid: () => { g.L(33, 27, 51, 26, WOOD, 2.2); const x = g.x; x.save(); x.beginPath(); x.moveTo(50, 17); x.quadraticCurveTo(57, 26, 50, 35); x.lineWidth = 3; x.strokeStyle = INK; x.stroke(); x.lineWidth = 1.7; x.strokeStyle = STEEL; x.stroke(); x.restore(); g.L(50, 17, 50, 35, '#e9e2cc', 0.6); } });
  },
  shieldwall(g, f) {
    g.fig({ body: MAIL, mailTex: true, tabard: f.color, legs: '#4f4a44', hem: 41, armR: [[44, 26], [47, 22]],
      head: (cx, hy) => g.nasal(cx, hy),
      mid: () => { g.L(47, 22, 49, 7, '#e6eaef', 1.8); g.L(45, 22.6, 49.4, 21.6, GOLD, 1.2); },
      front: () => { g.shield([[14, 17], [31, 17], [31, 46], [22.5, 51], [14, 46]], f.color); g.L(22.5, 19, 22.5, 48, f.dark, 1.2); g.C(22.5, 31, 3, STEEL); } });
  },
  halberd(g, f) {
    g.fig({ body: STEEL, sleeve: MAIL, legs: '#4f4a44', boots: '#5b6068', tabard: f.color, tabLen: 2, hem: 39, armR: [[43, 27], [45.5, 30]],
      head: (cx, hy) => { g.cap(cx, hy - 0.4, 5, STEEL); g.P([[cx - 1, hy - 5], [cx + 1, hy - 12], [cx + 6, hy - 9], [cx + 2.5, hy - 5]], f.color); },
      mid: () => { g.L(45.5, 8, 45.5, 59, WOOD, 1.8); g.P([[45.5, 0], [47.5, 9], [43.5, 9]], STEEL); g.P([[46.5, 9], [55, 7], [56, 17], [46.5, 19]], STEEL); g.P([[44.5, 12], [39, 14], [44.5, 16]], STEEL); } });
  },
  chaplain(g, f) {
    g.L(18, 8, 18, 60, WOOD, 1.6); g.C(18, 6.5, 5, GOLD); g.C(18, 6.5, 2.2, f.color);
    g.fig({ robe: true, hem: 58, body: '#d9d2bf', tabard: f.color, armL: [[22, 27], [18, 31]], armR: [[43, 27], [41, 34]],
      head: (cx, hy) => { const x = g.x; x.save(); x.beginPath(); x.arc(cx, hy - 0.4, 4.7, Math.PI * 0.95, Math.PI * 2.05); x.lineWidth = 2; x.strokeStyle = '#5a3b1e'; x.stroke(); x.restore(); } });
  },
  bones(g, f) {
    g.fig({ skin: '#e6dfc8', body: '#5a5148', legs: '#d9d2ba', boots: '#4a4238', tabard: f.dark, hem: 40, sw: 6.5, armR: [[43, 26], [46, 21]],
      head: (cx, hy) => { g.cap(cx, hy - 1.2, 4.8, '#7a6a52'); g.x.fillStyle = INK; g.x.fillRect(cx - 2.6, hy - 0.4, 1.9, 1.9); g.x.fillRect(cx + 0.8, hy - 0.4, 1.9, 1.9); g.x.fillRect(cx - 2, hy + 2.6, 4, 0.8); },
      mid: () => { g.L(46, 21, 48.5, 5, '#a59a84', 1.8); g.L(44, 21.6, 48.4, 20.4, '#7a6a52', 1.2); },
      front: () => { g.C(20, 31, 7.5, '#6b5a40'); g.C(20, 31, 2.3, '#a59a84'); g.L(14.5, 26, 25.5, 36, '#4a3d2a', 0.8); } });
  },
  wraith(g, f) {
    const x = g.x, gl = x.createRadialGradient(32, 30, 4, 32, 30, 30); gl.addColorStop(0, 'rgba(170,240,230,.45)'); gl.addColorStop(1, 'rgba(170,240,230,0)'); x.fillStyle = gl; x.fillRect(0, 0, 64, 64);
    g.P([[22, 20], [42, 20], [47, 44], [44, 58], [39, 52], [35, 60], [31, 53], [27, 60], [23, 52], [19, 58], [17, 44]], '#3d3a55');
    g.P([[28, 20], [36, 20], [37, 50], [32, 55], [27, 50]], f.color);
    g.limb(23, 23, 14, 30, 4.5, 3.5, '#3d3a55'); g.limb(14, 30, 9, 24, 3.5, 2.5, '#3d3a55'); g.limb(41, 23, 50, 30, 4.5, 3.5, '#3d3a55'); g.limb(50, 30, 55, 24, 3.5, 2.5, '#3d3a55');
    g.C(8.5, 23, 2.2, '#bfe8e0'); g.C(55.5, 23, 2.2, '#bfe8e0');
    g.C(32, 13, 4.6, '#17131f'); g.hood(32, 13, '#3d3a55'); g.dot(30.3, 13.4, 1, '#8ff0e2'); g.dot(33.7, 13.4, 1, '#8ff0e2');
  },
  scout(g, f) {
    g.horse('#a8845a', '#5a4026'); g.seat({ body: f.color, legs: '#6a5536', head: (cx, hy) => g.cap(cx, hy - 0.8, 4.6, '#4a3018') });
    g.L(37, 22, 46, 6, WOOD, 1.5); g.P([[46.6, 1], [48.6, 7.5], [44, 6.5]], STEEL); g.arm(33, 21, 37.5, 23, f.color, 4);
  },
  harcher(g, f) {
    g.horse('#4a3a30', '#1f1712'); g.seat({ body: f.color, legs: '#5a4634', head: (cx, hy) => { g.cap(cx, hy - 0.6, 5, '#6b4a2a'); g.P([[cx - 5.6, hy - 1], [cx + 5.6, hy - 1], [cx + 5, hy + 0.8], [cx - 5, hy + 0.8]], '#8a6a44'); } });
    const x = g.x; x.save(); x.beginPath(); x.moveTo(41, 9); x.quadraticCurveTo(48, 21, 41, 33); x.lineWidth = 3; x.strokeStyle = INK; x.stroke(); x.lineWidth = 1.7; x.strokeStyle = WOOD; x.stroke(); x.restore();
    g.L(41, 9, 34, 21, '#e9e2cc', 0.6); g.L(34, 21, 41, 33, '#e9e2cc', 0.6); g.L(34, 21, 49, 21, '#c9b48a', 0.9); g.arm(33, 21, 41.5, 21, f.color, 4);
  },
  knight(g, f) {
    g.horse('#cfc9bd', '#8d877a', { pts: [[13, 31], [45, 31], [47, 48], [40, 46], [32, 49], [24, 46], [12, 48]], col: f.color });
    g.P([[45, 21], [57, 18], [61, 25], [50, 28]], f.color); g.L(15, 33, 62, 2, WOOD, 2.2); g.P([[53, 9], [41, 4], [45, 16]], f.color);
    g.seat({ body: STEEL, legs: MAIL, tabard: f.color, head: (cx, hy) => {
      g.P([[cx - 4.6, hy - 5], [cx + 4.6, hy - 5], [cx + 4.2, hy + 4.6], [cx - 4.2, hy + 4.6]], '#c9ced6'); g.x.fillStyle = INK; g.x.fillRect(cx - 2, hy - 1, 6, 1.3);
      g.P([[cx - 2, hy - 5], [cx - 4, hy - 13], [cx + 2, hy - 9.5], [cx + 3, hy - 5]], GOLD); } });
    g.shield([[19, 22], [29, 22], [29, 30], [24, 37], [19, 30]], f.color); g.C(24, 27.5, 1.8, GOLD);
  },
  treant(g, f) {
    for (const [a, b, r] of [[20, 13, 9], [44, 13, 9], [32, 8, 10], [12, 22, 6], [52, 22, 6]]) g.C(a, b, r, '#3f6b33');
    for (const [a, b, r] of [[26, 10, 5], [38, 12, 5], [32, 5, 4]]) g.dot(a, b, r, '#5f8f45');
    g.limb(24, 28, 11, 24, 6, 3.5, '#6b4a2a'); g.limb(40, 28, 53, 24, 6, 3.5, '#6b4a2a'); g.limb(11, 24, 6, 32, 3, 2, '#6b4a2a'); g.limb(53, 24, 58, 32, 3, 2, '#6b4a2a');
    g.P([[23, 18], [41, 18], [43, 44], [48, 59], [38, 56], [32, 60], [26, 56], [16, 59], [21, 44]], '#7a5632');
    g.L(27, 24, 26, 52, '#4d3520', 0.9); g.L(37, 24, 38, 52, '#4d3520', 0.9); g.L(32, 40, 32, 56, '#4d3520', 0.9);
    g.dot(28, 28, 2, '#1f1509'); g.dot(36, 28, 2, '#1f1509'); g.dot(28.3, 27.6, 0.8, '#d9c04a'); g.dot(36.3, 27.6, 0.8, '#d9c04a'); g.P([[28, 35], [36, 35], [34, 38.5], [30, 38.5]], '#1f1509');
    g.P([[22, 43.5], [42, 43.5], [42.6, 47.5], [21.4, 47.5]], f.color);
  },
  giant(g, f) {
    g.C(53, 12, 8, '#8d877c'); g.L(49, 9, 55, 14, '#5f5a52', 0.9); g.L(55, 8, 57, 15, '#5f5a52', 0.9);
    g.brute({ skin: '#9a958a', belly: '#b5b0a4', cloth: f.color, eye: '#2b211a', head: 6.5 });
    g.L(24, 30, 29, 36, '#6f6a60', 0.9); g.L(38, 27, 35, 33, '#6f6a60', 0.9); g.L(30, 40, 34, 44, '#6f6a60', 0.9);
    g.P([[26.5, 20], [37.5, 20], [35.5, 25], [28.5, 25]], '#6f6a60');
  },
  elemental(g, f) {
    const x = g.x, gl = x.createRadialGradient(32, 34, 4, 32, 34, 30); gl.addColorStop(0, 'rgba(255,190,80,.55)'); gl.addColorStop(1, 'rgba(255,190,80,0)'); x.fillStyle = gl; x.fillRect(0, 0, 64, 64);
    g.P([[32, 2], [40, 14], [38, 20], [47, 16], [48, 34], [54, 30], [50, 50], [40, 59], [24, 59], [14, 50], [10, 30], [16, 34], [17, 16], [26, 20], [24, 12]], '#c8451f');
    g.P([[32, 12], [37, 23], [43, 26], [42, 44], [36, 54], [28, 54], [22, 44], [21, 26], [27, 23]], '#f08a24');
    g.P([[32, 24], [36, 34], [37, 44], [32, 50], [27, 44], [28, 34]], '#ffd95a');
    g.dot(28, 32, 1.8, '#3a1408'); g.dot(36, 32, 1.8, '#3a1408');
    g.P([[21, 46], [43, 46], [42, 50.5], [22, 50.5]], f.color);
  },
  wyvern(g, f) { g.wyrm({ body: '#5f7a3e', wing: '#3f5a34', belly: '#c9c07a', band: f.color }); g.P([[1, 51], [-1, 45], [5, 47]], BONE); },
  spider(g, f) {
    for (const d of [-1, 1]) for (const [a, b, c2, e] of [[22, 30, 8, 44], [24, 26, 6, 26], [26, 34, 10, 56], [27, 37, 20, 58]]) {
      const kx = 32 + d * (32 - a) + d * 6, ex = 32 + d * (32 - c2); g.L(32 + d * 6, b + 4, kx, b - 8, '#2a2420', 1.6); g.L(kx, b - 8, ex, e, '#2a2420', 1.4);
    }
    g.E(32, 42, 12, 11, '#3a322c'); g.E(32, 27, 8, 7, '#4a4038');
    g.P([[27, 40], [37, 40], [35, 47], [32, 50], [29, 47]], f.color);
    for (const [a, b] of [[29, 25], [35, 25], [31, 28.5], [33, 28.5]]) g.dot(a, b, 1, '#e0412e');
    g.P([[29, 32], [28, 37], [31, 33.5]], BONE); g.P([[35, 32], [36, 37], [33, 33.5]], BONE);
  },
  mortar(g, f) {
    const x = g.x; x.fillStyle = 'rgba(210,205,195,.6)'; for (const [a, b, r] of [[50, 8, 6], [56, 3, 4], [44, 4, 3.5]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    g.P([[6, 42], [50, 42], [54, 52], [4, 52]], WOOD); g.L(8, 47, 50, 47, '#5e3d1c', 0.9);
    g.P([[18, 44], [26, 22], [44, 12], [52, 22], [38, 44]], '#b08a3a'); g.L(24, 29, 40, 40, '#7a5a1e', 1.4); g.L(31, 19, 47, 27, '#7a5a1e', 1.4); g.E(48, 17, 5, 6.5, '#2a2018');
    g.P([[8, 36], [20, 36], [20, 42], [8, 42]], f.color);
    for (const wx of [15, 43]) { g.C(wx, 53, 6.5, '#5a4028'); g.C(wx, 53, 2, MAIL); }
  },
  catapult(g, f) {
    g.L(10, 54, 30, 22, WOOD, 2.6); g.L(50, 54, 30, 22, WOOD, 2.6); g.L(6, 55, 56, 55, WOOD, 3);
    g.L(52, 6, 14, 36, '#6b4a2a', 2.4); g.P([[8, 34], [20, 34], [21, 46], [7, 46]], '#6f6a60'); g.L(52, 6, 58, 16, '#c9b48a', 0.8); g.C(58.5, 17.5, 2.6, '#8d877c');
    g.C(30, 22, 2.4, MAIL); g.L(30, 22, 30, 8, WOOD, 1.2); g.P([[30, 8], [40, 11], [30, 14]], f.color);
    for (const wx of [14, 48]) { g.C(wx, 56, 4.5, '#5a4028'); g.C(wx, 56, 1.5, MAIL); }
  },
  galley(g, f) {
    const x = g.x; x.fillStyle = 'rgba(70,120,150,.55)'; x.fillRect(0, 52, 64, 9);
    for (const ox of [16, 24, 32, 40]) g.L(ox, 44, ox - 5, 57, WOOD, 1);
    g.P([[3, 36], [61, 36], [63, 30], [58, 30], [52, 50], [12, 50], [7, 44]], '#7a5632'); g.L(8, 41, 56, 41, '#4d3520', 0.9);
    g.L(32, 4, 32, 37, WOOD, 2); g.P([[15, 9], [49, 9], [47, 30], [17, 30]], f.color); g.C(32, 19.5, 5, GOLD); g.L(14, 9, 50, 9, WOOD, 1.6);
    g.P([[32, 0], [41, 2.5], [32, 5]], f.dark);
    for (const sx of [14, 23, 41, 50]) g.C(sx, 37, 2.6, f.dark);
  },
  ranger(g, f) {
    g.fig({ cape: '#3b4a2c', body: f.color, legs: '#4a4030', belt: '#2a2118', hem: 40, sw: 6.6, armR: [[43, 27], [46, 31]],
      back: () => { const x = g.x; x.save(); x.beginPath(); x.moveTo(20, 8); x.quadraticCurveTo(10, 26, 21, 44); x.lineWidth = 3; x.strokeStyle = INK; x.stroke(); x.lineWidth = 1.7; x.strokeStyle = WOOD; x.stroke(); x.restore(); g.L(20, 8, 21, 44, '#e9e2cc', 0.6); },
      head: (cx, hy) => g.hood(cx, hy, '#3b4a2c'),
      mid: () => { g.L(46, 31, 53, 50, '#e6eaef', 1.8); g.L(44, 32.4, 48.6, 30.4, GOLD, 1.2); } });
  },
  priest(g, f) {
    g.L(18, 12, 18, 60, WOOD, 1.6); const x = g.x; x.save(); x.beginPath(); x.arc(21.5, 9, 4.5, Math.PI * 0.5, Math.PI * 1.95, true); x.lineWidth = 3.2; x.strokeStyle = INK; x.stroke(); x.lineWidth = 1.8; x.strokeStyle = GOLD; x.stroke(); x.restore();
    g.fig({ robe: true, hem: 58, body: '#e4ddca', tabard: f.color, armL: [[22, 27], [18, 31]], armR: [[43, 27], [42, 34]],
      head: (cx, hy) => { g.P([[cx - 4.6, hy - 2.5], [cx, hy - 14], [cx + 4.6, hy - 2.5]], '#e4ddca'); g.L(cx, hy - 12, cx, hy - 3.5, GOLD, 1.2); g.L(cx - 4, hy - 3, cx + 4, hy - 3, GOLD, 1.3); } });
  },
  warlock(g, f) {
    const x = g.x; g.L(17.5, 12, 17.5, 60, '#3a2a1c', 1.7);
    const gl = x.createRadialGradient(17.5, 7, 0, 17.5, 7, 11); gl.addColorStop(0, 'rgba(190,120,255,.85)'); gl.addColorStop(1, 'rgba(190,120,255,0)'); x.fillStyle = gl; x.fillRect(6, -5, 23, 23);
    g.C(17.5, 7.5, 3.8, '#e6dfc8'); g.dot(16.2, 7.2, 0.9, INK); g.dot(18.8, 7.2, 0.9, INK);
    g.fig({ robe: true, hem: 58, body: '#2c2434', tabard: f.color, skin: '#cdbfae', armL: [[22, 27], [17.5, 31]], armR: [[43, 27], [45, 34]],
      head: (cx, hy) => { g.P([[cx - 4, hy - 3], [cx - 10, hy - 11], [cx - 5.4, hy - 0.5]], '#8d877c'); g.P([[cx + 4, hy - 3], [cx + 10, hy - 11], [cx + 5.4, hy - 0.5]], '#8d877c'); g.hood(cx, hy, '#2c2434'); } });
  },
  paladin(g, f) {
    g.fig({ cape: '#e4ddca', body: STEEL, sleeve: STEEL, legs: MAIL, boots: '#5b6068', glove: MAIL, tabard: f.color, tabLen: 3, hem: 39, armR: [[45, 26], [46, 21]], armL: [[22, 27], [21, 31]],
      head: (cx, hy) => { g.cap(cx, hy - 0.2, 5, '#c9ced6'); g.x.fillStyle = tone(STEEL, -0.3); g.x.fillRect(cx - 0.8, hy - 0.4, 1.6, 4.2);
        g.P([[cx - 4.6, hy - 2], [cx - 11, hy - 9], [cx - 8, hy - 3], [cx - 10, hy - 1], [cx - 5, hy]], BONE); g.P([[cx + 4.6, hy - 2], [cx + 11, hy - 9], [cx + 8, hy - 3], [cx + 10, hy - 1], [cx + 5, hy]], BONE); },
      mid: () => { g.L(46, 22, 47.5, 4, WOOD, 1.8); g.P([[41, 1], [54, 1], [54, 9], [41, 9]], STEEL); g.C(25, 19.5, 3, STEEL); g.C(39, 19.5, 3, STEEL); },
      front: () => { g.shield([[12, 21], [27, 21], [27, 31], [19.5, 42], [12, 31]], f.color); g.C(19.5, 29, 3.2, GOLD); } });
  },
};

function unitSprite(type, owner) {
  const key = type + ':' + owner; if (spriteCache[key]) return spriteCache[key];
  const c = mk(128, 128), x = c.getContext('2d');
  x.scale(2, 2); x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 1.1;
  DRAW[type](pen(x), fac(owner));
  return (spriteCache[key] = finish(c));
}

/* Army token: the unit's figure on a bevelled plate in its owner's colours. */
function tokenSprite(type, owner) {
  const key = 'tok:' + type + ':' + owner; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(46, 48), x = c.getContext('2d');
  x.fillStyle = 'rgba(6,8,10,.5)'; x.fillRect(4, 5, 41, 42);
  x.fillStyle = '#15110d'; x.fillRect(2, 2, 42, 43);
  const g = x.createLinearGradient(0, 3, 0, 44); g.addColorStop(0, f.color); g.addColorStop(1, f.dark); x.fillStyle = g; x.fillRect(3.5, 3.5, 39, 40);
  const v = x.createRadialGradient(23, 20, 4, 23, 23, 30); v.addColorStop(0, 'rgba(20,16,12,.42)'); v.addColorStop(1, 'rgba(20,16,12,.78)'); x.fillStyle = v; x.fillRect(6, 6, 34, 35);
  x.fillStyle = 'rgba(255,245,220,.35)'; x.fillRect(3.5, 3.5, 39, 1.2); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(3.5, 42.3, 39, 1.2);
  x.imageSmoothingQuality = 'high'; x.drawImage(unitSprite(type, owner), 4, 3, 38, 38);
  return (spriteCache[key] = c);
}

/* Cities are drawn from above at an angle: a walled square whose yard is exactly its four tiles, one paved plot per army,
   with the walls and corner towers standing outside the plots. Three tiers: palisade town, walled city, citadel. */
const CITY_OX = 18, CITY_OY = 44;
function citySprite(owner, level) {
  const key = 'city:' + owner + ':' + level; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(96 + 2 * CITY_OX, CITY_OY + 126), x = c.getContext('2d');
  x.translate(CITY_OX, CITY_OY); x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = 1;
  const wood = level === 1, tall = level === 3;
  const lin = (x0, x1, a, b, m) => { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); if (m) g.addColorStop(0.5, m); g.addColorStop(1, b); return g; };
  const face = (a, w) => (wood ? lin(a, a + w, '#b98a52', '#6a4622', '#93683a') : lin(a, a + w, '#e4dcc8', '#7f7866', '#bdb5a0'));
  const topc = wood ? '#d2a366' : '#f1ebda';
  const box = (a, b, w, h, fill) => { x.fillStyle = fill; x.fillRect(a, b, w, h); x.strokeRect(a, b, w, h); };
  const poly = (pts, fill) => { x.beginPath(); pts.forEach(([p, q], i) => (i ? x.lineTo(p, q) : x.moveTo(p, q))); x.closePath(); x.fillStyle = fill; x.fill(); x.stroke(); };
  const ticks = (a, b, w, h, step, col) => { x.save(); x.strokeStyle = col; x.lineWidth = 1; for (let i = a + step; i < a + w - 1; i += step) { x.beginPath(); x.moveTo(i, b + 1); x.lineTo(i, b + h - 1); x.stroke(); } x.restore(); };
  const rows = (a, b, w, h, step, col) => { x.save(); x.strokeStyle = col; x.lineWidth = 1; for (let r = b + step; r < b + h - 1; r += step) { x.beginPath(); x.moveTo(a + 1, r); x.lineTo(a + w - 1, r); x.stroke(); } x.restore(); };
  const cren = (a, b, w) => { if (wood) return; for (let i = a + 1; i < a + w - 3; i += 6) box(i, b - 3, 3.5, 3, topc); };
  const hwall = (a, b, w, topH, faceH) => { box(a, b, w, topH, topc); box(a, b + topH, w, faceH, face(a, w)); if (wood) ticks(a, b + topH, w, faceH, 4, 'rgba(40,26,10,.55)'); else rows(a, b + topH, w, faceH, 5, 'rgba(40,34,26,.3)'); cren(a, b, w); };
  const vwall = (a, b, w, h) => { box(a, b, w, h, topc); x.fillStyle = wood ? '#93683a' : '#bdb5a0'; x.fillRect(a + w - 2.5, b + 1, 2, h - 2); if (wood) rows(a, b, w, h, 4, 'rgba(40,26,10,.45)'); else rows(a, b, w, h, 6, 'rgba(40,34,26,.3)'); };
  const flag = (px, top, len = 12) => { x.beginPath(); x.moveTo(px, top + len); x.lineTo(px, top); x.stroke(); poly([[px, top], [px + 10, top + 3], [px, top + 6]], f.color); };
  const tower = (cx, cy, r, h, roofH) => {
    box(cx - r, cy, 2 * r, h, face(cx - r, 2 * r)); if (wood) ticks(cx - r, cy, 2 * r, h, 4, 'rgba(40,26,10,.5)'); else rows(cx - r, cy, 2 * r, h, 5, 'rgba(40,34,26,.3)');
    x.fillStyle = INK; x.fillRect(cx - 1, cy + 4, 2, 5);
    poly([[cx - r - 2, cy], [cx, cy - roofH], [cx + r + 2, cy]], f.color); poly([[cx, cy - roofH], [cx + r + 2, cy], [cx + 1, cy]], f.dark);
  };
  const rh = wood ? 9 : tall ? 15 : 12;
  x.fillStyle = 'rgba(8,10,12,.4)'; x.beginPath(); x.ellipse(49, 117, 62, 7, 0, 0, 7); x.fill();
  x.fillStyle = wood ? '#b9a877' : '#d6ccb0'; x.fillRect(-5, -3, 106, 104);                       // streets between the plots
  for (const [a, b] of [[1, 1], [49, 1], [1, 49], [49, 49]]) {                                    // four plots, one per army
    x.fillStyle = wood ? '#9a8a57' : '#b3a98b'; x.fillRect(a, b, 46, 46);
    x.save(); x.strokeStyle = wood ? 'rgba(70,52,24,.55)' : 'rgba(60,52,38,.5)'; x.lineWidth = 1; x.strokeRect(a + 0.5, b + 0.5, 45, 45);
    x.fillStyle = wood ? 'rgba(90,70,35,.22)' : 'rgba(70,62,48,.2)'; for (let i = 0; i < 12; i++) x.fillRect(a + 4 + (i * 29) % 36, b + 5 + (i * 17) % 36, 3, 2); x.restore();
  }
  hwall(-13, -15, 122, 5, 8);                                                                     // back wall
  vwall(-14, -8, 9, 110); vwall(101, -8, 9, 110);                                                 // side walls
  tower(-9, -13, 8, 13, rh); tower(105, -13, 8, 13, rh); flag(-9, -13 - rh - 12, 13);             // back towers
  if (tall) { tower(48, -17, 7, 14, 13); tower(-10, 40, 6, 13, 10); tower(106, 40, 6, 13, 10); flag(48, -43, 13); }
  hwall(-13, 100, 122, 5, tall ? 13 : 11);                                                        // front wall
  if (tall) { x.fillStyle = GOLD; x.fillRect(-12, 107, 120, 1.8); }
  const gw = tall ? 16 : 13, gb = tall ? 118 : 116;
  x.fillStyle = INK; x.beginPath(); x.moveTo(48 - gw / 2, gb); x.lineTo(48 - gw / 2, gb - 8); x.arc(48, gb - 8, gw / 2, Math.PI, 0); x.lineTo(48 + gw / 2, gb); x.closePath(); x.fill();
  ticks(48 - gw / 2, gb - 13, gw, 13, 3, wood ? '#8a6a3a' : '#7a6746');
  tower(-9, 96, 9, tall ? 23 : 21, rh); tower(105, 96, 9, tall ? 23 : 21, rh);                    // front towers
  if (tall) { flag(-9, 96 - rh - 12, 13); flag(105, 96 - rh - 12, 13); }
  return (spriteCache[key] = finish(c, 0.62));
}

function ruinSprite(explored) {
  const key = 'ruin:' + explored; if (spriteCache[key]) return spriteCache[key];
  const c = mk(48, 48), x = c.getContext('2d'); x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = 1;
  const g = x.createLinearGradient(8, 0, 42, 0); g.addColorStop(0, '#d9d3c2'); g.addColorStop(0.5, '#a9a392'); g.addColorStop(1, '#6d6859');
  const poly = (pts, fill) => { x.beginPath(); pts.forEach(([p, q], i) => (i ? x.lineTo(p, q) : x.moveTo(p, q))); x.closePath(); x.fillStyle = fill; x.fill(); x.stroke(); };
  x.fillStyle = 'rgba(8,10,12,.4)'; x.beginPath(); x.ellipse(25, 42, 21, 5, 0, 0, 7); x.fill();
  poly([[30, 41], [30, 27], [34, 23], [37, 28], [41, 26], [43, 31], [43, 41]], g);
  poly([[9, 41], [9, 15], [13, 10], [16, 16], [20, 6], [24, 14], [28, 9], [31, 17], [31, 41]], g);
  x.save(); x.strokeStyle = 'rgba(40,34,26,.4)'; x.lineWidth = 1;
  for (const [a, b, w] of [[11, 22, 8], [21, 20, 8], [14, 29, 7], [24, 33, 6], [33, 33, 8], [11, 36, 6]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(a + w, b); x.stroke(); }
  x.restore();
  x.fillStyle = '#17120e'; x.beginPath(); x.moveTo(16, 41); x.lineTo(16, 31); x.arc(20, 31, 4, Math.PI, 0); x.lineTo(24, 41); x.closePath(); x.fill(); x.stroke();
  if (!explored) { const gl = x.createRadialGradient(20, 34, 0, 20, 34, 11); gl.addColorStop(0, 'rgba(255,236,150,1)'); gl.addColorStop(0.35, 'rgba(255,205,80,.7)'); gl.addColorStop(1, 'rgba(255,200,60,0)'); x.fillStyle = gl; x.fillRect(8, 22, 24, 24); }
  for (const [a, b, r] of [[36, 43, 3], [28, 44, 2.2], [6, 43, 2.6], [41, 44.5, 1.8]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fillStyle = '#a9a392'; x.fill(); x.stroke(); }
  x.fillStyle = '#4f8a3c'; for (const [a, b, r] of [[10, 18, 2.4], [12, 21, 1.8], [29, 12, 2.2], [27, 16, 1.6], [42, 30, 2], [33, 26, 1.6], [9, 39, 2.4]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
  return (spriteCache[key] = finish(c, 0.6));
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
      r = 58 - 38 * dp + wv; g = 112 - 62 * dp + wv; bl = 134 - 42 * dp + wv;
      if (water < 0.56) { const k = 1 - (water - 0.5) / 0.06; r += (205 - r) * k * 0.5; g += (218 - g) * k * 0.5; bl += (222 - bl) * k * 0.5; }
      hgt[i] = -1;
    } else {
      const inv = 1 / (1 - water), a0 = wg[0] * inv, a1 = wg[1] * inv, a2 = wg[2] * inv, a3 = wg[3] * inv, a5 = wg[5] * inv;
      const gk = big * 0.7 + f * 0.3, mh = 0.26 + 0.40 * nR[i] + 0.24 * m + 0.10 * ridge, rk = f * 0.45 + nR[i] * 0.55;
      let mr = 108 + 44 * rk, mg = 102 + 44 * rk, mb = 96 + 40 * rk;
      if (mh > 0.7) { const k = Math.min(1, (mh - 0.7) * 9); mr += (240 - mr) * k; mg += (243 - mg) * k; mb += (248 - mb) * k; }
      const pud = f > 0.6 && m > 0.45;
      r = a0 * (80 + 30 * gk) + a1 * (50 + 14 * f) + a2 * (120 + 30 * m) + a3 * mr + a5 * (pud ? 46 : 82 + 18 * m);
      g = a0 * (106 + 24 * gk) + a1 * (82 + 14 * f) + a2 * (120 + 6 * m) + a3 * mg + a5 * (pud ? 72 : 96 + 10 * m);
      bl = a0 * (50 + 12 * gk) + a1 * (42 + 10 * f) + a2 * (68 + 16 * m) + a3 * mb + a5 * (pud ? 80 : 58 + 8 * m);
      if (water > 0.34) { const k = Math.min(1, (water - 0.34) / 0.1); r += (188 + 12 * f - r) * k; g += (170 + 10 * f - g) * k; bl += (126 + 8 * f - bl) * k; }
      hgt[i] = a0 * (0.10 + 0.02 * f) + a1 * (0.12 + 0.03 * f) + a5 * (0.07 + (pud ? -0.02 : 0.01 * f)) + a2 * (0.14 + 0.24 * m + 0.03 * f) + a3 * (mh + 0.04 * f);
    }
    const o = i * 4; d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
  }
  for (let py = 1; py < H - 1; py++) for (let px = 1; px < W - 1; px++) {
    const i = py * W + px, h = hgt[i]; if (h < 0) continue;
    const l = hgt[i - 1], rr = hgt[i + 1], up = hgt[i - W], dn = hgt[i + W];
    let s = 1 + ((rr < 0 ? h : rr) - (l < 0 ? h : l) + (dn < 0 ? h : dn) - (up < 0 ? h : up)) * 9;
    s = s < 0.42 ? 0.42 : s > 1.4 ? 1.4 : s;
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
  strokeRoads(false, 7, 'rgba(52,38,20,.6)'); strokeRoads(false, 4.5, '#a88c5c'); strokeRoads(false, 1.5, 'rgba(206,186,140,.5)', [5, 9]);
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
        x.beginPath(); x.moveTo(o.x - w, top + o.r * 0.8); x.lineTo(o.x, top - o.r * 0.5); x.lineTo(o.x + w, top + o.r * 0.8); x.closePath(); x.fillStyle = '#183f24'; x.fill();
        x.beginPath(); x.moveTo(o.x - w, top + o.r * 0.8); x.lineTo(o.x, top - o.r * 0.5); x.lineTo(o.x, top + o.r * 0.8); x.closePath(); x.fillStyle = '#2f6535'; x.fill(); }
    } else {
      const g = x.createRadialGradient(o.x - o.r * 0.35, o.y - o.r * 0.45, 1, o.x, o.y, o.r);
      g.addColorStop(0, '#6c9648'); g.addColorStop(0.5, '#33682e'); g.addColorStop(1, '#14351a');
      x.fillStyle = g; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 7); x.fill();
    }
  }
  return c;
}
