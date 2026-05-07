'use client';

export default function HumanAuthoritySection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-[#0D1425]">
      <div className="max-w-6xl mx-auto">
        <div
          className="rounded-3xl p-10 sm:p-16 relative overflow-hidden"
          style={{
            background: '#0F1627',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Decorative quote mark */}
          <div className="absolute top-6 left-8 text-8xl font-black text-[#10B981]/[0.07] leading-none select-none">
            “
          </div>

          <div className="relative max-w-2xl">
            <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-8">Nossa história</p>

            <blockquote className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FB] leading-snug mb-8 tracking-tight">
              Criado por quem já perdeu noites tentando entender para onde o dinheiro foi.
            </blockquote>

            <p className="text-[#64748B] text-base leading-relaxed mb-6">
              O UTOP nasceu para simplificar o que muita gente evita olhar: a própria vida financeira.
              A proposta é unir ferramenta, método e clareza para ajudar pessoas a criarem uma rotina real de controle.
            </p>

            <p className="text-[#94A3B8] text-sm leading-relaxed">
              Não é sobre complicar sua vida com termos financeiros.
              É sobre mostrar, com clareza, o que precisa ser feito.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
