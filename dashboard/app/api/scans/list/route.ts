import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';

const GITHUB_API_BASE = 'https://api.github.com';

export async function GET(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '30';

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
  }

  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/artifacts?per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'GitHub API error' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
