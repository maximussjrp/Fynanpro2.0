'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#metodo', label: 'Como funciona' },
    { href: '#funcionalidades', label: 'Funcionalidades' },
    { href: '#precos', label: 'Planos' },
    { href: '#faq', label: 'Dúvidas' },
  ];

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled
          ? 'border-white/[0.08] bg-[#0B1020]/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'border-white/[0.06] bg-[#0B1020]/76'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/landing-v2" aria-label="UTOP">
          <Logo variant="horizontal-dark" height={36} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-slate-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white">
            Entrar
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-md shadow-emerald-400/20 transition hover:bg-emerald-300"
          >
            Começar agora
          </Link>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-xl text-slate-300 transition hover:bg-white/[0.06] hover:text-white md:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-[#101827] px-4 py-5 md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-semibold text-slate-300"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-1 rounded-xl bg-emerald-400 px-5 py-3 text-center text-sm font-extrabold text-slate-950"
            >
              Começar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
