const { db } = require('../db');

class RoomManager {
  constructor() {
    // Map of roomCode -> Room Object
    this.rooms = new Map();
  }

  // Generate a random 6-digit room code not currently in use
  generateRoomCode() {
    let code;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(code));
    return code;
  }

  // Create a new game room hosted by tutor
  createRoom(tutorId, tutorSocketId, quiz, passcode = null) {
    const roomCode = this.generateRoomCode();
    const cleanPasscode = passcode && String(passcode).trim() ? String(passcode).trim() : null;

    // Insert session into SQLite
    const insertSession = db.prepare(`
      INSERT INTO sessions (room_code, tutor_id, quiz_id, quiz_title, passcode)
      VALUES (?, ?, ?, ?, ?)
    `).run(roomCode, tutorId, quiz.id || null, quiz.title, cleanPasscode);

    const sessionId = insertSession.lastInsertRowid;

    const room = {
      sessionId,
      roomCode,
      tutorId,
      tutorSocketId,
      quiz,
      passcode: cleanPasscode,
      isLocked: false,
      state: 'LOBBY', // LOBBY | QUESTION | REVEAL | LEADERBOARD | PODIUM
      currentQuestionIndex: -1,
      questionStartTime: null,
      timeLimit: 0,
      timeRemaining: 0,
      timerInterval: null,
      // Map of socketId -> student
      participants: new Map(),
      // Current question live answers: socketId -> { option, timeTakenMs, isCorrect, points }
      currentAnswers: new Map(),
      // Answer distribution tally for current question: { 0: count, 1: count, ... }
      currentDistribution: {}
    };

    this.rooms.set(roomCode, room);
    return room;
  }

  // Toggle room lock
  toggleLock(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.isLocked = !room.isLocked;
    try {
      db.prepare('UPDATE sessions SET is_locked = ? WHERE id = ?').run(room.isLocked ? 1 : 0, room.sessionId);
    } catch (e) {}
    return room.isLocked;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomByTutorSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.tutorSocketId === socketId) {
        return room;
      }
    }
    return null;
  }

  getRoomByStudentSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.participants.has(socketId)) {
        return room;
      }
    }
    return null;
  }

  // Add a student to room
  joinRoom(roomCode, socketId, studentName, studentId = '', avatar = '⚛️', enteredPasscode = '') {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error('Room not found. Please verify the 6-digit PIN.');
    }

    if (room.state !== 'LOBBY' && room.state !== 'QUESTION' && room.state !== 'REVEAL' && room.state !== 'LEADERBOARD') {
      throw new Error('This session has already concluded.');
    }

    // Check if room has a password lock
    if (room.passcode) {
      const cleanEntered = enteredPasscode ? String(enteredPasscode).trim() : '';
      if (cleanEntered !== room.passcode) {
        throw new Error('Incorrect room password. Please enter the password provided by your tutor.');
      }
    }

    // Check if name is already taken, if so append number or allow rejoin
    let finalName = studentName.trim();
    let existingSocket = null;

    for (const [sId, p] of room.participants.entries()) {
      if (p.studentName.toLowerCase() === finalName.toLowerCase() && p.studentId === studentId.trim()) {
        existingSocket = sId;
        break;
      }
    }

    // If room is locked and this is a brand new participant, reject
    if (room.isLocked && !existingSocket) {
      throw new Error('This session has been locked by the tutor. No new participants can join.');
    }

    if (existingSocket) {
      // Reconnection: update socket ID and preserve score
      const existingData = room.participants.get(existingSocket);
      room.participants.delete(existingSocket);
      existingData.socketId = socketId;
      room.participants.set(socketId, existingData);
      return { room, participant: existingData, isRejoin: true };
    }

    const participant = {
      socketId,
      studentName: finalName,
      studentId: studentId.trim(),
      avatar,
      score: 0,
      streak: 0,
      correctCount: 0,
      answers: {} // questionIndex -> { option, timeTakenMs, isCorrect, points }
    };

    room.participants.set(socketId, participant);
    return { room, participant, isRejoin: false };
  }

  // Kick student by tutor
  kickStudent(roomCode, targetSocketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const student = room.participants.get(targetSocketId);
    if (student) {
      room.participants.delete(targetSocketId);
      room.currentAnswers.delete(targetSocketId);
    }
    return student;
  }

  // Remove participant upon disconnect
  removeStudent(socketId) {
    for (const room of this.rooms.values()) {
      if (room.participants.has(socketId)) {
        const student = room.participants.get(socketId);
        // Only completely delete if still in LOBBY, otherwise retain state for reconnection
        if (room.state === 'LOBBY') {
          room.participants.delete(socketId);
        }
        return { room, student };
      }
    }
    return null;
  }

  // Start next question
  startQuestion(roomCode, questionIndex) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    if (questionIndex >= room.quiz.questions.length) {
      return this.finishGame(roomCode);
    }

    const question = room.quiz.questions[questionIndex];
    room.state = 'QUESTION';
    room.currentQuestionIndex = questionIndex;
    room.questionStartTime = Date.now();
    room.timeLimit = question.timeLimit || 30;
    room.timeRemaining = room.timeLimit;
    room.currentAnswers.clear();

    // Reset distribution counts
    room.currentDistribution = {};
    const optCount = question.options ? question.options.length : 4;
    for (let i = 0; i < optCount; i++) {
      room.currentDistribution[i] = 0;
    }

    return room;
  }

  // Submit student answer
  submitAnswer(roomCode, socketId, selectedOption) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== 'QUESTION') {
      return { error: 'Question is not active for answers.' };
    }

    if (room.currentAnswers.has(socketId)) {
      return { error: 'Answer already submitted.' };
    }

    const participant = room.participants.get(socketId);
    if (!participant) {
      return { error: 'Participant not in room.' };
    }

    const question = room.quiz.questions[room.currentQuestionIndex];
    const timeTakenMs = Math.max(50, Date.now() - room.questionStartTime);
    const timeLimitMs = (room.timeLimit || 30) * 1000;

    let isCorrect = false;
    let pointsAwarded = 0;

    if (question.type === 'poll') {
      // Polls award standard participation points
      isCorrect = true;
      pointsAwarded = question.points || 500;
    } else {
      const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
      if (selectedOption === correctOptionIndex) {
        isCorrect = true;
        // Kahoot scoring: faster response yields higher percentage of points
        const speedRatio = Math.max(0.5, 1 - (timeTakenMs / (timeLimitMs * 2)));
        const basePoints = Math.round((question.points || 1000) * speedRatio);
        
        // Streak bonus
        participant.streak = (participant.streak || 0) + 1;
        const streakBonus = participant.streak >= 4 ? 300 : (participant.streak >= 2 ? 150 : 0);
        
        pointsAwarded = basePoints + streakBonus;
        participant.correctCount = (participant.correctCount || 0) + 1;
      } else {
        isCorrect = false;
        participant.streak = 0;
        pointsAwarded = 0;
      }
    }

    participant.score += pointsAwarded;
    const answerRecord = {
      option: selectedOption,
      timeTakenMs,
      isCorrect,
      points: pointsAwarded
    };

    participant.answers[room.currentQuestionIndex] = answerRecord;
    room.currentAnswers.set(socketId, answerRecord);

    // Update distribution
    if (selectedOption !== null && selectedOption !== undefined) {
      room.currentDistribution[selectedOption] = (room.currentDistribution[selectedOption] || 0) + 1;
    }

    return {
      success: true,
      answerRecord,
      totalAnswered: room.currentAnswers.size,
      totalParticipants: room.participants.size,
      allAnswered: room.currentAnswers.size >= room.participants.size
    };
  }

  // Reveal correct answer and update state
  revealQuestion(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.state = 'REVEAL';

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    const question = room.quiz.questions[room.currentQuestionIndex];
    let correctOptionIndex = -1;
    if (question.type !== 'poll') {
      correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);
    }

    return {
      room,
      correctOptionIndex,
      explanation: question.explanation || '',
      distribution: room.currentDistribution,
      totalAnswered: room.currentAnswers.size,
      totalParticipants: room.participants.size
    };
  }

  // Get current top leaderboard
  getLeaderboard(roomCode, limit = 5) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];

    room.state = 'LEADERBOARD';

    const list = Array.from(room.participants.values())
      .map(p => ({
        socketId: p.socketId,
        studentName: p.studentName,
        studentId: p.studentId,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        correctCount: p.correctCount,
        lastPoints: p.answers[room.currentQuestionIndex] ? p.answers[room.currentQuestionIndex].points : 0
      }))
      .sort((a, b) => b.score - a.score);

    // Assign rank
    list.forEach((p, index) => {
      p.rank = index + 1;
    });

    return {
      topList: list.slice(0, limit),
      allRankings: list
    };
  }

  // Finish game & persist to SQLite
  finishGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.state = 'PODIUM';

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    const allRankings = Array.from(room.participants.values())
      .map(p => ({
        socketId: p.socketId,
        studentName: p.studentName,
        studentId: p.studentId,
        avatar: p.avatar,
        score: p.score,
        streak: p.streak,
        correctCount: p.correctCount,
        answers: p.answers
      }))
      .sort((a, b) => b.score - a.score);

    allRankings.forEach((p, index) => {
      p.rank = index + 1;
    });

    // Save final stats to SQLite
    try {
      db.prepare(`
        UPDATE sessions
        SET ended_at = CURRENT_TIMESTAMP, total_participants = ?
        WHERE id = ?
      `).run(allRankings.length, room.sessionId);

      const insertParticipant = db.prepare(`
        INSERT INTO session_participants (session_id, student_name, student_id, score, rank, correct_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertResponse = db.prepare(`
        INSERT INTO session_responses (session_id, question_index, student_name, student_id, selected_option, is_correct, time_taken_ms, points_awarded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction(() => {
        for (const p of allRankings) {
          insertParticipant.run(room.sessionId, p.studentName, p.studentId, p.score, p.rank, p.correctCount);

          for (const [qIdx, ans] of Object.entries(p.answers)) {
            insertResponse.run(
              room.sessionId,
              parseInt(qIdx, 10),
              p.studentName,
              p.studentId,
              ans.option,
              ans.isCorrect ? 1 : 0,
              ans.timeTakenMs,
              ans.points
            );
          }
        }
      });

      transaction();
      console.log(`Persisted session ${room.sessionId} (${room.roomCode}) with ${allRankings.length} students to SQLite.`);
    } catch (err) {
      console.error('Error persisting game session to SQLite:', err);
    }

    return {
      podium: {
        first: allRankings[0] || null,
        second: allRankings[1] || null,
        third: allRankings[2] || null
      },
      allRankings
    };
  }

  // Close room completely
  closeRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room && room.timerInterval) {
      clearInterval(room.timerInterval);
    }
    this.rooms.delete(roomCode);
  }
}

module.exports = new RoomManager();
