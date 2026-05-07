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
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white leading-snug mb-6">
          Você não precisa ganhar mais para começar a ter controle.
          <br />
          <span className="text-[#94A3B8]">Você precisa enxergar melhor.</span>
        </h2>

        <p className="text-[#94A3B8] text-lg mb-10">
          A maioria das pessoas não está quebrada por falta de esforço.
          Está perdida porque não sabe exatamente:
        </p>

        <ul className="inline-flex flex-col items-start gap-3 mb-12 text-left">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-3 text-[#CBD5E1] text-base">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* Frase de impacto */}
        <div className="border-l-4 border-[#10B981] pl-6 text-left max-w-xl mx-auto">
          <p className="text-xl sm:text-2xl font-semibold text-white leading-relaxed">
            Dinheiro sem clareza vira ansiedade.
          </p>
          <p className="text-xl sm:text-2xl font-semibold text-[#10B981] leading-relaxed mt-1">
            Dinheiro com controle vira decisão.
          </p>
        </div>
      </div>
    </section>
  );
}
