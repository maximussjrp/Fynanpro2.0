'use client';

import { DollarSign, AlertCircle, LayoutDashboard, Tag, Clock, BarChart2 } from 'lucide-react';

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
    <section id="funcionalidades" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-sm font-semibold uppercase tracking-widest mb-3">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Tudo o que você precisa para sair da bagunça financeira
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="bg-[#0F1829] border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-[#10B981]/30 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center group-hover:bg-[#10B981]/20 transition-colors">
                  <Icon size={20} className="text-[#10B981]" />
                </div>
                <h3 className="text-white font-semibold">{feat.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
