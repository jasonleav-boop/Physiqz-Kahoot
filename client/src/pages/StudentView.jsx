import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Smartphone, User, Hash, CheckCircle2, XCircle, Flame,
  Trophy, Sparkles, AlertCircle, Eye, EyeOff, Lock, Clock,
  ChevronLeft, ChevronRight, Check, Send
} from 'lucide-react';
import LatexRenderer from '../components/LatexRenderer';
import ThemeToggle from '../components/ThemeToggle';
import soundEffects from '../utils/soundEffects';

const AVATARS = ['⚛️', '🚀', '⚡', '🧲', '🪐', '🔭', '💡', '🔬'];

const BUTTON_THEMES = [
  { bg: 'bg-red-600', active: 'active:bg-red-700', border: 'border-red-500', shadow: 'shadow-red-900/50', icon: '▲', label: 'A' },
  { bg: 'bg-blue-600', active: 'active:bg-blue-700', border: 'border-blue-500', shadow: 'shadow-blue-900/50', icon: '◆', label: 'B' },
  { bg: 'bg-amber-600', active: 'active:bg-amber-700', border: 'border-amber-500', shadow: 'shadow-amber-900/50', icon: '●', label: 'C' },
  { bg: 'bg-emerald-600', active: 'active:bg-emerald-700', border: 'border-emerald-500', shadow: 'shadow-emerald-900/50', icon: '■', label: 'D' }
];

