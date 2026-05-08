'use client';

import { BarChart3, CalendarCheck, ListChecks, SearchCheck } from 'lucide-react';

const steps = [
  {
    icon: SearchCheck,
    number: '01',
    title: 'Veja a realidade',
    description: 'Saldo, entradas, saídas e contas próximas ficam claros antes da decisão.',
  },
  {
    icon: ListChecks,
    number: '02',
    title: 'Organize o mês',
    description: 'Categorias, recorrências e compromissos entram em uma rotina simples.',
  },
  {
    icon: BarChart3,
    number: '03',
    title: 'Entenda padrões',
    description: 'O UTOP mostra onde o dinheiro pesa e quais gastos precisam de atenção.',
  },
  {
    icon: CalendarCheck,
    number: '04',
    title: 'Decida com calma',
    description: 'Planeje o próximo mês sabendo o que vence, o que sobra e o que ajustar.',
  },
];

export default function MethodSection() {
  return (
    <section id="metodo" className="border-t border-white/[0.06] bg-[#070A12] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 grid gap-6 lg:grid-cols-[0.8fr_1fr] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Como funciona
            </p>
            <h2 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
              Uma rotina simples para transformar bagunça em clareza.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-slate-400">
            O UTOP organiza seu financeiro em etapas fáceis de repetir. Você não precisa montar
            planilhas nem interpretar relatórios complicados para saber o que fazer.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-2xl border border-white/[0.08] bg-[#101827] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                    <Icon size={20} />
                  </div>
                  <span className="text-sm font-black text-emerald-300/70">{step.number}</span>
                </div>
                <h3 className="text-lg font-black text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
