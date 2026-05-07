'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function OfferSection() {
  return (
    <section className="py-28 px-4 bg-[#0B1020]">
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-12 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.06) 100%)',
            border: '1px solid rgba(16,185,129,0.20)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div className="inline-flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase">
            Oferta com acompanhamento
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FB] mb-4 tracking-tight">
            Condição especial para quem quer começar com acompanhamento
          </h2>

          <div
            className="rounded-2xl p-6 my-8 text-left"
            style={{
              background: '#0D1425',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-[#10B981] font-bold text-lg mb-2">Oferta VIP — Plano Trimestral</p>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Os <strong className="text-[#F5F7FB]">20 primeiros</strong> que entrarem no Plano Trimestral
              recebem <strong className="text-[#F5F7FB]">6 encontros de acompanhamento</strong> inclusos.
            </p>
          </div>

          <p className="text-[#64748B] text-sm leading-relaxed mb-8">
            Você não vai apenas acessar uma ferramenta. Vai começar com orientação para
            organizar sua rotina financeira, entender o sistema e aplicar o método no dia a dia.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-white font-semibold px-8 py-3.5 rounded-2xl transition-all hover:scale-[1.02]"
            style={{
              background: '#10B981',
              boxShadow: '0 0 30px rgba(16,185,129,0.25)',
            }}
          >
            Quero entrar com acompanhamento
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
