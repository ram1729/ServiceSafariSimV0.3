// ═══════════════════════════════════════════════════
// AGENT + VENUE SIMULATION (DOM-free)
// The behavioural model — states, mood maths, contagion, events, dialogue and
// insights — is carried over unchanged from v0.1. The only changes are
// spatial, so that agents can live in a 3D building:
//   • agents always route through doorways (v0.1 only did this once the
//     detail view had been opened; grid-only venues walked through walls)
//   • a doorway is crossed straight on: approach point → door → approach point
//   • routes start from the room the agent is actually standing in
//   • the initial scatter places agents inside rooms instead of anywhere
// ═══════════════════════════════════════════════════
import { NAMES, CONTAGION_RADIUS, SPARKLINE_LEN, INSIGHT_INTERVAL, MAP_W, MAP_H } from './config.js';
import { VENUES, BASE_DIALOGUES } from './data.js';
import { clamp, rand, randInt, pick, dist, fillTpl, getArchetypeLook, parseZones, parseArchetypes, SKIN_TONES, HAIR_COLORS } from './util.js';
import { buildVenueLayout, bfsPath, findDoor, roomAt } from './layout.js';

export const STATES = ['entering','exploring','experiencing','queuing','seekingInfo','satisfied','frustrated','exiting'];

let NEXT_AGENT_ID = 1;

export class Agent {
  constructor(venueData, index, config) {
    const arch = pick(venueData.archetypes);
    this.id = NEXT_AGENT_ID++;
    this.name = pick(NAMES);
    this.archetype = arch.name;
    this.patience = arch.patience + rand(-1,1);
    this.techComfort = arch.techComfort + rand(-1,1);
    this.speed = arch.speed * rand(0.8, 1.2);
    this.mood = clamp(rand(4, 7), 1, 10);
    this.state = 'entering';
    this.need = pick(venueData.needs);
    this.dialogueHistory = [];
    this.stateTimer = 0;
    this.zonesVisited = 0;
    this.waitTime = 0;

    // Position - start near entrance
    const entrance = venueData.zones[0];
    this.x = entrance.rx + entrance.rw * rand(0.2, 0.8);
    this.y = entrance.ry + entrance.rh * rand(0.2, 0.8);
    this.tx = this.x;
    this.ty = this.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.currentZoneId = entrance.id;
    const look = getArchetypeLook(this.archetype);
    // per-person variation for 3D (archetype shirt / hat / bag kept)
    look.skin = pick(SKIN_TONES);
    look.hair = pick(HAIR_COLORS);
    look.height = look.scale * rand(0.93, 1.07);
    look.pants = pick(['#2b2f3a','#3b3b44','#4a3f35','#1f2a44','#5a5248','#2e3b2e']);
    this.look = look;
    this.walkFrame = 0;
    this.waypoints = [];
    this.waypointIndex = 0;
  }

  pickTarget(venueData, sim) {
    let zone;
    switch(this.state) {
      case 'entering':
        zone = venueData.zones[0];
        break;
      case 'exploring':
      case 'experiencing':
        zone = pick(venueData.zones);
        break;
      case 'queuing':
      case 'seekingInfo': {
        zone = venueData.zones.length > 1 ? venueData.zones[1] : venueData.zones[0];
        const infoZones = venueData.zones.filter(z =>
          z.id.includes('info') || z.id.includes('service') || z.id.includes('reception') || z.id.includes('counter'));
        if (infoZones.length > 0) zone = pick(infoZones);
        break;
      }
      case 'satisfied':
        zone = pick(venueData.zones);
        break;
      case 'frustrated':
        zone = pick(venueData.zones.slice(0, 3));
        break;
      case 'exiting':
        zone = venueData.zones[0];
        break;
      default:
        zone = pick(venueData.zones);
    }
    const finalX = zone.rx + zone.rw * rand(0.15, 0.85);
    const finalY = zone.ry + zone.rh * rand(0.15, 0.85);
    this.currentZoneId = zone.id;

    // Route through doorways, starting from the room the agent is really in
    const layout = sim && sim.layout;
    const here = layout ? roomAt(layout, this.x, this.y) : null;
    this.waypoints = [];
    this.waypointIndex = 0;
    if (here) {
      // standing in a doorway (outside any room interior)? step back into the room first
      const px = this.x * MAP_W, py = this.y * MAP_H;
      if (px < here.x || px > here.x + here.w || py < here.y || py > here.y + here.h) {
        let best = null, bd = Infinity;
        for (const d of layout.doors) {
          if (d.roomA !== here.id && d.roomB !== here.id) continue;
          const dd = (d.cx - px) ** 2 + (d.cy - py) ** 2;
          if (dd < bd) { bd = dd; best = d; }
        }
        if (best) { const ap = best.approach[here.id]; this.waypoints.push({ x: ap.x / MAP_W, y: ap.y / MAP_H }); }
      }
    }
    if (layout && here && here.id !== zone.id) {
      const path = bfsPath(layout.adjacency, here.id, zone.id);
      for (let i = 0; i < path.length - 1; i++) {
        const door = findDoor(layout.doors, path[i], path[i + 1]);
        if (!door) continue;
        const a = door.approach[path[i]], b = door.approach[path[i + 1]];
        this.waypoints.push({ x: a.x / MAP_W, y: a.y / MAP_H });
        this.waypoints.push({ x: door.cx / MAP_W, y: door.cy / MAP_H });
        this.waypoints.push({ x: b.x / MAP_W, y: b.y / MAP_H });
      }
    }
    if (this.waypoints.length > 0) {
      this.waypoints.push({ x: finalX, y: finalY });
      this.tx = this.waypoints[0].x;
      this.ty = this.waypoints[0].y;
    } else {
      this.waypoints = [];
      this.tx = finalX;
      this.ty = finalY;
    }
  }

