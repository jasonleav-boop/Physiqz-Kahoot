import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { io } from 'socket.io-client';
import { 
  Users, CheckCircle2, XCircle, Clock, Shield, Download, 
  ArrowLeft, RefreshCw, CheckCheck, RotateCcw, Sparkles, AlertCircle, UserPlus, X
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import soundEffects from '../utils/soundEffects';

export default function AttendancePresenterView({ sessionInfo, token, onBack }) {
  const [session, setSession] = useState(null);
  const [roster, setRoster] = useState([]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Quick Add In-Class Student state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickStudentId, setQuickStudentId] = useState('');
  const [quickStudentName, setQuickStudentName] = useState('');
  const [quickStudentSex, setQuickStudentSex] = useState('M');
  const [quickAdding, setQuickAdding] = useState(false);

  const sessionId = sessionInfo.sessionId || sessionInfo.id;
  const sessionCode = sessionInfo.sessionCode;

  // Initialize socket and fetch session data
  useEffect(() => {
    // Generate Join URL for student mobile view
    const origin = window.location.origin;
    const url = `${origin}/attend?code=${sessionCode}`;
    setJoinUrl(url);

    // Generate high-resolution QR code
    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(setQrDataUrl).catch(console.error);

    // Connect socket
    const s = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });
    setSocket(s);

    s.on('connect', () => {
      s.emit('attendance:join-room', { sessionCode });
    });

    s.on('attendance:student-checked-in', ({ student, stats: updatedStats }) => {
      soundEffects.play('join');
      setRoster(prev => prev.map(item => {
        if (item.student_id === student.student_id || item.student_code === student.student_code) {
          return { ...item, status: 'PRESENT', check_in_time: student.check_in_time, method: student.method };
        }
        return item;
      }));
      if (updatedStats) setStats(updatedStats);
    });

    s.on('attendance:record-updated', ({ studentId, status: newStatus, stats: updatedStats }) => {
      setRoster(prev => prev.map(item => {
        if (String(item.student_id) === String(studentId)) {
          return { ...item, status: newStatus };
        }
        return item;
      }));
      if (updatedStats) setStats(updatedStats);
    });

    s.on('attendance:bulk-updated', ({ status: bulkStatus, stats: updatedStats }) => {
      setRoster(prev => prev.map(item => ({ ...item, status: bulkStatus })));
      if (updatedStats) setStats(updatedStats);
    });

    // Fetch initial session & roster details
    fetchSessionDetails();

    return () => {
      s.disconnect();
    };
  }, [sessionId, sessionCode, token]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json();
      setSession(data.session);
      setRoster(data.roster);
      setStats(data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle individual student status manually
  const handleToggleStatus = (student) => {
    const statusCycle = {
      ABSENT: 'PRESENT',
      PRESENT: 'LATE',
      LATE: 'EXCUSED',
      EXCUSED: 'ABSENT'
    };
    const nextStatus = statusCycle[student.status] || 'PRESENT';

    if (socket && socket.connected) {
      socket.emit('attendance:tutor-toggle', {
        sessionCode,
        sessionId,
        studentId: student.student_id,
        status: nextStatus
      });
    } else {
      // Fallback API call
      fetch(`/api/attendance/sessions/${sessionId}/records/${student.student_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      }).then(() => fetchSessionDetails());
    }
  };

  // Mark all students Present or Absent
  const handleBulkMark = (statusToSet) => {
    if (socket && socket.connected) {
      socket.emit('attendance:mark-all', {
        sessionCode,
        sessionId,
        status: statusToSet
      });
    } else {
      fetch(`/api/attendance/sessions/${sessionId}/mark-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: statusToSet })
      }).then(() => fetchSessionDetails());
    }
  };

  // Download official ITC CSV
  const handleDownloadCsv = async () => {
    try {
      setDownloadingCsv(true);
      const res = await fetch(`/api/attendance/sessions/${sessionId}/export-itc-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        window.location.href = `/api/attendance/sessions/${sessionId}/export-itc-csv?token=${token}`;
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ITC_Attendance_${session?.group_code || 'Group'}_${session?.date || 'Date'}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      window.location.href = `/api/attendance/sessions/${sessionId}/export-itc-csv?token=${token}`;
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!quickStudentId.trim() || !quickStudentName.trim()) return;

    try {
      setQuickAdding(true);
      const res = await fetch(`/api/attendance/sessions/${sessionId}/quick-add-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: quickStudentId.trim(),
          name: quickStudentName.trim(),
          sex: quickStudentSex
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add student');

      soundEffects.play('join');
      setShowQuickAddModal(false);
      setQuickStudentId('');
      setQuickStudentName('');
      await fetchSessionDetails();
    } catch (err) {
      alert(err.message);
    } finally {
      setQuickAdding(false);
    }
  };

  const presentPercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition"
            title="Back to Attendance Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {session?.group_code || sessionInfo.groupCode}
              </span>
              <span className="text-[10px] font-semibold text-slate-400">
                {session?.department || 'Département de Tronc Commun'} • {session?.academic_year || '2026-2027'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {session?.title || sessionInfo.title || 'Class Attendance'}
            </h1>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {session?.passcode && (
            <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-300 text-xs font-mono font-bold">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>PIN: {session.passcode}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Export ITC CSV</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Screen: QR Hero + Live Roster Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Projector QR Box) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl flex flex-col items-center text-center">
          <div className="space-y-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Student Mobile Check-In</span>
            <h2 className="text-2xl font-black text-white">Scan with Phone</h2>
            <p className="text-xs text-slate-400">Point normal phone camera to mark presence</p>
          </div>

          {/* QR Code Container with High Contrast */}
          <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-indigo-500/10 border-4 border-indigo-500/20">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Attendance QR Code"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          {/* Room PIN Pill */}
          <div className="w-full p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Or visit on phone browser:</div>
            <div className="text-xs font-mono text-indigo-300 break-all">{joinUrl}</div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-slate-400">Code:</span>
              <span className="font-mono text-xl font-black text-white tracking-widest bg-indigo-600/30 px-3 py-0.5 rounded-lg border border-indigo-500/40">
                {sessionCode}
              </span>
            </div>
          </div>

          {/* Attendance Radial Progress */}
          <div className="w-full p-4 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Attendance Rate</span>
              </span>
              <span className="text-lg font-black text-white">{presentPercentage}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                style={{ width: `${presentPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span className="text-emerald-400 font-bold">{stats.present} Present</span>
              <span className="text-rose-400 font-bold">{stats.absent} Absent</span>
              <span className="text-slate-400">{stats.total} Total</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Student Roster Grid */}
        <div className="lg:col-span-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header with Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Class Roster</span>
                  <span className="text-xs font-bold text-indigo-400 bg-indigo-900/40 px-2.5 py-0.5 rounded-full">
                    {session?.group_code} • {roster.length} Students
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tip: Click any student to cycle status (Present 🟢 / Late 🟡 / Excused 🔵 / Absent ⚪)
                </p>
              </div>

              {/* Bulk mark and Quick Add buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(true)}
                  className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMark('PRESENT')}
                  className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkMark('ABSENT')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Student Cards Grid */}
            {loading ? (
              <div className="py-24 text-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
                <p className="text-xs text-slate-400">Loading student roster...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
                {roster.map((st, idx) => {
                  const isPresent = st.status === 'PRESENT';
                  const isLate = st.status === 'LATE';
                  const isExcused = st.status === 'EXCUSED';

                  return (
                    <div
                      key={st.student_id}
                      onClick={() => handleToggleStatus(st)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-2.5 ${
                        isPresent
                          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-md shadow-emerald-900/20 hover:bg-emerald-900/40'
                          : isLate
                          ? 'bg-amber-950/40 border-amber-500/60 hover:bg-amber-900/40'
                          : isExcused
                          ? 'bg-sky-950/40 border-sky-500/60 hover:bg-sky-900/40'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Number badge */}
                        <span className="w-6 h-6 rounded-lg bg-slate-800/90 text-slate-300 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                          {st.student_number || (idx + 1)}
                        </span>

                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span className="truncate">{st.name}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${st.sex === 'F' ? 'text-pink-300 bg-pink-500/10' : 'text-blue-300 bg-blue-500/10'}`}>
                              {st.sex}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {st.student_code}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="shrink-0 text-right">
                        {isPresent ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Present</span>
                            </span>
                            {st.check_in_time && (
                              <span className="text-[9px] font-mono text-slate-400">
                                {new Date(st.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>Late</span>
                          </span>
                        ) : isExcused ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-sky-400 bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/30">
                            <span>Excused</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            Absent
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-400">
              Total Enrolled: <span className="font-bold text-white">{stats.total}</span> • Present: <span className="font-bold text-emerald-400">{stats.present}</span> • Absent: <span className="font-bold text-rose-400">{stats.absent}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={downloadingCsv}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition transform active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingCsv ? 'Preparing...' : 'Download Official ITC Sheet (.csv)'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Quick Add In-Class Student Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-pop">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Add In-Class Student</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Student ID *</label>
                <input
                  type="text"
                  value={quickStudentId}
                  onChange={(e) => setQuickStudentId(e.target.value.toLowerCase())}
                  placeholder="e.g. e20250999"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Full Name *</label>
                <input
                  type="text"
                  value={quickStudentName}
                  onChange={(e) => setQuickStudentName(e.target.value)}
                  placeholder="e.g. SOK DARA"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Sex</label>
                <select
                  value={quickStudentSex}
                  onChange={(e) => setQuickStudentSex(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAdding}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
                >
                  {quickAdding ? 'Adding...' : 'Add & Mark Present'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
