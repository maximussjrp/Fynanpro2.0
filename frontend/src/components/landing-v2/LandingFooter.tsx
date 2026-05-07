'use client';

import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer className="bg-[#0B1120] border-t border-white/10 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#10B981] flex items-center justify-center">
            <span className="text-white font-bold text-xs">U</span>
          </div>
          <span className="text-white font-bold">UTOP</span>
        </div>

        <nav className="flex items-center gap-6 text-sm text-[#64748B]">
          <Link href="/privacidade" className="hover:text-white transition-colors">
            Privacidade
          </Link>
          <Link href="/login" className="hover:text-white transition-colors">
            Entrar
          </Link>
          <Link href="/login" className="hover:text-white transition-colors">
            Criar conta
          </Link>
        </nav>

        <p className="text-xs text-[#475569]">© 2026 UTOP. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
