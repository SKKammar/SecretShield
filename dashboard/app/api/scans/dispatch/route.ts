import { type NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/session';
import crypto from 'crypto';

const GITHUB_API_BASE = 'https://api.github.com';

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: 'Missing owner or repo' }, { status: 400 });
    }

    const request_id = crypto.randomUUID();

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: 'secretshield-scan',
        client_payload: {
          request_id
        }
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'GitHub API error' }, { status: res.status });
    }

    return NextResponse.json({ success: true, request_id });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
