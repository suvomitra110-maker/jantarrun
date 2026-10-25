(() => {
'use strict';
// Victory banner text shown after the flag is raised (written by the player).
const VICTORY_LINE = 'Victory over the fascist Modi–BJP government. The people have spoken.';

const M = window.DELHI_MAP;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const km = m => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m');

// ---------- Characters ----------
const CHARS = {
  male:   { label: 'Male',   desc: 'Steady runner with the biggest stamina tank.', run: 66, sprint: 104, stam: 140, drain: 30, hide: 12, radar: 650 },
  female: { label: 'Female', desc: 'Quickest on her feet. Hides longest in shops.', run: 70, sprint: 106, stam: 110, drain: 30, hide: 18, radar: 650 },
  genz:   { label: 'Gen Z',  desc: 'Fastest sprint. Phone live-map shows every cop.', run: 68, sprint: 122, stam: 100, drain: 38, hide: 12, radar: 99999 },
};
const STARTS = [
  { name: 'Red Fort', mark: 'Red Fort' }, { name: 'Karol Bagh', mark: 'Karol Bagh' },
  { name: 'Lodhi Garden', mark: 'Lodhi Garden' }, { name: 'Raj Ghat', mark: 'Raj Ghat' },
];
let choice = { char: 'female', start: 0 };
// Anonymous play: a random alias per page load. Nothing is stored or sent anywhere.
const ALIAS = 'Protester #' + (1000 + crypto.getRandomValues(new Uint16Array(1))[0] % 9000);
let mapMode = 'street'; // 'street' | 'sat'

// ---------- Graph ----------
const nodes = M.nodes.map(([x, y], i) => ({ i, x, y, adj: [] }));
const edges = M.edges.map(([a, b, flat, name, cls], i) => {
  const pts = [];
  for (let k = 0; k < flat.length; k += 2) pts.push([flat[k], flat[k + 1]]);
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { i, a, b, pts, cum, len: Math.max(cum[cum.length - 1], 0.5), name, cls, blocked: false, bar: null };
});
function edgePos(e, d) {
  if (d <= 0) return e.pts[0];
  if (d >= e.len) return e.pts[e.pts.length - 1];
  const c = e.cum; let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
  const t = (d - c[lo]) / ((c[hi] - c[lo]) || 1), p = e.pts[lo], q = e.pts[hi];
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}
function edgeTan(e, d, dir) {
  const a = edgePos(e, Math.max(0, d - 8)), b = edgePos(e, Math.min(e.len, d + 8));
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dir * dx / l, dir * dy / l];
}
function headingFrom(e, dir) {
  const p0 = dir > 0 ? edgePos(e, 0) : edgePos(e, e.len);
  const p1 = dir > 0 ? edgePos(e, Math.min(18, e.len)) : edgePos(e, Math.max(e.len - 18, 0));
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
edges.forEach(e => {
  nodes[e.a].adj.push({ e: e.i, dir: 1, to: e.b, h: headingFrom(e, 1) });
  nodes[e.b].adj.push({ e: e.i, dir: -1, to: e.a, h: headingFrom(e, -1) });
});
function nearestNode(x, y) {
  let best = 0, bd = Infinity;
  for (const n of nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n.i; } }
  return best;
}
// Dijkstra with a binary heap. respect = skip barricaded edges.
function field(src, respect) {
  const N = nodes.length, dist = new Float64Array(N).fill(Infinity);
  const hd = [], hn = [];
  const push = (d, n) => { hd.push(d); hn.push(n); let i = hd.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hd[p] <= hd[i]) break; [hd[p], hd[i]] = [hd[i], hd[p]]; [hn[p], hn[i]] = [hn[i], hn[p]]; i = p; } };
  const pop = () => { const d = hd[0], n = hn[0], ld = hd.pop(), ln = hn.pop(); if (hd.length) { hd[0] = ld; hn[0] = ln; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hd.length && hd[l] < hd[m]) m = l; if (r < hd.length && hd[r] < hd[m]) m = r; if (m === i) break; [hd[m], hd[i]] = [hd[i], hd[m]]; [hn[m], hn[i]] = [hn[i], hn[m]]; i = m; } } return [d, n]; };
  dist[src] = 0; push(0, src);
  while (hd.length) {
    const [d, u] = pop(); if (d > dist[u]) continue;
    for (const ad of nodes[u].adj) {
      const e = edges[ad.e]; if (respect && e.blocked) continue;
      const nd = d + e.len; if (nd < dist[ad.to]) { dist[ad.to] = nd; push(nd, ad.to); }
    }
  }
  return dist;
}

// ---------- Places ----------
const marks = M.marks.map(([name, x, y]) => ({ name, x, y }));
const markBy = n => marks.find(m => m.name === n);
const jantar = markBy('Jantar Mantar');
const JN = nearestNode(jantar.x, jantar.y);
const jantarFieldAll = field(JN, false);
let jantarFieldOpen = jantarFieldAll;
const stations = M.police.map(([name, x, y]) => { const n = nearestNode(x, y); return { name, x, y, node: n, field: field(n, false), held: [] }; });
const spots = M.spots.map(([name, kind, x, y, e, d]) => {
  const p = edgePos(edges[e], d);
  return { name, kind, x, y, e, d, px: p[0], py: p[1], found: false, cool: 0, big: /mall|department_store|supermarket/.test(kind), lastExit: -99 };
});
const KIND_LABEL = { mall: 'Mall', department_store: 'Dept. store', supermarket: 'Supermarket', clothes: 'Clothes shop', books: 'Bookshop', gift: 'Gift shop', bakery: 'Bakery', confectionery: 'Sweet shop', electronics: 'Electronics', mobile_phone: 'Phone shop', jewelry: 'Jeweller', tailor: 'Tailor', shoes: 'Shoe shop' };

// barricade candidates: edges crossing graph-distance rings around Jantar Mantar
function cutEdges(R) {
  return edges.filter(e => {
    const fa = jantarFieldAll[e.a], fb = jantarFieldAll[e.b];
    return (fa < R) !== (fb < R) && e.len > 30;
  });
}
const RING1 = cutEdges(650), RING2 = cutEdges(1700);

// labels
const labels = (() => {
  const best = {};
  edges.forEach(e => { if (e.name && !/Rotary|Roundabout|Chowk|Flyover/.test(e.name) && (!best[e.name] || e.len > best[e.name].len)) best[e.name] = e; });
  return Object.values(best).filter(e => e.len > 260);
})();

// chunked Path2D for fast drawing
const CH = 1500, chunks = new Map();
function chunk(cx, cy) { const k = cx + ',' + cy; let c = chunks.get(k); if (!c) { c = { p: new Path2D(), s: new Path2D(), t: new Path2D(), g: new Path2D(), w: new Path2D() }; chunks.set(k, c); } return c; }
function bboxOf(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; }
function eachChunk(bb, f) { for (let cx = Math.floor(bb[0] / CH); cx <= Math.floor(bb[2] / CH); cx++) for (let cy = Math.floor(bb[1] / CH); cy <= Math.floor(bb[3] / CH); cy++) f(chunk(cx, cy)); }
edges.forEach(e => eachChunk(bboxOf(e.pts), c => { const p = c[e.cls] || c.t; p.moveTo(e.pts[0][0], e.pts[0][1]); for (let k = 1; k < e.pts.length; k++) p.lineTo(e.pts[k][0], e.pts[k][1]); }));
M.polys.forEach(([kind, flat]) => {
  const pts = []; for (let k = 0; k < flat.length; k += 2) pts.push([flat[k], flat[k + 1]]);
  eachChunk(bboxOf(pts), c => { const p = kind === 'w' ? c.w : c.g; p.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) p.lineTo(pts[k][0], pts[k][1]); p.closePath(); });
});
const [BX0, BY0, BX1, BY1] = M.bounds;
// buildings, rail and metro load after the game starts (extra.js)
let metroLines = [], metroStations = [];
function addExtra(X) {
  for (const [k, ...d] of X.b) {
    const pts = [[d[0], d[1]]]; for (let i = 2; i < d.length; i += 2) pts.push([pts[pts.length - 1][0] + d[i], pts[pts.length - 1][1] + d[i + 1]]);
    eachChunk(bboxOf(pts), c => { const p = c['b' + k] || (c['b' + k] = new Path2D()); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); });
  }
  for (const f of X.rail) { const pts = []; for (let i = 0; i < f.length; i += 2) pts.push([f[i], f[i + 1]]); eachChunk(bboxOf(pts), c => { const p = c.rl || (c.rl = new Path2D()); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); }); }
  metroLines = X.metro.map(([col, f]) => { const p = new Path2D(); p.moveTo(f[0], f[1]); for (let i = 2; i < f.length; i += 2) p.lineTo(f[i], f[i + 1]); return { col, p }; });
  metroStations = X.ms.map(([name, x, y, m]) => ({ name, x, y, m }));
  if (W) buildMini();
}
if (window.DELHI_EXTRA) addExtra(window.DELHI_EXTRA);
else { const sc = document.createElement('script'); sc.src = 'extra.js'; sc.async = true; sc.onload = () => window.DELHI_EXTRA && addExtra(window.DELHI_EXTRA); document.head.appendChild(sc); }

