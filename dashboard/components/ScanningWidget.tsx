'use client';

import { useEffect, useState } from 'react';
import { ScanStatus } from './ScanProvider';

export function ScanningWidget({ owner, repo, status }: { owner: string; repo: string; status: ScanStatus }) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    if (status !== 'running') return;
    const i = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(i);
  }, [status]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-[#0a0a0a] border border-border w-80 shadow-2xl p-4 font-mono relative overflow-hidden flex flex-col">
        
        {status === 'running' && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent h-[200%] animate-scan-beam pointer-events-none" />
        )}

        <div className="flex justify-between items-center mb-4 border-b border-border pb-2 relative z-10">
          <span className="text-primary font-bold text-[11px] tracking-widest uppercase">SecretShield Scan</span>
          {status === 'running' && (
            <span className="text-accent text-[10px] animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
              LIVE
            </span>
          )}
          {status === 'success' && <span className="text-mono-value text-[10px]">COMPLETE</span>}
          {status === 'error' && <span className="text-accent text-[10px]">FAILED</span>}
        </div>

        <div className="space-y-2 text-[10px] relative z-10 flex-1">
          <p className="text-muted">target: <span className="text-primary">{repo}</span></p>
          
          {status === 'running' && (
            <>
              <p className="text-muted">status: <span className="text-accent">scanning{dots}</span></p>
              <div className="mt-3 p-2 border border-[#222] bg-[#111] text-muted overflow-hidden relative text-[9px] h-12">
                <div className="absolute inset-0 opacity-20 pointer-events-none flex flex-col justify-end p-2 select-none" aria-hidden="true">
                  <p>scanning files...</p>
                  <p>analyzing commits...</p>
                </div>
              </div>
            </>
          )}

          {status === 'success' && (
            <div className="mt-3 p-2 border border-border bg-[#111] text-mono-value">
              <p>✓ Scan finished successfully.</p>
              <p className="text-muted mt-1">Refreshing dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 p-2 border border-border bg-[#111] text-accent">
              <p>✗ Scan failed to trigger.</p>
              <p className="text-muted mt-1">Check logs and configuration.</p>
            </div>
          )}
          
          <p className="text-[9px] text-muted/60 mt-4 pt-3 border-t border-border/50 uppercase tracking-wider">
            Tip: Scans generally take a few minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
