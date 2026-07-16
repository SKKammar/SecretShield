'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-6 items-center border border-accent px-1.5 font-mono text-sm font-bold text-accent">
            SS
          </div>
          <span className="font-mono text-sm tracking-widest text-primary">SECRETSHIELD</span>
        </Link>

        <nav className="flex items-center gap-6">
          <NavLink href="/" active={pathname === '/'}>
            overview
          </NavLink>
          <a
            href="https://github.com/SKKammar/secretshield"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-muted transition-colors hover:text-primary hover:underline underline-offset-4"
          >
            github
          </a>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`font-mono text-sm transition-colors hover:underline underline-offset-4 ${
        active ? 'text-primary' : 'text-muted hover:text-primary'
      }`}
    >
      {children}
    </Link>
  );
}
