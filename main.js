// Voxlet — an original open-source voxel sandbox client. MIT licensed.
import * as THREE from './vendor/three.module.min.js';

// ---------------------------------------------------------------- constants
const CH = 16;            // chunk width/depth
const WH = 56;            // world height
const SEA = 18;
const REACH = 6;
const TILE = 16, ATLAS_N = 4;

// tile indices in the atlas
const T = { grassTop: 0, grassSide: 1, dirt: 2, stone: 3, sand: 4, logTop: 5, logSide: 6, leaves: 7, planks: 8, brick: 9, glass: 10, water: 11 };
// block id -> [top, bottom, side]
const BLOCKS = {
  1: { name: 'Grass',  f: [T.grassTop, T.dirt, T.grassSide] },
  2: { name: 'Dirt',   f: [T.dirt, T.dirt, T.dirt] },
  3: { name: 'Stone',  f: [T.stone, T.stone, T.stone] },
  4: { name: 'Sand',   f: [T.sand, T.sand, T.sand] },
  5: { name: 'Log',    f: [T.logTop, T.logTop, T.logSide] },
  6: { name: 'Leaves', f: [T.leaves, T.leaves, T.leaves], cut: true },
  7: { name: 'Planks', f: [T.planks, T.planks, T.planks] },
  8: { name: 'Brick',  f: [T.brick, T.brick, T.brick] },
  9: { name: 'Glass',  f: [T.glass, T.glass, T.glass], cut: true },
};
const HOTBAR = [1, 2, 3, 4, 5, 7, 8, 9, 6];

// ---------------------------------------------------------------- utils
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = smooth(x - x0), fz = smooth(z - z0);
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed), c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
function fbm(x, z, seed) {
  let s = 0, amp = 1, f = 1, tot = 0;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, z * f, seed + i * 31) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return s / tot;
}

// ---------------------------------------------------------------- texture atlas (procedural, no external art)
function makeAtlas() {
  const c = document.createElement('canvas'); c.width = c.height = TILE * ATLAS_N;
  const g = c.getContext('2d');
  const rnd = mulberry(1234);
  const speckle = (i, base, vari, alpha = 1) => {
    const ox = (i % ATLAS_N) * TILE, oy = Math.floor(i / ATLAS_N) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const v = (rnd() - 0.5) * vari;
      g.fillStyle = `rgba(${clamp(base[0] + v, 0, 255) | 0},${clamp(base[1] + v, 0, 255) | 0},${clamp(base[2] + v, 0, 255) | 0},${alpha})`;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
    return [ox, oy];
  };
  speckle(T.grassTop, [92, 160, 74], 34);
  speckle(T.dirt, [128, 92, 60], 30);
  speckle(T.grassSide, [128, 92, 60], 30);
  { const ox = (T.grassSide % ATLAS_N) * TILE, oy = Math.floor(T.grassSide / ATLAS_N) * TILE;
    for (let x = 0; x < TILE; x++) { const h = 3 + (rnd() * 3 | 0); for (let y = 0; y < h; y++) { const v = (rnd() - 0.5) * 30; g.fillStyle = `rgb(${92 + v | 0},${160 + v | 0},${74 + v | 0})`; g.fillRect(ox + x, oy + y, 1, 1); } } }
  speckle(T.stone, [126, 128, 132], 36);
  speckle(T.sand, [222, 208, 150], 20);
  speckle(T.logTop, [170, 134, 84], 24);
  { const ox = (T.logTop % ATLAS_N) * TILE, oy = Math.floor(T.logTop / ATLAS_N) * TILE; g.strokeStyle = 'rgba(90,64,30,.7)'; g.strokeRect(ox + 2.5, oy + 2.5, 11, 11); g.strokeRect(ox + 5.5, oy + 5.5, 5, 5); }
  speckle(T.logSide, [106, 80, 48], 28);
  { const ox = (T.logSide % ATLAS_N) * TILE, oy = Math.floor(T.logSide / ATLAS_N) * TILE; g.fillStyle = 'rgba(60,40,20,.35)'; for (let x = 1; x < TILE; x += 4) g.fillRect(ox + x, oy, 1, TILE); }
  // leaves: with holes
  { const ox = (T.leaves % ATLAS_N) * TILE, oy = Math.floor(T.leaves / ATLAS_N) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) { if (rnd() < 0.18) continue; const v = (rnd() - 0.5) * 50; g.fillStyle = `rgb(${52 + v | 0},${122 + v | 0},${50 + v | 0})`; g.fillRect(ox + x, oy + y, 1, 1); } }
  speckle(T.planks, [176, 140, 86], 18);
  { const ox = (T.planks % ATLAS_N) * TILE, oy = Math.floor(T.planks / ATLAS_N) * TILE; g.fillStyle = 'rgba(80,56,28,.55)'; for (let y = 3; y < TILE; y += 4) g.fillRect(ox, oy + y, TILE, 1); }
  speckle(T.brick, [158, 78, 62], 22);
  { const ox = (T.brick % ATLAS_N) * TILE, oy = Math.floor(T.brick / ATLAS_N) * TILE; g.fillStyle = 'rgba(210,205,195,.9)';
    for (let y = 0; y < TILE; y += 4) { g.fillRect(ox, oy + y, TILE, 1); for (let x = (y / 4 % 2) * 4; x < TILE; x += 8) g.fillRect(ox + x, oy + y, 1, 4); } }
  { const ox = (T.glass % ATLAS_N) * TILE, oy = Math.floor(T.glass / ATLAS_N) * TILE;
    g.fillStyle = 'rgba(190,230,245,0.25)'; g.fillRect(ox, oy, TILE, TILE);
    g.fillStyle = 'rgb(220,240,250)'; g.fillRect(ox, oy, TILE, 1); g.fillRect(ox, oy + TILE - 1, TILE, 1); g.fillRect(ox, oy, 1, TILE); g.fillRect(ox + TILE - 1, oy, 1, TILE);
    g.fillRect(ox + 3, oy + 3, 3, 1); g.fillRect(ox + 3, oy + 3, 1, 3); }
  return c;
}
const atlasCanvas = makeAtlas();
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.generateMipmaps = false;

