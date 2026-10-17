# PhysiKahoot — Real-Time Physics Classroom Polling & Quiz Platform

A high-performance real-time classroom polling and quiz web application designed for physics tutors managing multiple classes and large groups (100+ concurrent students). Built with **Node.js, Express, Socket.io, SQLite, React, KaTeX, and Tailwind CSS**.

---

## 🌟 Key Features

### 1. Multi-Tutor Isolation & Authentication
- **Secure Tutor Accounts:** JWT-authenticated tutor signup & login with bcrypt password hashing.
- **Isolated Sessions & Rosters:** Each tutor's quizzes, active game rooms, student rosters, and historical analytics are completely isolated from other tutors.
- **One-Click Demo Mode:** Instant login with preloaded demo profile (`Dr. Richard Feynman`) and sample AP physics problem sets.

### 2. Advanced Quiz Creator Studio (KaTeX & Diagrams)
- **Question Types:** Multiple-choice (2–4 options), True/False, and Open Polls.
- **LaTeX Math Support:** Real-time **KaTeX** formula parsing for inline (`$E = mc^2$`) and block (`$$\int_{t_1}^{t_2} \vec{F}\,dt = \Delta \vec{p}$$`) formulas in both questions and answer options.
- **Physics Equation Toolbar:** Quick-insert buttons for physics vectors ($\vec{F}, \vec{v}, \vec{a}$), Greek symbols ($\theta, \lambda, \omega, \mu, \Omega$), calculus integrals ($\int$), summations ($\sum$), and fractions.
- **Diagram & Schematic Uploads:** Upload PNG/JPEG physics schematics, free-body diagrams, and circuit diagrams with automatic responsive scaling on desktop and mobile.
- **Quiz Sharing & Backup:** Export quizzes as JSON files, import quiz JSON, or duplicate quizzes across tutors using unique template share codes (e.g. `PHY-MECH`).

### 3. Live Session & Dynamic QR Code Generation
- **Instant Room Generation:** 6-digit numeric room PIN generated with zero collisions.
- **Dynamic Presenter QR Code:** Crisp QR code rendered on the projector screen. Students scan with their phones and join instantly without creating an account.
- **Live Lobby Roster:** Real-time student counter and player badge grid; tutor can kick inappropriate names before starting.

### 4. Real-Time Interactive Gameplay (Socket.io)
- **Tutor Control Panel (Projector View):**
  - Server-synchronized countdown timer with audio feedback.
  - Live response counter (`42 / 50 Answered`).
  - Answer reveal with real-time **distribution bar chart** highlighting the correct answer and response percentages.
  - Detailed physics derivation and explanation notes.
  - Animated **Top-5 Leaderboard** with score animations and flame streaks (`🔥 3 in a row`).
  - Celebratory **3-tier Podium** with gold/silver/bronze pedestals and confetti cannon effects.
- **Student Mobile Interface:**
  - High-contrast, tactile 4-color Kahoot-style buttons (▲ Red, ◆ Blue, ● Yellow, ■ Green).
  - Optional toggle to view question text, physics diagrams, and equations directly on the phone.
  - Instant tactile lock-in feedback preventing accidental double submissions.
  - Real-time score feedback showing points awarded, current rank, and streak counter.

### 5. Historical Analytics & CSV Data Export
- Every completed or in-progress session is persisted in SQLite with full student roster and response telemetry.
- **Question Difficulty Diagnostic:** Accuracy percentage per question helping tutors identify class-wide misconceptions.
- **One-Click CSV Export:** Generates a structured spreadsheet (Rank, Name, Student ID, Total Score, Accuracy %, and per-question choices, response times in seconds, and points) ready for gradebook import.

---

## 🚀 Quick Start Guide

### 1. Start the Platform
```bash
npm start
```
The server will start at:
- **Web App & Presenter Screen:** `http://localhost:5000`
- **Student Direct Join Link:** `http://localhost:5000/join`

### 2. Demo Credentials
- **Email:** `tutor@physics.edu`
- **Password:** `physics123`
- *(Or simply click the green "Instant Demo Tutor Login" button on the login screen!)*

### 3. Running the Automated Simulation Test
To run a full end-to-end simulation of 1 host and 10 concurrent students answering physics questions with KaTeX payloads and exporting CSVs:
```bash
npm test
```

### 4. Development Mode (with Vite Hot-Reload)
To develop frontend and backend with hot-reload:
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend Vite
npm run client:dev
```

---

## 🏛️ Architecture & Tech Stack

```
DTC-Kahoot/
├── client/                     # Vite + React 19 Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── LatexRenderer.jsx   # KaTeX inline ($) and block ($$) parser
│   │   │   ├── EquationToolbar.jsx # Physics math symbol quick-insert keyboard
│   │   │   ├── ImageUploader.jsx   # Diagram & schematic upload handler
│   │   │   ├── LiveBarChart.jsx    # Real-time answer distribution chart
│   │   │   ├── Leaderboard.jsx     # Top-5 leaderboard with streaks
│   │   │   ├── Podium.jsx          # 3-tier podium with confetti
│   │   │   └── Navbar.jsx          # Tutor navigation & profile
│   │   ├── pages/
│   │   │   ├── LoginRegister.jsx   # Multi-tutor auth & demo login
│   │   │   ├── TutorDashboard.jsx  # Quiz manager & session launcher
│   │   │   ├── QuizEditor.jsx      # Advanced Studio with KaTeX live preview
│   │   │   ├── PresenterView.jsx   # Projector / big-screen game view
│   │   │   ├── StudentView.jsx     # Mobile web touch interface
│   │   │   └── SessionReportView.jsx # Class analytics & CSV export
│   │   └── utils/
│   │       └── soundEffects.js     # Web Audio synthesized sound generator
│   └── dist/                   # Production build assets
├── server/                     # Node.js + Express Backend
│   ├── index.js                # Express & Socket.io server
│   ├── db.js                   # SQLite database & seed physics quizzes
│   ├── auth.js                 # JWT auth & bcrypt password hashing
│   ├── routes/
│   │   ├── quizzes.js          # Quiz CRUD, multer diagrams, JSON import/export
│   │   └── sessions.js         # Session history, analytics & CSV export
│   └── game/
│       ├── roomManager.js      # In-memory room state, scoring & persistence
│       └── socketHandlers.js   # Real-time event routing
├── uploads/                    # Statically served physics diagrams
└── scratch/
    └── simulate_game.js        # Automated multi-client test suite
```
