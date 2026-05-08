'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MonitorSmartphone } from 'lucide-react';

export default function DashboardDemoSection() {
  return (
    <section className="bg-[#070A12] px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Produto
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            O mês inteiro em uma tela que dá para entender.
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-400">
            A visão principal mostra saldo, despesas, categorias e vencimentos. Você entra,
            entende o cenário e segue para a próxima decisão.
          </p>

          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#101827] p-5">
            <div className="flex gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <MonitorSmartphone size={20} />
              </div>
              <div>
                <h3 className="font-black text-white">Desktop e celular juntos</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Use no computador para planejar e no celular para consultar ou atualizar gastos
                  rapidamente.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 text-sm font-extrabold text-slate-950 shadow-[0_18px_48px_rgba(16,185,129,0.24)] transition hover:bg-emerald-300"
          >
            Começar agora
            <ArrowRight size={17} />
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101827] shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
          <Image
            src="/images/dashboard-desktop-mobile.png"
            alt="Dashboard do UTOP no computador e celular"
            width={1200}
            height={760}
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
