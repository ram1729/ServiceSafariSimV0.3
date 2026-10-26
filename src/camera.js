// ═══════════════════════════════════════════════════
// CAMERA RIG — orbit / pan / zoom around a ground target, presets (ISO, TOP,
// STREET) and a FOLLOW mode that chases a selected agent. Damped so motion
// stays smooth.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { clamp } from './util.js';
import { WORLD_W, WORLD_H } from './config.js';

const PRESETS = {
  iso:    { yaw: Math.PI * 0.18, pitch: 0.82, distK: 1.06 },
  top:    { yaw: 0, pitch: 1.53, distK: 1.05 },
  street: { yaw: Math.PI * 0.1, pitch: 0.2, distK: 0.22 },
};

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3();
    this.goal = { target: new THREE.Vector3(), yaw: PRESETS.iso.yaw, pitch: PRESETS.iso.pitch, dist: 100 };
    this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = 100;
    this.fitDist = 100;
    this.minDist = 3.5; this.maxDist = 260;
    this.follow = null;      // () => Vector3 | null
    this.mode = 'iso';
    this.keys = new Set();
    this.onClick = null;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }

  // distance at which the whole map fits the viewport
  fit(aspect) {
    const fov = this.camera.fov * Math.PI / 180;
    const hFit = (WORLD_H * 0.62) / Math.tan(fov / 2);
    const wFit = (WORLD_W * 0.58) / (Math.tan(fov / 2) * aspect);
    this.fitDist = Math.max(hFit, wFit);
    return this.fitDist;
  }

  preset(name, snap = false) {
    const p = PRESETS[name] || PRESETS.iso;
    this.mode = name;
    this.goal.yaw = p.yaw; this.goal.pitch = p.pitch; this.goal.dist = this.fitDist * p.distK;
    if (name !== 'street') this.goal.target.set(0, 0, 0);
    if (snap) this.snap();
  }
  snap() { this.yaw = this.goal.yaw; this.pitch = this.goal.pitch; this.dist = this.goal.dist; this.target.copy(this.goal.target); this.apply(); }

  // equivalent of the v0.1 2D zoom factor (1 = fitted map), used by the sim's speed scaling
  get zoomEquivalent() { return clamp((this.fitDist * 0.5) / this.dist, 0.4, 3.0); }

  attach(dom) {
    this.dom = dom;
    let drag = null;
    dom.addEventListener('contextmenu', e => e.preventDefault());
    dom.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pan: e.button === 2 || e.button === 1 || e.shiftKey, moved: false, id: e.pointerId };
      dom.setPointerCapture(e.pointerId);
      dom.style.cursor = drag.pan ? 'move' : 'grabbing';
    });
    dom.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      if (!drag.moved) return;
      if (drag.pan) this.panBy(dx, dy);
      else { this.goal.yaw -= dx * 0.006; this.goal.pitch = clamp(this.goal.pitch + dy * 0.005, 0.08, 1.54); this.mode = 'orbit'; }
    });
    const end = e => {
      if (!drag) return;
      if (!drag.moved && this.onClick) this.onClick(e);
      try { dom.releasePointerCapture(drag.id); } catch (_) {}
      drag = null; dom.style.cursor = 'grab';
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      const k = Math.pow(1.0015, e.deltaY);
      const before = this.goal.dist;
      this.goal.dist = clamp(this.goal.dist * k, this.minDist, this.maxDist);
      // zoom toward the cursor (when not following)
      if (!this.follow && k < 1) {
        const hit = this.groundAt(e.clientX, e.clientY);
        if (hit) { const f = 1 - this.goal.dist / before; this.goal.target.lerp(hit.setY(0), f); this.clampTarget(); }
      }
    }, { passive: false });
    window.addEventListener('keydown', e => { if (!e.target.closest || !e.target.closest('input,select,textarea')) this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  panBy(dx, dy) {
    if (this.follow) return;
    const k = this.dist * 0.0016;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // forward on the ground
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.goal.target.x += (-dx * rx + dy * fx / Math.max(0.35, Math.sin(this.pitch))) * k;
    this.goal.target.z += (-dx * rz + dy * fz / Math.max(0.35, Math.sin(this.pitch))) * k;
    this.clampTarget();
  }
  clampTarget() {
    this.goal.target.x = clamp(this.goal.target.x, -WORLD_W * 0.6, WORLD_W * 0.6);
    this.goal.target.z = clamp(this.goal.target.z, -WORLD_H * 0.6, WORLD_H * 0.6);
  }
  groundAt(clientX, clientY) {
    if (!this.dom) return null;
    const r = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._plane, out) ? out : null;
  }
  setTarget(x, z) { this.goal.target.set(x, 0, z); this.clampTarget(); }

  update(dt) {
    // keyboard: WASD / arrows pan, Q/E rotate, +/- zoom
    const K = this.keys, sp = this.dist * 0.9 * dt;
    if (!this.follow) {
      let mx = 0, mz = 0;
      if (K.has('w') || K.has('arrowup')) mz -= 1;
      if (K.has('s') || K.has('arrowdown')) mz += 1;
      if (K.has('a') || K.has('arrowleft')) mx -= 1;
      if (K.has('d') || K.has('arrowright')) mx += 1;
      if (mx || mz) {
        const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
        this.goal.target.x += (mx * c + mz * s) * sp; this.goal.target.z += (-mx * s + mz * c) * sp;
        this.clampTarget();
      }
    }
    if (K.has('q')) this.goal.yaw += dt * 1.4;
    if (K.has('e')) this.goal.yaw -= dt * 1.4;
    if (K.has('=') || K.has('+')) this.goal.dist = clamp(this.goal.dist * (1 - dt * 1.5), this.minDist, this.maxDist);
    if (K.has('-') || K.has('_')) this.goal.dist = clamp(this.goal.dist * (1 + dt * 1.5), this.minDist, this.maxDist);

    if (this.follow) { const p = this.follow(); if (p) this.goal.target.set(p.x, 0, p.z); }
    const k = 1 - Math.exp(-dt * (this.follow ? 6 : 9));
    this.target.lerp(this.goal.target, k);
    let dy = this.goal.yaw - this.yaw;
    this.yaw += dy * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    this.apply();
  }

  apply() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const focusY = this.dist < 20 ? 1.2 : 0;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      focusY + sp * this.dist + 0.4,
      this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target.x, focusY, this.target.z);
  }

  // ground footprint of the view (for the minimap)
  footprint() {
    if (!this.dom) return null;
    const r = this.dom.getBoundingClientRect();
    const pts = [];
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const p = this.groundAt(r.left + u * r.width, r.top + Math.max(v, 0.05) * r.height);
      if (!p) return null;
      pts.push(p);
    }
    return pts;
  }
}
