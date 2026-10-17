const { db, generateShareCode } = require('../server/db');

// Ensure subjects on existing quizzes are accurate
db.prepare(`UPDATE quizzes SET subject = 'Mechanics', class_type = 'TD' WHERE id = 1;`).run();
db.prepare(`UPDATE quizzes SET subject = 'Electricity', class_type = 'TD' WHERE id = 2;`).run();
db.prepare(`UPDATE quizzes SET subject = 'Physics I (Physics for Engineering)', class_type = 'Cours' WHERE id = 3;`).run();
db.prepare(`UPDATE quizzes SET subject = 'Electricity', class_type = 'TP' WHERE id = 4;`).run();

// Check if we already have quizzes for Vibrations and Waves, Physics II, Thermodynamics
const existingTitles = db.prepare('SELECT title FROM quizzes').all().map(q => q.title);

const masterQuizzes = [
  {
    tutor_id: 1,
    title: 'Vibrations & Wave Mechanics (រំញ័រ និងរលក)',
    description: 'Department master problem set: Simple Harmonic Motion (SHM), damped oscillations, resonance, wave speed $v = \\lambda f$, and sound intensity.',
    topic: 'Vibrations and Waves',
    subject: 'Vibrations and Waves',
    class_type: 'TD',
    is_shared: 1,
    questions: [
      {
        id: 'vw_q1',
        type: 'multiple_choice',
        question: 'An ideal mass-spring oscillator has mass $m = 0.5\\text{ kg}$ and spring constant $k = 200\\text{ N/m}$. What is its angular frequency $\\omega$?',
        timeLimit: 25,
        points: 1000,
        explanation: 'Angular frequency is given by $\\omega = \\sqrt{\\frac{k}{m}} = \\sqrt{\\frac{200}{0.5}} = \\sqrt{400} = 20\\text{ rad/s}$.',
        options: [
          { text: '$\\omega = 20\\text{ rad/s}$', isCorrect: true },
          { text: '$\\omega = 10\\text{ rad/s}$', isCorrect: false },
          { text: '$\\omega = 400\\text{ rad/s}$', isCorrect: false },
          { text: '$\\omega = 14.1\\text{ rad/s}$', isCorrect: false }
        ]
      },
      {
        id: 'vw_q2',
        type: 'multiple_choice',
        question: 'A mechanical wave travels through a medium with frequency $f = 440\\text{ Hz}$ and wavelength $\\lambda = 0.77\\text{ m}$. What is the wave propagation speed $v$?',
        timeLimit: 25,
        points: 1000,
        explanation: 'Wave speed is $v = \\lambda f = 0.77 \\times 440 \\approx 338.8\\text{ m/s}$ (speed of sound in air).',
        options: [
          { text: '$v \\approx 339\\text{ m/s}$', isCorrect: true },
          { text: '$v \\approx 571\\text{ m/s}$', isCorrect: false },
          { text: '$v \\approx 170\\text{ m/s}$', isCorrect: false },
          { text: '$v \\approx 440\\text{ m/s}$', isCorrect: false }
        ]
      },
      {
        id: 'vw_q3',
        type: 'true_false',
        question: 'True or False: In mechanical resonance, when the driving frequency $\\omega$ equals the natural frequency $\\omega_0$, the amplitude of oscillation reaches a maximum.',
        timeLimit: 20,
        points: 1000,
        explanation: 'True! Resonance occurs when the driving frequency matches the natural frequency $\\omega = \\omega_0$, transferring maximum energy to the oscillator.',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false }
        ]
      }
    ]
  },
  {
    tutor_id: 1,
    title: 'Physics II: Electromagnetic Induction & AC Circuits',
    description: 'Master quiz for Year 2: Faraday\'s Law of Induction $\\mathcal{E} = -\\frac{d\\Phi_B}{dt}$, Lenz\'s Law, and RLC resonance.',
    topic: 'Electromagnetism',
    subject: 'Physics II',
    class_type: 'TD',
    is_shared: 1,
    questions: [
      {
        id: 'p2_q1',
        type: 'multiple_choice',
        question: 'A magnetic flux through a 50-turn coil changes uniformly from $\\Phi_1 = 0.08\\text{ Wb}$ to $\\Phi_2 = 0.02\\text{ Wb}$ in $\\Delta t = 0.1\\text{ s}$. What is the magnitude of the induced EMF $|\\mathcal{E}|$?',
        timeLimit: 30,
        points: 1000,
        explanation: 'By Faraday\'s law: $|\\mathcal{E}| = N\\left|\\frac{\\Delta \\Phi}{\\Delta t}\\right| = 50 \\times \\left|\\frac{0.02 - 0.08}{0.1}\\right| = 50 \\times 0.6 = 30\\text{ V}$.',
        options: [
          { text: '$|\\mathcal{E}| = 30\\text{ V}$', isCorrect: true },
          { text: '$|\\mathcal{E}| = 6\\text{ V}$', isCorrect: false },
          { text: '$|\\mathcal{E}| = 60\\text{ V}$', isCorrect: false },
          { text: '$|\\mathcal{E}| = 3\\text{ V}$', isCorrect: false }
        ]
      },
      {
        id: 'p2_q2',
        type: 'true_false',
        question: 'True or False: Lenz\'s law states that an induced current always flows in such a direction that its magnetic field opposes the change in magnetic flux that produced it.',
        timeLimit: 20,
        points: 1000,
        explanation: 'True! This is the negative sign in Faraday\'s Law $\\mathcal{E} = -N \\frac{d\\Phi_B}{dt}$, conforming to the conservation of energy.',
        options: [
          { text: 'True', isCorrect: true },
          { text: 'False', isCorrect: false }
        ]
      }
    ]
  },
  {
    tutor_id: 1,
    title: 'Physics I (Physics for Engineering): Kinematics & Statics',
    description: 'Foundational problem set for First & Second Year engineering students: Vector resolution, projectile trajectory, and torque equilibrium $\\sum \\vec{\\tau} = 0$.',
    topic: 'Engineering Mechanics',
    subject: 'Physics I (Physics for Engineering)',
    class_type: 'TD',
    is_shared: 1,
    questions: [
      {
        id: 'p1_q1',
        type: 'multiple_choice',
        question: 'A projectile is launched from ground level with speed $v_0 = 20\\text{ m/s}$ at $\\theta = 45^\\circ$. Neglecting air resistance and using $g = 9.8\\text{ m/s}^2$, what is its maximum range $R$?',
        timeLimit: 30,
        points: 1000,
        explanation: 'For $\\theta = 45^\\circ$, $\\sin(2\\theta) = \\sin(90^\\circ) = 1$. The horizontal range is $R = \\frac{v_0^2 \\sin(2\\theta)}{g} = \\frac{20^2 \\times 1}{9.8} = \\frac{400}{9.8} \\approx 40.8\\text{ m}$.',
        options: [
          { text: '$R \\approx 40.8\\text{ m}$', isCorrect: true },
          { text: '$R \\approx 20.4\\text{ m}$', isCorrect: false },
          { text: '$R \\approx 81.6\\text{ m}$', isCorrect: false },
          { text: '$R \\approx 28.9\\text{ m}$', isCorrect: false }
        ]
      },
      {
        id: 'p1_q2',
        type: 'multiple_choice',
        question: 'For a rigid body to remain in complete static equilibrium, which condition(s) must be satisfied simultaneously?',
        timeLimit: 25,
        points: 1000,
        explanation: 'Both translational equilibrium $\\sum \\vec{F} = \\vec{0}$ and rotational equilibrium $\\sum \\vec{\\tau} = \\vec{0}$ about any pivot point must hold.',
        options: [
          { text: '$\\sum \\vec{F} = \\vec{0}$ and $\\sum \\vec{\\tau} = \\vec{0}$', isCorrect: true },
          { text: 'Only $\\sum \\vec{F} = \\vec{0}$', isCorrect: false },
          { text: 'Only $\\sum \\vec{\\tau} = \\vec{0}$', isCorrect: false },
          { text: 'Constant acceleration $\\vec{a} = \\text{const}$', isCorrect: false }
        ]
      }
    ]
  }
];

const insertStmt = db.prepare(`
  INSERT INTO quizzes (tutor_id, title, description, topic, subject, class_type, questions_json, share_code, is_shared)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const q of masterQuizzes) {
  if (!existingTitles.includes(q.title)) {
    insertStmt.run(
      q.tutor_id,
      q.title,
      q.description,
      q.topic,
      q.subject,
      q.class_type,
      JSON.stringify(q.questions),
      generateShareCode(),
      q.is_shared
    );
    console.log(`Seeded Department Master Quiz: ${q.title} (${q.subject} - ${q.class_type})`);
  } else {
    console.log(`Quiz "${q.title}" already exists, updating share status and subject.`);
    db.prepare(`UPDATE quizzes SET subject = ?, class_type = ?, is_shared = 1 WHERE title = ?`).run(q.subject, q.class_type, q.title);
  }
}

// Make sure all quizzes are shared = 1 for the library
db.prepare('UPDATE quizzes SET is_shared = 1').run();

console.log('Seeding complete! Quizzes in Department Master Library:');
const library = db.prepare('SELECT id, title, subject, class_type, is_shared FROM quizzes').all();
console.table(library);
