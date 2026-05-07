'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function FinalCTASection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-[#0D1425]">
      <div className="max-w-6xl mx-auto">
        <div
          className="relative rounded-3xl p-12 sm:p-20 overflow-hidden text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(59,130,246,0.06) 50%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(16,185,129,0.20)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 40px 100px rgba(0,0,0,0.5)',
          }}
        >
          {/* Glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[200px] bg-[#10B981]/10 rounded-full blur-[80px]" />
          </div>

          <div className="relative">
            <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-6">Comece hoje</p>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F5F7FB] leading-[1.08] mb-4 tracking-tight">
              Pare de adivinhar<br />sua vida financeira.
            </h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-[#10B981] leading-[1.08] mb-8 tracking-tight">
              Comece a enxergar.
            </p>

            <p className="text-[#64748B] text-base leading-relaxed mb-10 max-w-md mx-auto">
              Organize seu mês, entenda seus gastos e tome decisões com mais segurança.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-white font-semibold px-10 py-4 rounded-2xl text-base transition-all hover:scale-[1.03]"
              style={{ background: '#10B981', boxShadow: '0 0 40px rgba(16,185,129,0.30)' }}
            >
              Começar agora — grátis
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