// satellite tiles (Esri World Imagery), only requested when Satellite view is on
const LAT0 = 28.6225, LON0 = 77.2175, KX = Math.cos(LAT0 * Math.PI / 180) * 111320, KY = 110574;
const tiles = new Map();
const lon2t = (lon, z) => (lon + 180) / 360 * 2 ** z;
const lat2t = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
const t2lon = (x, z) => x / 2 ** z * 360 - 180;
const t2lat = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const ll2w = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KY];
function tile(z, x, y) {
  const k = z + '/' + y + '/' + x; let t = tiles.get(k);
  if (!t) {
    if (tiles.size > 500) { const old = tiles.keys().next().value; tiles.delete(old); }
    t = { img: new Image(), ok: false }; t.img.referrerPolicy = 'no-referrer'; t.img.onload = () => (t.ok = true);
    t.img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${k}`; tiles.set(k, t);
  }
  return t;
}
function drawSat(vx0, vy0, vx1, vy1) {
  let z = Math.round(Math.log2(156543.03 * Math.cos(LAT0 * Math.PI / 180) * cam.z * DPR)); z = Math.max(13, Math.min(18, z));
  const range = z => { const lonA = LON0 + vx0 / KX, lonB = LON0 + vx1 / KX, latA = LAT0 - vy0 / KY, latB = LAT0 - vy1 / KY; return [Math.floor(lon2t(lonA, z)), Math.floor(lon2t(lonB, z)), Math.floor(lat2t(latA, z)), Math.floor(lat2t(latB, z))]; };
  let r = range(z); while ((r[1] - r[0] + 1) * (r[3] - r[2] + 1) > 60 && z > 13) r = range(--z);
  ctx.fillStyle = '#4b4a3e'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  for (let x = r[0]; x <= r[1]; x++) for (let y = r[2]; y <= r[3]; y++) {
    const a = ll2w(t2lat(y, z), t2lon(x, z)), b = ll2w(t2lat(y + 1, z), t2lon(x + 1, z));
    const t = tile(z, x, y);
    if (t.ok) { ctx.drawImage(t.img, a[0], a[1], b[0] - a[0] + 0.6, b[1] - a[1] + 0.6); continue; }
    const p = tiles.get((z - 1) + '/' + (y >> 1) + '/' + (x >> 1));
    if (p && p.ok) ctx.drawImage(p.img, (x & 1) * 128, (y & 1) * 128, 128, 128, a[0], a[1], b[0] - a[0] + 0.6, b[1] - a[1] + 0.6);
  }
}

// ---------- Entities ----------
const PCOL = ['#f08a1c', '#2f7d4f', '#d6457a', '#3a7bd5', '#ffb627', '#8a4fd1', '#e0583a', '#1a9c9c', '#f3efe6'];
const KINDS = ['male', 'female', 'genz'];
function placeOnNode(ent, n, respect) {
  let opts = nodes[n].adj; if (respect) { const o = opts.filter(a => !edges[a.e].blocked); if (o.length) opts = o; }
  const ad = pick(opts); ent.e = ad.e; ent.dir = ad.dir; ent.d = ad.dir > 0 ? 0 : edges[ad.e].len;
}
const entPos = ent => edgePos(edges[ent.e], ent.d);
function atNodeOf(ent) { const e = edges[ent.e]; if (ent.d <= 0.01) return e.a; if (ent.d >= e.len - 0.01) return e.b; return -1; }
function moveEnt(ent, dist, chooser) {
  let guard = 0;
  while (dist > 0 && guard++ < 14) {
    const e = edges[ent.e], remain = ent.dir > 0 ? e.len - ent.d : ent.d;
    if (dist < remain) { ent.d += ent.dir * dist; ent.walk = (ent.walk || 0) + dist * 0.35; return true; }
    ent.d = ent.dir > 0 ? e.len : 0; dist -= remain; ent.walk = (ent.walk || 0) + remain * 0.35;
    const nx = chooser(ent, ent.dir > 0 ? e.b : e.a);
    if (!nx) return false;
    ent.e = nx.e; ent.dir = nx.dir; ent.d = nx.dir > 0 ? 0 : edges[nx.e].len;
  }
  return true;
}

let S;
function newState() {
  const C = CHARS[choice.char], st = STARTS[choice.start], sm = markBy(st.mark);
  const s = {
    t: 0, score: 0, pamphlets: 0, rescues: 0, fooled: 0, rally: 0, running: false, over: false, won: false,
    player: null, crowd: [], cops: [], items: [], fx: [], nextCop: 12, level: 1, fields: new Map(), fieldT: 0, shake: 0,
    C, barT: 18, closedIn: false, startName: st.name, toastCD: 0,
    wanted: 0, chaseT: 0, unseenT: 0, ministers: [], minT: 10, beaten: 0, gheraos: 0, detentions: 0, chapter: 0, startDist: 0, smashed: 0, knocked: 0, drinks: [], blendT: 0,
  };
  resetBarricades();
  const sn = nearestNode(sm.x, sm.y);
  s.player = { kind: choice.char, you: true, stam: C.stam, state: 'free', walk: 0, boost: 0, cover: 0, blend: false };
  placeOnNode(s.player, sn, true);
  // crowd: some with you, some across the city
  const near = nodes.filter(n => Math.hypot(n.x - sm.x, n.y - sm.y) < 500);
  for (let k = 0; k < 34; k++) {
    const c = { kind: pick(KINDS), top: pick(PCOL), placardCol: pick(PCOL), state: 'free', spd: rand(46, 54), think: 0, walk: Math.random() * 9 };
    const base = k < 12 ? pick(near) : pick(nodes);
    placeOnNode(c, base.i, true); c.d = edges[c.e].blocked ? c.d : rand(0, edges[c.e].len);
    s.crowd.push(c);
  }
  S = s;
  // police: from stations, plus guards around Jantar Mantar
  stations.forEach((stn, i) => { if (i % 2 === 0) spawnCop(stn); });
  for (let k = 0; k < 4; k++) { const c = spawnCop(null, JN); c.guard = true; }
  for (let k = 0; k < 26; k++) spawnItem();
  for (let k = 0; k < 7; k++) spawnDrink();
  return s;
}
function spawnCop(st, node) {
  st = st || pick(stations);
  const c = { kind: 'cop', state: 'patrol', target: null, carry: null, stun: 0, think: Math.random(), spd: 54, siren: Math.random() * 6, walk: Math.random() * 9 };
  placeOnNode(c, node != null ? node : st.node);
  S.cops.push(c); return c;
}
function spawnItem() {
  const p = entPos(S.player);
  for (let tries = 0; tries < 40; tries++) {
    const e = pick(edges); const q = edgePos(e, rand(0, e.len)); const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d > 250 && d < 2600) { S.items.push({ x: q[0], y: q[1], ph: Math.random() * 6 }); return; }
  }
}
function spawnDrink() {
  const p = entPos(S.player);
  for (let tries = 0; tries < 60; tries++) {
    const e = pick(edges); if (e.blocked) continue; const q = edgePos(e, rand(0, e.len)), d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d > 300 && d < 2400) { S.drinks.push({ x: q[0], y: q[1], ph: Math.random() * 6 }); return; }
  }
}
function getField(n) { let f = S.fields.get(n); if (!f) { f = field(n, false); S.fields.set(n, f); } return f; }

// ---------- Barricades ----------
function setBar(e, on) {
  e.blocked = on;
  if (on) {
    const outerB = jantarFieldAll[e.b] > jantarFieldAll[e.a];
    const d = outerB ? Math.max(e.len / 2, e.len - 22) : Math.min(e.len / 2, 22);
    const p = edgePos(e, d), t = edgeTan(e, d, 1);
    e.bar = { x: p[0], y: p[1], ang: Math.atan2(t[1], t[0]) + Math.PI / 2 };
  } else e.bar = null;
}
function resetBarricades() { edges.forEach(e => { e.blocked = false; e.bar = null; }); jantarFieldOpen = jantarFieldAll; }
function pathOpenFrom(nodeList) { const f = field(JN, true); return nodeList.every(n => isFinite(f[n])) ? f : null; }
function playerNodes() { const e = edges[S.player.e]; return [e.a, e.b]; }
function tryBarricade(e, announce) {
  if (e.blocked || e.i === S.player.e) return false;
  setBar(e, true);
  const f = pathOpenFrom(playerNodes());
  if (!f) { setBar(e, false); return false; }
  jantarFieldOpen = f;
  if (announce) { toast(`Police barricade going up${e.name ? ' on ' + e.name : ''}`); S.fx.push({ x: e.bar.x, y: e.bar.y, t: 1.6, txt: 'BARRICADE' }); }
  return true;
}
function initialBarricades() {
  const shuffle = a => a.map(v => [Math.random(), v]).sort((p, q) => p[0] - q[0]).map(v => v[1]);
  let n1 = Math.max(2, Math.floor(RING1.length * 0.6)), n2 = Math.floor(RING2.length * 0.35);
  for (const e of shuffle(RING1)) { if (n1 <= 0) break; if (tryBarricade(e)) n1--; }
  for (const e of shuffle(RING2)) { if (n2 <= 0) break; if (tryBarricade(e)) n2--; }
}
function shiftBarricade() {
  const on = edges.filter(e => e.blocked);
  if (on.length && Math.random() < 0.7) { setBar(pick(on), false); }
  const pool = Math.random() < 0.6 ? RING1 : RING2;
  for (let i = 0; i < 8; i++) if (tryBarricade(pick(pool), true)) break;
  jantarFieldOpen = field(JN, true);
}

// ---------- Input ----------
const keys = {};
let sprintHeld = false, stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyE' && !e.repeat) hideToggle();
  if (e.code === 'KeyF' && !e.repeat) beatMinister();
  if (e.code === 'KeyG' && !e.repeat) blockMinister();
  if (e.code === 'KeyV' && !e.repeat) setMapMode(mapMode === 'sat' ? 'street' : 'sat');
  if (e.code === 'Space' && flag.active) flag.hold = true;
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') flag.hold = false; });
const stickEl = $('stick'), knob = stickEl.firstElementChild;
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  stick = { on: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
  stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = 'translate(0,0)';
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!stick.on || e.pointerId !== stick.id) return;
  let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy);
  if (l > 45) { dx *= 45 / l; dy *= 45 / l; }
  stick.x = dx / 45; stick.y = dy / 45; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
const endStick = e => { if (e.pointerId === stick.id) { stick.on = false; stickEl.style.display = 'none'; } };
cv.addEventListener('pointerup', endStick); cv.addEventListener('pointercancel', endStick);
$('sprintBtn').addEventListener('pointerdown', e => { e.preventDefault(); sprintHeld = true; });
$('sprintBtn').addEventListener('pointerup', () => sprintHeld = false);
$('sprintBtn').addEventListener('pointerleave', () => sprintHeld = false);
$('hideBtn').addEventListener('pointerdown', e => { e.preventDefault(); hideToggle(); });
$('beatBtn').addEventListener('pointerdown', e => { e.preventDefault(); beatMinister(); });
$('blockBtn').addEventListener('pointerdown', e => { e.preventDefault(); blockMinister(); });
function inputVec() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
  if (stick.on && Math.hypot(stick.x, stick.y) > 0.25) { x = stick.x; y = stick.y; }
  const l = Math.hypot(x, y); return l ? [x / l, y / l] : null;
}

// ---------- Audio ----------
let AC = null, muted = false, beatT = 0, beatI = 0;
function audioInit() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function whistle() {
  if (!AC || muted) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), l = AC.createOscillator(), lg = AC.createGain();
  o.frequency.value = 2700; l.frequency.value = 28; lg.gain.value = 180; l.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g).connect(AC.destination); o.start(t); l.start(t); o.stop(t + 0.55); l.stop(t + 0.55);
}
const DHOL = [1, 0, 2, 1, 0, 2, 1, 2];
function beat(dt, fast) {
  if (!AC || muted) return;
  const bpm = fast ? 200 : 160 + Math.min(S.level, 8) * 6; beatT -= dt;
  if (beatT <= 0) { beatT += 60 / bpm / 2; const b = DHOL[beatI++ % DHOL.length]; if (b === 1) tone(95, 0.22, 'sine', 0.22, 0.5); else if (b === 2) tone(330, 0.08, 'triangle', 0.07, 0.7); }
}
function fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, 0, i * 0.18)); }
function toggleMute() { muted = !muted; $('hMute').textContent = muted ? 'Off' : 'On'; }
$('muteBtn').addEventListener('click', toggleMute);

// ---------- UI ----------
let toastTimer = 0;
function toast(msg, dur = 2.4) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); toastTimer = dur; }
function buildMenu() {
  const wrap = $('chars'); wrap.innerHTML = '';
  Object.entries(CHARS).forEach(([k, c]) => {
    const b = document.createElement('button'); b.className = 'char'; b.type = 'button'; b.setAttribute('aria-pressed', k === choice.char);
    b.innerHTML = `<canvas width="240" height="220"></canvas><b>${c.label}</b><span>${c.desc}</span>`;
    b.onclick = () => { choice.char = k; buildMenu(); };
    wrap.appendChild(b);
    const g = b.querySelector('canvas').getContext('2d');
    drawChar(g, 120, 205, k, { s: 3.6, placard: true, placardCol: '#2f7d4f' });
  });
  const mw = $('modes'); mw.innerHTML = '';
  [['street', 'Street map'], ['sat', 'Satellite']].forEach(([k, l]) => {
    const b = document.createElement('button'); b.className = 'start'; b.type = 'button'; b.textContent = l; b.setAttribute('aria-pressed', mapMode === k);
    b.onclick = () => { setMapMode(k); buildMenu(); }; mw.appendChild(b);
  });
  $('alias').textContent = ALIAS;
  const sw = $('starts'); sw.innerHTML = '';
  STARTS.forEach((st, i) => {
    const b = document.createElement('button'); b.className = 'start'; b.type = 'button'; b.textContent = st.name; b.setAttribute('aria-pressed', i === choice.start);
    b.onclick = () => { choice.start = i; buildMenu(); }; sw.appendChild(b);
  });
}
function setMapMode(m) { mapMode = m; $('hMap').textContent = m === 'sat' ? 'Satellite' : 'Street'; }
$('mapBtn').addEventListener('click', () => setMapMode(mapMode === 'sat' ? 'street' : 'sat'));
buildMenu();
function startGame() {
  audioInit(); if (AC && AC.state === 'suspended') AC.resume();
  newState(); initialBarricades(); S.running = true;
  ['startScreen', 'overScreen', 'winScreen'].forEach(id => $(id).classList.add('hidden'));
  flag.active = false;
  const p = entPos(S.player); cam.x = p[0]; cam.y = p[1];
  S.startDist = Math.hypot(p[0] - jantar.x, p[1] - jantar.y);
  toast(STORY[0].replace('{start}', S.startName), 6);
}
$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('winAgain').addEventListener('click', startGame);
const toMenu = () => { ['overScreen', 'winScreen'].forEach(id => $(id).classList.add('hidden')); flag.active = false; buildMenu(); $('startScreen').classList.remove('hidden'); };
$('changeBtn').addEventListener('click', toMenu);
$('winChange').addEventListener('click', toMenu);

// ---------- Hiding ----------
function nearSpot() {
  if (!S || S.player.state !== 'free') return null;
  const p = entPos(S.player); let best = null, bd = 30;
  for (const sp of spots) { const d = Math.hypot(sp.px - p[0], sp.py - p[1]); if (d < bd) { bd = d; best = sp; } }
  return best;
}
function hideToggle() {
  if (!S || !S.running || S.over) return;
  const P = S.player;
  if (P.state === 'hidden') { leaveSpot(false); return; }
  const sp = nearSpot(); if (!sp) return;
  if (sp.cool > 0) { toast(`Police are watching ${sp.name}. Try another shop.`); return; }
  P.state = 'hidden'; P.spot = sp; P.hideT = 0; P.e = sp.e; P.d = sp.d; sp.found = true;
  tone(300, 0.15, 'triangle', 0.1, 0.6);
  let searchers = 0, fooled = 0;
  const pp = [sp.px, sp.py];
  for (const k of S.cops) {
    if (k.target !== P) continue;
    const q = entPos(k), d = Math.hypot(q[0] - pp[0], q[1] - pp[1]);
    if (d < 110 && searchers < 1) { k.state = 'search'; k.spot = sp; k.searchT = 3.6; k.target = null; searchers++; }
    else { k.target = null; k.state = 'patrol'; k.think = 2; fooled++; }
  }
  if (searchers) toast(`A cop saw you go into ${sp.name}. He's coming to search it`);
  else { toast(`Hidden in ${sp.name}. The police lost you`); if (fooled) { S.fooled += fooled; S.score += 20 * fooled; S.fx.push({ x: sp.px, y: sp.py, t: 1.3, txt: `FOOLED +${20 * fooled}` }); } }
}
function leaveSpot(forced) {
  const P = S.player, sp = P.spot; P.state = 'free'; sp.cool = 25; sp.lastExit = S.t;
  if (sp.big) {
    // back door: come out at the far end of the block, away from the nearest cop
    const e = edges[sp.e]; let threat = null, td = Infinity;
    for (const k of S.cops) { const q = entPos(k), d = Math.hypot(q[0] - sp.px, q[1] - sp.py); if (d < td) { td = d; threat = q; } }
    const A = nodes[e.a], B = nodes[e.b];
    const useB = !threat || Math.hypot(B.x - threat[0], B.y - threat[1]) > Math.hypot(A.x - threat[0], A.y - threat[1]);
    P.e = sp.e; P.d = useB ? Math.max(0, e.len - 2) : Math.min(e.len, 2); P.dir = useB ? 1 : -1;
    toast(forced ? 'The manager shows you the back door' : 'You slip out the back door');
  } else toast(forced ? 'The shopkeeper nervously waves you out' : `You step out of ${sp.name}`);
  P.spot = null;
}

// ---------- Wanted stars ----------
function addStar(why) {
  if (S.wanted >= 5) return;
  S.wanted++; S.unseenT = 0;
  const p = entPos(S.player); S.fx.push({ x: p[0], y: p[1], t: 1.2, txt: 'WANTED +1' });
  toast(`${'★'.repeat(S.wanted)} Wanted: ${why}`); tone(220, 0.25, 'sawtooth', 0.06, 0.6);
}
function updateWanted(dt) {
  const P = S.player, onYou = S.cops.some(k => (k.state === 'chase' && k.target === P) || k.state === 'search');
  if (onYou) { S.unseenT = 0; S.chaseT += dt; if (S.chaseT >= 20) { S.chaseT = 0; addStar('evading arrest'); } }
  else { S.chaseT = 0; if (S.wanted > 0) { S.unseenT += dt; if (S.unseenT >= 25) { S.unseenT = 0; S.wanted--; toast(S.wanted ? `The police are losing interest. ${'★'.repeat(S.wanted)}` : 'The police lost your trail. No stars'); } } }
}

// ---------- Energy drinks + crowd cover ----------
const COVER_TIME = 600, BLEND_R = 55, BLEND_MIN = 2;
function crowdNear(r) { const p = entPos(S.player); let n = 0; for (const c of S.crowd) { if (c.state !== 'free') continue; const q = entPos(c); if (Math.abs(q[0] - p[0]) < r && Math.abs(q[1] - p[1]) < r && Math.hypot(q[0] - p[0], q[1] - p[1]) < r) n++; } return n; }
function updateBlend(dt) {
  const P = S.player;
  if (P.cover > 0) { P.cover = Math.max(0, P.cover - dt); if (!P.cover) toast('Your crowd cover has worn off'); }
  const was = P.blend;
  P.blend = P.state === 'free' && !P.sprinting && crowdNear(BLEND_R) >= (P.cover > 0 ? BLEND_MIN : BLEND_MIN + 1);
  if (P.blend && !was) {
    let fooled = 0; for (const k of S.cops) if (k.target === P) { k.target = null; k.state = 'patrol'; k.think = 2; fooled++; }
    if (fooled) { S.fooled += fooled; S.score += 20 * fooled; const p = entPos(P); S.fx.push({ x: p[0], y: p[1], t: 1.3, txt: `FOOLED +${20 * fooled}` }); }
    toast('You blended into the crowd. Walk with them to cool your stars');
  }
  if (P.blend) {
    S.unseenT = 0; S.blendT += dt;
    if (S.blendT >= 6 && S.wanted > 0) { S.blendT = 0; S.wanted--; toast(S.wanted ? `The crowd is covering you. ${'★'.repeat(S.wanted)}` : 'The crowd covered you. No stars'); }
  } else S.blendT = 0;
}

// ---------- Minister cars ----------
const MIN_RANGE = 34;
function spawnMinister() {
  const pp = entPos(S.player);
  for (let tries = 0; tries < 60; tries++) {
    const e = pick(edges); if (e.blocked || e.len < 40) continue;
    const q = edgePos(e, e.len / 2), d = Math.hypot(q[0] - pp[0], q[1] - pp[1]);
    if (d < 450 || d > 1400 || jantarFieldAll[e.a] < 700) continue;
    const m = { kind: 'car', e: e.i, d: e.len / 2, dir: Math.random() < 0.5 ? 1 : -1, spd: rand(34, 42), state: 'drive', t: 0, blink: 0 };
    S.ministers.push(m); toast('A minister\'s car with a BJP flag is out on the streets. Catch it'); return m;
  }
  return null;
}
function updateMinisters(dt) {
  S.minT -= dt;
  if (S.minT <= 0) { S.minT = 30; if (S.ministers.filter(m => m.state === 'drive').length < 2) spawnMinister(); }
  const pp = entPos(S.player);
  for (const m of S.ministers) {
    m.blink += dt;
    if (m.state === 'beaten' || m.state === 'stuck') { m.t += dt; continue; }
    if (m.state === 'blocked') {
      const q = entPos(m), near = S.player.state === 'free' && Math.hypot(q[0] - pp[0], q[1] - pp[1]) < BLOCK_RANGE;
      if (!near) { m.state = 'drive'; toast('You left the road. The minister\'s car drove off'); continue; }
      m.blockT += dt;
      if (m.blockT >= BLOCK_TIME) gheraoDone(m);
      continue;
    }
    moveEnt(m, m.spd * dt, (ent, node) => {
      const all = nodes[node].adj.filter(a => !edges[a.e].blocked), opts = all.filter(a => a.e !== ent.e);
      return pick(opts.length ? opts : all.length ? all : nodes[node].adj);
    });
    const q = entPos(m); if (Math.hypot(q[0] - pp[0], q[1] - pp[1]) > 3800) m.t = 99;
  }
  S.ministers = S.ministers.filter(m => (m.state === 'drive' || m.state === 'blocked') ? m.t < 99 : m.t < 3.2);
}
function nearMinister() {
  if (!S || S.player.state !== 'free') return null;
  const p = entPos(S.player);
  return S.ministers.find(m => { if (m.state !== 'drive' && m.state !== 'blocked') return false; const q = entPos(m); return Math.hypot(q[0] - p[0], q[1] - p[1]) < MIN_RANGE; }) || null;
}
function beatMinister() {
  if (!S || !S.running || S.over) return false;
  const m = nearMinister(); if (!m) return false;
  const P = S.player, q = entPos(m);
  m.state = 'beaten'; m.t = 0; S.beaten++;
  const cleared = S.wanted; S.wanted = 0; S.chaseT = 0; S.unseenT = 0;
  P.boost = 12; P.stam = S.C.stam;
  let fooled = 0;
  for (const k of S.cops) if (k.target === P || (k.state === 'search' && k.spot === P.spot)) { k.target = null; k.state = 'patrol'; k.think = 3; fooled++; }
  S.fooled += fooled; S.score += 100 + 20 * fooled; S.shake = 0.3;
  S.fx.push({ x: q[0], y: q[1], t: 1.4, txt: 'THWACK' }, { x: q[0] + 20, y: q[1] - 20, t: 1.1, txt: 'BOOST +100' });
  toast(`You beat the minister. ${cleared ? 'Your stars are gone. ' : ''}Boost: smash barricades and knock cops aside`);
  tone(120, 0.18, 'square', 0.14, 0.4); tone(660, 0.4, 'triangle', 0.12, 1.6, 0.12);
  return true;
}
const BLOCK_RANGE = 60, BLOCK_TIME = 6;
function blockMinister() {
  if (!S || !S.running || S.over) return false;
  const m = nearMinister(); if (!m || m.state !== 'drive') return false;
  m.state = 'blocked'; m.blockT = 0;
  const q = entPos(m); S.fx.push({ x: q[0], y: q[1], t: 1.2, txt: 'DHARNA!' });
  toast(`You sat down in front of the minister's car. Hold the road for ${BLOCK_TIME} s`, 3);
  tone(220, 0.25, 'triangle', 0.1, 1.2);
  return true;
}
function gheraoDone(m) {
  const P = S.player, q = entPos(m);
  m.state = 'stuck'; m.t = 0; S.gheraos++;
  S.score += 150; P.cover = Math.max(P.cover, 90); P.stam = S.C.stam;
  S.fx.push({ x: q[0], y: q[1], t: 1.5, txt: 'CAR BLOCKED +150' });
  addStar('blocked a minister\'s convoy');
  toast('The convoy is stuck and the street is cheering. The crowd will cover you for 90 s', 3.5);
  tone(392, 0.15, 'triangle', 0.1, 1.2); tone(523, 0.3, 'triangle', 0.1, 1.3, 0.15);
}
function smashBarricade(e) {
  setBar(e, false); jantarFieldOpen = field(JN, true); S.smashed++; S.score += 40;
  const p = edgePos(e, e.len / 2); S.fx.push({ x: p[0], y: p[1], t: 1.3, txt: 'SMASHED +40' });
  toast(`You smashed the barricade${e.name ? ' on ' + e.name : ''}`); S.shake = 0.25; tone(90, 0.3, 'sawtooth', 0.12, 0.5);
}

// ---------- Update ----------
const CATCH = 14, RESCUE = 20;
function update(dt) {
  if (!S || !S.running) return;
  if (!S.over) S.t += dt;
  S.level = 1 + Math.floor(S.t / 25);
  S.fieldT -= dt; if (S.fieldT <= 0) { S.fields.clear(); S.fieldT = 0.35; }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  if (S.toastCD > 0) S.toastCD -= dt;
  beat(dt);
  if (S.shake > 0) S.shake -= dt;
  spots.forEach(sp => { if (sp.cool > 0) sp.cool -= dt; });

  S.nextCop -= dt;
  if (S.nextCop <= 0 && S.cops.length < 34 + 3 * S.wanted) { const st = S.wanted >= 3 ? nearestStation(...entPos(S.player)) : pick(stations); spawnCop(st); S.nextCop = Math.max(6, 15 - S.level) / (1 + 0.35 * S.wanted); if (S.level > 1 && Math.random() < 0.4) toast(`Reinforcements leave ${st.name}`); }
  S.barT -= dt;
  if (S.barT <= 0) { shiftBarricade(); S.barT = 20; }
  const P = S.player, pp = entPos(P);
  const toGoal = Math.hypot(pp[0] - jantar.x, pp[1] - jantar.y);
  if (!S.over && S.startDist > 0 && S.chapter < STORY.length - 1) {
    const prog = 1 - toGoal / S.startDist, next = S.chapter + 1;
    if (prog >= next * 0.25 && P.state === 'free') { S.chapter = next; toast(STORY[next], 6); }
  }
  if (!S.closedIn && toGoal < 1100 && !S.over) {
    S.closedIn = true; let n = 0;
    for (const e of RING1) { if (n >= 3) break; if (tryBarricade(e, n === 0)) n++; }
    toast('Police are sealing the roads around Jantar Mantar. Find a gap');
  }

  if (!S.over) { updatePlayer(P, dt); spots.forEach(sp => { if (!sp.found && Math.hypot(sp.px - pp[0], sp.py - pp[1]) < 380) sp.found = true; }); }
  S.crowd.forEach(c => c.state === 'free' && updateCrowd(c, dt));
  S.cops.forEach(k => updateCop(k, dt));
  if (!S.over) { rescueCheck(); updateBlend(dt); updateWanted(dt); updateMinisters(dt); }

  stations.forEach(st => {
    for (let k = st.held.length - 1; k >= 0; k--) {
      const h = st.held[k]; h.heldT -= dt;
      if (h.heldT <= 0 && !(h.you && S.over)) {
        st.held.splice(k, 1); h.state = 'free'; placeOnNode(h, st.node, true); S.fx.push({ x: st.x, y: st.y, t: 1.2, txt: 'RELEASED' });
        if (h.you) { h.grace = 5; S.wanted = 0; S.chaseT = 0; S.unseenT = 0; toast(`Released from ${st.name}. ${MAX_DETAIN - S.detentions} detention${MAX_DETAIN - S.detentions === 1 ? '' : 's'} left before the day is lost. Keep marching`, 4); }
      }
    }
  });

  if (!S.over) {
    for (let k = S.items.length - 1; k >= 0; k--) {
      const it = S.items[k];
      if (P.state === 'free' && Math.hypot(it.x - pp[0], it.y - pp[1]) < 18) {
        S.items.splice(k, 1); S.score += 10; S.pamphlets++; P.stam = Math.min(S.C.stam, P.stam + 35);
        S.fx.push({ x: it.x, y: it.y, t: 0.9, txt: '+10' }); tone(880, 0.12, 'triangle', 0.12, 1.5); spawnItem();
        if (S.pamphlets % 5 === 0) addStar('spreading pamphlets');
      }
    }
    for (let k = S.drinks.length - 1; k >= 0; k--) {
      const d = S.drinks[k];
      if (P.state === 'free' && Math.hypot(d.x - pp[0], d.y - pp[1]) < 18) {
        S.drinks.splice(k, 1); P.cover = COVER_TIME; P.stam = S.C.stam; S.score += 15;
        S.fx.push({ x: d.x, y: d.y, t: 1.3, txt: 'ENERGY +15' }); tone(600, 0.1, 'triangle', 0.12, 1.8); tone(900, 0.2, 'triangle', 0.1, 1.4, 0.1);
        toast('Energy drink. For 10 minutes you can hide in any crowd of protesters'); spawnDrink();
      }
    }
    S.drinks.forEach(d => d.ph += dt * 3);
    S.score += dt;
    // victory
    if (P.state === 'free') {
      const jn = nodes[JN];
      if (Math.hypot(pp[0] - jn.x, pp[1] - jn.y) < 45 || Math.hypot(pp[0] - jantar.x, pp[1] - jantar.y) < 60) win();
    }
  }
  S.fx.forEach(f => f.t -= dt); S.fx = S.fx.filter(f => f.t > 0);
  S.items.forEach(it => it.ph += dt * 4);
  if (S.over && P.state === 'held' && !S.shownOver) { S.shownOver = true; setTimeout(showOver, 700); }
}

const STORY = [
  'Chapter 1 · Morning. The call went out overnight: march from {start} to Jantar Mantar and raise the Tiranga before sundown',
  'Chapter 2 · The streets fill up. Shopkeepers leave their shutters half open for marchers on the run',
  'Chapter 3 · Section 144 is in force. Ministers\' convoys are on the move. Block their cars or confront them',
  'Chapter 4 · You can hear the chants from Jantar Mantar. One last push',
];
function bestAdj(node, v, minDot) {
  let best = null, bd = minDot, blockedBest = null, bb = minDot;
  for (const ad of nodes[node].adj) {
    const d = ad.h[0] * v[0] + ad.h[1] * v[1];
    if (edges[ad.e].blocked && !(S.player.boost > 0)) { if (d > bb) { bb = d; blockedBest = ad; } continue; }
    if (d > bd) { bd = d; best = ad; }
  }
  if (blockedBest && bb > 0.75 && (!best || bb > bd + 0.2) && S.toastCD <= 0) {
    const e = edges[blockedBest.e]; toast(`Barricade${e.name ? ' on ' + e.name : ''}. Find another way`); S.toastCD = 2.5; tone(140, 0.2, 'square', 0.05);
  }
  return best;
}
function updatePlayer(P, dt) {
  if (P.state === 'hidden') {
    P.hideT += dt; P.stam = Math.min(S.C.stam, P.stam + 40 * dt);
    if (P.hideT >= S.C.hide) leaveSpot(true);
    return;
  }
  if (P.state !== 'free') return;
  if (P.grace > 0) P.grace = Math.max(0, P.grace - dt);
  if (P.boost > 0) { P.boost = Math.max(0, P.boost - dt); P.stam = S.C.stam; if (!P.boost) toast('Boost is over'); }
  const iv = inputVec();
  const sprint = (keys.ShiftLeft || keys.ShiftRight || keys.Space || sprintHeld) && P.stam > 1 && iv;
  P.stam = sprint ? Math.max(0, P.stam - S.C.drain * dt) : Math.min(S.C.stam, P.stam + 16 * dt);
  P.sprinting = !!sprint;
  if (!iv) { P.moving = false; return; }
  const spd = (sprint ? S.C.sprint : (P.blend ? 50 : S.C.run)) * (P.boost > 0 ? 1.4 : 1);
  const nodeNow = atNodeOf(P);
  if (nodeNow >= 0) {
    const nx = bestAdj(nodeNow, iv, 0.3);
    if (!nx) { P.moving = false; return; }
    P.e = nx.e; P.dir = nx.dir; P.d = nx.dir > 0 ? 0 : edges[nx.e].len;
  } else {
    const tg = edgeTan(edges[P.e], P.d, P.dir);
    if (tg[0] * iv[0] + tg[1] * iv[1] < -0.35) P.dir *= -1;
  }
  P.moving = true;
  moveEnt(P, spd * dt, (ent, node) => bestAdj(node, iv, 0.3));
  if (P.boost > 0 && edges[P.e].blocked) smashBarricade(edges[P.e]);
}

function updateCrowd(c, dt) {
  c.think -= dt;
  const p = entPos(c);
  let th = null, td = 190;
  for (const k of S.cops) {
    if (k.state === 'escort' || k.stun > 0) continue;
    const q = entPos(k); if (Math.abs(q[0] - p[0]) > td || Math.abs(q[1] - p[1]) > td) continue;
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < td) { td = d; th = q; }
  }
  c.fleeing = !!th;
  const P = S.player;
  if (!th && P.cover > 0 && P.state === 'free') {
    const pp = entPos(P), dp = Math.hypot(pp[0] - p[0], pp[1] - p[1]);
    if (dp < 240) { if (dp > 14) steerToward(c, P, dt, c.spd * 1.1); return; }
  }
  if (th && c.think <= 0) { c.think = 0.4; const tg = edgeTan(edges[c.e], c.d, c.dir); if (tg[0] * (th[0] - p[0]) + tg[1] * (th[1] - p[1]) > 0.4 * td) c.dir *= -1; }
  moveEnt(c, (th ? c.spd * 1.15 : c.spd * 0.8) * dt, (ent, node) => {
    const all = nodes[node].adj.filter(a => !edges[a.e].blocked);
    if (!all.length) return null;
    if (th) {
      let best = null, bs = -Infinity;
      for (const ad of all) { const n = nodes[ad.to]; const s = Math.hypot(n.x - th[0], n.y - th[1]) + (ad.e === ent.e ? -60 : 0) + Math.random() * 30; if (s > bs) { bs = s; best = ad; } }
      return best;
    }
    const opts = all.filter(a => a.e !== ent.e), list = opts.length ? opts : all;
    if (Math.random() < 0.7) { const f = jantarFieldOpen; return list.reduce((a, b) => (f[a.to] + edges[a.e].len < f[b.to] + edges[b.e].len ? a : b)); }
    return pick(list);
  });
  const jn = nodes[JN];
  if (Math.hypot(p[0] - jn.x, p[1] - jn.y) < 40) {
    c.state = 'rally'; S.rally++; S.fx.push({ x: jn.x, y: jn.y, t: 1.2, txt: 'JOINED THE RALLY' });
  }
}
const protesters = () => [S.player, ...S.crowd].filter(x => x.state === 'free');
function steerToward(k, tgt, dt, spd) {
  const te = edges[tgt.e], e = edges[k.e];
  if (k.e === tgt.e) { k.dir = tgt.d > k.d ? 1 : -1; moveEnt(k, Math.min(spd * dt, Math.abs(tgt.d - k.d)), () => null); return; }
  const fa = getField(te.a), fb = getField(te.b);
  const cost = n => Math.min(fa[n] + tgt.d, fb[n] + (te.len - tgt.d));
  k.dir = (k.d + cost(e.a)) < ((e.len - k.d) + cost(e.b)) ? -1 : 1;
  moveEnt(k, spd * dt, (ent, node) => {
    if (node === te.a || node === te.b) { const ad = nodes[node].adj.find(a => a.e === tgt.e); if (ad) return ad; }
    let best = null, bc = Infinity;
    for (const ad of nodes[node].adj) { const c = edges[ad.e].len + cost(ad.to); if (c < bc) { bc = c; best = ad; } }
    return best;
  });
}
function updateCop(k, dt) {
  k.siren += dt;
  if (k.stun > 0) { k.stun -= dt; return; }
  const spdBase = (k.spd + Math.min(S.level, 10) * 1.8) * (1 + 0.06 * S.wanted);
  if (k.state === 'escort') {
    const st = k.station, f = st.field, e = edges[k.e];
    k.dir = (k.d + f[e.a]) < ((e.len - k.d) + f[e.b]) ? -1 : 1;
    moveEnt(k, (k.carry.you ? 320 : 42) * dt, (ent, node) => {
      if (node === st.node) return null;
      let best = null, bc = Infinity; for (const ad of nodes[node].adj) { const c = edges[ad.e].len + f[ad.to]; if (c < bc) { bc = c; best = ad; } } return best;
    });
    if (atNodeOf(k) === st.node) {
      const c = k.carry; c.state = 'held'; c.heldT = HOLD_TIME; st.held.push(c);
      S.fx.push({ x: st.x, y: st.y, t: 1.4, txt: 'DETAINED' });
      if (c.you) { S.detainedAt = st.name; if (!S.over) toast(`Detained at ${st.name}. Released in ${HOLD_TIME} s`, 3); }
      k.carry = null; k.state = 'patrol'; k.stun = 1.5;
    }
    return;
  }
  if (k.state === 'search') {
    const sp = k.spot;
    if (k.e === sp.e && Math.abs(k.d - sp.d) < 3) {
      k.searchT -= dt;
      if (k.searchT <= 0) {
        const P = S.player;
        if (P.state === 'hidden' && P.spot === sp) { P.state = 'free'; P.spot = null; toast(`Found you hiding in ${sp.name}`); detain(k, P); }
        else {
          if (S.t - sp.lastExit < 12) { S.fooled++; S.score += 30; S.fx.push({ x: sp.px, y: sp.py, t: 1.3, txt: 'FOOLED +30' }); toast(`The cop searched ${sp.name} and found nobody`); }
          k.state = 'patrol'; k.think = 1.5;
        }
      }
    } else steerToward(k, sp, dt, spdBase);
    return;
  }
  const kp = entPos(k);
  k.think -= dt;
  if (k.think <= 0) {
    k.think = 0.5; let best = null, bd = 430 + 60 * S.wanted;
    for (const p of protesters()) {
      if (p.you && (p.boost > 0 || p.blend || p.grace > 0)) continue;
      const q = entPos(p); if (Math.abs(q[0] - kp[0]) > bd || Math.abs(q[1] - kp[1]) > bd) continue;
      let d = Math.hypot(q[0] - kp[0], q[1] - kp[1]); if (p.you) d *= 0.75;
      if (d < bd) { bd = d; best = p; }
    }
    if (best && best.you && k.target !== best && S.wanted === 0) addStar('spotted by police');
    k.target = best; k.state = best ? 'chase' : 'patrol';
  }
  if (k.target && k.target.state !== 'free') { k.target = null; k.state = 'patrol'; }
  if (k.state === 'chase' && k.target) steerToward(k, k.target, dt, spdBase);
  else {
    moveEnt(k, spdBase * 0.7 * dt, (ent, node) => {
      const opts = nodes[node].adj.filter(a => a.e !== ent.e), list = opts.length ? opts : nodes[node].adj;
      if (k.guard && jantarFieldAll[node] > 700) return list.reduce((a, b) => (jantarFieldAll[a.to] < jantarFieldAll[b.to] ? a : b));
      if (!k.guard && Math.random() < 0.3 && S.player.state === 'free') { const f = getField(edges[S.player.e].a); return list.reduce((a, b) => (f[a.to] < f[b.to] ? a : b)); }
      return pick(list);
    });
  }
  const kp2 = entPos(k);
  for (const p of protesters()) {
    const q = entPos(p);
    if (Math.abs(q[0] - kp2[0]) < CATCH && Math.abs(q[1] - kp2[1]) < CATCH && Math.hypot(q[0] - kp2[0], q[1] - kp2[1]) < CATCH) {
      if (p.you && (p.blend || p.grace > 0)) continue;
      if (p.you && p.boost > 0) { k.stun = 3; k.state = 'patrol'; k.target = null; S.knocked++; S.score += 15; S.fx.push({ x: kp2[0], y: kp2[1], t: 1.1, txt: 'KNOCKED +15' }); tone(160, 0.12, 'square', 0.1, 0.5); continue; }
      detain(k, p); break;
    }
  }
}
function nearestStation(x, y) { return stations.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b)); }
const HOLD_TIME = 30, MAX_DETAIN = 3;
function detain(k, p) {
  const q = entPos(p), st = nearestStation(q[0], q[1]);
  p.state = 'carried'; p.by = k; k.state = 'escort'; k.carry = p; k.station = st; k.target = null;
  whistle(); S.shake = 0.25; S.fx.push({ x: q[0], y: q[1], t: 1.1, txt: 'CAUGHT' });
  if (p.you) {
    S.detentions++; p.boost = 0; p.blend = false; p.sprinting = false;
    if (S.detentions >= MAX_DETAIN) { S.over = true; S.goalLeft = Math.hypot(q[0] - jantar.x, q[1] - jantar.y); toast(`Caught for the ${MAX_DETAIN}rd time. You're being taken to ${st.name}`); }
    else toast(`Caught (${S.detentions}/${MAX_DETAIN}). You're being taken to ${st.name}`);
  }
  else if (Math.hypot(q[0] - entPos(S.player)[0], q[1] - entPos(S.player)[1]) < 700) toast(`A protester is being taken to ${st.name}. Touch them to free them`);
}
function rescueCheck() {
  if (S.player.state !== 'free') return;
  const pp = entPos(S.player);
  for (const k of S.cops) {
    if (k.state !== 'escort' || !k.carry || k.carry.you) continue;
    const q = entPos(k);
    if (Math.hypot(q[0] - pp[0], q[1] - pp[1]) < RESCUE) {
      const c = k.carry; c.state = 'free'; c.e = k.e; c.d = k.d; c.dir = -k.dir;
      k.carry = null; k.state = 'patrol'; k.stun = 2.6;
      S.score += 25; S.rescues++; S.fx.push({ x: q[0], y: q[1], t: 1.2, txt: 'FREED +25' }); addStar('freed a detainee');
      tone(520, 0.1, 'square', 0.08, 2); tone(780, 0.2, 'triangle', 0.1, 1.3);
    }
  }
}
function showOver() {
  S.running = false;
  $('overTitle').textContent = `Detained at ${S.detainedAt || 'police station'}`;
  $('overText').textContent = `${ALIAS}: you marched from ${S.startName} for ${fmt(S.t)} and got within ${km(S.goalLeft || 0)} of Jantar Mantar before your ${MAX_DETAIN}rd detention ended the day. ${S.rally} protesters reached the rally. Try hiding in shops, and use the back doors of big stores.`;
  $('oTime').textContent = fmt(S.t); $('oScore').textContent = Math.floor(S.score); $('oRescue').textContent = S.rescues; $('oDist').textContent = km(S.goalLeft || 0);
  $('overScreen').classList.remove('hidden'); setTimeout(() => $('againBtn').focus(), 50);
}
function win() {
  S.won = true; S.running = false; S.score += 500;
  $('wTime').textContent = fmt(S.t); $('wScore').textContent = Math.floor(S.score); $('wRally').textContent = S.rally + 1; $('wFooled').textContent = S.fooled;
  $('victoryLine').textContent = VICTORY_LINE;
  $('hideBar').classList.remove('show'); $('hideBtn').classList.remove('on');
  startFlag();
}

