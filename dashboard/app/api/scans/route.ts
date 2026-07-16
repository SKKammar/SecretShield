import { type NextRequest, NextResponse } from 'next/server';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GET /api/scans?owner=...&repo=...&artifact_id=...
 *
 * Proxies the GitHub Artifacts download through Next.js to avoid CORS issues.
 * The PAT is passed from the client via the Authorization header.
 *
 * GitHub's artifact download URL requires a redirect — we follow it and
 * return the first secretshield-report.json found in the zip archive.
 *
 * NOTE: GitHub artifact downloads return a ZIP file. Since we can't easily
 * decompress a ZIP in a pure edge/serverless function without native modules,
 * we return the artifact metadata and let the client fetch via the direct URL
 * when running in Node.js runtime. This route handles the auth proxy.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const owner      = searchParams.get('owner');
  const repo       = searchParams.get('repo');
  const artifactId = searchParams.get('artifact_id');

  if (!owner || !repo || !artifactId) {
    return NextResponse.json(
      { error: 'Missing required parameters: owner, repo, artifact_id' },
      { status: 400 },
    );
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  try {
    // Step 1: Get artifact metadata to find the download URL
    const artifactRes = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/artifacts/${artifactId}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!artifactRes.ok) {
      const body = await artifactRes.json().catch(() => ({})) as Record<string, unknown>;
      return NextResponse.json(
        { error: `GitHub API error: ${artifactRes.status}`, details: body },
        { status: artifactRes.status },
      );
    }

    const artifact = await artifactRes.json() as { archive_download_url: string; expired: boolean };

    if (artifact.expired) {
      return NextResponse.json({ error: 'Artifact has expired' }, { status: 410 });
    }

    // Step 2: Download the artifact ZIP (GitHub redirects to a signed URL)
    const zipRes = await fetch(artifact.archive_download_url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'follow',
    });

    if (!zipRes.ok) {
      return NextResponse.json(
        { error: `Failed to download artifact: ${zipRes.status}` },
        { status: zipRes.status },
      );
    }

    // Step 3: Decompress ZIP and extract secretshield-report.json
    // We use Node.js built-in zlib and stream APIs
    const { default: AdmZip } = await import('adm-zip').catch(() => ({ default: null }));

    if (!AdmZip) {
      // Fallback: return metadata only if adm-zip not available
      return NextResponse.json(
        { error: 'ZIP extraction unavailable — install adm-zip or view artifact directly on GitHub' },
        { status: 501 },
      );
    }

    const buffer = Buffer.from(await zipRes.arrayBuffer());
    const zip    = new (AdmZip as new (buffer: Buffer) => InstanceType<typeof AdmZip>)(buffer);
    const entry  = zip.getEntry('secretshield-report.json');

    if (!entry) {
      return NextResponse.json(
        { error: 'secretshield-report.json not found in artifact archive' },
        { status: 404 },
      );
    }

    const jsonStr = entry.getData().toString('utf8');
    const report  = JSON.parse(jsonStr) as unknown;

    return NextResponse.json(report, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
