import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Users, Play, FastForward, Trophy, Volume2, VolumeX,
  X, CheckCircle2, HelpCircle, ArrowRight, Sparkles, Smartphone,
  Lock, Unlock, Key, Wifi, Clock
} from 'lucide-react';
import LatexRenderer from '../components/LatexRenderer';
import LiveBarChart from '../components/LiveBarChart';
import Leaderboard from '../components/Leaderboard';
import Podium from '../components/Podium';
import soundEffects from '../utils/soundEffects';

const OPTION_STYLES = [
  { bg: 'bg-red-600', hover: 'hover:bg-red-500', text: 'text-white', icon: '▲', label: 'A' },
  { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', text: 'text-white', icon: '◆', label: 'B' },
  { bg: 'bg-amber-600', hover: 'hover:bg-amber-500', text: 'text-white', icon: '●', label: 'C' },
  { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-500', text: 'text-white', icon: '■', label: 'D' }
];

export default function PresenterView({ socket, initialRoomData, onExitSession }) {
  const [roomCode, setRoomCode] = useState(initialRoomData?.roomCode || '');
  const [sessionId, setSessionId] = useState(initialRoomData?.sessionId || null);
  const [quizTitle, setQuizTitle] = useState(initialRoomData?.quizTitle || 'Physics Quiz');
  const [passcode, setPasscode] = useState(initialRoomData?.passcode || null);
  const [isLocked, setIsLocked] = useState(!!initialRoomData?.isLocked);
  const [sessionMode, setSessionMode] = useState(initialRoomData?.mode || 'LECTURER_PACED');
  const [totalTimeMinutes, setTotalTimeMinutes] = useState(initialRoomData?.totalTimeMinutes || 10);
  const [selfPacedProgress, setSelfPacedProgress] = useState(null);
  const [gameState, setGameState] = useState('LOBBY'); // LOBBY | QUESTION | REVEAL | LEADERBOARD | PODIUM | SELF_PACED_ACTIVE
  const [participants, setParticipants] = useState([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [serverInfo, setServerInfo] = useState(null);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [liveDistribution, setLiveDistribution] = useState({});

  // Reveal state
  const [revealData, setRevealData] = useState(null);

  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState(null);

  // Podium state
  const [podiumData, setPodiumData] = useState(null);

  // QR Code canvas
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Fetch server network configuration
  useEffect(() => {
    fetch('/api/config/server-info')
      .then(res => res.json())
      .then(data => setServerInfo(data))
      .catch(err => console.error('Failed to load server info:', err));
  }, []);

  // Generate QR Code for students to join instantly
  useEffect(() => {
    if (!roomCode) return;
    const isPublicHost = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const baseUrl = isPublicHost ? window.location.origin : (serverInfo?.bestJoinUrl || window.location.origin);
    let joinUrl = `${baseUrl}/join?room=${roomCode}`;
    if (passcode) {
      joinUrl += `&pwd=${encodeURIComponent(passcode)}`;
    }

    QRCode.toDataURL(joinUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [roomCode, passcode, serverInfo]);

  // Setup Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // Student roster update
    socket.on('host:roster-update', ({ participants: roster, totalCount }) => {
      setParticipants(roster || []);
      setTotalParticipants(totalCount || 0);
      soundEffects.tick();
    });

    // Timer tick
    socket.on('timer:tick', ({ timeRemaining: t }) => {
      setTimeRemaining(t);
      if (t <= 5 && t > 0) {
        soundEffects.tick();
      }
    });

    // Question start
    socket.on('question:start', (qData) => {
      setGameState('QUESTION');
      setCurrentQuestion(qData);
      setTimeRemaining(qData.timeLimit || 30);
      setTotalAnswered(0);
      setLiveDistribution({});
      setRevealData(null);
      soundEffects.answerSubmitted();
    });

    // Live answers counter update
    socket.on('host:live-answers-update', ({ totalAnswered: answered, totalParticipants: total, distribution }) => {
      setTotalAnswered(answered);
      setTotalParticipants(total);
      setLiveDistribution(distribution || {});
    });

    // Question reveal
    socket.on('question:reveal', (rData) => {
      setGameState('REVEAL');
      setRevealData(rData);
      setTotalAnswered(rData.totalAnswered);
      soundEffects.correct();
    });

    // Leaderboard update
    socket.on('leaderboard:update', (lbData) => {
      setGameState('LEADERBOARD');
      setLeaderboardData(lbData);
      soundEffects.answerSubmitted();
    });

    // Final podium
    socket.on('game:podium', (pData) => {
      setGameState('PODIUM');
      setPodiumData(pData);
      soundEffects.fanfare();
    });

    // Room lock status update
    socket.on('host:lock-status', ({ isLocked: locked }) => {
      setIsLocked(locked);
    });

    // Self-paced session start
    socket.on('self-paced:started', (data) => {
      setGameState('SELF_PACED_ACTIVE');
      setTimeRemaining(data.totalDurationSeconds);
      setSelfPacedProgress({
        roster: data.roster?.roster || [],
        submittedCount: data.roster?.submittedCount || 0,
        totalParticipants: data.roster?.totalParticipants || 0,
        totalQuestions: data.totalQuestions,
        timeRemaining: data.totalDurationSeconds
      });
    });

    // Self-paced live student progress
    socket.on('host:self-paced-progress', (progress) => {
      setSelfPacedProgress(progress);
      if (typeof progress.timeRemaining === 'number') {
        setTimeRemaining(progress.timeRemaining);
      }
    });

    // All students submitted notification
    socket.on('host:all-submitted', () => {
      soundEffects.correct();
    });

    return () => {
      socket.off('host:roster-update');
      socket.off('timer:tick');
      socket.off('question:start');
      socket.off('host:live-answers-update');
      socket.off('question:reveal');
      socket.off('leaderboard:update');
      socket.off('game:podium');
      socket.off('host:lock-status');
      socket.off('self-paced:started');
      socket.off('host:self-paced-progress');
      socket.off('host:all-submitted');
    };
  }, [socket]);

  // Tutor host controls
  const handleStartGame = () => {
    if (sessionMode === 'STUDENT_PACED') {
      socket.emit('host:start-self-paced', { roomCode });
    } else {
      socket.emit('host:next-question', { roomCode });
    }
  };

  const handleEndSelfPacedEarly = () => {
    if (window.confirm('Are you sure you want to end the student-paced session now? All completed student responses will be graded immediately.')) {
      socket.emit('host:end-self-paced', { roomCode });
    }
  };

  const handleNextQuestion = () => {
    socket.emit('host:next-question', { roomCode });
  };

  const handleEndQuestionEarly = () => {
    socket.emit('host:end-question', { roomCode });
  };

  const handleShowLeaderboard = () => {
    socket.emit('host:show-leaderboard', { roomCode });
  };

  const handleShowPodium = () => {
    socket.emit('host:show-podium', { roomCode });
  };

  const handleKickPlayer = (socketId) => {
    socket.emit('host:kick-player', { roomCode, targetSocketId: socketId });
  };

  const handleToggleLock = () => {
    socket.emit('host:toggle-lock', { roomCode }, (res) => {
      if (res) setIsLocked(res.isLocked);
    });
  };

  const toggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
  };

  const displayHost = serverInfo?.bestJoinUrl ? serverInfo.bestJoinUrl.replace(/^https?:\/\//, '') : window.location.host;

  const formatTime = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 backdrop-blur flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-indigo-600/30 border border-indigo-500/50 rounded-xl text-indigo-300 font-mono text-sm font-black flex items-center gap-2">
            <span>PIN:</span>
            <span className="text-white text-base tracking-widest">{roomCode}</span>
          </div>

          {passcode && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 font-mono text-xs font-bold">
              <Key className="w-3.5 h-3.5" />
              <span>Password: {passcode}</span>
            </div>
          )}

          {isLocked && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Locked</span>
            </div>
          )}

          <h2 className="text-sm sm:text-base font-bold text-slate-300 truncate max-w-xs sm:max-w-md">
            {quizTitle}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSound}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700 transition-colors"
            title={isMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={onExitSession}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded-xl border border-slate-700 transition-colors"
          >
            Exit Session
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 max-w-7xl mx-auto w-full">
        {/* ======================================================== */}
        {/* PHASE 1: LOBBY */}
        {/* ======================================================== */}
        {gameState === 'LOBBY' && (
          <div className="w-full max-w-5xl space-y-8 animate-pop">
            {/* Join Banner with PIN & QR Code */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur">
              {/* Left instructions */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                    <Smartphone className="w-3.5 h-3.5" /> Fast Mobile Entry
                  </div>
                  {sessionMode === 'STUDENT_PACED' ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Student-Paced Problem Set ({totalTimeMinutes} min limit)</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold">
                      <span>👨‍🏫 Lecturer-Paced Discussion</span>
                    </div>
                  )}
                  {serverInfo?.localIp && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-mono">
                      <Wifi className="w-3 h-3 text-emerald-400" />
                      <span>Wi-Fi: {serverInfo.localIp}:{serverInfo.port}</span>
                    </div>
                  )}
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                  Join the Session
                </h1>

                <p className="text-sm text-slate-300 leading-relaxed">
                  Scan the QR code with your phone or open browser to{' '}
                  <span className="font-mono text-indigo-400 font-bold bg-slate-800 px-2 py-0.5 rounded">
                    {displayHost}/join
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Session PIN</div>
                    <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 tracking-widest font-mono">
                      {roomCode}
                    </div>
                  </div>

                  {passcode && (
                    <div className="border-l border-slate-800 pl-6">
                      <div className="text-xs text-amber-400 uppercase font-semibold mb-1 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Room Password
                      </div>
                      <div className="text-3xl sm:text-4xl font-mono font-black text-white bg-slate-800/80 border border-amber-500/40 px-3.5 py-1.5 rounded-2xl">
                        {passcode}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        (Auto-unlocked via QR scan)
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={participants.length === 0}
                    className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform active:scale-95 disabled:opacity-40"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>
                      {sessionMode === 'STUDENT_PACED'
                        ? `Start Problem Set (${participants.length} Ready)`
                        : `Start Quiz (${participants.length} Ready)`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleLock}
                    className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-bold border transition-all ${
                      isLocked
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300 hover:bg-rose-900/60'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isLocked ? <Lock className="w-4 h-4 text-rose-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                    <span>{isLocked ? 'Room Locked (Click to Unlock)' : 'Lock Room'}</span>
                  </button>
                </div>
              </div>

              {/* Right QR Code Display */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-inner">
                {qrDataUrl ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl">
                    <img
                      src={qrDataUrl}
                      alt="Join QR Code"
                      className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl"
                    />
                  </div>
                ) : (
                  <div className="w-60 h-60 bg-slate-800 animate-pulse rounded-2xl" />
                )}
                <span className="text-xs text-slate-400 font-medium mt-3">
                  Scan to auto-enter room code
                </span>
              </div>
            </div>

            {/* Live Joined Student Roster Grid */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">
                    Students in Lobby ({participants.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-400">Hover name to kick</span>
              </div>

              {participants.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
                  <Sparkles className="w-8 h-8 text-indigo-400/50 animate-bounce" />
                  <span>Waiting for students to join...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 max-h-64 overflow-y-auto p-1">
                  {participants.map((p) => (
                    <div
                      key={p.socketId}
                      className="group flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-sm font-bold text-white transition-all transform hover:scale-105"
                    >
                      <span className="text-lg">{p.avatar || '⚛️'}</span>
                      <span>{p.studentName}</span>
                      <button
                        type="button"
                        onClick={() => handleKickPlayer(p.socketId)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-400 transition-opacity ml-1"
                        title="Remove student"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 2: QUESTION */}
        {/* ======================================================== */}
        {gameState === 'QUESTION' && currentQuestion && (
          <div className="w-full max-w-5xl space-y-6 animate-pop">
            {/* Header: Question Meta & Timer */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl px-6 py-4">
              <span className="text-xs sm:text-sm font-extrabold text-indigo-400 uppercase tracking-wider">
                Question {currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
              </span>

              <div className="flex items-center gap-4">
                {/* Answered counter */}
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>
                    <strong className="text-white">{totalAnswered}</strong> / {totalParticipants} Answered
                  </span>
                </div>

                {/* Big Circular Timer */}
                <div className={`flex items-center justify-center w-14 h-14 rounded-2xl font-black text-2xl border-2 shadow-lg transition-all ${
                  timeRemaining <= 5
                    ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
                    : 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                }`}>
                  {timeRemaining}
                </div>

                <button
                  type="button"
                  onClick={handleEndQuestionEarly}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>End Timer</span>
                </button>
              </div>
            </div>

            {/* Question Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur space-y-6 text-center">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-relaxed tracking-tight">
                <LatexRenderer content={currentQuestion.question} />
              </h2>

              {/* Schematic Image if present */}
              {currentQuestion.imageUrl && (
                <div className="flex justify-center py-2">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Physics Diagram"
                    className="max-h-72 max-w-full rounded-2xl border border-slate-700 shadow-xl object-contain bg-slate-950/50 p-2"
                  />
                </div>
              )}
            </div>

            {/* 4 Colored Option Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt, idx) => {
                const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 p-5 rounded-2xl shadow-xl transition-all ${style.bg}`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-black/25 flex items-center justify-center font-black text-xl text-white">
                      {style.icon}
                    </span>
                    <div className="text-base sm:text-lg font-bold text-white flex-1 leading-snug">
                      <LatexRenderer content={opt.text} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 3: REVEAL */}
        {/* ======================================================== */}
        {gameState === 'REVEAL' && revealData && currentQuestion && (
          <div className="w-full max-w-5xl space-y-6 animate-pop">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase">
                  Question {currentQuestion.questionIndex + 1} Review
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Answer Breakdown & Statistics
                </h2>
              </div>

              <button
                type="button"
                onClick={handleShowLeaderboard}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
              >
                <span>View Leaderboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Live Distribution Bar Chart */}
            <LiveBarChart
              distribution={revealData.distribution}
              options={currentQuestion.options}
              correctOptionIndex={revealData.correctOptionIndex}
              revealed={true}
              totalAnswered={revealData.totalAnswered}
              isPoll={currentQuestion.type === 'poll'}
            />

            {/* Physics Explanation Card */}
            {revealData.explanation && (
              <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-6 shadow-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                  <HelpCircle className="w-4 h-4" />
                  <span>Physics Explanation & Derivation:</span>
                </div>
                <div className="text-sm sm:text-base text-slate-200 leading-relaxed font-serif">
                  <LatexRenderer content={revealData.explanation} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 4: LEADERBOARD */}
        {/* ======================================================== */}
        {gameState === 'LEADERBOARD' && leaderboardData && (
          <div className="w-full max-w-3xl space-y-6 animate-pop">
            <Leaderboard
              topList={leaderboardData.topList}
              totalParticipants={leaderboardData.totalParticipants}
            />

            <div className="flex justify-center">
              <button
                type="button"
                onClick={
                  currentQuestion && currentQuestion.questionIndex + 1 >= currentQuestion.totalQuestions
                    ? handleShowPodium
                    : handleNextQuestion
                }
                className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base rounded-2xl shadow-xl shadow-emerald-600/30 transition-all transform active:scale-95"
              >
                <span>
                  {currentQuestion && currentQuestion.questionIndex + 1 >= currentQuestion.totalQuestions
                    ? 'Reveal Final Podium 🏆'
                    : 'Next Question'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 4.5: SELF-PACED ACTIVE CLASS MONITOR */}
        {/* ======================================================== */}
        {gameState === 'SELF_PACED_ACTIVE' && (
          <div className="w-full max-w-6xl space-y-8 animate-pop">
            {/* Top Monitor Dashboard */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" /> Student-Paced Problem Set
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {quizTitle}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Students are solving problems at their own pace on mobile.
                </p>
              </div>

              {/* Big Digital Countdown Timer */}
              <div className="flex flex-col items-center">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Time Remaining</span>
                </div>
                <div className={`px-6 py-3 rounded-2xl font-mono font-black text-4xl sm:text-5xl border-2 shadow-xl tracking-wider transition-all ${
                  timeRemaining <= 60
                    ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse shadow-rose-900/40'
                    : timeRemaining <= 180
                    ? 'bg-amber-950/70 border-amber-500 text-amber-300 shadow-amber-900/30'
                    : 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-indigo-900/30'
                }`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>

              {/* End Early Control Button */}
              <button
                type="button"
                onClick={handleEndSelfPacedEarly}
                className="flex items-center gap-2 px-6 py-3.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-rose-600/30 border border-rose-500 transition-all transform active:scale-95"
              >
                <FastForward className="w-4 h-4" />
                <span>End Activity & Grade</span>
              </button>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Submissions</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                  {selfPacedProgress?.submittedCount || 0} / {selfPacedProgress?.totalParticipants || participants.length}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">Finished & Submitted</span>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Active Solvers</span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
                  {Math.max(0, (selfPacedProgress?.totalParticipants || participants.length) - (selfPacedProgress?.submittedCount || 0))}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">Still Solving</span>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Problems</span>
                <span className="text-2xl sm:text-3xl font-black text-indigo-300 mt-1">
                  {selfPacedProgress?.totalQuestions || 0}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">Custom Tutor Questions</span>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col items-center text-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Room PIN</span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                  {roomCode}
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">Live Session Code</span>
              </div>
            </div>

            {/* Student Live Progress Cards */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">
                    Live Student Problem Progress
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  Updates in real-time as students answer
                </span>
              </div>

              {(!selfPacedProgress?.roster || selfPacedProgress.roster.length === 0) ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
                  <Users className="w-8 h-8 text-indigo-400/50 animate-pulse" />
                  <span>No students in room yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selfPacedProgress.roster.map((st) => {
                    const totalQ = st.totalQuestions || selfPacedProgress.totalQuestions || 1;
                    const answered = st.answeredCount || 0;
                    const percent = Math.min(100, Math.round((answered / totalQ) * 100));

                    return (
                      <div
                        key={st.socketId}
                        className={`p-4 rounded-2xl border transition-all ${
                          st.isSubmitted
                            ? 'bg-emerald-950/30 border-emerald-500/50 shadow-emerald-900/20'
                            : 'bg-slate-800/80 border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="text-2xl">{st.avatar || '⚛️'}</span>
                            <div className="truncate">
                              <div className="font-bold text-sm text-white truncate">
                                {st.studentName}
                              </div>
                              {st.studentId && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ID: {st.studentId}
                                </div>
                              )}
                            </div>
                          </div>

                          {st.isSubmitted ? (
                            <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Submitted
                            </span>
                          ) : (
                            <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> Solving
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-medium">Answered:</span>
                            <span className="font-mono font-bold text-white">
                              {answered} / {totalQ} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-700/60">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                st.isSubmitted
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-indigo-500 to-violet-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PHASE 5: PODIUM */}
        {/* ======================================================== */}
        {gameState === 'PODIUM' && podiumData && (
          <Podium
            podium={podiumData.podium}
            allRankings={podiumData.allRankings}
            sessionId={sessionId}
            onExit={onExitSession}
          />
        )}
      </main>
    </div>
  );
}
