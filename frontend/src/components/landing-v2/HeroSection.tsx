'use client';

import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#10B981]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
          Organização financeira que funciona na prática
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.15] mb-6">
          Organize sua vida financeira com clareza —
          <span className="text-[#10B981]"> sem planilhas confusas</span>, sem complicação e sem perder o controle do seu dinheiro.
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-[#94A3B8] leading-relaxed mb-10 max-w-2xl mx-auto">
          O UTOP ajuda você a enxergar entradas, saídas, dívidas e compromissos em um só lugar,
          com uma rotina simples para transformar bagunça financeira em decisão.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-[#10B981]/20"
          >
            Começar minha organização financeira
            <ArrowRight size={18} />
          </Link>
          <a
            href="#metodo"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-[#CBD5E1] font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            Ver como funciona
          </a>
        </div>

        {/* Dashboard mockup */}
        <div className="mt-16 relative">
          <div className="rounded-2xl border border-white/10 bg-[#0F1829] overflow-hidden shadow-2xl shadow-black/50">
            {/* Fake browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#151E30] border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="ml-4 flex-1 bg-white/5 rounded-md h-5 max-w-xs" />
            </div>
            {/* Fake dashboard content */}
            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Entradas', value: 'R$ 8.400', color: '#10B981' },
                { label: 'Saídas', value: 'R$ 5.200', color: '#F43F5E' },
                { label: 'Dívidas', value: 'R$ 1.800', color: '#F59E0B' },
                { label: 'Saldo', value: 'R$ 3.200', color: '#3B82F6' },
              ].map((card) => (
                <div key={card.label} className="bg-[#1A2540] rounded-xl p-4 text-left border border-white/5">
                  <p className="text-xs text-[#64748B] mb-1">{card.label}</p>
                  <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="bg-[#1A2540] rounded-xl p-4 border border-white/5">
                <p className="text-xs text-[#64748B] mb-3">Próximos compromissos</p>
                <div className="space-y-2">
                  {['Internet — vence 10 mai', 'Aluguel — vence 15 mai', 'Cartão Nubank — vence 20 mai'].map((item) => (
                    <div key={item} className="flex items-center justify-between text-sm text-[#94A3B8]">
                      <span>{item}</span>
                      <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Reflection / glow at bottom */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#10B981]/10 blur-2xl rounded-full" />
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center gap-1 text-[#475569] text-xs">
          <span>Role para continuar</span>
          <ChevronDown size={16} className="animate-bounce" />
        </div>
      </div>
    </section>
  );
}
