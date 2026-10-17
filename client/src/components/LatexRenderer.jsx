import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * LatexRenderer safely parses and renders mixed text and LaTeX formulas.
 * Supports:
 * - Block math: $$ ... $$
 * - Inline math: $ ... $
 * - Standard text with fallback on KaTeX parse errors
 */
export default function LatexRenderer({ content, className = '', block = false }) {
  const renderedHtml = useMemo(() => {
    if (!content || typeof content !== 'string') return '';

    // If block prop is forced and content doesn't have $$, wrap or render directly
    const text = content.trim();

    // Regex to find $$...$$ or $...$
    // $$([^$]+)$$ for block
    // \$([^$\n]+)\$ for inline
    const parts = [];
    const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Plain text before match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: text.slice(lastIndex, match.index)
        });
      }

      const raw = match[0];
      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        parts.push({
          type: 'block-math',
          math: raw.slice(2, -2).trim()
        });
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        parts.push({
          type: 'inline-math',
          math: raw.slice(1, -1).trim()
        });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        value: text.slice(lastIndex)
      });
    }

    // Convert parts to HTML
    return parts.map(part => {
      if (part.type === 'text') {
        // Escape HTML
        return part.value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');
      }

      try {
        const isBlock = part.type === 'block-math' || block;
        return katex.renderToString(part.math, {
          displayMode: isBlock,
          throwOnError: false,
          output: 'htmlAndMathml'
        });
      } catch (err) {
        return `<span class="text-rose-400 font-mono text-xs">[LaTeX Error: ${err.message}]</span>`;
      }
    }).join('');
  }, [content, block]);

  return (
    <span
      className={`inline-latex-content leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
