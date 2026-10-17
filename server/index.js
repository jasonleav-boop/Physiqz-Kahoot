const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { db } = require('./db');
const { registerTutor, loginTutor, authenticateToken } = require('./auth');
const quizzesRouter = require('./routes/quizzes');
const sessionsRouter = require('./routes/sessions');
const attendanceRouter = require('./routes/attendance');
const setupSocketHandlers = require('./game/socketHandlers');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// -------------------------------------------------------------
// Authentication Routes
// -------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const result = registerTutor(name, email, password, inviteCode);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const result = loginTutor(email, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const tutor = db.prepare('SELECT id, name, email, is_admin, created_at FROM tutors WHERE id = ?').get(req.tutor.id);
  if (!tutor) {
    return res.status(404).json({ error: 'Tutor not found' });
  }
  const isAdmin = tutor.is_admin || (tutor.email.toLowerCase() === 'jasonleav@gmail.com' ? 1 : 0);
  res.json({ tutor: { ...tutor, is_admin: isAdmin } });
});

// -------------------------------------------------------------
// Admin Tutor Management Routes (Jason Leav / Admin Only)
// -------------------------------------------------------------
const requireAdmin = (req, res, next) => {
  const isAdmin = req.tutor?.is_admin || (req.tutor?.email?.toLowerCase() === 'jasonleav@gmail.com');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  next();
};

app.get('/api/admin/tutors', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tutors = db.prepare('SELECT id, name, email, is_admin, created_at FROM tutors ORDER BY created_at DESC').all();
    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'tutor_invite_code'").get();
    const inviteCode = setting ? setting.value : 'TECHNO-2026';
    res.json({ tutors, inviteCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/invite-code', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Invite code cannot be empty.' });
    }
    const cleanCode = inviteCode.trim().toUpperCase();
    db.prepare("INSERT INTO system_settings (key, value) VALUES ('tutor_invite_code', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
      .run(cleanCode, cleanCode);
    res.json({ success: true, inviteCode: cleanCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/create-tutor', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    const result = registerTutor(name, email, password, null, true);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/admin/tutors/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tutorId = parseInt(req.params.id, 10);
    const target = db.prepare('SELECT id, email FROM tutors WHERE id = ?').get(tutorId);
    if (!target) {
      return res.status(404).json({ error: 'Tutor not found.' });
    }
    if (target.email.toLowerCase() === 'jasonleav@gmail.com') {
      return res.status(400).json({ error: 'Cannot delete primary admin account.' });
    }
    db.prepare('DELETE FROM tutors WHERE id = ?').run(tutorId);
    res.json({ success: true, message: 'Tutor account removed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------
app.use('/api/quizzes', quizzesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/attendance', attendanceRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Server network and host configuration for QR code and mobile student join
const os = require('os');
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/config/server-info', (req, res) => {
  const localIp = getLocalIp();
  const port = process.env.PORT || 5000;
  const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || null;
  res.json({
    localIp,
    port,
    lanUrl: `http://${localIp}:${port}`,
    publicUrl,
    bestJoinUrl: publicUrl || `http://${localIp}:${port}`
  });
});

// -------------------------------------------------------------
// Static Frontend Production Serving
// -------------------------------------------------------------
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Attach real-time game handlers
setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`🚀 Physics Kahoot Platform Server`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`===============================================`);
  });
}

module.exports = { app, server };
