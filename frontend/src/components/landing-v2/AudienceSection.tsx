'use client';

import { Briefcase, Home, Landmark, Route } from 'lucide-react';

const audiences = [
  {
    icon: Route,
    title: 'Quem vive no improviso',
    description: 'Para parar de descobrir tarde demais que o dinheiro acabou.',
  },
  {
    icon: Home,
    title: 'Famílias',
    description: 'Para organizar despesas da casa, prioridades e contas recorrentes.',
  },
  {
    icon: Briefcase,
    title: 'Autônomos e freelancers',
    description: 'Para lidar com entradas variáveis sem perder a visão do mês.',
  },
  {
    icon: Landmark,
    title: 'Quem quer sair das dívidas',
    description: 'Para enxergar o tamanho real dos compromissos e criar ordem.',
  },
];

export default function AudienceSection() {
  return (
    <section className="bg-[#070A12] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 grid gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Para quem é
            </p>
            <h2 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
              Controle financeiro para a vida real, não para planilha perfeita.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-400">
            O UTOP foi pensado para quem precisa de uma ferramenta clara, rápida e prática para
            tomar decisões no dia a dia.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <div
                key={audience.title}
                className="rounded-2xl border border-white/[0.08] bg-[#101827] p-6"
              >
                <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-black text-white">{audience.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{audience.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
