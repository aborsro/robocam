const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let pendingOffer = null;
let pendingAnswer = null;
let pendingCandidates = [];

wss.on('connection', ws => {
  console.log('Client connected');

  // Wenn jemand neu verbindet, gleich alles schicken was wir haben:
  if (pendingOffer) {
    ws.send(JSON.stringify({ sdp: pendingOffer }));
  }
  if (pendingAnswer) {
    ws.send(JSON.stringify({ sdp: pendingAnswer }));
  }
  pendingCandidates.forEach(candidate => {
    ws.send(JSON.stringify({ candidate }));
  });

  ws.on('message', msg => {
    const data = JSON.parse(msg);

    if (data.sdp) {
      if (data.sdp.type === 'offer') {
        pendingOffer = data.sdp;
      } else if (data.sdp.type === 'answer') {
        pendingAnswer = data.sdp;
      }
    }
    if (data.candidate) {
      pendingCandidates.push(data.candidate);
    }

    // An alle anderen Clients weiterleiten:
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });
});




server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});