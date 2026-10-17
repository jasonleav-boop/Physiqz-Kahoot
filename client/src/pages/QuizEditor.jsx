import React, { useState, useEffect } from 'react';
import {
  Save, ArrowLeft, Plus, Trash2, Copy, MoveUp, MoveDown,
  CheckCircle2, Circle, Eye, HelpCircle, Clock, Zap, BookOpen
} from 'lucide-react';
import LatexRenderer from '../components/LatexRenderer';
import EquationToolbar from '../components/EquationToolbar';
import ImageUploader from '../components/ImageUploader';

const DEFAULT_QUESTION = {
  id: 'q_' + Date.now(),
  type: 'multiple_choice', // multiple_choice | true_false | poll
  question: 'Calculate the magnitude of force $\\vec{F}$ required to accelerate a mass $m = 5\\text{ kg}$ at $a = 2\\text{ m/s}^2$:',
  imageUrl: null,
  timeLimit: 30,
  points: 1000,
  explanation: 'By Newton\'s Second Law: $F = ma = 5 \\times 2 = 10\\text{ N}$.',
  options: [
    { text: '$F = 10\\text{ N}$', isCorrect: true },
    { text: '$F = 2.5\\text{ N}$', isCorrect: false },
    { text: '$F = 7\\text{ N}$', isCorrect: false },
    { text: '$F = 20\\text{ N}$', isCorrect: false }
  ]
};

