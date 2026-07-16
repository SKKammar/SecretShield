'use client';

import { useState } from 'react';
import { triggerManualScan, listScanArtifacts } from '@/lib/github';

export function ManualScanButton({ owner, repo }: { owner: string; repo: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'success' | 'error'>('idle');

  const handleScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (status === 'loading' || status === 'running') return;
    
    setStatus('loading');
    try {
      // Get the current latest artifact ID to compare against later
      const initialArtifacts = await listScanArtifacts(owner, repo, 1, 1).catch(() => null);
      const initialId = initialArtifacts?.artifacts[0]?.id;

      await triggerManualScan(owner, repo);
      setStatus('running');

      // Poll for the new artifact up to 60 seconds (12 attempts * 5s)
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const currentArtifacts = await listScanArtifacts(owner, repo, 1, 1);
          const currentId = currentArtifacts.artifacts[0]?.id;
          
          if (currentId && currentId !== initialId) {
            clearInterval(interval);
            setStatus('success');
            setTimeout(() => window.location.reload(), 1000);
          } else if (attempts >= 12) {
            clearInterval(interval);
            setStatus('success'); // Trigger was successful, just taking long
            setTimeout(() => setStatus('idle'), 3000);
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 5000);
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
      {status === 'running' && '⟳ scanning'}
      {status === 'success' && '✓ complete'}
      {status === 'error' && '✗ failed'}
    </button>
  );
}
