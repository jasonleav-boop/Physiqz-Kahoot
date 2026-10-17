import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Plus, Download, Upload, Copy, Check, Trash2, Edit3,
  Share2, Sparkles, BookOpen, Clock, AlertCircle, Lock, Key, Bot, Loader2,
  ShieldCheck, Users, UserPlus, UserX, X
} from 'lucide-react';

export default function TutorDashboard({
  token,
  tutor,
  onStartSession,
  onEditQuiz,
  onCreateQuiz
}) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [importCodeModal, setImportCodeModal] = useState(false);
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Live Session Launch Modal (with optional room passcode and session mode)
  const [launchModalQuiz, setLaunchModalQuiz] = useState(null);
  const [roomPasscode, setRoomPasscode] = useState('');
  const [sessionMode, setSessionMode] = useState('LECTURER_PACED');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(10);

  // AI Quiz Generator (Gemini Pro) Modal
  const [aiModal, setAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('Newton\'s Laws & Friction');
  const [aiDifficulty, setAiDifficulty] = useState('AP Physics 1');
  const [aiCount, setAiCount] = useState(3);
  const [aiApiKey, setAiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [aiLoading, setAiLoading] = useState(false);

  // Admin & Lead Lecturer Permissions
  const isAdmin = tutor?.is_admin || (tutor?.email?.toLowerCase() === 'jasonleav@gmail.com') || (tutor?.role === 'admin');
  const isLeadLecturer = isAdmin || (tutor?.role === 'lead');

  // Department Library & Tab Navigation
  const [activeTab, setActiveTab] = useState('my-quizzes'); // 'my-quizzes' | 'dept-library'
  const [deptQuizzes, setDeptQuizzes] = useState([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [deptSubjectFilter, setDeptSubjectFilter] = useState('ALL');
  const [deptTypeFilter, setDeptTypeFilter] = useState('ALL');

  // Share with Department Modal
  const [shareModalQuiz, setShareModalQuiz] = useState(null);
  const [shareSubject, setShareSubject] = useState('Electricity');
  const [shareClassType, setShareClassType] = useState('TD');
  const [sharingLoading, setSharingLoading] = useState(false);

  // Admin Tutor Management (Jason Leav)
  const [tutorAdminModal, setTutorAdminModal] = useState(false);
  const [adminTutorsList, setAdminTutorsList] = useState([]);
  const [currentInviteCode, setCurrentInviteCode] = useState('TECHNO-2026');
  const [newInviteCodeInput, setNewInviteCodeInput] = useState('');
  const [adminNewName, setAdminNewName] = useState('');
  const [adminNewEmail, setAdminNewEmail] = useState('');
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);

  const fetchAdminTutors = async () => {
    try {
      const res = await fetch('/api/admin/tutors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminTutorsList(data.tutors || []);
        setCurrentInviteCode(data.inviteCode || 'TECHNO-2026');
        setNewInviteCodeInput(data.inviteCode || 'TECHNO-2026');
      }
    } catch (err) {
      console.error('Failed to load admin tutor data:', err);
    }
  };

  const handleOpenAdminModal = () => {
    setTutorAdminModal(true);
    fetchAdminTutors();
  };

  const handleUpdateInviteCode = async (e) => {
    e.preventDefault();
    if (!newInviteCodeInput.trim()) return;
    try {
      const res = await fetch('/api/admin/invite-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode: newInviteCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update code');
      setCurrentInviteCode(data.inviteCode);
      setAdminMsg('Access code updated successfully!');
      setTimeout(() => setAdminMsg(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdminCreateTutor = async (e) => {
    e.preventDefault();
    setAdminSubmitting(true);
    try {
      const res = await fetch('/api/admin/create-tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: adminNewName.trim(),
          email: adminNewEmail.trim(),
          password: adminNewPassword.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create tutor');
      setAdminNewName('');
      setAdminNewEmail('');
      setAdminNewPassword('');
      setAdminMsg(`Tutor account created for ${data.tutor.email}!`);
      setTimeout(() => setAdminMsg(''), 3000);
      fetchAdminTutors();
    } catch (err) {
      alert(err.message);
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleDeleteTutor = async (id, email) => {
    if (!window.confirm(`Are you sure you want to remove tutor account ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/tutors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove tutor');
      fetchAdminTutors();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateRole = async (tutorId, newRole) => {
    try {
      const res = await fetch(`/api/admin/tutors/${tutorId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update role');
      setAdminMsg(`Role updated to ${newRole}!`);
      setTimeout(() => setAdminMsg(''), 3000);
      fetchAdminTutors();
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchDeptQuizzes = async () => {
    try {
      setDeptLoading(true);
      const res = await fetch('/api/quizzes/department-library', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load department library');
      setDeptQuizzes(data);
    } catch (err) {
      console.error('Failed to load department quizzes:', err);
    } finally {
      setDeptLoading(false);
    }
  };

  const handleCloneQuiz = async (quizId, quizTitle) => {
    try {
      const res = await fetch(`/api/quizzes/${quizId}/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to duplicate quiz');
      alert(`🎉 Cloned "${quizTitle}" to your personal quizzes! You can now customize it or launch it.`);
      fetchQuizzes();
      setActiveTab('my-quizzes');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleShare = async (quiz, isShared, subject = 'Electricity', classType = 'TD') => {
    try {
      setSharingLoading(true);
      const res = await fetch(`/api/quizzes/${quiz.id}/toggle-share`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isShared, subject, classType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update share status');
      setShareModalQuiz(null);
      fetchQuizzes();
      if (activeTab === 'dept-library') fetchDeptQuizzes();
      alert(data.message);
    } catch (err) {
      alert(err.message);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(currentInviteCode);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/quizzes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load quizzes');
      setQuizzes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [token]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/quizzes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setQuizzes(quizzes.filter(q => q.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportJson = async (quiz) => {
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export quiz');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.replace(/\s+/g, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.location.href = `/api/quizzes/${quiz.id}/export?token=${encodeURIComponent(token)}`;
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/quizzes/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(json)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import JSON');

      fetchQuizzes();
      alert(`Quiz "${data.title}" imported successfully!`);
    } catch (err) {
      alert(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportByCode = async (e) => {
    e.preventDefault();
    if (!shareCodeInput.trim()) return;

    try {
      setImporting(true);
      const res = await fetch('/api/quizzes/import-by-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: shareCodeInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import by code');

      setImportCodeModal(false);
      setShareCodeInput('');
      fetchQuizzes();
      alert(data.message || 'Quiz added successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleLaunchConfirmed = () => {
    if (!launchModalQuiz) return;
    onStartSession(
      launchModalQuiz,
      roomPasscode.trim() || null,
      sessionMode,
      parseInt(sessionDurationMinutes, 10) || 10
    );
    setLaunchModalQuiz(null);
    setRoomPasscode('');
  };

  const handleGenerateAiQuiz = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setAiLoading(true);
    try {
      if (aiApiKey.trim()) {
        localStorage.setItem('gemini_api_key', aiApiKey.trim());
      }

      const res = await fetch('/api/quizzes/generate-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          difficulty: aiDifficulty,
          questionCount: aiCount,
          apiKey: aiApiKey.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');

      // Save generated quiz
      const saveRes = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `${aiTopic} (${data.source || 'AI'})`,
          description: `Auto-generated physics quiz with KaTeX math formulas on ${aiTopic}.`,
          topic: aiDifficulty,
          questions: data.questions
        })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save generated quiz');

      setAiModal(false);
      fetchQuizzes();
      alert(`🎉 ${data.message}\nQuiz "${aiTopic}" is now in your library!`);
    } catch (err) {
      alert(`AI Generation Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="space-y-1 z-10">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
            Tutor Workspace • {tutor?.email || 'jasonleav@gmail.com'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Welcome back, {tutor?.name || 'Jason Leav'}
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Host live sessions for 100+ students, launch physics problem sets with KaTeX equations, and track real-time comprehension.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            type="button"
            onClick={() => setAiModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-violet-600/30 transition-all transform active:scale-95"
            title="Generate physics quizzes with Gemini Pro AI"
          >
            <Bot className="w-4 h-4" />
            <span>AI Quiz Generator (Gemini)</span>
          </button>

          <button
            type="button"
            onClick={onCreateQuiz}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Quiz</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
            title="Import quiz from exported JSON file"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setImportCodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
            title="Import quiz using share code from another tutor"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-400" />
            <span>Import Code</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdminModal}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs sm:text-sm rounded-xl border border-amber-500/30 transition-all transform active:scale-95 shadow-sm"
              title="Manage authorized tutors and registration invite codes"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Tutor Access & Codes</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileImport}
        />
      </div>

      {/* Navigation Tabs: My Quizzes vs Department Master Library */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('my-quizzes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'my-quizzes'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>My Quizzes ({quizzes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('dept-library');
              fetchDeptQuizzes();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'dept-library'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>🏛️ Department Master Library</span>
            {deptQuizzes.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono">
                {deptQuizzes.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter dropdowns when Department Library is active */}
        {activeTab === 'dept-library' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptSubjectFilter}
              onChange={(e) => setDeptSubjectFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Subjects</option>
              <option value="Electricity">⚡ Electricity (អគ្គិសនី)</option>
              <option value="Mechanics">⚙️ Mechanics (មេកានិច)</option>
              <option value="Thermodynamics">🔥 Thermodynamics</option>
              <option value="Optics">🔬 Optics (អុបទិក)</option>
            </select>

            <select
              value={deptTypeFilter}
              onChange={(e) => setDeptTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold text-emerald-400"
            >
              <option value="ALL">All Course Types</option>
              <option value="TD">TD (Travaux Dirigés / Recitation)</option>
              <option value="Cours">Cours (Amphi Lecture)</option>
              <option value="TP">TP (Travaux Pratiques / Lab)</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: MY QUIZZES */}
      {activeTab === 'my-quizzes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <span>Personal Quizzes ({quizzes.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-64 bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-4">
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Quizzes Created Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Get started by generating with Gemini Pro AI, creating your first physics quiz, or picking a shared master quiz from the Department Library.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('dept-library');
                    fetchDeptQuizzes();
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" /> Browse Department Library
                </button>
                <button
                  type="button"
                  onClick={onCreateQuiz}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  + Create Custom Quiz
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {quiz.subject || quiz.topic || 'Electricity'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {quiz.class_type || 'TD'}
                        </span>
                        {quiz.is_shared === 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                            <span>🏛️ Dept Shared</span>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(quiz.share_code)}
                        className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded transition-colors"
                        title="Click to copy share code"
                      >
                        {copiedCode === quiz.share_code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>{quiz.share_code}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {quiz.title}
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                      {quiz.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                      <span className="flex items-center gap-1 font-semibold text-slate-300">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        {quiz.questionCount || 0} Questions
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        ~{Math.round((quiz.questionCount || 0) * 0.75)} mins
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setLaunchModalQuiz(quiz)}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Live Session</span>
                    </button>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onEditQuiz(quiz.id)}
                        className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3 text-indigo-400" />
                        <span>Edit Studio</span>
                      </button>

                      {/* Lead Lecturer / Admin: Share with Department */}
                      {isLeadLecturer && (
                        <button
                          type="button"
                          onClick={() => {
                            setShareModalQuiz(quiz);
                            setShareSubject(quiz.subject || 'Electricity');
                            setShareClassType(quiz.class_type || 'TD');
                          }}
                          className={`py-1.5 px-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1 transition-colors ${
                            quiz.is_shared
                              ? 'bg-violet-950/40 border-violet-500/40 text-violet-300 hover:bg-violet-900/50'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title={quiz.is_shared ? 'Manage department sharing' : 'Share with Department Library'}
                        >
                          <Share2 className="w-3 h-3 text-violet-400" />
                          <span>{quiz.is_shared ? 'Shared' : 'Share'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportJson(quiz)}
                        className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition-colors"
                        title="Download as JSON"
                      >
                        <Download className="w-3 h-3 text-violet-400" />
                        <span>JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Delete quiz"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DEPARTMENT MASTER LIBRARY */}
      {activeTab === 'dept-library' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-violet-950/40 via-slate-900 to-indigo-950/40 border border-violet-500/30 rounded-3xl">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Department of Physics & Tronc Commun</span>
              </span>
              <h2 className="text-xl font-black text-white">Master Quiz Library</h2>
              <p className="text-xs text-slate-300 max-w-2xl">
                Official quizzes authored and published by Lead Lecturers. Any tutor can launch them directly for their class sections or duplicate them to adapt questions.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchDeptQuizzes}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 self-start sm:self-center transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Library</span>
            </button>
          </div>

          {deptLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-64 bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : deptQuizzes.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-3">
              <Sparkles className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Department Quizzes Shared Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Lead lecturers can share master quizzes here by clicking the "Share" button on any quiz in their workspace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deptQuizzes
                .filter(q => {
                  const matchesSubject = deptSubjectFilter === 'ALL' || (q.subject || 'Electricity') === deptSubjectFilter;
                  const matchesType = deptTypeFilter === 'ALL' || (q.class_type || 'TD') === deptTypeFilter;
                  return matchesSubject && matchesType;
                })
                .map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-slate-900/90 border border-violet-500/30 hover:border-violet-500/60 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                            {quiz.subject || 'Electricity'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {quiz.class_type || 'TD'}
                          </span>
                          {quiz.isMine && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              My Quiz
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">
                          By {quiz.author_name || quiz.author_email}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                        {quiz.title}
                      </h3>

                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                        {quiz.description || 'Master department physics problem set.'}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                          {quiz.questionCount || 0} Questions
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          ~{Math.round((quiz.questionCount || 0) * 0.75)} mins
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 space-y-2">
                      <button
                        type="button"
                        onClick={() => setLaunchModalQuiz(quiz)}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Launch for My Section</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCloneQuiz(quiz.id, quiz.title)}
                          className="flex-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Duplicate to My Quizzes</span>
                        </button>

                        {(quiz.isMine || isLeadLecturer) && (
                          <button
                            type="button"
                            onClick={() => handleToggleShare(quiz, 0)}
                            className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                            title="Remove from Department Library"
                          >
                            Unshare
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Start Live Session Modal (with Room Password) */}
      {launchModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Play className="w-5 h-5 fill-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Start Live Session</h3>
                <p className="text-xs text-slate-400">{launchModalQuiz.title} ({launchModalQuiz.questionCount || launchModalQuiz.questions?.length || 0} Problems)</p>
              </div>
            </div>

            {/* Session Mode Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase">
                Session Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSessionMode('LECTURER_PACED')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    sessionMode === 'LECTURER_PACED'
                      ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>👨‍🏫 Lecturer-Paced</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    Question-by-question discussion. Tutor clicks next.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionMode('STUDENT_PACED')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    sessionMode === 'STUDENT_PACED'
                      ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>⏱️ Student-Paced</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                    Total time limit. Students navigate & switch problems freely.
                  </p>
                </button>
              </div>
            </div>

            {/* If Student-Paced: Duration setting */}
            {sessionMode === 'STUDENT_PACED' && (
              <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2.5 animate-pop">
                <label className="block text-xs font-bold text-slate-200 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Total Session Time (Minutes)</span>
                  </span>
                  <span className="text-[11px] text-indigo-300 font-mono font-bold">
                    {sessionDurationMinutes} mins
                  </span>
                </label>

                {/* Quick preset duration pills */}
                <div className="flex flex-wrap gap-1.5">
                  {[5, 8, 10, 15, 20, 30, 45].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSessionDurationMinutes(m)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                        Number(sessionDurationMinutes) === m
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                {/* Custom minute input */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">Or type custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={sessionDurationMinutes}
                    onChange={(e) => setSessionDurationMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-indigo-500 text-center"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
              <label className="block text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Room Access Password (Optional)</span>
              </label>
              <input
                type="text"
                value={roomPasscode}
                onChange={(e) => setRoomPasscode(e.target.value)}
                placeholder="Leave blank for open access, or enter password"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                If a password is set, students must enter it to lock into the room (or scan the QR code which auto-authenticates them).
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLaunchModalQuiz(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchConfirmed}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Session & Display QR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Pro AI Quiz Generator Modal */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Gemini Pro Physics Quiz Generator</span>
                  <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                    AI Studio
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Generates questions with inline & block KaTeX equations</p>
              </div>
            </div>

            <form onSubmit={handleGenerateAiQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Physics Topic / Prompt *
                </label>
                <input
                  type="text"
                  required
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Lenz's Law, LC Oscillations, or Relativity"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="High School Physics">High School Physics</option>
                    <option value="AP Physics 1 & 2">AP Physics 1 & 2</option>
                    <option value="AP Physics C (Calculus)">AP Physics C (Calculus)</option>
                    <option value="College General Physics">College General Physics</option>
                    <option value="Quantum & Modern Physics">Quantum & Modern Physics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Number of Questions
                  </label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center justify-between">
                  <span>Google Gemini API Key (Optional)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Leave blank to use physics knowledge base</span>
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="AIzaSy... (Saved in browser)"
                  className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAiModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-violet-600/30 transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating with Gemini Pro...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      <span>Generate Physics Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import By Code Modal */}
      {importCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-violet-400" />
              <span>Import Quiz by Share Code</span>
            </h3>
            <p className="text-xs text-slate-400">
              Enter the share code (e.g. <code className="text-indigo-400">PHY-MECH</code>) provided by a fellow tutor to import a copy into your library.
            </p>

            <form onSubmit={handleImportByCode} className="space-y-4">
              <input
                type="text"
                required
                value={shareCodeInput}
                onChange={(e) => setShareCodeInput(e.target.value)}
                placeholder="PHY-XXXX"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 uppercase"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportCodeModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  {importing ? 'Importing...' : 'Add to My Quizzes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Tutor Management Modal */}
      {tutorAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Tutor Access Control</h3>
                  <p className="text-xs text-slate-400">Manage who can register or create tutor accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTutorAdminModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{adminMsg}</span>
              </div>
            )}

            {/* Section 1: Tutor Invite / Access Code */}
            <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Public Registration Access Code</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Colleagues MUST enter this secret code on the signup page to create an account.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-amber-300 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    {currentInviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-xs flex items-center gap-1"
                    title="Copy code"
                  >
                    {copiedInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInvite ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Update Code Form */}
              <form onSubmit={handleUpdateInviteCode} className="flex gap-2 pt-2 border-t border-slate-700/50">
                <input
                  type="text"
                  required
                  value={newInviteCodeInput}
                  onChange={(e) => setNewInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="Change to new code (e.g. PHYSICS-2026)"
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 uppercase focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-colors"
                >
                  Save New Code
                </button>
              </form>
            </div>

            {/* Section 2: Create Tutor Directly */}
            <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Create Tutor Account Directly</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Create an account for a fellow tutor directly without needing to give them the invite code.
              </p>

              <form onSubmit={handleAdminCreateTutor} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <input
                  type="text"
                  required
                  value={adminNewName}
                  onChange={(e) => setAdminNewName(e.target.value)}
                  placeholder="Tutor Name / Title"
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="email"
                  required
                  value={adminNewEmail}
                  onChange={(e) => setAdminNewEmail(e.target.value)}
                  placeholder="Tutor Email"
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  required
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  placeholder="Password"
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={adminSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{adminSubmitting ? 'Creating...' : 'Create Tutor Account'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section 3: Registered Tutors List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Authorized Tutors ({adminTutorsList.length})</span>
              </h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/50">
                {adminTutorsList.map((t) => {
                  const isPrimary = t.email.toLowerCase() === 'jasonleav@gmail.com';
                  return (
                    <div key={t.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{t.name}</span>
                          {isPrimary ? (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Primary Admin
                            </span>
                          ) : (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              t.role === 'lead'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : t.role === 'admin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                            }`}>
                              {t.role === 'lead' ? 'Lead Lecturer' : t.role === 'admin' ? 'Admin' : 'Section Tutor'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{t.email}</div>
                      </div>

                      {!isPrimary && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <select
                            value={t.role || 'tutor'}
                            onChange={(e) => handleUpdateRole(t.id, e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            title="Assign role to tutor"
                          >
                            <option value="tutor">🧑‍🏫 Section Tutor</option>
                            <option value="lead">🎓 Lead Lecturer (Manage Quizzes)</option>
                            <option value="admin">🛡️ Administrator</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeleteTutor(t.id, t.email)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors text-xs flex items-center gap-1"
                            title="Remove tutor access"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTutorAdminModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share with Department Modal */}
      {shareModalQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-pop">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-600/30 text-violet-400 flex items-center justify-center font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Share with Department</h3>
                  <p className="text-xs text-slate-400">Publish quiz to all Tronc Commun lecturers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalQuiz(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-violet-950/40 border border-violet-500/30 rounded-2xl space-y-1">
              <span className="text-[11px] font-bold text-violet-300 uppercase">Selected Quiz:</span>
              <div className="text-sm font-bold text-white">{shareModalQuiz.title}</div>
              <div className="text-xs text-slate-400">{shareModalQuiz.questionCount || 0} Questions</div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Subject (Matière)</label>
                <select
                  value={shareSubject}
                  onChange={(e) => setShareSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="Electricity">⚡ Electricity (អគ្គិសនី)</option>
                  <option value="Mechanics">⚙️ Mechanics (មេកានិច)</option>
                  <option value="Thermodynamics">🔥 Thermodynamics</option>
                  <option value="Optics">🔬 Optics (អុបទិក)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Course Type</label>
                <select
                  value={shareClassType}
                  onChange={(e) => setShareClassType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-violet-500"
                >
                  <option value="TD">TD (Travaux Dirigés / Recitation)</option>
                  <option value="Cours">Cours (Amphithéâtre / Lecture)</option>
                  <option value="TP">TP (Travaux Pratiques / Lab)</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              When published, this quiz will appear in the <strong>Department Master Library</strong>. All instructors can launch it for their sections and duplicate questions.
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              {shareModalQuiz.is_shared === 1 ? (
                <button
                  type="button"
                  disabled={sharingLoading}
                  onClick={() => handleToggleShare(shareModalQuiz, 0)}
                  className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition"
                >
                  {sharingLoading ? 'Updating...' : 'Unshare from Department'}
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShareModalQuiz(null)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sharingLoading}
                  onClick={() => handleToggleShare(shareModalQuiz, 1, shareSubject, shareClassType)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
                >
                  {sharingLoading ? 'Publishing...' : 'Publish to Library'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
