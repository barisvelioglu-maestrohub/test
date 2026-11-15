'use strict';
/* Deterministic map builder: the same seed always yields the same land. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(w, h, cell, rng) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = [];
  for (let i = 0; i < gw * gh; i++) g.push(rng());
  const out = new Float32Array(w * h);
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
    out[y * w + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  return out;
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
  }
  pop() {
    const k = this.k, v = this.v, rk = k[0], rv = v[0], lk = k.pop(), lv = v.pop();
    if (k.length) { k[0] = lk; v[0] = lv; let i = 0; const n = k.length;
      for (;;) { let m = i; const l = 2 * i + 1, r = l + 1;
        if (l < n && k[l] < k[m]) m = l; if (r < n && k[r] < k[m]) m = r; if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } }
    return [rk, rv];
  }
}

function genMap() {
  const rng = mulberry32(MAP_SEED), W = MAP_W, H = MAP_H;
  const n1 = valueNoise(W, H, 8, rng), n2 = valueNoise(W, H, 4, rng), mo = valueNoise(W, H, 6, rng), mo2 = valueNoise(W, H, 3, rng);
  const t = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const i = y * W + x, el = 0.6 * n1[i] + 0.4 * n2[i], ms = 0.65 * mo[i] + 0.35 * mo2[i];
      const dx = Math.abs(x - (W - 1) / 2) / (W / 2), dy = Math.abs(y - (H - 1) / 2) / (H / 2);
      const d = Math.max(dx, dy), e = el + 0.27 - 0.95 * Math.pow(d, 4);
      let c = 'g';
      if (e < 0.5) c = 'w'; else if (e > 0.93) c = 'm'; else if (e > 0.84) c = 'h';
      else if (ms > 0.56) c = e < 0.62 ? 's' : 'f';
      row.push(c);
    }
    t.push(row);
  }
  const cities = [];
  const caps = [[7, 6], [W - 8, 6], [7, H - 7], [W - 8, H - 7]];
  caps.forEach(([cx, cy], i) => {
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++)
      if (t[y][x] === 'w' || t[y][x] === 'm' || Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= 1) t[y][x] = 'g';
    cities.push({ x: cx, y: cy, cap: i });
  });
  const far = (x, y, list, min) => list.every(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= min);
  for (let tries = 0; tries < 6000 && cities.length < 4 + 15; tries++) {
    const x = 3 + Math.floor(rng() * (W - 6)), y = 3 + Math.floor(rng() * (H - 6));
    if (t[y][x] === 'w' || t[y][x] === 'm') continue;
    if (!far(x, y, cities, 6)) continue;
    cities.push({ x, y, cap: -1 });
  }
  cities.forEach(c => { t[c.y][c.x] = 'g'; });

  // Roads: minimum spanning tree over the cities plus each city's nearest neighbour.
  const road = []; for (let y = 0; y < H; y++) road.push(new Array(W).fill(false));
  const edges = [], inTree = [0], d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  while (inTree.length < cities.length) {
    let best = null;
    for (const a of inTree) for (let b = 0; b < cities.length; b++) {
      if (inTree.includes(b)) continue;
      const dd = d2(cities[a], cities[b]); if (!best || dd < best[2]) best = [a, b, dd];
    }
    edges.push(best); inTree.push(best[1]);
  }
  // A few extra links so the road net has loops, not just one tree.
  const extra = [];
  cities.forEach((c, a) => cities.forEach((o, b) => {
    if (b <= a || edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) return;
    extra.push([a, b, d2(c, o)]);
  }));
  extra.sort((p, q) => p[2] - q[2]); edges.push(...extra.slice(0, 4));
  const carveCost = { g: 1, f: 2, h: 3, s: 3, w: 9, m: 12 };
  for (const [a, b] of edges) {
    const A = cities[a], B = cities[b], N = W * H, dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = new Heap(); dist[A.y * W + A.x] = 0; heap.push(0, A.y * W + A.x);
    while (heap.size) {
      const [d, i] = heap.pop(); if (d > dist[i]) continue; if (i === B.y * W + B.x) break;
      const x = i % W, y = (i - x) / W;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
        const j = ny * W + nx, nd = d + (road[ny][nx] ? 0.05 : carveCost[t[ny][nx]]);
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; heap.push(nd, j); }
      }
    }
    for (let i = B.y * W + B.x; i >= 0; i = prev[i]) {
      const x = i % W, y = (i - x) / W; road[y][x] = true; if (t[y][x] === 'm') t[y][x] = 'h';
    }
  }

  // Ground reachability from the first capital, used to keep ruins reachable on foot.
  const reach = new Uint8Array(W * H), q = [cities[0].y * W + cities[0].x]; reach[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i - x) / W;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (reach[j]) continue;
      if ((t[ny][nx] === 'w' || t[ny][nx] === 'm') && !road[ny][nx]) continue;
      reach[j] = 1; q.push(j);
    }
  }
  const ruins = [];
  for (let tries = 0; tries < 6000 && ruins.length < 10; tries++) {
    const x = 2 + Math.floor(rng() * (W - 4)), y = 2 + Math.floor(rng() * (H - 4));
    if (!reach[y * W + x] || road[y][x] || t[y][x] === 'w') continue;
    if (!far(x, y, cities, 3) || !far(x, y, ruins, 5)) continue;
    ruins.push({ x, y });
  }
  const cityGrid = new Int16Array(W * H).fill(-1);
  cities.forEach((c, i) => { cityGrid[c.y * W + c.x] = i; });
  const ruinGrid = new Int16Array(W * H).fill(-1);
  ruins.forEach((r, i) => { ruinGrid[r.y * W + r.x] = i; });
  return { t, road, cities, ruins, cityGrid, ruinGrid, rng };
}
