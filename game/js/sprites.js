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

function citySprite(owner, level) {
  const key = 'city:' + owner + ':' + level; if (spriteCache[key]) return spriteCache[key];
  const f = fac(owner), c = mk(16, 16), x = c.getContext('2d'), R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  R('#1a1423', 0, 5, 16, 11);                    // outline mass
  R('#bdb7a6', 2, 9, 12, 6); R('#8f8979', 2, 13, 12, 2);
  for (let i = 2; i < 14; i += 2) R('#bdb7a6', i, 8, 1, 1);
  R('#cfc9b8', 1, 6, 3, 9); R('#cfc9b8', 12, 6, 3, 9); R('#a39d8c', 3, 6, 1, 9); R('#a39d8c', 14, 6, 1, 9);
  R(f.color, 1, 5, 3, 1); R(f.color, 12, 5, 3, 1); R(f.dark, 2, 4, 1, 1); R(f.dark, 13, 4, 1, 1);
  R('#3a2a1c', 7, 11, 2, 4); R('#1a1423', 7, 10, 2, 1);
  if (level >= 2) { R('#1a1423', 5, 3, 6, 6); R('#cfc9b8', 6, 5, 4, 4); R(f.color, 6, 4, 4, 1); R(f.dark, 7, 3, 2, 1); R('#3a2a1c', 7, 6, 1, 2); }
  if (level >= 3) { R('#1a1423', 8, 0, 1, 3); R(f.color, 9, 0, 3, 2); R(f.dark, 9, 1, 2, 1); }
  if (level >= 4) { R('#e8c04a', 2, 9, 12, 1); R('#e8c04a', 1, 6, 3, 1); R('#e8c04a', 12, 6, 3, 1); }
  return (spriteCache[key] = c);
}

function ruinSprite(explored) {
  const key = 'ruin:' + explored; if (spriteCache[key]) return spriteCache[key];
  const c = mk(16, 16), x = c.getContext('2d'), R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const lt = explored ? '#7d7a72' : '#c5c1b4', dk = explored ? '#55524b' : '#8b877b';
  R('#1a1423', 2, 4, 4, 10); R('#1a1423', 10, 6, 4, 8); R('#1a1423', 1, 13, 14, 2); R('#1a1423', 6, 9, 4, 5);
  R(lt, 3, 5, 2, 8); R(dk, 4, 5, 1, 8); R(lt, 11, 7, 2, 6); R(dk, 12, 7, 1, 6); R(dk, 2, 13, 12, 1);
  R(lt, 7, 10, 2, 3); R(lt, 2, 4, 4, 1);
  if (!explored) { R('#e8c04a', 7, 7, 2, 2); R('#fff6c9', 7, 7, 1, 1); }
  return (spriteCache[key] = c);
}

