import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function ImageUploader({ imageUrl, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|png|webp|gif|svg\+xml)/)) {
      setError('Please upload an image file (PNG, JPEG, WebP, SVG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB.');
      return;
    }

    setError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/quizzes/upload-image', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onChange(data.imageUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
          Physics Diagram / Schematic (Optional)
        </span>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Remove diagram
          </button>
        )}
      </div>

      {imageUrl ? (
        <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900/90 max-h-56 flex items-center justify-center p-2">
          <img
            src={imageUrl}
            alt="Physics schematic"
            className="max-h-52 max-w-full object-contain rounded-lg shadow-md"
          />
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow"
            >
              Change Diagram
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 bg-slate-800/40 hover:bg-slate-800/80 rounded-xl p-4 text-center cursor-pointer transition-all"
        >
          {uploading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-3 text-indigo-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Uploading schematic...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 py-2 text-slate-400">
              <Upload className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-medium text-slate-300">
                Click or drag & drop physics diagram / circuit schematic
              </span>
              <span className="text-[11px] text-slate-500">
                PNG, JPEG, WebP, SVG up to 10MB
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-400">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
