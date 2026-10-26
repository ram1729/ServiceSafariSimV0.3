// ═══════════════════════════════════════════════════
// LAYOUT — rooms, doorways and the room graph (DOM-free).
// v0.1 built this lazily for the detail view only; v0.3 builds it for every
// venue up front so agents always walk through doorways (never through walls).
// ═══════════════════════════════════════════════════
import { MAP_W, MAP_H, ROOM_INSET, DOOR_W, DOOR_APPROACH } from './config.js';
import { clamp } from './util.js';

export function buildVenueLayout(venueData) {
  const rooms = venueData.zones.map(z => ({
    id: z.id, name: z.name, color: z.color,
    ox: z.rx * MAP_W, oy: z.ry * MAP_H, ow: z.rw * MAP_W, oh: z.rh * MAP_H,
    x: z.rx * MAP_W + ROOM_INSET, y: z.ry * MAP_H + ROOM_INSET,
    w: z.rw * MAP_W - ROOM_INSET * 2, h: z.rh * MAP_H - ROOM_INSET * 2
  }));
  const byId = {};
  for (const r of rooms) byId[r.id] = r;
  const doors = [];
  const adjacency = {};
  for (const r of rooms) adjacency[r.id] = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const door = findSharedEdge(rooms[i], rooms[j]);
      if (door) {
        doors.push(door);
        adjacency[rooms[i].id].push(rooms[j].id);
        adjacency[rooms[j].id].push(rooms[i].id);
      }
    }
  }
  return { rooms, byId, doors, adjacency };
}

// Same adjacency test as v0.1, except rooms that only meet at a corner get
// no doorway (a 3D wall can't hold one there). The doorway is then centred on the overlap of
// the two rooms' *interiors* so it can be cut cleanly out of both walls.
function findSharedEdge(a, b) {
  const T = 0.035 * MAP_W, MIN = 40;
  const vertical = (left, right) => {
    const top = Math.max(left.y, right.y), bot = Math.min(left.y + left.h, right.y + right.h);
    const otop = Math.max(left.oy, right.oy), obot = Math.min(left.oy + left.oh, right.oy + right.oh);
    if (obot - otop <= MIN) return null;
    const half = DOOR_W / 2 + 6;
    if (bot - top < half * 2) return null; // rooms only touch at a corner — no room for a doorway
    const cy = clamp((otop + obot) / 2, top + half, bot - half);
    const cx = (left.x + left.w + right.x) / 2;
    return mkDoor(left, right, cx, cy, 'v',
      { x: left.x + left.w - DOOR_APPROACH, y: cy }, { x: right.x + DOOR_APPROACH, y: cy });
  };
  const horizontal = (upper, lower) => {
    const l = Math.max(upper.x, lower.x), r = Math.min(upper.x + upper.w, lower.x + lower.w);
    const ol = Math.max(upper.ox, lower.ox), or = Math.min(upper.ox + upper.ow, lower.ox + lower.ow);
    if (or - ol <= MIN) return null;
    const half = DOOR_W / 2 + 6;
    if (r - l < half * 2) return null; // rooms only touch at a corner — no room for a doorway
    const cx = clamp((ol + or) / 2, l + half, r - half);
    const cy = (upper.y + upper.h + lower.y) / 2;
    return mkDoor(upper, lower, cx, cy, 'h',
      { x: cx, y: upper.y + upper.h - DOOR_APPROACH }, { x: cx, y: lower.y + DOOR_APPROACH });
  };
  if (Math.abs((a.ox + a.ow) - b.ox) < T) { const d = vertical(a, b); if (d) return d; }
  if (Math.abs((b.ox + b.ow) - a.ox) < T) { const d = vertical(b, a); if (d) return d; }
  if (Math.abs((a.oy + a.oh) - b.oy) < T) { const d = horizontal(a, b); if (d) return d; }
  if (Math.abs((b.oy + b.oh) - a.oy) < T) { const d = horizontal(b, a); if (d) return d; }
  return null;
}

function mkDoor(p, q, cx, cy, side, approachP, approachQ) {
  return { roomA: p.id, roomB: q.id, cx, cy, side, approach: { [p.id]: approachP, [q.id]: approachQ } };
}

export function bfsPath(adj, from, to) {
  if (from === to) return [from];
  const visited = new Set([from]);
  const queue = [[from]];
  while (queue.length) {
    const path = queue.shift();
    const node = path[path.length - 1];
    for (const nb of (adj[node] || [])) {
      if (nb === to) return [...path, nb];
      if (!visited.has(nb)) { visited.add(nb); queue.push([...path, nb]); }
    }
  }
  return [from, to];
}

export function findDoor(doors, rA, rB) {
  return doors.find(d => (d.roomA === rA && d.roomB === rB) || (d.roomA === rB && d.roomB === rA));
}

// Which room footprint is a normalised point standing in? (nearest if in between)
export function roomAt(layout, nx, ny) {
  const px = nx * MAP_W, py = ny * MAP_H;
  let best = null, bestD = Infinity;
  for (const r of layout.rooms) {
    const dx = Math.max(r.ox - px, 0, px - (r.ox + r.ow));
    const dy = Math.max(r.oy - py, 0, py - (r.oy + r.oh));
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// Is a normalised point on walkable floor (a room interior or a doorway)?
export function isWalkable(layout, nx, ny, slackPx = 0) {
  const px = nx * MAP_W, py = ny * MAP_H;
  for (const r of layout.rooms) {
    if (px >= r.x - slackPx && px <= r.x + r.w + slackPx && py >= r.y - slackPx && py <= r.y + r.h + slackPx) return true;
  }
  for (const d of layout.doors) {
    const hw = DOOR_W / 2 + slackPx;
    if (d.side === 'v') {
      const a = d.approach[d.roomA], b = d.approach[d.roomB];
      if (px >= Math.min(a.x, b.x) && px <= Math.max(a.x, b.x) && Math.abs(py - d.cy) <= hw) return true;
    } else {
      const a = d.approach[d.roomA], b = d.approach[d.roomB];
      if (py >= Math.min(a.y, b.y) && py <= Math.max(a.y, b.y) && Math.abs(px - d.cx) <= hw) return true;
    }
  }
  return false;
}
