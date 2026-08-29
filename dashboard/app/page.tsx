'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  validatePat,
  getUserRepos,
  searchRepos,
  GitHubAuthError,
} from '@/lib/github';
import type { GitHubRepo } from '@/lib/types';
import { EmptyState } from '@/components/EmptyState';
import { ManualScanButton } from '@/components/ManualScanButton';
import { SetupAllButton } from '@/components/SetupAllButton';

export default function OverviewPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await validatePat();
        setUser(u);
        setIsAuthenticated(true);
        loadRepos();
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  const handleSignOut = () => {
    window.location.href = '/api/auth/callback?action=logout';
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
      setIsSearching(true);
      try {
        const data = await getUserRepos();
        setRepos(data);
      } catch (err) {
        // ignore
      } finally {
        setIsSearching(false);
      }
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

  if (isCheckingAuth) {
    return <div className="p-8 font-mono text-sm text-muted">Checking session...</div>;
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} error={authError} />;
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-primary">
            REPOSITORIES {repos.length > 0 && `(${repos.length})`}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted uppercase tracking-widest">
            {user && (
              <span>
                AUTH_USER: <strong className="text-primary">{user.login}</strong>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <SetupAllButton repos={repos} />
          <button
            onClick={handleSignOut}
            className="font-mono text-xs text-muted hover:text-accent transition-colors uppercase tracking-widest"
          >
            [ SIGN_OUT ]
          </button>
        </div>
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
        <EmptyState />
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
  onLogin,
  error,
}: {
  onLogin: () => void;
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
        {error && (
          <p className="font-mono text-xs text-accent">
            [ERROR] {error}
          </p>
        )}

        <div>
          <button
            onClick={onLogin}
            className="terminal-button"
          >
            → LOGIN_WITH_GITHUB
          </button>
        </div>
        
        <p className="font-mono text-[11px] text-muted lowercase">
          secure server-side session · no tokens stored in browser
        </p>
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
        <ManualScanButton owner={owner} repo={repoName} />
        {repo.private && (
          <span className="text-orange-500">[PRIVATE]</span>
        )}
        <span className="tabular-nums">UPD: {updatedAt}</span>
      </div>
    </Link>
  );
}


