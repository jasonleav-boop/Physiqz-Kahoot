const { io } = require('socket.io-client');
const http = require('http');
const { generateToken } = require('../server/auth');

const token = generateToken({ id: 2, email: 'jasonleav@gmail.com', name: 'Jason Leav', is_admin: 1 });

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('1. Starting attendance session via HTTP API...');
  const startRes = await postJson('/api/attendance/sessions', {
    groupId: 11, // I2-GCA-A
    title: 'Recitation - Classical Mechanics',
    passcode: '9988'
  });
  console.log('Session created:', startRes.data);
  const { sessionId, sessionCode } = startRes.data;

  console.log('\n2. Tutor connects socket and joins attendance room...');
  const tutorSocket = io('http://localhost:5000', { transports: ['websocket'] });
  
  await new Promise((resolve) => {
    tutorSocket.on('connect', () => {
      console.log('Tutor socket connected:', tutorSocket.id);
      tutorSocket.emit('attendance:join-room', { sessionCode });
      resolve();
    });
  });

  let studentCheckedInReceived = false;
  tutorSocket.on('attendance:student-checked-in', ({ student, stats }) => {
    console.log('✅ Tutor projector received real-time student check-in event:');
    console.log(`   Student: ${student.name} (${student.student_code}), Status: ${student.status}, Present: ${stats.present}/${stats.total}`);
    studentCheckedInReceived = true;
  });

  console.log('\n3. Student connects socket and emits check-in with Student ID e20250539 (BI JACKY)...');
  const studentSocket = io('http://localhost:5000', { transports: ['websocket'] });
  
  await new Promise((resolve) => {
    studentSocket.on('connect', () => {
      console.log('Student socket connected:', studentSocket.id);
      studentSocket.emit('attendance:student-checkin', {
        sessionCode,
        studentId: 'e20250539',
        passcode: '9988'
      }, (res) => {
        console.log('Student check-in callback response:', res);
        resolve();
      });
    });
  });

  // Wait 1 second for event propagation
  await new Promise(r => setTimeout(r, 1000));
  console.log('Did tutor screen receive event?', studentCheckedInReceived ? 'YES! ✅' : 'NO ❌');

  tutorSocket.disconnect();
  studentSocket.disconnect();
  console.log('Test completed successfully.');
}

run().catch(console.error);
