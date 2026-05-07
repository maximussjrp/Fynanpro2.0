'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';


export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#080B14] pt-24 pb-16 px-4 sm:px-6">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#10B981]/[0.06] rounded-full blur-[130px]" />
        <div className="absolute top-[20%] right-[5%] w-[350px] h-[350px] bg-[#3B82F6]/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-[5%] w-[300px] h-[300px] bg-[#8B5CF6]/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[calc(100vh-6rem)]">

          {/* Left — Copy */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <div className="inline-flex w-fit items-center gap-2 bg-[#10B981]/[0.08] border border-[#10B981]/20 text-[#10B981] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase">
              Controle financeiro real
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl font-extrabold text-[#F5F7FB] leading-[1.08] mb-5 tracking-tight">
              Pare de adivinhar<br />
              sua vida financeira.<br />
              <span className="text-[#10B981]">Comece a enxergar.</span>
            </h1>

            {/* Sub */}
            <p className="text-[#64748B] text-base sm:text-lg leading-relaxed mb-10 max-w-md">
              Entradas, saídas, dívidas e compromissos — tudo em um só lugar, com uma rotina simples
              para transformar bagunça em decisão.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-white font-semibold px-8 py-3.5 rounded-2xl text-sm transition-all hover:scale-[1.02]"
                style={{ background: '#10B981', boxShadow: '0 0 32px rgba(16,185,129,0.28)' }}
              >
                Começar agora — grátis
                <ArrowRight size={16} />
              </Link>
              <a
                href="#metodo"
                className="flex items-center justify-center gap-2 bg-[#151B2E] hover:bg-[#1A2236] border border-white/[0.08] text-[#94A3B8] hover:text-[#F5F7FB] font-semibold px-8 py-3.5 rounded-2xl text-sm transition-all"
              >
                Como funciona
              </a>
            </div>

            {/* Social proof numbers */}
            <div className="flex items-center gap-8 pt-4 border-t border-white/[0.06]">
              {[
                { value: '3.200+', label: 'usuários ativos' },
                { value: 'R$ 12M+', label: 'organizados' },
                { value: '4.8★', label: 'avaliação' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[#F5F7FB] text-lg font-extrabold leading-none mb-1">{stat.value}</p>
                  <p className="text-[#64748B] text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Photo + floating cards */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[520px]">
              {/* Photo */}
              <div className="relative rounded-3xl overflow-hidden border border-white/[0.07]"
                style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.04) inset' }}>
                <Image
                  src="/images/hero-family.png"
                  alt="Família usando o UTOP para organizar as finanças"
                  width={520}
                  height={580}
                  className="w-full object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080B14]/60 via-transparent to-transparent" />
              </div>

              {/* Floating card — top left */}
              <div
                className="absolute top-[8%] -left-4 sm:-left-12 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 min-w-[180px]"
                style={{ background: 'rgba(10,15,28,0.88)' }}
              >
                <span className="text-xl">🛒</span>
                <div>
                  <p className="text-[#F5F7FB] text-xs font-semibold">Supermercado</p>
                  <p className="text-[10px] text-[#64748B]">Alimentação</p>
                </div>
                <p className="text-[#F43F5E] text-xs font-bold ml-auto">- R$ 312</p>
              </div>

              {/* Floating card — middle right */}
              <div
                className="absolute top-[38%] -right-4 sm:-right-12 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 min-w-[180px]"
                style={{ background: 'rgba(10,15,28,0.88)' }}
              >
                <span className="text-xl">💼</span>
                <div>
                  <p className="text-[#F5F7FB] text-xs font-semibold">Salário</p>
                  <p className="text-[10px] text-[#64748B]">Entrada</p>
                </div>
                <p className="text-[#10B981] text-xs font-bold ml-auto">+ R$ 6.500</p>
              </div>

              {/* Floating card — bottom left */}
              <div
                className="absolute bottom-[18%] -left-4 sm:-left-12 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3 min-w-[180px]"
                style={{ background: 'rgba(10,15,28,0.88)' }}
              >
                <span className="text-xl">🏠</span>
                <div>
                  <p className="text-[#F5F7FB] text-xs font-semibold">Aluguel</p>
                  <p className="text-[10px] text-[#64748B]">Moradia</p>
                </div>
                <p className="text-[#F59E0B] text-xs font-bold ml-auto">- R$ 1.400</p>
              </div>

              {/* Saldo chip — bottom */}
              <div
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 backdrop-blur-xl rounded-full px-5 py-2.5 border border-[#10B981]/25 shadow-[0_0_24px_rgba(16,185,129,0.15)] flex items-center gap-2 whitespace-nowrap"
                style={{ background: 'rgba(10,15,28,0.92)' }}
              >
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <p className="text-[#10B981] text-xs font-bold">Saldo do mês: R$ 4.788</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
