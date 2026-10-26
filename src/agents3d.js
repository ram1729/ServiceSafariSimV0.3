// ═══════════════════════════════════════════════════
// 3D AGENTS — every visitor is a low-poly humanoid built from instanced
// parts (legs, torso, arms, head, hair, hat, bag) so 2,400 of them render in a
// few draw calls. Positions are interpolated between sim ticks; legs and arms
// swing with walking speed; a spinning mood gem floats overhead.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { toWorldX, toWorldZ } from './config.js';
import { moodColor, darken, clamp } from './util.js';
import { FLOOR_Y } from './world.js';

// mood → colour lookup (0.1 steps)
const MOOD_LUT = [];
for (let i = 0; i <= 100; i++) MOOD_LUT.push(new THREE.Color(moodColor(clamp(i / 10, 1, 10))));
const moodCol = m => MOOD_LUT[Math.round(clamp(m, 0, 10) * 10)];

function partGeos() {
  const g = {};
  g.leg = new THREE.BoxGeometry(0.15, 0.82, 0.17); g.leg.translate(0, -0.41, 0);
  g.shoe = new THREE.BoxGeometry(0.16, 0.09, 0.26); g.shoe.translate(0, -0.82, 0.04);
  g.torso = new THREE.BoxGeometry(0.44, 0.62, 0.25); g.torso.translate(0, 0.31, 0);
  g.arm = new THREE.BoxGeometry(0.11, 0.6, 0.13); g.arm.translate(0, -0.3, 0);
  g.head = new THREE.IcosahedronGeometry(0.13, 1);
  g.hair = new THREE.SphereGeometry(0.142, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.55); g.hair.translate(0, 0.012, -0.008);
  const brim = new THREE.CylinderGeometry(0.22, 0.22, 0.025, 14); brim.translate(0, 0.1, 0);
  const crown = new THREE.CylinderGeometry(0.13, 0.145, 0.16, 14); crown.translate(0, 0.19, 0);
  g.hat = mergeTwo(brim, crown);
  g.bag = new THREE.BoxGeometry(0.1, 0.3, 0.26);
  g.gem = new THREE.OctahedronGeometry(0.15, 0); g.gem.scale(1, 1.45, 1);
  g.blob = new THREE.CircleGeometry(0.34, 16); g.blob.rotateX(-Math.PI / 2);
  return g;
}
function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const pa = a.attributes.position.array, pb = b.attributes.position.array, na = a.attributes.normal.array, nb = b.attributes.normal.array;
  const pos = new Float32Array(pa.length + pb.length); pos.set(pa); pos.set(pb, pa.length);
  const nor = new Float32Array(na.length + nb.length); nor.set(na); nor.set(nb, na.length);
  const ia = a.index.array, ib = b.index.array, off = a.attributes.position.count;
  const idx = new Uint16Array(ia.length + ib.length); idx.set(ia); for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
let GEOS = null;

const TAU = Math.PI * 2;

export class CrowdRenderer {
  constructor(sim, scene, { markerScale = 1, bodyScale = 1 } = {}) {
    if (!GEOS) GEOS = partGeos();
    this.sim = sim;
    this.markerScale = markerScale;
    this.bodyScale = bodyScale; // >1 exaggerates figures for the small grid views
    const n = Math.max(1, sim.agents.length);
    this.n = n;
    const std = (rough = 0.75) => new THREE.MeshStandardMaterial({ roughness: rough, metalness: 0 });
    const mk = (geo, mat, cast = true) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = cast; m.receiveShadow = false; m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.parts = {
      legL: mk(GEOS.leg, std()), legR: mk(GEOS.leg, std()),
      shoeL: mk(GEOS.shoe, std(0.6)), shoeR: mk(GEOS.shoe, std(0.6)),
      torso: mk(GEOS.torso, std()), armL: mk(GEOS.arm, std()), armR: mk(GEOS.arm, std()),
      head: mk(GEOS.head, std(0.6)), hair: mk(GEOS.hair, std(0.9)),
      hat: mk(GEOS.hat, std()), bag: mk(GEOS.bag, std(0.6)),
    };
    this.gem = mk(GEOS.gem, new THREE.MeshBasicMaterial({ toneMapped: false }), false);
    this.blob = mk(GEOS.blob, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), false);
    this.blob.renderOrder = 1;

