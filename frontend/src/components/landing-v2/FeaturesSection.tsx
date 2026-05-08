'use client';

import Image from 'next/image';
import {
  AlertCircle,
  BarChart3,
  Clock3,
  LayoutDashboard,
  Tags,
  WalletCards,
} from 'lucide-react';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard financeiro',
    description: 'Saldo, vencimentos e alertas em uma primeira tela objetiva.',
    position: 'lg:left-0 lg:top-20',
  },
  {
    icon: WalletCards,
    title: 'Receitas e despesas',
    description: 'Registre entradas e saídas sem depender de planilha.',
    position: 'lg:right-0 lg:top-16',
  },
  {
    icon: AlertCircle,
    title: 'Dívidas e compromissos',
    description: 'Priorize o que vence primeiro e reduza esquecimentos.',
    position: 'lg:left-6 lg:top-[330px]',
  },
  {
    icon: Tags,
    title: 'Categorias claras',
    description: 'Veja onde o dinheiro pesa e onde existe desperdício.',
    position: 'lg:right-8 lg:top-[320px]',
  },
  {
    icon: Clock3,
    title: 'Rotina rápida',
    description: 'Poucos minutos por dia mantêm o mês previsível.',
    position: 'lg:left-[120px] lg:bottom-2',
  },
  {
    icon: BarChart3,
    title: 'Relatórios úteis',
    description: 'Compare, corrija e decida com leitura prática.',
    position: 'lg:right-[120px] lg:bottom-8',
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="overflow-hidden bg-[#0B1020] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Funcionalidades
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Tudo no lugar certo para você saber o que fazer com o dinheiro.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-400">
            O UTOP junta visão do mês, categorias, vencimentos e relatórios em uma experiência
            simples de consultar no celular.
          </p>
        </div>

        <div className="relative mx-auto min-h-[740px] max-w-6xl lg:min-h-[660px]">
          <div className="absolute left-1/2 top-0 hidden h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-[90px] lg:block" />

          <div className="relative z-10 mx-auto max-w-[330px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#101827] p-3 shadow-[0_34px_100px_rgba(0,0,0,0.55)] sm:max-w-[380px]">
            <Image
              src="/images/features-mobile-dashboard.png"
              alt="Tela mobile do UTOP com resumo financeiro"
              width={520}
              height={720}
              className="h-auto w-full rounded-[1.5rem] object-cover"
              sizes="(max-width: 640px) 88vw, 380px"
            />
          </div>

          <div className="relative z-20 mt-6 grid gap-3 sm:grid-cols-2 lg:mt-0 lg:block">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`rounded-2xl border border-white/[0.08] bg-[#101827]/95 p-5 shadow-[0_18px_55px_rgba(0,0,0,0.34)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-emerald-300/25 lg:absolute lg:w-[285px] ${feature.position}`}
                >
                  <div className="flex gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                      <Icon size={20} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-300/70">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-sm font-black text-white">{feature.title}</h3>
                      </div>
                      <p className="text-sm leading-6 text-slate-400">{feature.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
