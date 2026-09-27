// Real-time tour chat server. Each tour is a "room" keyed by its tour id;
// clients that join the same tour id see each other's messages and presence.
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const MAX_HISTORY = 500;
const MAX_ROOMS = 200; // caps disk use from made-up room codes
const MAX_PAYLOAD = 16 * 1024; // a 4000-char message fits comfortably

function createChatServer({ port = 4455, dataDir } = {}) {
  const historyFile = dataDir ? path.join(dataDir, 'chat-history.json') : null;
  let history = {};
  if (historyFile && fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch {
      history = {};
    }
  }

  let saveTimer = null;
  function persist() {
    if (!historyFile) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.mkdirSync(path.dirname(historyFile), { recursive: true });
      fs.writeFileSync(historyFile, JSON.stringify(history));
    }, 250);
  }

  const wss = new WebSocketServer({ port, maxPayload: MAX_PAYLOAD });
  const rooms = new Map(); // tourId -> Set<ws>

  function send(ws, payload) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
  }

  function broadcast(tourId, payload) {
    for (const client of rooms.get(tourId) || []) send(client, payload);
  }

  function presence(tourId) {
    const members = [...(rooms.get(tourId) || [])].map((c) => c.user);
    broadcast(tourId, { type: 'presence', members });
  }

  function leave(ws) {
    if (!ws.tourId) return;
    const room = rooms.get(ws.tourId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(ws.tourId);
    }
    presence(ws.tourId);
    ws.tourId = null;
  }

  wss.on('connection', (ws) => {
    // Oversized or malformed frames emit 'error'; unhandled, that would crash the host app.
    ws.on('error', () => ws.terminate());
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'join' && typeof msg.tourId === 'string' && msg.tourId.length <= 100) {
        leave(ws);
        ws.tourId = msg.tourId;
        ws.user = String(msg.user || 'Anonymous').slice(0, 60);
        if (!rooms.has(ws.tourId)) rooms.set(ws.tourId, new Set());
        rooms.get(ws.tourId).add(ws);
        send(ws, { type: 'history', messages: history[ws.tourId] || [] });
        presence(ws.tourId);
      } else if (msg.type === 'message' && ws.tourId && typeof msg.text === 'string') {
        const text = msg.text.trim().slice(0, 4000);
        if (!text) return;
        if (!history[ws.tourId] && Object.keys(history).length >= MAX_ROOMS) return;
        const message = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          user: ws.user,
          text,
          channel: typeof msg.channel === 'string' ? msg.channel.slice(0, 40) : 'general',
          sentAt: new Date().toISOString(),
        };
        const list = (history[ws.tourId] = history[ws.tourId] || []);
        list.push(message);
        if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
        persist();
        broadcast(ws.tourId, { type: 'message', message });
      } else if (msg.type === 'typing' && ws.tourId) {
        for (const client of rooms.get(ws.tourId) || []) {
          if (client !== ws) send(client, { type: 'typing', user: ws.user });
        }
      }
    });
    ws.on('close', () => leave(ws));
  });

  return {
    port,
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}

module.exports = { createChatServer };
