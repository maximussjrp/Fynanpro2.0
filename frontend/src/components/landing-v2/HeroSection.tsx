'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

const painItems = [
  'quanto entra no mês',
  'para onde o dinheiro vai',
  'quais contas vencem primeiro',
  'quanto sobra de verdade',
];

const stats = [
  { value: '3.200+', label: 'usuários ativos' },
  { value: 'R$ 12M+', label: 'organizados' },
  { value: '4.8/5', label: 'avaliação média' },
];

export default function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[#070A12] px-4 pb-16 pt-24 sm:px-6 lg:pb-20 lg:pt-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_45%_0%,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,#0B1020_0%,#070A12_70%)]" />
      <div className="absolute inset-x-0 top-16 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            <ShieldCheck size={14} />
            Controle financeiro com clareza visual
          </div>

          <h1 className="max-w-[13ch] text-4xl font-black leading-[1.03] tracking-tight text-white sm:text-5xl lg:text-[4rem]">
            Você não precisa ganhar mais para{' '}
            <span className="text-emerald-300">ter controle.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300 sm:text-lg">
            O UTOP mostra entradas, gastos, dívidas e próximos vencimentos em uma rotina simples,
            para você parar de adivinhar e decidir com segurança.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 text-sm font-extrabold text-slate-950 shadow-[0_18px_48px_rgba(16,185,129,0.28)] transition hover:bg-emerald-300"
            >
              Começar agora
              <ArrowRight size={17} />
            </Link>
            <a
              href="#funcionalidades"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              Ver funcionalidades
            </a>
          </div>

          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-white/10 pt-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-black text-white">{stat.value}</p>
                <p className="mt-1 text-xs leading-4 text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-100">
                Dinheiro sem clareza vira ansiedade.{' '}
                <span className="text-emerald-300">Dinheiro com controle vira decisão.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="relative lg:min-h-[600px]">
          <div className="relative ml-auto w-full max-w-[650px]">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101827] shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
              <Image
                src="/images/dashboard-desktop-mobile.png"
                alt="Dashboard do UTOP no computador e no celular"
                width={1200}
                height={760}
                priority
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[0.78fr_1fr] lg:absolute lg:-bottom-20 lg:-left-10 lg:mt-0 lg:w-[560px]">
              <div className="overflow-hidden rounded-[1.5rem] border border-white/12 bg-[#101827] shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                <Image
                  src="/images/mobile-isis-expenses.png"
                  alt="Assistente Isis respondendo gastos do mês no UTOP"
                  width={420}
                  height={620}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="overflow-hidden rounded-[1.5rem] border border-white/12 bg-[#101827] shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                <Image
                  src="/images/hero-family.png"
                  alt="Família organizando as finanças com o UTOP"
                  width={760}
                  height={460}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="relative ml-auto mt-4 w-full max-w-[500px] rounded-[1.5rem] border border-white/10 bg-[#111A2B]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.5)] lg:absolute lg:-bottom-28 lg:right-0 lg:mt-0">
            <p className="mb-4 text-sm text-slate-300">Você fica perdida quando não sabe exatamente:</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {painItems.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-xs font-black text-emerald-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
