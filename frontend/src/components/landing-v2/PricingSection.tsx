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
    <section id="precos" className="py-28 px-4 bg-[#0B1020]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Planos</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight">Escolha como quer começar</h2>
        </div>

        {/* Destaque Trimestral */}
        <div
          className="rounded-3xl p-8 sm:p-10 mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(16,185,129,0.04) 100%)',
            border: '1.5px solid rgba(16,185,129,0.35)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div className="absolute top-0 right-0 bg-[#10B981] text-white text-xs font-bold px-4 py-1.5 rounded-bl-2xl tracking-widest uppercase">
            Mais indicado
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-extrabold text-[#F5F7FB] mb-1 tracking-tight">Plano Trimestral</h3>
              <p className="text-[#64748B] text-sm mb-4">
                Mais indicado para começar com método e criar rotina.
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  'Acesso completo a todas as funcionalidades',
                  'Suporte prioritário',
                  'Equivale a R$ 65,67/mês',
                  'Economize R$ 42,70 em relação ao mensal',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[#94A3B8] text-sm">
                    <Check size={15} className="text-[#10B981] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-4 shrink-0">
              <div>
                <span className="text-4xl font-extrabold text-[#F5F7FB]">R$ 197,00</span>
                <span className="text-[#64748B] text-sm ml-1">/trimestre</span>
              </div>
              <Link
                href="/login"
                className="text-white font-semibold px-8 py-3 rounded-2xl transition-all hover:scale-[1.02] whitespace-nowrap text-sm"
                style={{ background: '#10B981', boxShadow: '0 0 20px rgba(16,185,129,0.20)' }}
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
              className="rounded-3xl p-6 flex flex-col gap-3 transition-all hover:scale-[1.01]"
              style={{
                background: '#151B2E',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <h4 className="text-[#F5F7FB] font-semibold">{plan.name}</h4>
              <div>
                <span className="text-2xl font-bold text-[#F5F7FB]">{plan.price}</span>
                <span className="text-[#64748B] text-xs ml-1">{plan.period}</span>
              </div>
              <p className="text-[#64748B] text-xs">{plan.note}</p>
              <Link
                href="/login"
                className="mt-auto text-center text-[#10B981] hover:text-[#F5F7FB] border border-[#10B981]/20 hover:border-[#10B981]/50 text-sm font-medium py-2 rounded-xl transition-colors"
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
