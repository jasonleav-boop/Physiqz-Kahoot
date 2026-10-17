import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, BookOpen, Play, UserCheck, Calendar,
  Download, ArrowLeft, Search, Filter, Check, Edit2, X,
  Clock, AlertCircle, BarChart3, ChevronRight, Award, RefreshCw, FileSpreadsheet
} from 'lucide-react';

export default function FacultyReportsView({ token, tutor: currentTutor, onBack }) {
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Selected tutor for deep report inspection
  const [selectedTutorId, setSelectedTutorId] = useState(null);
  const [tutorReports, setTutorReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('quizzes'); // 'quizzes' | 'attendance' | 'quizzes-authored'

  // Edit Assigned Classes Modal
  const [editingClassesTutor, setEditingClassesTutor] = useState(null);
  const [assignedClassesInput, setAssignedClassesInput] = useState('');
  const [savingClasses, setSavingClasses] = useState(false);

  // View specific attendance sheet modal
  const [viewingAttendanceSession, setViewingAttendanceSession] = useState(null);
  const [sheetRoster, setSheetRoster] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  const fetchTutors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/tutors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load faculty list');
      setTutors(data.tutors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTutors();
  }, [token]);

  // Load detailed reports for a selected tutor
  const handleInspectTutor = async (tutorId) => {
    try {
      setSelectedTutorId(tutorId);
      setReportsLoading(true);
      const res = await fetch(`/api/admin/tutors/${tutorId}/full-reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tutor reports');
      setTutorReports(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setReportsLoading(false);
    }
  };

  // Save Assigned Classes
  const handleSaveAssignedClasses = async (e) => {
    e.preventDefault();
    if (!editingClassesTutor) return;
    try {
      setSavingClasses(true);
      const res = await fetch(`/api/admin/tutors/${editingClassesTutor.id}/assigned-classes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ assignedClasses: assignedClassesInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update assigned classes');
      setEditingClassesTutor(null);
      fetchTutors();
      if (selectedTutorId === editingClassesTutor.id) {
        handleInspectTutor(selectedTutorId);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingClasses(false);
    }
  };

  // View specific attendance sheet roster
  const handleViewAttendanceSheet = async (session) => {
    try {
      setViewingAttendanceSession(session);
      setSheetLoading(true);
      const res = await fetch(`/api/attendance/sessions/${session.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load attendance sheet');
      setSheetRoster(data.roster || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSheetLoading(false);
    }
  };

  // Download quiz session CSV
  const handleDownloadQuizCsv = async (sessionId, roomCode) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Session_${roomCode}_Report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.location.href = `/api/sessions/${sessionId}/export-csv?token=${encodeURIComponent(token)}`;
    }
  };

  // Filter tutors
  const filteredTutors = tutors.filter((t) => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = t.name.toLowerCase().includes(query) ||
      t.email.toLowerCase().includes(query) ||
      (t.assigned_classes || '').toLowerCase().includes(query) ||
      (t.classesHandled || []).some(c => c.group_code.toLowerCase().includes(query) || c.subject.toLowerCase().includes(query));

    const matchesRole = roleFilter === 'ALL' || t.role === roleFilter || (roleFilter === 'admin' && t.is_admin);
    return matchesQuery && matchesRole;
  });

  // Department Aggregate Stats
  const totalDepartmentTutors = tutors.length;
  const totalLiveSessions = tutors.reduce((acc, t) => acc + (t.stats?.totalSessions || 0), 0);
  const totalStudentsReached = tutors.reduce((acc, t) => acc + (t.stats?.totalStudents || 0), 0);
  const totalAttendanceSheets = tutors.reduce((acc, t) => acc + (t.stats?.totalAttendanceSessions || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pop">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg mr-1 transition-colors"
              title="Return to Workspace"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Department Oversight • Lead Lecturer & Admin Portal</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Faculty Directory, Classes & Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Track each instructor's assigned class sections, view live quiz session results, and inspect recorded class attendance sheets.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTutors}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 self-start md:self-center transition z-10 border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Instructors</span>
          </div>
          <div className="text-2xl font-black text-white">{totalDepartmentTutors}</div>
          <div className="text-[10px] text-slate-500">Authorized in department</div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quiz Sessions Run</span>
          </div>
          <div className="text-2xl font-black text-white">{totalLiveSessions}</div>
          <div className="text-[10px] text-slate-500">{totalStudentsReached} student participations</div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-violet-400" />
            <span>Attendance Sheets</span>
          </div>
          <div className="text-2xl font-black text-white">{totalAttendanceSheets}</div>
          <div className="text-[10px] text-slate-500">Recorded for Physics classes</div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm space-y-1">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Academic Year</span>
          </div>
          <div className="text-2xl font-black text-white">2026-2027</div>
          <div className="text-[10px] text-slate-500">Tronc Commun (ITC)</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tutor by name, email, class group (e.g. I2-GCA, I1-G02), or subject..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Roles</option>
            <option value="lead">🎓 Lead Lecturers</option>
            <option value="tutor">🧑‍🏫 Section Tutors</option>
            <option value="admin">🛡️ Administrators</option>
          </select>
        </div>
      </div>

      {/* Main Faculty List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredTutors.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-2">
          <Users className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">No Tutors Match Your Filter</h3>
          <p className="text-xs text-slate-400">Try clearing your search query or selecting "All Roles".</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTutors.map((t) => {
            const isPrimary = t.email.toLowerCase() === 'jasonleav@gmail.com';
            const distinctClasses = t.classesHandled || [];
            const hasAssigned = !!(t.assigned_classes && t.assigned_classes.trim());

            return (
              <div
                key={t.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 shadow-lg transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Tutor Identity */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                        {t.name ? t.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <span className="text-base font-bold text-white">{t.name}</span>
                      {isPrimary ? (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Primary Admin
                        </span>
                      ) : (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          t.role === 'lead'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : t.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                        }`}>
                          {t.role === 'lead' ? '🎓 Lead Lecturer' : t.role === 'admin' ? '🛡️ Administrator' : '🧑‍🏫 Section Tutor'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 pl-10">{t.email}</div>
                  </div>

                  {/* Activity Summary Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{t.stats?.totalQuizzes || 0} Quizzes ({t.stats?.sharedQuizzes || 0} Shared)</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.stats?.totalSessions || 0} Sessions ({t.stats?.totalStudents || 0} Students)</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-violet-500/10 text-violet-300 border border-violet-500/20 text-xs font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-violet-400" />
                      <span>{t.stats?.totalAttendanceSessions || 0} Sheets</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInspectTutor(t.id)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Inspect Reports</span>
                    </button>
                  </div>
                </div>

                {/* Classes Handled & Assigned */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Classes & Sections Handled:
                      </span>
                      {hasAssigned && (
                        <span className="text-[11px] text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          Assigned: {t.assigned_classes}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {distinctClasses.length > 0 ? (
                        distinctClasses.map((c, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 flex items-center gap-1.5"
                          >
                            <span className="font-bold text-white">{c.group_code}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-emerald-400 font-medium">{c.subject} ({c.class_type})</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-[11px] text-slate-400">{c.session_count} sheets ({c.student_count} students)</span>
                          </span>
                        ))
                      ) : !hasAssigned ? (
                        <span className="text-xs text-slate-500 italic">No class sessions recorded yet.</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Edit Assigned Classes Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClassesTutor(t);
                      setAssignedClassesInput(t.assigned_classes || '');
                    }}
                    className="self-start sm:self-center px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition"
                  >
                    <Edit2 className="w-3 h-3 text-amber-400" />
                    <span>{hasAssigned ? 'Edit Assigned' : '+ Assign Classes'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Full Detailed Reports for Selected Tutor */}
      {selectedTutorId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col space-y-5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white">
                    {tutorReports?.tutor?.name || 'Instructor Reports'}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-bold">
                    {tutorReports?.tutor?.role || 'tutor'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {tutorReports?.tutor?.email} • Assigned: {tutorReports?.tutor?.assigned_classes || 'None specified'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setSelectedTutorId(null); setTutorReports(null); }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setActiveReportTab('quizzes')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeReportTab === 'quizzes'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Live Quiz Sessions ({tutorReports?.quizSessions?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('attendance')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeReportTab === 'attendance'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Attendance Sheets ({tutorReports?.attendanceSessions?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('quizzes-authored')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeReportTab === 'quizzes-authored'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Authored Problem Sets ({tutorReports?.quizzes?.length || 0})</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {reportsLoading ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading comprehensive tutor reports...</p>
                </div>
              ) : activeReportTab === 'quizzes' ? (
                /* TAB 1: Quiz Sessions */
                (!tutorReports?.quizSessions || tutorReports.quizSessions.length === 0) ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No live quiz sessions recorded for this tutor yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60">
                    {tutorReports.quizSessions.map((session) => (
                      <div key={session.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{session.quiz_title}</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                              PIN: {session.room_code}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(session.started_at).toLocaleDateString()} {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1 text-slate-300 font-semibold">
                              <Users className="w-3 h-3 text-emerald-400" />
                              {session.total_participants || session.roster_count || 0} Students
                            </span>
                            <span className="flex items-center gap-1 text-amber-300">
                              <Award className="w-3 h-3" />
                              Avg: {Math.round(session.average_score || 0)} pts
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadQuizCsv(session.id, session.room_code)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start sm:self-center transition border border-slate-700"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Gradebook CSV</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : activeReportTab === 'attendance' ? (
                /* TAB 2: Attendance Sheets */
                (!tutorReports?.attendanceSessions || tutorReports.attendanceSessions.length === 0) ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No attendance sessions recorded for this tutor yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/60">
                    {tutorReports.attendanceSessions.map((session) => {
                      const total = session.total_students || 0;
                      const present = session.present_count || 0;
                      const late = session.late_count || 0;
                      const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

                      return (
                        <div key={session.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{session.group_code}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">
                                {session.subject} ({session.class_type})
                              </span>
                              <span className="text-[11px] text-slate-400">{session.title || 'Class Attendance'}</span>
                            </div>

                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {session.date || new Date(session.created_at).toLocaleDateString()}
                              </span>
                              <span className="text-emerald-400 font-semibold">✓ {present} Present</span>
                              {late > 0 && <span className="text-amber-400">⏱ {late} Late</span>}
                              <span className="text-rose-400">✗ {session.absent_count || 0} Absent</span>
                              <span className="font-bold text-slate-300">Rate: {pct}%</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleViewAttendanceSheet(session)}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>View Sheet</span>
                            </button>
                            <a
                              href={`/api/attendance/sessions/${session.id}/export-csv?token=${encodeURIComponent(token)}`}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                              <span>CSV</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* TAB 3: Quizzes Authored */
                (!tutorReports?.quizzes || tutorReports.quizzes.length === 0) ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No quizzes authored by this tutor yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tutorReports.quizzes.map((quiz) => (
                      <div key={quiz.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {quiz.subject || quiz.topic}
                          </span>
                          {quiz.is_shared === 1 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              🏛️ Dept Master Library
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm line-clamp-1">{quiz.title}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>{quiz.questionCount || 0} Questions</span>
                          <span>Code: {quiz.share_code}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setSelectedTutorId(null); setTutorReports(null); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Assigned Classes */}
      {editingClassesTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Assign Class Sections</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingClassesTutor(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Specify the class sections and courses handled by <strong>{editingClassesTutor.name}</strong> (e.g. "I2-G01, I2-G04 (Electricity TD)").
            </p>

            <form onSubmit={handleSaveAssignedClasses} className="space-y-4">
              <input
                type="text"
                value={assignedClassesInput}
                onChange={(e) => setAssignedClassesInput(e.target.value)}
                placeholder="e.g. I2-G01, I2-G02 (Electricity TD), I2-G05 (TP)"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClassesTutor(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClasses}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  {savingClasses ? 'Saving...' : 'Save Assigned Classes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Specific Attendance Sheet Roster */}
      {viewingAttendanceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {viewingAttendanceSession.group_code} • {viewingAttendanceSession.subject} ({viewingAttendanceSession.class_type})
                </h3>
                <p className="text-xs text-slate-400">
                  Date: {viewingAttendanceSession.date} • Taught by {viewingAttendanceSession.tutor_name || 'Tutor'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingAttendanceSession(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-2xl bg-slate-950/60">
              {sheetLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading student roster...</div>
              ) : sheetRoster.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No students recorded in this session.</div>
              ) : (
                sheetRoster.map((s, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-slate-500 w-5">{s.student_number || idx + 1}.</span>
                      <span className="font-mono text-slate-400">{s.student_id}</span>
                      <span className="font-semibold text-white">{s.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      s.status === 'PRESENT'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : s.status === 'LATE'
                        ? 'bg-amber-500/20 text-amber-400'
                        : s.status === 'EXCUSED'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {s.status || 'ABSENT'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setViewingAttendanceSession(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
