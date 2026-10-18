const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.join(__dirname, 'kahoot_physics.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tutors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    questions_json TEXT NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    tutor_id INTEGER NOT NULL,
    quiz_id INTEGER,
    quiz_title TEXT NOT NULL,
    passcode TEXT,
    is_locked INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    total_participants INTEGER DEFAULT 0,
    FOREIGN KEY(tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    student_id TEXT,
    score INTEGER DEFAULT 0,
    rank INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    question_index INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    student_id TEXT,
    selected_option INTEGER,
    is_correct INTEGER DEFAULT 0,
    time_taken_ms INTEGER DEFAULT 0,
    points_awarded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS class_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    department TEXT DEFAULT 'Département de Tronc Commun',
    academic_year TEXT DEFAULT '2026-2027',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    student_number INTEGER,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sex TEXT DEFAULT 'M',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    tutor_id INTEGER NOT NULL,
    session_code TEXT UNIQUE NOT NULL,
    title TEXT,
    date DATE DEFAULT (DATE('now')),
    passcode TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY(group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
    FOREIGN KEY(tutor_id) REFERENCES tutors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attendance_session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT DEFAULT 'PRESENT',
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    method TEXT DEFAULT 'QR',
    FOREIGN KEY(attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(attendance_session_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS tutor_class_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Electricity',
    class_type TEXT NOT NULL DEFAULT 'TD',
    academic_year TEXT DEFAULT '2026-2027',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tutor_id) REFERENCES tutors(id) ON DELETE CASCADE,
    FOREIGN KEY(group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, subject, class_type)
  );
`);

// Safe migration for sessions columns
try {
  db.exec(`
    ALTER TABLE sessions ADD COLUMN passcode TEXT;
  `);
} catch (e) {}

try {
  db.exec(`
    ALTER TABLE sessions ADD COLUMN is_locked INTEGER DEFAULT 0;
  `);
} catch (e) {}

try {
  db.exec(`
    ALTER TABLE tutors ADD COLUMN is_admin INTEGER DEFAULT 0;
  `);
} catch (e) {}

try {
  db.exec(`ALTER TABLE tutors ADD COLUMN role TEXT DEFAULT 'tutor';`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE tutors ADD COLUMN assigned_classes TEXT DEFAULT '';`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE quizzes ADD COLUMN is_shared INTEGER DEFAULT 0;`);
  db.exec(`ALTER TABLE quizzes ADD COLUMN subject TEXT DEFAULT 'Electricity';`);
  db.exec(`ALTER TABLE quizzes ADD COLUMN class_type TEXT DEFAULT 'TD';`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE attendance_sessions ADD COLUMN subject TEXT DEFAULT 'Electricity';`);
  db.exec(`ALTER TABLE attendance_sessions ADD COLUMN class_type TEXT DEFAULT 'TD';`);
} catch (e) {}

try {
  db.exec(`ALTER TABLE class_groups ADD COLUMN year_level TEXT DEFAULT 'I2';`);
  db.exec(`UPDATE class_groups SET year_level = CASE WHEN code LIKE 'I1-%' THEN 'I1' ELSE 'I2' END;`);
} catch (e) {}

try {
  db.exec(`UPDATE quizzes SET subject = 'Physics I (Physics for Engineering)' WHERE subject IN ('General Physics', 'Optics');`);
  db.exec(`UPDATE attendance_sessions SET subject = 'Physics I (Physics for Engineering)' WHERE subject IN ('General Physics', 'Optics');`);
} catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT OR IGNORE INTO system_settings (key, value) VALUES ('tutor_invite_code', 'TECHNO-2026');
  UPDATE tutors SET is_admin = 1, role = 'admin' WHERE LOWER(email) = 'jasonleav@gmail.com';
`);

// Helper to generate unique share code for quizzes
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PHY-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Seed initial tutor and sample quizzes if not already present
function seedData() {
  const tutorsToSeed = [
    { email: 'jasonleav@gmail.com', name: 'Jason Leav', password: 'physics123' },
    { email: 'tutor@physics.edu', name: 'Dr. Richard Feynman', password: 'physics123' }
  ];

  for (const t of tutorsToSeed) {
    let existingTutor = db.prepare('SELECT id FROM tutors WHERE LOWER(email) = LOWER(?)').get(t.email);
    let tutorId;

    if (!existingTutor) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(t.password, salt);
      const info = db.prepare('INSERT INTO tutors (name, email, password_hash) VALUES (?, ?, ?)')
        .run(t.name, t.email.toLowerCase(), hash);
      tutorId = info.lastInsertRowid;
      console.log(`Seeded tutor: ${t.name} (${t.email})`);
    } else {
      tutorId = existingTutor.id;
    }

    // Check if quizzes exist for this tutor
    const quizCount = db.prepare('SELECT COUNT(*) as count FROM quizzes WHERE tutor_id = ?').get(tutorId).count;
    if (quizCount === 0) {
    const sampleQuiz1 = {
      title: 'AP Physics 1: Mechanics & Dynamics',
      description: 'Core concepts including Newton\'s laws, impulse-momentum, work-energy theorem, and rotational dynamics.',
      topic: 'Classical Mechanics',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'A mass $m = 2.0\\text{ kg}$ is pulled along a frictionless floor by force $\\vec{F} = 10\\text{ N}$ at $\\theta = 30^\\circ$ above horizontal. What is its horizontal acceleration $a_x$?',
          imageUrl: null,
          timeLimit: 30,
          points: 1000,
          explanation: 'The horizontal component is $F_x = F\\cos(30^\\circ) = 10 \\times 0.866 = 8.66\\text{ N}$. By Newton\'s 2nd Law, $a_x = \\frac{F_x}{m} = \\frac{8.66\\text{ N}}{2.0\\text{ kg}} = 4.33\\text{ m/s}^2$.',
          options: [
            { text: '$a_x = 4.33\\text{ m/s}^2$', isCorrect: true },
            { text: '$a_x = 5.00\\text{ m/s}^2$', isCorrect: false },
            { text: '$a_x = 2.50\\text{ m/s}^2$', isCorrect: false },
            { text: '$a_x = 8.66\\text{ m/s}^2$', isCorrect: false }
          ]
        },
        {
          id: 'q2',
          type: 'true_false',
          question: 'True or False: The net work done on an object is strictly equal to the change in its kinetic energy: $W_{\\text{net}} = \\Delta K = \\frac{1}{2}mv_f^2 - \\frac{1}{2}mv_i^2$.',
          imageUrl: null,
          timeLimit: 20,
          points: 1000,
          explanation: 'True! This is the fundamental Work-Energy Theorem, derived directly from integrating $\\int \\vec{F}_{\\text{net}} \\cdot d\\vec{r}$.',
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false }
          ]
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'A rocket engine exerts a time-varying thrust $\\vec{F}(t)$ from $t_1$ to $t_2$. Which formula calculates the change in linear momentum $\\Delta \\vec{p}$?',
          imageUrl: null,
          timeLimit: 25,
          points: 1000,
          explanation: 'Impulse $\\vec{J} = \\int_{t_1}^{t_2} \\vec{F}(t)\\,dt = \\Delta \\vec{p}$. The area under the Force-Time curve equals impulse.',
          options: [
            { text: '$\\Delta \\vec{p} = \\int_{t_1}^{t_2} \\vec{F}(t)\\,dt$', isCorrect: true },
            { text: '$\\Delta \\vec{p} = \\frac{1}{2}\\int_{t_1}^{t_2} F(t)^2\\,dt$', isCorrect: false },
            { text: '$\\Delta \\vec{p} = \\frac{d}{dt}[\\vec{F}(t)]$', isCorrect: false },
            { text: '$\\Delta \\vec{p} = \\vec{F}_{\\text{avg}} \\times m$', isCorrect: false }
          ]
        },
        {
          id: 'q4',
          type: 'poll',
          question: 'Poll: Which physics topic do you find most challenging to visualize conceptually?',
          imageUrl: null,
          timeLimit: 20,
          points: 500,
          explanation: 'Great feedback! We will dedicate additional recitation time to explore this topic interactively.',
          options: [
            { text: 'Rotational dynamics & torque ($\\vec{\\tau} = \\vec{r} \\times \\vec{F}$)', isCorrect: true },
            { text: 'Simple Harmonic Motion & Phase ($x(t) = A\\cos(\\omega t + \\phi)$)', isCorrect: true },
            { text: 'Non-conservative systems & drag ($F_{\\text{drag}} \\propto v^2$)', isCorrect: true },
            { text: 'Conservation of angular momentum ($L = I\\omega$)', isCorrect: true }
          ]
        }
      ]
    };

    const sampleQuiz2 = {
      title: 'Electromagnetism & DC Circuits',
      description: 'Gauss\'s Law, magnetic forces on charges, and RC circuit time constants.',
      topic: 'Electromagnetism',
      questions: [
        {
          id: 'eq1',
          type: 'multiple_choice',
          question: 'What is the magnetic force $\\vec{F}_B$ on a charged particle $q$ moving with velocity $\\vec{v}$ parallel to a uniform magnetic field $\\vec{B}$?',
          imageUrl: null,
          timeLimit: 20,
          points: 1000,
          explanation: 'The magnetic Lorentz force is $\\vec{F}_B = q(\\vec{v} \\times \\vec{B}) = q v B \\sin\\theta$. Since $\\vec{v} \\parallel \\vec{B}$, $\\theta = 0^\\circ$ and $\\sin(0^\\circ) = 0$, so $\\vec{F}_B = 0$.',
          options: [
            { text: '$\\vec{F}_B = 0$', isCorrect: true },
            { text: '$\\vec{F}_B = q v B$', isCorrect: false },
            { text: '$\\vec{F}_B = \\frac{qB}{v}$', isCorrect: false },
            { text: '$\\vec{F}_B = -q v B$', isCorrect: false }
          ]
        },
        {
          id: 'eq2',
          type: 'multiple_choice',
          question: 'In a series $RC$ circuit connected to a DC voltage $V_0$, what is the characteristic time constant $\\tau$ for charging the capacitor?',
          imageUrl: null,
          timeLimit: 25,
          points: 1000,
          explanation: 'The time constant for an RC circuit is $\\tau = RC$, which represents the time required to charge to $\\approx 63.2\\%$ of maximum voltage $V(t) = V_0(1 - e^{-t/RC})$.',
          options: [
            { text: '$\\tau = RC$', isCorrect: true },
            { text: '$\\tau = \\frac{R}{C}$', isCorrect: false },
            { text: '$\\tau = \\frac{1}{RC}$', isCorrect: false },
            { text: '$\\tau = \\sqrt{LC}$', isCorrect: false }
          ]
        },
        {
          id: 'eq3',
          type: 'true_false',
          question: 'True or False: A static magnetic field $\\vec{B}$ can do work on a moving free charge $q$.',
          imageUrl: null,
          timeLimit: 20,
          points: 1000,
          explanation: 'False! Magnetic force $\\vec{F}_B = q(\\vec{v} \\times \\vec{B})$ is always perpendicular to instantaneous velocity $\\vec{v}$. Therefore, power $P = \\vec{F}_B \\cdot \\vec{v} = 0$, so $W = 0$.',
          options: [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: true }
          ]
        }
      ]
    };

    const insertQuiz = db.prepare(`
      INSERT INTO quizzes (tutor_id, title, description, topic, questions_json, share_code)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertQuiz.run(tutorId, sampleQuiz1.title, sampleQuiz1.description, sampleQuiz1.topic, JSON.stringify(sampleQuiz1.questions), generateShareCode());
    insertQuiz.run(tutorId, sampleQuiz2.title, sampleQuiz2.description, sampleQuiz2.topic, JSON.stringify(sampleQuiz2.questions), generateShareCode());
    console.log(`Seeded 2 sample physics quizzes with KaTeX formulas for tutor ID ${tutorId}.`);
    }
  }

  try {
    const { parseAndSeedRoster } = require('./seedRoster');
    parseAndSeedRoster(db);
  } catch (err) {
    console.error('Error seeding roster:', err);
  }
}

seedData();

module.exports = {
  db,
  generateShareCode
};
