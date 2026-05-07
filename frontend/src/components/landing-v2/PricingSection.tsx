'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

const secondary = [
  { name: 'Mensal', price: 'R$ 79,90', period: '/mês', note: 'Para começar sem compromisso' },
  { name: 'Semestral', price: 'R$ 357,00', period: '/semestre', note: 'Mais economia' },
  { name: 'Anual', price: 'R$ 597,00', period: '/ano', note: 'Maior economia' },
];

export default function PricingSection() {
  return (
    <section id="precos" className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-sm font-semibold uppercase tracking-widest mb-3">Planos</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Escolha como quer começar</h2>
        </div>

        {/* Destaque Trimestral */}
        <div className="bg-gradient-to-br from-[#10B981]/15 to-[#10B981]/5 border-2 border-[#10B981]/50 rounded-3xl p-8 sm:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#10B981] text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl tracking-wide uppercase">
            Mais indicado
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Plano Trimestral</h3>
              <p className="text-[#94A3B8] text-sm mb-4">
                Mais indicado para começar com método e criar rotina.
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  'Acesso completo a todas as funcionalidades',
                  'Suporte prioritário',
                  'Equivale a R$ 65,67/mês',
                  'Economize R$ 42,70 em relação ao mensal',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[#CBD5E1] text-sm">
                    <Check size={15} className="text-[#10B981] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-4 shrink-0">
              <div>
                <span className="text-4xl font-bold text-white">R$ 197,00</span>
                <span className="text-[#64748B] text-sm ml-1">/trimestre</span>
              </div>
              <Link
                href="/login"
                className="bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-8 py-3 rounded-xl transition-colors whitespace-nowrap text-sm"
              >
                Começar pelo trimestral
              </Link>
            </div>
          </div>
        </div>

        {/* Outros planos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {secondary.map((plan) => (
            <div
              key={plan.name}
              className="bg-[#0F1829] border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-white/20 transition-colors"
            >
              <h4 className="text-white font-semibold">{plan.name}</h4>
              <div>
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-[#64748B] text-xs ml-1">{plan.period}</span>
              </div>
              <p className="text-[#64748B] text-xs">{plan.note}</p>
              <Link
                href="/login"
                className="mt-auto text-center text-[#10B981] hover:text-white border border-[#10B981]/30 hover:border-[#10B981] text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Selecionar
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
