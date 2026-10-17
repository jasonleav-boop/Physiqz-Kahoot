import React, { useState, useEffect } from 'react';
import { 
  Users, QrCode, Search, Filter, Calendar, CheckCircle2, 
  Clock, Download, ChevronRight, Plus, Eye, Sparkles, AlertCircle, X, Shield, RefreshCw
} from 'lucide-react';

export default function AttendanceDashboard({ token, onStartAttendanceSession }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Modal states
  const [selectedGroupForRoster, setSelectedGroupForRoster] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [launchModalGroup, setLaunchModalGroup] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('Physics Lecture & Attendance');
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [usePasscode, setUsePasscode] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  // Departments in Tronc Commun
  const DEPARTMENTS = [
    { key: 'ALL', label: 'All Groups' },
    { key: 'GCA', label: 'GCA (Chemical/Food)' },
    { key: 'GCI', label: 'GCI (Civil)' },
    { key: 'GEE', label: 'GEE (Electrical)' },
    { key: 'GAR', label: 'GAR (Aerospace)' },
    { key: 'AMS', label: 'AMS (Mechanics)' },
    { key: 'GIC', label: 'GIC (Computer Sci)' },
    { key: 'GIM', label: 'GIM (Industrial)' },
    { key: 'GTR', label: 'GTR (Telecom)' },
    { key: 'GTI', label: 'GTI (Info Tech)' },
    { key: 'GGG', label: 'GGG (Geology)' },
    { key: 'GRU', label: 'GRU (Rural)' }
  ];

  const fetchGroups = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/attendance/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load class groups');
      const data = await res.json();
      setGroups(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [token]);

  // View Roster Modal Handler
  const handleOpenRoster = async (group) => {
    setSelectedGroupForRoster(group);
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/attendance/groups/${group.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load roster');
      const data = await res.json();
      setRosterData(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setRosterLoading(false);
    }
  };

  // Launch Attendance Session Handler
  const handleLaunchSession = async (e) => {
    e.preventDefault();
    if (!launchModalGroup) return;

    try {
      setStartingSession(true);
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          groupId: launchModalGroup.id,
          title: sessionTitle.trim() || 'Class Attendance',
          passcode: usePasscode && sessionPasscode.trim() ? sessionPasscode.trim() : ''
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to start session');
      }

      const sessionInfo = await res.json();
      setLaunchModalGroup(null);
      if (onStartAttendanceSession) {
        onStartAttendanceSession(sessionInfo);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setStartingSession(false);
    }
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          g.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || g.code.includes(`-${selectedDept}-`);
    return matchesSearch && matchesDept;
  });

  const totalStudents = groups.reduce((acc, g) => acc + (g.student_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              ITC • Département de Tronc Commun
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Année 2026-2027
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Class Attendance System</span>
            <span className="text-sm font-semibold text-indigo-300 bg-indigo-900/50 px-3 py-1 rounded-xl">
              QR Code & Auto-Check-in
            </span>
          </h1>
          <p className="text-sm text-slate-300">
            Generate dynamic projector QR codes for instant student check-in, or take attendance automatically during class physics quizzes.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white">{groups.length} Groups</div>
              <div className="text-xs text-slate-400">{totalStudents} Total Students</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by group code (e.g. I2-GCA-A, GCI, GEE)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={fetchGroups}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Department Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {DEPARTMENTS.map((dept) => (
            <button
              key={dept.key}
              type="button"
              onClick={() => setSelectedDept(dept.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedDept === dept.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900/70 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>
      </div>

      {/* Class Groups Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          <p className="text-sm text-slate-400">Loading ITC student rosters...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-2xl text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No class groups match your search</h3>
          <p className="text-xs text-slate-400">Try adjusting your search terms or department filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 space-y-4 transition-all hover:shadow-lg group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                    {g.academic_year || '2026-2027'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{g.student_count} Enrolled</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                    {g.code}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{g.department}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setLaunchModalGroup(g);
                    setSessionTitle(`Physics Attendance - ${g.code}`);
                    setUsePasscode(false);
                    setSessionPasscode('');
                  }}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition transform active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Take Attendance (QR)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenRoster(g)}
                  className="w-full py-2 px-3 bg-slate-800/70 hover:bg-slate-800 text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Roster ({g.student_count})</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: Launch Attendance Session Setup */}
      {/* ======================================================== */}
      {launchModalGroup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-pop">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Start Attendance Session</h3>
                  <p className="text-xs text-indigo-400 font-bold">{launchModalGroup.code} • {launchModalGroup.student_count} Students</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLaunchModalGroup(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLaunchSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Session Title</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  required
                  placeholder="e.g. Physics Recitation - Week 4"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Anti-cheat passcode toggle */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>Require 4-Digit In-Class PIN</span>
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Prevents students at home from scanning photos sent via Telegram
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePasscode}
                    onChange={(e) => {
                      setUsePasscode(e.target.checked);
                      if (e.target.checked && !sessionPasscode) {
                        setSessionPasscode(String(Math.floor(1000 + Math.random() * 9000)));
                      }
                    }}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>

                {usePasscode && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-semibold text-slate-400">4-Digit PIN (displayed on screen)</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={sessionPasscode}
                      onChange={(e) => setSessionPasscode(e.target.value)}
                      placeholder="e.g. 4821"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-bold tracking-widest text-lg text-amber-400 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLaunchModalGroup(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingSession}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition transform active:scale-95 disabled:opacity-50"
                >
                  {startingSession ? 'Starting Session...' : 'Open Projector QR →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: View Class Roster & Past History */}
      {/* ======================================================== */}
      {selectedGroupForRoster && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selectedGroupForRoster.code} Roster</h3>
                  <p className="text-xs text-slate-400">
                    {selectedGroupForRoster.department} • Année {selectedGroupForRoster.academic_year || '2026-2027'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupForRoster(null);
                  setRosterData(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {rosterLoading ? (
              <div className="py-20 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                <p className="text-xs text-slate-400">Loading student roster...</p>
              </div>
            ) : rosterData ? (
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                {/* Past Sessions List */}
                {rosterData.pastSessions && rosterData.pastSessions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Past Attendance Sessions</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rosterData.pastSessions.map((ps) => (
                        <div
                          key={ps.id}
                          className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{ps.title || 'Attendance Session'}</div>
                            <div className="text-[11px] text-slate-400">
                              {ps.date} • {ps.present_count} / {ps.total_count} Present ({Math.round((ps.present_count / (ps.total_count || 1)) * 100)}%)
                            </div>
                          </div>
                          <a
                            href={`/api/attendance/sessions/${ps.id}/export-itc-csv?token=${token}`}
                            download
                            className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition"
                            title="Download official ITC CSV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Students Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>Enrolled Students ({rosterData.students.length})</span>
                    </h4>
                  </div>

                  <div className="border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Student ID</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3 text-center">Sex</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                        {rosterData.students.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-2 px-3 font-mono text-slate-400">{st.student_number || (idx + 1)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-indigo-300">{st.student_id}</td>
                            <td className="py-2 px-3 font-medium text-white">{st.name}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-400">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${st.sex === 'F' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                {st.sex}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupForRoster(null);
                  setRosterData(null);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
