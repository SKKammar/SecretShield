import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'SecretShield Dashboard',
    template: '%s | SecretShield',
  },
  description:
    'Visualize SecretShield scan history across your repositories. Track secret detection trends, severity breakdowns, and remediation progress.',
  keywords: ['github actions', 'secret detection', 'security', 'gitleaks', 'devops'],
  authors: [{ name: 'SKKammar', url: 'https://github.com/SKKammar' }],
  openGraph: {
    title: 'SecretShield Dashboard',
    description: 'Automated secret detection dashboard for GitHub repositories',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <NavBar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mt-16 border-t border-white/5 py-8 text-center">
          <p className="text-xs text-slate-600">
            🛡️ SecretShield — Built by{' '}
            <a
              href="https://github.com/SKKammar"
              className="text-slate-500 hover:text-slate-400 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              SKKammar
            </a>{' '}
            · MIT License
          </p>
        </footer>
      </body>
    </html>
  );
}
