'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function OfferSection() {
  return (
    <section className="py-24 px-4 bg-[#0F1829]">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-[#10B981]/10 to-[#3B82F6]/10 border border-[#10B981]/30 rounded-3xl p-8 sm:p-12 text-center">
          <div className="inline-flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wide uppercase">
            Oferta com acompanhamento
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Condição especial para quem quer começar com acompanhamento
          </h2>

          <div className="bg-[#0B1120] border border-white/10 rounded-2xl p-6 my-8 text-left">
            <p className="text-[#10B981] font-bold text-lg mb-2">Oferta VIP — Plano Trimestral</p>
            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Os <strong className="text-white">20 primeiros</strong> que entrarem no Plano Trimestral
              recebem <strong className="text-white">6 encontros de acompanhamento</strong> inclusos.
            </p>
          </div>

          <p className="text-[#64748B] text-sm leading-relaxed mb-8">
            Você não vai apenas acessar uma ferramenta. Vai começar com orientação para
            organizar sua rotina financeira, entender o sistema e aplicar o método no dia a dia.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-8 py-3.5 rounded-xl transition-colors"
          >
            Quero entrar com acompanhamento
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