// ---------------------------------------------------------------- renderer / scene
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const SKY = new THREE.Color('#7db9ea');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 30, 80);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 400);
camera.rotation.order = 'YXZ';
const mat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.45 });
function onResize() { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', onResize); onResize();

// ---------------------------------------------------------------- world
const world = { seed: 1337, chunks: new Map(), edits: new Map(), meshQueue: new Set() };
const ck = (cx, cz) => cx + ',' + cz;
const idx = (x, y, z) => (y * CH + z) * CH + x;

function treeAt(x, z) {
  if (hash2(x, z, world.seed + 7) > 0.012) return null;
  const h = terrainHeight(x, z);
  if (h <= SEA + 1) return null;
  return { h, th: 4 + Math.floor(hash2(x, z, world.seed + 9) * 2) };
}
function terrainHeight(x, z) {
  const n = fbm(x / 48, z / 48, world.seed);
  const m = fbm(x / 14, z / 14, world.seed + 99);
  return Math.floor(SEA - 5 + n * 26 + m * 4);
}
function genChunk(cx, cz) {
  const data = new Uint8Array(CH * WH * CH);
  const x0 = cx * CH, z0 = cz * CH;
  for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
    const h = clamp(terrainHeight(x0 + x, z0 + z), 2, WH - 12);
    for (let y = 0; y <= h; y++) {
      let b = 3;
      if (y === h) b = h <= SEA + 1 ? 4 : 1;
      else if (y > h - 4) b = h <= SEA + 1 ? 4 : 2;
      data[idx(x, y, z)] = b;
    }
    // fill low areas with sand lakebed (no water in this version)
  }
  // trees (including ones rooted just outside the chunk)
  for (let tz = z0 - 2; tz < z0 + CH + 2; tz++) for (let tx = x0 - 2; tx < x0 + CH + 2; tx++) {
    const t = treeAt(tx, tz); if (!t) continue;
    const put = (wx, wy, wz, id, overwrite) => {
      const lx = wx - x0, lz = wz - z0; if (lx < 0 || lz < 0 || lx >= CH || lz >= CH || wy < 0 || wy >= WH) return;
      const i = idx(lx, wy, lz); if (overwrite || data[i] === 0) data[i] = id;
    };
    const top = t.h + t.th;
    for (let dy = -1; dy <= 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      put(tx + dx, top - 1 + dy, tz + dz, 6, false);
    }
    put(tx, top + 1, tz, 6, false); put(tx + 1, top + 1, tz, 6, false); put(tx - 1, top + 1, tz, 6, false); put(tx, top + 1, tz + 1, 6, false); put(tx, top + 1, tz - 1, 6, false);
    for (let y = t.h + 1; y <= top; y++) put(tx, y, tz, 5, true);
  }
  const list = world.edits.get(ck(cx, cz));
  if (list) for (const [lx, y, lz, b] of list) data[idx(lx, y, lz)] = b;
  return data;
}
function ensureChunk(cx, cz) {
  const k = ck(cx, cz);
  let c = world.chunks.get(k);
  if (!c) {
    c = { cx, cz, data: genChunk(cx, cz), mesh: null, dirty: true };
    world.chunks.set(k, c);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = world.chunks.get(ck(cx + dx, cz + dz)); if (n) n.dirty = true; }
  }
  return c;
}
function getBlock(x, y, z) {
  if (y < 0 || y >= WH) return 0;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
  const c = world.chunks.get(ck(cx, cz)); if (!c) return 0;
  return c.data[idx(x - cx * CH, y, z - cz * CH)];
}
function setBlock(x, y, z, b, record = true) {
  if (y < 0 || y >= WH) return false;
  const cx = Math.floor(x / CH), cz = Math.floor(z / CH), lx = x - cx * CH, lz = z - cz * CH;
  const k = ck(cx, cz), c = world.chunks.get(k);
  if (record) {
    const l = world.edits.get(k) || []; const e = l.find(v => v[0] === lx && v[1] === y && v[2] === lz);
    if (e) e[3] = b; else l.push([lx, y, lz, b]); world.edits.set(k, l);
  }
  if (!c) return true;
  c.data[idx(lx, y, lz)] = b; c.dirty = true;
  if (lx === 0) { const n = world.chunks.get(ck(cx - 1, cz)); if (n) n.dirty = true; }
  if (lx === CH - 1) { const n = world.chunks.get(ck(cx + 1, cz)); if (n) n.dirty = true; }
  if (lz === 0) { const n = world.chunks.get(ck(cx, cz - 1)); if (n) n.dirty = true; }
  if (lz === CH - 1) { const n = world.chunks.get(ck(cx, cz + 1)); if (n) n.dirty = true; }
  return true;
}
const solid = (x, y, z) => getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;

