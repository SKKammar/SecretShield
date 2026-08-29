'use client';

import { useState } from 'react';
import type { GitHubRepo } from '@/lib/types';

export function SetupAllButton({ repos }: { repos: GitHubRepo[] }) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleSetupAll = async () => {
    if (repos.length === 0) return;
    
    // Ask for confirmation
    if (!confirm(`Are you sure you want to add the SecretShield workflow to ${repos.length} repositories?`)) {
      return;
    }

    setIsSettingUp(true);
    setError(null);
    setProgress({ current: 0, total: repos.length });

    let successCount = 0;
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const [owner, repoName] = repo.full_name.split('/');
      
      setProgress({ current: i + 1, total: repos.length });

      try {
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo: repoName }),
        });

        if (res.ok) {
          successCount++;
        } else {
          console.error(`Failed to setup ${repo.full_name}:`, res.statusText);
        }
      } catch (err) {
        console.error(`Error setting up ${repo.full_name}:`, err);
      }

      // Small delay to prevent rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    setIsSettingUp(false);
    
    if (successCount === repos.length) {
      alert('Successfully setup all repositories!');
    } else {
      setError(`Completed. Setup ${successCount} out of ${repos.length} repositories.`);
    }
  };

  if (repos.length === 0) return null;

  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] text-muted mb-2 font-mono text-right max-w-xs">
        * Deploys the SecretShield workflow (.github/workflows/secretshield.yml) to all listed repositories to automate secret scanning.
      </span>
      <button
        onClick={handleSetupAll}
        disabled={isSettingUp}
        className="font-mono text-xs uppercase tracking-widest border border-primary px-3 py-1 hover:bg-primary hover:text-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSettingUp ? `SETTING_UP... [${progress.current}/${progress.total}]` : 'PROTECT_ALL_REPOS'}
      </button>
      {error && (
        <span className="text-[10px] text-accent mt-1 font-mono">{error}</span>
      )}
    </div>
  );
}
