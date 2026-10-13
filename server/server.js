// Voxlet server: keeps the world seed and block edits, relays player positions.
// Usage: npm install && npm start   (PORT=8080 by default)
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8080;
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 24;
const WORLD_H = 56, REACH = 8;
const seed = +process.env.SEED || Math.floor(Math.random() * 1e6);
const edits = new Map();            // "x,y,z" -> block id
const players = new Map();          // id -> { ws, name, x, y, z, yaw, msgs }
let nextId = 1;

const clean = (s) => String(s || 'Player').replace(/[^\w \-\u00C0-\uFFFF]/g, '').trim().slice(0, 16) || 'Player';
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const broadcast = (o, except) => { const m = JSON.stringify(o); for (const [id, p] of players) if (id !== except && p.ws.readyState === 1) p.ws.send(m); };

const wss = new WebSocketServer({ port: PORT, maxPayload: 1024 });
wss.on('connection', (ws) => {
  let id = 0;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!id) {
      if (m.t !== 'join') return;
      if (players.size >= MAX_PLAYERS) { ws.close(1013, 'full'); return; }
      id = nextId++;
      const p = { ws, name: clean(m.name), x: 8.5, y: 40, z: 8.5, yaw: 0, msgs: 0, window: Date.now() };
      players.set(id, p);
      send(ws, {
        t: 'init', id, seed,
        edits: [...edits].map(([k, b]) => [...k.split(',').map(Number), b]),
        players: [...players].filter(([i]) => i !== id).map(([i, q]) => ({ id: i, name: q.name, x: q.x, y: q.y, z: q.z, yaw: q.yaw })),
      });
      broadcast({ t: 'join', p: { id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: 0 } }, id);
      console.log(`+ ${p.name} (#${id}), ${players.size} online`);
      return;
    }
    const p = players.get(id); if (!p) return;
    // simple rate limit: 60 messages per second
    const now = Date.now(); if (now - p.window > 1000) { p.window = now; p.msgs = 0; } if (++p.msgs > 60) return;
    if (m.t === 'pos') {
      const x = num(m.x, -1e6, 1e6), y = num(m.y, -64, 256), z = num(m.z, -1e6, 1e6), yaw = num(m.yaw, -10, 10);
      if (x === null || y === null || z === null || yaw === null) return;
      Object.assign(p, { x, y, z, yaw }); broadcast({ t: 'pos', id, x, y, z, yaw }, id);
    } else if (m.t === 'block') {
      const x = Number.isInteger(m.x) ? m.x : null, y = Number.isInteger(m.y) ? m.y : null, z = Number.isInteger(m.z) ? m.z : null;
      if (x === null || y === null || z === null || y < 0 || y >= WORLD_H) return;
      if (!Number.isInteger(m.b) || m.b < 0 || m.b > 9) return;
      // must be within reach of the player's last reported position
      if (Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 1.6), z + 0.5 - p.z) > REACH) return;
      edits.set(`${x},${y},${z}`, m.b);
      broadcast({ t: 'block', x, y, z, b: m.b }, id);
    }
  });
  ws.on('close', () => { if (id && players.delete(id)) { broadcast({ t: 'leave', id }); console.log(`- #${id}, ${players.size} online`); } });
  ws.on('error', () => {});
});
console.log(`Voxlet server on ws://localhost:${PORT} (seed ${seed})`);
