'use client';

const steps = [
  {
    key: 'Diagnostique',
    number: '01',
    title: 'Diagnostique',
    description:
      'Entenda o que está acontecendo hoje com seu dinheiro: saldo real, entradas, saídas e o que vence nos próximos dias.',
    color: '#3B82F6',
  },
  {
    key: 'Organize',
    number: '02',
    title: 'Organize',
    description:
      'Cadastre suas contas, categorias, recorrências e compromissos. Coloque cada coisa no lugar certo.',
    color: '#10B981',
  },
  {
    key: 'Enxergue',
    number: '03',
    title: 'Enxergue',
    description:
      'Veja padrões, excessos e prioridades com clareza. Descubra para onde o dinheiro vai de verdade.',
    color: '#F59E0B',
  },
  {
    key: 'Decida',
    number: '04',
    title: 'Decida',
    description:
      'Planeje o mês seguinte com mais segurança. Pare de tomar decisão financeira no escuro.',
    color: '#8B5CF6',
  },
];

export default function MethodSection() {
  return (
    <section id="metodo" className="py-24 px-4 bg-[#0F1829]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-sm font-semibold uppercase tracking-widest mb-3">O método</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white leading-snug">
            Do caos financeiro para
            <span className="text-[#10B981]"> uma rotina simples de controle.</span>
          </h2>
          <p className="mt-4 text-[#94A3B8] text-lg max-w-xl mx-auto">
            O UTOP não é só uma tela bonita. É um método para organizar sua vida financeira em etapas que fazem sentido.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.key}
              className="bg-[#151E30] border border-white/10 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/20 transition-colors"
            >
              <span
                className="text-4xl font-bold opacity-20"
                style={{ color: step.color }}
              >
                {step.number}
              </span>
              <h3
                className="text-xl font-bold"
                style={{ color: step.color }}
              >
                {step.title}
              </h3>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
