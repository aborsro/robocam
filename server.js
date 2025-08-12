const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3000;

// --- einfache statische Auslieferung ---
const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.svg': 'application/image/svg+xml'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// --- WebSocket Signalling ---
const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomId: { sender: ws, receiver: ws } }

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentRole = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'register') {
        const { roomId, role } = data;
        currentRoom = roomId;
        currentRole = role;

        if (!rooms[roomId]) rooms[roomId] = {};
        rooms[roomId][role] = ws;

        ws.send(JSON.stringify({ type: 'registered', roomId, role }));

        if (role === 'sender' && rooms[roomId].receiver) {
          rooms[roomId].receiver.send(JSON.stringify({ type: 'sender_ready' }));
        }
        if (role === 'receiver' && rooms[roomId].sender) {
          ws.send(JSON.stringify({ type: 'sender_ready' }));
        }
        return;
      }

      // sdp / ice weiterleiten
      if (currentRoom && rooms[currentRoom]) {
        const targetRole = currentRole === 'sender' ? 'receiver' : 'sender';
        const target = rooms[currentRoom][targetRole];
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error('Error parsing message', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentRole && rooms[currentRoom]) {
      rooms[currentRoom][currentRole] = null;
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket signalling active on ws://localhost:${PORT}`);
});
