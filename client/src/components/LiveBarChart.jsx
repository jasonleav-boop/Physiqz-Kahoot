import React from 'react';
import LatexRenderer from './LatexRenderer';
import { CheckCircle2, XCircle } from 'lucide-react';

const OPTION_COLORS = [
  { bg: 'bg-red-500', bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/50', label: '▲ A' },
  { bg: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/50', label: '◆ B' },
  { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/50', label: '● C' },
  { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/50', label: '■ D' }
];

export default function LiveBarChart({
  distribution = {},
  options = [],
  correctOptionIndex = -1,
  revealed = false,
  totalAnswered = 0,
  isPoll = false
}) {
  const maxVotes = Math.max(1, ...Object.values(distribution).map(v => Number(v) || 0));

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Response Distribution</span>
          {revealed && (
            <span className="text-xs px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-medium">
              {isPoll ? 'Poll Result' : 'Answer Revealed'}
            </span>
          )}
        </h3>
        <span className="text-sm font-semibold text-slate-400">
          Total Responses: <strong className="text-white text-base">{totalAnswered}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {options.map((opt, idx) => {
          const count = distribution[idx] || 0;
          const pct = totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0;
          const heightPct = Math.max(8, Math.round((count / maxVotes) * 100));
          const isCorrect = revealed && !isPoll && idx === correctOptionIndex;
          const isIncorrect = revealed && !isPoll && idx !== correctOptionIndex;
          const theme = OPTION_COLORS[idx % OPTION_COLORS.length];

          return (
            <div
              key={idx}
              className={`flex flex-col justify-between rounded-xl p-4 border transition-all duration-500 ${
                isCorrect
                  ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/50 scale-[1.02]'
                  : isIncorrect
                  ? 'bg-slate-900/40 border-slate-800 opacity-60'
                  : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-2 py-1 rounded-md text-white ${theme.bg}`}>
                  {theme.label}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-extrabold text-white">{count}</span>
                  <span className="text-xs text-slate-400">({pct}%)</span>
                  {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-1" />}
                  {isIncorrect && <XCircle className="w-4 h-4 text-slate-500 ml-1" />}
                </div>
              </div>

              {/* Graphical Bar */}
              <div className="h-32 bg-slate-950/60 rounded-lg p-1.5 flex flex-col justify-end mb-3 overflow-hidden border border-slate-800">
                <div
                  className={`w-full rounded-md transition-all duration-700 ease-out flex items-center justify-center font-bold text-xs text-white shadow-lg ${
                    isCorrect ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : theme.bar
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  {count > 0 && <span>{count}</span>}
                </div>
              </div>

              {/* Option Text with LaTeX */}
              <div className="text-xs sm:text-sm text-slate-200 min-h-[44px] flex items-center">
                <LatexRenderer content={opt.text} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
