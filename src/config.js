// ═══════════════════════════════════════════════════
// CONFIGURATION
// Simulation constants are identical to v0.1. The 3D constants below
// describe how the v0.1 2400×1800 px map is turned into a world in metres.
// ═══════════════════════════════════════════════════
export const VERSION = '0.3';
export const TICK_MS = 100;
export const INSIGHT_INTERVAL = 15;
export const SPARKLINE_LEN = 60;
export const CONTAGION_RADIUS = 0.12;
export const NAMES = ['Alex','Sam','Jordan','Casey','Morgan','Riley','Quinn','Avery','Taylor','Drew','Blake','Sage','Robin','Cameron','Dakota','Emery','Finley','Harper','Kai','Lane','Marley','Noel','Oakley','Parker','Reese','Skyler','Tatum','Wren','Arden','Blair','Charlie','Devon','Eden','Frankie','Gray','Hayden','Indigo','Jesse','Kerry','Lee','Micah','Nico','Ori','Peyton','Remy','Shay','Toby','Ash','Brin','Cleo','Dana','Ellis','Fern','Glenn','Holly','Ira','Jade','Kit','Lux','Mars','Nova'];
export const VENUE_KEYS = ['museum','hospital','airport','retail','themePark','hotel','council','trainStation','university','restaurant','bank','sportsArena'];

// Map (v0.1 pixel space — the sim still thinks in normalised 0..1 coords)
export const MAP_W = 2400, MAP_H = 1800;
export const ROOM_INSET = 26;      // px gap between a zone footprint and its building walls
export const WALL_T = 6;           // px wall thickness
export const DOOR_W = 60;          // px doorway width
export const DOOR_APPROACH = 40;   // px — agents line up this far inside a room before passing a doorway

// 3D world
export const M_PER_PX = 0.05;                 // 1 px of the v0.1 map = 5 cm
export const WORLD_W = MAP_W * M_PER_PX;      // 120 m
export const WORLD_H = MAP_H * M_PER_PX;      // 90 m
export const WALL_H = 3.0;                    // full wall height (m)
export const WALL_H_CUT = 0.7;                // cut-away wall height (m)

// normalised sim coord → world metres (x → X, y → Z), map centred on the origin
export const toWorldX = nx => (nx - 0.5) * WORLD_W;
export const toWorldZ = ny => (ny - 0.5) * WORLD_H;
export const pxToWorldX = px => (px / MAP_W - 0.5) * WORLD_W;
export const pxToWorldZ = py => (py / MAP_H - 0.5) * WORLD_H;
