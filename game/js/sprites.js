'use strict';
/* Original pixel art, drawn in code: unit sprites from character grids, terrain and cities procedurally. */

const INK = '#1d1712', WOOD = '#8a5a2b', STEEL = '#b9bec6', MAIL = '#8d9299', SKIN = '#e8bd95', BONE = '#f2efe6', GOLD = '#e8c04a';
const spriteCache = {};
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* Small drawing kit: every figure is laid out in a 64 x 64 box with inked outlines. */
function pen(x) {
  const g = { x };
  g.P = (pts, fill, close = true) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); if (close) x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } x.stroke(); };
  g.C = (cx, cy, r, fill) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); if (fill) { x.fillStyle = fill; x.fill(); } x.stroke(); };
  g.E = (cx, cy, rx, ry, fill, stroke = true) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fillStyle = fill; x.fill(); if (stroke) x.stroke(); };
  g.L = (x1, y1, x2, y2, col, w = 2.5) => { x.save(); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.lineWidth = w + 2.4; x.strokeStyle = INK; x.stroke(); x.lineWidth = w; x.strokeStyle = col; x.stroke(); x.restore(); };
  g.dot = (cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
  g.shade = pts => { x.save(); x.globalAlpha = 0.24; x.fillStyle = '#000'; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.fill(); x.restore(); };
  g.arm = (x1, y1, x2, y2, col, w = 5) => { g.L(x1, y1, x2, y2, col, w); g.C(x2, y2, 2.6, SKIN); };
  g.cap = (cx, cy, r, col) => { x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.closePath(); x.fillStyle = col; x.fill(); x.stroke(); };
  g.eyes = (cx, cy) => { x.fillStyle = INK; x.fillRect(cx - 3.2, cy, 1.7, 2.2); x.fillRect(cx + 1.5, cy, 1.7, 2.2); };
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
    g.L(48, 8, 48, 59, WOOD); g.P([[48, 1], [51.5, 10], [44.5, 10]], STEEL);
    g.man({ body: f.color, legs: '#6b4a2a', belt: '#3a2a1c' });
    g.cap(32, 16, 7, '#5a3b1e'); g.arm(41, 29, 48, 36, f.color); g.arm(23, 29, 20, 41, f.color);
  },
  pike(g, f) {
    g.L(14, 9, 14, 60, WOOD); g.P([[14, 0], [17.5, 10], [10.5, 10]], STEEL);
    g.man({ body: MAIL, legs: '#55504a', tabard: f.color });
    g.arm(23, 29, 14, 37, MAIL);
    g.P([[35, 28], [53, 28], [53, 40], [44, 53], [35, 40]], f.color); g.shade([[44, 29], [52, 29], [52, 40], [44, 51]]);
    g.L(38.5, 33, 44, 39, BONE, 2); g.L(44, 39, 49.5, 33, BONE, 2);
    g.cap(32, 16.5, 7.5, STEEL); g.x.fillStyle = INK; g.x.fillRect(31, 15, 2, 6);
  },
  archer(g, f) {
    g.P([[19, 21], [25, 21], [24, 41], [20, 41]], '#7a4e2a'); g.L(21, 21, 20, 15, BONE, 1.5); g.L(23.5, 21, 24, 14, BONE, 1.5);
    g.man({ body: f.color, legs: '#4a5a34', belt: '#3a2a1c' });
    const x = g.x; x.save(); x.beginPath(); x.arc(36, 34, 21, -1.05, 1.05); x.lineWidth = 5.4; x.strokeStyle = INK; x.stroke(); x.lineWidth = 3; x.strokeStyle = WOOD; x.stroke(); x.restore();
    g.L(46.5, 16, 46.5, 52, BONE, 1); g.arm(41, 29, 56, 34, f.color); g.arm(23, 29, 31, 37, f.color);
    g.cap(32, 16, 7, '#3f7a36'); g.P([[24, 16], [40, 16], [43, 18], [23, 18]], '#3f7a36'); g.L(36, 12, 43, 4, GOLD, 2);
  },
  warden(g, f) {
    g.P([[20, 24], [44, 24], [49, 55], [15, 55]], '#2f5d34'); g.shade([[34, 25], [44, 25], [48, 54], [34, 54]]);
    g.man({ body: f.color, legs: '#3d3a2a', w: 8, belt: '#2a2118' });
    const x = g.x; x.save(); x.beginPath(); x.arc(33, 34, 22, -1.1, 1.1); x.lineWidth = 5.4; x.strokeStyle = INK; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#3aa39a'; x.stroke(); x.restore();
    g.L(43, 15, 43, 53, BONE, 1); g.arm(40, 29, 55, 34, f.color); g.arm(24, 29, 31, 37, f.color);
    g.P([[23.5, 21], [25, 12], [32, 6], [39, 12], [40.5, 21], [37, 14], [32, 11.5], [27, 14]], '#2f5d34');
  },
  reaver(g, f) {
    g.L(51, 12, 51, 59, WOOD, 3); g.P([[51, 10], [61, 6], [63, 20], [51, 25]], STEEL); g.shade([[55, 15], [62, 19], [52, 24]]);
    g.man({ body: MAIL, legs: '#4d3a2a', w: 12, top: 31, hip: 46, tabard: f.color, belt: '#2a2118' });
    g.P([[24.5, 25], [39.5, 25], [37, 37], [32, 41], [27, 37]], '#d9732a');
    g.P([[26, 16], [19, 9], [24.5, 18]], BONE); g.P([[38, 16], [45, 9], [39.5, 18]], BONE);
    g.cap(32, 22, 7.5, STEEL); g.arm(44, 35, 51, 41, MAIL, 6); g.arm(20, 35, 17, 46, MAIL, 6);
  },
  bearer(g, f) {
    g.L(25, 2, 25, 60, WOOD); g.P([[25, 3], [3, 3], [9, 12], [3, 21], [25, 21]], f.color); g.shade([[25, 12], [8, 12], [3, 21], [25, 21]]); g.C(16, 12, 4, GOLD);
    g.man({ cx: 41, body: MAIL, legs: '#55504a', tabard: f.color });
    g.cap(41, 16.5, 7.5, STEEL); g.arm(32, 29, 25, 37, MAIL); g.arm(50, 29, 53, 41, MAIL);
  },
  champion(g, f) {
    g.P([[21, 26], [43, 26], [48, 56], [16, 56]], f.dark);
    g.L(51, 5, 51, 33, '#e6eaef', 3); g.L(46.5, 32, 55.5, 32, GOLD, 2.5);
    g.man({ body: STEEL, legs: MAIL, tabard: f.color }); g.C(32, 34, 2.4, GOLD);
    g.C(32, 18, 7.2, '#c9ced6'); g.x.fillStyle = INK; g.x.fillRect(26.5, 16.5, 11, 2.4); g.x.fillRect(31, 18, 2, 5);
    g.P([[25.5, 12.5], [27, 5.5], [30, 10.5], [32, 4], [34, 10.5], [37, 5.5], [38.5, 12.5]], GOLD);
    g.arm(41, 29, 51, 36, STEEL);
    g.P([[9, 28], [27, 28], [27, 40], [18, 52], [9, 40]], f.color); g.shade([[18, 29], [26, 29], [26, 40], [18, 50]]); g.C(18, 37, 3, GOLD);
  },
  seer(g, f) {
    g.L(13, 12, 13, 60, WOOD);
    const x = g.x, gl = x.createRadialGradient(13, 7, 0, 13, 7, 12); gl.addColorStop(0, 'rgba(150,255,240,.9)'); gl.addColorStop(1, 'rgba(150,255,240,0)'); x.fillStyle = gl; x.fillRect(1, -5, 24, 24);
    g.C(13, 7, 4.5, '#8ff0e2');
    g.P([[23, 25], [41, 25], [48, 59], [16, 59]], '#6f4aa8'); g.P([[28.5, 25], [35.5, 25], [37, 59], [27, 59]], f.color); g.shade([[35, 26], [41, 26], [47, 58], [36, 58]]);
    g.arm(24, 29, 13, 37, '#6f4aa8'); g.arm(40, 29, 45, 41, '#6f4aa8');
    g.C(32, 18, 6.5, SKIN); g.eyes(32, 16.5);
    g.P([[26.5, 21], [37.5, 21], [36, 33], [32, 37], [28, 33]], BONE);
    g.P([[21, 15], [43, 15], [37, 11.5], [31, -1], [27, 11.5]], '#6f4aa8'); g.L(27.5, 12.5, 36.5, 12.5, f.color, 2);
  },
  rider(g, f) {
    g.P([[13, 35], [5, 40], [7, 55], [12, 46]], '#3a2416');
    for (const lx of [14, 22, 37, 44]) g.P([[lx, 43], [lx + 5, 43], [lx + 4.5, 59], [lx + 0.5, 59]], '#6f4526');
    g.E(30, 40, 17.5, 9, '#8a5a32'); g.P([[40, 37], [47, 22], [55, 24], [49, 43]], '#8a5a32');
    g.P([[46, 20], [57, 18], [63, 27], [59, 31], [50, 29]], '#8a5a32'); g.P([[48, 20], [49, 13], [53, 19]], '#8a5a32');
    g.P([[41, 34], [46, 21], [43, 21], [38, 32]], '#3a2416'); g.dot(56, 22.5, 1.3, INK);
    g.P([[21, 32], [37, 32], [38, 45], [20, 45]], f.color); g.shade([[30, 33], [37, 33], [37.5, 44], [30, 44]]);
    g.L(18, 31, 61, 3, WOOD); g.P([[52, 9], [41, 5], [45, 15]], f.color);
    g.P([[26, 32], [32, 32], [34, 47], [28, 47]], '#55504a');
    g.P([[23, 16], [35, 16], [34, 34], [24, 34]], MAIL); g.P([[26, 16], [32, 16], [31.5, 34], [26.5, 34]], f.color);
    g.C(29, 10, 5.6, SKIN); g.eyes(30, 9); g.cap(29, 9, 6.4, STEEL); g.arm(33, 20, 38, 22, MAIL, 4);
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
    g.P([[19, 44], [30, 44], [30, 59], [17, 59]], '#4f8f42'); g.P([[34, 44], [45, 44], [47, 59], [34, 59]], '#4f8f42');
    g.E(32, 34, 16.5, 14, '#5aa845'); g.E(31, 38, 9, 8, '#7cc063', false);
    g.P([[19, 43], [45, 43], [41, 53], [32, 49], [23, 53]], f.color);
    g.arm(17, 29, 10, 47, '#5aa845', 7); g.arm(47, 29, 52, 40, '#5aa845', 7);
    g.P([[24, 14], [18, 10], [23, 19]], '#5aa845'); g.P([[40, 14], [46, 10], [41, 19]], '#5aa845');
    g.C(32, 16, 8.5, '#5aa845'); g.L(27, 13, 37, 13, '#3d7a34', 1.6); g.dot(28.8, 15.5, 1.5, '#e0412e'); g.dot(35.2, 15.5, 1.5, '#e0412e');
    g.P([[27, 22], [26, 15.5], [29.5, 21]], BONE); g.P([[37, 22], [38, 15.5], [34.5, 21]], BONE);
  },
  drake(g, f) {
    g.P([[26, 32], [9, 3], [21, 12], [30, 1], [34, 14], [45, 6], [41, 32]], '#8f2418');
    g.L(27, 30, 21, 12, '#5e150d', 1.3); g.L(31, 30, 34, 14, '#5e150d', 1.3);
    g.P([[16, 45], [1, 51], [4, 42], [14, 36]], '#c0392b');
    g.P([[17, 46], [25, 46], [26, 59], [16, 59]], '#a52f22'); g.P([[33, 46], [41, 46], [42, 59], [32, 59]], '#a52f22');
    g.E(28, 42, 16.5, 10, '#c0392b'); g.E(28, 47.5, 11, 3.6, '#e8a23a', false);
    g.P([[36, 39], [42, 18], [52, 16], [49, 41]], '#c0392b'); g.P([[39.5, 26], [36, 22], [41, 21]], BONE); g.P([[38, 33], [34, 30], [39, 28]], BONE);
    g.P([[43, 10], [56, 9], [63.5, 18], [58, 23.5], [45, 22]], '#c0392b'); g.P([[45, 11], [39, 2], [50, 9]], BONE);
    g.dot(53, 14.5, 1.8, '#f3cf5b'); g.dot(53.3, 14.5, 0.8, INK); g.dot(60.5, 18, 0.9, INK);
    g.P([[37.5, 33], [49.5, 30.5], [49.5, 36], [37, 38.5]], f.color);
  },
  ram(g, f) {
    g.P([[38, 33], [63, 33], [63, 43], [38, 43]], '#6b4a2a'); g.P([[57, 31], [64, 34.5], [64, 41.5], [57, 45]], MAIL);
    g.P([[6, 30], [56, 30], [56, 47], [6, 47]], WOOD); g.L(6, 38.5, 56, 38.5, '#5e3d1c', 1.2);
    g.P([[2, 30], [13, 13], [47, 13], [60, 30]], f.color); g.shade([[31, 14], [47, 14], [59, 29.5], [31, 29.5]]);
    g.L(22, 13, 18, 30, f.dark, 1.3); g.L(38, 13, 41, 30, f.dark, 1.3);
    for (const wx of [17, 45]) { g.C(wx, 51, 7.5, '#5a4028'); g.C(wx, 51, 2.4, MAIL); }
  },
};

