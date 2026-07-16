'use client';

import { useEffect, useState } from 'react';

export function ScanningModal({ repo }: { repo: string }) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const i = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-border w-full max-w-lg shadow-2xl p-6 font-mono relative overflow-hidden">
        
        {/* Scanning beam effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent h-[200%] animate-scan-beam pointer-events-none" />

        <div className="flex justify-between items-center mb-6 border-b border-border pb-2 relative z-10">
          <span className="text-primary font-bold text-sm tracking-widest uppercase">SecretShield Console</span>
          <span className="text-accent animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            LIVE
          </span>
        </div>

        <div className="space-y-3 text-xs relative z-10">
          <p className="text-muted">➔ target: <span className="text-primary">{repo}</span></p>
          <p className="text-muted">➔ status: <span className="text-accent">initiating remote scan{dots}</span></p>
          
          <div className="mt-6 p-4 border border-[#222] bg-[#111] text-muted overflow-hidden relative">
            <div className="flex gap-2 relative z-10">
              <span className="text-accent">❯</span>
              <span className="animate-pulse bg-primary/80 text-background px-1">gitleaks detect --source . --report-format json</span>
            </div>
            {/* Faint code scrolling in background for aesthetics */}
            <div className="absolute inset-0 opacity-10 pointer-events-none flex flex-col justify-end p-4 select-none" aria-hidden="true">
              <p>scanning 129 files...</p>
              <p>analyzing commit history...</p>
              <p>checking custom patterns...</p>
            </div>
          </div>
          
          <p className="text-[10px] text-muted/60 mt-6 pt-4 border-t border-border/50 text-center uppercase tracking-wider">
            Tip: A manual scan generally takes a few minutes depending on repository size.
          </p>
        </div>
      </div>
    </div>
  );
}
