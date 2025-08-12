const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

// Statische Dateien aus /public liefern
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Rooms Map: roomId -> Set of clients
const rooms = new Map();

wss.on('connection', ws => {
  ws.roomId = null;
  ws.role = null;

  ws.on('message', message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      console.warn('Ungültige Nachricht:', message);
      return;
    }

    if (data.type === 'register' && data.role && data.roomId) {
      ws.role = data.role;
      ws.roomId = data.roomId;

      if (!rooms.has(ws.roomId)) {
        rooms.set(ws.roomId, new Set());
      }
      rooms.get(ws.roomId).add(ws);

      console.log(`Client registered as ${ws.role} in room ${ws.roomId}`);

      // Informiere andere in room über readiness
      if (ws.role === 'receiver') {
        rooms.get(ws.roomId).forEach(client => {
          if (client !== ws && client.role === 'sender') {
            client.send(JSON.stringify({ type: 'receiver-ready' }));
          }
        });
      }
      return;
    }

    // Signaling Daten (SDP, ICE) weiterleiten an andere in room
    if (ws.roomId) {
      const others = rooms.get(ws.roomId);
      if (!others) return;

      others.forEach(client => {
        if (client !== ws) {
          client.send(message);
        }
      });
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).delete(ws);
      if (rooms.get(ws.roomId).size === 0) {
        rooms.delete(ws.roomId);
      }
    }
    console.log(`Client disconnected from room ${ws.roomId}`);
  });
});

server.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
