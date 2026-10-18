import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Users, BookOpen, Play, UserCheck, Calendar,
  Download, ArrowLeft, Search, Filter, Check, Edit2, X,
  Clock, AlertCircle, BarChart3, ChevronRight, Award, RefreshCw, FileSpreadsheet,
  Lock, CheckSquare, Square, AlertTriangle, Sparkles
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

  // Interactive Class Assignment State
  const [editingClassesTutor, setEditingClassesTutor] = useState(null);
  const [assignmentSubject, setAssignmentSubject] = useState('Electricity');
  const [assignmentClassType, setAssignmentClassType] = useState('TD');
  const [availableGroups, setAvailableGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentDeptFilter, setAssignmentDeptFilter] = useState('ALL');
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [savingClasses, setSavingClasses] = useState(false);
  const [transferWarning, setTransferWarning] = useState(null);

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

  // Fetch class groups and their assignment status for the chosen course
  const fetchClassAssignments = async (tutorId, subject, classType) => {
    try {
      setGroupsLoading(true);
      const res = await fetch(`/api/admin/class-assignments?subject=${encodeURIComponent(subject)}&classType=${encodeURIComponent(classType)}&tutorId=${tutorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load class groups');
      
      const groups = data.groups || [];
      setAvailableGroups(groups);

      // Pre-select groups that are currently assigned to this tutor
      const initialSelected = new Set();
      groups.forEach(g => {
        if (g.isAssignedToCurrent) {
          initialSelected.add(g.id);
        }
      });
      setSelectedGroupIds(initialSelected);
      setTransferWarning(null);
    } catch (err) {
      console.error('Failed to load class assignments:', err);
    } finally {
      setGroupsLoading(false);
    }
  };

  // Open Assign Classes Modal
  const handleOpenAssignModal = (tutor) => {
    setEditingClassesTutor(tutor);
    setAssignmentSubject('Electricity');
    setAssignmentClassType('TD');
    setAssignmentSearch('');
    setAssignmentDeptFilter('ALL');
    setTransferWarning(null);
    fetchClassAssignments(tutor.id, 'Electricity', 'TD');
  };

  // Switch Course/Subject in modal
  const handleCourseChange = (newSubject, newType) => {
    setAssignmentSubject(newSubject);
    setAssignmentClassType(newType);
    setTransferWarning(null);
    if (editingClassesTutor) {
      fetchClassAssignments(editingClassesTutor.id, newSubject, newType);
    }
  };

  // Toggle selection for a group
  const handleToggleGroup = (group) => {
    const next = new Set(selectedGroupIds);
    if (next.has(group.id)) {
      next.delete(group.id);
    } else {
      if (group.isTakenByOther) {
        setTransferWarning(`Note: Group ${group.code} is currently assigned to ${group.assignedTutorName}. Checking it will transfer it to ${editingClassesTutor.name}.`);
      }
      next.add(group.id);
    }
    setSelectedGroupIds(next);
  };

  // Select all available groups for current filter
  const handleSelectAllAvailable = (filtered) => {
    const next = new Set(selectedGroupIds);
    filtered.forEach(g => {
      if (!g.isTakenByOther || g.isAssignedToCurrent) {
        next.add(g.id);
      }
    });
    setSelectedGroupIds(next);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedGroupIds(new Set());
  };

  // Save assignments
  const handleSaveAssignments = async (e) => {
    e.preventDefault();
    if (!editingClassesTutor) return;
    try {
      setSavingClasses(true);
      const res = await fetch(`/api/admin/tutors/${editingClassesTutor.id}/assign-classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: assignmentSubject,
          classType: assignmentClassType,
          selectedGroupIds: Array.from(selectedGroupIds)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save class assignments');

      setEditingClassesTutor(null);
      fetchTutors();
      if (selectedTutorId === editingClassesTutor.id) {
        handleInspectTutor(selectedTutorId);
      }
      alert(data.message || 'Class assignments updated successfully!');
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

  // Filter tutors in main list
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

  // Filter groups in assignment modal
  const filteredAssignmentGroups = availableGroups.filter((g) => {
    const q = assignmentSearch.toLowerCase().trim();
    const matchesSearch = !q || g.code.toLowerCase().includes(q) || (g.department || '').toLowerCase().includes(q);
    const matchesDept = assignmentDeptFilter === 'ALL' || g.code.includes(`-${assignmentDeptFilter}-`) || g.code.startsWith(`I2-${assignmentDeptFilter}`);
    return matchesSearch && matchesDept;
  });

  // Distinct department codes for quick filter chips (e.g. GCA, GEE, GIM, GCI, GTI, AMS, GAR, GGG, GIC, GRU, GTR)
  const distinctDepts = ['ALL', 'GCA', 'GEE', 'GIM', 'GCI', 'GTI', 'AMS', 'GAR', 'GGG', 'GIC', 'GRU', 'GTR'];

  // Count total students in currently selected groups
  const totalStudentsSelected = Array.from(selectedGroupIds).reduce((acc, gid) => {
    const g = availableGroups.find(item => item.id === gid);
    return acc + (g?.student_count || 0);
  }, 0);

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
            Assign class sections with live conflict detection, view quiz session results, and inspect recorded class attendance sheets.
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
                          {t.assigned_classes}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {distinctClasses.length > 0 ? (
                        distinctClasses.map((c, idx) => (
                          <span
                            key={idx}
                            className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                              c.is_assigned
                                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                                : 'bg-slate-800/80 border-slate-700/80 text-slate-200'
                            }`}
                          >
                            <span className="font-bold text-white">{c.group_code}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-emerald-400 font-medium">{c.subject} ({c.class_type})</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-[11px] text-slate-400">
                              {c.session_count > 0 ? `${c.session_count} sheets` : 'Assigned'} ({c.student_count} students)
                            </span>
                          </span>
                        ))
                      ) : !hasAssigned ? (
                        <span className="text-xs text-slate-500 italic">No class sections assigned yet. Click "Assign Classes" to set up.</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Assign / Edit Classes Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(t)}
                    className="self-start sm:self-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition shadow-sm active:scale-95"
                    title="Select and assign class groups to this instructor"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{hasAssigned ? 'Edit Assigned Classes' : '+ Assign Classes'}</span>
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

      {/* INTERACTIVE MODAL: Assign Class Sections with Conflict Detection & Tutor Marking */}
      {editingClassesTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col space-y-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                    <Edit2 className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-lg font-black text-white">
                    Assign Classes to {editingClassesTutor.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-bold">
                    {editingClassesTutor.role || 'tutor'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Select course subject and class type below. Classes already taken by other tutors are marked with an amber/red lock.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingClassesTutor(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Select Subject & Course Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-400" />
                  <span>Subject (Matière)</span>
                </label>
                <select
                  value={assignmentSubject}
                  onChange={(e) => handleCourseChange(e.target.value, assignmentClassType)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-amber-400"
                >
                  <option value="Electricity">⚡ Electricity (អគ្គិសនី)</option>
                  <option value="Mechanics">⚙️ Mechanics (មេកានិច)</option>
                  <option value="Physics I (Physics for Engineering)">📘 Physics I (Physics for Engineering)</option>
                  <option value="Physics II">📗 Physics II</option>
                  <option value="Vibrations and Waves">🌊 Vibrations and Waves (រំញ័រ និងរលក)</option>
                  <option value="Thermodynamics">🔥 Thermodynamics (ទែម៉ូឌីណាមិច)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  <span>Course Type</span>
                </label>
                <select
                  value={assignmentClassType}
                  onChange={(e) => handleCourseChange(assignmentSubject, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="TD">TD (Travaux Dirigés / Recitation)</option>
                  <option value="Cours">Cours (Amphithéâtre / Lecture)</option>
                  <option value="TP">TP (Travaux Pratiques / Lab)</option>
                </select>
              </div>
            </div>

            {/* Conflict Warning if taking a group already assigned to someone else */}
            {transferWarning && (
              <div className="p-3 bg-amber-950/50 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{transferWarning}</span>
              </div>
            )}

            {/* Step 2: Search, Department Chips & Selection Toolbar */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    placeholder="Search class group (e.g. GCA, GEE, AMS)..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Selection Actions & Counts */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {selectedGroupIds.size} Selected ({totalStudentsSelected} Students)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectAllAvailable(filteredAssignmentGroups)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition"
                  >
                    Select Available
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Department Quick Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {distinctDepts.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAssignmentDeptFilter(d)}
                    className={`px-2.5 py-0.5 rounded-lg font-bold transition whitespace-nowrap ${
                      assignmentDeptFilter === d
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d === 'ALL' ? 'All Sections' : d}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Class Groups List with Statuses */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl p-3 bg-slate-950/50">
              {groupsLoading ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading class assignments for {assignmentSubject} ({assignmentClassType})...</p>
                </div>
              ) : filteredAssignmentGroups.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No class groups match the search criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredAssignmentGroups.map((group) => {
                    const isSelected = selectedGroupIds.has(group.id);
                    const isTaken = group.isTakenByOther;
                    const isMine = group.isAssignedToCurrent;

                    return (
                      <div
                        key={group.id}
                        onClick={() => handleToggleGroup(group)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between select-none ${
                          isSelected
                            ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/30 shadow-md'
                            : isTaken
                            ? 'bg-slate-900/40 border-slate-800 hover:border-slate-700 opacity-85'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-bold text-white text-sm">{group.code}</div>
                              <div className="text-[10px] text-slate-400">{group.student_count} Students</div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {isMine && isSelected ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Assigned to Tutor
                              </span>
                            ) : isTaken ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-1" title={`Assigned to ${group.assignedTutorName}`}>
                                <Lock className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[80px]">{group.assignedTutorName}</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                Available
                              </span>
                            )}
                          </div>
                        </div>

                        {isTaken && (
                          <div className="text-[10px] text-rose-300/80 mt-2 pt-1 border-t border-slate-800/80">
                            Taken by {group.assignedTutorName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Saving will assign the selected groups for <strong>{assignmentSubject} ({assignmentClassType})</strong> to {editingClassesTutor.name}.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingClassesTutor(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingClasses}
                  onClick={handleSaveAssignments}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-lg transition transform active:scale-95"
                >
                  {savingClasses ? 'Saving Assignments...' : 'Confirm & Save Assignments'}
                </button>
              </div>
            </div>
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
