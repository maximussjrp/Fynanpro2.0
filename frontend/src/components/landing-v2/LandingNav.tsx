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
        scrolled ? 'bg-[#0B1120]/95 backdrop-blur-md border-b border-white/10 shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">UTOP</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[#94A3B8] hover:text-white text-sm font-medium transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-[#94A3B8] hover:text-white text-sm font-medium transition-colors">
            Entrar
          </Link>
          <Link
            href="/login"
            className="bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            Começar agora
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-[#94A3B8] hover:text-white"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0F1829] border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-[#CBD5E1] hover:text-white text-sm font-medium"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="mt-2 bg-[#10B981] text-white text-sm font-semibold px-5 py-2.5 rounded-lg text-center"
          >
            Começar agora
          </Link>
        </div>
      )}
    </header>
  );
}
