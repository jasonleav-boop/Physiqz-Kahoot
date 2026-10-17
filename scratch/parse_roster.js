const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'server', 'data', 'itc_students_raw.csv');
const content = fs.readFileSync(csvPath, 'utf8');

const lines = content.split(/\r?\n/);

const groups = [];
let currentGroup = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Check if line contains group header, e.g. "LISTE D'ABSENT DU GROUPE I2-GCI-A , Anné 2026-2027"
  const groupMatch = line.match(/LISTE D['’]ABSENT DU GROUPE\s+([A-Za-z0-9\-]+)/i);
  if (groupMatch) {
    const groupCode = groupMatch[1].trim();
    currentGroup = {
      code: groupCode,
      department: 'Département de Tronc Commun',
      year: '2026-2027',
      students: []
    };
    groups.push(currentGroup);
    continue;
  }

  // Check for student row
  // e.g. 1,e20251115,AM RADO,M
  // or ,1,e20250752,BAN DALIN,F
  // or  ,1,e20240073,HUY VIPOU,M
  if (currentGroup) {
    // Strip leading/trailing commas and whitespace
    const parts = line.split(',').map(s => s.trim()).filter(s => s.length > 0);
    // Looking for [No, ID, Name, Sex]
    // ID usually matches e\d+ or similar student id
    if (parts.length >= 3) {
      // Find where student id is
      const idIdx = parts.findIndex(p => /^e\d+$/i.test(p));
      if (idIdx !== -1) {
        const studentNumber = parseInt(parts[idIdx - 1], 10) || (currentGroup.students.length + 1);
        const studentId = parts[idIdx];
        const studentName = parts[idIdx + 1];
        const sex = parts[idIdx + 2] || 'M';
        if (studentName) {
          currentGroup.students.push({
            studentNumber,
            studentId,
            name: studentName,
            sex: sex.toUpperCase()
          });
        }
      }
    }
  }
}

console.log(`Total Groups Extracted: ${groups.length}`);
let totalStudents = 0;
groups.forEach(g => {
  totalStudents += g.students.length;
  console.log(`- ${g.code}: ${g.students.length} students`);
});
console.log(`Total Students: ${totalStudents}`);
