// ═══════════════════════════════════════════════════
// APP — same screens and flow as v0.1 (start → 12-venue grid → venue detail
// → report), rendered in 3D. One WebGL renderer draws all twelve venue scenes
// into the grid (viewport + scissor per cell) and moves into the detail view
// when a venue is opened.
// ═══════════════════════════════════════════════════
import * as THREE from 'three';
import { TICK_MS, VENUE_KEYS, MAP_W, MAP_H, WORLD_W, WORLD_H, toWorldX, toWorldZ } from './config.js';
import { VENUES } from './data.js';
import { clamp, pick, moodColor } from './util.js';
import { VenueSim } from './sim.js';
import { VenueWorld, FLOOR_Y } from './world.js';
import { CrowdRenderer } from './agents3d.js';
import { CameraRig } from './camera.js';

const SPEEDS = [[1, '1× (v0.1 PACE)'], [0.5, '½×'], [0.25, '¼×'], [0.1, '⅒× REAL-TIME']];
const EV_NAME = { queueSpike: 'QUEUE SPIKE', rudeStaff: 'RUDE STAFF', surpriseDelight: 'SURPRISE DELIGHT', systemOutage: 'SYSTEM OUTAGE', emergencyDrill: 'EMERGENCY DRILL' };
const $ = id => document.getElementById(id);

