const roomManager = require('./roomManager');
const { db } = require('../db');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // ---------------------------------------------------------
    // Host / Presenter Handlers
    // ---------------------------------------------------------

    // Host creates a live session room
    socket.on('host:create-room', ({ tutorId, quiz, passcode, mode, totalTimeMinutes }, callback) => {
      try {
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
          return callback({ error: 'Quiz must have at least one question.' });
        }

        const room = roomManager.createRoom(tutorId, socket.id, quiz, passcode, mode, totalTimeMinutes);
        socket.join(room.roomCode);
        socket.join(`host:${room.roomCode}`);

        callback({
          success: true,
          roomCode: room.roomCode,
          sessionId: room.sessionId,
          quizTitle: quiz.title,
          passcode: room.passcode,
          isLocked: room.isLocked,
          mode: room.mode,
          totalTimeMinutes: room.totalTimeMinutes,
          totalDurationSeconds: room.totalDurationSeconds,
          totalQuestions: quiz.questions.length
        });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    // Host toggles room lock
    socket.on('host:toggle-lock', ({ roomCode }, callback) => {
      const cleanCode = String(roomCode).replace(/\s+/g, '');
      const isLocked = roomManager.toggleLock(cleanCode);
      io.to(`host:${cleanCode}`).emit('host:lock-status', { isLocked });
      if (callback) callback({ isLocked });
    });

    // Host kicks a participant
    socket.on('host:kick-player', ({ roomCode, targetSocketId }) => {
      const kicked = roomManager.kickStudent(roomCode, targetSocketId);
      if (kicked) {
        io.to(targetSocketId).emit('player:kicked', { message: 'You have been removed from the session.' });
        const room = roomManager.getRoom(roomCode);
        if (room) {
          io.to(`host:${roomCode}`).emit('host:roster-update', {
            participants: Array.from(room.participants.values()),
            totalCount: room.participants.size
          });
        }
      }
    });

    // Helper to start timer for a question
    const startQuestionTimer = (room) => {
      if (room.timerInterval) {
        clearInterval(room.timerInterval);
      }

      room.timerInterval = setInterval(() => {
        room.timeRemaining -= 1;
        io.to(room.roomCode).emit('timer:tick', { timeRemaining: room.timeRemaining });

        if (room.timeRemaining <= 0) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
          handleReveal(room.roomCode);
        }
      }, 1000);
    };

    // Helper to handle answer reveal
    const handleReveal = (roomCode) => {
      const revealData = roomManager.revealQuestion(roomCode);
      if (!revealData) return;

      const { room, correctOptionIndex, explanation, distribution, totalAnswered, totalParticipants } = revealData;

      // Broadcast reveal to everyone
      io.to(roomCode).emit('question:reveal', {
        correctOptionIndex,
        explanation,
        distribution,
        totalAnswered,
        totalParticipants
      });

      // Send individual personalized results to each student
      const leaderboard = roomManager.getLeaderboard(roomCode, 1000);
      room.participants.forEach((participant, studentSocketId) => {
        const lastAnswer = participant.answers[room.currentQuestionIndex];
        const studentRankData = leaderboard.allRankings.find(p => p.socketId === studentSocketId);
        
        io.to(studentSocketId).emit('student:round-result', {
          isCorrect: lastAnswer ? lastAnswer.isCorrect : false,
          pointsAwarded: lastAnswer ? lastAnswer.points : 0,
          newTotalScore: participant.score,
          streak: participant.streak,
          rank: studentRankData ? studentRankData.rank : 1,
          totalStudents: room.participants.size
        });
      });
    };

    // Host pushes next question
    socket.on('host:next-question', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const nextIndex = room.currentQuestionIndex + 1;
      if (nextIndex >= room.quiz.questions.length) {
        // All questions done -> show podium
        const podiumData = roomManager.finishGame(roomCode);
        io.to(roomCode).emit('game:podium', podiumData);
        return;
      }

      roomManager.startQuestion(roomCode, nextIndex);
      const q = room.quiz.questions[nextIndex];

      // Sanitized student version of options (hide isCorrect)
      const studentOptions = q.options.map((opt, i) => ({
        index: i,
        text: opt.text
      }));

      // Host receives full data
      io.to(`host:${roomCode}`).emit('question:start', {
        questionIndex: nextIndex,
        totalQuestions: room.quiz.questions.length,
        question: q.question,
        type: q.type,
        imageUrl: q.imageUrl,
        options: q.options,
        timeLimit: room.timeLimit,
        points: q.points || 1000,
        explanation: q.explanation || ''
      });

      // Students receive sanitized options
      socket.to(roomCode).emit('question:start', {
        questionIndex: nextIndex,
        totalQuestions: room.quiz.questions.length,
        question: q.question,
        type: q.type,
        imageUrl: q.imageUrl,
        options: studentOptions,
        timeLimit: room.timeLimit,
        points: q.points || 1000
      });

      startQuestionTimer(room);
    });

    // Host manually ends question early
    socket.on('host:end-question', ({ roomCode }) => {
      handleReveal(roomCode);
    });

    // Host shows leaderboard
    socket.on('host:show-leaderboard', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const leaderboard = roomManager.getLeaderboard(roomCode, 5);
      io.to(roomCode).emit('leaderboard:update', {
        topList: leaderboard.topList,
        totalParticipants: room.participants.size
      });
    });

    // Helper to finish self-paced session
    const handleSelfPacedFinish = (roomCode) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const results = roomManager.finishSelfPacedSession(roomCode);
      if (!results) return;

      // Broadcast podium & results to everyone
      io.to(roomCode).emit('game:podium', results);

      // Send personalized scorecard to each student
      room.participants.forEach((participant, studentSocketId) => {
        const studentRank = results.allRankings.find(p => p.socketId === studentSocketId);
        io.to(studentSocketId).emit('self-paced:student-results', {
          score: participant.score,
          correctCount: participant.correctCount,
          totalQuestions: room.quiz.questions.length,
          rank: studentRank ? studentRank.rank : 1,
          totalStudents: room.participants.size,
          answers: participant.answers
        });
      });
    };

    // Host starts self-paced problem set session
    socket.on('host:start-self-paced', ({ roomCode }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const sessionData = roomManager.startSelfPacedSession(roomCode);
      if (!sessionData) return;

      // Notify host screen
      io.to(`host:${roomCode}`).emit('self-paced:started', {
        totalDurationSeconds: sessionData.totalDurationSeconds,
        totalQuestions: sessionData.totalQuestions,
        quizTitle: sessionData.quizTitle,
        roster: roomManager.getSelfPacedProgress(roomCode)
      });

      // Broadcast full problem set to students (sanitized)
      io.to(roomCode).emit('self-paced:student-start', {
        questions: sessionData.sanitizedQuestions,
        totalDurationSeconds: sessionData.totalDurationSeconds,
        quizTitle: sessionData.quizTitle,
        totalQuestions: sessionData.totalQuestions
      });

      // Start global countdown timer
      if (room.timerInterval) clearInterval(room.timerInterval);
      room.timerInterval = setInterval(() => {
        room.timeRemaining -= 1;
        io.to(roomCode).emit('timer:tick', { timeRemaining: room.timeRemaining });

        if (room.timeRemaining <= 0) {
          clearInterval(room.timerInterval);
          room.timerInterval = null;
          handleSelfPacedFinish(roomCode);
        }
      }, 1000);
    });

    // Host manually ends self-paced activity early
    socket.on('host:end-self-paced', ({ roomCode }) => {
      handleSelfPacedFinish(roomCode);
    });

    // Host shows podium finale
    socket.on('host:show-podium', ({ roomCode }) => {
      const podiumData = roomManager.finishGame(roomCode);
      if (podiumData) {
        io.to(roomCode).emit('game:podium', podiumData);
      }
    });

    // ---------------------------------------------------------
    // Student Handlers
    // ---------------------------------------------------------

    // Student joins room
    socket.on('student:join-room', ({ roomCode, studentName, studentId, avatar, passcode }, callback) => {
      try {
        const cleanCode = String(roomCode).replace(/\s+/g, '');
        const { room, participant, isRejoin } = roomManager.joinRoom(cleanCode, socket.id, studentName, studentId, avatar, passcode);

        socket.join(room.roomCode);

        // Notify presenter screen
        io.to(`host:${room.roomCode}`).emit('host:roster-update', {
          participants: Array.from(room.participants.values()),
          totalCount: room.participants.size
        });

        // Send current session state to student
        callback({
          success: true,
          roomCode: room.roomCode,
          quizTitle: room.quiz.title,
          gameState: room.state,
          mode: room.mode,
          participant: {
            studentName: participant.studentName,
            studentId: participant.studentId,
            avatar: participant.avatar,
            score: participant.score,
            streak: participant.streak
          },
          currentQuestion: room.state === 'QUESTION' ? {
            questionIndex: room.currentQuestionIndex,
            totalQuestions: room.quiz.questions.length,
            question: room.quiz.questions[room.currentQuestionIndex].question,
            type: room.quiz.questions[room.currentQuestionIndex].type,
            imageUrl: room.quiz.questions[room.currentQuestionIndex].imageUrl,
            points: room.quiz.questions[room.currentQuestionIndex].points || 10,
            options: room.quiz.questions[room.currentQuestionIndex].options.map((opt, i) => ({
              index: i,
              text: opt.text
            })),
            timeRemaining: room.timeRemaining
          } : null,
          selfPacedData: room.state === 'SELF_PACED_ACTIVE' ? {
            questions: room.quiz.questions.map((q, idx) => ({
              index: idx,
              type: q.type || 'multiple_choice',
              question: q.question,
              imageUrl: q.imageUrl || null,
              points: Number(q.points) || 10,
              options: (q.options || []).map(opt => ({ text: opt.text }))
            })),
            timeRemaining: room.timeRemaining,
            totalDurationSeconds: room.totalDurationSeconds,
            existingAnswers: participant.answers || {},
            isSubmitted: !!participant.isSubmitted
          } : null
        });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    // Student submits answer in Lecturer-Paced mode
    socket.on('student:submit-answer', ({ roomCode, selectedOption }, callback) => {
      const cleanCode = String(roomCode).replace(/\s+/g, '');
      const result = roomManager.submitAnswer(cleanCode, socket.id, selectedOption);

      if (result.error) {
        return callback && callback({ error: result.error });
      }

      if (callback) {
        callback({
          success: true,
          answerRecord: result.answerRecord
        });
      }

      // Notify presenter with updated live tally
      const room = roomManager.getRoom(cleanCode);
      if (room) {
        io.to(`host:${cleanCode}`).emit('host:live-answers-update', {
          totalAnswered: result.totalAnswered,
          totalParticipants: result.totalParticipants,
          distribution: room.currentDistribution
        });
      }

      // If every student has answered, reveal early!
      if (result.allAnswered) {
        handleReveal(cleanCode);
      }
    });

    // Student updates an answer in Student-Paced mode
    socket.on('student:update-self-paced-answer', ({ roomCode, questionIndex, selectedOption }, callback) => {
      const cleanCode = String(roomCode).replace(/\s+/g, '');
      const res = roomManager.updateSelfPacedAnswer(cleanCode, socket.id, questionIndex, selectedOption);
      if (res && res.success) {
        const progress = roomManager.getSelfPacedProgress(cleanCode);
        if (progress) {
          io.to(`host:${cleanCode}`).emit('host:self-paced-progress', progress);
        }
        if (callback) callback({ success: true, answeredCount: res.answeredCount });
      } else if (callback) {
        callback({ error: res?.error || 'Failed to record answer' });
      }
    });

    // Student submits entire self-paced problem set
    socket.on('student:submit-self-paced', ({ roomCode }, callback) => {
      const cleanCode = String(roomCode).replace(/\s+/g, '');
      const res = roomManager.submitSelfPacedStudent(cleanCode, socket.id);
      if (res && res.success) {
        const progress = roomManager.getSelfPacedProgress(cleanCode);
        if (progress) {
          io.to(`host:${cleanCode}`).emit('host:self-paced-progress', progress);
          if (progress.submittedCount >= progress.totalParticipants && progress.totalParticipants > 0) {
            io.to(`host:${cleanCode}`).emit('host:all-submitted', { submittedCount: progress.submittedCount });
          }
        }
        if (callback) callback({ success: true, isSubmitted: true });
      } else if (callback) {
        callback({ error: res?.error || 'Failed to submit' });
      }
    });

    // ---------------------------------------------------------
    // Attendance Live Socket Handlers
    // ---------------------------------------------------------
    socket.on('attendance:join-room', ({ sessionCode }) => {
      if (sessionCode) {
        const cleanCode = String(sessionCode).trim().toUpperCase();
        socket.join(`attendance:${cleanCode}`);
      }
    });

    socket.on('attendance:student-checkin', ({ sessionCode, studentId, passcode }, callback) => {
      try {
        if (!sessionCode || !studentId) {
          return callback && callback({ error: 'Session code and Student ID are required.' });
        }
        const cleanCode = String(sessionCode).trim().toUpperCase();
        const cleanStudentId = String(studentId).trim().toLowerCase();

        const session = db.prepare('SELECT * FROM attendance_sessions WHERE UPPER(session_code) = ?').get(cleanCode);
        if (!session) {
          return callback && callback({ error: 'Attendance session not found.' });
        }
        if (!session.is_active) {
          return callback && callback({ error: 'This attendance session is closed.' });
        }
        if (session.passcode && session.passcode.trim() !== String(passcode || '').trim()) {
          return callback && callback({ error: 'Invalid room security passcode.' });
        }

        const student = db.prepare('SELECT * FROM students WHERE group_id = ? AND LOWER(student_id) = ?').get(session.group_id, cleanStudentId);
        if (!student) {
          return callback && callback({ error: `Student ID "${cleanStudentId}" not found in this class roster.` });
        }

        const now = new Date().toISOString();
        db.prepare(`
          INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
          VALUES (?, ?, 'PRESENT', ?, 'QR')
          ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
            status = 'PRESENT',
            check_in_time = ?,
            method = 'QR'
        `).run(session.id, student.id, now, now);

        // Fetch updated stats
        const records = db.prepare('SELECT status FROM attendance_records WHERE attendance_session_id = ?').all(session.id);
        const stats = {
          total: records.length,
          present: records.filter(r => r.status === 'PRESENT').length,
          absent: records.filter(r => r.status === 'ABSENT').length,
          late: records.filter(r => r.status === 'LATE').length,
          excused: records.filter(r => r.status === 'EXCUSED').length
        };

        const studentPayload = {
          student_id: student.id,
          student_number: student.student_number,
          student_code: student.student_id,
          name: student.name,
          sex: student.sex,
          status: 'PRESENT',
          check_in_time: now,
          method: 'QR'
        };

        io.to(`attendance:${cleanCode}`).emit('attendance:student-checked-in', {
          student: studentPayload,
          stats
        });

        if (callback) {
          callback({ success: true, student: studentPayload });
        }
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('attendance:tutor-toggle', ({ sessionCode, sessionId, studentId, status }, callback) => {
      try {
        const cleanCode = String(sessionCode).trim().toUpperCase();
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
          VALUES (?, ?, ?, ?, 'MANUAL')
          ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
            status = ?,
            check_in_time = ?,
            method = 'MANUAL'
        `).run(sessionId, studentId, status, now, status, now);

        const records = db.prepare('SELECT status FROM attendance_records WHERE attendance_session_id = ?').all(sessionId);
        const stats = {
          total: records.length,
          present: records.filter(r => r.status === 'PRESENT').length,
          absent: records.filter(r => r.status === 'ABSENT').length,
          late: records.filter(r => r.status === 'LATE').length,
          excused: records.filter(r => r.status === 'EXCUSED').length
        };

        io.to(`attendance:${cleanCode}`).emit('attendance:record-updated', {
          studentId,
          status,
          stats
        });

        if (callback) callback({ success: true, stats });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('attendance:mark-all', ({ sessionCode, sessionId, status }, callback) => {
      try {
        const cleanCode = String(sessionCode).trim().toUpperCase();
        const session = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(sessionId);
        if (!session) return callback && callback({ error: 'Session not found' });

        const students = db.prepare('SELECT id FROM students WHERE group_id = ?').all(session.group_id);
        const now = new Date().toISOString();

        const markTx = db.transaction(() => {
          const upsert = db.prepare(`
            INSERT INTO attendance_records (attendance_session_id, student_id, status, check_in_time, method)
            VALUES (?, ?, ?, ?, 'MANUAL')
            ON CONFLICT(attendance_session_id, student_id) DO UPDATE SET
              status = ?,
              check_in_time = ?,
              method = 'MANUAL'
          `);
          for (const s of students) {
            upsert.run(sessionId, s.id, status, now, status, now);
          }
        });
        markTx();

        const records = db.prepare('SELECT status FROM attendance_records WHERE attendance_session_id = ?').all(sessionId);
        const stats = {
          total: records.length,
          present: records.filter(r => r.status === 'PRESENT').length,
          absent: records.filter(r => r.status === 'ABSENT').length,
          late: records.filter(r => r.status === 'LATE').length,
          excused: records.filter(r => r.status === 'EXCUSED').length
        };

        io.to(`attendance:${cleanCode}`).emit('attendance:bulk-updated', {
          status,
          stats
        });

        if (callback) callback({ success: true, stats });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // ---------------------------------------------------------
    // Disconnect Handlers
    // ---------------------------------------------------------
    socket.on('disconnect', () => {
      // Check if tutor disconnected
      const hostRoom = roomManager.getRoomByTutorSocket(socket.id);
      if (hostRoom) {
        // Tutor disconnected
        console.log(`Host socket disconnected for room ${hostRoom.roomCode}`);
        return;
      }

      // Check if student disconnected
      const res = roomManager.removeStudent(socket.id);
      if (res && res.room) {
        io.to(`host:${res.room.roomCode}`).emit('host:roster-update', {
          participants: Array.from(res.room.participants.values()),
          totalCount: res.room.participants.size
        });
      }
    });
  });
}

module.exports = setupSocketHandlers;
