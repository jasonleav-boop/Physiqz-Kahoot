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
// Admin & Lead Lecturer Management Routes
// -------------------------------------------------------------
const requireAdmin = (req, res, next) => {
  const isAdmin = req.tutor?.is_admin || req.tutor?.role === 'admin' || (req.tutor?.email?.toLowerCase() === 'jasonleav@gmail.com');
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  next();
};

const requireLeadOrAdmin = (req, res, next) => {
  const isAuthorized = req.tutor?.is_admin ||
    req.tutor?.role === 'admin' ||
    req.tutor?.role === 'lead' ||
    (req.tutor?.email?.toLowerCase() === 'jasonleav@gmail.com');
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Lead Lecturer or Admin privileges required.' });
  }
  next();
};

app.get('/api/admin/tutors', authenticateToken, requireLeadOrAdmin, (req, res) => {
  try {
    const tutors = db.prepare('SELECT id, name, email, is_admin, role, assigned_classes, created_at FROM tutors ORDER BY created_at DESC').all();

    // Enrich each tutor with real progress metrics and classes handled
    const enrichedTutors = tutors.map(t => {
      const quizStats = db.prepare(`
        SELECT COUNT(*) as total_quizzes,
               SUM(CASE WHEN is_shared = 1 THEN 1 ELSE 0 END) as shared_quizzes
        FROM quizzes WHERE tutor_id = ?
      `).get(t.id);

      const sessionStats = db.prepare(`
        SELECT COUNT(*) as total_sessions,
               COALESCE(SUM(total_participants), 0) as total_students,
               MAX(started_at) as last_session_at
        FROM sessions WHERE tutor_id = ?
      `).get(t.id);

      const attendanceStats = db.prepare(`
        SELECT COUNT(*) as total_attendance_sessions,
               MAX(created_at) as last_attendance_at
        FROM attendance_sessions WHERE tutor_id = ?
      `).get(t.id);

      // Distinct classes handled (both explicit assignments and recorded teaching)
      const explicitAssignments = db.prepare(`
        SELECT g.id as group_id, g.code as group_code, g.year_level, tca.subject, tca.class_type,
               (SELECT COUNT(DISTINCT a.id) FROM attendance_sessions a WHERE a.tutor_id = tca.tutor_id AND a.group_id = g.id AND a.subject = tca.subject AND a.class_type = tca.class_type) as session_count,
               (SELECT COUNT(*) FROM students st WHERE st.group_id = g.id) as student_count,
               1 as is_assigned
        FROM tutor_class_assignments tca
        JOIN class_groups g ON g.id = tca.group_id
        WHERE tca.tutor_id = ?
        ORDER BY g.code ASC
      `).all(t.id);

      const recordedClasses = db.prepare(`
        SELECT DISTINCT g.id as group_id, g.code as group_code, g.year_level, a.subject, a.class_type,
               COUNT(DISTINCT a.id) as session_count,
               (SELECT COUNT(*) FROM students st WHERE st.group_id = g.id) as student_count,
               0 as is_assigned
        FROM attendance_sessions a
        JOIN class_groups g ON g.id = a.group_id
        WHERE a.tutor_id = ?
        GROUP BY g.code, a.subject, a.class_type
        ORDER BY g.code ASC
      `).all(t.id);

      const seenKeys = new Set();
      const combinedClasses = [];
      for (const item of [...explicitAssignments, ...recordedClasses]) {
        const key = `${item.group_code}:::${item.subject}:::${item.class_type}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combinedClasses.push(item);
        }
      }

      return {
        ...t,
        classesHandled: combinedClasses,
        stats: {
          totalQuizzes: quizStats.total_quizzes || 0,
          sharedQuizzes: quizStats.shared_quizzes || 0,
          totalSessions: sessionStats.total_sessions || 0,
          totalStudents: sessionStats.total_students || 0,
          totalAttendanceSessions: attendanceStats.total_attendance_sessions || 0,
          lastActive: sessionStats.last_session_at || attendanceStats.last_attendance_at || t.created_at
        }
      };
    });

    const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'tutor_invite_code'").get();
    const inviteCode = setting ? setting.value : 'TECHNO-2026';
    res.json({ tutors: enrichedTutors, inviteCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all class groups and their assignment status for a given subject & class type
app.get('/api/admin/class-assignments', authenticateToken, requireLeadOrAdmin, (req, res) => {
  try {
    const { subject = 'Electricity', classType = 'TD', tutorId } = req.query;
    const targetTutorId = tutorId ? parseInt(tutorId, 10) : null;

    const groups = db.prepare(`
      SELECT g.id, g.code, g.year_level, g.department,
             COUNT(s.id) as student_count,
             tca.id as assignment_id,
             tca.tutor_id as assigned_tutor_id,
             t.name as assigned_tutor_name,
             t.email as assigned_tutor_email
      FROM class_groups g
      LEFT JOIN students s ON s.group_id = g.id
      LEFT JOIN tutor_class_assignments tca ON tca.group_id = g.id AND tca.subject = ? AND tca.class_type = ?
      LEFT JOIN tutors t ON t.id = tca.tutor_id
      GROUP BY g.id
      ORDER BY g.code ASC
    `).all(subject, classType);

    const mapped = groups.map(g => ({
      id: g.id,
      code: g.code,
      year_level: g.year_level,
      department: g.department,
      student_count: g.student_count || 0,
      assignedTutorId: g.assigned_tutor_id,
      assignedTutorName: g.assigned_tutor_name,
      assignedTutorEmail: g.assigned_tutor_email,
      isAssigned: !!g.assigned_tutor_id,
      isAssignedToCurrent: targetTutorId ? g.assigned_tutor_id === targetTutorId : false,
      isTakenByOther: targetTutorId ? (!!g.assigned_tutor_id && g.assigned_tutor_id !== targetTutorId) : !!g.assigned_tutor_id
    }));

    res.json({
      subject,
      classType,
      targetTutorId,
      groups: mapped
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST assign classes to a tutor with conflict transfer and auto summary regeneration
app.post('/api/admin/tutors/:id/assign-classes', authenticateToken, requireLeadOrAdmin, (req, res) => {
  try {
    const tutorId = parseInt(req.params.id, 10);
    const { subject = 'Electricity', classType = 'TD', selectedGroupIds = [], academicYear = '2026-2027' } = req.body;

    const tutor = db.prepare('SELECT id, name FROM tutors WHERE id = ?').get(tutorId);
    if (!tutor) return res.status(404).json({ error: 'Tutor not found.' });

    const cleanGroupIds = Array.isArray(selectedGroupIds) ? selectedGroupIds.map(id => parseInt(id, 10)).filter(Boolean) : [];

    const tx = db.transaction(() => {
      // 1. Delete groups for this tutor in this subject/classType that are no longer selected
      if (cleanGroupIds.length > 0) {
        const placeholders = cleanGroupIds.map(() => '?').join(',');
        db.prepare(`
          DELETE FROM tutor_class_assignments 
          WHERE tutor_id = ? AND subject = ? AND class_type = ? AND group_id NOT IN (${placeholders})
        `).run(tutorId, subject, classType, ...cleanGroupIds);
      } else {
        db.prepare(`
          DELETE FROM tutor_class_assignments 
          WHERE tutor_id = ? AND subject = ? AND class_type = ?
        `).run(tutorId, subject, classType);
      }

      // 2. Upsert selected groups (transfers group if previously assigned to another tutor)
      const upsert = db.prepare(`
        INSERT INTO tutor_class_assignments (tutor_id, group_id, subject, class_type, academic_year)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(group_id, subject, class_type) DO UPDATE SET
          tutor_id = excluded.tutor_id,
          academic_year = excluded.academic_year
      `);

      for (const gid of cleanGroupIds) {
        upsert.run(tutorId, gid, subject, classType, academicYear);
      }

      // 3. Helper to rebuild assigned_classes text summary
      const updateTutorSummary = (tid) => {
        const allAssignments = db.prepare(`
          SELECT g.code, tca.subject, tca.class_type
          FROM tutor_class_assignments tca
          JOIN class_groups g ON g.id = tca.group_id
          WHERE tca.tutor_id = ?
          ORDER BY tca.subject, tca.class_type, g.code
        `).all(tid);

        const grouped = {};
        for (const a of allAssignments) {
          const key = `${a.subject} (${a.class_type})`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(a.code);
        }

        const summary = Object.entries(grouped)
          .map(([course, codes]) => `${codes.join(', ')} [${course}]`)
          .join(' • ');

        db.prepare('UPDATE tutors SET assigned_classes = ? WHERE id = ?').run(summary, tid);
        return summary;
      };

      const mySummary = updateTutorSummary(tutorId);

      // Also refresh summary for any other tutors who had groups re-assigned
      const otherTutors = db.prepare('SELECT id FROM tutors WHERE id != ?').all(tutorId);
      for (const ot of otherTutors) {
        updateTutorSummary(ot.id);
      }

      return mySummary;
    });

    const assignedClasses = tx();

    res.json({
      success: true,
      assignedClasses,
      message: `Successfully updated class assignments for ${tutor.name}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/tutors/:id/assigned-classes', authenticateToken, requireLeadOrAdmin, (req, res) => {
  try {
    const tutorId = parseInt(req.params.id, 10);
    const { assignedClasses } = req.body;
    db.prepare('UPDATE tutors SET assigned_classes = ? WHERE id = ?')
      .run(assignedClasses ? String(assignedClasses).trim() : '', tutorId);
    res.json({ success: true, message: 'Assigned classes updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full reports breakdown for a specific tutor (Live Quiz sessions, Attendance records, Quizzes authored)
app.get('/api/admin/tutors/:id/full-reports', authenticateToken, requireLeadOrAdmin, (req, res) => {
  try {
    const tutorId = parseInt(req.params.id, 10);
    const tutor = db.prepare('SELECT id, name, email, role, is_admin, assigned_classes, created_at FROM tutors WHERE id = ?').get(tutorId);
    if (!tutor) return res.status(404).json({ error: 'Tutor not found.' });

    // 1. Live Quiz sessions
    const quizSessions = db.prepare(`
      SELECT s.id, s.room_code, s.quiz_title, s.started_at, s.ended_at, s.total_participants,
             COUNT(sp.id) as roster_count,
             AVG(sp.score) as average_score
      FROM sessions s
      LEFT JOIN session_participants sp ON sp.session_id = s.id
      WHERE s.tutor_id = ?
      GROUP BY s.id
      ORDER BY s.started_at DESC
    `).all(tutorId);

    // 2. Attendance sessions
    const attendanceSessions = db.prepare(`
      SELECT s.id, s.session_code, s.title, s.date, s.subject, s.class_type, s.created_at,
             g.code as group_code, g.year_level,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'PRESENT') as present_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'ABSENT') as absent_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'LATE') as late_count,
             (SELECT COUNT(*) FROM attendance_records ar WHERE ar.attendance_session_id = s.id AND ar.status = 'EXCUSED') as excused_count,
             (SELECT COUNT(*) FROM students st WHERE st.group_id = s.group_id) as total_students
      FROM attendance_sessions s
      JOIN class_groups g ON g.id = s.group_id
      WHERE s.tutor_id = ?
      ORDER BY s.created_at DESC
    `).all(tutorId);

    // 3. Authored Quizzes
    const quizzes = db.prepare(`
      SELECT id, title, topic, subject, class_type, share_code, is_shared, created_at, updated_at
      FROM quizzes
      WHERE tutor_id = ?
      ORDER BY updated_at DESC
    `).all(tutorId).map(q => {
      const full = db.prepare('SELECT questions_json FROM quizzes WHERE id = ?').get(q.id);
      let count = 0;
      try { count = JSON.parse(full.questions_json).length; } catch (e) {}
      return { ...q, questionCount: count };
    });

    res.json({
      tutor,
      quizSessions,
      attendanceSessions,
      quizzes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/tutors/:id/role', authenticateToken, requireAdmin, (req, res) => {
  try {
    const tutorId = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (!['admin', 'lead', 'tutor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin, lead, or tutor.' });
    }
    const target = db.prepare('SELECT id, email FROM tutors WHERE id = ?').get(tutorId);
    if (!target) {
      return res.status(404).json({ error: 'Tutor not found.' });
    }
    if (target.email.toLowerCase() === 'jasonleav@gmail.com' && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change primary administrator role.' });
    }
    const isAdmin = role === 'admin' ? 1 : 0;
    db.prepare('UPDATE tutors SET role = ?, is_admin = ? WHERE id = ?').run(role, isAdmin, tutorId);
    res.json({ success: true, message: `Tutor role updated to ${role}.` });
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