const App = {
  state: 'start',
  sims: [], worlds: [], crowds: [],
  cells: [], cellViews: [], gridCams: [],
  detailIndex: -1,
  selectedAgent: null,
  tickCount: 0,
  lastTick: 0,
  running: false,
  paused: false,
  speed: 1,
  allDialogue: [],
  simElapsedMs: 0,
  prefs: { cutaway: false, labels: true, chatter: true },

  init() {
    // WebGL check
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('no webgl');
    } catch (e) { $('gl-error').style.display = 'block'; document.querySelector('.btn-run').disabled = true; }

    // Build venue selectors
    const grid = $('venue-grid');
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'vg-cell';
      cell.innerHTML = `<span>CELL ${i + 1}</span><select id="vs-${i}"></select>`;
      grid.appendChild(cell);
      const sel = cell.querySelector('select');
      VENUE_KEYS.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k; opt.textContent = VENUES[k].name;
        sel.appendChild(opt);
      });
      sel.value = VENUE_KEYS[i];
    }

    // Slider labels
    ['crowd', 'staff', 'sign'].forEach(k => {
      const sl = $('sl-' + k), vl = $('v-' + k);
      sl.addEventListener('input', () => vl.textContent = sl.value);
    });

    // Speed selectors (dashboard + detail), kept in sync
    document.querySelectorAll('[data-speed]').forEach(sel => {
      for (const [v, label] of SPEEDS) { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); }
      sel.value = '1';
      sel.addEventListener('change', () => this.setSpeed(+sel.value));
    });

    // Build grid cells
    const gc = $('grid-container');
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = `<div class="cell-hdr"><span class="ch-name">---</span><span class="ch-spark"><canvas width="50" height="14" style="display:block"></canvas></span><span class="ch-mood">0.0</span><span class="ch-count">0</span></div><div class="cell-view"><div class="cell-event"></div><div class="cell-evlabel"></div></div>`;
      cell.addEventListener('click', () => this.openDetail(i));
      gc.appendChild(cell);
      this.cells.push(cell);
      this.cellViews.push(cell.querySelector('.cell-view'));
    }

    // Detail view slider sync
    ['crowd', 'staff', 'sign'].forEach(k => {
      const sl = $('ds-' + k), vl = $('dv-' + k);
      sl.addEventListener('input', () => {
        vl.textContent = sl.value;
        if (this.detailIndex >= 0) {
          const sim = this.sims[this.detailIndex];
          if (k === 'crowd') sim.crowdLevel = +sl.value;
          if (k === 'staff') sim.staffRatio = +sl.value;
          if (k === 'sign') sim.signageQuality = +sl.value;
        }
      });
    });

    // Camera bar
    document.querySelectorAll('#cam-bar [data-cam]').forEach(b => b.addEventListener('click', () => this.camPreset(b.dataset.cam)));
    document.querySelectorAll('#cam-bar [data-toggle]').forEach(b => b.addEventListener('click', () => this.toggle(b.dataset.toggle)));

    // Minimap click → move camera target
    const mm = $('minimap');
    mm.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (this.detailIndex < 0) return;
      const r = mm.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
      this.rig.follow = null; this._setCamButtons();
      this.rig.setTarget(toWorldX(nx), toWorldZ(ny));
    });

    // Keys
    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input,select,textarea')) return;
      if (e.key === 'Escape' && this.state === 'detail') this.closeDetail();
      if (this.state === 'start') return;
      if (e.key === ' ') { e.preventDefault(); this.paused = !this.paused; this.lastTick = performance.now(); }
      if (this.state !== 'detail') return;
      const k = e.key.toLowerCase();
      if (k === 'f') this.camPreset('follow');
      if (k === 'c') this.toggle('walls');
      if (k === 'l') this.toggle('labels');
      if (k === 't') this.toggle('chatter');
      if (k === '1') this.camPreset('iso');
      if (k === '2') this.camPreset('top');
      if (k === '3') this.camPreset('street');
    });

    window.addEventListener('resize', () => this.onResize());
    this.fontsReady = (document.fonts && document.fonts.load)
      ? Promise.race([document.fonts.load('22px "Press Start 2P"'), new Promise(r => setTimeout(r, 2500))]).catch(() => {})
      : Promise.resolve();
  },

  setSpeed(v) {
    this.speed = v;
    document.querySelectorAll('[data-speed]').forEach(s => s.value = String(v));
  },
  get tickMs() { return TICK_MS / this.speed; },

  randomiseVenues() {
    for (let i = 0; i < 12; i++) $('vs-' + i).value = pick(VENUE_KEYS);
  },

  async start() {
    const agentCount = +document.querySelector('input[name=agentCount]:checked').value;
    const crowd = +$('sl-crowd').value;
    const staff = +$('sl-staff').value;
    const signage = +$('sl-sign').value;

    $('start-screen').style.display = 'none';
    $('loading').style.display = 'flex';
    await this.fontsReady;

    // renderer (shared by grid + detail)
    const canvas = $('grid-gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.classList.add('gl');

    this.sims = []; this.worlds = []; this.crowds = []; this.gridCams = [];
    const keys = [];
    for (let i = 0; i < 12; i++) keys.push($('vs-' + i).value);
    // identical venues share nothing but are cheap to build; build one per frame so the bar animates
    for (let i = 0; i < 12; i++) {
      $('ld-msg').textContent = `${i + 1}/12  ${VENUES[keys[i]].name.toUpperCase()}`;
      $('ld-fill').style.width = ((i + 0.5) / 12 * 100) + '%';
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      const sim = new VenueSim(keys[i], { agentCount, crowd, staff, signage });
      const world = new VenueWorld(sim);
      world.setLabels(false);
      world.setShadows(false);
      const crowdR = new CrowdRenderer(sim, world.scene, { markerScale: 2.4, bodyScale: 1.6 });
      crowdR.setShadows(false);
      this.sims.push(sim); this.worlds.push(world); this.crowds.push(crowdR);
      const cam = new THREE.PerspectiveCamera(38, 1.4, 4, 700);
      this.gridCams.push({ cam, rig: new CameraRig(cam), phase: i * 0.7 });
    }
    $('ld-fill').style.width = '100%';
    $('ld-msg').textContent = 'COMPILING SHADERS...';
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

    // detail camera + rig
    this.detailCam = new THREE.PerspectiveCamera(45, 1.5, 0.3, 1200);
    this.rig = new CameraRig(this.detailCam);
    this.rig.attach(this.renderer.domElement);
    this.rig.onClick = e => this.pickAgent(e);
    this.rig.dom = null; // only active while in the detail view

    // bubbles (1 selected + chatter)
    const bw = $('bubbles');
    this.mainBubble = document.createElement('div'); this.mainBubble.className = 'bubble main'; bw.appendChild(this.mainBubble);
    this.miniBubbles = [];
    for (let i = 0; i < 5; i++) { const b = document.createElement('div'); b.className = 'bubble mini'; bw.appendChild(b); this.miniBubbles.push(b); }

    $('loading').style.display = 'none';
    $('sim-screen').style.display = 'flex';
    this.state = 'grid';
    this.running = true;
    this.lastTick = performance.now();
    this.lastFrame = performance.now();
    this.t0 = performance.now();

    requestAnimationFrame(() => {
      this.onResize();
      this.loop();
    });
  },

  onResize() {
    if (!this.renderer) return;
    if (this.state === 'grid') {
      const gc = $('grid-container');
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.setSize(gc.clientWidth, gc.clientHeight, false);
      this._cellRects = null;
    } else if (this.state === 'detail') {
      const wrap = $('detail-canvas-wrap');
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
      this.detailCam.aspect = wrap.clientWidth / Math.max(1, wrap.clientHeight);
      this.detailCam.updateProjectionMatrix();
      this.rig.fit(this.detailCam.aspect);
    }
  },

  openDetail(index) {
    if (!this.renderer) return;
    this.detailIndex = index;
    this.state = 'detail';
    this.selectedAgent = null;
    $('sim-screen').style.display = 'none';
    $('detail-screen').style.display = 'flex';
    $('agent-card').style.display = 'none';

    const sim = this.sims[index], world = this.worlds[index], crowd = this.crowds[index];
    $('dh-name').textContent = sim.venueData.name;
    $('ds-crowd').value = sim.crowdLevel; $('dv-crowd').textContent = sim.crowdLevel;
    $('ds-staff').value = sim.staffRatio; $('dv-staff').textContent = sim.staffRatio;
    $('ds-sign').value = sim.signageQuality; $('dv-sign').textContent = sim.signageQuality;

    // move the renderer into the detail view
    const wrap = $('detail-canvas-wrap');
    wrap.insertBefore(this.renderer.domElement, wrap.firstChild);
    this.renderer.setScissorTest(false);
    this.rig.dom = this.renderer.domElement;
    this.renderer.domElement.style.pointerEvents = 'auto';
    world.setShadows(true); crowd.setShadows(true);
    world.setLabels(this.prefs.labels);
    world.setCutaway(this.prefs.cutaway);
    crowd.markerScale = 1.15; crowd.bodyScale = 1;
    crowd.selected = null;
    this.rig.follow = null;

    requestAnimationFrame(() => {
      this.onResize();
      this.rig.preset('iso', true);
      this._setCamButtons();
      this._drawMinimapStatic();
    });
  },

  closeDetail() {
    const world = this.worlds[this.detailIndex], crowd = this.crowds[this.detailIndex], sim = this.sims[this.detailIndex];
    if (world) { world.setShadows(false); world.setLabels(false); world.setCutaway(false); }
    if (crowd) { crowd.setShadows(false); crowd.markerScale = 2.4; crowd.bodyScale = 1.6; crowd.selected = null; }
    if (sim) sim._viewZoom = undefined;
    this.detailIndex = -1;
    this.state = 'grid';
    this.selectedAgent = null;
    this.rig.follow = null;
    this.rig.dom = null;
    this.mainBubble.style.display = 'none';
    this.miniBubbles.forEach(b => b.style.display = 'none');
    $('detail-screen').style.display = 'none';
    $('sim-screen').style.display = 'flex';
    const gc = $('grid-container');
    gc.insertBefore(this.renderer.domElement, gc.firstChild);
    this.renderer.domElement.style.pointerEvents = 'none';
    requestAnimationFrame(() => this.onResize());
  },

  // ── camera controls ───────────────────────────────────────
  camPreset(name) {
    if (this.detailIndex < 0) return;
    if (name === 'follow') {
      if (this.rig.follow) { this.rig.follow = null; }
      else {
        const crowd = this.crowds[this.detailIndex];
        let a = this.selectedAgent;
        if (!a) { a = pick(this.sims[this.detailIndex].agents); this.selectAgent(a, null); }
        this.rig.follow = () => this.selectedAgent ? crowd.agentWorld(this.selectedAgent, this._alpha || 0) : null;
        this.rig.goal.dist = 13; this.rig.goal.pitch = 0.5; this.rig.mode = 'follow';
      }
    } else {
      this.rig.follow = null;
      this.rig.preset(name);
    }
    this._setCamButtons();
  },
  _setCamButtons() {
    document.querySelectorAll('#cam-bar [data-cam]').forEach(b => {
      b.classList.toggle('on', b.dataset.cam === 'follow' ? !!this.rig.follow : (!this.rig.follow && this.rig.mode === b.dataset.cam));
    });
    document.querySelector('#cam-bar [data-toggle=walls]').classList.toggle('on', this.prefs.cutaway);
    document.querySelector('#cam-bar [data-toggle=labels]').classList.toggle('on', this.prefs.labels);
    document.querySelector('#cam-bar [data-toggle=chatter]').classList.toggle('on', this.prefs.chatter);
  },
  toggle(what) {
    const world = this.worlds[this.detailIndex];
    if (what === 'walls') { this.prefs.cutaway = !this.prefs.cutaway; if (world) world.setCutaway(this.prefs.cutaway); }
    if (what === 'labels') { this.prefs.labels = !this.prefs.labels; if (world) world.setLabels(this.prefs.labels); }
    if (what === 'chatter') { this.prefs.chatter = !this.prefs.chatter; if (!this.prefs.chatter) this.miniBubbles.forEach(b => b.style.display = 'none'); }
    this._setCamButtons();
  },

  // ── agent picking ─────────────────────────────────────────
  pickAgent(e) {
    if (this.detailIndex < 0) return;
    const sim = this.sims[this.detailIndex], crowd = this.crowds[this.detailIndex];
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best = null, bestD = 30;
    for (const a of sim.agents) {
      crowd.agentWorld(a, this._alpha || 0, v);
      v.y += 1.0 * (a.look.height || 1);
      v.project(this.detailCam);
      if (v.z > 1) continue;
      const sx = (v.x + 1) / 2 * r.width, sy = (1 - v.y) / 2 * r.height;
      const d = Math.hypot(sx - (e.clientX - r.left), sy - (e.clientY - r.top));
      if (d < bestD) { bestD = d; best = a; }
    }
    this.selectAgent(best, e);
  },
  selectAgent(agent, e) {
    const crowd = this.crowds[this.detailIndex];
    crowd.selected = agent;
    if (!agent && this.rig.follow) { this.rig.follow = null; this._setCamButtons(); }
    if (e) this.showAgentCard(agent, e.clientX, e.clientY);
    else this.showAgentCard(agent, null, null);
  },

  showAgentCard(agent, px, py) {
    const card = $('agent-card');
    if (!agent) { card.style.display = 'none'; this.selectedAgent = null; return; }
    this.selectedAgent = agent;
    card.style.display = 'block';
    const wrap = $('detail-canvas-wrap');
    const wr = wrap.getBoundingClientRect();
    if (px !== null && px !== undefined) {
      let left = px - wr.left + 10;
      let top = py - wr.top + 10;
      if (left + 250 > wr.width) left = left - 260;
      if (top + 200 > wr.height) top = top - 210;
      card.style.left = Math.max(0, left) + 'px';
      card.style.top = Math.max(0, top) + 'px';
    } else if (!card.style.left) { card.style.left = '12px'; card.style.top = '32px'; }
    card.querySelector('.ac-name').textContent = agent.name;
    card.querySelector('.ac-type').textContent = agent.archetype + ' | ' + agent.state;
    card.querySelector('.ac-mood').innerHTML = `MOOD: <span style="color:${moodColor(agent.mood)}">${agent.mood.toFixed(1)}</span> | PAT:${agent.patience.toFixed(0)} TECH:${agent.techComfort.toFixed(0)}`;
    card.querySelector('.ac-need').textContent = agent.need;
    card.querySelector('.ac-dialogue').innerHTML = agent.dialogueHistory.slice(-3).map(d => '<div>' + d + '</div>').join('');
    card.querySelector('.ac-follow').textContent = this.rig.follow ? '[F] STOP FOLLOWING' : '[F] FOLLOW IN 3D';
  },

  triggerEvent(type) {
    if (this.detailIndex >= 0) this.sims[this.detailIndex].triggerEvent(type);
  },

  endSimulation() {
    this.running = false;
    $('sim-screen').style.display = 'none';
    $('detail-screen').style.display = 'none';
    $('report-screen').style.display = 'block';
    const report = this.buildReport();
    this.renderReport(report);
  },

  // ── report (unchanged from v0.1) ──────────────────────────
  buildReport() {
    const totalAgents = this.sims.reduce((s, v) => s + v.agents.length, 0);
    const globalAvg = this.sims.reduce((s, v) => s + v.avgMood(), 0) / this.sims.length;
    let totalFrus = 0, totalNeut = 0, totalSat = 0, totalDel = 0;
    for (const s of this.sims) for (const a of s.agents) {
      if (a.mood <= 3) totalFrus++;
      else if (a.mood <= 5.5) totalNeut++;
      else if (a.mood <= 8) totalSat++;
      else totalDel++;
    }
    const tn = totalAgents || 1;

    const venues = this.sims.map(s => {
      const agents = s.agents;
      const n = agents.length || 1;
      let frus = 0, neut = 0, sat = 0, del = 0;
      for (const a of agents) {
        if (a.mood <= 3) frus++;
        else if (a.mood <= 5.5) neut++;
        else if (a.mood <= 8) sat++;
        else del++;
      }
      const hist = s.moodHistory;
      let trend = 'stable';
      if (hist.length >= 10) {
        const firstHalf = hist.slice(0, Math.floor(hist.length / 2));
        const secondHalf = hist.slice(Math.floor(hist.length / 2));
        const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (avg2 - avg1 > 0.3) trend = 'up';
        else if (avg1 - avg2 > 0.3) trend = 'down';
      }
      const archMap = {};
      for (const a of agents) {
        if (!archMap[a.archetype]) archMap[a.archetype] = { sum: 0, count: 0 };
        archMap[a.archetype].sum += a.mood;
        archMap[a.archetype].count++;
      }
      const archetypes = Object.entries(archMap).map(([name, d]) => ({ name, avg: d.sum / d.count, count: d.count }))
        .sort((a, b) => b.avg - a.avg);
      const insightCounts = { BOTTLENECK: 0, FRICTION: 0, CASCADE: 0, DIVERGE: 0 };
      for (const ins of s.insights) insightCounts[ins.type] = (insightCounts[ins.type] || 0) + 1;
      const quotes = s.dialogueLog.slice(-30)
        .filter(d => d.text.includes(':') || d.text.includes('!'))
        .slice(-2)
        .map(d => d.text);
      return {
        name: s.venueData.name, avg: s.avgMood(), trend,
        frus, neut, sat, del, n,
        frusPct: Math.round(frus / n * 100),
        archetypes, insights: s.insights.slice(-5), insightCounts, quotes,
        crowdLevel: s.crowdLevel, staffRatio: s.staffRatio, signageQuality: s.signageQuality
      };
    }).sort((a, b) => b.avg - a.avg);

    const insightSummary = { BOTTLENECK: { count: 0, venues: new Set() }, FRICTION: { count: 0, venues: new Set() }, CASCADE: { count: 0, venues: new Set() }, DIVERGE: { count: 0, venues: new Set() } };
    for (const s of this.sims) for (const ins of s.insights) {
      if (insightSummary[ins.type]) { insightSummary[ins.type].count++; insightSummary[ins.type].venues.add(s.venueData.name); }
    }

    const recs = [];
    for (const v of venues) {
      if (v.insightCounts.BOTTLENECK >= 3) recs.push({ venue: v.name, action: 'Increase capacity or add staff to reduce overcrowding in key zones', priority: 'high' });
      if (v.frusPct > 30) recs.push({ venue: v.name, action: 'High frustration detected (' + v.frusPct + '%) — review queue management and wait times', priority: 'high' });
      if (v.avg < 5 && v.staffRatio <= 4) recs.push({ venue: v.name, action: 'Low mood with low staff ratio (' + v.staffRatio + ') — increase staffing levels', priority: 'medium' });
      if (v.avg < 5 && v.signageQuality <= 4) recs.push({ venue: v.name, action: 'Low mood with poor signage (' + v.signageQuality + ') — improve wayfinding and signage', priority: 'medium' });
      if (v.insightCounts.CASCADE >= 2) recs.push({ venue: v.name, action: 'Mood cascades detected — intervene early when frustration clusters begin forming', priority: 'medium' });
      if (v.insightCounts.FRICTION >= 3) recs.push({ venue: v.name, action: 'Frequent friction events — address agent clustering in problem zones', priority: 'medium' });
    }
    if (recs.length === 0) recs.push({ venue: 'All Venues', action: 'Simulation ran smoothly — maintain current service levels', priority: 'low' });

    return {
      tickCount: this.tickCount, totalAgents, globalAvg,
      totalFrus, totalNeut, totalSat, totalDel, tn,
      venues, insightSummary, recs,
      bestVenue: venues[0], worstVenue: venues[venues.length - 1]
    };
  },

  renderReport(r) {
    $('report-stats').innerHTML =
      `<div>Duration: <span>${r.tickCount} ticks (${(this.simElapsedMs / 1000).toFixed(0)}s)</span></div>` +
      `<div>Agents: <span>${r.totalAgents}</span></div>` +
      `<div>Venues: <span>${this.sims.length}</span></div>`;

    const trendIcon = (t) => t === 'up' ? '&#9650;' : t === 'down' ? '&#9660;' : '&#9644;';
    const trendColor = (t) => t === 'up' ? '#4caf50' : t === 'down' ? '#e53935' : '#ffd700';
    const bar = (label, col, n) => `<div class="exec-bar-row"><span class="exec-bar-label" style="color:${col}">${label}</span><div class="exec-bar-track"><div class="exec-bar-fill" style="background:${col};width:${(n / r.tn * 100)}%"></div></div><span class="exec-bar-val">${Math.round(n / r.tn * 100)}%</span></div>`;
    $('report-exec').innerHTML =
      `<div class="exec-grid">` +
      `<div class="exec-mood">${r.globalAvg.toFixed(1)}<small>OVERALL AVG MOOD</small></div>` +
      `<div class="exec-bars">` + bar('FRUSTRATED', '#e53935', r.totalFrus) + bar('NEUTRAL', '#ffd700', r.totalNeut) + bar('SATISFIED', '#4caf50', r.totalSat) + bar('DELIGHTED', '#00e5ff', r.totalDel) + `</div>` +
      `<div class="exec-bestworst">` +
      `<div>BEST: <span>${r.bestVenue.name} (${r.bestVenue.avg.toFixed(1)})</span></div>` +
      `<div>WORST: <span>${r.worstVenue.name} (${r.worstVenue.avg.toFixed(1)})</span></div>` +
      `</div></div>`;

    $('report-rankings').innerHTML =
      `<div class="venue-rank-table">` +
      r.venues.map((v, i) => {
        const pct = ((v.avg - 1) / 9 * 100).toFixed(0);
        const mc = moodColor(v.avg);
        return `<div class="venue-rank-row">` +
          `<span class="vr-rank">#${i + 1}</span>` +
          `<span class="vr-name">${v.name}</span>` +
          `<span class="vr-mood" style="color:${mc}">${v.avg.toFixed(1)}</span>` +
          `<div class="vr-bar"><div class="vr-bar-fill" style="background:${mc};width:${pct}%"></div></div>` +
          `<span class="vr-trend" style="color:${trendColor(v.trend)}">${trendIcon(v.trend)}</span>` +
          `<span class="vr-frus">${v.frusPct}% frus</span>` +
          `</div>`;
      }).join('') + `</div>`;

    const insTypes = ['BOTTLENECK', 'FRICTION', 'CASCADE', 'DIVERGE'];
    $('report-insights').innerHTML =
      `<div class="insight-summary">` +
      insTypes.map(type => {
        const d = r.insightSummary[type];
        const venueList = [...d.venues].slice(0, 4).join(', ') || 'None';
        return `<div class="insight-type-card"><div class="itc-type">${type}</div><div class="itc-count">${d.count}</div><div class="itc-venues">${venueList}</div></div>`;
      }).join('') + `</div>`;

    const vbar = (label, col, n, tot) => `<div class="vc-bar-row"><span class="vc-bar-label" style="color:${col}">${label}</span><div class="vc-bar-track"><div class="vc-bar-fill" style="background:${col};width:${(n / tot * 100)}%"></div></div><span class="vc-bar-val">${Math.round(n / tot * 100)}%</span></div>`;
    $('report-venues').innerHTML =
      `<div class="venue-cards">` +
      r.venues.map(v => {
        const mc = moodColor(v.avg);
        return `<div class="venue-card">` +
          `<div class="vc-name">${v.name} <span class="vc-mood-val" style="color:${mc}">${v.avg.toFixed(1)}</span></div>` +
          `<div class="vc-bars">` + vbar('FRUSTRATED', '#e53935', v.frus, v.n) + vbar('NEUTRAL', '#ffd700', v.neut, v.n) + vbar('SATISFIED', '#4caf50', v.sat, v.n) + vbar('DELIGHTED', '#00e5ff', v.del, v.n) + `</div>` +
          `<div class="vc-archetypes">${v.archetypes.slice(0, 4).map(a => `${a.name}: <span>${a.avg.toFixed(1)}</span>`).join(' | ')}</div>` +
          `<div class="vc-insights">${v.insights.slice(-3).map(i => `<span class="ic-type">[${i.type}]</span> ${i.text}`).join('<br>')}</div>` +
          `<div class="vc-quotes">${v.quotes.map(q => `"${q}"`).join('<br>')}</div>` +
          `</div>`;
      }).join('') + `</div>`;

    const priColor = { high: '#e53935', medium: '#ffd700', low: '#4caf50' };
    $('report-recs').innerHTML =
      `<div class="rec-cards">` +
      r.recs.map(rec =>
        `<div class="rec-card" style="border-left-color:${priColor[rec.priority] || '#4a7c59'}">` +
        `<span class="rec-venue">${rec.venue}:</span> <span class="rec-action">${rec.action}</span>` +
        `</div>`
      ).join('') + `</div>`;
  },

  // ── simulation tick (unchanged cadence; speed scales the interval) ──
  tick() {
    this.tickCount++;
    if (this.detailIndex >= 0 && this.sims[this.detailIndex]) {
      this.sims[this.detailIndex]._viewZoom = this.rig.zoomEquivalent;
    }
    for (const sim of this.sims) sim.tick();

    if (!this._lastCollectedPerSim) this._lastCollectedPerSim = new Array(12).fill(null);
    if (this.tickCount % 4 === 0) {
      for (let i = 0; i < this.sims.length; i++) {
        const log = this.sims[i].dialogueLog;
        if (log.length > 0) {
          const newest = log[log.length - 1];
          if (newest !== this._lastCollectedPerSim[i]) {
            this._lastCollectedPerSim[i] = newest;
            this.allDialogue.push(newest);
          }
        }
      }
      if (this.allDialogue.length > 300) this.allDialogue = this.allDialogue.slice(-300);
    }
  },

  updateDashboard() {
    let totalFrus = 0, totalNeut = 0, totalSat = 0, totalDel = 0, totalAgents = 0;
    let bestSim = this.sims[0], worstSim = this.sims[0];
    for (const s of this.sims) {
      if (s.avgMood() > bestSim.avgMood()) bestSim = s;
      if (s.avgMood() < worstSim.avgMood()) worstSim = s;
      for (const a of s.agents) {
        totalAgents++;
        if (a.mood <= 3) totalFrus++;
        else if (a.mood <= 5.5) totalNeut++;
        else if (a.mood <= 8) totalSat++;
        else totalDel++;
      }
    }
    const tn = totalAgents || 1;
    const setBar = (k, n) => { $('gbar-' + k).style.width = (n / tn * 100) + '%'; $('gbv-' + k).textContent = Math.round(n / tn * 100) + '%'; };
    setBar('frus', totalFrus); setBar('neut', totalNeut); setBar('sat', totalSat); setBar('del', totalDel);

    const globalAvg = this.sims.reduce((s, v) => s + v.avgMood(), 0) / this.sims.length;
    const avgEl = $('dash-avg');
    avgEl.textContent = 'AVG: ' + globalAvg.toFixed(1) + (this.paused ? '  [PAUSED]' : '');
    avgEl.style.color = moodColor(globalAvg);
    $('dash-best').textContent = `BEST: ${bestSim.venueData.name} (${bestSim.avgMood().toFixed(1)})`;
    $('dash-worst').textContent = `WORST: ${worstSim.venueData.name} (${worstSim.avgMood().toFixed(1)})`;
    $('dash-agents').textContent = `${totalAgents} AGENTS ACTIVE`;

    const qfeed = $('dash-quotes');
    if (this.allDialogue.length > 0) {
      const recent = this.allDialogue.slice(-15);
      const lastQ = recent[recent.length - 1]?.text || '';
      if (qfeed._lastQ !== lastQ) {
        const atBottom = qfeed.scrollHeight - qfeed.scrollTop - qfeed.clientHeight < 30;
        qfeed._lastQ = lastQ;
        qfeed.innerHTML = recent.map(d => `<div class="dq-line"><span class="dq-venue">[${d.venue}]</span> <span class="dq-text">${d.text}</span></div>`).join('');
        if (atBottom) qfeed.scrollTop = qfeed.scrollHeight;
      }
    }

    const allIns = [];
    for (const s of this.sims) for (const ins of s.insights.slice(-3)) allIns.push({ ...ins, venue: s.venueData.name });
    allIns.sort((a, b) => b.time - a.time);
    const topIns = allIns.slice(0, 5);
    const icEl = $('dash-insight-cards');
    const insKey = topIns.map(i => i.time + i.type).join('');
    if (icEl._lastKey !== insKey) {
      icEl._lastKey = insKey;
      icEl.innerHTML = topIns.map(i => `<div class="dash-icard"><span class="dic-type">[${i.type}]</span> ${i.venue}: ${i.text}</div>`).join('');
    }

    for (let i = 0; i < 12; i++) {
      const sim = this.sims[i], cell = this.cells[i];
      cell.querySelector('.ch-name').textContent = sim.venueData.name;
      const avg = sim.avgMood();
      const moodEl = cell.querySelector('.ch-mood');
      moodEl.textContent = avg.toFixed(1);
      moodEl.style.color = moodColor(avg);
      cell.querySelector('.ch-count').textContent = 'n:' + sim.agents.length;
      const sparkCanvas = cell.querySelector('.ch-spark canvas');
      const sctx = sparkCanvas.getContext('2d');
      sctx.clearRect(0, 0, 50, 14);
      drawSparkline(sctx, sim.moodHistory, 0, 0, 50, 14);
      const ev = sim.activeEvent;
      cell.querySelector('.cell-event').style.width = ev ? (ev.remaining / 40 * 100) + '%' : '0';
      cell.querySelector('.cell-evlabel').textContent = ev ? EV_NAME[ev.type] : '';
    }
  },

  updateDetailPanel() {
    if (this.detailIndex < 0) return;
    const sim = this.sims[this.detailIndex];
    const avg = sim.avgMood();
    const moodEl = $('dh-mood');
    moodEl.textContent = 'AVG MOOD: ' + avg.toFixed(1);
    moodEl.style.color = moodColor(avg);

    let frus = 0, neut = 0, sat = 0, del = 0;
    for (const a of sim.agents) {
      if (a.mood <= 3) frus++;
      else if (a.mood <= 5.5) neut++;
      else if (a.mood <= 8) sat++;
      else del++;
    }
    const n = sim.agents.length || 1;
    const setBar = (k, c) => { $('bar-' + k).style.width = (c / n * 100) + '%'; $('bv-' + k).textContent = Math.round(c / n * 100) + '%'; };
    setBar('frus', frus); setBar('neut', neut); setBar('sat', sat); setBar('del', del);

    const feed = $('detail-dialogue');
    const lines = sim.dialogueLog.slice(-50);
    const lastLine = lines.length > 0 ? lines[lines.length - 1].text : '';
    if (!feed._lastLine || feed._lastLine !== lastLine) {
      const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
      feed._lastLine = lastLine;
      feed.innerHTML = lines.map(l => `<div class="dd-line">${l.text}</div>`).join('');
      if (atBottom) feed.scrollTop = feed.scrollHeight;
    }

    const insLog = $('detail-insights-log');
    const ins = sim.insights.slice(-5);
    const key = ins.map(i => i.time + i.type).join('|');
    if (insLog._key !== key) { insLog._key = key; insLog.innerHTML = ins.map(i => `<div class="insight-card"><span class="ic-type">[${i.type}]</span> ${i.text}</div>`).join(''); }

    if (this.selectedAgent) this.showAgentCard(this.selectedAgent, null, null);

    const banner = $('event-banner');
    if (sim.activeEvent || this.paused) {
      banner.style.display = 'flex';
      banner.textContent = (sim.activeEvent ? 'EVENT: ' + (EV_NAME[sim.activeEvent.type] || '???') + ' [' + sim.activeEvent.remaining + ']' : '') + (this.paused ? '   ▌▌ PAUSED [SPACE]' : '');
    } else banner.style.display = 'none';
  },

  // ── rendering ─────────────────────────────────────────────
  renderGrid(t, dt, alpha) {
    const R = this.renderer, canvas = R.domElement;
    const cr = canvas.getBoundingClientRect();
    R.setScissorTest(false);
    R.setClearColor(0x000000, 0); // scene backgrounds overwrite the GL clear colour, so reset it
    R.clear();
    R.setScissorTest(true);
    for (let i = 0; i < 12; i++) {
      const rect = this.cellViews[i].getBoundingClientRect();
      const x = rect.left - cr.left, y = rect.top - cr.top, w = rect.width, h = rect.height;
      if (w < 2 || h < 2) continue;
      const bottom = cr.height - y - h;
      R.setViewport(x, bottom, w, h);
      R.setScissor(x, bottom, w, h);
      const gcam = this.gridCams[i];
      gcam.cam.aspect = w / h; gcam.cam.updateProjectionMatrix();
      const rig = gcam.rig;
      rig.fit(w / h);
      rig.yaw = Math.PI * 0.12 + Math.sin(t * 0.05 + gcam.phase) * 0.22;
      rig.pitch = 0.92;
      rig.dist = rig.fitDist * 0.93;
      rig.target.set(0, 0, 2);
      rig.apply();
      this.worlds[i].update(t, dt);
      this.crowds[i].update(alpha, dt, t, this.tickMs / 1000);
      R.render(this.worlds[i].scene, gcam.cam);
    }
    R.setScissorTest(false);
  },

  renderDetail(t, dt, alpha) {
    const i = this.detailIndex, world = this.worlds[i], crowd = this.crowds[i];
    world.update(t, dt);
    crowd.update(alpha, dt, t, this.tickMs / 1000);
    this.rig.update(dt);
    this.renderer.render(world.scene, this.detailCam);
    this._drawBubbles(alpha);
    this._drawMinimap();
  },

  _project(v, rect) {
    v.project(this.detailCam);
    if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) return null;
    return [(v.x + 1) / 2 * rect.width, (1 - v.y) / 2 * rect.height];
  },
  _drawBubbles(alpha) {
    const sim = this.sims[this.detailIndex], crowd = this.crowds[this.detailIndex];
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    // selected agent: last line (as v0.1)
    const sa = this.selectedAgent;
    if (sa) {
      crowd.agentWorld(sa, alpha, v); v.y += 2.55 * (sa.look.height || 1);
      const p = this._project(v, rect);
      if (p) {
        const last = sa.dialogueHistory.length > 0 ? sa.dialogueHistory[sa.dialogueHistory.length - 1] : sa.state + '...';
        const txt = last.length > 40 ? last.substring(0, 38) + '..' : last;
        if (this.mainBubble._t !== txt) { this.mainBubble.textContent = txt; this.mainBubble._t = txt; }
        this.mainBubble.style.left = p[0] + 'px'; this.mainBubble.style.top = (p[1] - 6) + 'px';
        this.mainBubble.style.display = 'block';
      } else this.mainBubble.style.display = 'none';
    } else this.mainBubble.style.display = 'none';

    // ambient chatter: agents who spoke recently, nearest to the camera
    if (!this.prefs.chatter) return;
    const cam = this.detailCam.position;
    const recent = [];
    for (const a of sim.agents) {
      if (a === sa || a.lastSpoke === undefined || sim.tickCount - a.lastSpoke > 22 || !a.dialogueHistory.length) continue;
      crowd.agentWorld(a, alpha, v);
      recent.push([v.distanceToSquared(cam), a]);
    }
    recent.sort((x, y) => x[0] - y[0]);
    const maxD = this.rig.dist * 1.6;
    let used = 0;
    const placed = [];
    for (const [d2, a] of recent) {
      if (used >= this.miniBubbles.length) break;
      if (Math.sqrt(d2) > maxD + 30) break;
      crowd.agentWorld(a, alpha, v); v.y += 2.4 * (a.look.height || 1);
      const p = this._project(v, rect);
      if (!p) continue;
      if (placed.some(q => Math.abs(q[0] - p[0]) < 130 && Math.abs(q[1] - p[1]) < 34)) continue;
      placed.push(p);
      const b = this.miniBubbles[used++];
      const line = a.dialogueHistory[a.dialogueHistory.length - 1];
      const txt = line.length > 34 ? line.substring(0, 32) + '..' : line;
      if (b._t !== txt) { b.textContent = txt; b._t = txt; b.style.borderColor = moodColor(a.mood); }
      b.style.left = p[0] + 'px'; b.style.top = p[1] + 'px'; b.style.display = 'block';
    }
    for (let k = used; k < this.miniBubbles.length; k++) this.miniBubbles[k].style.display = 'none';
  },

  _drawMinimapStatic() {
    const sim = this.sims[this.detailIndex];
    const c = document.createElement('canvas');
    c.width = 180; c.height = 135;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 180, 135);
    const sx = 180 / MAP_W, sy = 135 / MAP_H;
    for (const r of sim.layout.rooms) { ctx.fillStyle = r.color; ctx.fillRect(r.x * sx, r.y * sy, r.w * sx, r.h * sy); }
    ctx.fillStyle = '#ffd70088'; ctx.font = '6px "Press Start 2P"'; ctx.fillText('MAP', 4, 10);
    this._mmStatic = c;
  },
  _drawMinimap() {
    const mm = $('minimap'), ctx = mm.getContext('2d');
    if (!this._mmStatic) return;
    ctx.drawImage(this._mmStatic, 0, 0);
    const sim = this.sims[this.detailIndex];
    for (const a of sim.agents) { ctx.fillStyle = moodColor(a.mood); ctx.fillRect(a.x * 180 - 0.75, a.y * 135 - 0.75, 1.6, 1.6); }
    const toMM = p => [(p.x / WORLD_W + 0.5) * 180, (p.z / WORLD_H + 0.5) * 135];
    const fp = this.rig.footprint();
    if (fp) {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.beginPath();
      fp.forEach((p, k) => { const [x, y] = toMM(p); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.closePath(); ctx.stroke();
    }
    const [tx, ty] = toMM(this.rig.target);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(tx - 2, ty - 2, 4, 4);
    if (this.selectedAgent) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(this.selectedAgent.x * 180 - 3, this.selectedAgent.y * 135 - 3, 6, 6); }
  },

  loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const t = (now - this.t0) / 1000;

    // Tick simulation at a fixed rate
    if (!this.paused && now - this.lastTick >= this.tickMs) {
      this.tick();
      this.simElapsedMs += now - this.lastTick;
      this.lastTick = now;
    }
    const alpha = this.paused ? 1 : clamp((now - this.lastTick) / this.tickMs, 0, 1);
    this._alpha = alpha;

    if (this.state === 'grid') {
      this.renderGrid(t, dt, alpha);
      if (!this._dashT || now - this._dashT > 150) { this._dashT = now; this.updateDashboard(); }
    } else if (this.state === 'detail' && this.detailIndex >= 0) {
      this.renderDetail(t, dt, alpha);
      if (!this._panelT || now - this._panelT > 120) { this._panelT = now; this.updateDetailPanel(); }
    }
    requestAnimationFrame(() => this.loop());
  }
};

function drawSparkline(ctx, data, x, y, w, h) {
  if (data.length < 2) return;
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const px = x + (i / (60 - 1)) * w;
    const py = y + h - ((data[i] - 1) / 9) * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

window.App = App;
App.init();