// ---------- Flag ceremony ----------
const flag = { active: false, hold: false, p: 0, unfurl: 0, t: 0, petals: [], done: false };
const fcv = $('flagCv'), fctx = fcv.getContext('2d');
const flagTex = document.createElement('canvas');
(function makeFlag() {
  const w = 300, h = 200; flagTex.width = w; flagTex.height = h; const g = flagTex.getContext('2d');
  g.fillStyle = '#FF9933'; g.fillRect(0, 0, w, h / 3); g.fillStyle = '#FFFFFF'; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = '#138808'; g.fillRect(0, 2 * h / 3, w, h / 3);
  const cx = w / 2, cy = h / 2, r = (h / 3) * 0.75 / 2;
  g.strokeStyle = '#000080'; g.fillStyle = '#000080'; g.lineWidth = 2.4; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  g.beginPath(); g.arc(cx, cy, r * 0.18, 0, 7); g.fill(); g.lineWidth = 1.1;
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); g.beginPath(); g.arc(cx + Math.cos(a + Math.PI / 24) * r * 0.92, cy + Math.sin(a + Math.PI / 24) * r * 0.92, 1.2, 0, 7); g.fill(); }
})();
const raiseBtn = $('raiseBtn');
raiseBtn.addEventListener('pointerdown', e => { e.preventDefault(); flag.hold = true; audioInit(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => raiseBtn.addEventListener(ev, () => flag.hold = false));
function startFlag() {
  Object.assign(flag, { active: true, hold: false, p: 0, unfurl: 0, t: 0, petals: [], done: false });
  $('winScreen').classList.remove('hidden'); $('winCard').classList.remove('show'); $('raiseWrap').style.display = 'flex';
  raiseBtn.textContent = 'Hold to raise the Tiranga';
  sizeFlag(); fanfare();
}
function sizeFlag() { fcv.width = innerWidth * DPR; fcv.height = innerHeight * DPR; }
function drawFlagScene(dt) {
  const w = innerWidth, h = innerHeight, g = fctx; flag.t += dt;
  if (flag.hold && flag.p < 1) { flag.p = Math.min(1, flag.p + dt / 2.6); if (Math.random() < 0.3) tone(200 + flag.p * 500, 0.06, 'triangle', 0.04); }
  if (flag.p >= 1) {
    flag.unfurl = Math.min(1, flag.unfurl + dt * 1.6);
    if (!flag.done) { flag.done = true; fanfare(); $('raiseWrap').style.display = 'none'; setTimeout(() => $('winCard').classList.add('show'), 900); }
    if (flag.petals.length < 160) for (let i = 0; i < 3; i++) flag.petals.push({ x: Math.random() * w, y: -10, vy: rand(40, 90), vx: rand(-20, 20), r: rand(3, 6), c: pick(['#ff9f1c', '#ffb627', '#f26b1d', '#fff3c4']), a: Math.random() * 6 });
    beat(dt, true);
  }
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#1f2f57'); sky.addColorStop(0.55, '#d6457a'); sky.addColorStop(1, '#ffb627');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  // sun
  g.fillStyle = 'rgba(255,240,200,.85)'; g.beginPath(); g.arc(w * 0.72, h * 0.62, Math.min(w, h) * 0.14, 0, 7); g.fill();
  // Jantar Mantar silhouette: Samrat Yantra gnomon with stair + quadrant arcs
  const base = h * 0.8, sc = Math.min(w, h) / 700;
  g.fillStyle = '#9c3b27';
  const gx = w * 0.62; g.beginPath(); g.moveTo(gx - 170 * sc, base); g.lineTo(gx + 60 * sc, base - 300 * sc); g.lineTo(gx + 90 * sc, base - 300 * sc); g.lineTo(gx + 90 * sc, base); g.closePath(); g.fill();
  g.fillStyle = '#7d2e1f'; for (let i = 0; i < 14; i++) g.fillRect(gx - 150 * sc + i * 15 * sc, base - (i + 1) * 20 * sc, 4 * sc, 3 * sc);
  g.fillStyle = '#b5482f';
  g.beginPath(); g.arc(gx + 210 * sc, base, 120 * sc, Math.PI, 0); g.lineTo(gx + 290 * sc, base); g.arc(gx + 210 * sc, base, 80 * sc, 0, Math.PI, true); g.closePath(); g.fill();
  g.beginPath(); g.arc(gx - 260 * sc, base, 90 * sc, Math.PI, 0); g.arc(gx - 260 * sc, base, 60 * sc, 0, Math.PI, true); g.closePath(); g.fill();
  // ground
  g.fillStyle = '#3a2418'; g.fillRect(0, base, w, h - base);
  // pole
  const px = w * 0.3, top = h * 0.16, poleH = base - top;
  g.fillStyle = '#d9d2c3'; g.fillRect(px - 3, top, 6, poleH); g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(px, top - 4, 7, 0, 7); g.fill();
  g.fillStyle = '#5a3a22'; g.fillRect(px - 26, base - 16, 52, 16);
  const fw = Math.min(w * 0.36, 270), fh = fw * 2 / 3;
  const fy = top + 6 + (1 - flag.p) * (poleH - fh - 30);
  if (flag.unfurl <= 0) {
    g.fillStyle = '#FF9933'; g.fillRect(px + 3, fy, 12, fh * 0.35); g.fillStyle = '#fff'; g.fillRect(px + 3, fy + fh * 0.35, 12, fh * 0.3); g.fillStyle = '#138808'; g.fillRect(px + 3, fy + fh * 0.65, 12, fh * 0.35);
  } else {
    const uw = fw * (0.15 + 0.85 * flag.unfurl), sl = 3;
    for (let i = 0; i < uw; i += sl) {
      const f = i / uw, off = Math.sin(flag.t * 5 - f * 7) * 7 * f;
      g.drawImage(flagTex, f * flagTex.width, 0, flagTex.width * sl / uw + 1, flagTex.height, px + 3 + i, fy + off, sl + 0.6, fh);
    }
    // shading
    g.globalAlpha = 0.12; for (let i = 0; i < uw; i += sl) { const f = i / uw, sh = Math.cos(flag.t * 5 - f * 7); if (sh > 0) { g.fillStyle = '#000'; g.fillRect(px + 3 + i, fy + Math.sin(flag.t * 5 - f * 7) * 7 * f, sl, fh); } } g.globalAlpha = 1;
  }
  // rope
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4, top); g.lineTo(px + 4, base - 16); g.stroke();
  // crowd
  const n = Math.ceil(w / 22);
  for (let i = 0; i < n; i++) {
    const x = i * 22 + (i % 2) * 8, bob = flag.done ? Math.abs(Math.sin(flag.t * 6 + i)) * 6 : 0, y = h - 10 - (i % 3) * 14 - bob;
    g.fillStyle = '#1d1a16'; g.beginPath(); g.arc(x, y - 34, 8, 0, 7); g.fill(); g.fillRect(x - 9, y - 26, 18, 40);
    if (flag.done || i % 4 === 0) { g.strokeStyle = '#1d1a16'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 7, y - 22); g.lineTo(x + 12, y - 50); g.stroke(); }
    if (i % 5 === 2) { g.fillStyle = '#FF9933'; g.fillRect(x + 12, y - 62, 16, 4); g.fillStyle = '#fff'; g.fillRect(x + 12, y - 58, 16, 4); g.fillStyle = '#138808'; g.fillRect(x + 12, y - 54, 16, 4); }
  }
  // petals
  for (const p of flag.petals) { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(flag.t * 2 + p.a) * 0.5; p.a += dt * 3; g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.6, p.a, 0, 7); g.fill(); }
  flag.petals = flag.petals.filter(p => p.y < h + 10);
  // progress
  if (!flag.done) {
    g.fillStyle = 'rgba(255,250,240,.9)'; g.font = `400 ${Math.max(22, Math.min(34, w / 22))}px Anton, sans-serif`; g.textAlign = 'center';
    g.fillText('YOU MADE IT TO JANTAR MANTAR', w / 2, h * 0.09);
    g.fillStyle = 'rgba(29,26,22,.5)'; g.fillRect(w / 2 - 120, h * 0.09 + 16, 240, 10); g.fillStyle = '#FF9933'; g.fillRect(w / 2 - 120, h * 0.09 + 16, 240 * flag.p, 10);
  }
}

