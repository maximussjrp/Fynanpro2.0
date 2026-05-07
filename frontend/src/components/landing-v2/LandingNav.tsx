'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0B1020]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          <span className="text-lg font-bold text-[#F5F7FB] tracking-tight">UTOP</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[#64748B] hover:text-[#F5F7FB] text-sm font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-[#64748B] hover:text-[#F5F7FB] text-sm font-medium transition-colors px-4 py-2">
            Entrar
          </Link>
          <Link
            href="/login"
            className="bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors shadow-md shadow-[#10B981]/20"
          >
            Começar agora
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-[#64748B] hover:text-white p-1"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#151B2E] border-t border-white/[0.06] px-4 py-5 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-[#94A3B8] hover:text-white text-sm font-medium py-1"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="mt-1 bg-[#10B981] text-white text-sm font-semibold px-5 py-2.5 rounded-xl text-center"
          >
            Começar agora
          </Link>
        </div>
      )}
    </header>
  );
}
