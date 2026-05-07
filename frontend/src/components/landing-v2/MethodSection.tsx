'use client';

const steps = [
  {
    key: 'Diagnostique',
    number: '01',
    title: 'Diagnostique',
    description: 'Entenda o que está acontecendo hoje: saldo real, entradas, saídas e o que vence nos próximos dias.',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.15)',
  },
  {
    key: 'Organize',
    number: '02',
    title: 'Organize',
    description: 'Cadastre contas, categorias, recorrências e compromissos. Coloque cada coisa no lugar certo.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.15)',
  },
  {
    key: 'Enxergue',
    number: '03',
    title: 'Enxergue',
    description: 'Veja padrões, excessos e prioridades com clareza. Descubra para onde o dinheiro vai de verdade.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.15)',
  },
  {
    key: 'Decida',
    number: '04',
    title: 'Decida',
    description: 'Planeje o próximo mês com mais segurança. Pare de tomar decisão financeira no escuro.',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.15)',
  },
];

export default function MethodSection() {
  return (
    <section id="metodo" className="py-28 px-4 bg-[#0D1425]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">O método</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] leading-tight tracking-tight">
            Do caos financeiro para
            <span className="text-[#10B981]"> uma rotina simples de controle.</span>
          </h2>
          <p className="mt-4 text-[#64748B] text-base max-w-xl mx-auto">
            O UTOP não é só uma tela bonita. É um método para organizar sua vida financeira em etapas que fazem sentido.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <div
              key={step.key}
              className="rounded-3xl p-6 flex flex-col gap-4 transition-all hover:scale-[1.02]"
              style={{
                background: step.bg,
                border: `1px solid ${step.border}`,
                boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <span className="text-5xl font-black opacity-20 leading-none" style={{ color: step.color }}>
                {step.number}
              </span>
              <h3 className="text-xl font-bold tracking-tight" style={{ color: step.color }}>
                {step.title}
              </h3>
              <p className="text-[#64748B] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
