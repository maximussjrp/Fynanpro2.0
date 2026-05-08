'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'Preciso entender de finanças para usar?',
    a: 'Não. A ideia é simplificar sua rotina financeira. O UTOP organiza as informações para você entender o mês com clareza.',
  },
  {
    q: 'Serve para quem está endividado?',
    a: 'Sim. O primeiro passo para sair das dívidas é enxergar valores, vencimentos e prioridades sem confusão.',
  },
  {
    q: 'Posso usar no celular?',
    a: 'Sim. A experiência foi pensada para consulta rápida no celular e planejamento mais completo no computador.',
  },
  {
    q: 'Posso começar pelo mensal?',
    a: 'Sim. O trimestral é mais indicado para criar rotina, mas você pode escolher o plano que fizer mais sentido.',
  },
  {
    q: 'Tem plano anual?',
    a: 'Sim. O anual é o plano com maior economia para quem quer manter o controle financeiro no longo prazo.',
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#070A12] px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Dúvidas frequentes
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Respostas diretas antes de você começar.
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div key={faq.q} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101827]">
              <button
                onClick={() => setOpen(open === index ? null : index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-sm font-black text-white">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-emerald-300 transition-transform ${open === index ? 'rotate-180' : ''}`}
                />
              </button>
              {open === index && (
                <div className="border-t border-white/[0.06] px-6 py-5 text-sm leading-7 text-slate-400">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
