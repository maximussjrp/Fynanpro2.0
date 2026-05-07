'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'Preciso entender de finanças para usar?',
    a: 'Não. A ideia é justamente simplificar sua rotina financeira. O UTOP guia você passo a passo.',
  },
  {
    q: 'O UTOP substitui uma consultoria financeira?',
    a: 'Ele ajuda você a organizar e visualizar seus dados. Em campanhas específicas, pode haver acompanhamento adicional.',
  },
  {
    q: 'Serve para quem está endividado?',
    a: 'Sim. Inclusive, o primeiro passo para sair das dívidas é enxergar com clareza o tamanho e a ordem dos compromissos.',
  },
  {
    q: 'Posso começar pelo mensal?',
    a: 'Sim. Mas o trimestral é mais indicado para quem quer criar rotina e ter tempo real para sentir evolução.',
  },
  {
    q: 'Tem plano anual?',
    a: 'Sim. O anual é o plano com maior economia — R$ 597,00 por ano.',
  },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-28 px-4 bg-[#0B1020]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Dúvidas frequentes</p>
          <h2 className="text-3xl font-extrabold text-[#F5F7FB] tracking-tight">Perguntas e respostas</h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden" style={{background:'#151B2E',border:'1px solid rgba(255,255,255,0.06)'}}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
              >
                <span className="text-white font-medium text-sm">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-[#64748B] shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-[#94A3B8] text-sm leading-relaxed border-t border-white/5 pt-4">
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
