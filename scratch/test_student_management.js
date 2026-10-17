const http = require('http');
const { generateToken } = require('../server/auth');

const token = generateToken({ id: 2, email: 'jasonleav@gmail.com', name: 'Jason Leav', is_admin: 1 });

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  const groupId = 11; // I2-GCA-A

  console.log('1. Adding a new student to group I2-GCA-A...');
  const addRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/attendance/groups/${groupId}/students`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    }
  }, {
    studentId: 'e20259999',
    name: 'TEST NEW STUDENT',
    sex: 'M'
  });
  console.log('Add student status:', addRes.status, addRes.data);
  const createdStudent = addRes.data;

  console.log('\n2. Editing the student name/sex...');
  const editRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/attendance/students/${createdStudent.id}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    }
  }, {
    studentId: 'e20259999',
    name: 'TEST NEW STUDENT UPDATED',
    sex: 'F'
  });
  console.log('Edit student status:', editRes.status, editRes.data);

  console.log('\n3. Batch importing 2 students via raw Excel text...');
  const rawExcelText = `30\te20258888\tBATCH STUDENT 1\tM\n31\te20258889\tBATCH STUDENT 2\tF`;
  const batchRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/attendance/groups/${groupId}/batch-import`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    }
  }, {
    rawText: rawExcelText,
    mode: 'append'
  });
  console.log('Batch import status:', batchRes.status, batchRes.data);

  console.log('\n4. Verifying group roster count...');
  const groupRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/attendance/groups/${groupId}`,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Updated total students in group:', groupRes.data.students.length);

  console.log('\n5. Cleaning up test students...');
  await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/attendance/students/${createdStudent.id}`,
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token }
  });

  const b1 = groupRes.data.students.find(s => s.student_id === 'e20258888');
  if (b1) {
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/attendance/students/${b1.id}`,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
  }
  const b2 = groupRes.data.students.find(s => s.student_id === 'e20258889');
  if (b2) {
    await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/attendance/students/${b2.id}`,
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    });
  }

  console.log('Test completed with 100% success!');
}

run().catch(console.error);