  get onFinalLeg() {
    return this.waypoints.length === 0 || this.waypointIndex >= this.waypoints.length - 1;
  }

  tick(sim) {
    const venueData = sim.venueData;
    const zoomFactor = clamp(1 / (sim._viewZoom || 1), 0.33, 1.0);
    const spd = this.speed * 0.015 * (sim.crowdLevel > 7 ? 0.6 : 1) * zoomFactor;

    // Move toward target
    this.prevX = this.x;
    this.prevY = this.y;
    const d = dist(this.x, this.y, this.tx, this.ty);
    if (d > 0.01) {
      const dx = (this.tx - this.x) / d;
      const dy = (this.ty - this.y) / d;
      this.x += dx * Math.min(spd, d);
      this.y += dy * Math.min(spd, d);
      // Small jitter (also scaled by zoom) — kept off while threading a doorway
      const jit = (this.onFinalLeg ? 0.002 : 0.0004) * zoomFactor;
      this.x += rand(-jit, jit);
      this.y += rand(-jit, jit);
      this.x = clamp(this.x, 0.01, 0.99);
      this.y = clamp(this.y, 0.01, 0.99);
      this.walkFrame++;
    } else {
      // Advance waypoint or enter stateTimer
      if (this.waypoints.length > 0 && this.waypointIndex < this.waypoints.length - 1) {
        this.waypointIndex++;
        this.tx = this.waypoints[this.waypointIndex].x;
        this.ty = this.waypoints[this.waypointIndex].y;
      } else {
        this.waypoints = [];
        this.waypointIndex = 0;
        this.stateTimer++;
      }
    }

    // Mood update
    const prevMood = this.mood;
    let delta = 0;

    // Baseline drift toward 5.5 (mean reversion)
    delta += (5.5 - this.mood) * 0.006;

    // State-based modifiers
    if (this.state === 'experiencing') delta += 0.02;
    if (this.state === 'exploring') delta += 0.008;
    if (this.state === 'satisfied') delta += 0.015;
    if (this.state === 'seekingInfo') delta -= 0.005;

    // Neighbourhood scan (crowding + contagion share one pass; same maths as v0.1)
    let nearby = 0, moodSum = 0;
    for (const a of sim.agents) {
      if (a !== this && dist(this.x, this.y, a.x, a.y) < CONTAGION_RADIUS) { nearby++; moodSum += a.mood; }
    }
    const expectedNearby = sim.agents.length * 0.04;
    const crowdPressure = Math.max(0, nearby - expectedNearby) / Math.max(expectedNearby, 1) * (sim.crowdLevel / 10);
    delta -= crowdPressure * 0.025 * (11 - this.patience) / 10;

    // Wait penalty
    if (this.state === 'queuing') {
      this.waitTime++;
      delta -= 0.012 * (11 - this.patience) / 10;
    } else {
      this.waitTime = Math.max(0, this.waitTime - 1);
    }

    // Staff & signage (always provide some benefit)
    delta += (sim.staffRatio / 10) * 0.012;
    delta += (sim.signageQuality / 10) * 0.008;

    // Contagion
    if (nearby > 0) {
      const avgNearby = moodSum / nearby;
      delta += (avgNearby - this.mood) * 0.008;
    }

    // Event effects
    if (sim.activeEvent) {
      switch(sim.activeEvent.type) {
        case 'queueSpike':
          if (this.state === 'queuing' || this.patience < 5) delta -= 0.15 * (11 - this.patience) / 10;
          break;
        case 'rudeStaff':
          delta -= 0.12;
          break;
        case 'surpriseDelight':
          delta += 0.2 * (1 / (1 + dist(this.x, this.y, 0.5, 0.5) * 3));
          break;
        case 'systemOutage':
          delta -= 0.1 * (this.techComfort / 10);
          break;
        case 'emergencyDrill':
          delta -= 0.08;
          break;
      }
    }

    this.mood = clamp(this.mood + delta, 1, 10);

    // State transitions
    const prevState = this.state;
    switch(this.state) {
      case 'entering':
        if (this.stateTimer > 10) {
          this.state = 'exploring';
          this.stateTimer = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'exploring':
        // (counted on the final leg only, so passing doorways doesn't count as visiting)
        if (d < 0.02 && this.onFinalLeg) this.zonesVisited++;
        if (this.zonesVisited >= randInt(2, 4)) {
          const r = Math.random();
          if (r < 0.4) this.state = 'experiencing';
          else if (r < 0.7) this.state = 'queuing';
          else this.state = 'seekingInfo';
          this.stateTimer = 0;
          this.pickTarget(venueData, sim);
        } else if (this.stateTimer > 20) {
          this.pickTarget(venueData, sim);
          this.stateTimer = 0;
        }
        break;
      case 'experiencing':
        if (this.stateTimer > randInt(20, 40)) {
          this.state = this.mood > 5 ? 'satisfied' : 'frustrated';
          this.stateTimer = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'queuing':
        if (this.stateTimer > randInt(15, 50)) {
          if (this.mood < 3) this.state = 'frustrated';
          else this.state = 'exploring';
          this.stateTimer = 0;
          this.zonesVisited = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'seekingInfo':
        if (this.stateTimer > randInt(10, 25)) {
          this.state = 'exploring';
          this.stateTimer = 0;
          this.zonesVisited = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'satisfied':
        if (this.stateTimer > randInt(10, 25)) {
          this.state = 'exiting';
          this.stateTimer = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'frustrated':
        if (this.stateTimer > randInt(5, 15)) {
          this.state = Math.random() < 0.6 ? 'exiting' : 'seekingInfo';
          this.stateTimer = 0;
          this.pickTarget(venueData, sim);
        }
        break;
      case 'exiting':
        if (this.stateTimer > randInt(15, 30)) {
          this.state = 'entering';
          this.stateTimer = 0;
          this.mood = clamp(rand(4, 7), 1, 10);
          this.zonesVisited = 0;
          this.need = pick(venueData.needs);
          this.pickTarget(venueData, sim);
        }
        break;
    }

    // Emergency drill override
    if (sim.activeEvent && sim.activeEvent.type === 'emergencyDrill') {
      if (this.state !== 'exiting' && this.state !== 'entering') {
        this.state = 'exiting';
        this.stateTimer = 0;
        this.pickTarget(venueData, sim);
      }
    }

    // Dialogue generation
    const moodChange = Math.abs(this.mood - prevMood);
    const stateChanged = this.state !== prevState;
    if (stateChanged || moodChange > 0.5 || Math.random() < 0.008) {
      this.emitDialogue(sim, stateChanged ? this.state : (this.mood < 4 ? 'frustrated' : this.mood > 7 ? 'satisfied' : 'explore'));
    }
  }

  emitDialogue(sim, trigger) {
    const key = trigger === 'enter' || trigger === 'entering' ? 'enter' :
                trigger === 'exploring' || trigger === 'explore' ? 'explore' :
                trigger === 'queuing' ? 'queue' :
                trigger === 'frustrated' ? 'frustrated' :
                trigger === 'satisfied' || trigger === 'experiencing' ? 'satisfied' :
                trigger === 'exiting' ? 'exit' : 'explore';
    const venueDialogues = sim.venueData.dialogues[key] || [];
    const baseDialogues = BASE_DIALOGUES[key] || [];
    const all = venueDialogues.concat(baseDialogues);
    if (all.length === 0) return;
    const tpl = pick(all);
    const zoneName = sim.venueData.zones.find(z => z.id === this.currentZoneId)?.name || 'the area';
    const line = fillTpl(tpl, { name: this.name, zone: zoneName, venue: sim.venueData.name });
    this.dialogueHistory.push(line);
    if (this.dialogueHistory.length > 5) this.dialogueHistory.shift();
    this.lastSpoke = sim.tickCount;
    sim.dialogueLog.push({ text: line, time: Date.now(), venue: sim.venueData.name, agentId: this.id });
    if (sim.dialogueLog.length > 50) sim.dialogueLog.shift();
  }
}

export class VenueSim {
  constructor(venueKey, config) {
    const raw = VENUES[venueKey];
    this.venueKey = venueKey;
    this.venueData = {
      name: raw.name,
      zones: parseZones(raw.zones),
      archetypes: parseArchetypes(raw.archetypes),
      dialogues: raw.dialogues,
      needs: raw.needs
    };
    this.crowdLevel = config.crowd;
    this.staffRatio = config.staff;
    this.signageQuality = config.signage;
    this.agents = [];
    this.dialogueLog = [];
    this.insights = [];
    this.moodHistory = [];
    this.activeEvent = null;
    this.tickCount = 0;
    this.layout = buildVenueLayout(this.venueData);

    const zones = this.venueData.zones;
    for (let i = 0; i < config.agentCount; i++) {
      const a = new Agent(this.venueData, i, config);
      // Scatter initially — inside a random room (v0.1 scattered anywhere)
      const z = pick(zones);
      a.x = z.rx + z.rw * rand(0.15, 0.85);
      a.y = z.ry + z.rh * rand(0.15, 0.85);
      a.prevX = a.x;
      a.prevY = a.y;
      a.pickTarget(this.venueData, this);
      this.agents.push(a);
    }
  }

  tick() {
    this.tickCount++;

    // Update event
    if (this.activeEvent) {
      this.activeEvent.remaining--;
      if (this.activeEvent.remaining <= 0) this.activeEvent = null;
    }

    // Tick agents
    for (const a of this.agents) a.tick(this);

    // Record mood history
    const avg = this.avgMood();
    this.moodHistory.push(avg);
    if (this.moodHistory.length > SPARKLINE_LEN) this.moodHistory.shift();

    // Generate insights
    if (this.tickCount % INSIGHT_INTERVAL === 0) this.generateInsights();
  }

  avgMood() {
    if (this.agents.length === 0) return 5;
    return this.agents.reduce((s, a) => s + a.mood, 0) / this.agents.length;
  }

  triggerEvent(type) {
    this.activeEvent = { type, remaining: 40 };
    // Emit event dialogue
    const msgs = {
      queueSpike: 'ALERT: Queue spike detected!',
      rudeStaff: 'INCIDENT: Staff complaint reported!',
      surpriseDelight: 'EVENT: Surprise delight activated!',
      systemOutage: 'ALERT: System outage in progress!',
      emergencyDrill: 'DRILL: Emergency drill initiated!'
    };
    this.dialogueLog.push({ text: `[${this.venueData.name}] ${msgs[type] || 'Event triggered'}`, time: Date.now(), venue: this.venueData.name });
  }

  generateInsights() {
    const zones = this.venueData.zones;
    // Friction clusters
    for (const z of zones) {
      const inZone = this.agents.filter(a => a.currentZoneId === z.id);
      const frust = inZone.filter(a => a.mood < 3.5);
      if (frust.length > 3 && frust.length > inZone.length * 0.4) {
        this.insights.push({ type: 'FRICTION', text: `${z.name} - ${frust.length} frustrated agents clustered`, time: this.tickCount, zoneId: z.id });
      }
    }
    // Mood cascade
    if (this.moodHistory.length >= 10) {
      const recent = this.moodHistory[this.moodHistory.length - 1];
      const earlier = this.moodHistory[this.moodHistory.length - 10];
      if (earlier - recent > 1.2) {
        this.insights.push({ type: 'CASCADE', text: `Mood dropping: ${earlier.toFixed(1)} -> ${recent.toFixed(1)}`, time: this.tickCount });
      }
    }
    // Persona divergence
    const byType = {};
    for (const a of this.agents) {
      if (!byType[a.archetype]) byType[a.archetype] = [];
      byType[a.archetype].push(a.mood);
    }
    const overall = this.avgMood();
    for (const type in byType) {
      const avg = byType[type].reduce((s, m) => s + m, 0) / byType[type].length;
      if (Math.abs(avg - overall) > 2) {
        this.insights.push({ type: 'DIVERGE', text: `${type}s at ${avg.toFixed(1)} vs venue avg ${overall.toFixed(1)}`, time: this.tickCount });
      }
    }
    // Bottleneck
    for (const z of zones) {
      const inZone = this.agents.filter(a => a.currentZoneId === z.id);
      const expected = this.agents.length / zones.length;
      if (inZone.length > expected * 2.5 && inZone.length > 8) {
        this.insights.push({ type: 'BOTTLENECK', text: `${z.name} overcrowded (${inZone.length} agents)`, time: this.tickCount, zoneId: z.id });
      }
    }
    // Keep insights trimmed
    if (this.insights.length > 20) this.insights = this.insights.slice(-20);
  }
}