// face definitions: dir, corners (4), shade, face index into BLOCKS.f
const FACES = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8, t: 2 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8, t: 2 },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 1 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.68, t: 2 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.68, t: 2 },
];
const UVC = [[0, 0], [1, 0], [1, 1], [0, 1]];
function buildMesh(c) {
  const pos = [], uv = [], col = [], ind = [];
  const x0 = c.cx * CH, z0 = c.cz * CH, e = 0.002, step = 1 / ATLAS_N;
  for (let y = 0; y < WH; y++) for (let z = 0; z < CH; z++) for (let x = 0; x < CH; x++) {
    const b = c.data[idx(x, y, z)]; if (!b) continue;
    const def = BLOCKS[b], wx = x0 + x, wz = z0 + z;
    for (const f of FACES) {
      const nb = getBlock(wx + f.d[0], y + f.d[1], wz + f.d[2]);
      if (nb && !(BLOCKS[nb].cut && nb !== b)) continue;
      const tile = def.f[f.t], tx = (tile % ATLAS_N) * step, ty = 1 - (Math.floor(tile / ATLAS_N) + 1) * step;
      const base = pos.length / 3;
      for (let i = 0; i < 4; i++) {
        const cc = f.c[i];
        pos.push(wx + cc[0], y + cc[1], wz + cc[2]);
        uv.push(tx + e + UVC[i][0] * (step - 2 * e), ty + e + UVC[i][1] * (step - 2 * e));
        const jit = 1 - hash2(wx, wz + y * 7, 5) * 0.05;
        col.push(f.s * jit, f.s * jit, f.s * jit);
      }
      ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(ind); g.computeBoundingSphere();
  c.mesh = new THREE.Mesh(g, mat); scene.add(c.mesh);
}

// ---------------------------------------------------------------- settings / modules
const settings = { fov: 75, rd: 5, sens: 1, mods: { fps: true, pos: true, cps: true, keys: true, crosshair: true, togglesprint: false, hint: true } };
const MOD_LABELS = { fps: 'FPS counter', pos: 'Coordinates', cps: 'Click counter', keys: 'Keystrokes', crosshair: 'Crosshair', togglesprint: 'Toggle sprint', hint: 'Help hints' };
function applyMods() {
  $('m-fps').hidden = !settings.mods.fps; $('m-pos').hidden = !settings.mods.pos; $('m-cps').hidden = !settings.mods.cps;
  $('m-keys').hidden = !settings.mods.keys; $('crosshair').hidden = !settings.mods.crosshair; $('hint').hidden = !settings.mods.hint;
}
function buildModMenu() {
  const l = $('modList'); l.innerHTML = '';
  for (const k of Object.keys(MOD_LABELS)) {
    const d = document.createElement('div'); d.className = 'tog' + (settings.mods[k] ? ' on' : ''); d.tabIndex = 0; d.setAttribute('role', 'switch');
    d.innerHTML = `<span>${MOD_LABELS[k]}</span><i></i>`;
    const flip = () => { settings.mods[k] = !settings.mods[k]; d.classList.toggle('on', settings.mods[k]); applyMods(); };
    d.addEventListener('click', flip); d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    l.appendChild(d);
  }
}
$('hudScale').addEventListener('input', (e) => { $('hud').style.setProperty('--hs', e.target.value); $('hudV').textContent = (+e.target.value).toFixed(1); });
for (const [id, key, fmt] of [['fov', 'fov', v => v], ['rd', 'rd', v => v], ['sens', 'sens', v => (+v).toFixed(1)]]) {
  $(id).addEventListener('input', (e) => { settings[key] = +e.target.value; $(id + 'V').textContent = fmt(e.target.value); applyFog(); });
}
function applyFog() { const d = settings.rd * CH; scene.fog.near = d * 0.45; scene.fog.far = d * 1.05; }
applyFog();

// ---------------------------------------------------------------- player
const player = { x: 8.5, y: 40, z: 8.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: false, fly: false, w: 0.3, h: 1.8, eye: 1.62, sprint: false };
const keys = {};
let sel = 0, started = false, menuOpen = false, locked = false, dragging = false, downPos = null, zooming = false;
let clickTimes = [], lastSpace = 0, lastW = 0;

function collides(px, py, pz) {
  const w = player.w, h = player.h;
  for (let y = Math.floor(py); y <= Math.floor(py + h - 0.001); y++)
    for (let z = Math.floor(pz - w); z <= Math.floor(pz + w); z++)
      for (let x = Math.floor(px - w); x <= Math.floor(px + w); x++)
        if (getBlock(x, y, z) !== 0) return true;
  return false;
}
function stepPlayer(dt) {
  const p = player;
  const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sprinting = (keys.ShiftLeft || keys.ShiftRight || p.sprint) && fwd > 0 && !p.fly;
  const speed = p.fly ? (keys.ShiftLeft ? 14 : 11) : sprinting ? 7 : 4.6;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let mx = -sy * fwd + cy * side, mz = -cy * fwd - sy * side;
  const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
  const acc = p.onGround || p.fly ? 14 : 4;
  const tx = mx * speed, tz = mz * speed;
  p.vx += (tx - p.vx) * Math.min(1, acc * dt); p.vz += (tz - p.vz) * Math.min(1, acc * dt);
  if (p.fly) {
    const ty = ((keys.Space ? 1 : 0) - (keys.ShiftLeft ? 1 : 0)) * 8;
    p.vy += (ty - p.vy) * Math.min(1, 10 * dt);
  } else {
    p.vy -= 28 * dt; if (p.vy < -50) p.vy = -50;
    if (keys.Space && p.onGround) { p.vy = 8.6; p.onGround = false; }
  }
  // axis-separated movement
  let nx = p.x + p.vx * dt; if (collides(nx, p.y, p.z)) { p.vx = 0; nx = p.x; } p.x = nx;
  let nz = p.z + p.vz * dt; if (collides(p.x, p.y, nz)) { p.vz = 0; nz = p.z; } p.z = nz;
  let ny = p.y + p.vy * dt;
  if (collides(p.x, ny, p.z)) { if (p.vy < 0) p.onGround = true; p.vy = 0; ny = p.y; if (!p.onGround || true) { /* snap */ } }
  else p.onGround = false;
  p.y = ny;
  if (p.y < -30) { p.y = 60; p.vy = 0; }
}

// ---------------------------------------------------------------- interaction
function raycast() {
  const o = new THREE.Vector3(player.x, player.y + player.eye, player.z);
  const d = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
  const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
  let tmx = sx ? ((sx > 0 ? x + 1 - o.x : o.x - x) * tdx) : Infinity;
  let tmy = sy ? ((sy > 0 ? y + 1 - o.y : o.y - y) * tdy) : Infinity;
  let tmz = sz ? ((sz > 0 ? z + 1 - o.z : o.z - z) * tdz) : Infinity;
  let n = [0, 0, 0], t = 0;
  for (let i = 0; i < 64; i++) {
    if (getBlock(x, y, z)) return { x, y, z, n };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
    if (t > REACH) break;
  }
  return null;
}
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000 }));
hl.visible = false; scene.add(hl);