    // selection ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 32), new THREE.MeshBasicMaterial({ color: '#ffd700', side: THREE.DoubleSide, toneMapped: false, transparent: true, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 3;
    scene.add(this.ring);

    // per-agent render state
    this.yaw = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.amp = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.px = new Float32Array(n);
    this.pz = new Float32Array(n);
    this._colorsFor = new Array(n).fill(null);
    for (let i = 0; i < n; i++) this.phase[i] = Math.random() * TAU;
    this.selected = null;
    this.update(0, 0, 0);
  }

  _setColors(i, a) {
    const L = a.look, c = new THREE.Color();
    const P = this.parts;
    P.legL.setColorAt(i, c.set(L.pants)); P.legR.setColorAt(i, c);
    P.shoeL.setColorAt(i, c.set('#1d1d1d')); P.shoeR.setColorAt(i, c);
    P.torso.setColorAt(i, c.set(L.body));
    P.armL.setColorAt(i, c.set(darken(L.body, 0.12))); P.armR.setColorAt(i, c);
    P.head.setColorAt(i, c.set(L.skin));
    P.hair.setColorAt(i, c.set(L.hair));
    P.hat.setColorAt(i, c.set(darken(L.body, 0.25)));
    P.bag.setColorAt(i, c.set(darken(L.hair === '#1a1a1a' ? '#6d4c41' : L.hair, 0.1)));
    this._colorsFor[i] = a;
  }

  // world position of an agent (interpolated), for cameras / bubbles / picking
  agentWorld(a, alpha, out = new THREE.Vector3()) {
    const x = a.prevX + (a.x - a.prevX) * alpha, y = a.prevY + (a.y - a.prevY) * alpha;
    return out.set(toWorldX(x), FLOOR_Y, toWorldZ(y));
  }
  indexOf(a) { return this.sim.agents.indexOf(a); }

  // alpha: 0..1 between sim ticks · dt: seconds since last frame · tickSec: seconds per sim tick
  update(alpha, dt, t, tickSec = 0.1) {
    const agents = this.sim.agents, P = this.parts;
    const count = Math.min(agents.length, this.n);
    let colorsDirty = false;
    const ms = this.markerScale;

    for (let i = 0; i < count; i++) {
      const a = agents[i];
      if (this._colorsFor[i] !== a) { this._setColors(i, a); colorsDirty = true; }
      const s = (a.look.height || 1) * this.bodyScale;
      const nx = a.prevX + (a.x - a.prevX) * alpha, ny = a.prevY + (a.y - a.prevY) * alpha;
      const x = toWorldX(nx), z = toWorldZ(ny);
      // heading + walking speed from the tick displacement
      const dxw = toWorldX(a.x) - toWorldX(a.prevX), dzw = toWorldZ(a.y) - toWorldZ(a.prevY);
      const step = Math.hypot(dxw, dzw);
      const v = step / tickSec;
      this.speed[i] += (v - this.speed[i]) * Math.min(1, dt * 8);
      if (step > 0.02) {
        const target = Math.atan2(dxw, dzw);
        let d = target - this.yaw[i];
        d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
        this.yaw[i] += d * Math.min(1, dt * 10);
      }
      const moving = this.speed[i] > 0.25;
      const targetAmp = moving ? 0.6 : 0;
      this.amp[i] += (targetAmp - this.amp[i]) * Math.min(1, dt * 6);
      // stride cadence follows speed, capped so time-lapse doesn't strobe
      this.phase[i] += Math.min(this.speed[i] / 1.4, 2.6) * TAU * dt;
      const sw = Math.sin(this.phase[i]) * this.amp[i];

      // idle flavour: frustrated agents throw their arms up, happy ones hop
      let armL = -sw * 0.85, armR = sw * 0.85, hop = 0, bob = Math.abs(Math.sin(this.phase[i])) * 0.04 * this.amp[i];
      if (!moving) {
        if (a.mood < 3 || a.state === 'frustrated') { const w = Math.sin(t * 7 + i); armL = -2.3 - 0.4 * w; armR = -2.3 + 0.4 * w; }
        else if (a.mood > 8.2) { hop = Math.max(0, Math.sin(t * 6 + i * 1.7)) * 0.16; armL = -0.3; armR = -0.3; }
        else if (a.state === 'queuing') { armL = 0.25; armR = -0.15; }
      }
      const y = FLOOR_Y + hop + bob;
      const h = this.yaw[i], c = Math.cos(h), sn = Math.sin(h);

      writePart(P.legL.instanceMatrix.array, i, x, y, z, c, sn, -0.1, 0.82, 0, sw, s);
      writePart(P.legR.instanceMatrix.array, i, x, y, z, c, sn, 0.1, 0.82, 0, -sw, s);
      writePart(P.shoeL.instanceMatrix.array, i, x, y, z, c, sn, -0.1, 0.82, 0, sw, s);
      writePart(P.shoeR.instanceMatrix.array, i, x, y, z, c, sn, 0.1, 0.82, 0, -sw, s);
      writePart(P.torso.instanceMatrix.array, i, x, y, z, c, sn, 0, 0.82, 0, 0, s);
      writePart(P.armL.instanceMatrix.array, i, x, y, z, c, sn, -0.285, 1.4, 0, armL, s);
      writePart(P.armR.instanceMatrix.array, i, x, y, z, c, sn, 0.285, 1.4, 0, armR, s);
      writePart(P.head.instanceMatrix.array, i, x, y, z, c, sn, 0, 1.6, 0, 0, s);
      writePart(P.hair.instanceMatrix.array, i, x, y, z, c, sn, 0, 1.6, 0, 0, s);
      writePart(P.hat.instanceMatrix.array, i, x, y, z, c, sn, 0, 1.6, 0, 0, a.look.hasHat ? s : 0);
      writePart(P.bag.instanceMatrix.array, i, x, y, z, c, sn, 0.33, 1.05, 0, armR * 0.25, a.look.hasBag ? s : 0);
      // gem: own spin, floats above the head
      const spin = t * 2.2 + i, gy = y + (2.05 + Math.sin(t * 3 + i) * 0.06) * s + (ms - 1) * 0.35;
      writePart(this.gem.instanceMatrix.array, i, x, gy, z, Math.cos(spin), Math.sin(spin), 0, 0, 0, 0, ms);
      this.gem.setColorAt(i, moodCol(a.mood));
      writePart(this.blob.instanceMatrix.array, i, x, FLOOR_Y + 0.012, z, 1, 0, 0, 0, 0, 0, s);
    }
    for (const k in P) { P[k].count = count; P[k].instanceMatrix.needsUpdate = true; if (colorsDirty && P[k].instanceColor) P[k].instanceColor.needsUpdate = true; }
    this.gem.count = count; this.gem.instanceMatrix.needsUpdate = true; this.gem.instanceColor.needsUpdate = true;
    this.blob.count = count; this.blob.instanceMatrix.needsUpdate = true;

    if (this.selected && agents.includes(this.selected)) {
      const p = this.agentWorld(this.selected, alpha);
      this.ring.visible = true;
      const k = 1 + Math.sin(t * 5) * 0.08;
      this.ring.position.set(p.x, FLOOR_Y + 0.03, p.z); this.ring.scale.set(k, k, 1);
    } else this.ring.visible = false;
  }

  setShadows(on) { for (const k in this.parts) this.parts[k].castShadow = on; }

  dispose(scene) {
    for (const k in this.parts) { scene.remove(this.parts[k]); this.parts[k].material.dispose(); this.parts[k].dispose(); }
    for (const m of [this.gem, this.blob, this.ring]) { scene.remove(m); m.material.dispose(); if (m.dispose) m.dispose(); }
  }
}

// Writes T(x,y,z) · Ry(h) · S(s) · T(ox,oy,oz) · Rx(a) as a column-major 4×4.
function writePart(e, i, x, y, z, c, sn, ox, oy, oz, a, s) {
  const o = i * 16;
  const ca = Math.cos(a), sa = Math.sin(a);
  // rotation R = Ry · Rx, scaled
  e[o] = c * s;        e[o + 1] = 0;        e[o + 2] = -sn * s;      e[o + 3] = 0;
  e[o + 4] = sn * sa * s; e[o + 5] = ca * s;  e[o + 6] = c * sa * s;   e[o + 7] = 0;
  e[o + 8] = sn * ca * s; e[o + 9] = -sa * s; e[o + 10] = c * ca * s;  e[o + 11] = 0;
  // translation = p + Ry · (s · offset)
  e[o + 12] = x + (c * ox + sn * oz) * s;
  e[o + 13] = y + oy * s;
  e[o + 14] = z + (-sn * ox + c * oz) * s;
  e[o + 15] = 1;
}
