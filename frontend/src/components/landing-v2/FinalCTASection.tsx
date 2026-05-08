'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function FinalCTASection() {
  return (
    <section className="bg-[#0B1020] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/[0.07] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-14">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Comece hoje
          </p>
          <h2 className="mx-auto max-w-3xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl">
            Pare de adivinhar sua vida financeira. Comece a enxergar.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-300">
            Organize seu mês, entenda seus gastos e tome decisões com mais segurança.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-7 text-sm font-extrabold text-slate-950 shadow-[0_18px_48px_rgba(16,185,129,0.24)] transition hover:bg-emerald-300"
          >
            Começar agora
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
