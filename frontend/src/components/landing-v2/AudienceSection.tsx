'use client';

const audiences = [
  {
    emoji: '🔄',
    title: 'Para quem vive no improviso',
    description: 'Se você só descobre que o dinheiro acabou quando a conta vence.',
  },
  {
    emoji: '🏠',
    title: 'Para famílias',
    description: 'Organize despesas da casa, compromissos e prioridades em um só lugar.',
  },
  {
    emoji: '💼',
    title: 'Para autônomos',
    description: 'Separe melhor entradas, gastos e obrigações do mês.',
  },
  {
    emoji: '📋',
    title: 'Para quem quer sair das dívidas',
    description: 'Enxergue o tamanho real do problema e monte uma rota de organização.',
  },
];

export default function AudienceSection() {
  return (
    <section className="py-28 px-4 bg-[#0D1425]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Para quem é</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight">
            Feito para quem quer controle sem complicação
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {audiences.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl p-6 flex gap-4 items-start transition-all hover:scale-[1.01]"
              style={{
                background: '#151B2E',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <h3 className="text-[#F5F7FB] font-semibold mb-1 text-sm">{item.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
