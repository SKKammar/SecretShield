'use client';

import { useState } from 'react';

export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 flex items-center">
        {label && <span className="mr-3 font-mono text-[10px] text-muted">{label}</span>}
        <button
          onClick={handleCopy}
          className={`font-mono text-xs transition-colors outline-none ${
            copied ? 'text-accent-secondary' : 'text-muted hover:text-primary'
          }`}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>
      <div className="bg-[#111111] border border-border p-4 font-mono text-xs text-mono-value overflow-x-auto">
        <pre>{code}</pre>
      </div>
    </div>
  );
}
