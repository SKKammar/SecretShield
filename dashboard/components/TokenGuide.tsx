'use client';

import { useState } from 'react';

export function TokenGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-8 text-left max-w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="font-mono text-xs text-muted hover:text-primary transition-colors flex items-center gap-2 outline-none"
      >
        <span>{isOpen ? '▾' : '▸'}</span>
        how to generate a token
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-200 ease-in-out ${
          isOpen ? 'max-h-[600px] mt-4' : 'max-h-0'
        }`}
      >
        <div className="flex flex-col gap-2 font-mono text-xs">
          <Step num="01" text="github.com → profile photo (top right) → Settings" />
          <Step num="02" text="Scroll to bottom of left sidebar → Developer settings" />
          <Step num="03" text="Personal access tokens → Tokens (classic)" />
          <Step num="04" text="Generate new token (classic)" />
          <Step num="05" text="Note: 'SecretShield Dashboard'" />
          <Step num="06" text="Expiration: 90 days (or No expiration)" />
          <div className="flex items-start gap-3">
            <span className="text-accent flex-shrink-0">07</span>
            <span className="text-muted leading-tight">
              Scope: check <span className="border border-border bg-[#111111] text-mono-value px-1 mx-0.5">repo</span> (for manual scans) and <span className="border border-border bg-[#111111] text-mono-value px-1 mx-0.5">read:actions</span>
            </span>
          </div>
          <Step num="08" text="Click Generate token" />
          <div className="flex items-start gap-3">
            <span className="text-accent flex-shrink-0">09</span>
            <span className="text-muted leading-tight">
              Copy immediately — <span className="text-accent">GitHub shows it only once</span>
            </span>
          </div>
          
          <div className="flex items-start gap-3 mt-2">
            <span className="opacity-0 flex-shrink-0">10</span>
            <span className="text-muted leading-tight">
              Then paste it in the field above and hit → connect
            </span>
          </div>

          <div className="flex items-start gap-3 mt-6">
            <span className="opacity-0 flex-shrink-0">11</span>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo,read:actions&description=SecretShield+Dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-primary hover:underline underline-offset-4 flex items-center gap-1 transition-colors"
            >
              ↗ open github token settings
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-accent flex-shrink-0">{num}</span>
      <span className="text-muted leading-tight">{text}</span>
    </div>
  );
}