function breakBlock() {
  const h = raycast(); if (!h) return;
  setBlock(h.x, h.y, h.z, 0); net.send({ t: 'block', x: h.x, y: h.y, z: h.z, b: 0 });
}
function placeBlock() {
  const h = raycast(); if (!h) return;
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  if (getBlock(x, y, z)) return;
  // don't place inside the player
  const w = player.w;
  if (x + 1 > player.x - w && x < player.x + w && z + 1 > player.z - w && z < player.z + w && y + 1 > player.y && y < player.y + player.h) return;
  const id = HOTBAR[sel];
  setBlock(x, y, z, id); net.send({ t: 'block', x, y, z, b: id });
}
function click(kind) {
  clickTimes.push(performance.now());
  if (kind === 'break') breakBlock(); else placeBlock();
}

// input events
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC']);
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'color') return;
  if (!started) return;
  if (e.code === 'KeyM') { toggleMenu(); e.preventDefault(); return; }
  if (e.code === 'KeyT' && !menuOpen) { e.preventDefault(); openChat(); return; }
  if (e.code === 'Slash' && !menuOpen) { e.preventDefault(); openChat('/'); return; }
  if (e.code === 'KeyB' && !menuOpen) { const w = addWaypoint('', player.x, player.y + 1, player.z); addMsg('Waypoint added: ' + w.name, 'sys'); return; }
  if (menuOpen) return;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  const now = performance.now();
  if (e.code === 'Space') { if (now - lastSpace < 300) { player.fly = !player.fly; player.vy = 0; toast(player.fly ? 'Flying on' : 'Flying off'); } lastSpace = now; }
  if (e.code === 'KeyW') { if (settings.mods.togglesprint && now - lastW < 300) { player.sprint = !player.sprint; toast(player.sprint ? 'Sprint on' : 'Sprint off'); } lastW = now; }
  if (e.code === 'KeyC') zooming = true;
  if (e.code.startsWith('Digit')) { const i = +e.code.slice(5) - 1; if (i >= 0 && i < 9) setSel(i); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyC') zooming = false; if (e.code === 'KeyW' && !settings.mods.togglesprint) player.sprint = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; zooming = false; });
window.addEventListener('wheel', (e) => { if (!started || menuOpen) return; setSel((sel + (e.deltaY > 0 ? 1 : 8)) % 9); }, { passive: true });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!started || menuOpen) return;
  if (e.button === 2) { click('place'); return; }
  if (e.button !== 0) return;
  if (!locked) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  downPos = { x: e.clientX, y: e.clientY, moved: 0 }; dragging = true;
  if (locked) click('break');
});
window.addEventListener('mouseup', () => {
  if (downPos && !locked && downPos.moved < 6 && started && !menuOpen) click('break');
  downPos = null; dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!started || menuOpen) return;
  if (locked || dragging) {
    const s = 0.0022 * settings.sens * (zooming ? 0.35 : 1);
    player.yaw -= e.movementX * s; player.pitch = clamp(player.pitch - e.movementY * s, -1.55, 1.55);
    if (downPos) downPos.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  }
});
// touch: drag to look, tap to break, two-finger tap to place
let touchLast = null, touchMoved = 0;
canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { click('place'); return; } const t = e.touches[0]; touchLast = { x: t.clientX, y: t.clientY }; touchMoved = 0; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (!touchLast) return; const dx = t.clientX - touchLast.x, dy = t.clientY - touchLast.y; touchLast = { x: t.clientX, y: t.clientY }; touchMoved += Math.abs(dx) + Math.abs(dy); player.yaw -= dx * 0.005; player.pitch = clamp(player.pitch - dy * 0.005, -1.55, 1.55); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => { if (touchMoved < 8 && started) click('break'); touchLast = null; });

