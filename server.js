const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Store connected Figma plugins
const plugins = new Map(); // sessionId → ws
// Store pending results
const pending = new Map(); // jobId → { resolve, reject }

// ── WebSocket handler (Figma plugin connects here) ────────────────
wss.on('connection', (ws, req) => {
  const sessionId = crypto.randomUUID();
  plugins.set(sessionId, ws);
  console.log(`[+] Plugin connected: ${sessionId}`);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log(`[plugin → server] type=${msg.type} jobId=${msg.jobId}`);

      if (msg.type === 'result' && pending.has(msg.jobId)) {
        const { resolve, reject } = pending.get(msg.jobId);
        pending.delete(msg.jobId);
        if (msg.success) resolve(msg.text || 'Done');
        else reject(new Error(msg.error || 'Plugin error'));
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      console.error('Bad message from plugin:', e.message);
    }
  });

  ws.on('close', () => {
    plugins.delete(sessionId);
    console.log(`[-] Plugin disconnected: ${sessionId}`);
  });

  // Welcome
  ws.send(JSON.stringify({ type: 'connected', sessionId }));
});

// ── REST API (Claude calls this) ──────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    plugins: plugins.size,
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// Execute code in Figma
app.post('/exec', async (req, res) => {
  const { code, secret } = req.body;

  // Simple auth
  if (secret !== process.env.BRIDGE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  if (plugins.size === 0) {
    return res.status(503).json({ error: 'No Figma plugin connected. Open your file and run the MARY plugin.' });
  }

  // Pick first connected plugin
  const [sessionId, ws] = [...plugins.entries()][0];

  if (ws.readyState !== WebSocket.OPEN) {
    plugins.delete(sessionId);
    return res.status(503).json({ error: 'Plugin disconnected. Reconnect.' });
  }

  const jobId = crypto.randomUUID();

  // Send job to plugin
  ws.send(JSON.stringify({ type: 'exec', jobId, code }));
  console.log(`[server → plugin] jobId=${jobId}`);

  // Wait for result (30s timeout)
  try {
    const result = await new Promise((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      setTimeout(() => {
        if (pending.has(jobId)) {
          pending.delete(jobId);
          reject(new Error('Timeout: plugin did not respond in 30s'));
        }
      }, 30000);
    });
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Status
app.get('/status', (req, res) => {
  res.json({
    plugins: plugins.size,
    sessions: [...plugins.keys()],
    pending: pending.size
  });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`\n🌉 MARY Bridge running on port ${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   REST API:  http://localhost:${PORT}/exec\n`);
});
