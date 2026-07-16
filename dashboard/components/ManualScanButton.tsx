'use client';

import { useState } from 'react';
import { triggerManualScan } from '@/lib/github';

export function ManualScanButton({ owner, repo }: { owner: string; repo: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (status === 'loading') return;
    
    setStatus('loading');
    try {
      await triggerManualScan(owner, repo);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      if (err?.status === 403 || err?.status === 404) {
        alert("Manual scan requires a PAT with 'repo' scope, and a workflow listening to the 'repository_dispatch' event (types: [secretshield-scan]).");
      }
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button 
      onClick={handleScan}
      disabled={status === 'loading'}
      className="font-mono text-[10px] text-muted hover:text-accent transition-colors uppercase border border-border px-2 py-0.5 bg-[#111111] hover:bg-surface outline-none"
    >
      {status === 'idle' && '▸ manual scan'}
      {status === 'loading' && '...'}
      {status === 'success' && '✓ triggered'}
      {status === 'error' && '✗ failed'}
    </button>
  );
}