function toggleMenu() {
  if (!started) { $('modmenu').hidden = !$('modmenu').hidden; return; }
  menuOpen = !menuOpen; $('modmenu').hidden = !menuOpen;
  if (menuOpen) { try { document.exitPointerLock(); } catch (_) {} for (const k in keys) keys[k] = false; }
}
$('closeMods').addEventListener('click', toggleMenu);

// ---------------------------------------------------------------- HUD
let toastT = 0;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1400); }
function iconFor(id) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const tile = BLOCKS[id].f[2], sx = (tile % ATLAS_N) * TILE, sy = Math.floor(tile / ATLAS_N) * TILE;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 32, 32); g.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, 32, 32);
  return c.toDataURL();
}
function buildHotbar() {
  const h = $('hotbar'); h.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const d = document.createElement('div'); d.className = 'slot'; d.style.backgroundImage = `url(${iconFor(id)})`; d.title = BLOCKS[id].name;
    d.innerHTML = `<b>${i + 1}</b>`; d.style.pointerEvents = 'auto'; d.addEventListener('click', () => setSel(i)); h.appendChild(d);
  });
  setSel(0);
}
function setSel(i) { sel = i; [...$('hotbar').children].forEach((d, j) => d.classList.toggle('sel', j === i)); }

// ---------------------------------------------------------------- networking (optional, self-hosted server)
const remotes = new Map();
function nameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
  g.font = '600 28px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, 256, 48); g.fillStyle = '#fff'; g.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, fog: false })); s.scale.set(1.6, 0.3, 1); s.renderOrder = 10; return s;
}
function addRemote(p) {
  if (remotes.has(p.id)) return;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.35), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hash2(p.id, 1, 3), 0.55, 0.5) })); body.position.y = 0.65;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xe6c39b })); head.position.y = 1.45; head.name = 'head';
  const tag = nameSprite(p.name); tag.position.y = 2.1;
  g.add(body, head, tag); g.position.set(p.x, p.y, p.z); scene.add(g);
  remotes.set(p.id, { g, tx: p.x, ty: p.y, tz: p.z, yaw: p.yaw || 0 });
}
const net = {
  ws: null, id: 0, last: 0, on: false,
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  connect(url, name) {
    return new Promise((resolve) => {
      let done = false; const fin = (ok) => { if (!done) { done = true; resolve(ok); } };
      try { this.ws = new WebSocket(url); } catch (e) { fin(false); return; }
      const to = setTimeout(() => { try { this.ws.close(); } catch (_) {} fin(false); }, 5000);
      this.ws.onopen = () => this.send({ t: 'join', name });
      this.ws.onerror = () => { clearTimeout(to); fin(false); };
      this.ws.onclose = () => { this.on = false; $('net').textContent = 'disconnected'; for (const r of remotes.values()) scene.remove(r.g); remotes.clear(); fin(false); };
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.t === 'init') {
          this.id = m.id; world.seed = m.seed; this.on = true;
          for (const [x, y, z, b] of m.edits) setBlock(x, y, z, b);
          for (const p of m.players) addRemote(p);
          clearTimeout(to); fin(true);
        } else if (m.t === 'join') addRemote(m.p);
        else if (m.t === 'leave') { const r = remotes.get(m.id); if (r) { scene.remove(r.g); remotes.delete(m.id); } }
        else if (m.t === 'pos') { const r = remotes.get(m.id); if (r) { r.tx = m.x; r.ty = m.y; r.tz = m.z; r.yaw = m.yaw; } }
        else if (m.t === 'block') setBlock(m.x, m.y, m.z, m.b);
        else if (m.t === 'chat') addMsg(`<${String(m.name).slice(0, 16)}> ${String(m.text).slice(0, 100)}`);
      };
    });
  },
};

