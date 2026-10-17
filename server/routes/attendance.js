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
        g.year_level,
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
// 3a. Add a single student to a class group
// -------------------------------------------------------------
router.post('/groups/:id/students', authenticateToken, (req, res) => {
  try {
    const groupId = req.params.id;
    const { studentId, name, sex = 'M', studentNumber } = req.body;

    if (!studentId || !name) {
      return res.status(400).json({ error: 'Student ID and Name are required.' });
    }

    const cleanId = studentId.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanSex = (sex || 'M').trim().toUpperCase();

    const group = db.prepare('SELECT id FROM class_groups WHERE id = ?').get(groupId);
    if (!group) return res.status(404).json({ error: 'Class group not found.' });

    const existing = db.prepare('SELECT id FROM students WHERE group_id = ? AND LOWER(student_id) = ?').get(groupId, cleanId);
    if (existing) {
      return res.status(400).json({ error: `Student with ID ${cleanId} already exists in this group.` });
    }

    let num = studentNumber ? parseInt(studentNumber, 10) : null;
    if (!num) {
      const maxNum = db.prepare('SELECT MAX(student_number) as max_num FROM students WHERE group_id = ?').get(groupId);
      num = (maxNum?.max_num || 0) + 1;
    }

    const result = db.prepare(`
      INSERT INTO students (group_id, student_number, student_id, name, sex)
      VALUES (?, ?, ?, ?, ?)
    `).run(groupId, num, cleanId, cleanName, cleanSex);

    res.status(201).json({
      id: result.lastInsertRowid,
      group_id: parseInt(groupId, 10),
      student_number: num,
      student_id: cleanId,
      name: cleanName,
      sex: cleanSex
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3b. Edit an existing student
// -------------------------------------------------------------
router.put('/students/:id', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.id;
    const { studentId: newStudentCode, name, sex, studentNumber } = req.body;

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const cleanCode = newStudentCode ? newStudentCode.trim().toLowerCase() : student.student_id;
    const cleanName = name ? name.trim() : student.name;
    const cleanSex = sex ? sex.trim().toUpperCase() : student.sex;
    const num = studentNumber !== undefined ? parseInt(studentNumber, 10) : student.student_number;

    db.prepare(`
      UPDATE students 
      SET student_id = ?, name = ?, sex = ?, student_number = ?
      WHERE id = ?
    `).run(cleanCode, cleanName, cleanSex, num, studentId);

    res.json({
      id: parseInt(studentId, 10),
      group_id: student.group_id,
      student_number: num,
      student_id: cleanCode,
      name: cleanName,
      sex: cleanSex
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3c. Remove student from group
// -------------------------------------------------------------
router.delete('/students/:id', authenticateToken, (req, res) => {
  try {
    const studentId = req.params.id;
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
    res.json({ success: true, message: `Removed student ${student.name} (${student.student_id})` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3d. Batch import students (paste CSV/Excel rows)
// -------------------------------------------------------------
router.post('/groups/:id/batch-import', authenticateToken, (req, res) => {
  try {
    const groupId = req.params.id;
    const { rawText, mode = 'append' } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Please provide CSV or Excel rows to import.' });
    }

    const group = db.prepare('SELECT * FROM class_groups WHERE id = ?').get(groupId);
    if (!group) return res.status(404).json({ error: 'Class group not found.' });

    const lines = rawText.trim().split(/\r?\n/);
    const parsedStudents = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('no') || trimmed.toLowerCase().startsWith('id')) continue;

      let parts = trimmed.includes('\t') 
        ? trimmed.split('\t').map(s => s.trim()) 
        : trimmed.split(',').map(s => s.trim().replace(/^"|"$/g, ''));

      parts = parts.filter(s => s.length > 0);

      const idIdx = parts.findIndex(p => /^e\d+$/i.test(p));
      if (idIdx !== -1) {
        const studentNumber = parseInt(parts[idIdx - 1], 10) || null;
        const studentId = parts[idIdx].toLowerCase();
        const studentName = parts[idIdx + 1];
        const sex = (parts[idIdx + 2] || 'M').toUpperCase();
        if (studentName) {
          parsedStudents.push({ studentNumber, studentId, studentName, sex });
        }
      } else if (parts.length >= 2) {
        const studentId = parts[0].toLowerCase();
        const studentName = parts[1];
        const sex = (parts[2] || 'M').toUpperCase();
        parsedStudents.push({ studentNumber: null, studentId, studentName, sex });
      }
    }

    if (parsedStudents.length === 0) {
      return res.status(400).json({ error: 'No valid student records found. Ensure rows have ID (e.g. e2025XXXX) and Name.' });
    }

    const importTx = db.transaction(() => {
      if (mode === 'replace') {
        db.prepare('DELETE FROM students WHERE group_id = ?').run(groupId);
      }

      const upsert = db.prepare(`
        INSERT INTO students (group_id, student_number, student_id, name, sex)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(group_id, student_id) DO UPDATE SET
          name = excluded.name,
          sex = excluded.sex,
          student_number = COALESCE(excluded.student_number, students.student_number)
      `);

      let nextNum = (db.prepare('SELECT MAX(student_number) as m FROM students WHERE group_id = ?').get(groupId)?.m || 0) + 1;

      for (const s of parsedStudents) {
        const num = s.studentNumber || nextNum++;
        upsert.run(groupId, num, s.studentId, s.studentName, s.sex);
      }
    });

    importTx();

    res.json({
      success: true,
      message: `Successfully processed ${parsedStudents.length} student records.`,
      count: parsedStudents.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Start a new attendance session for a group
// -------------------------------------------------------------
router.post('/sessions', authenticateToken, (req, res) => {
  try {
    const { 
      groupId, 
      title = 'Class Attendance', 
      passcode = '',
      subject = 'Electricity',
      classType = 'TD'
    } = req.body;
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
        INSERT INTO attendance_sessions (group_id, tutor_id, session_code, title, date, passcode, is_active, subject, class_type)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(groupId, tutorId, sessionCode, title.trim(), today, passcode ? passcode.trim() : null, subject.trim(), classType.trim());

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
      subject,
      classType,
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
      `"Matière: ${session.subject || 'Electricity'} | Type: ${session.class_type || 'TD'} | Enseignant: ${session.tutor_name || ''}",,,`,
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
    const safeSubject = (session.subject || 'Physics').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `ITC_Attendance_${session.group_code}_${safeSubject}_${session.class_type || 'TD'}_${session.date || 'Session'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvContent); // BOM for proper UTF-8 Excel rendering
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 12. Quick Add student during live session
// -------------------------------------------------------------
router.post('/sessions/:id/quick-add-student', authenticateToken, (req, res) => {
  try {
    const sessionId = req.params.id;
    const { studentId, name, sex = 'M' } = req.body;

    if (!studentId || !name) {
      return res.status(400).json({ error: 'Student ID and Name are required.' });
    }

    const session = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const cleanId = studentId.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanSex = (sex || 'M').trim().toUpperCase();

    let student = db.prepare('SELECT * FROM students WHERE group_id = ? AND LOWER(student_id) = ?').get(session.group_id, cleanId);
    if (!student) {
      const maxNum = db.prepare('SELECT MAX(student_number) as m FROM students WHERE group_id = ?').get(session.group_id)?.m || 0;
      const resStudent = db.prepare(`
        INSERT INTO students (group_id, student_number, student_id, name, sex)
        VALUES (?, ?, ?, ?, ?)
      `).run(session.group_id, maxNum + 1, cleanId, cleanName, cleanSex);

      student = {
        id: resStudent.lastInsertRowid,
        group_id: session.group_id,
        student_number: maxNum + 1,
        student_id: cleanId,
        name: cleanName,
        sex: cleanSex
      };
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
      VALUES (?, ?, 'PRESENT', ?, 'MANUAL')
      ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
        status = 'PRESENT',
        check_in_time = ?,
        method = 'MANUAL'
    `).run(sessionId, student.id, now, now);

    res.status(201).json({
      success: true,
      student: {
        student_id: student.id,
        student_number: student.student_number,
        student_code: student.student_id,
        name: student.name,
        sex: student.sex,
        status: 'PRESENT',
        check_in_time: now,
        method: 'MANUAL'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 13. Cohort Batch Import (e.g. all Year 1 classes or updated Year 2)
// -------------------------------------------------------------
router.post('/cohort-import', authenticateToken, (req, res) => {
  try {
    const { rawText, yearLevel = 'I1', department = 'Département de Tronc Commun', academicYear = '2026-2027' } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Roster text is required.' });
    }

    const lines = rawText.split(/\r?\n/);
    const insertGroup = db.prepare(`
      INSERT OR IGNORE INTO class_groups (code, department, academic_year, year_level)
      VALUES (?, ?, ?, ?)
    `);
    const insertStudent = db.prepare(`
      INSERT OR IGNORE INTO students (group_id, student_number, student_id, name, sex)
      VALUES (?, ?, ?, ?, ?)
    `);
    const getGroup = db.prepare('SELECT id FROM class_groups WHERE code = ?');

    let groupsCreated = 0;
    let studentsAdded = 0;

    const cohortTx = db.transaction(() => {
      let currentGroupId = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check if line is a section header like "LISTE D'ABSENT DU GROUPE I1-GCA-A"
        const groupMatch = trimmed.match(/(?:LISTE D['’]ABSENT DU GROUPE|GROUPE:?)\s+([A-Za-z0-9\-]+)/i);
        if (groupMatch) {
          const groupCode = groupMatch[1].trim().toUpperCase();
          const info = insertGroup.run(groupCode, department, academicYear, yearLevel);
          if (info.changes > 0) groupsCreated++;
          currentGroupId = getGroup.get(groupCode)?.id;
          continue;
        }

        let parts = trimmed.includes('\t') 
          ? trimmed.split('\t').map(s => s.trim()) 
          : trimmed.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        parts = parts.filter(s => s.length > 0);

        // Check if row begins with a group code (e.g. "I1-GCA-A", "I1-GCI-1")
        if (parts.length >= 3 && /^[A-Za-z0-9]+-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)?$/i.test(parts[0])) {
          const groupCode = parts[0].trim().toUpperCase();
          const info = insertGroup.run(groupCode, department, academicYear, yearLevel);
          if (info.changes > 0) groupsCreated++;
          currentGroupId = getGroup.get(groupCode)?.id;
        }

        if (currentGroupId) {
          const idIdx = parts.findIndex(p => /^e\d+$/i.test(p));
          if (idIdx !== -1) {
            const studentNumber = parseInt(parts[idIdx - 1], 10) || null;
            const studentId = parts[idIdx].toLowerCase();
            const studentName = parts[idIdx + 1];
            const sex = (parts[idIdx + 2] || 'M').toUpperCase();
            if (studentName) {
              const resSt = insertStudent.run(currentGroupId, studentNumber, studentId, studentName, sex);
              if (resSt.changes > 0) studentsAdded++;
            }
          }
        }
      }
    });

    cohortTx();

    res.json({
      success: true,
      message: `Cohort import completed: ${groupsCreated} groups created, ${studentsAdded} students imported.`,
      groupsCreated,
      studentsAdded
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
