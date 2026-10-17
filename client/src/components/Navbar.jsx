import React from 'react';
import { Atom, PlusCircle, BookOpen, BarChart3, LogOut, Smartphone } from 'lucide-react';

export default function Navbar({ tutor, activeTab, onTabChange, onLogout, onOpenStudentView }) {
  return (
    <header className="w-full bg-slate-900/95 border-b border-slate-800 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('quizzes')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Atom className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              <span>PhysiKahoot</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Tutor
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Interactive Physics Polling & Quiz Platform</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {tutor && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => onTabChange('quizzes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'quizzes'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Quizzes</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('create')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Quiz</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'reports'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Session Reports</span>
            </button>
          </nav>
        )}

        {/* Right actions: Student View test link + Tutor Profile / Logout */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenStudentView}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            title="Open Student Join Window for testing"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open Student View</span>
          </button>

          {tutor ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden lg:block">
                <div className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{tutor.name}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{tutor.email}</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
