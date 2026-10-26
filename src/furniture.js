// ═══════════════════════════════════════════════════
// FURNITURE — 3D fit-out for every zone type. Mirrors the v0.1 drawRoomFurniture
// vocabulary (galleries, dining, bars, wards, counters, platforms, rides…) but
// as real geometry. Everything lands in shared GeoBuilders; the few animated
// set-pieces (ride cars, trains, carousels, spotlights) become their own meshes.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { lighten, darken } from './util.js';
import { groundTexture, boardTexture } from './textures.js';

const C = {
  wood: '#8b5a2b', darkwood: '#5b3a1e', lightwood: '#c49a6c', metal: '#a5adb5', darkmetal: '#4a4f57',
  white: '#ececec', black: '#232323', red: '#b33a3a', gold: '#d4a017', green: '#3e7d4a', leaf: '#4f8f3f',
  leaf2: '#3d7a35', pot: '#8a5a3c', fabric: '#6d4c8a', blue: '#2e5f9e', glass: '#9fd4e8', screen: '#5ad1ff',
};

// rotate a local offset (dx,dz) by yaw ry (facing = +z at ry=0)
function rot(dx, dz, ry) { const c = Math.cos(ry), s = Math.sin(ry); return [dx * c + dz * s, -dx * s + dz * c]; }

// ── composite props (world coords, y = floor height of the room) ──────────
export const P = {
  chair(B, x, y, z, ry, col = C.darkwood) {
    B.box(x, y + 0.40, z, 0.46, 0.07, 0.46, col, ry);
    B.cyl(x, y, z, 0.04, 0.40, C.darkmetal, 6);
    const [bx, bz] = rot(0, -0.2, ry);
    B.box(x + bx, y + 0.47, z + bz, 0.46, 0.5, 0.07, col, ry);
  },
  stool(B, x, y, z, col = C.red) {
    B.cyl(x, y, z, 0.04, 0.72, C.darkmetal, 6);
    B.cyl(x, y + 0.72, z, 0.2, 0.07, col, 10);
  },
  table(B, x, y, z, w, d, col = C.wood, ry = 0, h = 0.74) {
    B.box(x, y + h - 0.05, z, w, 0.05, d, col, ry);
    B.cyl(x, y, z, 0.06, h - 0.05, C.darkmetal, 6);
    B.cyl(x, y, z, 0.25, 0.03, C.darkmetal, 10);
  },
  roundTable(B, x, y, z, r, col = C.wood, h = 0.74) {
    B.cyl(x, y + h - 0.05, z, r, 0.05, col, 14);
    B.cyl(x, y, z, 0.06, h - 0.05, C.darkmetal, 6);
    B.cyl(x, y, z, 0.25, 0.03, C.darkmetal, 10);
  },
  diningSet(B, x, y, z, rng, round = false, col = C.wood, chairCol = C.darkwood) {
    if (round) {
      P.roundTable(B, x, y, z, 0.55, col);
      const n = 4, o = rng() * Math.PI;
      for (let i = 0; i < n; i++) { const a = o + i * Math.PI * 2 / n; P.chair(B, x + Math.sin(a) * 0.85, y, z + Math.cos(a) * 0.85, a + Math.PI, chairCol); }
    } else {
      P.table(B, x, y, z, 1.2, 0.8, col);
      P.chair(B, x - 0.3, y, z - 0.7, 0, chairCol); P.chair(B, x + 0.3, y, z - 0.7, 0, chairCol);
      P.chair(B, x - 0.3, y, z + 0.7, Math.PI, chairCol); P.chair(B, x + 0.3, y, z + 0.7, Math.PI, chairCol);
    }
    B.box(x, y + 0.74, z, 0.22, 0.02, 0.22, C.white); // plate
  },
  sofa(B, x, y, z, ry, len = 2.0, col = C.fabric) {
    B.box(x, y, z, len, 0.42, 0.85, col, ry);
    const [bx, bz] = rot(0, -0.34, ry);
    B.box(x + bx, y + 0.42, z + bz, len, 0.45, 0.18, darken(col, 0.15), ry);
    for (const s of [-1, 1]) { const [ax, az] = rot(s * (len / 2 - 0.09), 0, ry); B.box(x + ax, y + 0.42, z + az, 0.18, 0.22, 0.85, darken(col, 0.1), ry); }
  },
  seatRow(B, x, y, z, ry, n, col = '#3d5a80') {
    const [ox, oz] = rot(1, 0, ry);
    B.box(x, y, z, 0.12, 0.02, 0.1, C.darkmetal);
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * 0.55;
      const sx = x + ox * t, sz = z + oz * t;
      B.box(sx, y + 0.42, sz, 0.48, 0.07, 0.46, col, ry);
      const [bx, bz] = rot(0, -0.21, ry);
      B.box(sx + bx, y + 0.49, sz + bz, 0.48, 0.45, 0.06, darken(col, 0.15), ry);
    }
    const [lx, lz] = rot(1, 0, ry);
    const L = n * 0.55;
    B.box(x, y + 0.2, z, Math.abs(lx) * L + 0.1, 0.06, Math.abs(lz) * L + 0.1, C.darkmetal);
  },
  desk(B, G, x, y, z, ry, { monitor = true, col = C.lightwood, w = 1.4 } = {}) {
    B.box(x, y + 0.72, z, w, 0.04, 0.7, col, ry);
    for (const s of [-1, 1]) { const [lx, lz] = rot(s * (w / 2 - 0.05), 0, ry); B.box(x + lx, y, z + lz, 0.05, 0.72, 0.66, darken(col, 0.2), ry); }
    if (monitor) P.monitor(B, G, x, y + 0.76, z, ry);
  },
  monitor(B, G, x, y, z, ry, scale = 1, glow = C.screen) {
    const [mx, mz] = rot(0, -0.12 * scale, ry);
    B.box(x + mx, y, z + mz, 0.08 * scale, 0.2 * scale, 0.08 * scale, C.black, ry);
    B.box(x + mx, y + 0.2 * scale, z + mz, 0.55 * scale, 0.34 * scale, 0.04 * scale, C.black, ry);
    const [gx, gz] = rot(0, -0.12 * scale + 0.025 * scale, ry);
    G.box(x + gx, y + 0.22 * scale, z + gz, 0.49 * scale, 0.28 * scale, 0.01, glow, ry);
  },
  counter(B, x, y, z, ry, len, { col = C.wood, top = null, h = 1.05, d = 0.7 } = {}) {
    B.box(x, y, z, len, h - 0.05, d, col, ry);
    B.box(x, y + h - 0.05, z, len + 0.06, 0.05, d + 0.08, top || lighten(col, 0.35), ry);
  },
  shelf(B, x, y, z, ry, len, h, rng, { col = C.darkwood, items = null, d = 0.45, levels = 4 } = {}) {
    const [bx, bz] = rot(0, -d / 2 + 0.02, ry);
    B.box(x + bx, y, z + bz, len, h, 0.04, darken(col, 0.15), ry);
    for (const s of [-1, 1]) { const [sx, sz] = rot(s * len / 2, 0, ry); B.box(x + sx, y, z + sz, 0.04, h, d, col, ry); }
    const pal = items || ['#b33a3a', '#2e5f9e', '#d4a017', '#3e7d4a', '#6d4c8a', '#c06c2a', '#ececec'];
    for (let l = 0; l < levels; l++) {
      const ly = y + 0.08 + l * (h - 0.1) / levels;
      B.box(x, ly, z, len, 0.03, d, col, ry);
      let t = -len / 2 + 0.06;
      while (t < len / 2 - 0.1) {
        const iw = 0.05 + rng() * 0.12, ih = 0.12 + rng() * ((h - 0.1) / levels - 0.18);
        if (rng() > 0.12) { const [ix, iz] = rot(t + iw / 2, 0, ry); B.box(x + ix, ly + 0.03, z + iz, iw, ih, d * 0.8, pal[Math.floor(rng() * pal.length)], ry); }
        t += iw + 0.01;
      }
    }
  },
  plant(B, x, y, z, s = 1, rng = Math.random) {
    B.cyl(x, y, z, 0.2 * s, 0.38 * s, C.pot, 10);
    B.sphere(x, y + 0.62 * s, z, 0.32 * s, C.leaf);
    B.sphere(x + 0.12 * s, y + 0.82 * s, z - 0.06 * s, 0.22 * s, C.leaf2);
    B.sphere(x - 0.1 * s, y + 0.75 * s, z + 0.1 * s, 0.2 * s, lighten(C.leaf, 0.1 * rng()));
  },
  tree(B, x, y, z, s = 1, rng = Math.random) {
    B.cyl(x, y, z, 0.15 * s, 2.2 * s, '#6b4a2f', 7);
    const g = ['#3f7a35', '#4b8a3d', '#356b2e'];
    B.sphere(x, y + 2.7 * s, z, 1.2 * s, g[Math.floor(rng() * 3)], 0.9);
    B.sphere(x + 0.5 * s, y + 3.2 * s, z + 0.2 * s, 0.85 * s, g[Math.floor(rng() * 3)]);
    B.sphere(x - 0.45 * s, y + 3.1 * s, z - 0.3 * s, 0.8 * s, g[Math.floor(rng() * 3)]);
  },
  conifer(B, x, y, z, s = 1) {
    B.cyl(x, y, z, 0.12 * s, 0.8 * s, '#5b3f28', 6);
    B.cone(x, y + 0.6 * s, z, 1.0 * s, 2.0 * s, '#2f5f34', 8);
    B.cone(x, y + 1.6 * s, z, 0.75 * s, 1.6 * s, '#376b3a', 8);
  },
  bench(B, x, y, z, ry, len = 1.8) {
    B.box(x, y + 0.42, z, len, 0.06, 0.45, C.wood, ry);
    const [bx, bz] = rot(0, -0.2, ry);
    B.box(x + bx, y + 0.5, z + bz, len, 0.35, 0.05, C.wood, ry);
    for (const s of [-1, 1]) { const [lx, lz] = rot(s * (len / 2 - 0.15), 0, ry); B.box(x + lx, y, z + lz, 0.06, 0.42, 0.42, C.darkmetal, ry); }
  },
  lamp(B, G, x, y, z, h = 4.2) {
    B.cyl(x, y, z, 0.07, h, '#3a3d42', 8);
    B.cyl(x, y, z, 0.18, 0.2, '#3a3d42', 8);
    B.box(x, y + h, z, 0.5, 0.12, 0.3, '#3a3d42');
    G.box(x, y + h - 0.06, z, 0.4, 0.05, 0.22, '#fff2b0');
  },
  bin(B, x, y, z) { B.cyl(x, y, z, 0.24, 0.85, '#2f4f3a', 10); B.cyl(x, y + 0.85, z, 0.26, 0.05, '#243c2c', 10); },
  hydrant(B, x, y, z) { B.cyl(x, y, z, 0.14, 0.6, '#c62828', 8); B.sphere(x, y + 0.62, z, 0.14, '#c62828'); B.cylC(x, y + 0.42, z, 0.06, 0.4, '#a01f1f', 6, 0, 0, Math.PI / 2); },
  bollard(B, x, y, z) { B.cyl(x, y, z, 0.11, 0.9, '#d4d4d4', 8); B.cyl(x, y + 0.7, z, 0.115, 0.1, '#ffb300', 8); },
  cone(B, x, y, z) { B.box(x, y, z, 0.4, 0.04, 0.4, '#ef6c00'); B.cone(x, y + 0.04, z, 0.16, 0.6, '#ff8f00', 8); B.cyl(x, y + 0.3, z, 0.11, 0.08, '#ffffff', 8); },
  newsbox(B, x, y, z, ry) { B.box(x, y, z, 0.5, 1.0, 0.45, '#1e5aa8', ry); B.box(x, y + 1.0, z, 0.52, 0.05, 0.47, '#164a8a', ry); },
  car(B, G, x, y, z, ry, col) {
    B.box(x, y + 0.3, z, 1.8, 0.62, 4.2, col, ry);
    const [cx, cz] = rot(0, -0.2, ry);
    B.box(x + cx, y + 0.92, z + cz, 1.6, 0.55, 2.2, darken(col, 0.15), ry);
    B.box(x + cx, y + 0.95, z + cz, 1.64, 0.42, 1.9, '#2a3640', ry);
    for (const [wx, wz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
      const [ox, oz] = rot(wx, wz, ry);
      B.cylC(x + ox, y + 0.34, z + oz, 0.34, 0.24, '#151515', 10, ry, 0, Math.PI / 2);
    }
    for (const s of [-1, 1]) {
      const [hx, hz] = rot(s * 0.6, 2.1, ry); G.box(x + hx, y + 0.62, z + hz, 0.35, 0.14, 0.04, '#fff6d0', ry);
      const [tx, tz] = rot(s * 0.6, -2.1, ry); G.box(x + tx, y + 0.65, z + tz, 0.35, 0.12, 0.04, '#ff3030', ry);
    }
  },
  rope(B, x1, z1, x2, z2, y, posts = true) {
    const len = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(x2 - x1, z2 - z1);
    B.box((x1 + x2) / 2, y + 0.82, (z1 + z2) / 2, 0.05, 0.05, len, '#9e1b1b', ry);
    if (posts) { P.post(B, x1, y, z1); P.post(B, x2, y, z2); }
  },
  post(B, x, y, z) { B.cyl(x, y, z, 0.18, 0.04, C.gold, 10); B.cyl(x, y, z, 0.035, 0.92, C.gold, 6); B.sphere(x, y + 0.94, z, 0.06, C.gold); },
  pedestal(B, x, y, z, rng) {
    B.box(x, y, z, 0.7, 1.0, 0.7, '#f1efe8');
    const pal = ['#c9a227', '#9aa3ad', '#7a5c3e', '#d9d4c7', '#3f6f8f'];
    const col = pal[Math.floor(rng() * pal.length)], k = Math.floor(rng() * 4);
    if (k === 0) B.sphere(x, y + 1.3, z, 0.3, col);
    else if (k === 1) B.oct(x, y + 1.35, z, 0.35, col);
    else if (k === 2) B.cone(x, y + 1.0, z, 0.25, 0.8, col, 6);
    else { B.box(x, y + 1.0, z, 0.15, 0.8, 0.15, col, rng() * 3); B.sphere(x, y + 1.9, z, 0.18, col); }
  },
  bed(B, G, x, y, z, ry) {
    B.box(x, y + 0.3, z, 1.0, 0.3, 2.1, '#c8ced6', ry);
    B.box(x, y + 0.6, z, 0.95, 0.14, 2.0, '#f4f6f8', ry);
    const [px, pz] = rot(0, -0.8, ry); B.box(x + px, y + 0.74, z + pz, 0.6, 0.1, 0.35, '#ffffff', ry);
    const [bx, bz] = rot(0, 0.3, ry); B.box(x + bx, y + 0.74, z + bz, 0.92, 0.06, 1.1, '#8fb8d8', ry);
    for (const [lx, lz] of [[-0.45, 0.95], [0.45, 0.95], [-0.45, -0.95], [0.45, -0.95]]) { const [ox, oz] = rot(lx, lz, ry); B.cyl(x + ox, y, z + oz, 0.03, 0.3, C.metal, 6); }
    const [hx, hz] = rot(0, -1.08, ry); B.box(x + hx, y, z + hz, 1.0, 1.0, 0.05, '#aab3bd', ry);
    // IV + monitor
    const [ix, iz] = rot(0.75, -0.7, ry); B.cyl(x + ix, y, z + iz, 0.02, 1.8, C.metal, 6); B.box(x + ix, y + 1.6, z + iz, 0.14, 0.22, 0.05, '#dff3ff', ry);
    const [mx, mz] = rot(-0.75, -0.8, ry); B.cyl(x + mx, y, z + mz, 0.03, 1.2, C.darkmetal, 6); B.box(x + mx, y + 1.2, z + mz, 0.4, 0.3, 0.12, C.black, ry);
    const [gx, gz] = rot(-0.75, -0.73, ry); G.box(x + gx, y + 1.25, z + gz, 0.34, 0.22, 0.01, '#33ff99', ry);
  },
  vending(B, G, x, y, z, ry, col = '#b71c1c') {
    B.box(x, y, z, 0.9, 1.85, 0.75, col, ry);
    const [gx, gz] = rot(-0.12, 0.38, ry); G.box(x + gx, y + 0.55, z + gz, 0.55, 1.1, 0.02, '#e8f7ff', ry);
  },
  kiosk(B, G, x, y, z, ry, glow = C.screen) {
    B.box(x, y, z, 0.5, 1.1, 0.35, '#37474f', ry);
    B.boxC(x, y + 1.35, z, 0.6, 0.5, 0.08, '#263238', ry, -0.35);
    const [gx, gz] = rot(0, 0.05, ry); G.boxC(x + gx, y + 1.36, z + gz, 0.5, 0.4, 0.02, glow, ry, -0.35);
  },
  arcade(B, G, x, y, z, ry, col) {
    B.box(x, y, z, 0.8, 1.7, 0.75, col, ry);
    const [sx, sz] = rot(0, 0.3, ry); G.boxC(x + sx, y + 1.3, z + sz, 0.6, 0.45, 0.02, ['#00e5ff', '#ff4081', '#b2ff59', '#ffd740'][Math.floor(Math.abs(x * 7 + z * 3)) % 4], ry, -0.2);
    const [cx, cz] = rot(0, 0.42, ry); B.box(x + cx, y + 0.9, z + cz, 0.8, 0.1, 0.25, darken(col, 0.3), ry);
    G.box(x, y + 1.7, z, 0.8, 0.18, 0.75, lighten(col, 0.4), ry);
  },
  screenWall(WB, WG, x, y, z, ry, w, h, glow = '#1a2a44') {
    WB.box(x, y, z, w + 0.12, h + 0.12, 0.08, C.black, ry);
    const [gx, gz] = rot(0, 0.05, ry); WG.box(x + gx, y + 0.06, z + gz, w, h, 0.01, glow, ry);
  },
  painting(WB, x, y, z, ry, w, h, col) {
    WB.box(x, y, z, w + 0.16, h + 0.16, 0.06, '#b8902f', ry);
    const [cx, cz] = rot(0, 0.035, ry); WB.box(x + cx, y + 0.08, z + cz, w, h, 0.01, col, ry);
    const [dx, dz] = rot(w * 0.1, 0.04, ry); WB.box(x + dx, y + 0.08 + h * 0.3, z + dz, w * 0.4, h * 0.35, 0.01, lighten(col, 0.4), ry);
  },
  turnstile(B, x, y, z, ry) {
    B.box(x, y, z, 0.25, 1.0, 1.0, '#90a4ae', ry);
    const [ax, az] = rot(0.35, 0, ry); B.boxC(x + ax, y + 0.9, z + az, 0.5, 0.04, 0.04, '#cfd8dc', ry);
  },
};

