// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// --- Passwortschutz ---
let userPassword = "rr";         // Startpasswort
const MASTER = "zork";           // Masterpasswort

// Body Parser für JSON
app.use(bodyParser.json());

// Statische Dateien ausliefern (z. B. deine index.html in /public)
app.use(express.static("public"));

// --- Login-Route ---
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === userPassword) {
    res.json({ success: true, message: "user" });
  } else if (password === MASTER) {
    res.json({ success: true, message: "master" });
  } else {
    res.json({ success: false });
  }
});

// --- Passwort ändern (nur Master) ---
app.post("/change-password", (req, res) => {
  const { master, newPassword } = req.body;
  if (master === MASTER) {
    userPassword = newPassword;
    console.log("Neues Passwort:", userPassword);
    res.json({ success: true, message: `password changed (${userPassword})` });
  } else {
    res.json({ success: false, message: "just use master password" });
  }
});

// --- HTTP + WebSocket ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentSender = null;

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // --- Registrierung ---
    if (data.type === "register") {
      if (data.role === "sender") {
        if (currentSender && currentSender !== ws) {
          ws.send(JSON.stringify({ type: "error", message: "Sender already active" }));
          ws.send(JSON.stringify({ type: "senderStatus", active: true }));
          return;
        }
        currentSender = ws;
        broadcast({ type: "senderStatus", active: true });
      }
    }

    // --- Sender freigeben ---
    if (data.type === "senderStatus" && data.active === false) {
      if (ws === currentSender) {
        currentSender = null;
        broadcast({ type: "senderStatus", active: false });
      }
    }

    // --- Weiterleitung SDP/ICE ---
    if (data.sdp || data.candidate) {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });

  ws.on("close", () => {
    if (ws === currentSender) {
      currentSender = null;
      broadcast({ type: "senderStatus", active: false });
    }
  });
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

server.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
