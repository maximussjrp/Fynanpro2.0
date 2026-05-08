'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#070A12] px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo variant="horizontal-dark" height={32} />

        <nav className="flex items-center gap-6 text-sm font-semibold text-slate-500">
          <Link href="/privacidade" className="transition-colors hover:text-white">
            Privacidade
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Entrar
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Criar conta
          </Link>
        </nav>

        <p className="text-xs text-slate-600">© 2026 UTOP. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
