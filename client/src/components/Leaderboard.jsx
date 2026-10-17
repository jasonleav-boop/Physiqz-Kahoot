import React from 'react';
import { Trophy, Flame, Award, Zap } from 'lucide-react';

export default function Leaderboard({ topList = [], totalParticipants = 0 }) {
  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Trophy className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Current Leaderboard</h2>
            <p className="text-xs text-slate-400">Top performers out of {totalParticipants} students</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 bg-slate-800 text-indigo-400 border border-slate-700 rounded-full font-semibold">
          Top 5
        </span>
      </div>

      <div className="space-y-3">
        {topList.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No scores registered yet.
          </div>
        ) : (
          topList.map((player, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            let rankBadge = (
              <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-xs">
                {index + 1}
              </span>
            );

            if (isFirst) {
              rankBadge = (
                <span className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-sm shadow-md shadow-amber-400/30">
                  🥇
                </span>
              );
            } else if (isSecond) {
              rankBadge = (
                <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-900 font-black flex items-center justify-center text-sm shadow-md">
                  🥈
                </span>
              );
            } else if (isThird) {
              rankBadge = (
                <span className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 font-black flex items-center justify-center text-sm shadow-md">
                  🥉
                </span>
              );
            }

            return (
              <div
                key={player.socketId || index}
                className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 transform hover:scale-[1.01] ${
                  isFirst
                    ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-800/50 border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {rankBadge}
                  <div className="text-2xl">{player.avatar || '⚛️'}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base sm:text-lg">
                        {player.studentName}
                      </span>
                      {player.streak >= 2 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold text-orange-400 bg-orange-950/50 border border-orange-500/30 px-2 py-0.5 rounded-full">
                          <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                          {player.streak}
                        </span>
                      )}
                    </div>
                    {player.studentId && (
                      <span className="text-xs text-slate-500 font-mono">ID: {player.studentId}</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg sm:text-xl font-black text-indigo-400 tracking-tight">
                    {player.score.toLocaleString()} <span className="text-xs text-indigo-300/80 font-normal">pts</span>
                  </div>
                  {player.lastPoints > 0 && (
                    <div className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end gap-0.5">
                      <Zap className="w-3 h-3" /> +{player.lastPoints}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