// ---------- Render ----------
let cam = { x: 0, y: 0, z: 0.8 };
function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; buildMini(); if (flag.active) sizeFlag(); }
addEventListener('resize', resize);
let mini = null, MS = 0, MW = 0, MH = 0;
function buildMini() {
  MH = W < 560 ? 170 : 230; MS = MH / (BY1 - BY0); MW = (BX1 - BX0) * MS;
  mini = document.createElement('canvas'); mini.width = MW * DPR; mini.height = MH * DPR;
  const m = mini.getContext('2d'); m.fillStyle = '#efe4cc'; m.fillRect(0, 0, mini.width, mini.height);
  m.setTransform(DPR * MS, 0, 0, DPR * MS, -BX0 * MS * DPR, -BY0 * MS * DPR);
  chunks.forEach(c => { m.fillStyle = '#b9cf9a'; m.fill(c.g); m.fillStyle = '#8fb8c9'; m.fill(c.w); });
  m.globalAlpha = 0.8; metroLines.forEach(l => { m.strokeStyle = l.col; m.lineWidth = 2.5 / MS; m.stroke(l.p); }); m.globalAlpha = 1;
  m.strokeStyle = '#7a6a52'; chunks.forEach(c => { m.lineWidth = 2 / MS; m.stroke(c.p); m.lineWidth = 1.2 / MS; m.stroke(c.s); m.lineWidth = 0.8 / MS; m.stroke(c.t); });
}
const W2S = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
const onScreen = (s, m = 40) => s[0] > -m && s[0] < W + m && s[1] > -m && s[1] < H + m;
function drawMap() {
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (W / 2 - cam.x * cam.z), DPR * (H / 2 - cam.y * cam.z));
  const vx0 = cam.x - W / 2 / cam.z, vx1 = cam.x + W / 2 / cam.z, vy0 = cam.y - H / 2 / cam.z, vy1 = cam.y + H / 2 / cam.z;
  const vis = [];
  for (let cx = Math.floor(vx0 / CH); cx <= Math.floor(vx1 / CH); cx++) for (let cy = Math.floor(vy0 / CH); cy <= Math.floor(vy1 / CH); cy++) { const c = chunks.get(cx + ',' + cy); if (c) vis.push(c); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (mapMode === 'sat') {
    drawSat(vx0, vy0, vx1, vy1);
    ctx.strokeStyle = 'rgba(255,250,240,.28)'; vis.forEach(c => { ctx.lineWidth = 8; ctx.stroke(c.t); ctx.lineWidth = 11; ctx.stroke(c.s); ctx.lineWidth = 14; ctx.stroke(c.p); });
  } else {
    ctx.fillStyle = '#b9cf9a'; vis.forEach(c => ctx.fill(c.g));
    ctx.fillStyle = '#8fb8c9'; vis.forEach(c => ctx.fill(c.w));
    ctx.lineWidth = 1;
    [['b0', '#e2d3b5', '#cdb993'], ['b1', '#dcc49c', '#b89c6e'], ['b2', '#dba184', '#a8664a']].forEach(([k, f, st]) => { ctx.fillStyle = f; ctx.strokeStyle = st; vis.forEach(c => { if (c[k]) { ctx.fill(c[k]); ctx.stroke(c[k]); } }); });
    ctx.strokeStyle = '#8c8577'; ctx.lineWidth = 5; vis.forEach(c => c.rl && ctx.stroke(c.rl));
    ctx.strokeStyle = '#efe4cc'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); vis.forEach(c => c.rl && ctx.stroke(c.rl)); ctx.setLineDash([]);
    ctx.strokeStyle = '#a8946f'; vis.forEach(c => { ctx.lineWidth = 19; ctx.stroke(c.t); ctx.lineWidth = 26; ctx.stroke(c.s); ctx.lineWidth = 34; ctx.stroke(c.p); });
    vis.forEach(c => { ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 14; ctx.stroke(c.t); ctx.lineWidth = 21; ctx.stroke(c.s); ctx.strokeStyle = '#ffe9b8'; ctx.lineWidth = 29; ctx.stroke(c.p); });
  }
  ctx.globalAlpha = 0.75; ctx.lineWidth = 6; ctx.setLineDash([14, 8]);
  for (const m of metroLines) { ctx.strokeStyle = m.col; ctx.stroke(m.p); }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function drawLabels() {
  ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of labels) {
    const d = e.len / 2, p = edgePos(e, d), s = W2S(p[0], p[1]); if (!onScreen(s, 100)) continue;
    const t = edgeTan(e, d, 1); let ang = Math.atan2(t[1], t[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(ang); if (mapMode === 'sat') { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(29,26,22,.8)'; ctx.strokeText(e.name.toUpperCase(), 0, 0); ctx.fillStyle = '#fffaf0'; } else ctx.fillStyle = '#7a6a52'; ctx.fillText(e.name.toUpperCase(), 0, 0); ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function badge(x, y, text, bg, fg, icon, small) {
  ctx.font = `800 ${small ? 11 : 12}px Archivo, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + (icon ? 30 : 14), hh = small ? 20 : 24;
  ctx.fillStyle = '#1d1a16'; rr(x + 2, y - hh / 2 + 3, w, hh, 5); ctx.fill();
  ctx.fillStyle = bg; rr(x - 1, y - hh / 2, w, hh, 5); ctx.fill(); ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = fg; ctx.fillText(text, x + (icon ? 22 : 6), y + 1); icon && icon(x + 11, y); ctx.textBaseline = 'alphabetic';
}
function drawBarricades() {
  for (const e of edges) {
    if (!e.bar) continue; const s = W2S(e.bar.x, e.bar.y); if (!onScreen(s, 60)) continue;
    ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(e.bar.ang);
    const L = 34 * Math.max(0.7, cam.z);
    ctx.fillStyle = '#1d1a16'; ctx.fillRect(-L / 2 + 2, -5 + 2, L, 10);
    ctx.fillStyle = '#ffd400'; ctx.fillRect(-L / 2, -5, L, 10);
    ctx.fillStyle = '#1d1a16'; for (let i = -L / 2; i < L / 2; i += 8) { ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i + 4, -5); ctx.lineTo(i + 8, 5); ctx.lineTo(i + 4, 5); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.strokeRect(-L / 2, -5, L, 10);
    ctx.fillRect(-L / 2 - 1, 5, 3, 6); ctx.fillRect(L / 2 - 2, 5, 3, 6);
    ctx.restore();
    drawChar(ctx, s[0] + 18, s[1] + 12, 'cop', { s: 0.75 });
  }
}
function drawPlaces() {
  const pp = entPos(S.player);
  for (const sp of spots) {
    if (!sp.found) continue;
    const s = W2S(sp.x, sp.y), r = W2S(sp.px, sp.py); if (!onScreen(s, 120)) continue;
    const near = Math.hypot(sp.px - pp[0], sp.py - pp[1]) < 260;
    ctx.strokeStyle = 'rgba(29,26,22,.45)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(r[0], r[1]); ctx.stroke(); ctx.setLineDash([]);
    // shopfront
    const col = sp.cool > 0 ? '#9a948a' : (sp.big ? '#2f7d4f' : '#d6457a');
    ctx.fillStyle = '#1d1a16'; ctx.fillRect(s[0] - 11 + 2, s[1] - 10 + 2, 22, 18);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(s[0] - 11, s[1] - 10, 22, 18);
    ctx.fillStyle = col; for (let i = 0; i < 4; i++) ctx.fillRect(s[0] - 11 + i * 5.5, s[1] - 10, 2.75, 6);
    ctx.fillStyle = '#1d1a16'; ctx.fillRect(s[0] - 3, s[1] - 1, 6, 9);
    ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.strokeRect(s[0] - 11, s[1] - 10, 22, 18);
    if (near) badge(s[0] + 14, s[1] - 2, `${sp.name} · ${sp.big ? 'back door' : (KIND_LABEL[sp.kind] || 'Shop')}`, col === '#9a948a' ? '#e6dcc5' : '#fffaf0', '#1d1a16', null, true);
    // door marker on road
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r[0], r[1], 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  for (const ms of metroStations) {
    const s = W2S(ms.x, ms.y); if (!onScreen(s, 80)) continue;
    if (ms.m) { ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#1f2f57'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(s[0], s[1], 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1f2f57'; ctx.font = '800 10px Archivo'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', s[0], s[1] + 0.5); ctx.textBaseline = 'alphabetic'; }
    else { ctx.fillStyle = '#5a5347'; ctx.fillRect(s[0] - 6, s[1] - 6, 12, 12); ctx.fillStyle = '#fffaf0'; ctx.font = '800 8px Archivo'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', s[0], s[1] + 0.5); ctx.textBaseline = 'alphabetic'; }
    ctx.font = '700 10px Archivo'; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = mapMode === 'sat' ? 'rgba(29,26,22,.85)' : '#fffaf0'; ctx.strokeText(ms.name, s[0] + 11, s[1] + 4); ctx.fillStyle = mapMode === 'sat' ? '#fffaf0' : '#1f2f57'; ctx.fillText(ms.name, s[0] + 11, s[1] + 4);
  }
  for (const m of marks) {
    const s = W2S(m.x, m.y); if (!onScreen(s, 200)) continue;
    const goal = m === jantar;
    ctx.fillStyle = '#1d1a16'; ctx.beginPath(); ctx.arc(s[0], s[1], goal ? 7 : 5, 0, 7); ctx.fill();
    if (goal) { const r = 30 + Math.sin(performance.now() / 250) * 6; ctx.strokeStyle = '#FF9933'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 7); ctx.stroke(); ctx.strokeStyle = '#138808'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], r + 6, 0, 7); ctx.stroke(); }
    badge(s[0] + 8, s[1] - 18, goal ? 'Jantar Mantar · GOAL' : m.name, goal ? '#FF9933' : '#ffb627', '#1d1a16', (x, y) => {
      ctx.fillStyle = '#1d1a16'; ctx.beginPath(); ctx.moveTo(x - 6, y + 5); ctx.lineTo(x + 2, y - 6); ctx.lineTo(x + 6, y - 6); ctx.lineTo(x + 6, y + 5); ctx.closePath(); ctx.fill();
    });
  }
  for (const st of stations) {
    const s = W2S(st.x, st.y); if (!onScreen(s, 220)) continue;
    const n = nodes[st.node], ns = W2S(n.x, n.y);
    ctx.strokeStyle = '#1f2f57'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(ns[0], ns[1]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#1f2f57'; ctx.fillRect(s[0] - 9, s[1] - 9, 18, 18); ctx.strokeStyle = '#1d1a16'; ctx.strokeRect(s[0] - 9, s[1] - 9, 18, 18);
    ctx.fillStyle = '#fffaf0'; ctx.font = '800 10px Archivo'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', s[0], s[1] + 1); ctx.textBaseline = 'alphabetic';
    badge(s[0] + 13, s[1], st.name + (st.held.length ? ` · ${st.held.length} held` : ''), '#1f2f57', '#fffaf0', (x, y) => { ctx.fillStyle = (Math.floor(performance.now() / 400) % 2) ? '#e0473a' : '#4f7de0'; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill(); }, true);
    st.held.slice(0, 8).forEach((h, i) => drawChar(ctx, s[0] - 14 - (i % 4) * 11, s[1] + 26 + Math.floor(i / 4) * 12, h.kind, { s: 0.6, gray: true }));
  }
}
function charScale() { return Math.max(0.75, Math.min(1, cam.z * 1.25)); }
function drawEntities() {
  const cs = charScale();
  for (const it of S.items) {
    const s = W2S(it.x, it.y); if (!onScreen(s, 20)) continue;
    ctx.save(); ctx.translate(s[0], s[1] + Math.sin(it.ph) * 2); ctx.rotate(Math.sin(it.ph * 0.5) * 0.25);
    ctx.fillStyle = '#1d1a16'; ctx.fillRect(-6, -7, 14, 16); ctx.fillStyle = '#f08a1c'; ctx.fillRect(-8, -9, 14, 16);
    ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.strokeRect(-8, -9, 14, 16);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(-5, -5, 8, 2); ctx.fillRect(-5, -1, 8, 2); ctx.fillRect(-5, 3, 5, 2); ctx.restore();
  }
  for (const d of S.drinks) {
    const s = W2S(d.x, d.y); if (!onScreen(s, 20)) continue;
    ctx.save(); ctx.translate(s[0], s[1] + Math.sin(d.ph) * 2);
    ctx.fillStyle = 'rgba(26,156,156,.25)'; ctx.beginPath(); ctx.arc(0, 0, 14 + Math.sin(d.ph * 2) * 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#1d1a16'; rr(-4, -8, 11, 18, 3); ctx.fill();
    ctx.fillStyle = '#1a9c9c'; rr(-6, -10, 11, 18, 3); ctx.fill(); ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c9d1d1'; ctx.fillRect(-5, -10, 9, 2.5);
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(-3, 0); ctx.lineTo(0, 0); ctx.lineTo(-2, 5); ctx.lineTo(3, -2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // depth-sort everyone by y
  const list = [];
  for (const c of S.crowd) if (c.state === 'free') { const p = entPos(c); const s = W2S(p[0], p[1]); if (onScreen(s, 50)) list.push([s, 'c', c]); }
  for (const k of S.cops) { const p = entPos(k); const s = W2S(p[0], p[1]); if (onScreen(s, 60)) list.push([s, 'k', k]); }
  for (const m of S.ministers) { const p = entPos(m); const s = W2S(p[0], p[1]); if (onScreen(s, 60)) list.push([s, 'm', m]); }
  if (S.player.state === 'free') { const p = entPos(S.player); list.push([W2S(p[0], p[1]), 'p', S.player]); }
  list.sort((a, b) => a[0][1] - b[0][1]);
  for (const [s, t, o] of list) {
    if (t === 'c') {
      drawChar(ctx, s[0], s[1], o.kind, { s: cs * 0.85, moving: true, phase: o.walk, top: o.top, placard: true, placardCol: o.placardCol });
      if (o.fleeing) { ctx.fillStyle = '#c8321e'; ctx.font = '800 13px Archivo'; ctx.textAlign = 'center'; ctx.fillText('!', s[0] - 12, s[1] - 30 * cs); }
    } else if (t === 'm') { drawMinister(s, o, cs);
    } else if (t === 'k') {
      if (o.state === 'chase' && !o.stun) { ctx.fillStyle = (Math.floor(o.siren * 6) % 2) ? 'rgba(224,71,58,.3)' : 'rgba(79,125,224,.3)'; ctx.beginPath(); ctx.ellipse(s[0], s[1] - 2, 20, 9, 0, 0, 7); ctx.fill(); }
      if (o.carry) { const tg = edgeTan(edges[o.e], o.d, o.dir); const cx = s[0] - tg[0] * 16, cy = s[1] - tg[1] * 16; drawChar(ctx, cx, cy, o.carry.kind, { s: cs * 0.85, moving: true, phase: o.walk, gray: !o.carry.you }); if (o.carry.you) ring(cx, cy); }
      drawChar(ctx, s[0], s[1], 'cop', { s: cs * 0.9, moving: !o.stun && o.state !== 'search', phase: o.walk });
      if (o.stun > 0) { ctx.fillStyle = '#1d1a16'; ctx.font = '800 12px Archivo'; ctx.textAlign = 'center'; ctx.fillText('?!', s[0], s[1] - 38 * cs); }
      if (o.state === 'search') { ctx.fillStyle = '#c8321e'; ctx.font = '400 13px Anton'; ctx.textAlign = 'center'; ctx.fillText('SEARCHING ' + Math.ceil(o.searchT || 0), s[0], s[1] - 40 * cs); }
    } else {
      if (o.boost > 0) { const r = 24 + Math.sin(performance.now() / 90) * 4; ctx.fillStyle = 'rgba(255,182,39,.35)'; ctx.beginPath(); ctx.arc(s[0], s[1] - 14, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffb627'; ctx.lineWidth = 3; ctx.stroke(); }
      ring(s[0], s[1]);
      if (o.sprinting) { const tg = edgeTan(edges[o.e], o.d, o.dir); ctx.strokeStyle = 'rgba(29,26,22,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const off = (i - 1) * 6; ctx.beginPath(); ctx.moveTo(s[0] - tg[0] * 14 - tg[1] * off, s[1] - 14 - tg[1] * 14 + tg[0] * off); ctx.lineTo(s[0] - tg[0] * 32 - tg[1] * off, s[1] - 14 - tg[1] * 32 + tg[0] * off); ctx.stroke(); } }
      if (o.blend) { ctx.strokeStyle = '#1a9c9c'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(s[0], s[1] - 10, BLEND_R * cam.z, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      drawChar(ctx, s[0], s[1], o.kind, { s: cs * (o.blend ? 0.95 : 1.15), moving: o.moving, phase: o.walk, placard: true, placardCol: o.blend ? '#f08a1c' : '#138808' });
      ctx.font = '800 11px Archivo'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#fffaf0'; const yl = o.blend ? 'YOU · IN CROWD' : 'YOU'; ctx.strokeText(yl, s[0], s[1] + 15); ctx.fillStyle = o.blend ? '#137a7a' : '#1d1a16'; ctx.fillText(yl, s[0], s[1] + 15);
    }
  }
  if (S.player.state === 'hidden') {
    const sp = S.player.spot, s = W2S(sp.x, sp.y);
    ctx.fillStyle = 'rgba(240,138,28,.25)'; ctx.beginPath(); ctx.arc(s[0], s[1], 26 + Math.sin(performance.now() / 200) * 3, 0, 7); ctx.fill();
    drawChar(ctx, s[0], s[1] + 8, S.player.kind, { s: 0.7 });
  }
  for (const f of S.fx) {
    const s = W2S(f.x, f.y), yy = s[1] - 40 - (1.2 - f.t) * 20;
    ctx.globalAlpha = Math.min(1, f.t * 2); ctx.font = '400 18px Anton, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fffaf0'; ctx.strokeText(f.txt, s[0], yy);
    ctx.fillStyle = /^\+|FREED|RELEASED|FOOLED|JOINED|BOOST|SMASHED|KNOCKED|THWACK|ENERGY/.test(f.txt) ? '#2f7d4f' : '#c8321e'; ctx.fillText(f.txt, s[0], yy); ctx.globalAlpha = 1;
  }
}
function drawBjpFlag(x, y, t) {
  const w = 22, h = 14, wave = Math.sin(t * 8) * 1.5;
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 1, y - 2, 2, 22);
  ctx.save(); ctx.translate(x + 1, y - 2);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(w / 2, wave, w, 0); ctx.lineTo(w, h); ctx.quadraticCurveTo(w / 2, h + wave, 0, h); ctx.closePath();
  ctx.fillStyle = '#ff7f00'; ctx.fill(); ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#138808'; ctx.fillRect(0.6, 0.6, w * 0.28, h - 1.2);
  // lotus
  const cx = w * 0.64, cy = h * 0.55; ctx.fillStyle = '#138808';
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { ctx.beginPath(); ctx.ellipse(cx + Math.sin(a) * 3, cy - Math.cos(a) * 2, 1.4, 3.2, a, 0, 7); ctx.fill(); }
  ctx.fillRect(cx - 4, cy + 2, 8, 1.4);
  ctx.restore();
}
function drawMinister(s, m, cs) {
  const tg = edgeTan(edges[m.e], m.d, m.dir), ang = Math.atan2(tg[1], tg[0]), k = cs * 1.35;
  ctx.save(); ctx.translate(s[0], s[1] - 6); ctx.rotate(ang); ctx.scale(k, k);
  ctx.fillStyle = '#1d1a16'; rr(-18, -7, 40, 20, 6); ctx.fill();
  ctx.fillStyle = '#f5f2ea'; ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; rr(-20, -10, 40, 20, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2b3440'; rr(4, -7, 8, 14, 2); ctx.fill(); rr(-12, -7, 6, 14, 2); ctx.fill();
  const on = Math.floor(m.blink * 5) % 2;
  ctx.fillStyle = on ? '#ff2a1a' : '#8a1a12'; ctx.beginPath(); ctx.arc(-1, 0, 3.4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawBjpFlag(s[0] + 14 * k, s[1] - 34 * k, m.blink);
  if (m.state === 'beaten') {
    const sh = Math.sin(m.t * 30) * 2 * Math.max(0, 1 - m.t);
    drawChar(ctx, s[0] - 22 + sh, s[1] + 8, 'male', { s: cs * 0.9, top: '#ffffff' });
    ctx.fillStyle = '#ffb627'; ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const a = m.t * 5 + i * 2.1, x = s[0] - 22 + Math.cos(a) * 10, y = s[1] - 30 * cs + Math.sin(a) * 3; ctx.font = '800 11px Archivo'; ctx.textAlign = 'center'; ctx.fillText('★', x, y); }
  } else {
    const pp = entPos(S.player), q = entPos(m);
    if (m.state === 'blocked') badge(s[0] + 20, s[1] + 14, `Blocked · ${Math.ceil(BLOCK_TIME - m.blockT)}s`, '#138808', '#fffaf0', null, true);
    else if (m.state === 'stuck') badge(s[0] + 20, s[1] + 14, 'Convoy stuck', '#138808', '#fffaf0', null, true);
    else if (Math.hypot(q[0] - pp[0], q[1] - pp[1]) < 220) badge(s[0] + 20, s[1] + 14, 'Minister · BJP', '#ff7f00', '#1d1a16', null, true);
  }
}
function ring(x, y) { const r = 15 + Math.sin(performance.now() / 180) * 3; ctx.strokeStyle = '#f08a1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.5, 0, 0, 7); ctx.stroke(); }
function edgeArrow(tx, ty, col, label, size = 1) {
  const s = W2S(tx, ty); if (onScreen(s, -30)) return;
  const a = Math.atan2(s[1] - H / 2, s[0] - W / 2);
  const mx = W / 2 - 40, my = H / 2 - 70, k = Math.min(Math.abs(mx / Math.cos(a)), Math.abs(my / Math.sin(a)));
  const x = W / 2 + Math.cos(a) * k, y = H / 2 + Math.sin(a) * k + 20;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(size, size);
  ctx.fillStyle = col; ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -12); ctx.lineTo(-4, 0); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  if (label) { ctx.font = '800 12px Archivo'; ctx.textAlign = 'center'; const lw = ctx.measureText(label).width / 2 + 8; ctx.lineWidth = 4; ctx.strokeStyle = '#fffaf0'; const lx = Math.max(lw, Math.min(W - lw, x - Math.cos(a) * 30)), ly = Math.max(70, Math.min(H - 10, y - Math.sin(a) * 30 + 4)); ctx.strokeText(label, lx, ly); ctx.fillStyle = '#1d1a16'; ctx.fillText(label, lx, ly); }
}
function drawArrows() {
  if (S.over) return;
  const pp = entPos(S.player);
  edgeArrow(jantar.x, jantar.y, '#FF9933', 'Jantar Mantar ' + km(Math.hypot(pp[0] - jantar.x, pp[1] - jantar.y)), 1.3);
  for (const k of S.cops) if ((k.target === S.player && k.state === 'chase') || k.state === 'search') { const q = entPos(k); edgeArrow(q[0], q[1], '#c8321e'); }
  let nm = null, nd = 1800; for (const m of S.ministers) { if (m.state !== 'drive') continue; const q = entPos(m), d = Math.hypot(q[0] - pp[0], q[1] - pp[1]); if (d < nd) { nd = d; nm = q; } }
  if (nm) edgeArrow(nm[0], nm[1], '#138808', 'Minister ' + km(nd), 1);
}
function drawMini() {
  const coarse = matchMedia('(pointer:coarse)').matches;
  const x0 = coarse ? 12 : W - MW - 12, y0 = H - MH - 12;
  ctx.fillStyle = '#1d1a16'; ctx.fillRect(x0 + 3, y0 + 3, MW, MH); ctx.drawImage(mini, x0, y0, MW, MH); ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, MW, MH);
  const m = (x, y) => [x0 + (x - BX0) * MS, y0 + (y - BY0) * MS];
  const pp = entPos(S.player);
  ctx.fillStyle = '#c8321e'; edges.forEach(e => { if (e.bar) { const p = m(e.bar.x, e.bar.y); ctx.fillRect(p[0] - 2, p[1] - 2, 4, 4); } });
  stations.forEach(st => { const p = m(st.x, st.y); ctx.fillStyle = '#1f2f57'; ctx.fillRect(p[0] - 2.5, p[1] - 2.5, 5, 5); });
  spots.forEach(sp => { if (!sp.found) return; const p = m(sp.x, sp.y); ctx.fillStyle = sp.big ? '#2f7d4f' : '#d6457a'; ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); });
  S.crowd.forEach(c => { if (c.state !== 'free') return; const q = entPos(c), p = m(q[0], q[1]); ctx.fillStyle = '#f08a1c'; ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2); });
  S.cops.forEach(k => { const q = entPos(k); if (Math.hypot(q[0] - pp[0], q[1] - pp[1]) > S.C.radar) return; const p = m(q[0], q[1]); ctx.fillStyle = '#1f2f57'; ctx.beginPath(); ctx.arc(p[0], p[1], 2, 0, 7); ctx.fill(); });
  S.drinks.forEach(d => { const p = m(d.x, d.y); ctx.fillStyle = '#1a9c9c'; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); });
  S.ministers.forEach(mm => { if (mm.state !== 'drive') return; const q = entPos(mm), p = m(q[0], q[1]); ctx.fillStyle = '#ff7f00'; ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1; ctx.fillRect(p[0] - 3, p[1] - 3, 6, 6); ctx.strokeRect(p[0] - 3, p[1] - 3, 6, 6); });
  const j = m(jantar.x, jantar.y); ctx.fillStyle = '#FF9933'; ctx.strokeStyle = '#1d1a16'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(j[0], j[1] - 6); ctx.lineTo(j[0] + 5, j[1]); ctx.lineTo(j[0], j[1] + 6); ctx.lineTo(j[0] - 5, j[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
  const p = m(pp[0], pp[1]); ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(29,26,22,.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + (cam.x - W / 2 / cam.z - BX0) * MS, y0 + (cam.y - H / 2 / cam.z - BY0) * MS, W / cam.z * MS, H / cam.z * MS);
  ctx.fillStyle = '#1d1a16'; ctx.font = '600 9px Archivo'; ctx.textAlign = 'left'; ctx.fillText('N↑ © OSM', x0 + 4, y0 + MH - 5);
  if (mapMode === 'sat') { ctx.font = '600 10px Archivo'; ctx.textAlign = 'right'; const ax = coarse ? W - 12 : x0 - 8; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(29,26,22,.8)'; ctx.strokeText('Imagery © Esri, Maxar, Earthstar Geographics', ax, H - 8); ctx.fillStyle = '#fffaf0'; ctx.fillText('Imagery © Esri, Maxar, Earthstar Geographics', ax, H - 8); }
  if (S.C.radar > 9999) { ctx.fillStyle = '#7b4fd6'; ctx.font = '800 9px Archivo'; ctx.fillText('LIVE', x0 + MW - 28, y0 + 11); }
}
function updateHidePrompt() {
  const bar = $('hideBar'), btn = $('hideBtn');
  if (!S.running || S.over) { bar.classList.remove('show'); btn.classList.remove('on'); $('beatBtn').classList.remove('on'); $('blockBtn').classList.remove('on'); return; }
  const P = S.player, coarse = matchMedia('(pointer:coarse)').matches;
  if (P.state === 'hidden') {
    $('beatBtn').classList.remove('on'); $('blockBtn').classList.remove('on');
    const left = Math.max(0, S.C.hide - P.hideT), searcher = S.cops.find(k => k.state === 'search' && k.spot === P.spot);
    let msg = `Hiding in <b>${P.spot.name}</b> · ${Math.ceil(left)}s`;
    if (searcher) { const arrived = searcher.e === P.spot.e && Math.abs(searcher.d - P.spot.d) < 3; msg = arrived ? `A cop is searching the shop. ${Math.ceil(searcher.searchT)}s. Get out${P.spot.big ? ' the back door' : ''}` : `A cop is heading to the shop. Leave now${P.spot.big ? ' by the back door' : ''}`; }
    bar.innerHTML = msg + (coarse ? '' : ' <kbd>E</kbd> leave'); bar.classList.add('show'); bar.classList.toggle('alert', !!searcher);
    btn.textContent = 'LEAVE'; btn.classList.add('on');
  } else {
    const bb = $('beatBtn'), kb = $('blockBtn'), nm = nearMinister();
    bb.classList.toggle('on', !!nm); kb.classList.toggle('on', !!nm && nm.state === 'drive');
    if (P.state === 'carried') { bar.innerHTML = `Detained (${S.detentions}/${MAX_DETAIN}). Being taken to <b>${P.by.station.name}</b>`; bar.classList.add('show', 'alert'); btn.classList.remove('on'); return; }
    if (P.state === 'held') { bar.innerHTML = `Held at <b>${S.detainedAt}</b> · released in ${Math.ceil(Math.max(0, P.heldT))}s`; bar.classList.add('show', 'alert'); btn.classList.remove('on'); return; }
    if (nm && nm.state === 'blocked') { bar.innerHTML = `Blocking the <b>minister's car</b> · hold ${Math.ceil(BLOCK_TIME - nm.blockT)}s ${coarse ? 'or tap BEAT' : 'or <kbd>F</kbd> beat'}`; bar.classList.add('show'); bar.classList.remove('alert'); btn.classList.remove('on'); return; }
    if (nm) { bar.innerHTML = coarse ? 'Minister\'s car: tap <b>BLOCK</b> to sit in front of it, or <b>BEAT</b> to confront the minister' : '<kbd>G</kbd> block the <b>minister\'s car</b> · <kbd>F</kbd> beat the minister'; bar.classList.add('show'); bar.classList.remove('alert'); btn.classList.remove('on'); return; }
    const sp = nearSpot();
    if (sp) { bar.innerHTML = sp.cool > 0 ? `Police are watching ${sp.name}` : `${coarse ? 'Tap HIDE to hide in' : '<kbd>E</kbd> hide in'} <b>${sp.name}</b>${sp.big ? ' (back door)' : ''}`; bar.classList.add('show'); bar.classList.remove('alert'); btn.textContent = 'HIDE'; btn.classList.toggle('on', sp.cool <= 0); }
    else { bar.classList.remove('show'); btn.classList.remove('on'); }
  }
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#efe4cc'; ctx.fillRect(0, 0, W, H);
  if (!S) return;
  const P = S.player; let f;
  if (P.state === 'free') f = entPos(P); else if (P.state === 'hidden') f = [P.spot.x, P.spot.y]; else if (P.state === 'carried') f = entPos(P.by); else f = [cam.x, cam.y];
  const tz = Math.max(0.45, Math.min(0.85, Math.min(W, H) / 1000)) * (P.sprinting ? 0.94 : 1);
  cam.z += (tz - cam.z) * 0.05; cam.x += (f[0] - cam.x) * 0.15; cam.y += (f[1] - cam.y) * 0.15;
  if (S.shake > 0) { cam.x += rand(-3, 3); cam.y += rand(-3, 3); }
  drawMap(); drawLabels(); drawBarricades(); drawPlaces(); drawEntities(); drawArrows(); drawMini();
  if (P.state === 'hidden') { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(29,26,22,0)'); g.addColorStop(1, 'rgba(29,26,22,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const pp = entPos(P);
  $('hGoal').textContent = km(Math.hypot(pp[0] - jantar.x, pp[1] - jantar.y));
  $('hTime').textContent = fmt(S.t); $('hScore').textContent = Math.floor(S.score); $('hRally').textContent = S.rally;
  $('hCops').textContent = `${S.cops.length} · ${S.cops.filter(k => (k.state === 'chase' && k.target === P) || k.state === 'search').length} on you`;
  $('hStam').style.width = (P.stam / S.C.stam * 100) + '%';
  $('hStars').textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
  $('hBoost').textContent = [P.boost > 0 ? `BOOST ${Math.ceil(P.boost)}s` : '', P.cover > 0 ? `${P.blend ? 'IN CROWD' : 'COVER'} ${fmt(P.cover)}` : ''].filter(Boolean).join(' · '); $('wantChip').classList.toggle('boost', P.boost > 0);
  updateHidePrompt();
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (flag.active) drawFlagScene(dt);
  else { update(dt); render(); }
  requestAnimationFrame(frame);
}
resize();
newState(); initialBarricades();
{ const p = entPos(S.player); cam.x = p[0]; cam.y = p[1]; }
requestAnimationFrame(frame);

// test hooks
window.advanceTime = ms => { const n = Math.round(ms / 16.67); for (let i = 0; i < n; i++) { if (flag.active) drawFlagScene(1 / 60); else update(1 / 60); } if (!flag.active) render(); };
window.render_game_to_text = () => {
  const p = entPos(S.player);
  return JSON.stringify({ running: S.running, over: S.over, won: S.won, t: +S.t.toFixed(1), score: Math.floor(S.score), char: S.player.kind,
    player: { x: p[0] | 0, y: p[1] | 0, state: S.player.state, stam: S.player.stam | 0 }, toGoal: Math.round(Math.hypot(p[0] - jantar.x, p[1] - jantar.y)),
    cops: S.cops.length, chasing: S.cops.filter(k => k.state === 'chase').length, barricades: edges.filter(e => e.blocked).length, rally: S.rally, crowdFree: S.crowd.filter(c => c.state === 'free').length, flag: flag.active ? +flag.p.toFixed(2) : null,
    wanted: S.wanted, boost: +S.player.boost.toFixed(1), ministers: S.ministers.filter(m => m.state === 'drive').length, beaten: S.beaten, smashed: S.smashed, knocked: S.knocked, drinks: S.drinks.length, cover: Math.round(S.player.cover), blend: S.player.blend, mapMode, alias: ALIAS });
};
window.__G = { get S() { return S; }, spots, edges, nodes, JN, jantar, hideToggle, win, flag, field, choice, beatMinister, spawnMinister, addStar, entPos, setMapMode, tiles, get metro() { return metroLines.length; } };
})();
