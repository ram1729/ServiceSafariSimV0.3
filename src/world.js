// ═══════════════════════════════════════════════════
// 3D VENUE WORLD — turns a venue layout into a lit, furnished 3D scene:
// building slabs, textured floors, walls with doorways, plazas, a perimeter
// street, parked cars, a skyline, staff, wayfinding signs and event effects.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { furnishRoom, furnitureType, P } from './furniture.js';
import { floorTexture, getFloorType, FLOOR_REPEAT_M, groundTexture, windowsTexture, labelTexture } from './textures.js';
import { M_PER_PX, WALL_T, DOOR_W, WALL_H, WALL_H_CUT, WORLD_W, WORLD_H, pxToWorldX, pxToWorldZ } from './config.js';
import { lighten, darken, hashStr, mulberry32 } from './util.js';

export const FLOOR_Y = 0.15;
const HW = WORLD_W / 2, HD = WORLD_H / 2;
const SIDEWALK = 3, ROAD = 7;
const BG = '#0f1913';

// shared materials (one set for every venue)
const MAT = {};
function mats() {
  if (MAT.ready) return MAT;
  MAT.vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
  MAT.wall = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.0 });
  MAT.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  MAT.glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false });
  MAT.paving = new THREE.MeshStandardMaterial({ map: groundTexture('paving'), roughness: 0.95 });
  MAT.asphalt = new THREE.MeshStandardMaterial({ map: groundTexture('asphalt'), roughness: 0.97 });
  MAT.grass = new THREE.MeshStandardMaterial({ map: groundTexture('grass'), roughness: 1.0 });
  MAT.pitch = new THREE.MeshStandardMaterial({ map: groundTexture('pitch'), roughness: 1.0 });
  MAT.skyline = [0, 1, 2].map(i => {
    const t = windowsTexture(101 + i);
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.4, roughness: 0.8 });
  });
  MAT.ready = true;
  return MAT;
}

// planar UVs in metres → repeat
function uvPlane(w, d, repeatM, x = 0, z = 0) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + x) / repeatM, -(pos.getZ(i) + z) / repeatM);
  g.translate(x, 0, z);
  return g;
}

export class VenueWorld {
  constructor(sim) {
    mats();
    this.sim = sim;
    this.layout = sim.layout;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 150, 330);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.updaters = [];
    this.labels = [];
    this.wallItems = [];
    this.cutaway = false;
    this.rng = mulberry32(hashStr(sim.venueKey) + 7);
    this.glowMat = MAT.glow.clone();