export default function QuizEditor({ quizId, token, onSaveSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('Classical Mechanics');
  const [questions, setQuestions] = useState([DEFAULT_QUESTION]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeField, setActiveField] = useState({ target: 'question', optIndex: null });
  const [loading, setLoading] = useState(!!quizId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!quizId) return;
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/quizzes/${quizId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quiz');
        setTitle(data.title);
        setDescription(data.description || '');
        setTopic(data.topic || 'Physics');
        setQuestions(data.questions || [DEFAULT_QUESTION]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId, token]);

  const currentQ = questions[currentIndex] || questions[0];

  const updateCurrentQuestion = (fields) => {
    const updated = [...questions];
    updated[currentIndex] = { ...updated[currentIndex], ...fields };
    setQuestions(updated);
  };

  const handleTypeChange = (newType) => {
    let newOptions = [];
    if (newType === 'true_false') {
      newOptions = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false }
      ];
    } else if (newType === 'poll') {
      newOptions = [
        { text: 'Option A', isCorrect: true },
        { text: 'Option B', isCorrect: true },
        { text: 'Option C', isCorrect: true }
      ];
    } else {
      // multiple_choice
      newOptions = [
        { text: 'Option A', isCorrect: true },
        { text: 'Option B', isCorrect: false },
        { text: 'Option C', isCorrect: false },
        { text: 'Option D', isCorrect: false }
      ];
    }
    updateCurrentQuestion({ type: newType, options: newOptions });
  };

  const handleOptionTextChange = (optIdx, newText) => {
    const updatedOptions = [...currentQ.options];
    updatedOptions[optIdx] = { ...updatedOptions[optIdx], text: newText };
    updateCurrentQuestion({ options: updatedOptions });
  };

  const handleSetCorrectOption = (optIdx) => {
    if (currentQ.type === 'poll') return;
    const updatedOptions = currentQ.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === optIdx
    }));
    updateCurrentQuestion({ options: updatedOptions });
  };

  const handleAddOption = () => {
    if (currentQ.options.length >= 4) return;
    const updatedOptions = [...currentQ.options, { text: `Option ${String.fromCharCode(65 + currentQ.options.length)}`, isCorrect: false }];
    updateCurrentQuestion({ options: updatedOptions });
  };

  const handleRemoveOption = (optIdx) => {
    if (currentQ.options.length <= 2) return;
    const updatedOptions = currentQ.options.filter((_, i) => i !== optIdx);
    // ensure at least one is correct
    if (!updatedOptions.some(o => o.isCorrect)) {
      updatedOptions[0].isCorrect = true;
    }
    updateCurrentQuestion({ options: updatedOptions });
  };

  const handleInsertMath = (prefix, suffix = '') => {
    if (activeField.target === 'question') {
      const val = currentQ.question;
      updateCurrentQuestion({ question: `${val} ${prefix}${suffix}` });
    } else if (activeField.target === 'explanation') {
      const val = currentQ.explanation || '';
      updateCurrentQuestion({ explanation: `${val} ${prefix}${suffix}` });
    } else if (activeField.target === 'option' && activeField.optIndex !== null) {
      const val = currentQ.options[activeField.optIndex]?.text || '';
      handleOptionTextChange(activeField.optIndex, `${val} ${prefix}${suffix}`);
    }
  };

  const handleAddQuestion = () => {
    const newQ = {
      id: 'q_' + Date.now(),
      type: 'multiple_choice',
      question: 'New Physics Question with LaTeX e.g. $\\int \\vec{F} \\cdot d\\vec{r}$',
      imageUrl: null,
      timeLimit: 30,
      points: 1000,
      explanation: '',
      options: [
        { text: 'Option A', isCorrect: true },
        { text: 'Option B', isCorrect: false },
        { text: 'Option C', isCorrect: false },
        { text: 'Option D', isCorrect: false }
      ]
    };
    const updated = [...questions, newQ];
    setQuestions(updated);
    setCurrentIndex(updated.length - 1);
  };

  const handleDuplicateQuestion = () => {
    const clone = JSON.parse(JSON.stringify(currentQ));
    clone.id = 'q_' + Date.now();
    const updated = [...questions.slice(0, currentIndex + 1), clone, ...questions.slice(currentIndex + 1)];
    setQuestions(updated);
    setCurrentIndex(currentIndex + 1);
  };

  const handleDeleteQuestion = () => {
    if (questions.length <= 1) {
      alert('Quiz must contain at least 1 question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== currentIndex);
    setQuestions(updated);
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const handleMove = (direction) => {
    const newIdx = currentIndex + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    const temp = updated[currentIndex];
    updated[currentIndex] = updated[newIdx];
    updated[newIdx] = temp;
    setQuestions(updated);
    setCurrentIndex(newIdx);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      alert('Please enter a Quiz Title.');
      return;
    }

    // Validate that questions have non-empty text and at least one correct answer (if not poll)
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        alert(`Question #${i + 1} is empty.`);
        setCurrentIndex(i);
        return;
      }
      if (q.type !== 'poll' && !q.options.some(o => o.isCorrect)) {
        alert(`Question #${i + 1} has no correct answer selected.`);
        setCurrentIndex(i);
        return;
      }
    }

    setSaving(true);
    try {
      const endpoint = quizId ? `/api/quizzes/${quizId}` : '/api/quizzes';
      const method = quizId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          topic,
          questions
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quiz');

      onSaveSuccess();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-12 text-center text-slate-400">
        Loading Quiz Studio...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">
              {quizId ? 'Edit Physics Quiz' : 'Create Physics Quiz Studio'}
            </h1>
            <p className="text-xs text-slate-400">KaTeX formulas, diagrams, and timer settings</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveQuiz}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save & Publish Quiz'}</span>
          </button>
        </div>
      </div>

      {/* Quiz Metadata */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Quiz Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. AP Physics: Rotational Mechanics"
            className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Topic / Category</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Mechanics, Optics, Thermodynamics..."
            className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief instructions or class details..."
            className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Editor Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Questions Pills */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
            <span>Questions ({questions.length})</span>
            <button
              type="button"
              onClick={handleAddQuestion}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  idx === currentIndex
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-200">#{idx + 1} {q.type === 'poll' ? '📊 Poll' : q.type === 'true_false' ? '⚖️ T/F' : '🎯 MC'}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{q.timeLimit}s</span>
                </div>
                <div className="text-xs text-slate-300 line-clamp-2">
                  <LatexRenderer content={q.question || 'Empty question'} />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-dashed border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Center / Right: Question Editor Card */}
        <div className="lg:col-span-9 space-y-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            {/* Question Settings Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Type:</span>
                <div className="flex rounded-lg bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('multiple_choice')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      currentQ.type === 'multiple_choice' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Multiple Choice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('true_false')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      currentQ.type === 'true_false' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    True / False
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('poll')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      currentQ.type === 'poll' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Open Poll
                  </button>
                </div>
              </div>

              {/* Timer and Points */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={currentQ.timeLimit || 30}
                    onChange={(e) => updateCurrentQuestion({ timeLimit: Number(e.target.value) })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value={10}>10s</option>
                    <option value={20}>20s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                    <option value={90}>90s</option>
                    <option value={120}>120s</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <select
                    value={currentQ.points || 1000}
                    onChange={(e) => updateCurrentQuestion({ points: Number(e.target.value) })}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value={500}>500 pts</option>
                    <option value={1000}>1000 pts</option>
                    <option value={2000}>2000 pts</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
                  <button
                    type="button"
                    onClick={() => handleMove(-1)}
                    disabled={currentIndex === 0}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move up"
                  >
                    <MoveUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(1)}
                    disabled={currentIndex === questions.length - 1}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move down"
                  >
                    <MoveDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateQuestion}
                    className="p-1 text-slate-400 hover:text-indigo-400"
                    title="Duplicate question"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteQuestion}
                    className="p-1 text-slate-400 hover:text-rose-400"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Physics Equation Toolbar */}
            <EquationToolbar onInsert={handleInsertMath} />

            {/* Question Text with Live KaTeX Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Question Prompt (LaTeX Supported: $...$ or $$...$$)</span>
                <span className="text-slate-500 font-mono text-[11px]">Markdown & Math</span>
              </div>

              <textarea
                rows={3}
                value={currentQ.question}
                onFocus={() => setActiveField({ target: 'question', optIndex: null })}
                onChange={(e) => updateCurrentQuestion({ question: e.target.value })}
                placeholder="Type your physics question here. Use $m = 2\\text{ kg}$ or $$\\int F dt = \\Delta p$$"
                className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
              />

              {/* Live Preview Box */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Real-time KaTeX Render Preview:</span>
                </div>
                <div className="text-white text-sm sm:text-base font-medium">
                  <LatexRenderer content={currentQ.question || 'Preview will render here...'} />
                </div>
              </div>
            </div>

            {/* Diagram / Schematic Uploader */}
            <ImageUploader
              imageUrl={currentQ.imageUrl}
              onChange={(url) => updateCurrentQuestion({ imageUrl: url })}
              token={token}
            />

            {/* Answer Options */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase">
                  Answer Options ({currentQ.type === 'poll' ? 'Poll Choices' : 'Click circle to mark correct answer'})
                </span>
                {currentQ.type === 'multiple_choice' && currentQ.options.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Option
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQ.options.map((opt, optIdx) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  const colorBorders = ['border-red-500/40', 'border-blue-500/40', 'border-amber-500/40', 'border-emerald-500/40'];

                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 rounded-xl border bg-slate-800/70 space-y-2 transition-all ${
                        opt.isCorrect && currentQ.type !== 'poll'
                          ? 'border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-950/20'
                          : colorBorders[optIdx % 4]
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-slate-700 text-xs font-bold text-white flex items-center justify-center">
                            {letters[optIdx]}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            Option {letters[optIdx]}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {currentQ.type !== 'poll' && (
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(optIdx)}
                              className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md transition-colors ${
                                opt.isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-slate-400 hover:text-white bg-slate-700/60'
                              }`}
                            >
                              {opt.isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Correct Answer</span>
                                </>
                              ) : (
                                <>
                                  <Circle className="w-3.5 h-3.5" />
                                  <span>Mark Correct</span>
                                </>
                              )}
                            </button>
                          )}

                          {currentQ.type === 'multiple_choice' && currentQ.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(optIdx)}
                              className="text-slate-500 hover:text-rose-400 p-0.5"
                              title="Delete option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={opt.text}
                        onFocus={() => setActiveField({ target: 'option', optIndex: optIdx })}
                        onChange={(e) => handleOptionTextChange(optIdx, e.target.value)}
                        placeholder={`Option text with $math$ e.g. $v = 15\\text{ m/s}$`}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs sm:text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />

                      {/* Small KaTeX Preview */}
                      <div className="text-xs text-slate-300 min-h-[22px] px-1">
                        <span className="text-slate-500 text-[10px] mr-1.5">Preview:</span>
                        <LatexRenderer content={opt.text || '...'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation / Physics Derivation */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Physics Explanation / Derivation Note (Revealed after answers close)</span>
              </div>

              <textarea
                rows={2}
                value={currentQ.explanation || ''}
                onFocus={() => setActiveField({ target: 'explanation', optIndex: null })}
                onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                placeholder="Explain the derivation or physics principles e.g. Work is zero because $\vec{F}_B \perp \vec{v}$."
                className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
              />

              {currentQ.explanation && (
                <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-300">
                  <span className="text-indigo-400 font-semibold mr-1">Preview:</span>
                  <LatexRenderer content={currentQ.explanation} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