export default function StudentView({ defaultRoomCode = '', onOpenTutorLogin }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomCode, setRoomCode] = useState(defaultRoomCode);
  const [roomPassword, setRoomPassword] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚛️');

  // Game state on student phone: 'ENTRY' | 'LOBBY' | 'QUESTION' | 'SUBMITTED' | 'ROUND_RESULT' | 'LEADERBOARD' | 'PODIUM' | 'SELF_PACED_ACTIVE' | 'SELF_PACED_RESULTS'
  const [state, setState] = useState('ENTRY');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Student profile & stats
  const [quizTitle, setQuizTitle] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState(1);
  const [totalStudents, setTotalStudents] = useState(1);

  // Active question on mobile (Lecturer-Paced)
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [showQuestionText, setShowQuestionText] = useState(true);

  // Student-Paced mode state
  const [isSelfPacedMode, setIsSelfPacedMode] = useState(false);
  const [selfPacedQuestions, setSelfPacedQuestions] = useState([]);
  const [selfPacedCurrentIndex, setSelfPacedCurrentIndex] = useState(0);
  const [selfPacedAnswers, setSelfPacedAnswers] = useState({}); // { [qIdx]: selectedOptionIndex }
  const [isSelfPacedSubmitted, setIsSelfPacedSubmitted] = useState(false);
  const [selfPacedTimeRemaining, setSelfPacedTimeRemaining] = useState(0);
  const [selfPacedResults, setSelfPacedResults] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Read URL parameters for auto room-filling and auto-password from QR code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || params.get('pin');
    if (roomParam) {
      setRoomCode(roomParam);
    }
    const pwdParam = params.get('pwd') || params.get('password') || params.get('passcode');
    if (pwdParam) {
      setRoomPassword(pwdParam);
    }
  }, []);

  // Initialize Socket connection
  useEffect(() => {
    const s = io({ transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    // Kicked by tutor
    s.on('player:kicked', ({ message }) => {
      alert(message || 'You have been removed by the tutor.');
      setState('ENTRY');
    });

    // Question start (Lecturer-Paced)
    s.on('question:start', (qData) => {
      setCurrentQuestion(qData);
      setSelectedOption(null);
      setRoundResult(null);
      setState('QUESTION');
      soundEffects.answerSubmitted();
    });

    // Round result reveal (Lecturer-Paced)
    s.on('student:round-result', (result) => {
      setRoundResult(result);
      setScore(result.newTotalScore);
      setStreak(result.streak);
      setRank(result.rank);
      setTotalStudents(result.totalStudents);
      setState('ROUND_RESULT');

      if (result.isCorrect) {
        soundEffects.correct();
      } else {
        soundEffects.incorrect();
      }
    });

    // Leaderboard
    s.on('leaderboard:update', () => {
      setState('LEADERBOARD');
    });

    // Podium finale
    s.on('game:podium', () => {
      setState('PODIUM');
      soundEffects.fanfare();
    });

    // Self-paced problem set started by tutor
    s.on('self-paced:student-start', (data) => {
      setIsSelfPacedMode(true);
      setSelfPacedQuestions(data.questions || []);
      setSelfPacedTimeRemaining(data.totalDurationSeconds || 600);
      setSelfPacedCurrentIndex(0);
      setSelfPacedAnswers({});
      setIsSelfPacedSubmitted(false);
      setState('SELF_PACED_ACTIVE');
      soundEffects.answerSubmitted();
    });

    // Global countdown timer tick
    s.on('timer:tick', ({ timeRemaining: t }) => {
      setSelfPacedTimeRemaining(t);
      if (t <= 5 && t > 0) {
        soundEffects.tick();
      }
    });

    // Self-paced graded scorecard upon session end
    s.on('self-paced:student-results', (results) => {
      setSelfPacedResults(results);
      setScore(results.score || 0);
      setState('SELF_PACED_RESULTS');
      soundEffects.fanfare();
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Join Room
  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !studentName.trim()) {
      setError('Please enter both Room PIN and your Name.');
      return;
    }

    if (!socket || !connected) {
      setError('Connecting to server... Please try again in a moment.');
      return;
    }

    setError('');
    setJoining(true);

    socket.emit(
      'student:join-room',
      {
        roomCode: roomCode.trim(),
        studentName: studentName.trim(),
        studentId: studentId.trim(),
        avatar: selectedAvatar,
        passcode: roomPassword.trim()
      },
      (res) => {
        setJoining(false);
        if (res.error) {
          setError(res.error);
          return;
        }

        setQuizTitle(res.quizTitle);
        setScore(res.participant.score || 0);
        setStreak(res.participant.streak || 0);

        if (res.mode === 'STUDENT_PACED' || res.gameState === 'SELF_PACED_ACTIVE') {
          setIsSelfPacedMode(true);
        }

        if (res.selfPacedData) {
          setIsSelfPacedMode(true);
          setSelfPacedQuestions(res.selfPacedData.questions || []);
          setSelfPacedTimeRemaining(res.selfPacedData.timeRemaining || res.selfPacedData.totalDurationSeconds || 600);
          setSelfPacedAnswers(res.selfPacedData.existingAnswers || {});
          setIsSelfPacedSubmitted(!!res.selfPacedData.isSubmitted);
          setSelfPacedCurrentIndex(0);
          setState('SELF_PACED_ACTIVE');
        } else if (res.gameState === 'QUESTION' && res.currentQuestion) {
          setCurrentQuestion(res.currentQuestion);
          setState('QUESTION');
        } else {
          setState('LOBBY');
        }
      }
    );
  };

  const formatTime = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Change or select an answer in Student-Paced mode
  const handleSelectSelfPacedAnswer = (optIndex) => {
    if (isSelfPacedSubmitted) return;

    setSelfPacedAnswers((prev) => ({
      ...prev,
      [selfPacedCurrentIndex]: optIndex
    }));
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 800);
    soundEffects.tick();

    if (socket) {
      socket.emit('student:update-self-paced-answer', {
        roomCode,
        questionIndex: selfPacedCurrentIndex,
        selectedOption: optIndex
      });
    }
  };

  // Submit all answers in Student-Paced mode
  const handleConfirmSubmitSelfPaced = () => {
    setShowSubmitModal(false);
    if (!socket) return;

    socket.emit('student:submit-self-paced', { roomCode }, (res) => {
      if (res && res.success) {
        setIsSelfPacedSubmitted(true);
        soundEffects.correct();
      } else if (res && res.error) {
        alert(res.error);
      }
    });
  };

  // Submit Answer Choice (Lecturer-Paced)
  const handleOptionSelect = (optionIndex) => {
    if (state !== 'QUESTION' || selectedOption !== null) return;

    setSelectedOption(optionIndex);
    setState('SUBMITTED');
    soundEffects.answerSubmitted();

    socket.emit('student:submit-answer', {
      roomCode,
      selectedOption: optionIndex
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white max-w-lg mx-auto shadow-2xl">
      {/* Mobile Header Bar */}
      <header className="px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl">{selectedAvatar}</span>
          <div>
            <div className="text-xs font-bold text-white truncate max-w-[130px]">
              {studentName || 'Student'}
            </div>
            {roomCode && state !== 'ENTRY' && (
              <span className="text-[10px] text-slate-400 font-mono">PIN: {roomCode}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="scale-90" />

          {state !== 'ENTRY' && (
            <div className="text-right">
              <span className="text-sm font-black text-indigo-400">
                {score.toLocaleString()} <span className="text-[10px] text-slate-400">pts</span>
              </span>
              {streak >= 2 && (
                <div className="flex items-center justify-end gap-0.5 text-[10px] font-bold text-orange-400">
                  <Flame className="w-3 h-3 fill-orange-400" />
                  <span>{streak} Streak</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center p-4">
        {/* ======================================================== */}
        {/* VIEW 1: JOIN FORM */}
        {/* ======================================================== */}
        {state === 'ENTRY' && (
          <div className="w-full space-y-6 animate-pop py-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 mx-auto mb-2">
                <Smartphone className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Join Physics Quiz</h1>
              <p className="text-xs text-slate-400">Enter session PIN to participate in the class activity</p>
            </div>

            <form onSubmit={handleJoin} className="space-y-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Session PIN *
                </label>
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="6-digit PIN"
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-lg font-mono text-center tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 uppercase font-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Room Password</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">If required by tutor</span>
                </label>
                <input
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Leave blank or enter room password"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Isaac Newton"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>School ID / Student ID</span>
                  <span className="text-[10px] text-slate-500 font-normal">For gradebook credit</span>
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. S10294 or PHY101-042"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Pick Your Physics Avatar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`text-2xl py-2 rounded-xl border transition-all ${
                        selectedAvatar === av
                          ? 'bg-indigo-600/30 border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
                          : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 rounded-xl text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform active:scale-95 disabled:opacity-50"
              >
                {joining ? 'Connecting to Room...' : 'Join Class Activity'}
              </button>

              <div className="text-center pt-2">
                <a
                  href="/"
                  onClick={(e) => {
                    if (onOpenTutorLogin) {
                      e.preventDefault();
                      onOpenTutorLogin();
                    }
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  Are you an instructor? Tutor Dashboard →
                </a>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: LOBBY WAITING */}
        {/* ======================================================== */}
        {state === 'LOBBY' && (
          <div className="w-full text-center space-y-6 animate-pop py-8">
            <div className="text-6xl animate-bounce mb-2">{selectedAvatar}</div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">You're in!</h2>
              <p className="text-xs text-slate-400">See your nickname on the presenter's screen</p>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl max-w-xs mx-auto space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Quiz Session</span>
              <div className="text-sm font-bold text-indigo-300">{quizTitle || 'Live Physics Session'}</div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {isSelfPacedMode
                  ? 'Student-Paced Problem Set — Waiting for tutor to launch...'
                  : 'Waiting for tutor to start the questions...'}
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: QUESTION (Large 4-Color Buttons) */}
        {/* ======================================================== */}
        {state === 'QUESTION' && currentQuestion && (
          <div className="w-full flex flex-col justify-between h-full space-y-4 animate-pop py-2">
            {/* Question prompt header toggle */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-indigo-400 uppercase">
                  Q{currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuestionText(!showQuestionText)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                >
                  {showQuestionText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showQuestionText ? 'Hide Question' : 'View Question'}</span>
                </button>
              </div>

              {showQuestionText && (
                <div className="text-sm font-bold text-white leading-relaxed">
                  <LatexRenderer content={currentQuestion.question} />
                  {currentQuestion.imageUrl && (
                    <div className="mt-2 flex justify-center">
                      <img
                        src={currentQuestion.imageUrl}
                        alt="Question schematic"
                        className="max-h-36 rounded-lg border border-slate-700 object-contain bg-slate-950 p-1"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer Touch Buttons (Large, Fast Mobile Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-[300px]">
              {currentQuestion.options.map((opt, idx) => {
                const theme = BUTTON_THEMES[idx % BUTTON_THEMES.length];
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOptionSelect(idx)}
                    className={`flex items-center gap-3 p-4 rounded-2xl shadow-lg border-2 ${theme.bg} ${theme.border} ${theme.shadow} ${theme.active} transform active:scale-95 transition-all text-left group`}
                  >
                    <span className="w-12 h-12 rounded-xl bg-black/25 flex items-center justify-center font-black text-2xl text-white shrink-0">
                      {theme.icon}
                    </span>
                    <div className="text-base sm:text-lg font-bold text-white flex-1 leading-snug">
                      <LatexRenderer content={opt.text} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: SUBMITTED (Locked In) */}
        {/* ======================================================== */}
        {state === 'SUBMITTED' && (
          <div className="w-full text-center space-y-6 animate-pop py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl animate-pulse">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">Answer Locked In!</h2>
              <p className="text-xs text-slate-400">Waiting for other students and timer...</p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs mx-auto">
              <span className="text-xs text-slate-400">Selected Option:</span>
              <div className="text-lg font-bold text-indigo-400 mt-1">
                Option {String.fromCharCode(65 + (selectedOption ?? 0))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: ROUND RESULT (Points & Streaks) */}
        {/* ======================================================== */}
        {state === 'ROUND_RESULT' && roundResult && (
          <div className="w-full text-center space-y-6 animate-pop py-8">
            {roundResult.isCorrect ? (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl shadow-emerald-500/30">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-emerald-400 tracking-tight">Correct!</h2>
                  <div className="text-xl font-extrabold text-white">
                    +{roundResult.pointsAwarded.toLocaleString()} <span className="text-xs text-slate-400">points</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 mx-auto shadow-2xl">
                  <XCircle className="w-12 h-12" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-rose-400 tracking-tight">Incorrect</h2>
                  <p className="text-xs text-slate-400">No points this round. Don't worry, keep pushing!</p>
                </div>
              </div>
            )}

            {/* Rank and streak info */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Your Rank</span>
                <div className="text-lg font-black text-white">
                  #{roundResult.rank} <span className="text-xs text-slate-500">/ {roundResult.totalStudents}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Streak</span>
                <div className="text-lg font-black text-orange-400 flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4 fill-orange-400" />
                  <span>{roundResult.streak}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Look at presenter's screen for explanation and leaderboard.
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 6: LEADERBOARD WAITING */}
        {/* ======================================================== */}
        {state === 'LEADERBOARD' && (
          <div className="w-full text-center space-y-6 animate-pop py-12">
            <Trophy className="w-14 h-14 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">Leaderboard Update</h2>
              <p className="text-xs text-slate-400">Check the presenter screen to see who's in top 5!</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs mx-auto">
              <span className="text-xs text-slate-400">Your Current Score:</span>
              <div className="text-2xl font-black text-indigo-400 mt-1">{score.toLocaleString()} pts</div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 7: PODIUM FINALE */}
        {/* ======================================================== */}
        {state === 'PODIUM' && (
          <div className="w-full text-center space-y-6 animate-pop py-10">
            <div className="text-5xl animate-bounce">🏆</div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white">Quiz Completed!</h2>
              <p className="text-xs text-slate-400">Great effort today in physics recitation!</p>
            </div>

            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl max-w-xs mx-auto space-y-2">
              <span className="text-xs text-slate-400 uppercase font-semibold">Final Score</span>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-indigo-300">
                {score.toLocaleString()} pts
              </div>
            </div>

            <button
              type="button"
              onClick={() => setState('ENTRY')}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
            >
              Join Another Class Activity
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 8: SELF-PACED ACTIVE PROBLEM SET */}
        {/* ======================================================== */}
        {state === 'SELF_PACED_ACTIVE' && selfPacedQuestions.length > 0 && (
          <div className="w-full flex flex-col justify-between space-y-4 animate-pop py-2">
            {/* Top Bar: Progress & Countdown */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">
                  Answered: <strong className="text-emerald-400 font-mono">{Object.keys(selfPacedAnswers).length}</strong> / {selfPacedQuestions.length}
                </span>
                {saveToast && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse flex items-center gap-1 font-semibold">
                    <Check className="w-2.5 h-2.5" /> Saved
                  </span>
                )}
              </div>

              {/* Countdown badge */}
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-bold text-xs border ${
                selfPacedTimeRemaining <= 60
                  ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
                  : selfPacedTimeRemaining <= 180
                  ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-indigo-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTime(selfPacedTimeRemaining)}</span>
              </div>
            </div>

            {/* If student submitted: show Waiting Screen */}
            {isSelfPacedSubmitted ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto shadow-xl">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white">Problem Set Submitted!</h2>
                  <p className="text-xs text-slate-400">
                    Your answers are saved. You answered {Object.keys(selfPacedAnswers).length} of {selfPacedQuestions.length} problems.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 max-w-xs mx-auto space-y-2">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Session Clock</div>
                  <div className="text-3xl font-mono font-black text-indigo-400">
                    {formatTime(selfPacedTimeRemaining)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Scorecard and class rankings will appear as soon as the session concludes.
                  </div>
                </div>

                <div className="text-xs text-slate-500 italic">
                  Keep this tab open — results will display automatically!
                </div>
              </div>
            ) : (
              <>
                {/* Horizontal Question Switcher Ribbon [1] [2] ... [N] */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-md">
                  <div className="text-[11px] font-bold text-slate-400 mb-2 px-1 flex items-center justify-between">
                    <span>Jump to Problem:</span>
                    <span className="text-[10px] text-indigo-400">Tap any number to switch</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {selfPacedQuestions.map((q, idx) => {
                      const isAnswered = selfPacedAnswers[idx] !== undefined;
                      const isActive = selfPacedCurrentIndex === idx;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelfPacedCurrentIndex(idx)}
                          className={`min-w-[40px] h-10 rounded-xl font-mono text-xs font-black transition-all flex flex-col items-center justify-center relative ${
                            isActive
                              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 scale-105 shadow-md'
                              : isAnswered
                              ? 'bg-emerald-950/60 border border-emerald-500 text-emerald-300 hover:bg-emerald-900/50'
                              : 'bg-slate-800/80 border border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>{idx + 1}</span>
                          {isAnswered && !isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 -mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Problem Card */}
                {(() => {
                  const currentQ = selfPacedQuestions[selfPacedCurrentIndex];
                  if (!currentQ) return null;
                  const currentSelected = selfPacedAnswers[selfPacedCurrentIndex];

                  return (
                    <div className="space-y-4">
                      {/* Problem Header & Text */}
                      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-xs font-black uppercase tracking-wider">
                            Problem {selfPacedCurrentIndex + 1} of {selfPacedQuestions.length}
                          </span>
                          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold">
                            Worth {currentQ.points || 10} pts
                          </span>
                        </div>

                        <div className="text-base font-bold text-white leading-relaxed pt-1">
                          <LatexRenderer content={currentQ.question} />
                        </div>

                        {currentQ.imageUrl && (
                          <div className="flex justify-center pt-2">
                            <img
                              src={currentQ.imageUrl}
                              alt="Problem diagram"
                              className="max-h-48 rounded-xl border border-slate-700 object-contain bg-slate-950 p-1.5"
                            />
                          </div>
                        )}
                      </div>

                      {/* 4 Colored Option Cards */}
                      <div className="grid grid-cols-1 gap-2.5">
                        {currentQ.options.map((opt, optIdx) => {
                          const isSelected = currentSelected === optIdx;
                          const theme = BUTTON_THEMES[optIdx % BUTTON_THEMES.length];

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectSelfPacedAnswer(optIdx)}
                              className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 transition-all text-left transform active:scale-[0.98] ${
                                isSelected
                                  ? `${theme.bg} border-white shadow-xl ring-2 ring-white/60`
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200'
                              }`}
                            >
                              <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shrink-0 transition-colors ${
                                isSelected ? 'bg-black/30 text-white' : `${theme.bg} text-white`
                              }`}>
                                {theme.icon}
                              </span>

                              <div className="flex-1 font-semibold text-sm sm:text-base leading-snug">
                                <LatexRenderer content={opt.text} />
                              </div>

                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shrink-0 font-black shadow">
                                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Bottom Prev / Next / Submit Controls */}
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelfPacedCurrentIndex(prev => Math.max(0, prev - 1))}
                          disabled={selfPacedCurrentIndex === 0}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Previous</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowSubmitModal(true)}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all transform active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit All ({Object.keys(selfPacedAnswers).length}/{selfPacedQuestions.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelfPacedCurrentIndex(prev => Math.min(selfPacedQuestions.length - 1, prev + 1))}
                          disabled={selfPacedCurrentIndex === selfPacedQuestions.length - 1}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 9: SELF-PACED FINAL RESULTS */}
        {/* ======================================================== */}
        {state === 'SELF_PACED_RESULTS' && selfPacedResults && (
          <div className="w-full text-center space-y-6 animate-pop py-6">
            <div className="text-5xl animate-bounce">🏆</div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white">Activity Completed!</h2>
              <p className="text-xs text-slate-400">Here is your problem set score and breakdown</p>
            </div>

            {/* Scorecard */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm mx-auto space-y-4 shadow-xl">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Total Points Earned</span>
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-emerald-300 to-indigo-300 mt-1">
                  {selfPacedResults.score.toLocaleString()} <span className="text-base text-slate-400">pts</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Correct Count</span>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    {selfPacedResults.correctCount} / {selfPacedResults.totalQuestions}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Class Rank</span>
                  <div className="text-lg font-black text-amber-300 mt-0.5">
                    #{selfPacedResults.rank} <span className="text-xs text-slate-500">/ {selfPacedResults.totalStudents}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setState('ENTRY');
                setIsSelfPacedMode(false);
                setSelfPacedResults(null);
                setSelfPacedAnswers({});
                setIsSelfPacedSubmitted(false);
              }}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 shadow"
            >
              Join Another Class Activity
            </button>
          </div>
        )}
      </main>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-pop">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Submit Problem Set?</h3>
              <p className="text-xs text-slate-400">
                You have answered <strong className="text-emerald-400">{Object.keys(selfPacedAnswers).length}</strong> of{' '}
                <strong className="text-white">{selfPacedQuestions.length}</strong> questions.
              </p>
            </div>

            {Object.keys(selfPacedAnswers).length < selfPacedQuestions.length && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Notice: You still have {selfPacedQuestions.length - Object.keys(selfPacedAnswers).length} unanswered question(s).
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
              >
                Keep Working
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitSelfPaced}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Yes, Submit Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
