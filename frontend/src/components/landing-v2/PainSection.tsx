'use client';

const items = [
  { text: 'quanto entra no mês', n: '01' },
  { text: 'quanto sai e para onde vai', n: '02' },
  { text: 'quais dívidas vencem primeiro', n: '03' },
  { text: 'quais gastos estão drenando o mês', n: '04' },
  { text: 'quanto realmente sobra no final', n: '05' },
];

export default function PainSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-[#080B14]">
      {/* Subtle top separator */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left — headline + quote */}
          <div>
            <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-6">O problema real</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] leading-[1.1] mb-6 tracking-tight">
              Você não precisa<br />ganhar mais para ter<br />controle.
            </h2>
            <p className="text-[#64748B] text-base leading-relaxed mb-10">
              A maioria das pessoas não está quebrada por falta de esforço.
              Está perdida porque não consegue enxergar com clareza o próprio dinheiro.
            </p>

            {/* Impact quote */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.15)',
              }}
            >
              <p className="text-lg font-bold text-[#F5F7FB] leading-snug mb-1">
                Dinheiro sem clareza vira ansiedade.
              </p>
              <p className="text-lg font-bold text-[#10B981] leading-snug">
                Dinheiro com controle vira decisão.
              </p>
            </div>
          </div>

          {/* Right — numbered list */}
          <div
            className="rounded-3xl p-6 sm:p-8"
            style={{
              background: '#0F1627',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.4)',
            }}
          >
            <p className="text-[#64748B] text-sm mb-6 leading-relaxed">
              Está perdida porque não sabe exatamente:
            </p>
            <ul className="flex flex-col divide-y divide-white/[0.04]">
              {items.map((item) => (
                <li key={item.n} className="flex items-center gap-5 py-4 first:pt-0 last:pb-0">
                  <span className="text-3xl font-black text-[#F59E0B]/15 leading-none w-10 shrink-0 select-none">
                    {item.n}
                  </span>
                  <span className="text-[#94A3B8] text-sm leading-snug">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
