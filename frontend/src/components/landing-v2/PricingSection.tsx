'use client';

import Link from 'next/link';
import { Check, Star } from 'lucide-react';

const plans = [
  { name: 'Mensal', price: 'R$ 79,90', period: '/mês', note: 'Para começar sem compromisso' },
  { name: 'Semestral', price: 'R$ 357,00', period: '/semestre', note: 'Mais economia' },
  { name: 'Anual', price: 'R$ 597,00', period: '/ano', note: 'Maior economia' },
];

const benefits = [
  'Acesso completo a todas as funcionalidades',
  'Dashboard, categorias, contas e vencimentos',
  'Assistente Isis para consultas rápidas',
  'Equivale a R$ 65,67/mês no trimestral',
];

export default function PricingSection() {
  return (
    <section id="precos" className="bg-[#070A12] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Planos
          </p>
          <h2 className="mx-auto max-w-2xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Escolha um plano e comece com clareza ainda este mês.
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-300/30 bg-emerald-300/[0.07] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-950">
              <Star size={14} />
              Mais indicado
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h3 className="text-2xl font-black text-white">Plano Trimestral</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  Melhor ponto de partida para criar rotina, acompanhar evolução e sentir o
                  controle financeiro funcionando no dia a dia.
                </p>

                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex gap-3 text-sm leading-6 text-slate-200">
                      <Check className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="md:text-right">
                <div>
                  <span className="text-4xl font-black text-white">R$ 197,00</span>
                  <span className="ml-1 text-sm text-slate-400">/trimestre</span>
                </div>
                <Link
                  href="/login"
                  className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300"
                >
                  Começar pelo trimestral
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {plans.map((plan) => (
              <div key={plan.name} className="rounded-2xl border border-white/[0.08] bg-[#101827] p-5">
                <h4 className="font-black text-white">{plan.name}</h4>
                <div className="mt-3">
                  <span className="text-2xl font-black text-white">{plan.price}</span>
                  <span className="ml-1 text-xs text-slate-500">{plan.period}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{plan.note}</p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex w-full justify-center rounded-xl border border-emerald-300/20 px-4 py-2.5 text-sm font-bold text-emerald-300 transition hover:border-emerald-300/50 hover:bg-emerald-300/10"
                >
                  Selecionar
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
