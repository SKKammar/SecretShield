import { NextResponse } from 'next/server';
import { getSessionToken, clearSessionToken } from '@/lib/session';

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        await clearSessionToken(); // Token expired or revoked
      }
      return NextResponse.json({ error: 'GitHub API error' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ login: data.login, avatar_url: data.avatar_url });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