    this._lights();
    this._ground();
    this._buildings();
    this._perimeter();
    this._outskirts();
    this._staff();
    this._signs();
    this._effects();
    this.root.traverse(o => { if (o.isMesh && o.userData.wallItem) this.wallItems.push(o); });
  }

  // ── lighting ───────────────────────────────────────────────
  _lights() {
    this.hemi = new THREE.HemisphereLight('#e4f0ff', '#4b5a3f', 1.15);
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.3);
    this.sun.position.set(-45, 85, 55);
    this.sun.target.position.set(0, 0, 0);
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -78; s.right = 78; s.top = 62; s.bottom = -62; s.near = 20; s.far = 230;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.castShadow = false;
    this.ambient = new THREE.AmbientLight('#ffffff', 0.15);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.ambient);
    this.base = { hemi: this.hemi.intensity, sun: this.sun.intensity, amb: this.ambient.intensity };
  }
  setShadows(on) { this.sun.castShadow = on; }

  // ── ground, plazas and empty lots ──────────────────────────
  _ground() {
    const M = MAT;
    const grass = new THREE.Mesh(uvPlane(900, 900, 6), M.grass);
    grass.position.y = -0.02; grass.receiveShadow = true;
    const asphalt = new THREE.Mesh(uvPlane(WORLD_W + 2 * (SIDEWALK + ROAD), WORLD_H + 2 * (SIDEWALK + ROAD), 8), M.asphalt);
    asphalt.position.y = 0.0; asphalt.receiveShadow = true;
    this.root.add(grass, asphalt);

    // paved plaza on every footprint (+ sidewalk ring around the map)
    const geoms = [];
    for (const r of this.layout.rooms) {
      const w = (r.ow - 6) * M_PER_PX, d = (r.oh - 6) * M_PER_PX;
      geoms.push(uvPlane(w, d, 4, pxToWorldX(r.ox + r.ow / 2), pxToWorldZ(r.oy + r.oh / 2)));
    }
    const ring = [[0, -HD - SIDEWALK / 2, WORLD_W + SIDEWALK * 2, SIDEWALK], [0, HD + SIDEWALK / 2, WORLD_W + SIDEWALK * 2, SIDEWALK],
      [-HW - SIDEWALK / 2, 0, SIDEWALK, WORLD_H], [HW + SIDEWALK / 2, 0, SIDEWALK, WORLD_H]];
    for (const [x, z, w, d] of ring) geoms.push(uvPlane(w, d, 4, x, z));
    const pav = new THREE.Mesh(mergeSimple(geoms), M.paving);
    pav.position.y = 0.03; pav.receiveShadow = true;
    this.root.add(pav);

    // kerbs + parked cars in empty lots
    const B = new GeoBuilder(), G = new GeoBuilder();
    for (const s of [-1, 1]) {
      B.box(0, 0, s * (HD + SIDEWALK), WORLD_W + SIDEWALK * 2 + 0.2, 0.14, 0.2, '#9a988f');
      B.box(s * (HW + SIDEWALK), 0, 0, 0.2, 0.14, WORLD_H + SIDEWALK * 2 + 0.2, '#9a988f');
    }
    const rng = this.rng;
    const inFoot = (x, z, m) => this.layout.rooms.some(r => {
      const x0 = pxToWorldX(r.ox) - m, x1 = pxToWorldX(r.ox + r.ow) + m, z0 = pxToWorldZ(r.oy) - m, z1 = pxToWorldZ(r.oy + r.oh) + m;
      return x > x0 && x < x1 && z > z0 && z < z1;
    });
    const carCols = ['#b71c1c', '#1565c0', '#fafafa', '#212121', '#9e9e9e', '#2e7d32', '#f9a825', '#6a1b9a', '#455a64'];
    for (let x = -HW + 2; x < HW - 2; x += 2.8) for (let z = -HD + 3.2; z < HD - 3; z += 6.4) {
      let ok = true;
      for (const [dx, dz] of [[-1.3, -2.8], [1.3, -2.8], [-1.3, 2.8], [1.3, 2.8], [0, 0]]) if (inFoot(x + dx, z + dz, 0.6)) { ok = false; break; }
      if (!ok) continue;
      B.box(x - 1.4, 0, z, 0.1, 0.012, 5.4, '#e8e8e8');
      if (rng() < 0.62) P.car(B, G, x, 0, z + (rng() - 0.5) * 0.3, rng() < 0.5 ? 0 : Math.PI, carCols[Math.floor(rng() * carCols.length)]);
    }
    if (!B.empty) this.root.add(B.mesh(MAT.vc));
    if (!G.empty) this.root.add(G.mesh(this.glowMat, { cast: false, receive: false }));
  }

  // ── buildings: slab, floor, walls, doors, furniture ────────
  _buildings() {
    const L = this.layout, wt = WALL_T * M_PER_PX;
    const B = new GeoBuilder(), WB = new GeoBuilder(), G = new GeoBuilder(), WG = new GeoBuilder(), T = new GeoBuilder();
    const walls = new GeoBuilder(), caps = new GeoBuilder(), headers = new GeoBuilder(), glass = new GeoBuilder();
    const furnGroup = new THREE.Group();
    this.root.add(furnGroup);
    this.staffSpots = [];
    this.doorSpots = [];
    const zoneNames = this.sim.venueData.zones.map(z => z.name);

    // exterior entrance: the entrance room's wall that is closest to the map edge
    const ent = L.rooms[0];
    const edgeD = { N: ent.oy, S: 1800 - (ent.oy + ent.oh), W: ent.ox, E: 2400 - (ent.ox + ent.ow) };
    this.entranceSide = Object.keys(edgeD).sort((a, b) => edgeD[a] - edgeD[b])[0];

    this.roomFrames = {};
    for (const r of L.rooms) {
      const f = { X0: pxToWorldX(r.x), Z0: pxToWorldZ(r.y), W: r.w * M_PER_PX, D: r.h * M_PER_PX, y: FLOOR_Y };
      this.roomFrames[r.id] = f;
      const type = furnitureType(r.name);

      // doorway gaps per wall, in metres along that wall
      const gaps = { N: [], S: [], W: [], E: [] };
      for (const d of L.doors) {
        if (d.roomA !== r.id && d.roomB !== r.id) continue;
        if (d.side === 'v') { const side = d.cx > r.x + r.w / 2 ? 'E' : 'W'; const t = (d.cy - r.y) * M_PER_PX; gaps[side].push([t - DOOR_W * M_PER_PX / 2, t + DOOR_W * M_PER_PX / 2]); }
        else { const side = d.cy > r.y + r.h / 2 ? 'S' : 'N'; const t = (d.cx - r.x) * M_PER_PX; gaps[side].push([t - DOOR_W * M_PER_PX / 2, t + DOOR_W * M_PER_PX / 2]); }
      }
      if (r === ent) {
        const len = (this.entranceSide === 'N' || this.entranceSide === 'S') ? f.W : f.D;
        let t = len / 2;
        for (let k = 0; k < 20 && gaps[this.entranceSide].some(([a, b]) => t + 2.2 > a && t - 2.2 < b); k++) t += (k % 2 ? -1 : 1) * (k + 1) * 1.2;
        gaps[this.entranceSide].push([t - 2.0, t + 2.0]);
        this.entranceGap = { side: this.entranceSide, t, f };
      }
      let trackGap = null;
      if (type === 'platform') { trackGap = [f.D - 3.4, f.D]; gaps.W.push(trackGap); }
      for (const k in gaps) gaps[k].sort((a, b) => a[0] - b[0]);

      // slab + textured floor (platform rooms leave the track bed at street level)
      const floorD = trackGap ? f.D - 3.4 : f.D;
      { const z0 = f.Z0 - wt - 0.15, z1 = trackGap ? f.Z0 + floorD : f.Z0 + f.D + wt + 0.15;
        B.box(f.X0 + f.W / 2, 0, (z0 + z1) / 2, f.W + wt * 2 + 0.3, FLOOR_Y - 0.03, z1 - z0, '#8f8a80'); }
      const ftype = getFloorType(r.name);
      const fmat = new THREE.MeshStandardMaterial({ map: floorTexture(ftype, r.color), roughness: ftype === 'polished' ? 0.35 : ftype === 'wood' ? 0.6 : 0.9, metalness: ftype === 'polished' ? 0.08 : 0 });
      const floor = new THREE.Mesh(uvPlane(f.W, floorD, FLOOR_REPEAT_M[ftype], f.X0 + f.W / 2, f.Z0 + floorD / 2), fmat);
      floor.position.y = FLOOR_Y + 0.003; floor.receiveShadow = true;
      this.root.add(floor);
      if (trackGap) {
        B.box(f.X0 + f.W / 2, FLOOR_Y - 0.2, f.Z0 + floorD - 0.12, f.W, 0.2, 0.24, '#cfcfcf'); // platform edge
      }

      // walls (with glass sections where needed)
      const ctx = { B, WB, G, WG, T, group: furnGroup, updaters: this.updaters, staffSpots: this.staffSpots, rng: mulberry32(hashStr(this.sim.venueKey + r.id)),
        room: r, f, gaps, color: r.color, windowWalls: [], glassWalls: [], zoneNames };
      furnishRoom(ctx);
      const wallCol = lighten(r.color, 0.5), capCol = darken(r.color, 0.45);
      const glassSides = new Set([...ctx.windowWalls, ...ctx.glassWalls]);
      if (r === ent) glassSides.add(this.entranceSide);
      for (const side of ['N', 'S', 'W', 'E']) {
        const horiz = side === 'N' || side === 'S';
        const len = horiz ? f.W : f.D;
        // extend along-wall to cover corners
        const segs = [];
        let cur = -wt;
        for (const [a, b] of gaps[side]) { if (a > cur + 0.05) segs.push([cur, a]); cur = Math.max(cur, b); }
        if (len + wt > cur + 0.05) segs.push([cur, len + wt]);
        const place = (a, b, y0, h, col, bld) => {
          const mid = (a + b) / 2, l = b - a;
          if (side === 'N') bld.box(f.X0 + mid, y0, f.Z0 - wt / 2, l, h, wt, col);
          else if (side === 'S') bld.box(f.X0 + mid, y0, f.Z0 + f.D + wt / 2, l, h, wt, col);
          else if (side === 'W') bld.box(f.X0 - wt / 2, y0, f.Z0 + mid, wt, h, l, col);
          else bld.box(f.X0 + f.W + wt / 2, y0, f.Z0 + mid, wt, h, l, col);
        };
        for (const [a, b] of segs) {
          if (glassSides.has(side)) {
            place(a, b, FLOOR_Y, 0.9, wallCol, walls);
            place(a, b, FLOOR_Y + 0.9, WALL_H - 0.9, '#bfe6f5', glass);
            for (let m = a; m <= b + 0.01; m += 2.5) place(Math.max(a, m - 0.06), Math.min(b, m + 0.06), FLOOR_Y + 0.9, WALL_H - 0.9, darken(wallCol, 0.35), walls);
          } else {
            place(a, b, FLOOR_Y, WALL_H, wallCol, walls);
            place(a, b, FLOOR_Y, 0.12, darken(r.color, 0.3), walls); // skirting
          }
          place(a, b, 0, 0.09, capCol, caps);
        }
        // door frames + headers
        for (const [a, b] of gaps[side]) {
          if (trackGap && side === 'W' && a === trackGap[0]) continue;
          place(a - 0.12, a, FLOOR_Y, WALL_H, darken(r.color, 0.5), walls);
          place(b, b + 0.12, FLOOR_Y, WALL_H, darken(r.color, 0.5), walls);
          place(a, b, FLOOR_Y + 2.45, WALL_H - 2.45, wallCol, headers);
          place(a, b, FLOOR_Y + 2.45, 0.08, darken(r.color, 0.5), headers);
        }
      }

      // label sprite
      const lbl = labelTexture(r.name.toUpperCase());
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lbl.tex, depthTest: false, transparent: true, fog: false, sizeAttenuation: false }));
      const h = 0.021; // constant on-screen size
      sp.scale.set(h * lbl.aspect, h, 1);
      sp.position.set(f.X0 + f.W / 2, FLOOR_Y + WALL_H + 1.6, f.Z0 + f.D / 2);
      sp.renderOrder = 10;
      sp.userData.roomId = r.id;
      this.labels.push(sp);
      this.root.add(sp);
    }

    // doorway thresholds bridging the walkway between buildings
    for (const d of L.doors) {
      const a = d.approach[d.roomA], b = d.approach[d.roomB];
      if (d.side === 'v') {
        const x0 = pxToWorldX(Math.min(a.x, b.x) + 32), x1 = pxToWorldX(Math.max(a.x, b.x) - 32);
        B.box((x0 + x1) / 2, 0, pxToWorldZ(d.cy), x1 - x0, FLOOR_Y, DOOR_W * M_PER_PX, '#7a756c');
        B.box((x0 + x1) / 2, FLOOR_Y, pxToWorldZ(d.cy), x1 - x0, 0.012, DOOR_W * M_PER_PX - 0.4, '#5a544c');
      } else {
        const z0 = pxToWorldZ(Math.min(a.y, b.y) + 32), z1 = pxToWorldZ(Math.max(a.y, b.y) - 32);
        B.box(pxToWorldX(d.cx), 0, (z0 + z1) / 2, DOOR_W * M_PER_PX, FLOOR_Y, z1 - z0, '#7a756c');
        B.box(pxToWorldX(d.cx), FLOOR_Y, (z0 + z1) / 2, DOOR_W * M_PER_PX - 0.4, 0.012, z1 - z0, '#5a544c');
      }
      this.doorSpots.push(d);
    }

    // entrance canopy + steps
    if (this.entranceGap) {
      const { side, t, f } = this.entranceGap;
      const o = 1.8;
      let x, z, w, dd;
      if (side === 'N') { x = f.X0 + t; z = f.Z0 - wt - o / 2; w = 5; dd = o; }
      else if (side === 'S') { x = f.X0 + t; z = f.Z0 + f.D + wt + o / 2; w = 5; dd = o; }
      else if (side === 'W') { x = f.X0 - wt - o / 2; z = f.Z0 + t; w = o; dd = 5; }
      else { x = f.X0 + f.W + wt + o / 2; z = f.Z0 + t; w = o; dd = 5; }
      B.box(x, 0, z, w, FLOOR_Y, dd, '#a19d94');
      headers.box(x, FLOOR_Y + 2.9, z, w + 0.6, 0.18, dd + 0.6, '#ffd700');
      const sx = side === 'W' ? x - o / 2 : side === 'E' ? x + o / 2 : x, sz = side === 'N' ? z - o / 2 : side === 'S' ? z + o / 2 : z;
      for (const s of [-1, 1]) { const px = (side === 'N' || side === 'S') ? sx + s * 2.4 : sx, pz = (side === 'N' || side === 'S') ? sz : sz + s * 2.4; headers.cyl(px, 0, pz, 0.1, FLOOR_Y + 2.9, '#5a5a5a', 8); }
      this.entrancePoint = { x: sx, z: sz, side };
      const lbl = labelTexture(this.sim.venueData.name.toUpperCase(), { fg: '#0d0d0d', bg: '#ffd700', border: '#0d0d0d', size: 26 });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lbl.tex, transparent: true, fog: false, sizeAttenuation: false, depthTest: false }));
      sp.scale.set(0.028 * lbl.aspect, 0.028, 1); sp.position.set(x, FLOOR_Y + 4.4, z); sp.renderOrder = 11;
      this.venueSign = sp; this.root.add(sp);
    }

    const add = (bld, mat, opts) => { if (bld.empty) return null; const m = bld.mesh(mat, opts); this.root.add(m); return m; };
    this.propsMesh = add(B, MAT.vc);
    this.glowMesh = add(G, this.glowMat, { cast: false, receive: false });
    this.wallPropsMesh = add(WB, MAT.vc);
    this.wallGlowMesh = add(WG, this.glowMat, { cast: false, receive: false });
    this.glassPropsMesh = add(T, MAT.glass, { cast: false, receive: false });
    this.wallGroup = new THREE.Group();
    this.wallGroup.position.y = FLOOR_Y; // scale walls about the floor line
    const wm = walls.mesh(MAT.wall); wm.position.y = -FLOOR_Y; this.wallGroup.add(wm);
    if (!glass.empty) { const gm = glass.mesh(MAT.glass, { cast: false, receive: false }); gm.position.y = -FLOOR_Y; gm.renderOrder = 2; this.wallGroup.add(gm); }
    this.root.add(this.wallGroup);
    this.capsMesh = caps.mesh(MAT.wall, { cast: false });
    this.capsMesh.position.y = FLOOR_Y + WALL_H;
    this.root.add(this.capsMesh);
    this.headersMesh = add(headers, MAT.wall);
    for (const m of [this.wallPropsMesh, this.wallGlowMesh]) if (m) m.userData.wallItem = true;
    furnGroup.traverse(o => { if (o.isMesh && !o.userData.noShadow && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  }

  // ── perimeter street ───────────────────────────────────────
  _perimeter() {
    const B = new GeoBuilder(), G = new GeoBuilder(), rng = this.rng;
    const rc = SIDEWALK + ROAD / 2; // road centre offset from map edge
    // dashed centre line + edge lines
    const dash = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 4);
      const ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i < n; i++) { const t = (i + 0.25) / n; B.box(x0 + (x1 - x0) * t, 0.005, z0 + (z1 - z0) * t, 0.15, 0.01, 1.8, '#f2c94c', ry); }
    };
    const W2 = HW + rc, D2 = HD + rc;
    dash(-W2, -D2, W2, -D2); dash(-W2, D2, W2, D2); dash(-W2, -D2, -W2, D2); dash(W2, -D2, W2, D2);
    // crosswalk in front of the entrance
    if (this.entrancePoint) {
      const { x, z, side } = this.entrancePoint;
      for (let i = -4; i <= 4; i++) {
        if (side === 'N' || side === 'S') B.box(x + i * 0.9, 0.006, (side === 'N' ? -HD - rc : HD + rc), 0.45, 0.01, ROAD - 0.6, '#eeeeee');
        else B.box((side === 'W' ? -HW - rc : HW + rc), 0.006, z + i * 0.9, ROAD - 0.6, 0.01, 0.45, '#eeeeee');
      }
    }
    // street furniture along the sidewalk ring
    const ring = [];
    for (let x = -HW + 4; x < HW - 2; x += 6) { ring.push([x, -HD - SIDEWALK / 2, 0]); ring.push([x, HD + SIDEWALK / 2, Math.PI]); }
    for (let z = -HD + 4; z < HD - 2; z += 6) { ring.push([-HW - SIDEWALK / 2, z, Math.PI / 2]); ring.push([HW + SIDEWALK / 2, z, -Math.PI / 2]); }
    const ep = this.entrancePoint;
    ring.forEach(([x, z, ry], i) => {
      if (ep && Math.hypot(x - ep.x, z - ep.z) < 6) return;
      const k = i % 8;
      if (k === 0 || k === 4) P.lamp(B, G, x, 0.03, z);
      else if (k === 1) P.bench(B, x, 0.03, z, ry);
      else if (k === 2) P.bin(B, x, 0.03, z);
      else if (k === 3) P.tree(B, x, 0.03, z, 0.8 + rng() * 0.3, rng);
      else if (k === 5) P.hydrant(B, x, 0.03, z);
      else if (k === 6 && rng() < 0.5) P.newsbox(B, x, 0.03, z, ry);
      else if (k === 7) P.bollard(B, x, 0.03, z);
    });
    // a few cones + parked cars on the road edge
    const carCols = ['#c62828', '#1565c0', '#eeeeee', '#263238', '#fbc02d', '#00695c'];
    for (let i = 0; i < 6; i++) {
      const x = -HW + 8 + rng() * (WORLD_W - 16);
      P.car(B, G, x, 0, (i % 2 ? -1 : 1) * (HD + SIDEWALK + 1.4), Math.PI / 2, carCols[i % carCols.length]);
    }
    for (let i = 0; i < 4; i++) P.cone(B, -HW - SIDEWALK - 0.6, 0, -HD + 10 + i * 1.5);
    this.root.add(B.mesh(MAT.vc));
    this.root.add(G.mesh(this.glowMat, { cast: false, receive: false }));
    this._movingCars();
  }

  // a few cars driving round the block
  _movingCars() {
    const rc = SIDEWALK + ROAD / 2, W2 = HW + rc, D2 = HD + rc;
    const per = 2 * (2 * W2 + 2 * D2);
    const cars = [];
    const cols = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];
    for (let i = 0; i < 4; i++) {
      const B = new GeoBuilder(), G = new GeoBuilder();
      P.car(B, G, 0, 0, 0, 0, cols[i]);
      const g = new THREE.Group(); g.add(B.mesh(MAT.vc)); g.add(G.mesh(this.glowMat, { cast: false, receive: false }));
      this.root.add(g); cars.push({ g, off: i * per / 4, lane: i % 2 ? 1.6 : -1.6, speed: 7 + i });
    }
    const at = (s, lane) => {
      s = ((s % per) + per) % per;
      const w = 2 * W2 + 2 * lane, d = 2 * D2 + 2 * lane;
      const W = W2 + lane, D = D2 + lane;
      const p = s / per * (2 * w + 2 * d);
      if (p < w) return [-W + p, -D, Math.PI / 2];
      if (p < w + d) return [W, -D + (p - w), 0];
      if (p < 2 * w + d) return [W - (p - w - d), D, -Math.PI / 2];
      return [-W, D - (p - 2 * w - d), Math.PI];
    };
    this.updaters.push((t) => {
      for (const c of cars) {
        const [x, z, ry] = at(c.off + t * c.speed * (c.lane > 0 ? 1 : -1), c.lane);
        c.g.position.set(x, 0, z); c.g.rotation.y = c.lane > 0 ? ry : ry + Math.PI;
      }
    });
  }

  // ── skyline, trees and venue-specific landmarks ────────────
  _outskirts() {
    const rng = this.rng, key = this.sim.venueKey;
    const keepOut = [];
    const B = new GeoBuilder(), G = new GeoBuilder();
    const edge = SIDEWALK + ROAD;

    if (key === 'sportsArena') {
      // the pitch north of the stands, with floodlights
      const pz = -HD - edge - 44;
      const pitch = new THREE.Mesh(uvPlane(100, 66, 16, 0, pz), MAT.pitch); pitch.position.y = 0.01; pitch.receiveShadow = true; this.root.add(pitch);
      for (const [x0, z0, w, d] of [[0, pz - 33, 100, 0.25], [0, pz + 33, 100, 0.25], [-50, pz, 0.25, 66], [50, pz, 0.25, 66], [0, pz, 0.25, 66]]) B.box(x0, 0.012, z0, w, 0.01, d, '#f5f5f5');
      for (const s of [-1, 1]) { B.box(s * 50, 0, pz, 0.15, 2.4, 7.3, '#ffffff'); B.box(s * 49, 2.3, pz, 2, 0.12, 7.3, '#ffffff'); }
      for (const [x, z] of [[-58, pz - 40], [58, pz - 40], [-58, pz + 30], [58, pz + 30]]) {
        B.cyl(x, 0, z, 0.5, 34, '#9e9e9e', 8); B.box(x, 34, z, 6, 3, 0.8, '#616161'); G.box(x, 34.2, z + Math.sign(pz - z + 0.01) * 0.45, 5.4, 2.4, 0.05, '#fffde7');
      }
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshBasicMaterial({ color: '#0b3d91', toneMapped: false }));
      scr.position.set(0, 16, pz - 46); this.root.add(scr);
      B.box(0, 0, pz - 46.6, 24, 21, 1, '#37474f');
      keepOut.push([-75, pz - 60, 75, -HD - edge]);
    }
    if (key === 'trainStation') {
      // tracks running west out of the platforms
      for (const r of this.layout.rooms) if (furnitureType(r.name) === 'platform') {
        const f = this.roomFrames[r.id], z = f.Z0 + f.D - 1.7;
        B.box(-HW - 100, 0, z, 200, 0.03, 4, '#4a443d');
        for (const o of [-0.72, 0.72]) B.box(-HW - 100, 0.03, z + o, 200, 0.12, 0.08, '#9e9e9e');
        for (let x = -HW - 200; x < -HW; x += 0.7) B.box(x, 0.03, z, 0.22, 0.05, 2.4, '#5d4037');
        keepOut.push([-HW - 220, z - 6, -HW, z + 6]);
      }
    }
    if (key === 'airport') {
      // an aircraft on the apron outside the gate windows
      const tarmac = new THREE.Mesh(uvPlane(70, 90, 8, HW + edge + 35, -20), MAT.asphalt); tarmac.position.y = 0.012; tarmac.receiveShadow = true; this.root.add(tarmac);
      const ax = HW + edge + 30, az = -22;
      B.cylC(ax, 3.2, az, 2.0, 34, '#f5f5f5', 16, 0, 0, Math.PI / 2);
      B.sphere(ax - 17, 3.2, az, 2.0, '#f5f5f5', 1); B.cone(ax + 17, 3.2, az, 2.0, 6, '#f5f5f5', 16);
      B.boxC(ax + 1, 2.4, az, 7, 0.4, 36, '#e0e0e0', 0, 0, 0); B.boxC(ax + 17, 7, az, 4, 6, 0.4, '#1565c0', 0, 0, -0.4); B.boxC(ax + 17, 3.6, az, 3, 0.3, 11, '#e0e0e0');
      for (const s of [-1, 1]) B.cylC(ax - 2, 1.4, az + s * 7, 1.1, 3.6, '#9e9e9e', 12, 0, 0, Math.PI / 2);
      for (let i = 0; i < 12; i++) G.box(ax - 13 + i * 2.2, 3.9, az + 2.0 * (i % 2 ? 1 : -1) * 0.98, 0.5, 0.35, 0.02, '#cfe8ff');
      for (const z of [-50, 10]) { B.box(HW + edge + 8, 0, z, 3, 2.2, 6, '#fbc02d'); }
      keepOut.push([HW, -70, HW + 80, 30]);
    }
    if (key === 'themePark') {
      // ferris wheel landmark
      const fx = HW + edge + 22, fz = -HD + 10;
      B.box(fx, 0, fz - 3, 1.2, 22, 1.2, '#9e9e9e'); B.box(fx, 0, fz + 3, 1.2, 22, 1.2, '#9e9e9e');
      const wheel = new THREE.Group(); wheel.position.set(fx, 22, fz);
      const WBd = new GeoBuilder(); const WGd = new GeoBuilder();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        WBd.boxC(Math.cos(a) * 9, Math.sin(a) * 9, 0, 0.25, 18.2, 0.25, '#eceff1', 0, 0, a);
        WBd.boxC(Math.cos(a) * 17, Math.sin(a) * 17, 0, 0.35, 6.8, 0.35, '#e91e63', 0, 0, a + Math.PI / 2);
        WGd.sphere(Math.cos(a) * 18, Math.sin(a) * 18, 0, 0.35, ['#ffeb3b', '#00e5ff', '#ff4081'][i % 3]);
      }
      wheel.add(WBd.mesh(MAT.vc)); wheel.add(WGd.mesh(this.glowMat, { cast: false, receive: false }));
      this.root.add(wheel);
      this.updaters.push((t) => { wheel.rotation.x = 0; wheel.rotation.y = Math.PI / 2; wheel.rotation.z = t * 0.06; });
      keepOut.push([HW, -HD - 30, HW + 50, -HD + 40]);
    }

    // skyline blocks in a ring beyond the street
    const inner = edge + 10;
    const blocked = (x, z, w, d) => keepOut.some(([x0, z0, x1, z1]) => x + w / 2 > x0 && x - w / 2 < x1 && z + d / 2 > z0 && z - d / 2 < z1);
    const boxes = [[], [], []];
    for (let i = 0; i < 140; i++) {
      const a = rng() * Math.PI * 2, rad = 1 + rng() * 0.9;
      const x = Math.cos(a) * (HW + inner) * rad * 1.15, z = Math.sin(a) * (HD + inner) * rad * 1.25;
      if (Math.abs(x) < HW + inner && Math.abs(z) < HD + inner) continue;
      const w = 8 + rng() * 14, d = 8 + rng() * 14, h = 6 + rng() * rng() * 40;
      if (blocked(x, z, w, d)) continue;
      boxes[i % 3].push([x, z, w, d, h]);
    }
    boxes.forEach((list, k) => {
      if (!list.length) return;
      const m = new THREE.Mesh(skylineGeometry(list), MAT.skyline[k]);
      m.receiveShadow = true;
      this.root.add(m);
    });
    // trees on the verge
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * (HW + edge + 4 + rng() * 14), z = Math.sin(a) * (HD + edge + 4 + rng() * 14);
      if (blocked(x, z, 2, 2) || (Math.abs(x) < HW + edge + 2 && Math.abs(z) < HD + edge + 2)) continue;
      if (rng() < 0.5) P.tree(B, x, 0, z, 0.9 + rng() * 0.6, rng); else P.conifer(B, x, 0, z, 1 + rng() * 0.8);
    }
    this.root.add(B.mesh(MAT.vc));
    if (!G.empty) this.root.add(G.mesh(this.glowMat, { cast: false, receive: false }));
  }

  // ── staff NPCs at service points (shown in proportion to STAFF RATIO) ──
  _staff() {
    const pb = new GeoBuilder();
    pb.box(-0.1, 0, 0, 0.15, 0.82, 0.17, '#1f2a3a'); pb.box(0.1, 0, 0, 0.15, 0.82, 0.17, '#1f2a3a');
    pb.box(0, 0.82, 0, 0.44, 0.62, 0.25, '#1b3a27');
    pb.box(0, 1.25, 0.128, 0.16, 0.12, 0.01, '#ffd700');
    pb.box(-0.28, 0.86, 0, 0.11, 0.58, 0.13, '#1b3a27'); pb.box(0.28, 0.86, 0, 0.11, 0.58, 0.13, '#1b3a27');
    pb.sphere(0, 1.6, 0, 0.13, '#d9a77a'); pb.hemi(0, 1.62, -0.01, 0.142, '#2c1810', 0.9);
    pb.box(0, 1.73, 0, 0.3, 0.06, 0.3, '#1b3a27');
    const geo = pb.build();
    const rng = mulberry32(hashStr(this.sim.venueKey + 'staff'));
    const spots = this.staffSpots.slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    this.staffList = spots;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    this.staffMesh = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.ry);
      m4.compose(new THREE.Vector3(s.x, FLOOR_Y, s.z), q, new THREE.Vector3(1, 1, 1));
      this.staffMesh.setMatrixAt(i, m4);
      this.staffMesh.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    this.staffMesh.castShadow = true;
    this.staffMesh.count = spots.length;
    this.root.add(this.staffMesh);
    this._staffShown = -1;
    this._staffTint = null;
  }

  // ── wayfinding signs at doorways (shown in proportion to SIGNAGE QUALITY) ──
  _signs() {
    const sb = new GeoBuilder();
    sb.cyl(0, 0, 0, 0.05, 2.1, '#37474f', 6);
    sb.box(0, 2.0, 0, 1.1, 0.42, 0.06, '#1b5e20');
    sb.box(0.12, 2.12, 0.035, 0.6, 0.08, 0.01, '#ffffff');
    sb.box(-0.32, 2.12, 0.035, 0.18, 0.18, 0.01, '#ffffff', Math.PI / 4);
    const geo = sb.build();
    const list = [];
    for (const d of this.layout.doors) {
      for (const id of [d.roomA, d.roomB]) {
        const ap = d.approach[id];
        const off = 1.9;
        let x = pxToWorldX(ap.x), z = pxToWorldZ(ap.y), ry;
        if (d.side === 'v') { z += off; ry = (ap.x < d.cx ? 1 : -1) * Math.PI / 2 - Math.PI / 2; }
        else { x += off; ry = ap.y < d.cy ? Math.PI : 0; }
        list.push({ x, z, ry });
      }
    }
    const rng = mulberry32(hashStr(this.sim.venueKey + 'signs'));
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    this.signMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#0a2a10' }), Math.max(1, list.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach((s, i) => { q.setFromAxisAngle(up, s.ry); m4.compose(new THREE.Vector3(s.x, FLOOR_Y, s.z), q, new THREE.Vector3(1, 1, 1)); this.signMesh.setMatrixAt(i, m4); });
    this.signMesh.castShadow = true;
    this.signList = list;
    this.root.add(this.signMesh);
    this._signsShown = -1;
  }

  // ── event effects ──────────────────────────────────────────
  _effects() {
    // emergency beacons on room corners
    const beacons = [];
    for (const r of this.layout.rooms) { const f = this.roomFrames[r.id]; beacons.push([f.X0 - 0.2, f.Z0 - 0.2], [f.X0 + f.W + 0.2, f.Z0 + f.D + 0.2]); }
    this.beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff1744', toneMapped: false }), beacons.length);
    this.beaconPos = beacons;
    this.beacons.visible = false;
    this.root.add(this.beacons);

    // confetti for surprise delight
    const N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    const pal = ['#ffd700', '#00e5ff', '#ff4081', '#69f0ae', '#b388ff', '#ffab40'].map(c => new THREE.Color(c));
    for (let i = 0; i < N; i++) { const c = pal[i % pal.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.confetti = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, toneMapped: false }));
    this.confetti.visible = false; this.confetti.frustumCulled = false;
    this.confettiVel = vel;
    this.root.add(this.confetti);

    // queue-spike rings at the service zones agents queue at
    const svc = this.sim.venueData.zones.filter(z => z.id.includes('info') || z.id.includes('service') || z.id.includes('reception') || z.id.includes('counter'));
    const targets = svc.length ? svc : [this.sim.venueData.zones[Math.min(1, this.sim.venueData.zones.length - 1)]];
    this.spikeRings = targets.map(z => {
      const f = this.roomFrames[z.id];
      const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#ff6d00', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(f.X0 + f.W / 2, FLOOR_Y + 0.05, f.Z0 + f.D / 2); m.userData.maxR = Math.min(f.W, f.D) * 0.45;
      m.visible = false; this.root.add(m); return m;
    });
    this.event = null;
  }

  _spawnConfetti() {
    const p = this.confetti.geometry.attributes.position.array, v = this.confettiVel;
    for (let i = 0; i < p.length / 3; i++) {
      p[i * 3] = (Math.random() - 0.5) * 30; p[i * 3 + 1] = 14 + Math.random() * 18; p[i * 3 + 2] = (Math.random() - 0.5) * 24;
      v[i * 3] = (Math.random() - 0.5) * 4; v[i * 3 + 1] = -2 - Math.random() * 3; v[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    this.confetti.geometry.attributes.position.needsUpdate = true;
  }

  // ── per-frame ──────────────────────────────────────────────
  setCutaway(on) {
    this.cutaway = on;
    const k = on ? WALL_H_CUT / WALL_H : 1;
    this.wallGroup.scale.y = k;
    this.capsMesh.position.y = FLOOR_Y + WALL_H * k;
    if (this.headersMesh) this.headersMesh.visible = !on;
    for (const m of this.wallItems) m.visible = !on;
  }
  setLabels(on) { for (const s of this.labels) s.visible = on; if (this.venueSign) this.venueSign.visible = on; }

  update(t, dt) {
    const sim = this.sim;
    for (const fn of this.updaters) fn(t, dt);

    // staff + signage follow the sliders
    const nStaff = Math.max(this.staffList.length ? 1 : 0, Math.round(this.staffList.length * sim.staffRatio / 10));
    if (nStaff !== this._staffShown) { this.staffMesh.count = nStaff; this._staffShown = nStaff; }
    const nSigns = Math.round(this.signList.length * sim.signageQuality / 10);
    if (nSigns !== this._signsShown) { this.signMesh.count = nSigns; this._signsShown = nSigns; }

    // events
    const ev = sim.activeEvent ? sim.activeEvent.type : null;
    if (ev !== this.event) {
      if (ev === 'surpriseDelight') this._spawnConfetti();
      this.confetti.visible = ev === 'surpriseDelight';
      this.beacons.visible = ev === 'emergencyDrill';
      for (const r of this.spikeRings) r.visible = ev === 'queueSpike';
      const rude = ev === 'rudeStaff';
      for (let i = 0; i < this.staffList.length; i++) this.staffMesh.setColorAt(i, rude ? new THREE.Color(1.6, 0.35, 0.3) : new THREE.Color(1, 1, 1));
      if (this.staffMesh.instanceColor) this.staffMesh.instanceColor.needsUpdate = true;
      this.event = ev;
    }
    let li = 1, glow = 1;
    if (ev === 'systemOutage') { const fl = Math.sin(t * 23) > 0.6 ? 0.55 : 0.3; li = fl; glow = Math.random() < 0.15 ? 0.6 : 0.12; }
    if (ev === 'emergencyDrill') {
      const pulse = (Math.sin(t * 8) + 1) / 2;
      const m4 = new THREE.Matrix4();
      this.beaconPos.forEach(([x, z], i) => { const s = 0.6 + pulse * 0.8; m4.makeScale(s, s, s).setPosition(x, FLOOR_Y + WALL_H + 0.6, z); this.beacons.setMatrixAt(i, m4); });
      this.beacons.instanceMatrix.needsUpdate = true;
      this.hemi.color.setRGB(1, 0.5 + 0.5 * (1 - pulse), 0.5 + 0.5 * (1 - pulse));
    } else this.hemi.color.set('#e4f0ff');
    if (ev === 'queueSpike') for (const r of this.spikeRings) { const k = (t * 0.7) % 1; const s = 1 + k * r.userData.maxR; r.scale.set(s, s, 1); r.material.opacity = 0.85 * (1 - k); }
    if (ev === 'surpriseDelight') {
      const p = this.confetti.geometry.attributes.position.array, v = this.confettiVel;
      for (let i = 0; i < p.length / 3; i++) {
        p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
        v[i * 3] += Math.sin(t * 3 + i) * dt * 2;
        if (p[i * 3 + 1] < FLOOR_Y) { p[i * 3] = (Math.random() - 0.5) * 40; p[i * 3 + 1] = 18 + Math.random() * 8; p[i * 3 + 2] = (Math.random() - 0.5) * 30; }
      }
      this.confetti.geometry.attributes.position.needsUpdate = true;
    }
    this.hemi.intensity = this.base.hemi * li;
    this.sun.intensity = this.base.sun * li;
    this.glowMat.color.setScalar(glow);
  }

  // ground-plane bounds of the map, for cameras
  get bounds() { return { w: WORLD_W, d: WORLD_H }; }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Object.values(MAT).includes(o.material)) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose && m.dispose()); }
    });
  }
}

