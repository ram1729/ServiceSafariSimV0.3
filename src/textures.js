// ═══════════════════════════════════════════════════
// PROCEDURAL TEXTURES — the v0.1 floor patterns (tile, wood, carpet,
// concrete, polished, outdoor) re-drawn as repeating canvas textures, plus
// ground, windows and text labels.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { lighten, darken, hashStr, seededRand } from './util.js';

const cache = new Map();
const isBrowser = typeof document !== 'undefined';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

export function getFloorType(name) {
  const nm = name.toLowerCase();
  if (nm.includes('ward') || nm.includes('emergency') || nm.includes('radiology') || nm.includes('pharmacy') || nm.includes('restroom')) return 'tile';
  if (nm.includes('restaurant') || nm.includes('dining') || nm.includes('bar') || nm.includes('cafe') || nm.includes('library') || nm.includes('stage') || nm.includes('show')) return 'wood';
  if (nm.includes('office') || nm.includes('admin') || nm.includes('lounge') || nm.includes('waiting') || nm.includes('lobby') || nm.includes('room') || nm.includes('suite')) return 'carpet';
  if (nm.includes('kitchen') || nm.includes('warehouse') || nm.includes('storage') || nm.includes('baggage')) return 'concrete';
  if (nm.includes('gallery') || nm.includes('exhibit') || nm.includes('sculpture') || nm.includes('entrance') || nm.includes('hall') || nm.includes('reception')) return 'polished';
  if (nm.includes('pool') || nm.includes('spa') || nm.includes('patio') || nm.includes('quad') || nm.includes('ride') || nm.includes('coaster') || nm.includes('water') || nm.includes('food court')) return 'outdoor';
  return 'tile';
}

// metres covered by one repeat of each floor texture
export const FLOOR_REPEAT_M = { tile: 2.4, wood: 3.2, carpet: 2.0, concrete: 4, polished: 4.8, outdoor: 4 };

export function floorTexture(type, base) {
  const key = 'floor:' + type + base;
  if (cache.has(key)) return cache.get(key);
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, S, S);
  switch (type) {
    case 'tile': {
      const ts = S / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? lighten(base, 0.07) : darken(base, 0.05);
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
      ctx.fillStyle = darken(base, 0.25);
      for (let i = 0; i < 4; i++) { ctx.fillRect(i * ts, 0, 2, S); ctx.fillRect(0, i * ts, S, 2); }
      break;
    }
    case 'wood': {
      const ph = S / 8;
      for (let r = 0; r < 8; r++) {
        ctx.fillStyle = r % 2 === 0 ? lighten(base, 0.05) : darken(base, 0.06);
        ctx.fillRect(0, r * ph, S, ph);
        ctx.strokeStyle = darken(base, 0.3); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, r * ph); ctx.lineTo(S, r * ph); ctx.stroke();
        const off = (r % 3) * 70;
        for (let x = off; x < S + 1; x += 128) { ctx.beginPath(); ctx.moveTo(x % S, r * ph); ctx.lineTo(x % S, r * ph + ph); ctx.stroke(); }
        ctx.strokeStyle = darken(base, 0.12); ctx.lineWidth = 0.6;
        for (let g = 0; g < 4; g++) {
          const gy = r * ph + 4 + seededRand(r, g) * (ph - 8);
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.bezierCurveTo(80, gy + 2, 160, gy - 2, S, gy); ctx.stroke();
        }
      }
      break;
    }
    case 'carpet': {
      ctx.fillStyle = darken(base, 0.06); ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = i % 2 ? lighten(base, 0.05) : darken(base, 0.12);
        ctx.fillRect(seededRand(7, i) * S, seededRand(8, i) * S, 1.5, 1.5);
      }
      ctx.strokeStyle = lighten(base, 0.08); ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, S - 32, S - 32);
      ctx.strokeStyle = darken(base, 0.15); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(S / 2, 40); ctx.lineTo(S - 40, S / 2); ctx.lineTo(S / 2, S - 40); ctx.lineTo(40, S / 2); ctx.closePath(); ctx.stroke();
      break;
    }
    case 'concrete': {
      ctx.fillStyle = darken(base, 0.08); ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = i % 2 ? lighten(base, 0.07) : darken(base, 0.14);
        const s = 1 + seededRand(3, i) * 2.5;
        ctx.fillRect(seededRand(1, i) * S, seededRand(2, i) * S, s, s);
      }
      ctx.strokeStyle = darken(base, 0.25); ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, S, S);
      break;
    }
    case 'polished': {
      const ts = S / 2;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 ? lighten(base, 0.04) : darken(base, 0.02);
        ctx.fillRect(x * ts, y * ts, ts, ts);
        // marble veins
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
        for (let v = 0; v < 3; v++) {
          ctx.beginPath();
          let px = x * ts + seededRand(x + y * 2, v) * ts, py = y * ts;
          ctx.moveTo(px, py);
          for (let k = 1; k <= 6; k++) { px += (seededRand(v + 9, k + x) - 0.5) * 30; py += ts / 6; ctx.lineTo(px, py); }
          ctx.stroke();
        }
      }
      ctx.fillStyle = darken(base, 0.3);
      ctx.fillRect(0, 0, S, 1.5); ctx.fillRect(0, ts, S, 1.5); ctx.fillRect(0, 0, 1.5, S); ctx.fillRect(ts, 0, 1.5, S);
      break;
    }
    case 'outdoor': {
      // paving stones
      const ts = S / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        ctx.fillStyle = [darken(base, 0.08), lighten(base, 0.05), darken(base, 0.03), lighten(base, 0.09)][(x * 3 + y * 5) % 4];
        const o = y % 2 ? ts / 2 : 0;
        ctx.fillRect((x * ts + o) % S, y * ts, ts - 3, ts - 3);
        if (o) ctx.fillRect(-ts / 2, y * ts, ts - 3, ts - 3);
      }
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = i % 2 ? darken(base, 0.18) : lighten(base, 0.12);
        ctx.fillRect(seededRand(11, i) * S, seededRand(12, i) * S, 2, 2);
      }
      break;
    }
  }
  const t = toTex(c);
  cache.set(key, t);
  return t;
}

