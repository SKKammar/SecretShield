import { type NextRequest, NextResponse } from 'next/server';
import { setSessionToken, clearSessionToken } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    // If logout
    if (searchParams.get('action') === 'logout') {
      await clearSessionToken();
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'OAuth not configured on server' }, { status: 500 });
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
    }

    if (data.access_token) {
      await setSessionToken(data.access_token);
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.redirect(new URL('/?error=unknown', request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/?error=internal_error', request.url));
  }
}