/* Paints the whole land once at 16px per tile; the view scales it up with smoothing off. */
function paintTerrain() {
  const W = MAP_W, H = MAP_H, c = mk(W * TILE, H * TILE), x = c.getContext('2d'), rng = mulberry32(MAP_SEED ^ 0x51ab);
  const R = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const ri = n => Math.floor(rng() * n);
  const T = (tx, ty) => (tx < 0 || ty < 0 || tx >= W || ty >= H ? 'w' : MAP.t[ty][tx]);
  const grass = (ox, oy) => { R('#4f9a3c', ox, oy, 16, 16); for (let i = 0; i < 9; i++) R(i % 2 ? '#5fae48' : '#44873a', ox + ri(16), oy + ri(16), 1 + ri(2), 1); };
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const ox = tx * 16, oy = ty * 16, t = MAP.t[ty][tx];
    if (t === 'w') {
      R('#2a66ab', ox, oy, 16, 16);
      for (let i = 0; i < 4; i++) R(i % 2 ? '#3f82c9' : '#225a9b', ox + ri(12), oy + 1 + ri(14), 3 + ri(2), 1);
      const sand = '#dcc98e', foam = '#a9d0f0';
      if (T(tx, ty - 1) !== 'w') { R(sand, ox, oy, 16, 2); R(foam, ox, oy + 2, 16, 1); }
      if (T(tx, ty + 1) !== 'w') { R(sand, ox, oy + 14, 16, 2); R(foam, ox, oy + 13, 16, 1); }
      if (T(tx - 1, ty) !== 'w') { R(sand, ox, oy, 2, 16); R(foam, ox + 2, oy + 2, 1, 12); }
      if (T(tx + 1, ty) !== 'w') { R(sand, ox + 14, oy, 2, 16); R(foam, ox + 13, oy + 2, 1, 12); }
    } else if (t === 's') {
      R('#56703b', ox, oy, 16, 16);
      for (let i = 0; i < 3; i++) { const a = ox + 1 + ri(11), b = oy + 2 + ri(11); R('#3c6170', a, b, 4, 2); R('#5c8796', a + 1, b, 2, 1); }
      for (let i = 0; i < 5; i++) { const a = ox + ri(15), b = oy + ri(13); R('#9aa83e', a, b, 1, 3); R('#c9c06a', a, b, 1, 1); }
    } else {
      grass(ox, oy);
      if (t === 'f') {
        for (const [qx, qy] of [[1, 1], [9, 0], [4, 7], [10, 8]]) {
          const a = ox + qx + ri(2), b = oy + qy + ri(2);
          R('#1c4a20', a, b + 1, 6, 5); R('#2d6e2a', a + 1, b, 4, 5); R('#44943a', a + 1, b, 2, 2); R('#5a3b1e', a + 2, b + 6, 2, 1);
        }
      } else if (t === 'h') {
        for (const [qx, qy] of [[0, 2], [7, 7]]) {
          const a = ox + qx + ri(2), b = oy + qy + ri(2);
          R('#557a30', a, b + 4, 9, 2); R('#7f9c43', a + 1, b + 2, 7, 3); R('#9db955', a + 2, b + 1, 5, 2); R('#b9cf6c', a + 3, b, 3, 1); R('#557a30', a + 6, b + 2, 2, 3);
        }
      } else if (t === 'm') {
        for (const [qx, qy, hgt] of [[8, 1, 9], [3, 5, 9]]) {
          const cx = ox + qx, top = oy + qy;
          for (let r = 0; r < hgt; r++) { R('#6d6a66', cx - Math.min(r, 6), top + r, 2 * Math.min(r, 6) + 1, 1); R('#a5a29b', cx - Math.min(r, 6), top + r, Math.min(r, 6) + 1, 1); }
          R('#f4f4f4', cx, top, 1, 1); R('#f4f4f4', cx - 1, top + 1, 3, 1); R('#dcdcdc', cx - 2, top + 2, 2, 1);
        }
      }
    }
  }
  // Roads and bridges, joined to neighbouring road tiles.
  const isRoad = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && (MAP.road[ty][tx] || MAP.cityGrid[ty * W + tx] >= 0);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (!MAP.road[ty][tx]) continue;
    const ox = tx * 16, oy = ty * 16, water = MAP.t[ty][tx] === 'w';
    const edge = water ? '#4d2f18' : '#a07f4a', mid = water ? '#9a6a35' : '#d2b077';
    const seg = (a, b, w, h) => { R(edge, ox + a - (w < h ? 1 : 0), oy + b - (w < h ? 0 : 1), w + (w < h ? 2 : 0), h + (w < h ? 0 : 2)); };
    const fill = (a, b, w, h) => R(mid, ox + a, oy + b, w, h);
    const n = isRoad(tx, ty - 1), s = isRoad(tx, ty + 1), w = isRoad(tx - 1, ty), e = isRoad(tx + 1, ty);
    if (n) seg(7, 0, 2, 9); if (s) seg(7, 7, 2, 9); if (w) seg(0, 7, 9, 2); if (e) seg(7, 7, 9, 2);
    if (n) fill(7, 0, 2, 9); if (s) fill(7, 7, 2, 9); if (w) fill(0, 7, 9, 2); if (e) fill(7, 7, 9, 2);
    if (water) for (let i = 1; i < 16; i += 3) { if (w || e) R('#4d2f18', ox + i, oy + 7, 1, 2); if (n || s) R('#4d2f18', ox + 7, oy + i, 2, 1); }
  }
  return c;
}
