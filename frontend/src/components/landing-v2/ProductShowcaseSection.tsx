'use client';

import Image from 'next/image';
import { MessageCircle, Sparkles } from 'lucide-react';

const items = [
  'Pergunte quanto gastou em uma categoria.',
  'Veja totais do mês sem abrir relatório.',
  'Transforme dúvida em resposta prática.',
];

export default function ProductShowcaseSection() {
  return (
    <section className="bg-[#0B1020] px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="mx-auto max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#101827] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
            <Image
              src="/images/mobile-isis-expenses.png"
              alt="Assistente Isis respondendo gastos do mês no celular"
              width={420}
              height={620}
              className="h-auto w-full rounded-[1.25rem] object-cover"
            />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Isis
          </p>
          <h2 className="text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl">
            Pergunte em português e entenda seus gastos em segundos.
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-400">
            A assistente do UTOP ajuda você a consultar informações do financeiro sem procurar
            manualmente por telas, filtros ou planilhas.
          </p>

          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101827] p-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                  <MessageCircle size={17} />
                </div>
                <p className="text-sm font-semibold text-slate-200">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-300">
            <Sparkles size={16} />
            Clareza sem complicar a rotina
          </div>
        </div>
      </div>
    </section>
  );
}