function unitSprite(type, owner) {
  const key = type + ':' + owner; if (spriteCache[key]) return spriteCache[key];
  const c = mk(128, 128), x = c.getContext('2d');
  x.scale(2, 2); x.lineJoin = 'round'; x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 1.8;
  DRAW[type](pen(x), fac(owner));
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
  x.imageSmoothingQuality = 'high'; x.drawImage(unitSprite(type, owner), 3, -1, 40, 40);
  return (spriteCache[key] = c);
}

/* Cities are drawn from above at an angle: a walled square that fills its four tiles, corner towers, a keep in the middle
   and room in each quarter for the army standing there. Three tiers: palisade town, walled city, citadel. */
function citySprite(owner, level) {
  const key = 'city:' + owner + ':' + level; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(96, 106), x = c.getContext('2d');
  x.translate(0, 10); x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = 1.3;
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
  const house = (a, b, w, h, ra, rb) => { box(a, b + h * 0.55, w, h * 0.45, lin(a, a + w, '#f1e4c6', '#b5a583')); box(a - 1, b, w + 2, h * 0.32, ra); box(a - 1, b + h * 0.32, w + 2, h * 0.3, rb); };
  const flag = (px, top, len = 12) => { x.beginPath(); x.moveTo(px, top + len); x.lineTo(px, top); x.stroke(); poly([[px, top], [px + 10, top + 3], [px, top + 6]], f.color); };
  const tower = (cx, cy, r, h, roofH) => {
    box(cx - r, cy, 2 * r, h, face(cx - r, 2 * r)); if (wood) ticks(cx - r, cy, 2 * r, h, 4, 'rgba(40,26,10,.5)'); else rows(cx - r, cy, 2 * r, h, 5, 'rgba(40,34,26,.3)');
    x.fillStyle = INK; x.fillRect(cx - 1, cy + 4, 2, 5);
    poly([[cx - r - 2, cy], [cx, cy - roofH], [cx + r + 2, cy]], f.color); poly([[cx, cy - roofH], [cx + r + 2, cy], [cx + 1, cy]], f.dark);
  };
  const roofA = wood ? '#e0bd66' : '#c7654a', roofB = wood ? '#a5822f' : '#8a3a28';

  x.fillStyle = 'rgba(8,10,12,.4)'; x.beginPath(); x.ellipse(49, 93, 48, 6, 0, 0, 7); x.fill();
  x.fillStyle = wood ? '#a3955f' : '#bcb294'; x.fillRect(6, 8, 84, 76);                       // yard
  x.save(); x.fillStyle = wood ? 'rgba(90,70,35,.25)' : 'rgba(70,62,48,.22)'; for (let i = 0; i < 46; i++) x.fillRect(8 + (i * 37) % 80, 12 + (i * 53) % 68, 3, 2); x.restore();
  x.fillStyle = wood ? '#b9a877' : '#d6ccb0'; x.fillRect(44, 48, 8, 36); x.fillRect(10, 44, 76, 6); // streets
  hwall(4, 3, 88, 5, 8);                                                                         // back wall
  vwall(3, 8, 7, 76); vwall(86, 8, 7, 76);                                                       // side walls
  for (const [a, b] of [[14, 19], [28, 18], [58, 18], [72, 19], [13, 31], [73, 31], [13, 55], [26, 57], [60, 57], [73, 55], [14, 67], [72, 67]])
    if (tall || !(a === 28 || a === 58)) house(a, b, 10, 10, roofA, roofB);
  tower(11, 6, 8, 12, wood ? 8 : 11); tower(85, 6, 8, 12, wood ? 8 : 11);                         // back towers
  if (wood) {
    house(36, 28, 24, 22, f.color, f.dark); flag(48, 10, 14);                                     // great hall
  } else if (!tall) {
    box(37, 30, 22, 22, face(37, 22)); rows(37, 30, 22, 22, 5, 'rgba(40,34,26,.3)');
    poly([[34, 30], [48, 14], [62, 30]], f.color); poly([[48, 14], [62, 30], [49, 30]], f.dark);
    x.fillStyle = INK; x.fillRect(42, 36, 2, 6); x.fillRect(52, 36, 2, 6); flag(48, 0, 14);
  } else {
    tower(34, 26, 5, 26, 10); tower(62, 26, 5, 26, 10);
    box(36, 20, 24, 34, face(36, 24)); rows(36, 20, 24, 34, 5, 'rgba(40,34,26,.3)'); cren(36, 20, 24);
    x.fillStyle = GOLD; x.fillRect(37, 31, 22, 2); x.fillStyle = INK; x.fillRect(41, 37, 2, 7); x.fillRect(47, 37, 2, 7); x.fillRect(53, 37, 2, 7);
    box(42, 6, 12, 14, face(42, 12)); poly([[40, 6], [48, -6], [56, 6]], f.color); poly([[48, -6], [56, 6], [49, 6]], f.dark); flag(48, -19, 13);
    tower(6.5, 40, 6, 12, 9); tower(89.5, 40, 6, 12, 9);
  }
  hwall(4, 76, 88, 5, tall ? 13 : 11);                                                            // front wall
  if (tall) { x.fillStyle = GOLD; x.fillRect(5, 83, 86, 1.8); }
  const gw = tall ? 14 : 12, gb = tall ? 94 : 92;
  x.fillStyle = INK; x.beginPath(); x.moveTo(48 - gw / 2, gb); x.lineTo(48 - gw / 2, gb - 8); x.arc(48, gb - 8, gw / 2, Math.PI, 0); x.lineTo(48 + gw / 2, gb); x.closePath(); x.fill();
  ticks(48 - gw / 2, gb - 12, gw, 12, 3, wood ? '#8a6a3a' : '#7a6746');
  tower(11, 72, 9, tall ? 23 : 21, wood ? 9 : tall ? 15 : 12); tower(85, 72, 9, tall ? 23 : 21, wood ? 9 : tall ? 15 : 12); // front towers
  if (tall) { flag(11, 44, 13); flag(85, 44, 13); }
  return (spriteCache[key] = c);
}

function ruinSprite(explored) {
  const key = 'ruin:' + explored; if (spriteCache[key]) return spriteCache[key];
  const c = mk(48, 48), x = c.getContext('2d'); x.lineJoin = 'round'; x.strokeStyle = INK; x.lineWidth = 1.4;
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