export function groundTexture(kind) {
  const key = 'ground:' + kind;
  if (cache.has(key)) return cache.get(key);
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d');
  if (kind === 'asphalt') {
    ctx.fillStyle = '#3a3a37'; ctx.fillRect(0, 0, S, S);
    const pal = ['#38382f', '#2e2e2c', '#353530', '#302f2d', '#424139', '#2c2c28'];
    for (let i = 0; i < 2600; i++) { ctx.fillStyle = pal[i % 6]; ctx.fillRect(seededRand(999, i * 2) * S, seededRand(999, i * 2 + 1) * S, 1 + (i % 3), 1 + (i % 2)); }
    ctx.strokeStyle = 'rgba(20,20,18,0.5)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      let x = seededRand(5, i) * S, y = seededRand(6, i) * S;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (seededRand(7, i * 9 + s) - 0.5) * 40; y += (seededRand(8, i * 9 + s) - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  } else if (kind === 'grass') {
    ctx.fillStyle = '#4f6e40'; ctx.fillRect(0, 0, S, S);
    const pal = ['#4e7040', '#5a8048', '#4a6a3e', '#6a8a50', '#44633a'];
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = pal[i % 5]; ctx.fillRect(seededRand(777, i) * S, seededRand(778, i) * S, 2, 3); }
  } else if (kind === 'paving') {
    ctx.fillStyle = '#8a8880'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = ['#8e8c84', '#86847c', '#908e86', '#8a8880'][(x + y * 3) % 4];
      ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
    ctx.strokeStyle = '#6f6d66'; ctx.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(S, i * 32); ctx.stroke(); }
  } else if (kind === 'water') {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#2f8fb0'); g.addColorStop(1, '#3fb0c8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = seededRand(31, i) * S, y = seededRand(32, i) * S;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 10, y - 6, x + 20, y + 6, x + 34, y); ctx.stroke();
    }
  } else if (kind === 'pitch') {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#3f8f3a' : '#4aa043'; ctx.fillRect(0, i * 32, S, 32); }
  }
  const t = toTex(c);
  cache.set(key, t);
  return t;
}

// lit-window façade texture for the skyline around each venue
export function windowsTexture(seed) {
  const key = 'win:' + seed;
  if (cache.has(key)) return cache.get(key);
  const S = 128, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#20262c'; ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const r = seededRand(seed, x + y * 8);
    ctx.fillStyle = r > 0.62 ? (r > 0.9 ? '#ffe9a8' : '#d9b060') : (r > 0.3 ? '#2e3a44' : '#3a4855');
    ctx.fillRect(x * 16 + 3, y * 16 + 4, 10, 9);
  }
  const t = toTex(c);
  cache.set(key, t);
  return t;
}

// pixel-font text label → texture (+ aspect)
export function labelTexture(text, { fg = '#ffd700', bg = 'rgba(13,13,13,0.82)', border = '#4a7c59', size = 22 } = {}) {
  const key = ['lbl', text, fg, bg, border, size].join('|');
  if (cache.has(key)) return cache.get(key);
  const pad = Math.round(size * 0.7);
  const m = canvas(4, 4).getContext('2d');
  m.font = `${size}px "Press Start 2P", monospace`;
  const tw = Math.ceil(m.measureText(text).width);
  const c = canvas(tw + pad * 2, size + pad * 2), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = border; ctx.lineWidth = 4; ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.fillStyle = fg; ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, c.height / 2 + 2);
  const t = toTex(c, false);
  t.minFilter = THREE.LinearFilter;
  const out = { tex: t, aspect: c.width / c.height };
  cache.set(key, out);
  return out;
}

// simple screen texture (departure boards, scoreboards, monitors)
export function boardTexture(lines, { fg = '#ffb000', bg = '#111', w = 256, h = 128, size = 12 } = {}) {
  const key = ['board', lines.join('/'), fg, bg, w, h].join('|');
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.fillStyle = fg; ctx.textBaseline = 'top';
  lines.forEach((ln, i) => ctx.fillText(ln, 8, 8 + i * (size + 7)));
  const t = toTex(c, false);
  cache.set(key, t);
  return t;
}

export function clearTextureCache() { cache.clear(); }
export { isBrowser };
