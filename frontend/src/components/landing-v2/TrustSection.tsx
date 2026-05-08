'use client';

import { Eye, ShieldCheck, Zap } from 'lucide-react';

const pillars = [
  {
    icon: ShieldCheck,
    title: 'Estabilidade',
    description: 'Uma rotina financeira precisa funcionar todos os dias, sem surpresa.',
  },
  {
    icon: Eye,
    title: 'Clareza dos dados',
    description: 'Informações organizadas para você entender, comparar e confiar.',
  },
  {
    icon: Zap,
    title: 'Simplicidade primeiro',
    description: 'O essencial vem antes da complexidade: registrar, enxergar e decidir.',
  },
];

export default function TrustSection() {
  return (
    <section className="bg-[#0B1020] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Por que confiar
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Controle financeiro precisa gerar segurança, não mais dúvida.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="rounded-2xl border border-white/[0.08] bg-[#101827] p-6">
                <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-black text-white">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
