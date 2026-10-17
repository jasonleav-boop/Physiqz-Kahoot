import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';
import { 
  CheckCircle2, QrCode, User, Hash, Lock, AlertCircle, 
  Sparkles, ArrowRight, BookOpen, Smartphone, ShieldCheck
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import soundEffects from '../utils/soundEffects';

export default function StudentAttendanceView({ defaultCode = '', onGoToQuiz }) {
  // Query parameters check
  const getInitialCode = () => {
    if (defaultCode) return defaultCode.toUpperCase();
    const params = new URLSearchParams(window.location.search);
    return (params.get('code') || params.get('session') || '').toUpperCase();
  };

  const [sessionCode, setSessionCode] = useState(getInitialCode);
  const [sessionData, setSessionData] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Student inputs
  const [studentInput, setStudentInput] = useState('');
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Check-in Success
  const [checkedInInfo, setCheckedInInfo] = useState(null);

  // Auto-lookup session when sessionCode has 4+ characters
  useEffect(() => {
    const clean = sessionCode.trim().toUpperCase();
    if (clean.length >= 3) {
      lookupSession(clean);
    } else {
      setSessionData(null);
      setSessionError('');
    }
  }, [sessionCode]);

  const lookupSession = async (code) => {
    try {
      setLoadingSession(true);
      setSessionError('');
      const res = await fetch(`/api/attendance/lookup/${code}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Attendance session not found');
      }
      const data = await res.json();
      setSessionData(data);
    } catch (err) {
      setSessionData(null);
      setSessionError(err.message);
    } finally {
      setLoadingSession(false);
    }
  };

  // Live auto-match student against group roster as they type ID or name
  useEffect(() => {
    if (!sessionData || !sessionData.students || !studentInput.trim()) {
      setMatchedStudent(null);
      return;
    }

    const query = studentInput.trim().toLowerCase();
    // First try exact ID match
    let match = sessionData.students.find(s => s.student_id.toLowerCase() === query);
    if (!match) {
      // Try ID starts with or Name includes
      match = sessionData.students.find(s => 
        s.student_id.toLowerCase().includes(query) || 
        s.name.toLowerCase().includes(query)
      );
    }

    setMatchedStudent(match || null);
  }, [studentInput, sessionData]);

  // Handle submit check-in
  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!sessionData) return;

    const studentIdToUse = matchedStudent ? matchedStudent.student_id : studentInput.trim();
    if (!studentIdToUse) {
      setSubmitError('Please enter your Student ID.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError('');

      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: sessionData.sessionCode,
          studentId: studentIdToUse,
          passcode: passcode.trim()
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Check-in failed');
      }

      // Success! Play sound & burst confetti
      soundEffects.play('correct');
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      setCheckedInInfo(json.student);
    } catch (err) {
      soundEffects.play('incorrect');
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white tracking-tight">Techno Physik</span>
            <span className="text-[10px] text-slate-400 block">Class Attendance</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-indigo-500 via-teal-400 to-indigo-500" />

        {checkedInInfo ? (
          /* ======================================================== */
          /* SUCCESS VIEW: Check-in Confirmed */
          /* ======================================================== */
          <div className="text-center space-y-6 py-4 animate-pop">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">Attendance Confirmed!</h2>
              <p className="text-xs text-emerald-400 font-semibold">Your presence has been recorded on the lecturer's screen.</p>
            </div>

            {/* Student details card */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-left space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Student Name</span>
                <span className="text-xs font-bold text-white">{checkedInInfo.name}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Student ID</span>
                <span className="text-xs font-mono font-bold text-indigo-300">{checkedInInfo.studentId}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Class Group</span>
                <span className="text-xs font-bold text-indigo-400">{sessionData?.groupCode}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Check-in Time</span>
                <span className="text-xs font-mono text-slate-300">
                  {new Date(checkedInInfo.checkInTime || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="space-y-2 pt-2">
              {onGoToQuiz && (
                <button
                  type="button"
                  onClick={onGoToQuiz}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Join Class Quiz Activity →</span>
                </button>
              )}
              <a
                href="/join"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition block"
              >
                <span>Go to Student Quiz View</span>
              </a>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* FORM VIEW: Check-in Form */
          /* ======================================================== */
          <form onSubmit={handleCheckIn} className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tight">Class Attendance</h2>
              <p className="text-xs text-slate-400">
                Institut de Technologie du Cambodge • Tronc Commun
              </p>
            </div>

            {/* Step 1: Session Code input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                <span>Attendance Code</span>
              </label>
              <input
                type="text"
                maxLength={6}
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="e.g. TQFL"
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-center font-mono font-black text-xl tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500 uppercase"
              />
            </div>

            {/* Session info banner (when code found) */}
            {sessionData && (
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
                <div>
                  <div className="font-bold text-white">{sessionData.groupCode}</div>
                  <div className="text-[11px] text-indigo-300">{sessionData.title}</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Active ✅
                </span>
              </div>
            )}

            {sessionError && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sessionError}</span>
              </div>
            )}

            {/* Step 2: Student ID input & Auto-Match */}
            {sessionData && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-400" />
                      <span>Student ID (or Name)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. e20250752</span>
                  </label>
                  <input
                    type="text"
                    value={studentInput}
                    onChange={(e) => setStudentInput(e.target.value)}
                    placeholder="Enter e2025XXXX or your name..."
                    required
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Auto-Match Confirmation Card */}
                {matchedStudent && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs animate-pop">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Roster Matched</span>
                      </div>
                      <div className="font-bold text-white text-sm">{matchedStudent.name}</div>
                      <div className="text-[11px] font-mono text-slate-300">
                        ID: {matchedStudent.student_id} • No. {matchedStudent.student_number} ({matchedStudent.sex})
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      ✓
                    </div>
                  </div>
                )}

                {/* Step 3: Passcode (if required by tutor) */}
                {sessionData.requiresPasscode && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>In-Class Security PIN</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter 4-digit PIN from screen..."
                      required
                      className="w-full px-4 py-2.5 bg-slate-950 border border-amber-500/40 rounded-2xl text-center font-mono font-bold text-lg text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                {submitError && (
                  <div className="p-3 bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/30 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Confirming...' : 'Mark Me Present ✅'}</span>
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