// skyline blocks: four façades + roof with UVs in metres so windows keep their size
function skylineGeometry(list) {
  const pos = [], nor = [], uv = [], idx = [];
  const T = 12; // metres per window-texture tile
  const quad = (p0, p1, p2, p3, n, uw, vh) => {
    const b = pos.length / 3;
    for (const p of [p0, p1, p2, p3]) pos.push(...p);
    for (let i = 0; i < 4; i++) nor.push(...n);
    uv.push(0, 0, uw / T, 0, uw / T, vh / T, 0, vh / T);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  for (const [x, z, w, d, h] of list) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], w, h);
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], w, h);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], d, h);
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], d, h);
    const b = pos.length / 3;
    pos.push(x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0); for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    uv.push(0.002, 0.002, 0.006, 0.002, 0.006, 0.006, 0.002, 0.006); // roof samples a dark gap in the texture
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// merge non-indexed-compatible simple geometries (planes) into one
function mergeSimple(geoms) {
  let v = 0, idx = 0;
  for (const g of geoms) { v += g.attributes.position.count; idx += g.index.count; }
  const pos = new Float32Array(v * 3), nor = new Float32Array(v * 3), uv = new Float32Array(v * 2), index = new Uint32Array(idx);
  let vo = 0, io = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
    for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.array[i] + vo;
    vo += g.attributes.position.count; io += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}
