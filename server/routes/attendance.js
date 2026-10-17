const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken } = require('../auth');

// Helper to generate unique 6-character session code (e.g. ATT-3829)
function generateAttendanceCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// -------------------------------------------------------------
// 1. Get all class groups (with student counts)
// -------------------------------------------------------------
router.get('/groups', authenticateToken, (req, res) => {
  try {
    const groups = db.prepare(`
      SELECT 
        g.id,
        g.code,
        g.department,
        g.academic_year,
        COUNT(s.id) as student_count,
        (
          SELECT MAX(created_at) 
          FROM attendance_sessions 
          WHERE group_id = g.id
        ) as last_attendance_at
      FROM class_groups g
      LEFT JOIN students s ON s.group_id = g.id
      GROUP BY g.id
      ORDER BY g.code ASC
    `).all();

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 2. Get single class group with students
// -------------------------------------------------------------
router.get('/groups/:id', authenticateToken, (req, res) => {
  try {
    const group = db.prepare('SELECT * FROM class_groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Class group not found.' });
    }

    const students = db.prepare(`
      SELECT id, group_id, student_number, student_id, name, sex 
      FROM students 
      WHERE group_id = ? 
      ORDER BY COALESCE(student_number, 9999) ASC, name ASC
    `).all(req.params.id);

    const pastSessions = db.prepare(`
      SELECT id, session_code, title, date, is_active, created_at, ended_at,
        (SELECT COUNT(*) FROM attendance_records WHERE attendance_session_id = attendance_sessions.id AND status = 'PRESENT') as present_count,
        (SELECT COUNT(*) FROM attendance_records WHERE attendance_session_id = attendance_sessions.id) as total_count
      FROM attendance_sessions
      WHERE group_id = ?
      ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ group, students, pastSessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Create a new class group
// -------------------------------------------------------------
router.post('/groups', authenticateToken, (req, res) => {
  try {
    const { code, department = 'Département de Tronc Commun', academicYear = '2026-2027' } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Group code is required (e.g. I2-GCA-A).' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = db.prepare('SELECT id FROM class_groups WHERE code = ?').get(cleanCode);
    if (existing) {
      return res.status(400).json({ error: `Group ${cleanCode} already exists.` });
    }

    const result = db.prepare(`
      INSERT INTO class_groups (code, department, academic_year)
      VALUES (?, ?, ?)
    `).run(cleanCode, department.trim(), academicYear.trim());

    res.status(201).json({ id: result.lastInsertRowid, code: cleanCode, department, academic_year: academicYear });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Start a new attendance session for a group
// -------------------------------------------------------------
router.post('/sessions', authenticateToken, (req, res) => {
  try {
    const { groupId, title = 'Class Attendance', passcode = '' } = req.body;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required.' });
    }

    const group = db.prepare('SELECT * FROM class_groups WHERE id = ?').get(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Class group not found.' });
    }

    // Generate unique session code
    let sessionCode = generateAttendanceCode();
    while (db.prepare('SELECT id FROM attendance_sessions WHERE session_code = ?').get(sessionCode)) {
      sessionCode = generateAttendanceCode();
    }

    const today = new Date().toISOString().split('T')[0];
    const tutorId = req.tutor.id;

    const startTransaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO attendance_sessions (group_id, tutor_id, session_code, title, date, passcode, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(groupId, tutorId, sessionCode, title.trim(), today, passcode ? passcode.trim() : null);

      const sessionId = result.lastInsertRowid;

      // Initialize all students in group as ABSENT
      const students = db.prepare('SELECT id FROM students WHERE group_id = ?').all(groupId);
      const insertRecord = db.prepare(`
        INSERT INTO attendance_records (attendance_session_id, student_id, status, method)
        VALUES (?, ?, 'ABSENT', 'MANUAL')
      `);

      for (const s of students) {
        insertRecord.run(sessionId, s.id);
      }

      return sessionId;
    });

    const sessionId = startTransaction();

    res.status(201).json({
      sessionId,
      sessionCode,
      groupCode: group.code,
      department: group.department,
      title,
      date: today,
      passcode: passcode || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Get Attendance Session details & live roster
// -------------------------------------------------------------
router.get('/sessions/:id', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT 
        s.*,
        g.code as group_code,
        g.department,
        g.academic_year,
        t.name as tutor_name
      FROM attendance_sessions s
      JOIN class_groups g ON g.id = s.group_id
      JOIN tutors t ON t.id = s.tutor_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found.' });
    }

    const roster = db.prepare(`
      SELECT 
        st.id as student_id,
        st.student_number,
        st.student_id as student_code,
        st.name,
        st.sex,
        COALESCE(ar.status, 'ABSENT') as status,
        ar.check_in_time,
        ar.method
      FROM students st
      LEFT JOIN attendance_records ar 
        ON ar.student_id = st.id AND ar.attendance_session_id = ?
      WHERE st.group_id = ?
      ORDER BY COALESCE(st.student_number, 9999) ASC, st.name ASC
    `).all(session.id, session.group_id);

    const stats = {
      total: roster.length,
      present: roster.filter(r => r.status === 'PRESENT').length,
      absent: roster.filter(r => r.status === 'ABSENT').length,
      late: roster.filter(r => r.status === 'LATE').length,
      excused: roster.filter(r => r.status === 'EXCUSED').length
    };

    res.json({ session, roster, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Public Lookup: Student mobile view checks session by code
// -------------------------------------------------------------
router.get('/lookup/:code', (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const session = db.prepare(`
      SELECT 
        s.id,
        s.session_code,
        s.title,
        s.date,
        s.is_active,
        s.passcode,
        g.id as group_id,
        g.code as group_code,
        g.department,
        g.academic_year
      FROM attendance_sessions s
      JOIN class_groups g ON g.id = s.group_id
      WHERE UPPER(s.session_code) = ?
    `).get(code);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found. Please verify the code.' });
    }

    if (!session.is_active) {
      return res.status(400).json({ error: 'This attendance session has ended.' });
    }

    // List of students in group for quick search / auto-complete
    const students = db.prepare(`
      SELECT id, student_number, student_id, name, sex
      FROM students
      WHERE group_id = ?
      ORDER BY name ASC
    `).all(session.group_id);

    res.json({
      sessionId: session.id,
      sessionCode: session.session_code,
      title: session.title,
      date: session.date,
      groupCode: session.group_code,
      department: session.department,
      academicYear: session.academic_year,
      requiresPasscode: !!session.passcode,
      students
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Student Check-in via API (also handled via Socket)
// -------------------------------------------------------------
router.post('/checkin', (req, res) => {
  try {
    const { sessionCode, studentId, passcode } = req.body;
    if (!sessionCode || !studentId) {
      return res.status(400).json({ error: 'Session code and Student ID are required.' });
    }

    const cleanCode = sessionCode.trim().toUpperCase();
    const cleanStudentId = studentId.trim().toLowerCase();

    const session = db.prepare(`
      SELECT * FROM attendance_sessions WHERE UPPER(session_code) = ?
    `).get(cleanCode);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (!session.is_active) {
      return res.status(400).json({ error: 'Attendance session is closed.' });
    }

    if (session.passcode && session.passcode.trim() !== (passcode || '').trim()) {
      return res.status(400).json({ error: 'Invalid room security passcode.' });
    }

    const student = db.prepare(`
      SELECT * FROM students WHERE group_id = ? AND LOWER(student_id) = ?
    `).get(session.group_id, cleanStudentId);

    if (!student) {
      return res.status(404).json({ error: `Student ID "${cleanStudentId}" was not found in this class roster.` });
    }

    // Upsert record as PRESENT
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
      VALUES (?, ?, 'PRESENT', ?, 'QR')
      ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
        status = 'PRESENT',
        check_in_time = ?,
        method = 'QR'
    `).run(session.id, student.id, now, now);

    res.json({
      success: true,
      message: `Checked in successfully: ${student.name}`,
      student: {
        id: student.id,
        studentNumber: student.student_number,
        studentId: student.student_id,
        name: student.name,
        sex: student.sex,
        checkInTime: now
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Tutor Manual Record Toggle (Present / Absent / Late / Excused)
// -------------------------------------------------------------
router.patch('/sessions/:id/records/:studentId', authenticateToken, (req, res) => {
  try {
    const { status = 'PRESENT' } = req.body;
    const sessionId = req.params.id;
    const studentId = req.params.studentId;

    const allowed = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (!allowed.includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
      VALUES (?, ?, ?, ?, 'MANUAL')
      ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
        status = ?,
        check_in_time = ?,
        method = 'MANUAL'
    `).run(sessionId, studentId, status.toUpperCase(), now, status.toUpperCase(), now);

    res.json({ success: true, status: status.toUpperCase() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Tutor: Mark All as Present or Reset All to Absent
// -------------------------------------------------------------
router.post('/sessions/:id/mark-all', authenticateToken, (req, res) => {
  try {
    const { status = 'PRESENT' } = req.body;
    const sessionId = req.params.id;

    const session = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const students = db.prepare('SELECT id FROM students WHERE group_id = ?').all(session.group_id);
    const now = new Date().toISOString();

    const markTransaction = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
        VALUES (?, ?, ?, ?, 'MANUAL')
        ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
          status = ?,
          check_in_time = ?,
          method = 'MANUAL'
      `);
      for (const s of students) {
        upsert.run(sessionId, s.id, status.toUpperCase(), now, status.toUpperCase(), now);
      }
    });

    markTransaction();

    res.json({ success: true, message: `All students marked as ${status.toUpperCase()}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 10. Close Attendance Session
// -------------------------------------------------------------
router.post('/sessions/:id/close', authenticateToken, (req, res) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE attendance_sessions 
      SET is_active = 0, ended_at = ?
      WHERE id = ?
    `).run(now, req.params.id);

    res.json({ success: true, message: 'Attendance session closed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 11. Export Official ITC Attendance Sheet (CSV)
// -------------------------------------------------------------
router.get('/sessions/:id/export-itc-csv', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT 
        s.*,
        g.code as group_code,
        g.department,
        g.academic_year
      FROM attendance_sessions s
      JOIN class_groups g ON g.id = s.group_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found.' });
    }

    const roster = db.prepare(`
      SELECT 
        st.student_number,
        st.student_id,
        st.name,
        st.sex,
        COALESCE(ar.status, 'ABSENT') as status
      FROM students st
      LEFT JOIN attendance_records ar 
        ON ar.student_id = st.id AND ar.attendance_session_id = ?
      WHERE st.group_id = ?
      ORDER BY COALESCE(st.student_number, 9999) ASC, st.name ASC
    `).all(session.id, session.group_id);

    // Format identical to ITC Department of Tronc Commun template:
    // INSTITUT DE TECHNOLOGIE DU CAMBODGE,,,
    // Département de Tronc Commun,,,
    // "LISTE D'ABSENT DU GROUPE {code}, Anné {year}",,,
    // No,ID,Noms,Sexe,{date}
    const lines = [
      'INSTITUT DE TECHNOLOGIE DU CAMBODGE,,,',
      `${session.department || 'Département de Tronc Commun'},,,`,
      `"LISTE D'ABSENT DU GROUPE ${session.group_code}, Anné ${session.academic_year || '2026-2027'}",,,`,
      `No,ID,Noms,Sexe,${session.date || 'Attendance'}`
    ];

    roster.forEach((r, idx) => {
      const num = r.student_number || (idx + 1);
      // Status display: P (Present), A (Absent), L (Late), E (Excused)
      let statusCode = 'A';
      if (r.status === 'PRESENT') statusCode = 'P';
      else if (r.status === 'LATE') statusCode = 'L';
      else if (r.status === 'EXCUSED') statusCode = 'E';

      lines.push(`${num},${r.student_id},"${r.name}",${r.sex},${statusCode}`);
    });

    const csvContent = lines.join('\n');
    const filename = `ITC_Attendance_${session.group_code}_${session.date || 'Session'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // BOM for proper UTF-8 Excel rendering
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