// ---------------------------------------------------------------- chat, commands, waypoints
const waypoints = [];
const WP_COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff', '#ff9f1c'];
function addMsg(text, cls = '') {
  const log = $('chatLog'), d = document.createElement('div'); d.className = 'msg ' + cls; d.textContent = text; log.appendChild(d);
  while (log.children.length > 12) log.removeChild(log.firstChild);
  setTimeout(() => d.classList.add('old'), 8000);
}
function addWaypoint(name, x, y, z) {
  name = (name || 'Waypoint ' + (waypoints.length + 1)).slice(0, 16);
  waypoints.push({ name, x, y, z, color: WP_COLORS[waypoints.length % WP_COLORS.length], el: Object.assign(document.createElement('div'), { className: 'wp' }) });
  const w = waypoints[waypoints.length - 1]; w.el.style.color = w.color; w.el.innerHTML = `${name}<small></small>`; $('wps').appendChild(w.el);
  return w;
}
function runCommand(line) {
  const [cmd, ...a] = line.slice(1).trim().split(/\s+/); const sys = (t) => addMsg(t, 'sys');
  switch ((cmd || '').toLowerCase()) {
    case 'help': sys('Commands: /waypoint add|remove|list, /color #rrggbb, /fov n, /fly, /clear, /pos'); break;
    case 'pos': sys(`You are at ${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`); break;
    case 'fly': player.fly = !player.fly; player.vy = 0; sys(player.fly ? 'Flying on' : 'Flying off'); break;
    case 'clear': $('chatLog').innerHTML = ''; break;
    case 'fov': { const v = clamp(+a[0] || 75, 50, 110); settings.fov = v; $('fov').value = v; $('fovV').textContent = v; sys('Field of view ' + v); break; }
    case 'color': { if (/^#[0-9a-f]{6}$/i.test(a[0] || '')) { setAccent(a[0]); sys('Accent color set'); } else sys('Usage: /color #58c26a'); break; }
    case 'waypoint': case 'wp': {
      const sub = (a[0] || 'list').toLowerCase();
      if (sub === 'add') { const w = addWaypoint(a.slice(1).join(' '), player.x, player.y + 1, player.z); sys('Waypoint added: ' + w.name); }
      else if (sub === 'remove') { const n = a.slice(1).join(' ').toLowerCase(); const i = waypoints.findIndex(w => w.name.toLowerCase() === n); if (i < 0) sys('No waypoint named that'); else { waypoints[i].el.remove(); waypoints.splice(i, 1); sys('Waypoint removed'); } }
      else if (sub === 'list') sys(waypoints.length ? waypoints.map(w => `${w.name} (${w.x.toFixed(0)}, ${w.y.toFixed(0)}, ${w.z.toFixed(0)})`).join(' | ') : 'No waypoints yet. Press B to add one.');
      else sys('Usage: /waypoint add <name> | remove <name> | list');
      break;
    }
    default: sys('Unknown command. Try /help');
  }
}
function openChat(prefill = '') {
  if (!started || menuOpen) return; const i = $('chatInput'); $('chat').classList.add('open'); i.hidden = false; i.value = prefill; i.focus();
  for (const k in keys) keys[k] = false; try { document.exitPointerLock(); } catch (_) {}
}
function closeChat() { const i = $('chatInput'); i.hidden = true; i.blur(); $('chat').classList.remove('open'); }
$('chatInput').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Escape') { closeChat(); return; }
  if (e.key !== 'Enter') return;
  const v = $('chatInput').value.trim(); closeChat(); if (!v) return;
  if (v[0] === '/') runCommand(v); else { addMsg(`<${$('nameInput').value.trim() || 'Player'}> ${v}`); net.send({ t: 'chat', text: v }); }
});
function setAccent(hex) { document.documentElement.style.setProperty('--accent', hex); $('accent').value = hex; }
$('accent').addEventListener('input', (e) => setAccent(e.target.value));
$('xhair').addEventListener('input', (e) => document.documentElement.style.setProperty('--xh', e.target.value));
const _v = new THREE.Vector3();
function updateWaypoints() {
  for (const w of waypoints) {
    _v.set(w.x, w.y, w.z).project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    w.el.style.display = vis ? 'block' : 'none';
    if (vis) {
      w.el.style.left = ((_v.x + 1) / 2 * window.innerWidth) + 'px'; w.el.style.top = ((1 - _v.y) / 2 * window.innerHeight) + 'px';
      w.el.lastChild.textContent = Math.round(Math.hypot(w.x - player.x, w.y - player.y, w.z - player.z)) + ' m';
    }
  }
}

