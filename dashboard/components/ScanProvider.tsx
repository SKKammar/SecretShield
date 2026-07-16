'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { triggerManualScan, listScanArtifacts } from '@/lib/github';
import { ScanningWidget } from './ScanningWidget';

export type ScanStatus = 'idle' | 'running' | 'success' | 'error';

interface ScanContextType {
  status: ScanStatus;
  owner: string | null;
  repo: string | null;
  startScan: (owner: string, repo: string) => Promise<void>;
  dismiss: () => void;
}

const ScanContext = createContext<ScanContextType | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [owner, setOwner] = useState<string | null>(null);
  const [repo, setRepo] = useState<string | null>(null);

  const dismiss = () => {
    setStatus('idle');
    setOwner(null);
    setRepo(null);
  };

  const startScan = async (targetOwner: string, targetRepo: string) => {
    if (status === 'running') return;
    
    setOwner(targetOwner);
    setRepo(targetRepo);
    setStatus('running');

    try {
      const initialArtifacts = await listScanArtifacts(targetOwner, targetRepo, 1, 1).catch(() => null);
      const initialId = initialArtifacts?.artifacts[0]?.id;

      await triggerManualScan(targetOwner, targetRepo);

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const currentArtifacts = await listScanArtifacts(targetOwner, targetRepo, 1, 1);
          const currentId = currentArtifacts.artifacts[0]?.id;
          
          if (currentId && currentId !== initialId) {
            clearInterval(interval);
            setStatus('success');
            setTimeout(() => {
              window.location.reload();
              dismiss();
            }, 5000);
          } else if (attempts >= 24) {
            clearInterval(interval);
            setStatus('success');
            setTimeout(() => dismiss(), 5000);
          }
        } catch (e) {
          // ignore
        }
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      if (err?.status === 403 || err?.status === 404) {
        alert("Manual scan requires a PAT with 'repo' scope, and a workflow listening to the 'repository_dispatch' event (types: [secretshield-scan]).");
      }
      setTimeout(() => dismiss(), 5000);
    }
  };

  return (
    <ScanContext.Provider value={{ status, owner, repo, startScan, dismiss }}>
      {children}
      {(status !== 'idle' && owner && repo) && (
        <ScanningWidget owner={owner} repo={repo} status={status} />
      )}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScan must be used within ScanProvider');
  return context;
}
