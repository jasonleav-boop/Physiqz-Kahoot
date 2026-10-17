const { db } = require('../server/db');

const tutors = db.prepare("SELECT id, name, email FROM tutors").all();
for (const t of tutors) {
  const classes = db.prepare(`
    SELECT DISTINCT g.code as group_code, g.year_level, a.subject, a.class_type, COUNT(DISTINCT a.id) as session_count
    FROM attendance_sessions a
    JOIN class_groups g ON g.id = a.group_id
    WHERE a.tutor_id = ?
    GROUP BY g.code, a.subject, a.class_type
  `).all(t.id);
  console.log(t.name, "Classes Handled:", classes);
}
