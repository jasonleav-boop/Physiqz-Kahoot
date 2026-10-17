const fs = require('fs');
const path = require('path');

function parseAndSeedRoster(db) {
  const groupCount = db.prepare('SELECT count(*) as count FROM class_groups').get().count;
  if (groupCount > 0) {
    return; // Already seeded
  }

  const csvPath = path.join(__dirname, 'data', 'itc_students_raw.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('No raw roster CSV found at', csvPath);
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/);

  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO class_groups (code, department, academic_year)
    VALUES (?, ?, ?)
  `);

  const insertStudent = db.prepare(`
    INSERT OR IGNORE INTO students (group_id, student_number, student_id, name, sex)
    VALUES (?, ?, ?, ?, ?)
  `);

  const getGroup = db.prepare('SELECT id FROM class_groups WHERE code = ?');

  const seedTransaction = db.transaction(() => {
    let currentGroupCode = null;
    let currentGroupId = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const groupMatch = line.match(/LISTE D['’]ABSENT DU GROUPE\s+([A-Za-z0-9\-]+)/i);
      if (groupMatch) {
        currentGroupCode = groupMatch[1].trim().toUpperCase();
        insertGroup.run(currentGroupCode, 'Département de Tronc Commun', '2026-2027');
        currentGroupId = getGroup.get(currentGroupCode).id;
        continue;
      }

      if (currentGroupId) {
        const parts = line.split(',').map(s => s.trim()).filter(s => s.length > 0);
        const idIdx = parts.findIndex(p => /^e\d+$/i.test(p));
        if (idIdx !== -1) {
          const studentNumber = parseInt(parts[idIdx - 1], 10) || null;
          const studentId = parts[idIdx].toLowerCase();
          const studentName = parts[idIdx + 1];
          const sex = (parts[idIdx + 2] || 'M').toUpperCase();
          if (studentName) {
            insertStudent.run(currentGroupId, studentNumber, studentId, studentName, sex);
          }
        }
      }
    }
  });

  seedTransaction();
  const finalGroupCount = db.prepare('SELECT count(*) as count FROM class_groups').get().count;
  const finalStudentCount = db.prepare('SELECT count(*) as count FROM students').get().count;
  console.log(`✅ Successfully seeded ITC student roster: ${finalGroupCount} groups, ${finalStudentCount} students.`);
}

module.exports = { parseAndSeedRoster };