// ── zone type resolution ──────────────────────────────────────────────────
const RULES = [
  ['platform', 'platform'], ['section', 'stands'], ['kids', 'playground'], ['water ride', 'waterride'],
  ['coaster', 'coaster'], ['ride', 'coaster'], ['show', 'stage'], ['stage', 'stage'], ['arcade', 'arcade'],
  ['baggage', 'carousel'], ['security', 'security'], ['check-in', 'checkin'], ['ticket', 'tickethall'],
  ['concession', 'concession'], ['food court', 'foodcourt'], ['gate area', 'gates'], ['entry gates', 'turnstiles'],
  ['main gate', 'turnstiles'], ['gallery', 'gallery'], ['exhibit', 'gallery'], ['sculpture', 'sculpture'],
  ['pharmacy', 'pharmacy'], ['radiology', 'radiology'], ['ward', 'ward'], ['emergency', 'ward'],
  ['kitchen', 'kitchen'], ['restroom', 'restroom'], ['library', 'library'], ['lab', 'lab'], ['computer', 'lab'],
  ['lecture', 'lecture'], ['conference', 'conference'], ['vault', 'vault'], ['atm', 'atm'], ['teller', 'teller'],
  ['self', 'selfserve'], ['info board', 'infoboard'], ['info', 'info'], ['host', 'host'], ['front desk', 'reception'],
  ['reception', 'reception'], ['cafeteria', 'dining'], ['cafe', 'cafe'], ['coffee', 'cafe'], ['dining', 'dining'],
  ['restaurant', 'dining'], ['bar', 'bar'], ['fitting', 'fitting'], ['clothing', 'clothing'], ['electronics', 'electronics'],
  ['merch', 'shop'], ['shop', 'shop'], ['home', 'shop'], ['duty', 'shop'], ['checkout', 'checkout'],
  ['cust', 'service'], ['service counter', 'servicecounters'], ['doc', 'docs'], ['manager', 'office'], ['admin', 'office'],
  ['advisory', 'office'], ['office', 'office'], ['pool', 'pool'], ['spa', 'spa'], ['patio', 'patio'], ['quad', 'quad'],
  ['queue', 'queue'], ['arrivals', 'arrivals'], ['elevator', 'elevator'], ['lobby', 'lobby'], ['lounge', 'lounge'],
  ['waiting', 'waiting'], ['concourse', 'concourse'], ['passage', 'concourse'], ['entrance', 'entrance'],
  ['exit', 'entrance'], ['hall', 'entrance'],
];
export function furnitureType(name) {
  const nm = name.toLowerCase();
  for (const [k, t] of RULES) if (nm.includes(k)) return t;
  return 'generic';
}

// ── room fit-out ───────────────────────────────────────────────────────────
// ctx: { B, WB, G, WG, T, group, updaters, staffSpots, rng, room, f, gaps, color }
// f: { X0, Z0, W, D, y }  — room interior in world metres (y = floor top)
export function furnishRoom(ctx) {
  const t = furnitureType(ctx.room.name);
  const fn = FIT[t] || FIT.generic;
  fn(ctx);
  cornerPlants(ctx, t);
}

