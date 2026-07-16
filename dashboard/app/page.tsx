'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getPat,
  setPat,
  clearPat,
  validatePat,
  getUserRepos,
  searchRepos,
  GitHubAuthError,
} from '@/lib/github';
import type { GitHubRepo } from '@/lib/types';
import { TokenGuide } from '@/components/TokenGuide';

export default function OverviewPage() {
  const [pat, setPatState] = useState<string>('');
  const [inputPat, setInputPat] = useState('');
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getPat();
    if (stored) {
      setPatState(stored);
      autoValidate(stored);
    }
  }, []);

  const autoValidate = async (token: string) => {
    try {
      const u = await validatePat();
      setUser(u);
      loadRepos();
    } catch {
      clearPat();
      setPatState('');
    }
  };

  const handleSavePat = async () => {
    if (!inputPat.trim()) return;
    setIsValidating(true);
    setAuthError(null);
    try {
      setPat(inputPat.trim());
      setPatState(inputPat.trim());
      const u = await validatePat();
      setUser(u);
      setInputPat('');
      loadRepos();
    } catch (err) {
      clearPat();
      setPatState('');
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSignOut = () => {
    clearPat();
    setPatState('');
    setUser(null);
    setRepos([]);
  };

  const loadRepos = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await getUserRepos();
      setRepos(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      loadRepos();
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const data = await searchRepos(q);
      setRepos(data);
    } catch (err) {
      if (err instanceof GitHubAuthError) {
        setAuthError(err.message);
      } else {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      }
    } finally {
      setIsSearching(false);
    }
  }, [loadRepos]);

  if (!pat) {
    return <AuthScreen
      inputPat={inputPat}
      setInputPat={setInputPat}
      onSave={handleSavePat}
      isValidating={isValidating}
      error={authError}
    />;
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-primary">
            REPOSITORIES
          </h1>
          <p className="mt-2 font-mono text-xs text-muted uppercase tracking-widest">
            {user && (
              <span>
                AUTH_USER: <strong className="text-primary">{user.login}</strong>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase tracking-widest"
        >
          [ SIGN_OUT ]
        </button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <label htmlFor="repo-search" className="mb-2 block font-mono text-xs text-muted uppercase tracking-widest">
          ▸ FILTER_REPOSITORIES
        </label>
        <input
          type="text"
          placeholder="e.g. SKKammar/secretshield..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="terminal-input"
          id="repo-search"
        />
      </div>

      {/* Error state */}
      {searchError && (
        <div className="border border-accent bg-transparent px-4 py-3 font-mono text-xs text-accent">
          [ERROR] {searchError}
          <button
            onClick={loadRepos}
            className="ml-4 underline underline-offset-4 hover:text-primary"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Repo list */}
      {isSearching ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse border border-border bg-surface" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyRepoState />
      ) : (
        <div className="flex flex-col border-y border-border">
          {repos.map((repo) => (
            <RepoRow key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Auth Screen ────────────────────────────────────────────────────────────

function AuthScreen({
  inputPat,
  setInputPat,
  onSave,
  isValidating,
  error,
}: {
  inputPat: string;
  setInputPat: (v: string) => void;
  onSave: () => void;
  isValidating: boolean;
  error: string | null;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col justify-center max-w-[480px]">
      <div className="mb-10">
        <div className="mb-4 flex h-8 w-10 items-center justify-center border border-accent font-mono text-lg font-bold text-accent">
          SS
        </div>
        <h1 className="font-mono text-2xl font-bold tracking-tight text-primary uppercase">
          SecretShield
        </h1>
        <p className="mt-2 font-mono text-xs text-muted lowercase">
          secret scanner for github actions
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="pat-input" className="mb-2 block font-mono text-xs font-bold text-accent uppercase tracking-widest">
            ▸ GITHUB_TOKEN
          </label>
          <input
            id="pat-input"
            type="password"
            placeholder="ghp_"
            value={inputPat}
            onChange={(e) => setInputPat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            className="terminal-input font-mono"
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="font-mono text-xs text-accent">
            [ERROR] {error}
          </p>
        )}

        <div>
          <button
            id="connect-btn"
            onClick={onSave}
            disabled={isValidating || !inputPat.trim()}
            className="terminal-button"
          >
            {isValidating ? '→ CONNECTING...' : '→ CONNECT'}
          </button>
        </div>
        
        <p className="font-mono text-[11px] text-muted lowercase">
          stored in localStorage · never leaves your browser
        </p>

        <TokenGuide />
      </div>
    </div>
  );
}

// ─── Repo Row ──────────────────────────────────────────────────────────────

function RepoRow({ repo }: { repo: GitHubRepo }) {
  const [owner, repoName] = repo.full_name.split('/');
  const updatedAt = new Date(repo.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Link
      href={`/repo/${owner}/${repoName}`}
      className="group flex flex-col sm:flex-row sm:items-center justify-between border-b border-border bg-background px-4 py-3 transition-colors hover:border-l-2 hover:border-l-accent hover:bg-surface border-l-2 border-l-transparent"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-sm text-primary group-hover:text-accent transition-colors">
          {repo.full_name}
        </span>
        <span className="font-mono text-[11px] text-muted max-w-xl truncate">
          {repo.description || 'NO_DESCRIPTION'}
        </span>
      </div>

      <div className="mt-2 sm:mt-0 flex items-center gap-6 font-mono text-xs text-muted">
        {repo.private && (
          <span className="text-orange-500">[PRIVATE]</span>
        )}
        <span className="tabular-nums flex items-center gap-1">
          <svg className="h-3 w-3 fill-muted" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
          {repo.stargazers_count.toString().padStart(3, '0')}
        </span>
        <span className="tabular-nums">UPD: {updatedAt}</span>
      </div>
    </Link>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyRepoState() {
  return (
    <div className="terminal-panel text-center py-16 border-border border">
      <p className="font-mono text-sm font-bold text-accent mb-2">NO_REPOSITORIES_FOUND</p>
      <p className="font-mono text-xs text-muted mb-6">
        Search for a specific repository or ensure your PAT has access.
      </p>
      <div className="inline-block text-left border border-border bg-[#0a0a0a] p-4 font-mono text-xs">
        <p className="text-muted mb-2"># ADD SECRETSHIELD TO GITHUB ACTIONS:</p>
        <pre className="text-mono-value">{`uses: SKKammar/secretshield@v1
with:
  token: \${{ secrets.GITHUB_TOKEN }}`}</pre>
      </div>
    </div>
  );
}
