const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- Master-Passwort ---
const MASTER = "zork";   // nur hier sichtbar!

// --- User-Passwort persistent speichern ---
let userPassword = "rr"; // Fallback
const pwFile = "password.json";

// Passwort aus Datei laden (falls vorhanden)
try {
  const data = fs.readFileSync(pwFile, "utf8");
  const parsed = JSON.parse(data);
  if (parsed.userPassword) {
    userPassword = parsed.userPassword;
    console.log("Loaded user password:", userPassword);
  }
} catch (e) {
  console.log("No password.json found, using default:", userPassword);
}

// Body Parser für JSON
app.use(bodyParser.json());

// Statische Dateien ausliefern (z.B. index.html in /public)
app.use(express.static('public'));

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

// --- Passwort ändern (nur mit Masterpasswort) ---
app.post("/change-password", (req, res) => {
  const { master, newPassword } = req.body;
  if (master === MASTER) {
    userPassword = newPassword;

    // --- Speichern in JSON-Datei ---
    fs.writeFileSync(pwFile, JSON.stringify({ userPassword }, null, 2));

    console.log("Password changed:", userPassword);
    res.json({ success: true, message: "password changed (" + userPassword + ")" });
  } else {
    res.json({ success: false, message: "just use master password" });
  }
});

app.get("/get-master-password", (req, res) => {
  // Optional: nur Master anzeigen, evtl. Absicherung
  res.json({ password: userPassword });
});


// --- WebSocket Setup ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let currentSender = null;

wss.on("connection", ws => {
  ws.on("message", message => {
    let data;
    try { data = JSON.parse(message); } catch { return; }

    // --- Receiver READY Sync ---
    if (data.type === "receiverReady") {
      console.log("receiverReady received");
    
      if (currentSender && currentSender.readyState === WebSocket.OPEN) {
        currentSender.send(JSON.stringify({ type: "receiverReady" }));
      }
      return;
    }
	
    if (data.type === "register") {
      if (data.role === "sender") {
        if (currentSender && currentSender !== ws) {
          // Ablehnen
          ws.send(JSON.stringify({ type: "error", message: "Sender already active" }));
          ws.send(JSON.stringify({ type: "senderStatus", active: true }));
          return;
        }
        currentSender = ws;
        broadcast({ type: "senderStatus", active: true });
      }
    }

    if (data.type === "senderStatus" && data.active === false) {
      if (ws === currentSender) {
        currentSender = null;
        broadcast({ type: "senderStatus", active: false });
      }
    }

    // Weiterleitung von SDP/ICE
    if (data.sdp || data.candidate) {
      wss.clients.forEach(client => {
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
	if (ws !== currentSender) {
      if (currentSender && currentSender.readyState === WebSocket.OPEN) {
         currentSender.send(JSON.stringify({ type: "receiverGone" }));
      }
    }
  });
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// --- Server starten ---
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
