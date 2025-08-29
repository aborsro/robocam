const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// --- Passwortschutz ---
let userPassword = "rr";         // Startpasswort
const MASTER = "zork";           // Masterpasswort (nur hier sichtbar!)

// Body Parser für JSON
app.use(bodyParser.json());

// Statische Dateien ausliefern (z.B. deine index.html in /public)
app.use(express.static('public'));

// --- Login-Route ---
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === userPassword) {
    res.json({ success: true, message: "user" });
  } else {
    if (password === MASTER) {
       res.json({ success: true, message: "master" });
     } else {
       res.json({ success: false });
     }
   }
});

// --- Passwort ändern (nur mit Masterpasswort) ---
app.post("/change-password", (req, res) => {
  const { master, newPassword } = req.body;
  if (master === MASTER) {
    userPassword = newPassword;
    console.log(userPassword);
    res.json({ success: true, message: "password changed (" + userPassword + ")"});
  } else {
    res.json({ success: false, message: "just use master password" });
  }
});

// --- WebSocket Setup ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  console.log('Client connected');

  ws.on('message', message => {
    // Forward messages to all other clients
    clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

// --- Server starten ---
server.listen(port, () => {
  console.log(userPassword);
  console.log(`Server running at http://localhost:${port}`);
});
