const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticateToken } = require('../auth');

// Get all past sessions (supports filtering by tutorId for Lead & Admin)
router.get('/', authenticateToken, (req, res) => {
  try {
    const isLeadOrAdmin = req.tutor.is_admin ||
      req.tutor.role === 'lead' ||
      req.tutor.role === 'admin' ||
      (req.tutor.email?.toLowerCase() === 'jasonleav@gmail.com');

    const { tutorId } = req.query;

    let query = `
      SELECT s.id, s.room_code, s.quiz_title, s.started_at, s.ended_at, s.total_participants,
             s.tutor_id, t.name as tutor_name, t.email as tutor_email,
             COUNT(sp.id) as roster_count,
             AVG(sp.score) as average_score
      FROM sessions s
      JOIN tutors t ON t.id = s.tutor_id
      LEFT JOIN session_participants sp ON sp.session_id = s.id
    `;
    const params = [];

    if (tutorId && isLeadOrAdmin) {
      query += ` WHERE s.tutor_id = ? `;
      params.push(tutorId);
    } else if (!isLeadOrAdmin) {
      query += ` WHERE s.tutor_id = ? `;
      params.push(req.tutor.id);
    }

    query += ` GROUP BY s.id ORDER BY s.started_at DESC `;
    const sessions = db.prepare(query).all(...params);

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get session details and question breakdown
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const isLeadOrAdmin = req.tutor.is_admin ||
      req.tutor.role === 'lead' ||
      req.tutor.role === 'admin' ||
      (req.tutor.email?.toLowerCase() === 'jasonleav@gmail.com');

    const session = isLeadOrAdmin
      ? db.prepare('SELECT s.*, t.name as tutor_name, t.email as tutor_email FROM sessions s JOIN tutors t ON t.id = s.tutor_id WHERE s.id = ?').get(req.params.id)
      : db.prepare('SELECT s.*, t.name as tutor_name, t.email as tutor_email FROM sessions s JOIN tutors t ON t.id = s.tutor_id WHERE s.id = ? AND s.tutor_id = ?').get(req.params.id, req.tutor.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const participants = db.prepare(`
      SELECT id, student_name, student_id, score, rank, correct_count
      FROM session_participants
      WHERE session_id = ?
      ORDER BY rank ASC, score DESC
    `).all(session.id);

    const responses = db.prepare(`
      SELECT question_index, student_name, student_id, selected_option, is_correct, time_taken_ms, points_awarded
      FROM session_responses
      WHERE session_id = ?
    `).all(session.id);

    // Get question count and questions info if quiz still exists
    let questions = [];
    if (session.quiz_id) {
      const quiz = db.prepare('SELECT questions_json FROM quizzes WHERE id = ?').get(session.quiz_id);
      if (quiz) {
        try {
          questions = JSON.parse(quiz.questions_json);
        } catch (e) {}
      }
    }

    // Calculate question accuracy stats
    const questionStats = [];
    const questionIndices = [...new Set(responses.map(r => r.question_index))].sort((a, b) => a - b);
    
    questionIndices.forEach(qIdx => {
      const qResponses = responses.filter(r => r.question_index === qIdx);
      const totalAnswers = qResponses.length;
      const correctAnswers = qResponses.filter(r => r.is_correct === 1).length;
      const avgTimeMs = totalAnswers > 0 ? (qResponses.reduce((acc, r) => acc + r.time_taken_ms, 0) / totalAnswers) : 0;
      
      const optionDistribution = {};
      qResponses.forEach(r => {
        optionDistribution[r.selected_option] = (optionDistribution[r.selected_option] || 0) + 1;
      });

      questionStats.push({
        questionIndex: qIdx,
        questionText: questions[qIdx] ? questions[qIdx].question : `Question ${qIdx + 1}`,
        totalAnswers,
        correctAnswers,
        accuracyPct: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
        averageTimeSec: (avgTimeMs / 1000).toFixed(1),
        optionDistribution
      });
    });

    res.json({
      session,
      participants,
      responses,
      questionStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to escape CSV values
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Download Results as CSV
router.get('/:id/export-csv', authenticateToken, (req, res) => {
  try {
    const isLeadOrAdmin = req.tutor.is_admin ||
      req.tutor.role === 'lead' ||
      req.tutor.role === 'admin' ||
      (req.tutor.email?.toLowerCase() === 'jasonleav@gmail.com');

    const session = isLeadOrAdmin
      ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id)
      : db.prepare('SELECT * FROM sessions WHERE id = ? AND tutor_id = ?').get(req.params.id, req.tutor.id);

    if (!session) {
      return res.status(404).send('Session not found');
    }

    const participants = db.prepare(`
      SELECT student_name, student_id, score, rank, correct_count
      FROM session_participants
      WHERE session_id = ?
      ORDER BY rank ASC, score DESC
    `).all(session.id);

    const responses = db.prepare(`
      SELECT question_index, student_name, student_id, selected_option, is_correct, time_taken_ms, points_awarded
      FROM session_responses
      WHERE session_id = ?
    `).all(session.id);

    // Identify all questions
    const qIndices = [...new Set(responses.map(r => r.question_index))].sort((a, b) => a - b);

    // Build CSV Headers
    const headers = [
      'Rank',
      'Student Name',
      'Student ID',
      'Total Score',
      'Correct Answers',
      'Accuracy %'
    ];

    qIndices.forEach(idx => {
      headers.push(`Q${idx + 1} Choice`);
      headers.push(`Q${idx + 1} Correct`);
      headers.push(`Q${idx + 1} Time (s)`);
      headers.push(`Q${idx + 1} Points`);
    });

    let csvContent = '';
    // Metadata lines
    csvContent += `Class Quiz Report: ${escapeCsv(session.quiz_title)}\n`;
    csvContent += `Room Code: ${session.room_code}, Date: ${session.started_at}, Total Students: ${participants.length}\n\n`;
    csvContent += headers.join(',') + '\n';

    // Student rows
    participants.forEach(p => {
      const studentKey = `${p.student_name}:::${p.student_id || ''}`;
      const totalQ = qIndices.length;
      const acc = totalQ > 0 ? Math.round((p.correct_count / totalQ) * 100) : 0;

      const row = [
        p.rank,
        escapeCsv(p.student_name),
        escapeCsv(p.student_id || 'N/A'),
        p.score,
        `${p.correct_count}/${totalQ}`,
        `${acc}%`
      ];

      qIndices.forEach(qIdx => {
        const resp = responses.find(r => 
          r.question_index === qIdx && 
          r.student_name === p.student_name && 
          (r.student_id || '') === (p.student_id || '')
        );

        if (resp) {
          const optLetter = resp.selected_option !== null && resp.selected_option !== undefined 
            ? String.fromCharCode(65 + resp.selected_option) 
            : 'None';
          row.push(escapeCsv(optLetter));
          row.push(resp.is_correct ? 'Yes' : 'No');
          row.push((resp.time_taken_ms / 1000).toFixed(1));
          row.push(resp.points_awarded);
        } else {
          row.push('No Answer');
          row.push('No');
          row.push('0.0');
          row.push(0);
        }
      });

      csvContent += row.join(',') + '\n';
    });

    const filename = `Session_${session.room_code}_${session.quiz_title.replace(/[^a-zA-Z0-9]/g, '_')}_Results.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
