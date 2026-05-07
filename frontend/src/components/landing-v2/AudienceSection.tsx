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
    <section className="py-24 px-4 bg-[#0F1829]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-sm font-semibold uppercase tracking-widest mb-3">Para quem é</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Feito para quem quer controle sem complicação
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {audiences.map((item) => (
            <div
              key={item.title}
              className="bg-[#151E30] border border-white/10 rounded-2xl p-6 flex gap-4 items-start hover:border-white/20 transition-colors"
            >
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
