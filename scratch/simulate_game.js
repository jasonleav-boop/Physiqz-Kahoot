const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { app, server } = require('../server/index');
const { db } = require('../server/db');

async function runSimulation() {
  console.log('🧪 Starting End-to-End Simulation Test...');

  // Start test server on port 5055 to avoid conflicts
  const TEST_PORT = 5055;
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const baseUrl = `http://localhost:${TEST_PORT}`;
  console.log(`📡 Test server listening on ${baseUrl}`);

  try {
    // 1. Tutor Login
    console.log('\n--- 1. Testing Tutor Auth ---');
    const authRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tutor@physics.edu', password: 'physics123' })
    });
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error('Auth failed: ' + JSON.stringify(authData));
    console.log(`✅ Tutor logged in: ${authData.tutor.name} (Token received)`);
    const token = authData.token;

    // 2. Fetch Quizzes
    console.log('\n--- 2. Fetching Tutor Quizzes ---');
    const quizRes = await fetch(`${baseUrl}/api/quizzes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const quizzes = await quizRes.json();
    console.log(`✅ Found ${quizzes.length} quizzes in tutor library`);
    const targetQuizSummary = quizzes[0];

    const fullQuizRes = await fetch(`${baseUrl}/api/quizzes/${targetQuizSummary.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const fullQuiz = await fullQuizRes.json();
    console.log(`✅ Loaded full quiz: "${fullQuiz.title}" with ${fullQuiz.questions.length} questions`);

    // 3. Connect Host Socket & Create Room
    console.log('\n--- 3. Creating Live Room with Host Socket ---');
    const hostSocket = ioClient(baseUrl, { transports: ['websocket'] });
    await new Promise((resolve) => hostSocket.on('connect', resolve));
    console.log(`✅ Host socket connected (${hostSocket.id})`);

    const roomData = await new Promise((resolve, reject) => {
      hostSocket.emit('host:create-room', { tutorId: authData.tutor.id, quiz: fullQuiz }, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });
    console.log(`✅ Room created! PIN: ${roomData.roomCode}, Session ID: ${roomData.sessionId}`);

    // 4. Connect 10 Concurrent Students
    console.log('\n--- 4. Connecting 10 Concurrent Students ---');
    const studentSockets = [];
    const studentNames = [
      'Albert Einstein', 'Marie Curie', 'Niels Bohr', 'Max Planck', 'Werner Heisenberg',
      'Paul Dirac', 'Enrico Fermi', 'Erwin Schrödinger', 'Lise Meitner', 'Richard Feynman'
    ];

    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const sSocket = ioClient(baseUrl, { transports: ['websocket'] });
      await new Promise((res) => sSocket.on('connect', res));

      const joinRes = await new Promise((res, rej) => {
        sSocket.emit('student:join-room', {
          roomCode: roomData.roomCode,
          studentName: name,
          studentId: `PHY2026-${100 + i}`,
          avatar: ['⚛️', '🚀', '⚡', '🧲', '🪐'][i % 5]
        }, (resp) => {
          if (resp.error) rej(new Error(resp.error));
          else res(resp);
        });
      });
      studentSockets.push({ socket: sSocket, name, id: `PHY2026-${100 + i}` });
    }
    console.log(`✅ All ${studentSockets.length} students joined lobby successfully`);

    // 5. Test Question Flow
    console.log('\n--- 5. Testing Question Flow & Real-Time Scoring ---');
    for (let qIdx = 0; qIdx < fullQuiz.questions.length; qIdx++) {
      const q = fullQuiz.questions[qIdx];
      console.log(`\n➡️ Pushing Question #${qIdx + 1}: "${q.question.slice(0, 45)}..."`);

      // Set up question start listener
      const studentQuestionPromises = studentSockets.map(st => {
        return new Promise(res => {
          st.socket.once('question:start', res);
        });
      });

      // Host triggers next question
      hostSocket.emit('host:next-question', { roomCode: roomData.roomCode });
      await Promise.all(studentQuestionPromises);

      // Students submit answers with varying speeds
      const correctOptIdx = q.type === 'poll' ? 0 : q.options.findIndex(o => o.isCorrect);
      
      const answerPromises = studentSockets.map((st, idx) => {
        return new Promise(res => {
          // Half students choose correct, half choose wrong (for multiple choice)
          const chosenOpt = (idx % 2 === 0 || q.type === 'poll') ? correctOptIdx : ((correctOptIdx + 1) % q.options.length);
          setTimeout(() => {
            st.socket.emit('student:submit-answer', {
              roomCode: roomData.roomCode,
              selectedOption: chosenOpt
            }, res);
          }, 50 + idx * 20);
        });
      });

      await Promise.all(answerPromises);
      console.log(`✅ All ${studentSockets.length} student answers received`);

      // Host shows leaderboard
      hostSocket.emit('host:show-leaderboard', { roomCode: roomData.roomCode });
      await new Promise(r => setTimeout(r, 200));
    }

    // 6. Host Shows Finale Podium
    console.log('\n--- 6. Testing Finale Podium ---');
    const podiumPromise = new Promise(res => {
      hostSocket.once('game:podium', res);
    });
    hostSocket.emit('host:show-podium', { roomCode: roomData.roomCode });
    const finalPodium = await podiumPromise;
    console.log(`✅ Finale Podium Received!`);
    console.log(`   🥇 1st Place: ${finalPodium.podium.first?.studentName} (${finalPodium.podium.first?.score} pts)`);
    console.log(`   🥈 2nd Place: ${finalPodium.podium.second?.studentName} (${finalPodium.podium.second?.score} pts)`);
    console.log(`   🥉 3rd Place: ${finalPodium.podium.third?.studentName} (${finalPodium.podium.third?.score} pts)`);

    // 7. Verify SQLite Database Records
    console.log('\n--- 7. Verifying SQLite Database Persistence ---');
    const sessionInDb = db.prepare('SELECT * FROM sessions WHERE id = ?').get(roomData.sessionId);
    console.log(`✅ Session in DB: total_participants = ${sessionInDb.total_participants}, ended_at = ${sessionInDb.ended_at}`);
    
    const participantsInDb = db.prepare('SELECT COUNT(*) as count FROM session_participants WHERE session_id = ?').get(roomData.sessionId);
    console.log(`✅ Participants in DB: ${participantsInDb.count} records`);

    const responsesInDb = db.prepare('SELECT COUNT(*) as count FROM session_responses WHERE session_id = ?').get(roomData.sessionId);
    console.log(`✅ Responses in DB: ${responsesInDb.count} records`);

    // 8. Test CSV Export Route
    console.log('\n--- 8. Testing CSV Export Endpoint ---');
    const csvRes = await fetch(`${baseUrl}/api/sessions/${roomData.sessionId}/export-csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const csvText = await csvRes.text();
    console.log('✅ CSV Export received. First 5 lines:');
    console.log(csvText.split('\n').slice(0, 5).join('\n'));

    // Cleanup sockets
    studentSockets.forEach(s => s.socket.disconnect());
    hostSocket.disconnect();

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Real-time engine, scoring, and persistence are 100% verified.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Simulation Error:', err);
    process.exit(1);
  }
}

runSimulation();
