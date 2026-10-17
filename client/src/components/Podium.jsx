import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Download, Award, Medal, ArrowLeft } from 'lucide-react';

export default function Podium({ podium = {}, allRankings = [], onExit, sessionId }) {
  const { first, second, third } = podium;

  useEffect(() => {
    // Launch celebratory confetti burst
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 }
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 }
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  const handleDownloadCsv = async () => {
    if (!sessionId) return;
    const token = localStorage.getItem('techno_token') || '';
    try {
      const res = await fetch(`/api/sessions/${sessionId}/export-csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to download CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session_${sessionId}_results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.location.href = `/api/sessions/${sessionId}/export-csv?token=${encodeURIComponent(token)}`;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-pop">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-sm">
          <Trophy className="w-4 h-4" /> Grand Finale Podium
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
          Session Completed!
        </h1>
        <p className="text-slate-400 text-sm">
          Congratulations to all physics scholars! Check out the final podium standing.
        </p>
      </div>

      {/* 3-Tier Podium */}
      <div className="flex items-end justify-center gap-2 sm:gap-6 pt-12 pb-4 px-2">
        {/* 2nd Place */}
        <div className="flex-1 flex flex-col items-center max-w-[200px]">
          {second ? (
            <>
              <div className="text-3xl mb-1">{second.avatar || '⚛️'}</div>
              <span className="font-bold text-slate-200 text-sm sm:text-base truncate max-w-full text-center">
                {second.studentName}
              </span>
              <span className="text-xs text-indigo-400 font-bold mb-2">
                {second.score.toLocaleString()} pts
              </span>
              <div className="w-full h-36 sm:h-44 bg-gradient-to-t from-slate-800 to-slate-700/80 rounded-t-2xl border-t-4 border-slate-300 flex flex-col items-center justify-start pt-3 shadow-xl">
                <span className="text-3xl sm:text-4xl font-black text-slate-300">2</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Silver</span>
              </div>
            </>
          ) : (
            <div className="w-full h-36 bg-slate-800/40 rounded-t-2xl border-t border-slate-700" />
          )}
        </div>

        {/* 1st Place */}
        <div className="flex-1 flex flex-col items-center max-w-[240px] z-10 -translate-y-4">
          {first ? (
            <>
              <div className="text-4xl mb-1 filter drop-shadow-lg">👑</div>
              <div className="text-4xl mb-1">{first.avatar || '⚛️'}</div>
              <span className="font-extrabold text-amber-300 text-base sm:text-lg truncate max-w-full text-center">
                {first.studentName}
              </span>
              <span className="text-sm text-amber-400 font-black mb-2">
                {first.score.toLocaleString()} pts
              </span>
              <div className="w-full h-48 sm:h-60 bg-gradient-to-t from-amber-700/80 to-amber-500 rounded-t-2xl border-t-4 border-amber-300 flex flex-col items-center justify-start pt-3 shadow-2xl shadow-amber-500/20">
                <span className="text-4xl sm:text-5xl font-black text-amber-950">1</span>
                <span className="text-xs font-black text-amber-950 uppercase tracking-wider mt-1">Champion</span>
              </div>
            </>
          ) : (
            <div className="w-full h-48 bg-slate-800/40 rounded-t-2xl border-t border-slate-700" />
          )}
        </div>

        {/* 3rd Place */}
        <div className="flex-1 flex flex-col items-center max-w-[200px]">
          {third ? (
            <>
              <div className="text-3xl mb-1">{third.avatar || '⚛️'}</div>
              <span className="font-bold text-slate-200 text-sm sm:text-base truncate max-w-full text-center">
                {third.studentName}
              </span>
              <span className="text-xs text-indigo-400 font-bold mb-2">
                {third.score.toLocaleString()} pts
              </span>
              <div className="w-full h-28 sm:h-32 bg-gradient-to-t from-amber-950 to-amber-900/80 rounded-t-2xl border-t-4 border-amber-600 flex flex-col items-center justify-start pt-3 shadow-xl">
                <span className="text-3xl sm:text-4xl font-black text-amber-400">3</span>
                <span className="text-[11px] font-bold text-amber-400/80 uppercase tracking-wider mt-1">Bronze</span>
              </div>
            </>
          ) : (
            <div className="w-full h-28 bg-slate-800/40 rounded-t-2xl border-t border-slate-700" />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        {sessionId && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
          >
            <Download className="w-4 h-4" /> Download Results as CSV
          </button>
        )}

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </button>
      </div>

      {/* Complete Class Roster Table */}
      {allRankings.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
            <span>Complete Class Standings ({allRankings.length} Students)</span>
          </h3>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800/60 text-slate-400 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-3">Correct Answers</th>
                  <th className="py-2.5 px-3 text-right">Final Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {allRankings.map((p) => (
                  <tr key={p.socketId || p.studentName} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-indigo-400">#{p.rank}</td>
                    <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                      <span>{p.avatar || '⚛️'}</span>
                      <span>{p.studentName}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{p.studentId || '—'}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-medium">{p.correctCount} correct</td>
                    <td className="py-2.5 px-3 text-right font-black text-white">{p.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
