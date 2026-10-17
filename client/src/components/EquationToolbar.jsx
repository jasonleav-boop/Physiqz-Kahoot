import React from 'react';
import { Sigma, ChevronDown } from 'lucide-react';

export default function EquationToolbar({ onInsert }) {
  const symbols = [
    { label: '$\\vec{F}$', code: '\\vec{F}' },
    { label: '$\\vec{v}$', code: '\\vec{v}' },
    { label: '$\\vec{a}$', code: '\\vec{a}' },
    { label: '$\\Delta$', code: '\\Delta ' },
    { label: '$\\theta$', code: '\\theta ' },
    { label: '$\\lambda$', code: '\\lambda ' },
    { label: '$\\omega$', code: '\\omega ' },
    { label: '$\\mu$', code: '\\mu ' },
    { label: '$\\pi$', code: '\\pi ' },
    { label: '$\\Omega$', code: '\\Omega ' },
    { label: '$\\frac{a}{b}$', code: '\\frac{a}{b}' },
    { label: '$\\sqrt{x}$', code: '\\sqrt{x}' },
    { label: '$x^2$', code: '^2' },
    { label: '$x_i$', code: '_i' },
    { label: '$\\int$', code: '\\int_{t_1}^{t_2} ' },
    { label: '$\\sum$', code: '\\sum_{i=1}^{n} ' },
    { label: '$\\approx$', code: '\\approx ' },
    { label: '$\\times$', code: '\\times ' },
    { label: '$\\pm$', code: '\\pm ' },
    { label: '$\\infty$', code: '\\infty ' }
  ];

  const wrapInline = () => {
    onInsert('$', '$');
  };

  const wrapBlock = () => {
    onInsert('$$\n', '\n$$');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs">
      <div className="flex items-center gap-1 text-indigo-400 font-semibold mr-1">
        <Sigma className="w-3.5 h-3.5" />
        <span>Physics Math:</span>
      </div>

      <button
        type="button"
        onClick={wrapInline}
        className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-mono rounded transition-colors"
        title="Wrap with inline math $...$"
      >
        Inline $...$
      </button>

      <button
        type="button"
        onClick={wrapBlock}
        className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 font-mono rounded transition-colors"
        title="Wrap with block math $$...$$"
      >
        Block $$...$$
      </button>

      <div className="h-4 w-px bg-slate-700 mx-1" />

      {symbols.map((item, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onInsert(item.code, '')}
          className="px-1.5 py-1 bg-slate-700/60 hover:bg-slate-600 text-slate-200 font-mono rounded hover:text-white transition-all transform active:scale-95"
          title={`Insert ${item.code}`}
        >
          {item.code.replace('\\', '')}
        </button>
      ))}
    </div>
  );
}
