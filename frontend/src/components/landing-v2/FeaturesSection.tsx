'use client';

import { DollarSign, AlertCircle, LayoutDashboard, Tag, Clock, BarChart2 } from 'lucide-react';

// Uses v2 design tokens
const features = [
  {
    icon: DollarSign,
    title: 'Controle de receitas e despesas',
    description: 'Registre o que entra e o que sai sem depender de planilhas soltas.',
  },
  {
    icon: AlertCircle,
    title: 'Dívidas e compromissos',
    description: 'Acompanhe vencimentos e evite esquecer contas importantes.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard financeiro',
    description: 'Veja o resumo do seu mês de forma clara e visual.',
  },
  {
    icon: Tag,
    title: 'Categorias organizadas',
    description: 'Entenda quais áreas estão consumindo mais do seu dinheiro.',
  },
  {
    icon: Clock,
    title: 'Rotina simples',
    description: 'Use poucos minutos por dia para manter seu financeiro atualizado.',
  },
  {
    icon: BarChart2,
    title: 'Relatórios claros',
    description: 'Transforme dados em visão prática para decidir melhor.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-28 px-4 bg-[#0B1020]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight">
            Tudo o que você precisa para sair da bagunça financeira
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-3xl p-6 flex flex-col gap-3 transition-all hover:scale-[1.01] group"
                style={{
                  background: '#151B2E',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <div className="w-11 h-11 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/15 flex items-center justify-center group-hover:bg-[#10B981]/15 transition-colors">
                  <Icon size={20} className="text-[#10B981]" />
                </div>
                <h3 className="text-[#F5F7FB] font-semibold text-sm">{feat.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
