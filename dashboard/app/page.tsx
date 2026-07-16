'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
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

// ─── Overview Page ─────────────────────────────────────────────────────────

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

  // Load PAT from localStorage on mount
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
      // Token invalid or expired — clear silently
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

  // No PAT → show auth screen
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
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            <span className="gradient-text">Scan Overview</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {user && (
              <span className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar_url} alt={user.login} className="h-5 w-5 rounded-full" />
                Signed in as <strong className="text-slate-300">@{user.login}</strong>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-400 transition-all hover:bg-white/10 hover:text-slate-200"
        >
          Sign out
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search repositories (e.g. SKKammar/secretshield)…"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="input-dark pl-10"
          id="repo-search"
        />
      </div>

      {/* Error state */}
      {searchError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span>⚠️</span>
          <span>{searchError}</span>
          <button
            onClick={loadRepos}
            className="ml-auto rounded-lg bg-red-500/20 px-3 py-1 text-xs font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Repo grid */}
      {isSearching ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card animate-pulse p-5">
              <div className="mb-3 h-5 w-3/4 rounded-md bg-white/10" />
              <div className="h-3 w-full rounded-md bg-white/5" />
              <div className="mt-2 h-3 w-2/3 rounded-md bg-white/5" />
            </div>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyRepoState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md animate-slide-up">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mb-4 text-6xl">🛡️</div>
          <h1 className="mb-2 text-3xl font-bold gradient-text">SecretShield</h1>
          <p className="text-slate-400">
            Connect your GitHub account to view scan history across all your repositories.
          </p>
        </div>

        {/* Auth card */}
        <div className="glass-card border-gradient p-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-300">GitHub Personal Access Token</h2>
          <p className="mb-4 text-xs text-slate-500">
            Requires <code className="rounded bg-white/10 px-1 text-slate-400">read:actions</code> scope.{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=read:actions&description=SecretShield+Dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-shield-400 hover:text-shield-300 transition-colors"
            >
              Generate one →
            </a>
          </p>

          <div className="space-y-3">
            <input
              id="pat-input"
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={inputPat}
              onChange={(e) => setInputPat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              className="input-dark font-mono"
              autoComplete="off"
            />

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <span>⚠️</span> {error}
              </p>
            )}

            <button
              id="connect-btn"
              onClick={onSave}
              disabled={isValidating || !inputPat.trim()}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isValidating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting…
                </span>
              ) : (
                'Connect GitHub Account'
              )}
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-600">
            🔒 Token stored locally in your browser only — never sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Repo Card ──────────────────────────────────────────────────────────────

function RepoCard({ repo }: { repo: GitHubRepo }) {
  const [owner, repoName] = repo.full_name.split('/');
  const updatedAt = new Date(repo.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Link
      href={`/repo/${owner}/${repoName}`}
      className="group glass-card block p-5 transition-all hover:border-shield-500/30 hover:bg-white/8 hover:shadow-lg hover:shadow-shield-500/10"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={repo.owner.avatar_url}
            alt={repo.owner.login}
            className="h-6 w-6 flex-shrink-0 rounded-full"
          />
          <span className="truncate text-sm font-semibold text-white group-hover:text-shield-200 transition-colors">
            {repo.full_name}
          </span>
        </div>
        {repo.private && (
          <span className="flex-shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">
            Private
          </span>
        )}
      </div>

      {repo.description && (
        <p className="mb-3 line-clamp-2 text-xs text-slate-400">{repo.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          ⭐ {repo.stargazers_count}
        </span>
        <span>Updated {updatedAt}</span>
        <span className="ml-auto text-shield-400 opacity-0 group-hover:opacity-100 transition-opacity">
          View scans →
        </span>
      </div>
    </Link>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyRepoState() {
  return (
    <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🔍</div>
      <h3 className="mb-2 text-lg font-semibold text-white">No repositories found</h3>
      <p className="mb-6 max-w-sm text-sm text-slate-400">
        Try searching for a specific repository, or make sure your PAT has access to the repos you want to scan.
      </p>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-xs text-slate-400">
        <p className="mb-1 font-semibold text-slate-300">Add SecretShield to any repo:</p>
        <pre className="mt-2 overflow-x-auto text-shield-300">{`uses: SKKammar/secretshield@v1
with:
  token: \${{ secrets.GITHUB_TOKEN }}`}</pre>
      </div>
    </div>
  );
}
