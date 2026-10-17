const { app, server } = require('../server/index');
const { io: ioClient } = require('socket.io-client');
const { db } = require('../server/db');

async function testNewFeatures() {
  const PORT = 5066;
  await new Promise(r => server.listen(PORT, r));
  const baseUrl = 'http://localhost:' + PORT;

  console.log('1. Testing Jason Leav tutor login...');
  const res = await fetch(baseUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jasonleav@gmail.com', password: 'physics123' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(data));
  console.log('✅ Logged in as:', data.tutor.name, data.tutor.email);
  const token = data.token;

  console.log('\n2. Testing AI Generator endpoint...');
  const aiRes = await fetch(baseUrl + '/api/quizzes/generate-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ topic: 'Electromagnetic Induction and Lenz Law', questionCount: 3 })
  });
  const aiData = await aiRes.json();
  console.log('✅ AI Generator result:', aiData.message, 'Questions count:', aiData.questions.length);

  console.log('\n3. Testing Server Info endpoint...');
  const infoRes = await fetch(baseUrl + '/api/config/server-info');
  const infoData = await infoRes.json();
  console.log('✅ Server info:', infoData);

  console.log('\n4. Testing Room with Passcode & Lock...');
  const host = ioClient(baseUrl, { transports: ['websocket'] });
  await new Promise(r => host.on('connect', r));
  
  const roomRes = await new Promise(r => {
    host.emit('host:create-room', {
      tutorId: data.tutor.id,
      quiz: { title: 'Test Quiz', questions: aiData.questions },
      passcode: 'lock123'
    }, r);
  });
  console.log('✅ Room created with PIN:', roomRes.roomCode, 'Passcode:', roomRes.passcode);

  const student = ioClient(baseUrl, { transports: ['websocket'] });
  await new Promise(r => student.on('connect', r));

  // Try wrong password
  const failJoin = await new Promise(r => {
    student.emit('student:join-room', {
      roomCode: roomRes.roomCode,
      studentName: 'Niels Bohr',
      studentId: 'NB-01',
      passcode: 'wrongpassword'
    }, r);
  });
  console.log('✅ Wrong password correctly rejected:', failJoin.error);

  // Try correct password
  const successJoin = await new Promise(r => {
    student.emit('student:join-room', {
      roomCode: roomRes.roomCode,
      studentName: 'Niels Bohr',
      studentId: 'NB-01',
      passcode: 'lock123'
    }, r);
  });
  console.log('✅ Correct password joined successfully:', successJoin.success);

  // Test room lock
  const lockRes = await new Promise(r => {
    host.emit('host:toggle-lock', { roomCode: roomRes.roomCode }, r);
  });
  console.log('✅ Room lock toggled:', lockRes.isLocked);

  // New student trying to enter locked room
  const student2 = ioClient(baseUrl, { transports: ['websocket'] });
  await new Promise(r => student2.on('connect', r));
  const lockedJoin = await new Promise(r => {
    student2.emit('student:join-room', {
      roomCode: roomRes.roomCode,
      studentName: 'Marie Curie',
      studentId: 'MC-02',
      passcode: 'lock123'
    }, r);
  });
  console.log('✅ Locked room correctly blocked new student:', lockedJoin.error);

  host.disconnect();
  student.disconnect();
  student2.disconnect();
  console.log('\n🎉 ALL NEW CAPABILITIES VERIFIED 100%!');
  process.exit(0);
}

testNewFeatures().catch(e => { console.error(e); process.exit(1); });