const X = (f, u) => f.X0 + u, Z = (f, v) => f.Z0 + v;
// wall placement: side N (v=0), S (v=D), W (u=0), E (u=W); t = distance along the wall
function wallPos(f, side, t, off) {
  switch (side) {
    case 'N': return { x: X(f, t), z: Z(f, off), ry: 0 };
    case 'S': return { x: X(f, t), z: Z(f, f.D - off), ry: Math.PI };
    case 'W': return { x: X(f, off), z: Z(f, t), ry: Math.PI / 2 };
    default: return { x: X(f, f.W - off), z: Z(f, t), ry: -Math.PI / 2 };
  }
}
const wallLen = (f, side) => (side === 'N' || side === 'S') ? f.W : f.D;
function wallFree(ctx, side, t, half) {
  for (const [a, b] of ctx.gaps[side]) if (t + half > a - 0.4 && t - half < b + 0.4) return false;
  return true;
}
// evenly spaced free spots along a wall
function wallSpots(ctx, side, spacing, half, margin = 1.0) {
  const L = wallLen(ctx.f, side), out = [];
  const n = Math.max(0, Math.floor((L - margin * 2) / spacing));
  const start = (L - (n - 1) * spacing) / 2;
  for (let i = 0; i < n; i++) { const t = start + i * spacing; if (wallFree(ctx, side, t, half)) out.push(t); }
  return out;
}
// side whose wall has the fewest doorways, preferring longer walls
function quietSide(ctx, prefer = null) {
  const sides = prefer || ['N', 'S', 'W', 'E'];
  return sides.slice().sort((a, b) => (ctx.gaps[a].length - ctx.gaps[b].length) || (wallLen(ctx.f, b) - wallLen(ctx.f, a)))[0];
}
// grid of points inside the room with margins
function grid(f, mu, mv, su, sv) {
  const pts = [];
  const nu = Math.max(1, Math.floor((f.W - mu * 2) / su) + 1), nv = Math.max(1, Math.floor((f.D - mv * 2) / sv) + 1);
  const ou = (f.W - (nu - 1) * su) / 2, ov = (f.D - (nv - 1) * sv) / 2;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) pts.push([X(f, ou + i * su), Z(f, ov + j * sv), i, j]);
  return pts;
}
function cornerPlants(ctx, type) {
  if (['platform', 'stands', 'coaster', 'waterride', 'pool', 'quad', 'patio', 'restroom', 'kitchen', 'vault'].includes(type)) return;
  const { B, f, rng } = ctx;
  for (const [u, v] of [[0.6, 0.6], [f.W - 0.6, 0.6], [0.6, f.D - 0.6], [f.W - 0.6, f.D - 0.6]]) {
    if (rng() < 0.55) P.plant(B, X(f, u), f.y, Z(f, v), 0.9 + rng() * 0.4, rng);
  }
}
function staff(ctx, x, z, ry) { ctx.staffSpots.push({ x, z, ry }); }
function addBoard(ctx, x, y, z, ry, w, h, lines, opts, onWall = true) {
  const tex = boardTexture(lines, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.position.set(x, y, z); m.rotation.y = ry;
  if (onWall) m.userData.wallItem = true;
  ctx.group.add(m);
  return m;
}

const FIT = {
  generic(ctx) {
    const { B, f, rng } = ctx;
    for (const [x, z] of grid(f, 3, 3, 4.5, 4.5)) if (rng() < 0.45) P.diningSet(B, x, f.y, z, rng, rng() < 0.5);
  },

  gallery(ctx) {
    const { B, WB, f, rng, color } = ctx;
    const pal = ['#8b2e2e', '#2e4f8b', '#c49a2e', '#2e7b5b', '#6b2e7b', '#d06030', '#305060', '#a0a040'];
    for (const side of ['N', 'S', 'W', 'E']) for (const t of wallSpots(ctx, side, 4.2, 1.2)) {
      const p = wallPos(f, side, t, 0.06), w = 1.6 + rng() * 1.2, h = 1.1 + rng() * 0.9;
      P.painting(WB, p.x, f.y + 1.2, p.z, p.ry, w, h, pal[Math.floor(rng() * pal.length)]);
      const q = wallPos(f, side, t, 1.1);
      if (rng() < 0.6) { const [ox, oz] = rot(1.0, 0, q.ry); P.rope(B, q.x - ox, q.z - oz, q.x + ox, q.z + oz, f.y); }
      // track light
      const l = wallPos(f, side, t, 0.9); ctx.WG.box(l.x, f.y + 2.85, l.z, 0.2, 0.08, 0.2, '#fff4cc');
    }
    // benches & pedestals down the middle
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    const along = f.W > f.D;
    P.bench(B, cx, f.y, cz, along ? 0 : Math.PI / 2, 2.4);
    for (const s of [-1, 1]) {
      const px = along ? cx + s * f.W * 0.28 : cx, pz = along ? cz : cz + s * f.D * 0.28;
      P.pedestal(B, px, f.y, pz, rng);
    }
    B.box(cx, f.y, cz, along ? f.W * 0.5 : 3.2, 0.01, along ? 3.2 : f.D * 0.5, darken(color, 0.25)); // runner rug
  },
  sculpture(ctx) {
    const { B, f, rng } = ctx;
    for (const [x, z] of grid(f, 3.5, 3.5, 5, 5)) if (rng() < 0.75) P.pedestal(B, x + (rng() - 0.5), f.y, z + (rng() - 0.5), rng);
    FIT.gallery({ ...ctx, B: new GeoBuilder() }); // paintings only (discard central props)
  },

  dining(ctx) {
    const { B, WB, f, rng, color } = ctx;
    B.box(X(f, f.W / 2), f.y, Z(f, f.D / 2), f.W * 0.75, 0.012, f.D * 0.7, darken(color, 0.3));
    for (const [x, z] of grid(f, 2.8, 2.8, 3.4, 3.2)) if (rng() < 0.82) P.diningSet(B, x, f.y, z, rng, rng() < 0.4);
    const side = quietSide(ctx);
    const s = wallSpots(ctx, side, 6, 1.5)[0];
    if (s !== undefined) { const p = wallPos(f, side, s, 0.06); addBoard(ctx, p.x, f.y + 2.0, p.z, p.ry, 2.4, 1.0, ['MENU', 'SOUP .... 6', 'PASTA ... 14', 'SALAD ... 9', 'COFFEE .. 3'], { fg: '#f5f0e0', bg: '#2a2622', size: 11 }); }
  },
  foodcourt(ctx) {
    const { B, G, f, rng } = ctx;
    const side = quietSide(ctx);
    const cols = ['#d84315', '#2e7d32', '#1565c0', '#f9a825', '#6a1b9a', '#00838f'];
    wallSpots(ctx, side, 4.2, 1.8).forEach((t, i) => {
      const p = wallPos(f, side, t, 0.6), col = cols[i % cols.length];
      P.counter(B, p.x, f.y, p.z, p.ry, 3.2, { col, top: '#eeeeee' });
      const q = wallPos(f, side, t, 0.1); B.box(q.x, f.y + 2.4, q.z, 3.4, 0.6, 0.2, darken(col, 0.2), q.ry);
      G.box(q.x + Math.sin(q.ry) * 0.12, f.y + 2.5, q.z + Math.cos(q.ry) * 0.12, 2.6, 0.35, 0.02, lighten(col, 0.5), q.ry);
      const s2 = wallPos(f, side, t, -0.2); staff(ctx, s2.x, s2.z, s2.ry);
    });
    for (const [x, z] of grid(f, 3.5, 4.5, 3.2, 3.2)) if (rng() < 0.7) P.diningSet(B, x, f.y, z, rng, true, '#e0e0e0', '#c62828');
  },
  cafe(ctx) {
    const { B, G, f, rng } = ctx;
    const side = quietSide(ctx), t = wallLen(f, side) / 2;
    const p = wallPos(f, side, t, 1.0);
    P.counter(B, p.x, f.y, p.z, p.ry, Math.min(5, wallLen(f, side) - 2), { col: C.darkwood, top: '#d7ccc8' });
    const m = wallPos(f, side, t + 1.2, 1.0); B.box(m.x, f.y + 1.05, m.z, 0.5, 0.45, 0.4, '#9e9e9e', m.ry); // espresso machine
    const s = wallPos(f, side, t, 0.35); staff(ctx, s.x, s.z, s.ry);
    for (const [x, z] of grid(f, 2.6, 2.6, 2.8, 2.8)) {
      const d = Math.hypot(x - p.x, z - p.z); if (d < 3.5) continue;
      if (rng() < 0.7) P.diningSet(B, x, f.y, z, rng, true, C.lightwood);
    }
  },
  bar(ctx) {
    const { B, G, WB, WG, f, rng } = ctx;
    const side = quietSide(ctx), L = wallLen(f, side);
    const len = Math.min(L - 3, 9), t = L / 2;
    const p = wallPos(f, side, t, 1.6);
    P.counter(B, p.x, f.y, p.z, p.ry, len, { col: '#4e342e', top: '#8d6e63' });
    const s = wallPos(f, side, t, 0.7); staff(ctx, s.x, s.z, s.ry);
    for (let i = 0; i < Math.floor(len / 0.9); i++) {
      const q = wallPos(f, side, t - len / 2 + 0.45 + i * 0.9, 2.4); P.stool(B, q.x, f.y, q.z);
    }
    const sh = wallPos(f, side, t, 0.25);
    P.shelf(B, sh.x, f.y + 1.0, sh.z, sh.ry, len, 1.5, rng, { col: '#3e2723', items: ['#2e7d32', '#6d4c41', '#fbc02d', '#c62828', '#90caf9'], d: 0.3, levels: 3 });
    G.box(sh.x, f.y + 2.52, sh.z, len, 0.04, 0.3, '#ffab40', sh.ry);
    // pool table + cocktail tables
    const ox = X(f, f.W / 2) + Math.sin(p.ry) * 2.5, oz = Z(f, f.D / 2) + Math.cos(p.ry) * 2.5;
    B.box(ox, f.y, oz, 1.3, 0.75, 2.5, '#3e2723'); B.box(ox, f.y + 0.75, oz, 1.15, 0.04, 2.3, '#1b7a3a');
    for (const [x, z] of grid(f, 2.5, 2.5, 3, 3)) {
      if (Math.hypot(x - ox, z - oz) < 2.4 || Math.hypot(x - p.x, z - p.z) < 3.4) continue;
      if (rng() < 0.6) { P.roundTable(B, x, f.y, z, 0.4, '#5d4037', 1.05); P.stool(B, x + 0.6, f.y, z); P.stool(B, x - 0.6, f.y, z); }
    }
    const tv = wallSpots(ctx, side === 'N' || side === 'S' ? 'W' : 'N', 5, 1.2)[0];
    if (tv !== undefined) { const w = wallPos(f, side === 'N' || side === 'S' ? 'W' : 'N', tv, 0.05); P.screenWall(WB, WG, w.x, f.y + 1.6, w.z, w.ry, 1.8, 1.0, '#2a6d3a'); }
  },

  shop(ctx) {
    const { B, f, rng } = ctx;
    const along = f.W >= f.D;
    const n = Math.max(1, Math.floor(((along ? f.D : f.W) - 4) / 3.2));
    for (let i = 0; i < n; i++) {
      const o = 2.6 + i * 3.2;
      const len = (along ? f.W : f.D) * 0.55;
      if (along) P.shelf(B, X(f, f.W / 2), f.y, Z(f, o), 0, len, 1.8, rng, { d: 0.6 });
      else P.shelf(B, X(f, o), f.y, Z(f, f.D / 2), Math.PI / 2, len, 1.8, rng, { d: 0.6 });
    }
    FIT.checkoutDesk(ctx);
  },
  checkoutDesk(ctx) {
    const { B, G, f } = ctx;
    const side = quietSide(ctx, ['S', 'N', 'E', 'W']);
    const t = wallSpots(ctx, side, 3, 1.4, 1.5)[0];
    if (t === undefined) return;
    const p = wallPos(f, side, t, 2.2);
    P.counter(B, p.x, f.y, p.z, p.ry + Math.PI / 2, 2.2, { col: '#455a64', top: '#cfd8dc' });
    P.monitor(B, G, p.x, f.y + 1.05, p.z, p.ry + Math.PI, 0.7);
    const s = wallPos(f, side, t, 1.2); staff(ctx, s.x, s.z, s.ry);
  },
  clothing(ctx) {
    const { B, f, rng } = ctx;
    const pal = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#37474f', '#ef6c00', '#ad1457'];
    for (const [x, z, i, j] of grid(f, 3, 3, 3.6, 3.0)) {
      if ((i + j) % 3 === 0 && rng() < 0.8) { // mannequin
        B.cyl(x, f.y, z, 0.22, 0.05, '#444', 10); B.cyl(x, f.y, z, 0.03, 0.9, '#444', 6);
        B.box(x, f.y + 0.9, z, 0.42, 0.6, 0.22, pal[Math.floor(rng() * pal.length)]); B.sphere(x, f.y + 1.68, z, 0.13, '#e0e0e0');
      } else if (rng() < 0.85) { // clothes rack
        B.box(x, f.y + 1.35, z, 1.6, 0.04, 0.04, C.metal); B.box(x - 0.78, f.y, z, 0.04, 1.37, 0.5, C.metal); B.box(x + 0.78, f.y, z, 0.04, 1.37, 0.5, C.metal);
        for (let k = 0; k < 7; k++) B.box(x - 0.6 + k * 0.2, f.y + 0.55, z, 0.06, 0.78, 0.5, pal[Math.floor(rng() * pal.length)]);
      }
    }
    FIT.checkoutDesk(ctx);
  },
  electronics(ctx) {
    const { B, G, WB, WG, f, rng } = ctx;
    for (const [x, z] of grid(f, 3, 3, 4, 3.4)) {
      if (rng() < 0.2) continue;
      B.box(x, f.y, z, 2.0, 0.85, 1.0, '#eeeeee');
      for (let k = -1; k <= 1; k++) { P.monitor(B, G, x + k * 0.6, f.y + 0.85, z, 0, 0.6, ['#5ad1ff', '#b388ff', '#69f0ae'][(k + 1)]); }
    }
    for (const side of ['N', 'W', 'E']) for (const t of wallSpots(ctx, side, 2.6, 1.1)) {
      const p = wallPos(f, side, t, 0.05); P.screenWall(WB, WG, p.x, f.y + 1.4, p.z, p.ry, 1.9, 1.05, ['#1e88e5', '#8e24aa', '#00897b', '#f4511e'][Math.floor(rng() * 4)]);
    }
    FIT.checkoutDesk(ctx);
  },
  fitting(ctx) {
    const { B, WB, f, rng } = ctx;
    const side = quietSide(ctx);
    for (const t of wallSpots(ctx, side, 1.6, 0.7)) {
      const p = wallPos(f, side, t, 0.8);
      const [lx, lz] = rot(0.78, 0, p.ry);
      B.box(p.x + lx, f.y, p.z + lz, 0.06, 2.2, 1.6, '#d7ccc8', p.ry); B.box(p.x - lx, f.y, p.z - lz, 0.06, 2.2, 1.6, '#d7ccc8', p.ry);
      const [cx, cz] = rot(0, 0.78, p.ry); B.box(p.x + cx, f.y + 0.3, p.z + cz, 1.5, 1.9, 0.03, rng() < 0.5 ? '#8d2b4f' : '#5c2b8d', p.ry);
    }
    for (const [x, z] of grid(f, 4, 4, 5, 5)) if (rng() < 0.5) { B.box(x, f.y, z, 1.6, 0.45, 0.6, '#795548'); }
    const m = wallSpots(ctx, side === 'N' ? 'S' : 'N', 3, 0.6)[0];
    if (m !== undefined) { const p = wallPos(f, side === 'N' ? 'S' : 'N', m, 0.05); WB.box(p.x, f.y + 0.3, p.z, 0.9, 1.9, 0.04, '#cfe8f3', p.ry); }
  },
  checkout(ctx) {
    const { B, G, f } = ctx;
    const n = Math.max(2, Math.floor((f.W - 3) / 3.2));
    for (let i = 0; i < n; i++) {
      const x = X(f, (f.W - (n - 1) * 3.2) / 2 + i * 3.2), z = Z(f, f.D * 0.42);
      P.counter(B, x, f.y, z, Math.PI / 2, 2.6, { col: '#455a64', top: '#263238', h: 0.9, d: 0.8 });
      P.monitor(B, G, x + 0.2, f.y + 0.9, z - 0.8, 0, 0.6);
      G.cyl(x + 0.45, f.y + 2.4, z - 1.1, 0.12, 0.2, i % 2 ? '#69f0ae' : '#ff5252', 8);
      B.cyl(x + 0.45, f.y + 0.9, z - 1.1, 0.02, 1.5, C.metal, 6);
      staff(ctx, x + 0.75, z - 0.6, -Math.PI / 2);
    }
  },
  service(ctx) {
    const { B, G, f, rng } = ctx;
    const side = quietSide(ctx), L = wallLen(f, side);
    const p = wallPos(f, side, L / 2, 2.0);
    P.counter(B, p.x, f.y, p.z, p.ry, Math.min(L - 3, 8), { col: '#8d6e63', top: '#efebe9' });
    for (const k of [-2, 0, 2]) { const q = wallPos(f, side, L / 2 + k, 2.0); P.monitor(B, G, q.x, f.y + 1.05, q.z, q.ry + Math.PI, 0.7); const s = wallPos(f, side, L / 2 + k, 1.1); staff(ctx, s.x, s.z, s.ry); }
    FIT.queueRopes(ctx, side, L / 2, 4.0);
    for (const t of wallSpots(ctx, side === 'N' ? 'S' : 'N', 2.5, 1.2)) { const s = wallPos(f, side === 'N' ? 'S' : 'N', t, 0.6); if (rng() < 0.6) P.chair(B, s.x, f.y, s.z, s.ry, '#5d4037'); }
  },
  queueRopes(ctx, side, t, off) {
    const { B, f } = ctx;
    for (let r = 0; r < 3; r++) {
      const a = wallPos(f, side, t - 2.5, off + r * 1.2), b = wallPos(f, side, t + 2.5, off + r * 1.2);
      P.rope(B, a.x, a.z, b.x, b.z, f.y);
    }
  },

  ward(ctx) {
    const { B, G, f, rng } = ctx;
    for (const side of ['N', 'S']) for (const t of wallSpots(ctx, side, 3.0, 0.9, 1.6)) {
      const p = wallPos(f, side, t, 1.25);
      P.bed(B, G, p.x, f.y, p.z, p.ry + Math.PI);
      const c = wallPos(f, side, t + 1.5, 1.25);
      if (t + 1.5 < wallLen(f, side) - 0.5) B.box(c.x, f.y, c.z, 0.04, 2.1, 2.4, '#b3e5fc', c.ry);
    }
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    P.counter(B, cx, f.y, cz, 0, 3.2, { col: '#eceff1', top: '#90a4ae' });
    P.monitor(B, G, cx - 0.6, f.y + 1.05, cz, Math.PI, 0.7); staff(ctx, cx, cz - 0.9, 0);
    // wheelchair
    const wx = cx + 3, wz = cz + 1.2; B.box(wx, f.y + 0.45, wz, 0.55, 0.06, 0.5, '#37474f'); B.box(wx, f.y + 0.5, wz - 0.25, 0.55, 0.5, 0.05, '#37474f');
    for (const s of [-1, 1]) B.cylC(wx + s * 0.3, f.y + 0.32, wz, 0.32, 0.04, '#212121', 14, 0, 0, Math.PI / 2);
  },
  radiology(ctx) {
    const { B, G, f } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.cylC(cx, f.y + 1.1, cz - 0.6, 1.1, 0.9, '#eceff1', 24, 0, Math.PI / 2, 0);
    G.cylC(cx, f.y + 1.1, cz - 0.6, 0.62, 0.92, '#1c2733', 24, 0, Math.PI / 2, 0);
    B.box(cx, f.y + 0.5, cz + 0.8, 0.7, 0.2, 2.6, '#cfd8dc'); B.box(cx, f.y, cz + 1.2, 0.5, 0.5, 1.2, '#90a4ae');
    const side = quietSide(ctx); const p = wallPos(f, side, wallLen(f, side) / 2, 1.0);
    P.desk(B, G, p.x, f.y, p.z, p.ry, { col: '#eceff1' }); staff(ctx, wallPos(f, side, wallLen(f, side) / 2, 0.4).x, wallPos(f, side, wallLen(f, side) / 2, 0.4).z, p.ry);
  },
  pharmacy(ctx) {
    const { B, G, f, rng } = ctx;
    const side = quietSide(ctx);
    for (const t of wallSpots(ctx, side, 2.4, 1.1)) { const p = wallPos(f, side, t, 0.3); P.shelf(B, p.x, f.y, p.z, p.ry, 2.2, 2.0, rng, { col: '#eceff1', items: ['#ffffff', '#4fc3f7', '#e57373', '#81c784', '#fff176'], d: 0.4, levels: 5 }); }
    const L = wallLen(f, side), c = wallPos(f, side, L / 2, 2.4);
    P.counter(B, c.x, f.y, c.z, c.ry, Math.min(L - 2, 7), { col: '#eceff1', top: '#26a69a' });
    for (const k of [-1.5, 1.5]) { const q = wallPos(f, side, L / 2 + k, 1.6); staff(ctx, q.x, q.z, q.ry); }
    G.box(c.x, f.y + 2.7, c.z, 0.6, 0.6, 0.08, '#00e676', c.ry); // green cross
    FIT.queueRopes(ctx, side, L / 2, 4.2);
  },

  seatsGeneric(ctx, col) {
    const { B, f } = ctx;
    for (const [x, z, i, j] of grid(f, 3, 3, 4.2, 2.4)) if ((j + 1) % 3 !== 0) P.seatRow(B, x, f.y, z, 0, 5, col);
  },
  gates(ctx) {
    const { B, G, f, T } = ctx;
    FIT.seatsGeneric(ctx, '#37474f');
    const side = quietSide(ctx, ['E', 'N', 'W', 'S']);
    const L = wallLen(f, side);
    for (const t of wallSpots(ctx, side, 9, 2)) {
      const p = wallPos(f, side, t, 1.4);
      P.counter(B, p.x, f.y, p.z, p.ry, 2.4, { col: '#263238', top: '#90a4ae' });
      const s = wallPos(f, side, t, 0.7); staff(ctx, s.x, s.z, s.ry);
      addBoard(ctx, wallPos(f, side, t, 0.05).x, f.y + 2.3, wallPos(f, side, t, 0.05).z, p.ry, 2.0, 0.6, ['GATE ' + (1 + Math.floor(t / 9)), 'BOARDING'], { fg: '#ffd54f', bg: '#0d1b2a', w: 192, h: 64, size: 12 });
    }
    // big windows (glass) on that wall
    const w = wallPos(f, side, L / 2, 0.02);
    ctx.windowWalls.push(side);
  },
  stands(ctx) {
    const { B, f } = ctx;
    const cols = ['#1565c0', '#c62828'];
    const team = cols[ctx.room.id.endsWith('B') ? 1 : 0];
    // tiered seating along the north (pitch-side) wall, facing north
    for (let r = 0; r < 4; r++) {
      const v = 0.8 + r * 1.1, h = r * 0.35;
      B.box(X(f, f.W / 2), f.y, Z(f, v), f.W - 1.2, h + 0.02, 1.1, '#6d6d6d');
      for (let u = 1.0; u < f.W - 1.0; u += 0.6) {
        if (!wallFree(ctx, 'N', u, 0.3) && r < 2) continue;
        B.box(X(f, u), f.y + h + 0.02, Z(f, v + 0.1), 0.48, 0.42, 0.42, (Math.floor(u * 1.7) + r) % 7 === 0 ? '#ffffff' : team);
        B.box(X(f, u), f.y + h + 0.44, Z(f, v + 0.3), 0.48, 0.4, 0.06, darken(team, 0.2));
      }
    }
    // standing rail + flat seating behind
    for (const [x, z, i, j] of grid({ ...f, D: f.D }, 3, 7, 5, 3)) if (Z(f, 6.5) < z && j % 2 === 0) P.seatRow(B, x, f.y, z, Math.PI, 7, team);
    ctx.glassWalls.push('N');
  },
  turnstiles(ctx) {
    const { B, G, f } = ctx;
    const n = Math.max(3, Math.floor((f.W - 4) / 1.4));
    for (let i = 0; i < n; i++) P.turnstile(B, X(f, (f.W - (n - 1) * 1.4) / 2 + i * 1.4), f.y, Z(f, f.D * 0.5), 0);
    B.box(X(f, f.W / 2), f.y + 2.8, Z(f, f.D * 0.5), n * 1.4 + 1, 0.5, 0.6, '#455a64');
    G.box(X(f, f.W / 2), f.y + 2.85, Z(f, f.D * 0.5 + 0.31), n * 1.1, 0.3, 0.02, '#69f0ae');
    for (const s of [-1, 1]) { B.box(X(f, f.W / 2) + s * (n * 0.7 + 0.5), f.y, Z(f, f.D * 0.5), 0.5, 2.8, 0.6, '#455a64'); staff(ctx, X(f, f.W / 2) + s * (n * 0.7 + 1.2), Z(f, f.D * 0.5 + 0.8), Math.PI); }
  },
  concourse(ctx) {
    const { B, G, f, rng } = ctx;
    for (const [x, z] of grid(f, 4, 3, 9, 6)) {
      B.cyl(x, f.y, z, 0.35, 3.0, '#9e9e9e', 12);
      if (rng() < 0.5) P.kiosk(B, G, x + 1.2, f.y, z, Math.PI);
      if (rng() < 0.4) P.bin(B, x - 1.0, f.y, z);
    }
  },

  counterGeneric(ctx, n, { col = '#37474f', top = '#cfd8dc', glow = C.screen } = {}) {
    const { B, G, f } = ctx;
    const side = quietSide(ctx);
    const L = wallLen(f, side);
    const spots = wallSpots(ctx, side, Math.max(2.6, L / (n + 1)), 1.1);
    for (const t of spots) {
      const p = wallPos(f, side, t, 1.6);
      P.counter(B, p.x, f.y, p.z, p.ry, 2.0, { col, top });
      P.monitor(B, G, p.x, f.y + 1.05, p.z, p.ry + Math.PI, 0.65, glow);
      const s = wallPos(f, side, t, 0.7); staff(ctx, s.x, s.z, s.ry);
    }
    FIT.queueRopes(ctx, side, L / 2, 3.6);
    const q = wallPos(f, side, L / 2, 3.6);
    (ctx.avoid = ctx.avoid || []).push({ x: q.x, z: q.z, r: 4.5 });
    return side;
  },
  checkin(ctx) {
    const { B, f } = ctx;
    const side = FIT.counterGeneric(ctx, 5, { col: '#1e3a5f', top: '#b0bec5' });
    for (const t of wallSpots(ctx, side, 3, 1.1)) { const p = wallPos(f, side, t, 2.4); B.box(p.x, f.y, p.z, 1.0, 0.35, 0.7, '#424242', p.ry); }
    const s = wallSpots(ctx, side === 'N' ? 'S' : 'N', 5, 1.4)[0];
    if (s !== undefined) { const p = wallPos(f, side === 'N' ? 'S' : 'N', s, 0.05); addBoard(ctx, p.x, f.y + 2.0, p.z, p.ry, 3.0, 1.2, ['DEPARTURES', 'BA117 NYC  08:40', 'LH902 FRA  09:15 DELAY', 'EK004 DXB  09:55', 'QF002 SYD  10:30'], { fg: '#ffd54f', bg: '#0d1b2a', size: 11 }); }
  },
  security(ctx) {
    const { B, G, f } = ctx;
    const n = Math.max(2, Math.floor((f.W - 4) / 4));
    for (let i = 0; i < n; i++) {
      const x = X(f, (f.W - (n - 1) * 4) / 2 + i * 4), z = Z(f, f.D * 0.5);
      // walk-through detector
      B.box(x - 0.55, f.y, z, 0.18, 2.2, 0.5, '#cfd8dc'); B.box(x + 0.55, f.y, z, 0.18, 2.2, 0.5, '#cfd8dc'); B.box(x, f.y + 2.2, z, 1.28, 0.25, 0.5, '#b0bec5');
      G.box(x, f.y + 2.25, z + 0.26, 0.4, 0.1, 0.01, '#76ff03');
      // conveyor + scanner tunnel
      B.box(x + 1.6, f.y, z, 0.7, 0.8, 4.0, '#455a64'); B.box(x + 1.6, f.y + 0.8, z, 0.6, 0.04, 4.0, '#212121');
      B.box(x + 1.6, f.y + 0.8, z, 0.9, 0.9, 1.4, '#78909c');
      staff(ctx, x - 1.0, z + 1.2, Math.PI); staff(ctx, x + 2.4, z - 0.8, -Math.PI / 2);
      for (let k = 0; k < 3; k++) B.box(x + 1.6, f.y + 0.84, z - 1.8 + k * 0.5, 0.45, 0.12, 0.35, '#9e9e9e');
    }
    for (let r = 0; r < 3; r++) { P.rope(B, X(f, 2), Z(f, f.D * 0.5 + 2 + r * 1.2), X(f, f.W - 2), Z(f, f.D * 0.5 + 2 + r * 1.2), f.y); }
  },
  tickethall(ctx) {
    const { B, G, f } = ctx;
    FIT.counterGeneric(ctx, 4, { col: '#5d4037', top: '#d7ccc8' });
    for (const [x, z] of grid(f, 4, 4, 3, 99)) { B.box(x, f.y, Z(f, f.D * 0.6), 0.8, 1.7, 0.6, '#c62828'); G.box(x, f.y + 1.1, Z(f, f.D * 0.6) + 0.31, 0.5, 0.4, 0.01, C.screen); }
  },
  concession(ctx) {
    const { B, G, f } = ctx;
    const side = FIT.counterGeneric(ctx, 4, { col: '#e65100', top: '#fff3e0', glow: '#ffeb3b' });
    const p = wallPos(f, side, wallLen(f, side) / 2, 0.05);
    addBoard(ctx, p.x, f.y + 2.2, p.z, p.ry, 3.4, 0.8, ['HOTDOG 6  NACHOS 7', 'BEER 9   SODA 4'], { fg: '#fff3e0', bg: '#bf360c', w: 256, h: 64, size: 11 });
  },
  servicecounters(ctx) { FIT.counterGeneric(ctx, 5, { col: '#455a64', top: '#eceff1' }); FIT.waitingChairs(ctx, 0.55); },
  teller(ctx) {
    const { B, G, T, f } = ctx;
    const side = FIT.counterGeneric(ctx, 4, { col: '#3e2723', top: '#a1887f' });
    const L = wallLen(f, side), p = wallPos(f, side, L / 2, 1.6);
    T.box(p.x, f.y + 1.05, p.z, L - 2, 1.1, 0.04, C.glass, p.ry);
  },
  docs(ctx) {
    const { B, f, rng } = ctx;
    const side = FIT.counterGeneric(ctx, 2, { col: '#5d4037', top: '#bcaaa4' });
    const back = { N: 'S', S: 'N', W: 'E', E: 'W' }[side];
    for (const t of wallSpots(ctx, back, 2.3, 1.1)) { const p = wallPos(f, back, t, 0.3); P.shelf(B, p.x, f.y, p.z, p.ry, 2.1, 2.2, rng, { items: ['#f5f5dc', '#e0d6b8', '#c9b98f', '#ffffff'], levels: 5 }); }
  },

  lounge(ctx) {
    const { B, G, WB, WG, f, rng, color } = ctx;
    B.box(X(f, f.W / 2), f.y, Z(f, f.D / 2), f.W * 0.6, 0.012, f.D * 0.55, darken(color, 0.3));
    for (const [x, z] of grid(f, 3.5, 3.5, 5.5, 4.5)) {
      if (rng() < 0.15) continue;
      const col = ['#6d4c8a', '#3e6e8e', '#8e5a3e', '#4e7d5b'][Math.floor(rng() * 4)];
      P.sofa(B, x, f.y, z - 1.2, 0, 2.2, col); P.sofa(B, x, f.y, z + 1.2, Math.PI, 2.2, col);
      B.box(x, f.y, z, 1.1, 0.42, 0.6, C.darkwood);
    }
    const side = quietSide(ctx);
    const sp = wallSpots(ctx, side, 3.2, 1.2);
    if (sp[0] !== undefined) { const p = wallPos(f, side, sp[0], 0.45); P.vending(B, G, p.x, f.y, p.z, p.ry); }
    if (sp[1] !== undefined) { const p = wallPos(f, side, sp[1], 0.35); B.box(p.x, f.y, p.z, 0.4, 1.0, 0.4, '#eceff1', p.ry); B.cyl(p.x, f.y + 1.0, p.z, 0.15, 0.4, '#81d4fa', 10); }
    if (sp.length > 2) { const p = wallPos(f, side, sp[sp.length - 1], 0.05); P.screenWall(WB, WG, p.x, f.y + 1.6, p.z, p.ry, 1.8, 1.0, '#2d4e7a'); }
  },
  lobby(ctx) {
    FIT.lounge(ctx);
    const { B, G, f } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.cyl(cx, f.y + 2.6, cz, 0.04, 0.4, C.gold, 6); G.sphere(cx, f.y + 2.5, cz, 0.45, '#fff3c4', 0.5);
  },
  waitingChairs(ctx, density = 0.85) {
    const { B, f, rng } = ctx;
    const avoid = ctx.avoid || [];
    for (const [x, z] of grid(f, 3, 3.4, 4.2, 2.6)) {
      if (avoid.some(a => Math.abs(x - a.x) < a.r + 1.6 && Math.abs(z - a.z) < a.r + 0.6)) continue;
      if (rng() < density) P.seatRow(B, x, f.y, z, 0, 5, '#546e7a');
    }
  },
  waiting(ctx) {
    const { B, G, WB, WG, f } = ctx;
    FIT.waitingChairs(ctx);
    const side = quietSide(ctx), sp = wallSpots(ctx, side, 3.0, 1.0);
    if (sp[0] !== undefined) { const p = wallPos(f, side, sp[0], 0.45); P.vending(B, G, p.x, f.y, p.z, p.ry, '#1565c0'); }
    if (sp[1] !== undefined) { const p = wallPos(f, side, sp[1], 0.05); addBoard(ctx, p.x, f.y + 2.1, p.z, p.ry, 1.6, 0.8, ['NOW SERVING', '  A-047'], { fg: '#ff5252', bg: '#111', w: 160, h: 80, size: 13 }); }
    if (sp.length > 2) { const p = wallPos(f, side, sp[sp.length - 1], 0.05); P.screenWall(WB, WG, p.x, f.y + 1.7, p.z, p.ry, 1.6, 0.9, '#3a5f8a'); }
  },
  reception(ctx) {
    const { B, G, f } = ctx;
    const side = quietSide(ctx), L = wallLen(f, side);
    const p = wallPos(f, side, L / 2, 2.2);
    P.counter(B, p.x, f.y, p.z, p.ry, Math.min(L - 3, 6), { col: '#8d6e63', top: '#efebe9' });
    for (const k of [-1.2, 1.2]) { const q = wallPos(f, side, L / 2 + k, 2.2); P.monitor(B, G, q.x, f.y + 1.05, q.z, q.ry + Math.PI, 0.65); const s = wallPos(f, side, L / 2 + k, 1.3); staff(ctx, s.x, s.z, s.ry); }
    const b = wallPos(f, side, L / 2, 0.05); ctx.WB.box(b.x, f.y + 1.8, b.z, 3.0, 0.7, 0.06, '#3e2723', b.ry);
    ctx.WG.box(b.x + Math.sin(b.ry) * 0.04, f.y + 1.95, b.z + Math.cos(b.ry) * 0.04, 2.4, 0.4, 0.01, '#ffd700', b.ry);
    (ctx.avoid = ctx.avoid || []).push({ x: p.x, z: p.z, r: Math.min(L - 3, 6) / 2 + 1.5 });
    FIT.waitingChairs(ctx, 0.35);
  },
  host(ctx) {
    const { B, G, f, rng } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.box(cx, f.y, cz, 0.9, 1.15, 0.6, '#4e342e'); B.box(cx, f.y + 1.15, cz, 1.0, 0.06, 0.7, '#8d6e63');
    G.box(cx, f.y + 1.21, cz, 0.3, 0.02, 0.2, '#fff8e1');
    staff(ctx, cx, cz - 0.8, 0);
    for (const t of wallSpots(ctx, 'W', 2.2, 0.8)) { const p = wallPos(f, 'W', t, 0.5); P.bench(B, p.x, f.y, p.z, p.ry, 1.6); }
    for (const t of wallSpots(ctx, 'E', 2.2, 0.8)) { const p = wallPos(f, 'E', t, 0.5); P.bench(B, p.x, f.y, p.z, p.ry, 1.6); }
  },
  info(ctx) {
    const { B, G, f } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.cyl(cx, f.y, cz, 1.6, 1.05, '#455a64', 20); B.cyl(cx, f.y + 1.05, cz, 1.7, 0.06, '#cfd8dc', 20);
    B.cyl(cx, f.y, cz, 1.0, 1.1, '#37474f', 20);
    G.box(cx, f.y + 2.6, cz, 0.7, 0.7, 0.7, '#2979ff');
    B.cyl(cx, f.y + 1.1, cz, 0.05, 1.2, C.metal, 6);
    staff(ctx, cx - 0.5, cz + 0.2, Math.PI); staff(ctx, cx + 0.5, cz - 0.2, 0);
    for (const s of [-1, 1]) P.kiosk(B, G, cx + s * Math.min(f.W * 0.35, 5), f.y, cz, s > 0 ? -Math.PI / 2 : Math.PI / 2);
  },
  infoboard(ctx) {
    const { B, G, f } = ctx;
    for (const side of ['N', 'W', 'E']) for (const t of wallSpots(ctx, side, 4, 1.6).slice(0, 2)) {
      const p = wallPos(f, side, t, 0.05);
      addBoard(ctx, p.x, f.y + 1.7, p.z, p.ry, 2.8, 1.5, ['NOTICES', 'PERMITS  -> 3', 'PAYMENTS -> 5', 'FORMS    -> 2', 'OPEN 9-5'], { fg: '#e0f7fa', bg: '#00363a', size: 11 });
    }
    P.kiosk(B, G, X(f, f.W / 2), f.y, Z(f, f.D / 2), Math.PI);
    FIT.waitingChairs(ctx, 0.3);
  },
  selfserve(ctx) {
    const { B, G, f } = ctx;
    for (const [x, z, i, j] of grid(f, 3, 3, 2.2, 4)) if (j % 2 === 0) P.kiosk(B, G, x, f.y, z, Math.PI);
  },
  atm(ctx) {
    const { B, G, f } = ctx;
    for (const side of ['N', 'S', 'W', 'E']) for (const t of wallSpots(ctx, side, 1.8, 0.6)) {
      const p = wallPos(f, side, t, 0.4);
      B.box(p.x, f.y, p.z, 0.9, 1.8, 0.75, '#455a64', p.ry);
      const [gx, gz] = rot(0, 0.38, p.ry); G.boxC(p.x + gx, f.y + 1.35, p.z + gz, 0.5, 0.35, 0.02, '#64ffda', p.ry, -0.2);
      const [kx, kz] = rot(0, 0.45, p.ry); B.box(p.x + kx, f.y + 1.0, p.z + kz, 0.6, 0.06, 0.2, '#263238', p.ry);
    }
  },
  vault(ctx) {
    const { B, WB, f } = ctx;
    const side = quietSide(ctx), L = wallLen(f, side);
    const p = wallPos(f, side, L / 2, 0.3);
    B.cylC(p.x, f.y + 1.4, p.z, 1.35, 0.5, '#9e9e9e', 28, p.ry, Math.PI / 2, 0);
    const [hx, hz] = rot(0, 0.3, p.ry); B.cylC(p.x + hx, f.y + 1.4, p.z + hz, 0.35, 0.2, '#616161', 14, p.ry, Math.PI / 2, 0);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const [sx, sz] = rot(Math.cos(a) * 0.6, 0.4, p.ry); B.boxC(p.x + sx, f.y + 1.4 + Math.sin(a) * 0.6, p.z + sz, 0.08, 0.08, 0.1, '#ffd54f', p.ry); }
    for (const sd of ['W', 'E']) for (const t of wallSpots(ctx, sd, 1.4, 0.65)) {
      const q = wallPos(f, sd, t, 0.2);
      B.box(q.x, f.y, q.z, 1.3, 2.2, 0.35, '#8d8d8d', q.ry);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) { const [ox, oz] = rot(-0.4 + c * 0.4, 0.18, q.ry); B.box(q.x + ox, f.y + 0.15 + r * 0.34, q.z + oz, 0.35, 0.28, 0.02, '#bdbdbd', q.ry); }
    }
    for (const s of [-1, 1]) P.post(B, X(f, f.W / 2) + s * 2, f.y, Z(f, f.D / 2));
    P.rope(B, X(f, f.W / 2) - 2, Z(f, f.D / 2), X(f, f.W / 2) + 2, Z(f, f.D / 2), f.y, false);
  },
  office(ctx) {
    const { B, G, WB, f, rng } = ctx;
    for (const [x, z, i, j] of grid(f, 3, 3, 3.6, 3.4)) {
      if (rng() < 0.15) continue;
      P.desk(B, G, x, f.y, z, 0); P.chair(B, x, f.y, z - 0.75, 0, '#263238');
      if (rng() < 0.4) staff(ctx, x, z - 0.75, 0);
    }
    const side = quietSide(ctx), sp = wallSpots(ctx, side, 1.2, 0.5);
    sp.slice(0, 3).forEach(t => { const p = wallPos(f, side, t, 0.35); B.box(p.x, f.y, p.z, 0.5, 1.35, 0.6, '#78909c', p.ry); });
    if (sp.length > 4) { const p = wallPos(f, side, sp[sp.length - 1], 0.4); B.box(p.x, f.y, p.z, 0.9, 1.1, 0.65, '#cfd8dc', p.ry); }
    const wb = wallSpots(ctx, side === 'N' ? 'S' : 'N', 4, 1.2)[0];
    if (wb !== undefined) { const p = wallPos(f, side === 'N' ? 'S' : 'N', wb, 0.04); WB.box(p.x, f.y + 1.0, p.z, 2.2, 1.1, 0.04, '#fafafa', p.ry); }
  },
  library(ctx) {
    const { B, f, rng } = ctx;
    const along = f.W >= f.D;
    // stacks on one half, reading tables on the other
    for (let k = 0; k < 20; k++) {
      const o = 2.2 + k * 2.2;
      if (o > (along ? f.W : f.D) * 0.5) break;
      if (along) P.shelf(B, X(f, o), f.y, Z(f, f.D * 0.5), Math.PI / 2, f.D * 0.6, 2.2, rng, { levels: 5, d: 0.5 });
      else P.shelf(B, X(f, f.W * 0.5), f.y, Z(f, o), 0, f.W * 0.6, 2.2, rng, { levels: 5, d: 0.5 });
    }
    for (const [x, z] of grid(f, 3, 3, 3.6, 3.2)) {
      if (along ? x < X(f, f.W * 0.55) : z < Z(f, f.D * 0.55)) continue;
      if (rng() < 0.85) { P.table(B, x, f.y, z, 2.0, 1.0, C.lightwood); for (const s of [-1, 1]) for (const e of [-0.5, 0.5]) P.chair(B, x + e, f.y, z + s * 0.75, s > 0 ? Math.PI : 0); B.cyl(x, f.y + 0.74, z, 0.06, 0.35, '#2e7d32', 8); }
    }
  },
  lab(ctx) {
    const { B, G, f, rng } = ctx;
    for (const [x, z, i, j] of grid(f, 2.5, 3, 3.0, 2.6)) {
      P.desk(B, G, x, f.y, z, 0, { col: '#eceff1', w: 1.8, monitor: false });
      P.monitor(B, G, x - 0.45, f.y + 0.76, z, Math.PI, 0.8, ['#5ad1ff', '#69f0ae', '#b388ff'][(i + j) % 3]);
      P.monitor(B, G, x + 0.45, f.y + 0.76, z, Math.PI, 0.8, '#5ad1ff');
      P.chair(B, x - 0.45, f.y, z + 0.7, Math.PI, '#263238'); P.chair(B, x + 0.45, f.y, z + 0.7, Math.PI, '#263238');
    }
    const side = quietSide(ctx); const p = wallPos(f, side, 1.6, 0.5); B.box(p.x, f.y, p.z, 1.0, 1.0, 0.7, '#cfd8dc', p.ry);
  },
  lecture(ctx) {
    const { B, G, WB, WG, f } = ctx;
    const side = quietSide(ctx, ['N', 'S', 'W', 'E']), L = wallLen(f, side);
    const scr = wallPos(f, side, L / 2, 0.05);
    P.screenWall(WB, WG, scr.x, f.y + 1.0, scr.z, scr.ry, Math.min(L * 0.5, 5), 1.8, '#d8e8ff');
    const lec = wallPos(f, side, L / 2 + Math.min(L * 0.3, 4), 1.6);
    B.box(lec.x, f.y, lec.z, 0.7, 1.15, 0.55, C.darkwood, lec.ry); staff(ctx, lec.x + Math.sin(lec.ry) * -0.6, lec.z - Math.cos(lec.ry) * 0.6, lec.ry);
    for (let r = 0; r < 20; r++) {
      const off = 4 + r * 1.5; if (off > (side === 'N' || side === 'S' ? f.D : f.W) - 1.5) break;
      for (const t of [L * 0.3, L * 0.7]) {
        const p = wallPos(f, side, t, off);
        const [dx, dz] = rot(0, 0.35, p.ry);
        B.box(p.x - dx, f.y + 0.72, p.z - dz, Math.min(L * 0.32, 6), 0.04, 0.45, C.lightwood, p.ry);
        P.seatRow(B, p.x, f.y, p.z, p.ry + Math.PI, Math.max(2, Math.floor(Math.min(L * 0.32, 6) / 0.55)), '#7b1f2c');
      }
    }
  },
  conference(ctx) {
    const { B, G, WB, WG, f } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    const along = f.W >= f.D, len = (along ? f.W : f.D) * 0.6;
    B.box(cx, f.y + 0.7, cz, along ? len : 1.6, 0.06, along ? 1.6 : len, '#4e342e');
    B.box(cx, f.y, cz, along ? len - 1 : 0.8, 0.7, along ? 0.8 : len - 1, '#3e2723');
    for (let t = -len / 2 + 0.6; t <= len / 2 - 0.5; t += 0.9) for (const s of [-1, 1]) {
      if (along) P.chair(B, cx + t, f.y, cz + s * 1.15, s > 0 ? Math.PI : 0, '#212121'); else P.chair(B, cx + s * 1.15, f.y, cz + t, s > 0 ? -Math.PI / 2 : Math.PI / 2, '#212121');
    }
    const side = along ? 'W' : 'N'; const p = wallPos(f, side, wallLen(f, side) / 2, 0.05);
    P.screenWall(WB, WG, p.x, f.y + 1.0, p.z, p.ry, 3.0, 1.7, '#3367d6');
  },

  pool(ctx) {
    const { B, f, rng, group, updaters } = ctx;
    const pw = f.W * 0.6, pd = f.D * 0.45, cx = X(f, f.W / 2), cz = Z(f, f.D * 0.42);
    B.box(cx, f.y, cz, pw + 1.0, 0.18, pd + 1.0, '#e0f2f1');
    const tex = groundTexture('water').clone(); tex.needsUpdate = true; tex.repeat.set(pw / 4, pd / 4);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, f.y + 0.2, cz); water.receiveShadow = true;
    group.add(water);
    updaters.push((t) => { tex.offset.set(t * 0.02, Math.sin(t * 0.3) * 0.05); });
    for (let i = 0; i < Math.floor(pw / 1.6); i++) {
      const x = cx - pw / 2 + 0.8 + i * 1.6, z = cz + pd / 2 + 2.2;
      if (z > Z(f, f.D - 1)) break;
      B.box(x, f.y + 0.3, z, 0.7, 0.1, 1.9, '#ffffff', 0); B.box(x, f.y + 0.4, z - 0.85, 0.7, 0.45, 0.1, '#ffffff', 0, 0);
      B.box(x, f.y, z, 0.6, 0.3, 1.6, '#bdbdbd');
      if (i % 3 === 1) { B.cyl(x + 0.8, f.y, z, 0.03, 2.3, '#eeeeee', 6); B.cone(x + 0.8, f.y + 2.0, z, 1.2, 0.5, i % 2 ? '#ef5350' : '#29b6f6', 10); }
    }
  },
  spa(ctx) {
    const { B, f, rng, group, updaters } = ctx;
    const cx = X(f, f.W * 0.3), cz = Z(f, f.D / 2);
    B.cyl(cx, f.y, cz, 2.2, 0.5, '#d7ccc8', 24);
    const tex = groundTexture('water').clone(); tex.needsUpdate = true;
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.15, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, f.y + 0.51, cz); group.add(water);
    updaters.push((t) => { tex.offset.set(Math.sin(t * 0.6) * 0.1, t * 0.03); });
    for (const [x, z] of grid(f, 2.5, 2.5, 2.4, 3)) {
      if (x < X(f, f.W * 0.55)) continue;
      if (rng() < 0.7) { B.box(x, f.y, z, 0.8, 0.45, 2.0, '#efebe9'); B.box(x, f.y + 0.45, z, 0.75, 0.12, 1.9, '#ffffff'); }
    }
    for (let i = 0; i < 6; i++) P.plant(B, cx + Math.cos(i) * 3, f.y, cz + Math.sin(i) * 3, 0.9, rng);
  },
  patio(ctx) {
    const { B, f, rng } = ctx;
    for (const [x, z] of grid(f, 2.8, 2.8, 3.6, 3.6)) {
      if (rng() < 0.25) { P.tree(B, x, f.y, z, 0.7, rng); continue; }
      P.diningSet(B, x, f.y, z, rng, true, '#eeeeee', '#455a64');
      B.cyl(x, f.y + 0.74, z, 0.03, 1.6, '#eeeeee', 6); B.cone(x, f.y + 2.1, z, 1.3, 0.55, rng() < 0.5 ? '#2e7d32' : '#f5f5f5', 12);
    }
  },
  quad(ctx) {
    const { B, f, rng } = ctx;
    B.box(X(f, f.W / 2), f.y, Z(f, f.D / 2), f.W * 0.7, 0.03, f.D * 0.55, '#5f8f4e');
    for (const [x, z, i, j] of grid(f, 3, 3, 7, 6)) {
      if ((i + j) % 2 === 0) P.tree(B, x + (rng() - 0.5) * 2, f.y, z + (rng() - 0.5) * 2, 0.9 + rng() * 0.4, rng);
      else P.bench(B, x, f.y, z, rng() < 0.5 ? 0 : Math.PI / 2);
    }
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.cyl(cx, f.y, cz, 1.6, 0.5, '#bdbdbd', 20); B.cyl(cx, f.y + 0.5, cz, 0.3, 1.0, '#9e9e9e', 10); B.cyl(cx, f.y + 0.48, cz, 1.4, 0.04, '#4fc3f7', 20);
  },
  kitchen(ctx) {
    const { B, G, f, rng } = ctx;
    for (const side of ['N', 'S']) for (const t of wallSpots(ctx, side, 1.0, 0.45)) {
      const p = wallPos(f, side, t, 0.45);
      const k = Math.floor(t * 3) % 5;
      B.box(p.x, f.y, p.z, 0.95, 0.9, 0.8, k === 0 ? '#b0bec5' : '#cfd8dc', p.ry);
      if (k === 1 || k === 2) { G.box(p.x, f.y + 0.91, p.z, 0.25, 0.01, 0.25, '#ff6d00', p.ry); }
      if (k === 0) B.box(p.x, f.y + 0.9, p.z, 0.95, 1.2, 0.8, '#eceff1', p.ry);
    }
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.box(cx, f.y, cz, f.W * 0.45, 0.9, 1.4, '#b0bec5'); B.box(cx, f.y + 0.9, cz, f.W * 0.45 + 0.1, 0.04, 1.5, '#eceff1');
    B.box(cx, f.y + 2.3, cz, f.W * 0.4, 0.5, 1.4, '#90a4ae');
    for (let i = 0; i < 4; i++) staff(ctx, cx - f.W * 0.18 + i * f.W * 0.12, cz + (i % 2 ? 1.1 : -1.1), i % 2 ? Math.PI : 0);
    for (let i = 0; i < 6; i++) B.cyl(cx - 1.5 + i * 0.6, f.y + 0.94, cz + 0.3 * (i % 2 ? 1 : -1), 0.14, 0.18, '#757575', 10);
  },
  restroom(ctx) {
    const { B, f } = ctx;
    const side = quietSide(ctx);
    for (const t of wallSpots(ctx, side, 1.2, 0.55)) {
      const p = wallPos(f, side, t, 0.75);
      const [lx, lz] = rot(0.6, 0, p.ry);
      B.box(p.x + lx, f.y + 0.15, p.z + lz, 0.05, 1.9, 1.5, '#90a4ae', p.ry);
      const [dx, dz] = rot(0, 0.75, p.ry); B.box(p.x + dx, f.y + 0.15, p.z + dz, 1.1, 1.9, 0.04, '#78909c', p.ry);
      const q = wallPos(f, side, t, 0.3); B.box(q.x, f.y, q.z, 0.4, 0.45, 0.55, '#fafafa', q.ry);
    }
    const opp = { N: 'S', S: 'N', W: 'E', E: 'W' }[side];
    for (const t of wallSpots(ctx, opp, 1.1, 0.4)) {
      const p = wallPos(f, opp, t, 0.3);
      B.box(p.x, f.y + 0.8, p.z, 0.6, 0.12, 0.5, '#fafafa', p.ry);
      ctx.WB.box(wallPos(f, opp, t, 0.03).x, f.y + 1.2, wallPos(f, opp, t, 0.03).z, 0.5, 0.7, 0.02, '#cfe8f3', p.ry);
    }
  },

  playground(ctx) {
    const { B, f, rng } = ctx;
    const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'];
    B.box(X(f, f.W / 2), f.y, Z(f, f.D / 2), f.W * 0.7, 0.04, f.D * 0.6, '#ef9a9a');
    for (const [x, z, i, j] of grid(f, 4, 4, 6, 5)) {
      const k = (i * 3 + j) % 4;
      if (k === 0) { // slide tower
        B.box(x, f.y, z, 1.5, 1.6, 1.5, cols[i % 6]); B.cone(x, f.y + 1.6, z, 1.2, 1.2, cols[(i + 2) % 6], 4);
        B.boxC(x + 1.8, f.y + 0.8, z, 0.7, 0.08, 2.5, cols[(i + 3) % 6], Math.PI / 2, 0, 0.6);
      } else if (k === 1) { // ball pit
        B.box(x, f.y, z, 2.6, 0.5, 2.6, '#ffffff');
        for (let b = 0; b < 30; b++) B.sphere(x - 1.1 + rng() * 2.2, f.y + 0.45 + rng() * 0.1, z - 1.1 + rng() * 2.2, 0.12, cols[b % 6]);
      } else if (k === 2) { // blocks
        for (let b = 0; b < 6; b++) B.box(x + (rng() - 0.5) * 2, f.y, z + (rng() - 0.5) * 2, 0.6, 0.6, 0.6, cols[b % 6], rng());
      } else { P.bench(B, x, f.y, z, 0, 1.6); }
    }
  },
  arcade(ctx) {
    const { B, G, f, rng } = ctx;
    const cols = ['#311b92', '#b71c1c', '#004d40', '#e65100', '#1a237e', '#880e4f'];
    for (const side of ['N', 'S', 'W', 'E']) for (const t of wallSpots(ctx, side, 1.0, 0.45)) { const p = wallPos(f, side, t, 0.45); P.arcade(B, G, p.x, f.y, p.z, p.ry, cols[Math.floor(rng() * cols.length)]); }
    for (const [x, z, i, j] of grid(f, 4, 4, 4.5, 4)) if (rng() < 0.6) { P.arcade(B, G, x - 0.45, f.y, z, Math.PI / 2, cols[(i + j) % 6]); P.arcade(B, G, x + 0.45, f.y, z, -Math.PI / 2, cols[(i + j + 2) % 6]); }
    G.box(X(f, f.W / 2), f.y + 2.85, Z(f, f.D / 2), f.W * 0.7, 0.04, 0.12, '#ff4081');
    G.box(X(f, f.W / 2), f.y + 2.85, Z(f, f.D / 2), 0.12, 0.04, f.D * 0.7, '#00e5ff');
  },
  stage(ctx) {
    const { B, G, f, group, updaters } = ctx;
    const side = quietSide(ctx, ['N', 'S', 'W', 'E']), L = wallLen(f, side);
    const depth = Math.min(5, (side === 'N' || side === 'S' ? f.D : f.W) * 0.3);
    const p = wallPos(f, side, L / 2, depth / 2);
    B.box(p.x, f.y, p.z, Math.min(L - 2, 12), 0.9, depth, '#4e342e', p.ry);
    const e = wallPos(f, side, L / 2, depth); G.box(e.x, f.y + 0.88, e.z, Math.min(L - 2, 12), 0.04, 0.06, '#ffd740', e.ry);
    for (const s of [-1, 1]) { const q = wallPos(f, side, L / 2 + s * (Math.min(L - 2, 12) / 2 - 0.5), 0.6); B.box(q.x, f.y + 0.9, q.z, 0.8, 1.5, 0.6, '#212121', q.ry); }
    const cur = wallPos(f, side, L / 2, 0.15); B.box(cur.x, f.y, cur.z, Math.min(L - 2, 12) + 1, 3.0, 0.15, '#7f1d2d', cur.ry);
    staff(ctx, p.x, p.z, p.ry); // performer
    // audience
    for (let r = 0; r < 8; r++) {
      const off = depth + 2.2 + r * 1.3; if (off > (side === 'N' || side === 'S' ? f.D : f.W) - 1.2) break;
      const q = wallPos(f, side, L / 2, off); P.seatRow(B, q.x, f.y, q.z, q.ry + Math.PI, Math.max(4, Math.floor((L - 4) / 0.55) - 2), '#5a1f6b');
    }
    // sweeping spotlights
    const beams = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); const q = wallPos(f, side, L / 2 + s * 4, depth + 6);
      g.position.set(q.x, f.y + 4.5, q.z);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: s > 0 ? 0xfff176 : 0x80deea, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = -3; cone.userData.noShadow = true;
      g.add(cone); group.add(g); beams.push({ g, s, ry: p.ry });
    }
    updaters.push((t) => { for (const b of beams) { b.g.rotation.set(0.55 + Math.sin(t * 0.9 + b.s) * 0.25, b.ry, Math.sin(t * 0.7 * b.s) * 0.4); } });
  },
  coaster(ctx) {
    const { B, G, f, rng, group, updaters } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2), rx = f.W * 0.36, rz = f.D * 0.33;
    const H = 3.6, N = 64;
    // elevated looping track on pillars (with a hill)
    const pts = [];
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, f.y + H + Math.sin(a * 2) * 1.2 + (a < Math.PI ? 1.6 * Math.sin(a) : 0), cz + Math.sin(a) * rz]); }
    for (let i = 0; i < N; i++) {
      const a = pts[i], b = pts[(i + 1) % N];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const ry = Math.atan2(b[0] - a[0], b[2] - a[2]), rxx = -Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2]));
      B.boxC((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 1.1, 0.12, len + 0.05, '#d32f2f', ry, rxx);
      if (i % 4 === 0) B.cyl(a[0], f.y, a[2], 0.12, a[1] - f.y, '#eceff1', 8);
    }
    // station
    B.box(cx + rx, f.y, cz, 3, 0.9, 5, '#8d6e63'); B.box(cx + rx, f.y + 3, cz, 3.4, 0.2, 5.4, '#5d4037');
    staff(ctx, cx + rx + 1.0, cz, -Math.PI / 2);
    // train
    const train = new THREE.Group();
    const cars = [];
    const carGeo = new THREE.BoxGeometry(1.0, 0.6, 1.6);
    const mats = ['#ffeb3b', '#29b6f6', '#66bb6a', '#ab47bc'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(carGeo, mats[k]); m.castShadow = true; cars.push(m); train.add(m); }
    group.add(train);
    const pos = (u) => { const a = ((u % 1) + 1) % 1 * Math.PI * 2; return [cx + Math.cos(a) * rx, f.y + H + Math.sin(a * 2) * 1.2 + (a < Math.PI ? 1.6 * Math.sin(a) : 0) + 0.4, cz + Math.sin(a) * rz]; };
    updaters.push((t) => {
      const base = t * 0.06;
      cars.forEach((m, k) => {
        const u = base - k * 0.022, p = pos(u), q = pos(u + 0.004);
        m.position.set(p[0], p[1], p[2]);
        m.lookAt(q[0], q[1], q[2]);
      });
    });
  },
  waterride(ctx) {
    const { B, f, rng, group, updaters } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2), rx = f.W * 0.34, rz = f.D * 0.32;
    // channel: ring of segments
    const N = 48;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2;
      const ax = cx + Math.cos(a) * rx, az = cz + Math.sin(a) * rz, bx = cx + Math.cos(b) * rx, bz = cz + Math.sin(b) * rz;
      const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      B.box((ax + bx) / 2, f.y, (az + bz) / 2, 2.6, 0.45, len + 0.1, '#8d6e63', ry);
      ctx.G.box((ax + bx) / 2, f.y + 0.45, (az + bz) / 2, 2.0, 0.02, len + 0.1, '#29b6f6', ry);
    }
    // waterfall rock
    B.box(cx - rx, f.y, cz, 3.2, 2.8, 3.2, '#757575'); B.sphere(cx - rx, f.y + 2.8, cz, 1.6, '#6d6d6d', 0.6);
    staff(ctx, cx + rx + 2, cz, -Math.PI / 2);
    const boats = [];
    const geo = new THREE.BoxGeometry(1.4, 0.5, 2.2), mat = new THREE.MeshStandardMaterial({ color: '#ff7043', roughness: 0.6 });
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; boats.push(m); group.add(m); }
    updaters.push((t) => {
      boats.forEach((m, k) => {
        const a = t * 0.12 + k * Math.PI * 2 / 5;
        m.position.set(cx + Math.cos(a) * rx, f.y + 0.55 + Math.sin(t * 2 + k) * 0.05, cz + Math.sin(a) * rz);
        m.rotation.set(0, Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz), Math.sin(t * 1.5 + k) * 0.06);
      });
    });
    for (const [x, z] of grid(f, 2, 2, 6, 6)) if (Math.hypot((x - cx) / rx, (z - cz) / rz) > 1.3 || Math.hypot((x - cx) / rx, (z - cz) / rz) < 0.6) P.tree(B, x, f.y, z, 0.7, rng);
  },
  carousel(ctx) {
    const { B, f, rng, group, updaters } = ctx;
    const along = f.W >= f.D;
    const n = Math.max(1, Math.floor((along ? f.W : f.D) / 12));
    const items = [];
    for (let i = 0; i < n; i++) {
      const cx = along ? X(f, f.W * (i + 0.5) / n) : X(f, f.W / 2), cz = along ? Z(f, f.D / 2) : Z(f, f.D * (i + 0.5) / n);
      const len = Math.min(8, (along ? f.W / n : f.D / n) - 3), wid = 3.2;
      // oval belt
      B.box(cx, f.y, cz, along ? len : wid, 0.55, along ? wid : len, '#546e7a');
      B.box(cx, f.y + 0.55, cz, along ? len - 1.2 : 0.8, 0.45, along ? 0.8 : len - 1.2, '#37474f');
      const g = new THREE.Group(); g.position.set(cx, f.y + 0.6, cz); group.add(g);
      const bags = [];
      const pal = ['#b71c1c', '#0d47a1', '#1b5e20', '#212121', '#4a148c', '#e65100', '#3e2723'];
      for (let k = 0; k < 12; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), new THREE.MeshStandardMaterial({ color: pal[k % pal.length], roughness: 0.7 }));
        m.castShadow = true; g.add(m); bags.push(m);
      }
      items.push({ bags, len: (along ? len : wid) - 0.6, wid: (along ? wid : len) - 0.6 });
    }
    updaters.push((t) => {
      for (const it of items) it.bags.forEach((m, k) => {
        // run around a rounded rectangle
        const perim = 2 * (it.len + it.wid), s = ((t * 0.5 + k * perim / it.bags.length) % perim + perim) % perim;
        let x, z;
        if (s < it.len) { x = -it.len / 2 + s; z = -it.wid / 2; }
        else if (s < it.len + it.wid) { x = it.len / 2; z = -it.wid / 2 + (s - it.len); }
        else if (s < 2 * it.len + it.wid) { x = it.len / 2 - (s - it.len - it.wid); z = it.wid / 2; }
        else { x = -it.len / 2; z = it.wid / 2 - (s - 2 * it.len - it.wid); }
        m.position.set(x, 0.12, z); m.rotation.y = k;
      });
    });
    const side = quietSide(ctx); const sp = wallSpots(ctx, side, 6, 1.5)[0];
    if (sp !== undefined) { const p = wallPos(f, side, sp, 0.05); addBoard(ctx, p.x, f.y + 2.1, p.z, p.ry, 2.6, 1.0, ['BAGGAGE', 'BELT 1  BA117', 'BELT 2  LH902'], { fg: '#ffd54f', bg: '#0d1b2a', size: 11 }); }
    for (let i = 0; i < 6; i++) { const x = X(f, 1.5 + rng() * (f.W - 3)), z = Z(f, 1.2); B.box(x, f.y, z, 0.6, 0.9, 1.2, '#9e9e9e'); }
  },
  arrivals(ctx) {
    const { B, f } = ctx;
    for (let i = 0; i < 6; i++) P.rope(B, X(f, 2 + i * (f.W - 4) / 6), Z(f, f.D * 0.35), X(f, 2 + (i + 1) * (f.W - 4) / 6), Z(f, f.D * 0.35), f.y, true);
    FIT.waitingChairs(ctx, 0.35);
    const side = quietSide(ctx); const sp = wallSpots(ctx, side, 6, 1.5)[0];
    if (sp !== undefined) { const p = wallPos(f, side, sp, 0.05); addBoard(ctx, p.x, f.y + 2.1, p.z, p.ry, 2.8, 1.1, ['ARRIVALS', 'BA118 LHR LANDED', 'AF006 CDG 11:05', 'JL044 HND 11:40'], { fg: '#80d8ff', bg: '#0d1b2a', size: 11 }); }
  },
  queue(ctx) {
    const { B, f } = ctx;
    const rows = Math.max(2, Math.floor((f.D - 3) / 1.3));
    for (let r = 0; r < rows; r++) {
      const z = Z(f, 1.8 + r * 1.3), x1 = X(f, r % 2 ? 1.5 : 3.0), x2 = X(f, r % 2 ? f.W - 3.0 : f.W - 1.5);
      P.rope(B, x1, z, x2, z, f.y);
    }
    const side = quietSide(ctx); const sp = wallSpots(ctx, side, 6, 1.0)[0];
    if (sp !== undefined) { const p = wallPos(f, side, sp, 0.05); addBoard(ctx, p.x, f.y + 2.1, p.z, p.ry, 1.6, 0.8, ['NEXT', ' 112'], { fg: '#ff5252', bg: '#111', w: 128, h: 64, size: 14 }); }
  },
  elevator(ctx) {
    const { B, G, WB, WG, f } = ctx;
    for (const side of ['N', 'S']) for (const t of wallSpots(ctx, side, 3.0, 1.0)) {
      const p = wallPos(f, side, t, 0.06);
      WB.box(p.x, f.y, p.z, 1.6, 2.4, 0.08, '#b0bec5', p.ry);
      const [lx, lz] = rot(0, 0.05, p.ry); WB.box(p.x + lx, f.y, p.z + lz, 0.02, 2.2, 0.01, '#607d8b', p.ry);
      WG.box(p.x, f.y + 2.55, p.z + Math.cos(p.ry) * 0.06, 0.4, 0.15, 0.01, '#ff9100', p.ry);
    }
    P.bench(B, X(f, f.W / 2), f.y, Z(f, f.D / 2), 0, 2.4);
  },
  entrance(ctx) {
    const { B, G, f, rng } = ctx;
    const cx = X(f, f.W / 2), cz = Z(f, f.D / 2);
    B.box(cx, f.y, cz, Math.min(6, f.W * 0.5), 0.015, Math.min(4, f.D * 0.5), '#5d4037');
    B.box(cx, f.y + 0.015, cz, Math.min(5.4, f.W * 0.45), 0.01, Math.min(3.4, f.D * 0.42), '#795548');
    const side = quietSide(ctx);
    const sp = wallSpots(ctx, side, 3.5, 1.2);
    if (sp[0] !== undefined) {
      const p = wallPos(f, side, sp[0], 0.05);
      addBoard(ctx, p.x, f.y + 1.6, p.z, p.ry, 2.2, 1.6, ['DIRECTORY', ...ctx.zoneNames.slice(0, 6).map((n, i) => (i + 1) + ' ' + n.toUpperCase().slice(0, 13))], { fg: '#ffd700', bg: '#1b3a27', w: 192, h: 160, size: 10 });
    }
    if (sp[1] !== undefined) { const p = wallPos(f, side, sp[1], 0.4); B.cyl(p.x, f.y, p.z, 0.22, 0.7, '#37474f', 10); }
    if (f.W > 8 && f.D > 8) {
      const p = wallPos(f, side, wallLen(f, side) * 0.7, 2.0);
      P.counter(B, p.x, f.y, p.z, p.ry, 2.6, { col: '#5d4037', top: '#d7ccc8' });
      P.monitor(B, G, p.x, f.y + 1.05, p.z, p.ry + Math.PI, 0.6);
      const s = wallPos(f, side, wallLen(f, side) * 0.7, 1.2); staff(ctx, s.x, s.z, s.ry);
    }
  },

  platform(ctx) {
    const { B, G, f, group, updaters } = ctx;
    // track bed along the south wall, platform edge with tactile strip
    const trackW = 3.4, v0 = f.D - trackW, ty = 0.02;
    B.box(X(f, f.W / 2), 0, Z(f, v0 + trackW / 2), f.W, ty, trackW, '#3e3a36');
    for (const o of [-0.72, 0.72]) B.box(X(f, f.W / 2), ty + 0.05, Z(f, v0 + trackW / 2 + o), f.W, 0.12, 0.08, '#9e9e9e');
    for (let u = 0.3; u < f.W; u += 0.65) B.box(X(f, u), ty, Z(f, v0 + trackW / 2), 0.22, 0.06, 2.4, '#5d4037');
    G.box(X(f, f.W / 2), f.y + 0.005, Z(f, v0 - 0.35), f.W, 0.01, 0.4, '#ffd600');
    ctx.trackCut = { v0, w: trackW };
    // canopy pillars + benches + signs
    for (let u = 4; u < f.W - 2; u += 8) {
      B.cyl(X(f, u), f.y, Z(f, v0 - 2.5), 0.2, 3.0, '#546e7a', 10);
      P.bench(B, X(f, u + 2.5), f.y, Z(f, v0 - 2.8), Math.PI, 2.0);
      P.bin(B, X(f, u - 1.5), f.y, Z(f, v0 - 2.6));
    }
    addBoard(ctx, X(f, f.W / 2), f.y + 2.6, Z(f, v0 - 2.5), 0, 3.2, 0.7, [ctx.room.name.toUpperCase(), 'NEXT: 10:42  EXPRESS'], { fg: '#ffb300', bg: '#111', w: 256, h: 56, size: 11 }, false);
    // the train: arrives, dwells, departs
    const train = new THREE.Group();
    const carLen = 16, n = Math.max(2, Math.floor(f.W / (carLen + 0.6)));
    const body = new THREE.MeshStandardMaterial({ color: ctx.room.id.endsWith('2') ? '#c62828' : '#1565c0', roughness: 0.4, metalness: 0.3 });
    const win = new THREE.MeshBasicMaterial({ color: '#cfe8ff' });
    const stripe = new THREE.MeshStandardMaterial({ color: '#eeeeee', roughness: 0.5 });
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(carLen, 3.0, 2.9), body); c.position.set(k * (carLen + 0.6), 1.5, 0); c.castShadow = true; train.add(c);
      const w1 = new THREE.Mesh(new THREE.BoxGeometry(carLen - 2, 0.7, 2.92), win); w1.position.set(k * (carLen + 0.6), 2.1, 0); train.add(w1);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(carLen, 0.25, 2.93), stripe); s1.position.set(k * (carLen + 0.6), 1.2, 0); train.add(s1);
    }
    const trainLen = n * (carLen + 0.6);
    train.position.set(0, 0.25, Z(f, v0 + trackW / 2));
    group.add(train);
    const xStop = X(f, (f.W - trainLen) / 2 + carLen / 2), period = 46, phase = ctx.room.id.endsWith('2') ? 21 : 0;
    updaters.push((t) => {
      const c = ((t + phase) % period + period) % period;
      let x;
      if (c < 10) { const k = 1 - c / 10; x = xStop - k * k * 140; }          // arriving (decelerate)
      else if (c < 22) x = xStop;                                               // dwell
      else if (c < 32) { const k = (c - 22) / 10; x = xStop + k * k * 140; }    // departing
      else x = xStop - 400;                                                     // away
      train.position.x = x;
      train.visible = Math.abs(x - xStop) < 160;
    });
  },
};
