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
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [usePasscode, setUsePasscode] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

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
            Generate dynamic projector QR codes for instant student check-in, manage class rosters, and export official ITC attendance sheets.
          </p>
        </div>

        {/* Quick Stats & Create Group */}
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
    </div>
  );
}
