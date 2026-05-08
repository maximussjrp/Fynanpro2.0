'use client';

import Image from 'next/image';
import { CheckCircle2 } from 'lucide-react';

export default function HumanAuthoritySection() {
  return (
    <section className="bg-[#0B1020] px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101827] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <Image
            src="/images/hero-family.png"
            alt="Família usando o UTOP para organizar as finanças"
            width={760}
            height={460}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Nossa história
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Criado para quem precisa entender o dinheiro sem complicar a rotina.
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-400">
            O UTOP nasceu para simplificar aquilo que muita gente evita olhar: a própria vida
            financeira. A proposta é unir ferramenta, método e clareza em uma experiência direta.
          </p>

          <div className="mt-8 space-y-4">
            {[
              'Sem termos financeiros desnecessários.',
              'Sem depender de planilhas difíceis de manter.',
              'Com informação visual para decidir mais rápido.',
            ].map((item) => (
              <div key={item} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={19} />
                <p className="text-sm font-semibold leading-6 text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
