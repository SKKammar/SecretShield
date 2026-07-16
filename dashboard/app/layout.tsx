import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { JetBrains_Mono } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import { ScanProvider } from '@/components/ScanProvider';
import './globals.css';


import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: {
    default: 'SecretShield Console',
    template: '%s | SecretShield',
  },
  description:
    'Terminal security console for SecretShield. Automated secret detection across GitHub repositories.',
  keywords: ['github actions', 'secret detection', 'security', 'gitleaks', 'devops'],
  authors: [{ name: 'SKKammar', url: 'https://github.com/SKKammar' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${jetbrains.variable}`}>
      <body>
        <ScanProvider>
          <NavBar />
          <main className="mx-auto w-full max-w-5xl px-6 py-12">
            {children}
          </main>
        </ScanProvider>
        <footer className="mt-16 border-t border-border py-8 px-6 max-w-5xl mx-auto">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">
            secretshield · <a href="https://github.com/SKKammar" className="hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer">@SKKammar</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
