import React, { useState, useEffect } from 'react';
import { 
  Users, QrCode, Search, Filter, Calendar, CheckCircle2, 
  Clock, Download, ChevronRight, Plus, Eye, Sparkles, AlertCircle, 
  X, Shield, RefreshCw, Edit2, Trash2, UserPlus, Upload, FileSpreadsheet, Check
} from 'lucide-react';

export default function AttendanceDashboard({ token, onStartAttendanceSession }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  // Modal 1: Roster View & Edit
  const [selectedGroupForRoster, setSelectedGroupForRoster] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Student management inside Roster Modal
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);
  const [showBatchImportForm, setShowBatchImportForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Add / Edit form inputs
  const [inputStudentId, setInputStudentId] = useState('');
  const [inputStudentName, setInputStudentName] = useState('');
  const [inputStudentSex, setInputStudentSex] = useState('M');
  const [inputStudentNumber, setInputStudentNumber] = useState('');
  const [studentActionLoading, setStudentActionLoading] = useState(false);

  // Batch import input
  const [batchRawText, setBatchRawText] = useState('');
  const [batchImportMode, setBatchImportMode] = useState('append'); // 'append' | 'replace'
  const [batchLoading, setBatchLoading] = useState(false);

  // Modal 2: Create New Group
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupDept, setNewGroupDept] = useState('Département de Tronc Commun');
  const [newGroupYear, setNewGroupYear] = useState('2026-2027');
  const [newGroupInitialRoster, setNewGroupInitialRoster] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Modal 3: Launch Attendance Session Setup
  const [launchModalGroup, setLaunchModalGroup] = useState(null);
  const [sessionTitle, setSessionTitle] = useState('Physics Lecture & Attendance');
  const [sessionSubject, setSessionSubject] = useState('Electricity');
  const [sessionClassType, setSessionClassType] = useState('TD');
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [usePasscode, setUsePasscode] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  // Year Level Filter (I2 current, I1 arriving soon)
  const [selectedYearLevel, setSelectedYearLevel] = useState('ALL');

  // Main Tab Navigation: 'groups' | 'history'
  const [mainTab, setMainTab] = useState('groups');

  // Attendance History & Records State
  const [sessionsList, setSessionsList] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySubjectFilter, setHistorySubjectFilter] = useState('ALL');
  const [historyClassTypeFilter, setHistoryClassTypeFilter] = useState('ALL');
  const [historyYearFilter, setHistoryYearFilter] = useState('ALL');

  // Modal 5: Detailed Attendance Sheet Inspection / Editing
  const [viewingSessionDetails, setViewingSessionDetails] = useState(null);
  const [sessionDetailsRoster, setSessionDetailsRoster] = useState([]);
  const [sessionDetailsStats, setSessionDetailsStats] = useState(null);
  const [sessionDetailsLoading, setSessionDetailsLoading] = useState(false);

  // Modal 4: Cohort Batch Import (e.g. Year 1 students arriving soon)
  const [showCohortModal, setShowCohortModal] = useState(false);
  const [cohortRawText, setCohortRawText] = useState('');
  const [cohortYearLevel, setCohortYearLevel] = useState('I1');
  const [cohortAcademicYear, setCohortAcademicYear] = useState('2026-2027');
  const [cohortDept, setCohortDept] = useState('Département de Tronc Commun');
  const [cohortImportLoading, setCohortImportLoading] = useState(false);
  const [cohortImportMsg, setCohortImportMsg] = useState('');

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

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError('');
      const res = await fetch('/api/attendance/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load attendance records');
      const data = await res.json();
      setSessionsList(data);
    } catch (err) {
      setSessionsError(err.message);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleOpenSessionSheet = async (session) => {
    setViewingSessionDetails(session);
    setSessionDetailsLoading(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load session details');
      const data = await res.json();
      setViewingSessionDetails(data.session);
      setSessionDetailsRoster(data.roster);
      setSessionDetailsStats(data.stats);
    } catch (err) {
      alert(err.message);
    } finally {
      setSessionDetailsLoading(false);
    }
  };

  const handleToggleSessionRecordStatus = async (student) => {
    if (!viewingSessionDetails) return;
    const nextStatusMap = {
      ABSENT: 'PRESENT',
      PRESENT: 'LATE',
      LATE: 'EXCUSED',
      EXCUSED: 'ABSENT'
    };
    const newStatus = nextStatusMap[student.status] || 'PRESENT';
    try {
      const res = await fetch(`/api/attendance/sessions/${viewingSessionDetails.id}/records/${student.student_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      setSessionDetailsRoster(prev => prev.map(s => s.student_id === student.student_id ? { ...s, status: newStatus } : s));
      fetchSessions();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteSession = async (session) => {
    if (!window.confirm(`Are you sure you want to delete attendance record for ${session.group_code} (${session.date})?`)) return;
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete session');
      setSessionsList(prev => prev.filter(s => s.id !== session.id));
      if (viewingSessionDetails?.id === session.id) {
        setViewingSessionDetails(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadItcCsv = async (session) => {
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}/export-itc-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ITC_Attendance_${session.group_code}_${(session.subject || 'Physics').replace(/\s+/g, '_')}_${session.class_type || 'TD'}_${session.date || 'Record'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchSessions();
  }, [token]);

  // Open Roster Modal
  const handleOpenRoster = async (group) => {
    setSelectedGroupForRoster(group);
    setShowAddStudentForm(false);
    setShowBatchImportForm(false);
    setEditingStudent(null);
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

  // Reload current roster data
  const reloadRoster = async () => {
    if (!selectedGroupForRoster) return;
    try {
      const res = await fetch(`/api/attendance/groups/${selectedGroupForRoster.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRosterData(data);
        // Also update local groups list count
        setGroups(prev => prev.map(g => g.id === selectedGroupForRoster.id ? { ...g, student_count: data.students.length } : g));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Single Student
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedGroupForRoster || !inputStudentId.trim() || !inputStudentName.trim()) return;

    try {
      setStudentActionLoading(true);
      const res = await fetch(`/api/attendance/groups/${selectedGroupForRoster.id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: inputStudentId.trim(),
          name: inputStudentName.trim(),
          sex: inputStudentSex,
          studentNumber: inputStudentNumber.trim() ? parseInt(inputStudentNumber.trim(), 10) : undefined
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add student');

      setInputStudentId('');
      setInputStudentName('');
      setInputStudentNumber('');
      setShowAddStudentForm(false);
      await reloadRoster();
    } catch (err) {
      alert(err.message);
    } finally {
      setStudentActionLoading(false);
    }
  };

  // Save Edit Student
  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      setStudentActionLoading(true);
      const res = await fetch(`/api/attendance/students/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: inputStudentId.trim(),
          name: inputStudentName.trim(),
          sex: inputStudentSex,
          studentNumber: inputStudentNumber.trim() ? parseInt(inputStudentNumber.trim(), 10) : undefined
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update student');

      setEditingStudent(null);
      await reloadRoster();
    } catch (err) {
      alert(err.message);
    } finally {
      setStudentActionLoading(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (student) => {
    if (!confirm(`Are you sure you want to remove ${student.name} (${student.student_id}) from this group?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/attendance/students/${student.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete student');
      }
      await reloadRoster();
    } catch (err) {
      alert(err.message);
    }
  };

  // Batch Import / Paste Students
  const handleBatchImport = async (e) => {
    e.preventDefault();
    if (!selectedGroupForRoster || !batchRawText.trim()) return;

    try {
      setBatchLoading(true);
      const res = await fetch(`/api/attendance/groups/${selectedGroupForRoster.id}/batch-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText: batchRawText,
          mode: batchImportMode
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch import failed');

      alert(json.message);
      setBatchRawText('');
      setShowBatchImportForm(false);
      await reloadRoster();
    } catch (err) {
      alert(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  // Create New Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupCode.trim()) return;

    try {
      setCreatingGroup(true);
      const res = await fetch('/api/attendance/groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code: newGroupCode.trim(),
          department: newGroupDept.trim(),
          academicYear: newGroupYear.trim()
        })
      });

      const groupJson = await res.json();
      if (!res.ok) throw new Error(groupJson.error || 'Failed to create group');

      // If initial roster was pasted, import it immediately
      if (newGroupInitialRoster.trim()) {
        await fetch(`/api/attendance/groups/${groupJson.id}/batch-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ rawText: newGroupInitialRoster, mode: 'append' })
        });
      }

      setShowCreateGroupModal(false);
      setNewGroupCode('');
      setNewGroupInitialRoster('');
      await fetchGroups();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingGroup(false);
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
          subject: sessionSubject,
          classType: sessionClassType,
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

  // Cohort Import Handler (e.g. Year 1 incoming cohort)
  const handleCohortImport = async (e) => {
    e.preventDefault();
    if (!cohortRawText.trim()) return;

    try {
      setCohortImportLoading(true);
      setCohortImportMsg('');
      const res = await fetch('/api/attendance/cohort-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rawText: cohortRawText,
          yearLevel: cohortYearLevel,
          academicYear: cohortAcademicYear,
          department: cohortDept
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import cohort');

      setCohortImportMsg(`🎉 ${data.message}`);
      setCohortRawText('');
      await fetchGroups();
      setTimeout(() => {
        setShowCohortModal(false);
        setCohortImportMsg('');
      }, 2500);
    } catch (err) {
      alert(err.message);
    } finally {
      setCohortImportLoading(false);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          g.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || g.code.includes(`-${selectedDept}-`);
    const groupYear = g.year_level || (g.code.startsWith('I1-') ? 'I1' : 'I2');
    const matchesYear = selectedYearLevel === 'ALL' || groupYear === selectedYearLevel;
    return matchesSearch && matchesDept && matchesYear;
  });

  const totalStudents = groups.reduce((acc, g) => acc + (g.student_count || 0), 0);
  const i2Count = groups.filter(g => (g.year_level || (g.code.startsWith('I1-') ? 'I1' : 'I2')) === 'I2').length;
  const i1Count = groups.filter(g => (g.year_level || (g.code.startsWith('I1-') ? 'I1' : 'I2')) === 'I1').length;

  const filteredSessions = sessionsList.filter(s => {
    const matchesSearch = !historySearch.trim() ||
      (s.group_code || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (s.title || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (s.tutor_name || '').toLowerCase().includes(historySearch.toLowerCase()) ||
      (s.date || '').includes(historySearch);
    const matchesSubject = historySubjectFilter === 'ALL' || (s.subject || 'Electricity') === historySubjectFilter;
    const matchesType = historyClassTypeFilter === 'ALL' || (s.class_type || 'TD') === historyClassTypeFilter;
    const sYear = s.year_level || (s.group_code?.startsWith('I1-') ? 'I1' : 'I2');
    const matchesYear = historyYearFilter === 'ALL' || sYear === historyYearFilter;
    return matchesSearch && matchesSubject && matchesType && matchesYear;
  });

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
            Generate dynamic projector QR codes for instant student check-in, manage class rosters, and export official ITC attendance sheets.
          </p>
        </div>

        {/* Quick Stats & Create Group */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-black text-white">{groups.length} Groups</div>
              <div className="text-xs text-slate-400">{totalStudents} Total Students</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCohortModal(true);
              setCohortYearLevel('I1');
            }}
            className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center gap-2 transition transform active:scale-95"
            title="Batch import Year 1 cohort from raw spreadsheet or text"
          >
            <Upload className="w-4 h-4" />
            <span>📥 Import Year 1 Cohort</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateGroupModal(true)}
            className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-2xl shadow-lg flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Class Group</span>
          </button>
        </div>
      </div>

      {/* Main Tabs: Class Rosters vs Attendance History & Records */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setMainTab('groups')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mainTab === 'groups'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Class Groups & Rosters ({groups.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainTab('history');
              fetchSessions();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mainTab === 'history'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>📋 Recorded Attendance Sheets & History</span>
            {sessionsList.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
                {sessionsList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* VIEW 1: CLASS GROUPS & ROSTERS */}
      {mainTab === 'groups' && (
        <div className="space-y-6">
          {/* Filter and Search Bar */}
          <div className="space-y-4">
            {/* Cohort / Year Level Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setSelectedYearLevel('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedYearLevel === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                All Cohorts ({groups.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedYearLevel('I2')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedYearLevel === 'I2'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Year 2 (I2) • {i2Count} Groups
              </button>
              <button
                type="button"
                onClick={() => setSelectedYearLevel('I1')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedYearLevel === 'I1'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                Year 1 (I1) • {i1Count > 0 ? `${i1Count} Groups` : 'Arriving Soon'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by group code (e.g. I2-GCA-A, GCI, GEE)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                      <span>Manage Roster ({g.student_count})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ATTENDANCE HISTORY & SHEETS */}
      {mainTab === 'history' && (
        <div className="space-y-6">
          {/* History Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search past sessions by Group Code, Lecturer, Date, or Title..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={historySubjectFilter}
              onChange={(e) => setHistorySubjectFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Subjects</option>
              <option value="Electricity">⚡ Electricity</option>
              <option value="Mechanics">⚙️ Mechanics</option>
              <option value="Physics I (Physics for Engineering)">📘 Physics I (Physics for Eng.)</option>
              <option value="Physics II">📗 Physics II</option>
              <option value="Vibrations and Waves">🌊 Vibrations and Waves</option>
              <option value="Thermodynamics">🔥 Thermodynamics</option>
            </select>

            <select
              value={historyClassTypeFilter}
              onChange={(e) => setHistoryClassTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Types</option>
              <option value="TD">TD (Recitation)</option>
              <option value="Cours">Cours (Lecture)</option>
              <option value="TP">TP (Lab Practical)</option>
            </select>

            <select
              value={historyYearFilter}
              onChange={(e) => setHistoryYearFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Cohorts</option>
              <option value="I2">Year 2 (I2)</option>
              <option value="I1">Year 1 (I1)</option>
            </select>

            <button
              type="button"
              onClick={fetchSessions}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Sessions List */}
          {sessionsLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400" />
              <p className="text-sm text-slate-400">Loading attendance sheets...</p>
            </div>
          ) : sessionsError ? (
            <div className="p-4 bg-rose-950/40 border border-rose-500/50 rounded-2xl text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{sessionsError}</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Recorded Attendance Sheets Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No sessions match your search. Start a session from the "Class Groups & Rosters" tab using "Take Attendance (QR)".
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map((s) => {
                const total = s.total_students || 0;
                const attendanceRate = total > 0 ? Math.round((s.present_count / total) * 100) : 0;

                return (
                  <div
                    key={s.id}
                    className="p-5 bg-slate-900/85 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
                  >
                    {/* Left: Info */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {s.group_code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {s.subject || 'Electricity'} ({s.class_type || 'TD'})
                        </span>
                        {s.is_active ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>Live Active</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                            Closed
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5" />
                          {s.date || new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {s.title}
                      </h3>

                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2.5">
                        <span>Lecturer: <strong className="text-slate-300">{s.tutor_name || s.tutor_email}</strong></span>
                        <span>•</span>
                        <span>Session Code: <code className="text-indigo-400 font-mono font-bold">{s.session_code}</code></span>
                        {s.passcode && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 font-mono font-semibold">PIN: {s.passcode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle: Breakdown */}
                    <div className="lg:w-72 space-y-1.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Presence</span>
                        </span>
                        <span className="font-black text-emerald-400">
                          {s.present_count} / {total} ({attendanceRate}%)
                        </span>
                      </div>

                      {/* Bar */}
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                        <div style={{ width: `${attendanceRate}%` }} className="bg-emerald-500 h-full" />
                        <div style={{ width: `${total > 0 ? (s.absent_count / total) * 100 : 0}%` }} className="bg-rose-500/80 h-full" />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                        <span className="text-emerald-400 font-semibold">{s.present_count} Present</span>
                        <span className="text-rose-400 font-semibold">{s.absent_count} Absent</span>
                        {s.late_count > 0 && <span className="text-amber-400 font-semibold">{s.late_count} Late</span>}
                        {s.excused_count > 0 && <span className="text-blue-400 font-semibold">{s.excused_count} Excused</span>}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenSessionSheet(s)}
                        className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                        title="View & Edit full attendance sheet"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Sheet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadItcCsv(s)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
                        title="Download official ITC CSV"
                      >
                        <Download className="w-4 h-4 text-teal-400" />
                      </button>

                      {s.is_active === 1 && onStartAttendanceSession && (
                        <button
                          type="button"
                          onClick={() => onStartAttendanceSession(s)}
                          className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 transition flex items-center gap-1"
                          title="Open projector QR screen again"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Screen</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s)}
                        className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
                        title="Delete attendance record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

              {/* Subject (Matière) and Course Type (TD/Cours/TP) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Subject / Matière
                  </label>
                  <select
                    value={sessionSubject}
                    onChange={(e) => setSessionSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
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
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Type de Cours
                  </label>
                  <select
                    value={sessionClassType}
                    onChange={(e) => setSessionClassType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TD">TD (Travaux Dirigés / Recitation)</option>
                    <option value="Cours">Cours (Amphithéâtre / Lecture)</option>
                    <option value="TP">TP (Travaux Pratiques / Lab)</option>
                  </select>
                </div>
              </div>

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
      {/* MODAL 2: Create New Class Group */}
      {/* ======================================================== */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-pop">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Add New Class Group</h3>
                  <p className="text-xs text-slate-400">Register a new class section or recitation group</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Group Code *</label>
                  <input
                    type="text"
                    value={newGroupCode}
                    onChange={(e) => setNewGroupCode(e.target.value.toUpperCase())}
                    placeholder="e.g. I2-GCA-I"
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white uppercase focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Academic Year</label>
                  <input
                    type="text"
                    value={newGroupYear}
                    onChange={(e) => setNewGroupYear(e.target.value)}
                    placeholder="2026-2027"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Department</label>
                <input
                  type="text"
                  value={newGroupDept}
                  onChange={(e) => setNewGroupDept(e.target.value)}
                  placeholder="Département de Tronc Commun"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Initial Student List (Optional)</span>
                  <span className="text-[10px] text-slate-400">Paste rows from Excel or CSV</span>
                </label>
                <textarea
                  rows={4}
                  value={newGroupInitialRoster}
                  onChange={(e) => setNewGroupInitialRoster(e.target.value)}
                  placeholder="1, e20250752, BAN DALIN, F&#10;2, e20250539, BI JACKY, M"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50"
                >
                  {creatingGroup ? 'Creating...' : 'Create Class Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Manage Class Roster & Students */}
      {/* ======================================================== */}
      {selectedGroupForRoster && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] flex flex-col animate-pop">
            {/* Header */}
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

            {/* Roster Controls: Add Student / Paste from Excel */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Enrolled Students:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {rosterData ? rosterData.students.length : 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStudentForm(!showAddStudentForm);
                    setShowBatchImportForm(false);
                    setEditingStudent(null);
                    setInputStudentId('');
                    setInputStudentName('');
                    setInputStudentNumber('');
                    setInputStudentSex('M');
                  }}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBatchImportForm(!showBatchImportForm);
                    setShowAddStudentForm(false);
                    setEditingStudent(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                  <span>Paste from Excel / CSV</span>
                </button>
              </div>
            </div>

            {/* Form A: Add or Edit Student Form */}
            {(showAddStudentForm || editingStudent) && (
              <form
                onSubmit={editingStudent ? handleSaveEditStudent : handleAddStudent}
                className="p-4 bg-slate-950/80 border border-indigo-500/40 rounded-2xl space-y-3 shrink-0 animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-400">
                    {editingStudent ? `Edit Student: ${editingStudent.name}` : '+ Add New Student to Roster'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddStudentForm(false);
                      setEditingStudent(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-400 font-semibold block">No.</label>
                    <input
                      type="number"
                      value={inputStudentNumber}
                      onChange={(e) => setInputStudentNumber(e.target.value)}
                      placeholder="Auto"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[10px] text-slate-400 font-semibold block">Student ID *</label>
                    <input
                      type="text"
                      value={inputStudentId}
                      onChange={(e) => setInputStudentId(e.target.value.toLowerCase())}
                      placeholder="e.g. e20250999"
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-[10px] text-slate-400 font-semibold block">Full Name *</label>
                    <input
                      type="text"
                      value={inputStudentName}
                      onChange={(e) => setInputStudentName(e.target.value)}
                      placeholder="e.g. SOK DARA"
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white uppercase"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-[10px] text-slate-400 font-semibold block">Sex</label>
                    <select
                      value={inputStudentSex}
                      onChange={(e) => setInputStudentSex(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    >
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={studentActionLoading}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition disabled:opacity-50"
                    >
                      {editingStudent ? 'Save Edit' : 'Add Student'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Form B: Batch Import / Paste from Excel */}
            {showBatchImportForm && (
              <form
                onSubmit={handleBatchImport}
                className="p-4 bg-slate-950/80 border border-teal-500/40 rounded-2xl space-y-3 shrink-0 animate-fadeIn"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Paste Roster Rows from Excel or CSV</span>
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Copy the columns (No, ID, Name, Sex) from Excel and paste directly below:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBatchImportForm(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={batchRawText}
                  onChange={(e) => setBatchRawText(e.target.value)}
                  placeholder="29&#9;e20251999&#9;SOK DARA&#9;M&#10;30&#9;e20252000&#9;KEO MONY&#9;F"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="append"
                        checked={batchImportMode === 'append'}
                        onChange={() => setBatchImportMode('append')}
                        className="accent-teal-500"
                      />
                      <span>Append / Update existing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={batchImportMode === 'replace'}
                        onChange={() => setBatchImportMode('replace')}
                        className="accent-teal-500"
                      />
                      <span>Replace entire roster</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={batchLoading}
                    className="py-1.5 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow transition disabled:opacity-50"
                  >
                    {batchLoading ? 'Importing...' : 'Import Students'}
                  </button>
                </div>
              </form>
            )}

            {/* Students Table */}
            {rosterLoading ? (
              <div className="py-20 text-center space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                <p className="text-xs text-slate-400">Loading student roster...</p>
              </div>
            ) : rosterData ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Student ID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3 text-center">Sex</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {rosterData.students.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-800/40 transition group">
                          <td className="py-2 px-3 font-mono text-slate-400">{st.student_number || (idx + 1)}</td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-300">{st.student_id}</td>
                          <td className="py-2 px-3 font-medium text-white">{st.name}</td>
                          <td className="py-2 px-3 text-center font-bold text-slate-400">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${st.sex === 'F' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                              {st.sex}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudent(st);
                                  setShowAddStudentForm(false);
                                  setShowBatchImportForm(false);
                                  setInputStudentId(st.student_id);
                                  setInputStudentName(st.name);
                                  setInputStudentSex(st.sex);
                                  setInputStudentNumber(String(st.student_number || ''));
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                                title="Edit student"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(st)}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                title="Remove student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Changes take effect immediately across all sessions and CSV exports.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedGroupForRoster(null);
                  setRosterData(null);
                }}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: Cohort Batch Import (e.g. Year 1 Incoming Cohort) */}
      {/* ======================================================== */}
      {showCohortModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-pop max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Import Entire Student Cohort</h3>
                  <p className="text-xs text-slate-400">Batch-register all groups & student rosters for Year 1 (I1) or Year 2 (I2)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCohortModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cohortImportMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{cohortImportMsg}</span>
              </div>
            )}

            <form onSubmit={handleCohortImport} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Cohort / Year Level</label>
                  <select
                    value={cohortYearLevel}
                    onChange={(e) => setCohortYearLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-teal-300 font-bold focus:outline-none focus:border-teal-500"
                  >
                    <option value="I1">Year 1 (I1 - Tronc Commun)</option>
                    <option value="I2">Year 2 (I2 - Tronc Commun)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Academic Year</label>
                  <input
                    type="text"
                    value={cohortAcademicYear}
                    onChange={(e) => setCohortAcademicYear(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Department</label>
                  <input
                    type="text"
                    value={cohortDept}
                    onChange={(e) => setCohortDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Paste Student Data / Excel Rows
                  </label>
                  <span className="text-[11px] text-slate-400">Auto-detects classes & IDs</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  You can paste the entire Excel file content from the Tronc Commun administration. Supports headers like <code className="text-teal-400">LISTE D'ABSENT DU GROUPE I1-GCA-A</code> or tabular rows with group code in the first column.
                </p>
                <textarea
                  rows={8}
                  value={cohortRawText}
                  onChange={(e) => setCohortRawText(e.target.value)}
                  placeholder={"LISTE D'ABSENT DU GROUPE I1-GCA-A\n1\te20260001\tSOK Dara\tM\n2\te20260002\tCHAN Bopha\tF\n\nLISTE D'ABSENT DU GROUPE I1-GCI-A\n1\te20260050\tKONG Vicheka\tM"}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCohortModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cohortImportLoading || !cohortRawText.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-600/30 transition transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{cohortImportLoading ? 'Importing Cohort...' : 'Import All Classes & Students'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: Detailed Attendance Sheet Inspection / Editing */}
      {/* ======================================================== */}
      {viewingSessionDetails && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-pop max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {viewingSessionDetails.group_code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {viewingSessionDetails.subject || 'Electricity'} ({viewingSessionDetails.class_type || 'TD'})
                  </span>
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {viewingSessionDetails.date}
                  </span>
                  {viewingSessionDetails.is_active ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Live
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                      Archived
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-black text-white">
                  {viewingSessionDetails.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Enseignant: <strong className="text-slate-300">{viewingSessionDetails.tutor_name || viewingSessionDetails.tutor_email}</strong> • ITC Département de Tronc Commun
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => handleDownloadItcCsv(viewingSessionDetails)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-700 transition"
                  title="Download official ITC CSV format"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Download ITC CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSessionDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Attendance Stats Cards */}
            {sessionDetailsStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Present</div>
                  <div className="text-xl font-black text-white">{sessionDetailsStats.present}</div>
                  <div className="text-[10px] text-emerald-400/80">
                    {sessionDetailsStats.total > 0 ? Math.round((sessionDetailsStats.present / sessionDetailsStats.total) * 100) : 0}% rate
                  </div>
                </div>

                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Absent</div>
                  <div className="text-xl font-black text-white">{sessionDetailsStats.absent}</div>
                  <div className="text-[10px] text-rose-400/80">Missing class</div>
                </div>

                <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Late</div>
                  <div className="text-xl font-black text-white">{sessionDetailsStats.late}</div>
                  <div className="text-[10px] text-amber-400/80">Arrived late</div>
                </div>

                <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl">
                  <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Excused</div>
                  <div className="text-xl font-black text-white">{sessionDetailsStats.excused}</div>
                  <div className="text-[10px] text-blue-400/80">Medical / Authorized</div>
                </div>
              </div>
            )}

            {/* Instruction Tip */}
            <div className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between shrink-0">
              <span>💡 <strong>Click any status pill</strong> (Present, Absent, Late, Excused) to cycle and update a student's status.</span>
              <span className="text-[11px] text-indigo-400 font-mono">{sessionDetailsRoster.length} Students</span>
            </div>

            {/* Roster Table */}
            {sessionDetailsLoading ? (
              <div className="py-20 text-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-400" />
                <p className="text-xs text-slate-400">Loading student attendance records...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3 text-center">Sex</th>
                      <th className="py-2.5 px-3 text-center">Status (Click to toggle)</th>
                      <th className="py-2.5 px-3 text-right">Check-in Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                    {sessionDetailsRoster.map((st, idx) => {
                      const isPresent = st.status === 'PRESENT';
                      const isAbsent = st.status === 'ABSENT';
                      const isLate = st.status === 'LATE';
                      const isExcused = st.status === 'EXCUSED';

                      return (
                        <tr key={st.student_id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-400">{st.student_number || (idx + 1)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{st.student_code}</td>
                          <td className="py-2.5 px-3 font-medium text-white">{st.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              st.sex === 'F' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {st.sex}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSessionRecordStatus(st)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all transform active:scale-95 shadow-sm border ${
                                isPresent
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                  : isLate
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                                  : isExcused
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                              }`}
                              title="Click to cycle status: Present -> Late -> Excused -> Absent"
                            >
                              {st.status}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400 text-[11px]">
                            {st.check_in_time ? (
                              <span>
                                {new Date(st.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({st.method || 'QR'})
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">
                Official records are saved directly in the SQLite database and sync with ITC CSV exports.
              </span>
              <button
                type="button"
                onClick={() => setViewingSessionDetails(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
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
