import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GITHUB_CLIENT_ID is not configured' }, { status: 500 });
  }

  // Requesting repo scope to read artifacts and dispatch workflows
  const redirectUri = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;
  return NextResponse.redirect(redirectUri);
}
