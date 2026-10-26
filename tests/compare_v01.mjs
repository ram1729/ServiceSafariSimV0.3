// Side-by-side check that the v0.3 simulation core behaves like v0.1.
// Extracts the v0.1 sim straight out of its index.html and runs both on the
// same venues/config, printing average mood and % frustrated.
//
//   node tests/compare_v01.mjs ../ServiceSafariSimV0.1/index.html
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { VenueSim as NewSim } from '../src/sim.js';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node tests/compare_v01.mjs <path to v0.1 index.html>'); process.exit(2); }
const html = fs.readFileSync(src, 'utf8');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const cut = (from, to) => js.slice(js.indexOf(from), js.indexOf(to));
const mod = [
  cut('const TICK_MS', '// MAP SYSTEM'),
  cut('function bfsPath', 'function getFloorType'),
  cut('const STATES', '// RENDERER'),
  'export { VenueSim, VENUE_KEYS };'
].join('\n');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ss01-')), 'v01sim.mjs');
fs.writeFileSync(tmp, mod.replace(/^const App[\s\S]*$/m, ''));
const OLD = await import(pathToFileURL(tmp).href);

const RUNS = +(process.env.RUNS || 6), TICKS = +(process.env.TICKS || 1200);
function stats(make) {
  let sum = 0, frus = 0;
  for (let r = 0; r < RUNS; r++) {
    const s = make();
    let acc = 0, n = 0;
    for (let t = 0; t < TICKS; t++) { s.tick(); if (t > 300) { acc += s.avgMood(); n++; } }
    sum += acc / n; frus += s.agents.filter(a => a.mood <= 3).length / s.agents.length;
  }
  return [(sum / RUNS).toFixed(2), (frus / RUNS * 100).toFixed(1)];
}
const cfg = { agentCount: 100, crowd: 5, staff: 5, signage: 5 };
console.log('venue          v0.1 mood  v0.3 mood   v0.1 frus%  v0.3 frus%');
for (const k of OLD.VENUE_KEYS) {
  const a = stats(() => new OLD.VenueSim(k, cfg)), b = stats(() => new NewSim(k, cfg));
  console.log(k.padEnd(14), a[0].padStart(9), b[0].padStart(10), a[1].padStart(11), b[1].padStart(11));
}
