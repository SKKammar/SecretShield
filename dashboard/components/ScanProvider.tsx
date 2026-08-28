'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { triggerManualScan, listScanArtifacts, fetchScanReport } from '@/lib/github';
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
      const { request_id } = await triggerManualScan(targetOwner, targetRepo);

      let attempts = 0;
      let timeoutId: NodeJS.Timeout;

      const checkStatus = async () => {
        attempts++;
        try {
          const currentArtifacts = await listScanArtifacts(targetOwner, targetRepo, 10, 1);
          // Look for any secretshield-report artifact
          const reports = currentArtifacts.artifacts.filter((a: any) => a.name.startsWith('secretshield-report'));
          
          for (const artifact of reports) {
            // Check if it's new enough and hasn't expired
            if (artifact.expired) continue;
            
            // Try fetching the report to see if the request_id matches
            const report = await fetchScanReport(targetOwner, targetRepo, artifact.id);
            if (report && report.request_id === request_id) {
              setStatus('success');
              setTimeout(() => {
                window.location.reload();
                dismiss();
              }, 3000);
              return;
            }
          }

          if (attempts >= 24) {
            setStatus('error');
            setTimeout(() => dismiss(), 5000);
            return;
          }
        } catch (e) {
          // ignore
        }
        
        timeoutId = setTimeout(checkStatus, 5000);
      };

      // Start the polling
      timeoutId = setTimeout(checkStatus, 5000);
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
