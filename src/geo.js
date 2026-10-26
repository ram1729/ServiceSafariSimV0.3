// ═══════════════════════════════════════════════════
// GEOMETRY BUILDER — accumulates hundreds of coloured primitives and merges
// them into one BufferGeometry (vertex colours), so each venue's furniture,
// walls and street dressing cost a handful of draw calls.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';

const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: {},
  sphere: new THREE.SphereGeometry(1, 10, 7),
  hemi: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: {},
  oct: new THREE.OctahedronGeometry(1, 0),
};
function cylUnit(seg) {
  if (!UNIT.cyl[seg]) UNIT.cyl[seg] = new THREE.CylinderGeometry(1, 1, 1, seg, 1);
  return UNIT.cyl[seg];
}
function coneUnit(seg) {
  if (!UNIT.cone[seg]) UNIT.cone[seg] = new THREE.ConeGeometry(1, 1, seg, 1);
  return UNIT.cone[seg];
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();

export class GeoBuilder {
  constructor() { this.parts = []; this.vcount = 0; }
  get empty() { return this.parts.length === 0; }

  // generic: add an (indexed or not) geometry transformed by matrix, in one colour
  add(geom, matrix, color) {
    this.parts.push({ geom, matrix: matrix.clone(), color: color instanceof THREE.Color ? color.clone() : new THREE.Color(color) });
    this.vcount += geom.attributes.position.count;
    return this;
  }
  _trs(geom, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0) {
    _p.set(x, y, z); _s.set(sx, sy, sz);
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p, _q, _s);
    return this.add(geom, _m, color);
  }
  // box: (x,z) centre on the ground plane, y = bottom
  box(x, y, z, w, h, d, color, ry = 0) { return this._trs(UNIT.box, x, y + h / 2, z, w, h, d, color, ry); }
  // box centred in all three axes, full rotation
  boxC(x, y, z, w, h, d, color, ry = 0, rx = 0, rz = 0) { return this._trs(UNIT.box, x, y, z, w, h, d, color, ry, rx, rz); }
  cyl(x, y, z, r, h, color, seg = 12) { return this._trs(cylUnit(seg), x, y + h / 2, z, r, h, r, color); }
  cylC(x, y, z, r, h, color, seg = 12, ry = 0, rx = 0, rz = 0) { return this._trs(cylUnit(seg), x, y, z, r, h, r, color, ry, rx, rz); }
  sphere(x, y, z, r, color, sy = 1) { return this._trs(UNIT.sphere, x, y, z, r, r * sy, r, color); }
  hemi(x, y, z, r, color, sy = 1) { return this._trs(UNIT.hemi, x, y, z, r, r * sy, r, color); }
  cone(x, y, z, r, h, color, seg = 10) { return this._trs(coneUnit(seg), x, y + h / 2, z, r, h, r, color); }
  oct(x, y, z, r, color) { return this._trs(UNIT.oct, x, y, z, r, r, r, color); }

  build() {
    let vtx = 0, idx = 0;
    for (const p of this.parts) {
      vtx += p.geom.attributes.position.count;
      idx += p.geom.index ? p.geom.index.count : p.geom.attributes.position.count;
    }
    const pos = new Float32Array(vtx * 3), nor = new Float32Array(vtx * 3), col = new Float32Array(vtx * 3);
    const index = vtx > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
    let vo = 0, io = 0;
    for (const p of this.parts) {
      const g = p.geom, P = g.attributes.position, N = g.attributes.normal;
      _n.getNormalMatrix(p.matrix);
      for (let i = 0; i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(p.matrix);
        pos[(vo + i) * 3] = _v.x; pos[(vo + i) * 3 + 1] = _v.y; pos[(vo + i) * 3 + 2] = _v.z;
        _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
        nor[(vo + i) * 3] = _v.x; nor[(vo + i) * 3 + 1] = _v.y; nor[(vo + i) * 3 + 2] = _v.z;
        col[(vo + i) * 3] = p.color.r; col[(vo + i) * 3 + 1] = p.color.g; col[(vo + i) * 3 + 2] = p.color.b;
      }
      if (g.index) { for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.array[i] + vo; io += g.index.count; }
      else { for (let i = 0; i < P.count; i++) index[io + i] = vo + i; io += P.count; }
      vo += P.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  // convenience: merged mesh with a vertex-coloured material
  mesh(material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(this.build(), material);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
}

export function color(hex) { return _c.set(hex).clone(); }
