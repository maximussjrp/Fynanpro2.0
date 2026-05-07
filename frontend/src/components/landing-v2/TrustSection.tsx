'use client';

import { ShieldCheck } from 'lucide-react';

export default function TrustSection() {
  return (
    <section className="py-28 px-4 bg-[#0D1425]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck size={28} className="text-[#10B981]" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FB] mb-4 tracking-tight">
          Controle financeiro precisa gerar confiança, não dúvida.
        </h2>

        <p className="text-[#94A3B8] text-base leading-relaxed">
          Por isso, o UTOP está sendo construído com foco em estabilidade, clareza dos dados e experiência simples.
          Antes de adicionar complexidade, a prioridade é fortalecer o produto principal,
          melhorar a usabilidade e entregar informações que o usuário consiga entender e confiar.
        </p>
      </div>
    </section>
  );
}
