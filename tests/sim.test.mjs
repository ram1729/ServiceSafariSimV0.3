// Headless checks for the simulation core: run every venue, make sure the
// maths stays sane and agents stay on walkable floor (rooms + doorways).
// Run with:  npm test
import { VenueSim } from '../src/sim.js';
import { isWalkable } from '../src/layout.js';
import { VENUE_KEYS, MAP_W, MAP_H, DOOR_W } from '../src/config.js';

let failures = 0;
const fail = msg => { failures++; console.error('  ✗ ' + msg); };
const TICKS = Number(process.env.TICKS || 1500);

for (const key of VENUE_KEYS) {
  const sim = new VenueSim(key, { agentCount: 100, crowd: 5, staff: 5, signage: 5 });
  const L = sim.layout;

  // every room reachable from the entrance
  const seen = new Set([L.rooms[0].id]), q = [L.rooms[0].id];
  while (q.length) for (const n of L.adjacency[q.shift()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  if (seen.size !== L.rooms.length) fail(`${key}: unreachable rooms`);

  // doorways fit inside both walls
  for (const d of L.doors) {
    for (const id of [d.roomA, d.roomB]) {
      const r = L.byId[id];
      const ok = d.side === 'v' ? (d.cy - DOOR_W / 2 >= r.y - 1 && d.cy + DOOR_W / 2 <= r.y + r.h + 1)
                                : (d.cx - DOOR_W / 2 >= r.x - 1 && d.cx + DOOR_W / 2 <= r.x + r.w + 1);
      if (!ok) fail(`${key}: door ${d.roomA}/${d.roomB} does not fit in ${id}`);
    }
  }

  // events part-way through
  let offFloor = 0, samples = 0, stateCounts = {};
  for (let t = 0; t < TICKS; t++) {
    if (t === 300) sim.triggerEvent('queueSpike');
    if (t === 500) sim.triggerEvent('emergencyDrill');
    if (t === 700) sim.triggerEvent('surpriseDelight');
    sim.tick();
    if (t % 5 === 0) {
      for (const a of sim.agents) {
        samples++;
        if (!isWalkable(L, a.x, a.y, 12)) offFloor++;
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.mood)) fail(`${key}: NaN agent`);
        stateCounts[a.state] = (stateCounts[a.state] || 0) + 1;
      }
    }
  }
  const pct = offFloor / samples * 100;
  if (pct > 0.5) fail(`${key}: ${pct.toFixed(2)}% of agent samples off walkable floor`);
  const avg = sim.avgMood();
  if (avg < 1 || avg > 10) fail(`${key}: avg mood out of range`);
  console.log(`  ${key.padEnd(13)} rooms ${L.rooms.length} doors ${String(L.doors.length).padStart(2)}  avg mood ${avg.toFixed(2)}  off-floor ${pct.toFixed(3)}%  insights ${sim.insights.length}  states ${Object.keys(stateCounts).length}`);
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall simulation checks passed');
