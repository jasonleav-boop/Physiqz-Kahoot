const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db, generateShareCode } = require('../db');
const { authenticateToken } = require('../auth');

// Multer storage for physics diagrams
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'diagram-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|svg/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowed.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (PNG, JPEG, WebP, GIF, SVG) are allowed'));
  }
});

// Image upload route
router.post('/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Get all quizzes for current tutor
router.get('/', authenticateToken, (req, res) => {
  try {
    const quizzes = db.prepare(`
      SELECT id, title, description, topic, subject, class_type, share_code, is_shared, created_at, updated_at,
             LENGTH(questions_json) as q_len
      FROM quizzes
      WHERE tutor_id = ?
      ORDER BY updated_at DESC
    `).all(req.tutor.id);

    // Calculate question counts
    const parsed = quizzes.map(q => {
      const full = db.prepare('SELECT questions_json FROM quizzes WHERE id = ?').get(q.id);
      let count = 0;
      try {
        const questions = JSON.parse(full.questions_json);
        count = Array.isArray(questions) ? questions.length : 0;
      } catch (e) {}
      return {
        ...q,
        questionCount: count
      };
    });

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get department shared quiz library (quizzes shared by lead lecturers & tutors)
router.get('/department-library', authenticateToken, (req, res) => {
  try {
    const quizzes = db.prepare(`
      SELECT q.id, q.tutor_id, q.title, q.description, q.topic, q.subject, q.class_type,
             q.share_code, q.created_at, q.updated_at, q.is_shared,
             t.name as author_name, t.email as author_email
      FROM quizzes q
      JOIN tutors t ON t.id = q.tutor_id
      WHERE q.is_shared = 1 OR q.tutor_id = ?
      ORDER BY q.updated_at DESC
    `).all(req.tutor.id);

    const parsed = quizzes.map(q => {
      const full = db.prepare('SELECT questions_json FROM quizzes WHERE id = ?').get(q.id);
      let count = 0;
      try {
        const questions = JSON.parse(full.questions_json);
        count = Array.isArray(questions) ? questions.length : 0;
      } catch (e) {}
      return {
        ...q,
        questionCount: count,
        isMine: q.tutor_id === req.tutor.id
      };
    });

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle share with department
router.patch('/:id/toggle-share', authenticateToken, (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const isOwner = quiz.tutor_id === req.tutor.id;
    const isAdminOrLead = req.tutor.is_admin || req.tutor.role === 'lead';
    if (!isOwner && !isAdminOrLead) {
      return res.status(403).json({ error: 'Only the author or lead lecturer can share this quiz.' });
    }

    const { isShared, subject, classType } = req.body;
    const newShared = isShared !== undefined ? (isShared ? 1 : 0) : (quiz.is_shared ? 0 : 1);
    const newSubject = subject ? subject.trim() : (quiz.subject || 'Electricity');
    const newClassType = classType ? classType.trim() : (quiz.class_type || 'TD');

    db.prepare(`
      UPDATE quizzes 
      SET is_shared = ?, subject = ?, class_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newShared, newSubject, newClassType, quizId);

    res.json({
      success: true,
      isShared: newShared,
      subject: newSubject,
      classType: newClassType,
      message: newShared ? 'Quiz published to Department Library' : 'Quiz removed from Department Library'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone / Duplicate a department quiz into current tutor's account
router.post('/:id/clone', authenticateToken, (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    const newShareCode = generateShareCode();
    const result = db.prepare(`
      INSERT INTO quizzes (tutor_id, title, description, topic, subject, class_type, questions_json, share_code, is_shared)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      req.tutor.id,
      `${quiz.title} (My Section)`,
      quiz.description || '',
      quiz.topic || 'Physics',
      quiz.subject || 'Electricity',
      quiz.class_type || 'TD',
      quiz.questions_json,
      newShareCode
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      title: `${quiz.title} (My Section)`,
      message: 'Quiz cloned to your section library.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single quiz
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const quiz = db.prepare(`
      SELECT id, tutor_id, title, description, topic, questions_json, share_code, created_at, updated_at
      FROM quizzes
      WHERE id = ? AND tutor_id = ?
    `).get(req.params.id, req.tutor.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    quiz.questions = JSON.parse(quiz.questions_json);
    delete quiz.questions_json;
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new quiz
router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, description, topic, questions } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Quiz title is required' });
    }

    const shareCode = generateShareCode();
    const questionsJson = JSON.stringify(questions || []);

    const result = db.prepare(`
      INSERT INTO quizzes (tutor_id, title, description, topic, questions_json, share_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.tutor.id, title.trim(), description || '', topic || 'General Physics', questionsJson, shareCode);

    res.status(201).json({
      id: result.lastInsertRowid,
      title,
      shareCode,
      message: 'Quiz created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update quiz
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { title, description, topic, questions } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Quiz title is required' });
    }

    const existing = db.prepare('SELECT id FROM quizzes WHERE id = ? AND tutor_id = ?')
      .get(req.params.id, req.tutor.id);

    if (!existing) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    const questionsJson = JSON.stringify(questions || []);

    db.prepare(`
      UPDATE quizzes
      SET title = ?, description = ?, topic = ?, questions_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tutor_id = ?
    `).run(title.trim(), description || '', topic || 'General Physics', questionsJson, req.params.id, req.tutor.id);

    res.json({ message: 'Quiz updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete quiz
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM quizzes WHERE id = ? AND tutor_id = ?')
      .run(req.params.id, req.tutor.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    res.json({ message: 'Quiz deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export quiz as downloadable JSON
router.get('/:id/export', authenticateToken, (req, res) => {
  try {
    const quiz = db.prepare(`
      SELECT title, description, topic, questions_json
      FROM quizzes
      WHERE id = ? AND tutor_id = ?
    `).get(req.params.id, req.tutor.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const exportData = {
      app: 'PhysicsKahoot',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      title: quiz.title,
      description: quiz.description,
      topic: quiz.topic,
      questions: JSON.parse(quiz.questions_json)
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(quiz.title.replace(/\s+/g, '_'))}_export.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import quiz from JSON payload
router.post('/import', authenticateToken, (req, res) => {
  try {
    const { title, description, topic, questions } = req.body;
    if (!title || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid quiz JSON format' });
    }

    const shareCode = generateShareCode();
    const result = db.prepare(`
      INSERT INTO quizzes (tutor_id, title, description, topic, questions_json, share_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.tutor.id,
      `${title} (Imported)`,
      description || '',
      topic || 'Physics',
      JSON.stringify(questions),
      shareCode
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      title: `${title} (Imported)`,
      message: 'Quiz imported successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import quiz using share code
router.post('/import-by-code', authenticateToken, (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Template code is required' });
    }

    const targetQuiz = db.prepare(`
      SELECT title, description, topic, questions_json
      FROM quizzes
      WHERE UPPER(share_code) = UPPER(?)
    `).get(code.trim());

    if (!targetQuiz) {
      return res.status(404).json({ error: 'No quiz found with that share code' });
    }

    const newShareCode = generateShareCode();
    const result = db.prepare(`
      INSERT INTO quizzes (tutor_id, title, description, topic, questions_json, share_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.tutor.id,
      `${targetQuiz.title} (Cloned)`,
      targetQuiz.description,
      targetQuiz.topic,
      targetQuiz.questions_json,
      newShareCode
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      title: `${targetQuiz.title} (Cloned)`,
      message: 'Template quiz successfully added to your library'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gemini Pro AI Quiz Generator
router.post('/generate-ai', authenticateToken, async (req, res) => {
  try {
    const { topic, questionCount = 3, difficulty = 'AP Physics 1', apiKey } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: 'Physics topic is required.' });
    }

    const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;

    if (effectiveKey) {
      // Call Google Gemini Pro API
      const prompt = `You are an expert Physics Professor and Quiz Creator.
Generate ${questionCount} high-quality physics quiz questions on the topic "${topic}" at the difficulty level "${difficulty}".
IMPORTANT:
- Every question must include realistic physics scenarios with LaTeX math equations (using $...$ for inline and $$...$$ for block math, e.g. $E = mc^2$, $\\vec{F} = m\\vec{a}$, $\\int \\vec{F} \\cdot d\\vec{r} = \\Delta K$).
- Answer options MUST also use $...$ for mathematical expressions.
- Provide 4 options for multiple choice questions, with exactly ONE option marked isCorrect: true.
- Include a detailed physics explanation and derivation note for each question.
- Output MUST be a strictly valid JSON array of objects with this schema, no markdown text outside the JSON:
[
  {
    "type": "multiple_choice",
    "question": "Question text with $LaTeX$",
    "timeLimit": 30,
    "points": 1000,
    "explanation": "Derivation and physics concept with $LaTeX$",
    "options": [
      { "text": "Option A with $LaTeX$", "isCorrect": true },
      { "text": "Option B with $LaTeX$", "isCorrect": false },
      { "text": "Option C with $LaTeX$", "isCorrect": false },
      { "text": "Option D with $LaTeX$", "isCorrect": false }
    ]
  }
]`;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${effectiveKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2500
          }
        })
      });

      const geminiData = await geminiRes.json();
      if (!geminiRes.ok) {
        throw new Error(geminiData.error?.message || 'Gemini API call failed');
      }

      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Extract JSON from potential markdown codeblocks
      const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (!jsonMatch) {
        throw new Error('Gemini output could not be parsed as JSON: ' + rawText.slice(0, 200));
      }

      const generatedQuestions = JSON.parse(jsonMatch[0]);
      return res.json({
        questions: generatedQuestions,
        source: 'Gemini 1.5 Pro',
        message: `Successfully generated ${generatedQuestions.length} physics questions using Gemini Pro!`
      });
    }

    // Built-in physics generator fallback if tutor does not provide a key
    const count = Math.min(Math.max(1, Number(questionCount) || 3), 5);
    const mockQuestions = [
      {
        id: 'ai_' + Date.now() + '_1',
        type: 'multiple_choice',
        question: `For a system studying "${topic}", an object moves under a conservative force field $\\vec{F} = -\\nabla U$. What is the relationship between work done $W$ and potential energy change $\\Delta U$?`,
        timeLimit: 30,
        points: 1000,
        explanation: 'For any conservative force, the work done equals the negative change in potential energy: $W_c = -\\Delta U = - (U_f - U_i)$.',
        options: [
          { text: '$W = -\\Delta U$', isCorrect: true },
          { text: '$W = +\\Delta U$', isCorrect: false },
          { text: '$W = \\frac{1}{2}\\Delta U^2$', isCorrect: false },
          { text: '$W = \\int U\\,dt$', isCorrect: false }
        ]
      },
      {
        id: 'ai_' + Date.now() + '_2',
        type: 'multiple_choice',
        question: `In "${topic}", if a harmonic oscillator exhibits displacement $x(t) = A\\cos(\\omega t + \\phi)$, what is the maximum magnitude of acceleration $a_{\\text{max}}$?`,
        timeLimit: 25,
        points: 1000,
        explanation: 'Differentiating twice: $a(t) = -\\omega^2 A\\cos(\\omega t + \\phi)$, so maximum acceleration magnitude is $a_{\\text{max}} = \\omega^2 A$.',
        options: [
          { text: '$a_{\\text{max}} = \\omega^2 A$', isCorrect: true },
          { text: '$a_{\\text{max}} = \\omega A$', isCorrect: false },
          { text: '$a_{\\text{max}} = \\frac{1}{2}\\omega^2 A$', isCorrect: false },
          { text: '$a_{\\text{max}} = \\frac{A}{\\omega^2}$', isCorrect: false }
        ]
      },
      {
        id: 'ai_' + Date.now() + '_3',
        type: 'true_false',
        question: `True or False: In a closed, isolated physics system experiencing interactions related to "${topic}", total mechanical energy $E = K + U$ is strictly conserved if only conservative forces do work.`,
        timeLimit: 20,
        points: 1000,
        explanation: 'True! When non-conservative forces (friction, drag) do zero net work, $\\Delta E_{\\text{mech}} = W_{\\text{nc}} = 0$.',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false }
        ]
      }
    ].slice(0, count);

    res.json({
      questions: mockQuestions,
      source: 'Built-in Physics Knowledge Base',
      message: `Generated ${mockQuestions.length} questions on ${topic}. To connect your personal Google Gemini Pro key, enter it in the AI dialog!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
