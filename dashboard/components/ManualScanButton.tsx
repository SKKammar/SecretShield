'use client';

import { useScan } from './ScanProvider';

export function ManualScanButton({ owner, repo }: { owner: string; repo: string }) {
  const { startScan, status, owner: activeOwner, repo: activeRepo } = useScan();

  const isActiveForThisRepo = (status === 'running' || status === 'loading') && activeOwner === owner && activeRepo === repo;
  const isRunningGlobally = status === 'running' || status === 'loading';

  const handleScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isRunningGlobally) return;
    startScan(owner, repo);
  };

  return (
    <button 
      onClick={handleScan}
      disabled={isRunningGlobally}
      className={`font-mono text-[10px] uppercase border border-border px-2 py-0.5 outline-none transition-colors ${
        isActiveForThisRepo 
          ? 'text-accent bg-surface' 
          : 'text-muted hover:text-accent bg-[#111111] hover:bg-surface'
      } ${isRunningGlobally && !isActiveForThisRepo ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {!isActiveForThisRepo && '▸ manual scan'}
      {isActiveForThisRepo && '⟳ scanning'}
    </button>
  );
}
