'use client';

export default function PainSection() {
  const items = [
    'quanto entra no mês',
    'quanto sai e para onde vai',
    'quais dívidas vencem primeiro',
    'quais gastos estão drenando o mês',
    'quanto realmente sobra no final',
  ];

  return (
    <section className="py-28 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Label */}
        <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5 text-center">O problema real</p>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] leading-tight mb-5 text-center tracking-tight">
          Você não precisa ganhar mais para ter controle.
          <br />
          <span className="text-[#64748B] font-semibold">Você precisa enxergar melhor.</span>
        </h2>

        <p className="text-[#64748B] text-base sm:text-lg text-center mb-10 leading-relaxed">
          A maioria das pessoas não está quebrada por falta de esforço.
          Está perdida porque não sabe exatamente:
        </p>

        {/* List */}
        <div className="bg-[#151B2E] border border-white/[0.06] rounded-3xl p-6 sm:p-8 mb-12 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_rgba(0,0,0,0.35)]">
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={item} className="flex items-center gap-4">
                <span className="w-7 h-7 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                </span>
                <span className="text-[#94A3B8] text-base">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Impact quote */}
        <div className="border-l-[3px] border-[#10B981] pl-6">
          <p className="text-xl sm:text-2xl font-bold text-[#F5F7FB] leading-snug mb-1">
            Dinheiro sem clareza vira ansiedade.
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[#10B981] leading-snug">
            Dinheiro com controle vira decisão.
          </p>
        </div>
      </div>
    </section>
  );
}
