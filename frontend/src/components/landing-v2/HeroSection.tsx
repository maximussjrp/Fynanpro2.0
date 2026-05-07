'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ChevronDown } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-20 overflow-hidden">
      {/* Background radial glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#10B981]/[0.07] rounded-full blur-[140px]" />
        <div className="absolute top-[30%] left-[10%] w-[400px] h-[400px] bg-[#3B82F6]/[0.05] rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto w-full">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#10B981]/[0.08] border border-[#10B981]/20 text-[#10B981] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase">
          Organização financeira que funciona na prática
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-[#F5F7FB] leading-[1.1] mb-6 tracking-tight">
          Organize sua vida financeira com clareza —
          <br className="hidden sm:block" />
          <span className="text-[#10B981]"> sem planilhas confusas</span>,<br className="hidden sm:block" />
          sem complicação e sem perder o controle.
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-[#64748B] leading-relaxed mb-10 max-w-2xl mx-auto">
          O UTOP ajuda você a enxergar entradas, saídas, dívidas e compromissos em um só lugar,
          com uma rotina simples para transformar bagunça financeira em decisão.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-[0_0_40px_rgba(16,185,129,0.35)]"
          >
            Começar minha organização financeira
            <ArrowRight size={16} />
          </Link>
          <a
            href="#metodo"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#151B2E] hover:bg-[#1A2236] border border-white/[0.08] hover:border-white/[0.14] text-[#94A3B8] hover:text-[#F5F7FB] font-semibold px-8 py-3.5 rounded-2xl text-sm transition-all"
          >
            Ver como funciona
          </a>
        </div>

        {/* Hero image + dashboard mockup */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] shadow-[0_32px_80px_rgba(0,0,0,0.6)] bg-[#151B2E]">
          {/* Family photo with overlay */}
          <div className="relative">
            <Image
              src="/images/hero-family.jpg"
              alt="Família organizando as finanças com UTOP"
              width={1200}
              height={600}
              className="w-full object-cover max-h-[500px]"
              priority
            />
            {/* Bottom gradient for smooth transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1020] via-[#0B1020]/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1020]/40 via-transparent to-[#0B1020]/40" />

            {/* Floating KPI cards over the image */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-4 sm:px-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {[
                  { label: 'Entradas', value: 'R$ 8.400', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                  { label: 'Saídas', value: 'R$ 5.200', color: '#C026D3', bg: 'rgba(192,38,211,0.12)' },
                  { label: 'Dívidas', value: 'R$ 1.800', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                  { label: 'Saldo', value: 'R$ 3.200', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="backdrop-blur-xl rounded-2xl p-3.5 text-left border border-white/[0.08]"
                    style={{ background: 'rgba(11,16,32,0.75)' }}
                  >
                    <p className="text-[11px] text-[#64748B] mb-1 font-medium">{card.label}</p>
                    <p className="text-base font-bold" style={{ color: card.color }}>{card.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="mt-10 flex flex-col items-center gap-1.5 text-[#334155] text-xs">
          <span>Role para continuar</span>
          <ChevronDown size={14} className="animate-bounce" />
        </div>
      </div>
    </section>
  );
}