// ---------------------------------------------------------------- loop
let fpsAcc = 0, fpsN = 0, lastT = performance.now(), fovCur = 75;
function updateChunks(budget) {
  const pcx = Math.floor(player.x / CH), pcz = Math.floor(player.z / CH), rd = settings.rd;
  const need = [];
  for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
    if (dx * dx + dz * dz > rd * rd + 1) continue;
    if (!world.chunks.has(ck(pcx + dx, pcz + dz))) need.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
  }
  need.sort((a, b) => a[2] - b[2]);
  for (let i = 0; i < Math.min(budget, need.length); i++) ensureChunk(need[i][0], need[i][1]);
  let meshed = 0;
  const dirty = [...world.chunks.values()].filter(c => c.dirty).sort((a, b) => ((a.cx - pcx) ** 2 + (a.cz - pcz) ** 2) - ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2));
  for (const c of dirty) { if (meshed >= budget + 2) break; buildMesh(c); c.dirty = false; meshed++; }
  for (const [k, c] of world.chunks) {
    if ((c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 > (rd + 2) ** 2) { if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); } world.chunks.delete(k); }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!started) { renderer.render(scene, camera); return; }
  if (!menuOpen) stepPlayer(dt);
  updateChunks(2);
  // camera
  const tf = zooming ? settings.fov / 4 : settings.fov; fovCur += (tf - fovCur) * Math.min(1, dt * 14);
  if (Math.abs(camera.fov - fovCur) > 0.01) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
  camera.position.set(player.x, player.y + player.eye, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  // highlight
  const h = menuOpen ? null : raycast();
  if (h) { hl.visible = true; hl.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); } else hl.visible = false;
  // remotes
  for (const r of remotes.values()) { r.g.position.x += (r.tx - r.g.position.x) * Math.min(1, dt * 12); r.g.position.y += (r.ty - r.g.position.y) * Math.min(1, dt * 12); r.g.position.z += (r.tz - r.g.position.z) * Math.min(1, dt * 12); r.g.rotation.y = r.yaw; }
  // net
  if (net.on && now - net.last > 80) { net.last = now; net.send({ t: 'pos', x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), yaw: +player.yaw.toFixed(2) }); }
  updateWaypoints();
  // hud
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 0.5) {
    $('m-fps').textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0;
    $('m-pos').textContent = `${player.x.toFixed(1)}, ${player.y.toFixed(1)}, ${player.z.toFixed(1)}`;
    if (net.on) $('net').textContent = `online · ${remotes.size + 1} player${remotes.size ? 's' : ''}`;
  }
  clickTimes = clickTimes.filter(t => now - t < 1000); $('m-cps').textContent = clickTimes.length + ' CPS';
  for (const s of $('m-keys').children) {
    const k = s.dataset.k; s.classList.toggle('on', !!(k === 'w' ? keys.KeyW : k === 'a' ? keys.KeyA : k === 's' ? keys.KeyS : k === 'd' ? keys.KeyD : keys.Space));
  }
  if (!$('hint').hidden && now > hintUntil) $('hint').style.opacity = 0;
  renderer.render(scene, camera);
}
let hintUntil = Infinity;

