import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '', showLabel = false }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('techno_theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.style.colorScheme = isLight ? 'light' : 'dark';
    localStorage.setItem('techno_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition-all flex items-center gap-1.5 border ${
        isLight
          ? 'bg-slate-100 hover:bg-slate-200 text-amber-600 border-slate-300 shadow-sm'
          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700'
      } ${className}`}
      title={isLight ? 'Switch to Dark Mode (Recitation Projector)' : 'Switch to Light Mode (Bright Classroom)'}
      aria-label="Toggle light or dark theme"
    >
      {isLight ? (
        <Moon className="w-4 h-4 fill-amber-500 text-amber-600" />
      ) : (
        <Sun className="w-4 h-4 fill-amber-400 text-amber-400" />
      )}
      {showLabel && (
        <span className="text-xs font-bold">
          {isLight ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}
