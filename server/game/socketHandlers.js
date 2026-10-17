const roomManager = require('./roomManager');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // ---------------------------------------------------------
    // Host / Presenter Handlers
    // ---------------------------------------------------------

    // Host creates a live game room
    socket.on('host:create-room', ({ tutorId, quiz, passcode }, callback) => {
      try {
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
          return callback({ error: 'Quiz must have at least one question.' });
        }

        const room = roomManager.createRoom(tutorId, socket.id, quiz, passcode);
        socket.join(room.roomCode);
        socket.join(`host:${room.roomCode}`);

        callback({
          success: true,
          roomCode: room.roomCode,
          sessionId: room.sessionId,
          quizTitle: quiz.title,
          passcode: room.passcode,
          isLocked: room.isLocked,
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

        // Send current game state to student
        callback({
          success: true,
          roomCode: room.roomCode,
          quizTitle: room.quiz.title,
          gameState: room.state,
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
            options: room.quiz.questions[room.currentQuestionIndex].options.map((opt, i) => ({
              index: i,
              text: opt.text
            })),
            timeRemaining: room.timeRemaining
          } : null
        });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    // Student submits answer
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
