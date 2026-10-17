import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, Calendar, Users, Award,
  ArrowLeft, CheckCircle2, XCircle, Clock, ChevronRight
} from 'lucide-react';
import LatexRenderer from '../components/LatexRenderer';

export default function SessionReportView({ token, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch session list
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/sessions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load sessions');
        setSessions(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [token]);

  // Fetch detail for selected session
  const handleSelectSession = async (id) => {
    try {
      setSelectedSessionId(id);
      setDetailLoading(true);
      const res = await fetch(`/api/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load session details');
      setSessionDetail(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadCsv = (id) => {
    window.location.href = `/api/sessions/${id}/export-csv`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pop">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {selectedSessionId && (
              <button
                type="button"
                onClick={() => { setSelectedSessionId(null); setSessionDetail(null); }}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg mr-1 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Class Analytics & Historical Reports
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {selectedSessionId && sessionDetail ? sessionDetail.session.quiz_title : 'Session Performance & CSV Exports'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Export gradebook spreadsheets, inspect student accuracy, and review physics concept difficulty.
          </p>
        </div>

        {selectedSessionId && (
          <button
            type="button"
            onClick={() => handleDownloadCsv(selectedSessionId)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download Results as CSV</span>
          </button>
        )}
      </div>

      {/* View Detail or View List */}
      {selectedSessionId ? (
        detailLoading || !sessionDetail ? (
          <div className="py-16 text-center text-slate-400">Loading session breakdown...</div>
        ) : (
          <div className="space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 uppercase font-semibold">Total Students</span>
                <div className="text-2xl font-black text-white mt-1">
                  {sessionDetail.participants.length}
                </div>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 uppercase font-semibold">Class Average Score</span>
                <div className="text-2xl font-black text-indigo-400 mt-1">
                  {sessionDetail.participants.length > 0
                    ? Math.round(
                        sessionDetail.participants.reduce((acc, p) => acc + p.score, 0) /
                          sessionDetail.participants.length
                      ).toLocaleString()
                    : 0}{' '}
                  pts
                </div>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 uppercase font-semibold">Room PIN</span>
                <div className="text-2xl font-black text-violet-400 font-mono mt-1">
                  {sessionDetail.session.room_code}
                </div>
              </div>
            </div>

            {/* Question Accuracy Breakdown (Physics Diagnostic) */}
            {sessionDetail.questionStats && sessionDetail.questionStats.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" />
                  <span>Question Difficulty & Accuracy Diagnostic</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Identifies specific physics concepts where students struggled vs. concepts they mastered.
                </p>

                <div className="space-y-3 pt-2">
                  {sessionDetail.questionStats.map((qStat) => (
                    <div
                      key={qStat.questionIndex}
                      className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs sm:text-sm font-bold text-white flex-1">
                          <span className="text-indigo-400 mr-2">Q{qStat.questionIndex + 1}:</span>
                          <LatexRenderer content={qStat.questionText} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-slate-400">
                            Avg time: <strong className="text-slate-300">{qStat.averageTimeSec}s</strong>
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              qStat.accuracyPct >= 70
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : qStat.accuracyPct >= 40
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {qStat.accuracyPct}% Accuracy
                          </span>
                        </div>
                      </div>

                      {/* Accuracy bar */}
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            qStat.accuracyPct >= 70
                              ? 'bg-emerald-500'
                              : qStat.accuracyPct >= 40
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${qStat.accuracyPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student Roster Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-white mb-4">
                Student Performance Roster ({sessionDetail.participants.length})
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase bg-slate-800/80 text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Student ID</th>
                      <th className="py-3 px-4">Correct Answers</th>
                      <th className="py-3 px-4 text-right">Final Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sessionDetail.participants.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-bold text-indigo-400">#{p.rank}</td>
                        <td className="py-3 px-4 font-semibold text-white">{p.student_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">{p.student_id || 'N/A'}</td>
                        <td className="py-3 px-4 text-emerald-400 font-medium">{p.correct_count} correct</td>
                        <td className="py-3 px-4 text-right font-black text-white">{p.score.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Sessions List */
        <div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-3">
              <Calendar className="w-10 h-10 text-indigo-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">No Past Sessions Yet</h3>
              <p className="text-xs text-slate-400">
                When you launch and complete live quiz sessions with your classes, their reports and CSVs will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-all hover:bg-slate-800/60 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        PIN: {s.room_code}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                      {s.quiz_title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        {s.roster_count || s.total_participants} Students
                      </span>
                      {s.average_score !== null && (
                        <span>
                          Avg Score: <strong className="text-slate-200">{Math.round(s.average_score)} pts</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadCsv(s.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-colors shadow"
                      title="Download full CSV report"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">CSV</span>
                    </button>

                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
