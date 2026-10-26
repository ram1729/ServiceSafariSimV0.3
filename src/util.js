// ═══════════════════════════════════════════════════
// HELPERS (same behaviour as v0.1)
// ═══════════════════════════════════════════════════
export function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v}
export function lerp(a,b,t){return a+(b-a)*t}
export function rand(lo,hi){return lo+Math.random()*(hi-lo)}
export function randInt(lo,hi){return Math.floor(rand(lo,hi+1))}
export function pick(a){return a[Math.floor(Math.random()*a.length)]}

export function hexToRgb(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return[r,g,b]}
export function rgbToHex(r,g,b){return '#'+[r,g,b].map(c=>Math.round(clamp(c,0,255)).toString(16).padStart(2,'0')).join('')}
export function lerpColor(c1,c2,t){const a=hexToRgb(c1),b=hexToRgb(c2);return rgbToHex(lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t))}

export function moodColor(mood){
  if(mood<=3){return lerpColor('#e53935','#ffd700',(mood-1)/2)}
  if(mood<=6){return lerpColor('#ffd700','#4caf50',(mood-3)/3)}
  return lerpColor('#4caf50','#00e5ff',(mood-6)/4)
}

export function dist(x1,y1,x2,y2){const dx=x1-x2,dy=y1-y2;return Math.sqrt(dx*dx+dy*dy)}

export function fillTpl(tpl,vars){
  let s=tpl;
  for(const k in vars)s=s.replace(new RegExp('\\{'+k+'\\}','g'),vars[k]);
  return s;
}

export function lighten(hex, amt) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r + (255-r)*amt, g + (255-g)*amt, b + (255-b)*amt);
}
export function darken(hex, amt) {
  const [r,g,b] = hexToRgb(hex);
  return rgbToHex(r*(1-amt), g*(1-amt), b*(1-amt));
}
export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function seededRand(seed, i) {
  const x = Math.sin(seed * 9301 + i * 49297 + 233280) * 0.5 + 0.5;
  return x - Math.floor(x);
}
// Small deterministic PRNG for scene dressing (so a venue always looks the same)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

export const BODY_COLORS = ['#2196f3','#f44336','#4caf50','#ff9800','#9c27b0','#00bcd4','#795548','#607d8b','#e91e63','#3f51b5','#009688','#ff5722'];
export const HAIR_COLORS = ['#1a1a1a','#4a3728','#8b6914','#c4721a','#d4a574','#2c1810','#666666','#8b4513','#daa520','#a0522d','#333333','#1c1c1c'];
export const SKIN_TONES = ['#d4a574','#c68642','#8d5524','#f1c27d','#e0ac69','#ffdbac'];

// Archetype look — v0.1 gave every archetype one look; v0.3 keeps the archetype's
// shirt colour, hat and bag (so personas stay readable) and adds per-person
// variation in skin, hair and height.
export function getArchetypeLook(archName) {
  const h = hashStr(archName);
  const nm = archName.toLowerCase();
  let scale = 1;
  if (nm.includes('kid') || nm.includes('child')) scale = 0.68;
  else if (nm.includes('teen') || nm.includes('student') || nm.includes('freshman')) scale = 0.95;
  else if (nm.includes('elder') || nm.includes('senior')) scale = 0.94;
  return {
    body: BODY_COLORS[h % BODY_COLORS.length],
    hair: HAIR_COLORS[(h >> 4) % HAIR_COLORS.length],
    skin: SKIN_TONES[(h >> 8) % SKIN_TONES.length],
    hasHat: (h % 5) === 0,
    hasBag: (h % 4) === 0,
    scale
  };
}

export function parseZones(raw){
  return raw.map(z=>({id:z[0],name:z[1],rx:z[2],ry:z[3],rw:z[4],rh:z[5],color:z[6]}));
}
export function parseArchetypes(raw){
  return raw.map(a=>({name:a[0],patience:a[1],techComfort:a[2],speed:a[3]}));
}
