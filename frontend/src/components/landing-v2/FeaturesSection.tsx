'use client';

import { DollarSign, AlertCircle, LayoutDashboard, Tag, Clock, BarChart2 } from 'lucide-react';

const features = [
  { icon: LayoutDashboard, title: 'Dashboard financeiro', description: 'Veja o resumo do seu mês de forma clara e visual.', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },
  { icon: DollarSign, title: 'Receitas e despesas', description: 'Registre o que entra e o que sai sem depender de planilhas.', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
  { icon: AlertCircle, title: 'Dívidas e compromissos', description: 'Acompanhe vencimentos e nunca esqueça contas importantes.', color: '#F43F5E', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.15)' },
  { icon: Tag, title: 'Categorias organizadas', description: 'Entenda quais áreas estão consumindo mais do seu dinheiro.', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)' },
  { icon: Clock, title: 'Rotina simples', description: 'Use poucos minutos por dia para manter seu financeiro atualizado.', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)' },
  { icon: BarChart2, title: 'Relatórios claros', description: 'Transforme dados em visão prática para decidir melhor.', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.15)' },
];

export default function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-24 px-4 sm:px-6 bg-[#0D1425]">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-xl mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Funcionalidades</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight leading-[1.1]">
            Tudo o que você precisa para sair da bagunça financeira
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-3xl p-6 flex flex-col gap-4 transition-all hover:scale-[1.02] group"
                style={{
                  background: feat.bg,
                  border: `1px solid ${feat.border}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: feat.bg, border: `1px solid ${feat.border}` }}
                >
                  <Icon size={20} style={{ color: feat.color }} />
                </div>
                <div>
                  <h3 className="text-[#F5F7FB] font-semibold text-sm mb-1.5">{feat.title}</h3>
                  <p className="text-[#64748B] text-sm leading-relaxed">{feat.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
