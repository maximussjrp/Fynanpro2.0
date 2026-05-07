'use client';

const audiences = [
  {
    label: 'Quem vive no improviso',
    description: 'Só descobre que o dinheiro acabou quando a conta vence. O UTOP antecipa o que está por vir.',
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.06)',
    border: 'rgba(244,63,94,0.15)',
    num: '01',
  },
  {
    label: 'Famílias',
    description: 'Organize despesas da casa, compromissos e prioridades em um só lugar — sem planilha.',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.15)',
    num: '02',
  },
  {
    label: 'Autônomos e freelancers',
    description: 'Entradas variáveis, gastos fixos e obrigações do mês — tudo visível em um dashboard.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.15)',
    num: '03',
  },
  {
    label: 'Quem quer sair das dívidas',
    description: 'Enxergue o tamanho real do problema. Monte uma rota de organização passo a passo.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.15)',
    num: '04',
  },
];

export default function AudienceSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-[#080B14]">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-xl mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Para quem é</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight leading-[1.1]">
            Feito para quem quer controle sem complicação
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {audiences.map((item) => (
            <div
              key={item.label}
              className="rounded-3xl p-7 flex flex-col gap-3 transition-all hover:scale-[1.01]"
              style={{
                background: item.bg,
                border: `1px solid ${item.border}`,
                boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <span className="text-5xl font-black opacity-[0.15] leading-none" style={{ color: item.color }}>
                {item.num}
              </span>
              <h3 className="text-[#F5F7FB] font-bold text-base" style={{ color: item.color }}>
                {item.label}
              </h3>
              <p className="text-[#64748B] text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
