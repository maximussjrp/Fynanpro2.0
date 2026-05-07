'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function FinalCTASection() {
  return (
    <section className="py-24 px-4 bg-[#0F1829]">
      <div className="max-w-2xl mx-auto text-center">
        {/* Glow */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-40 bg-[#10B981]/15 rounded-full blur-3xl" />
          </div>

          <h2 className="relative text-3xl sm:text-4xl font-bold text-white leading-snug mb-4">
            Pare de tentar adivinhar sua vida financeira.
            <br />
            <span className="text-[#10B981]">Comece a enxergar.</span>
          </h2>
        </div>

        <p className="text-[#94A3B8] text-lg leading-relaxed mb-10">
          Organize seu mês, entenda seus gastos e tome decisões com mais segurança.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-10 py-4 rounded-xl text-base transition-colors shadow-xl shadow-[#10B981]/20"
        >
          Começar agora
          <ArrowRight size={20} />
        </Link>
      </div>
    </section>
  );
}