// ---------------------------------------------------------------- start
async function start(name, server) {
  $('playBtn').disabled = true;
  if (server) {
    const ok = await net.connect(server, name);
    if (!ok) { $('playBtn').disabled = false; toast('Could not connect. Starting solo.'); $('menu').hidden = false; /* fall through to solo */ }
  } else world.seed = Math.floor(Math.random() * 1e6);
  // preload spawn area synchronously
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) ensureChunk(dx, dz);
  for (const c of world.chunks.values()) if (c.dirty) { buildMesh(c); c.dirty = false; }
  let y = WH - 1; while (y > 0 && !getBlock(8, y, 8)) y--;
  player.x = 8.5; player.z = 8.5; player.y = y + 1.01; player.vy = 0;
  $('menu').hidden = true; document.body.classList.remove('title'); $('hud').hidden = false; $('playBtn').disabled = false;
  started = true; applyMods(); buildHotbar(); buildModMenu();
  $('net').hidden = !net.on;
  hintUntil = performance.now() + 7000;
  if (net.on) $('net').textContent = `online · ${remotes.size + 1} player${remotes.size ? 's' : ''}`;
}
$('multiCard').addEventListener('click', () => {
  const show = $('netRow').hidden; $('netRow').hidden = !show; $('netNote').hidden = !show; $('multiCard').classList.toggle('on', show);
  if (show) $('serverInput').focus();
});
$('setCard').addEventListener('click', () => { buildModMenu(); applyMods(); $('modmenu').hidden = false; });
$('startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = ($('nameInput').value.trim() || 'Player').slice(0, 16);
  const multi = e.submitter && e.submitter.dataset.mode === 'multi';
  let server = multi ? $('serverInput').value.trim() : '';
  if (multi && !server) { toast('Enter a server address'); $('serverInput').focus(); return; }
  if (server && !/^wss?:\/\//.test(server)) server = 'ws://' + server;
  start(name, server);
});
requestAnimationFrame(frame);

// idle backdrop: slowly orbiting camera over generated terrain
for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) ensureChunk(dx, dz);
for (const c of world.chunks.values()) { buildMesh(c); c.dirty = false; }
{
  const drift = (t) => { if (!started) { const a = t / 9000; camera.position.set(8 + Math.cos(a) * 18, 52, 8 + Math.sin(a) * 18); camera.lookAt(8, 24, 8); } requestAnimationFrame(drift); };
  requestAnimationFrame(drift);
}

// test hooks
window.__vox = {
  get state() { return { started, x: player.x, y: player.y, z: player.z, fly: player.fly, chunks: world.chunks.size, sel, net: net.on, remotes: remotes.size, seed: world.seed }; },
  getBlock, setBlock, player, raycast,
  lookAtBlock(x, y, z) { const dx = x + 0.5 - player.x, dy = y + 0.5 - (player.y + player.eye), dz = z + 0.5 - player.z; player.yaw = Math.atan2(-dx, -dz); player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); },
};
