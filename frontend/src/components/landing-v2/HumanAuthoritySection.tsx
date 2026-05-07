'use client';

export default function HumanAuthoritySection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-[#10B981] text-sm font-semibold uppercase tracking-widest mb-6">Nossa história</p>

        <blockquote className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-8">
          "Criado por quem já perdeu noites tentando entender para onde o dinheiro foi."
        </blockquote>

        <div className="w-12 h-px bg-[#10B981]/40 mx-auto mb-8" />

        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4">
          Tecnologia com visão prática de gestão financeira
        </h2>

        <p className="text-[#94A3B8] text-base leading-relaxed mb-6">
          O UTOP nasceu para simplificar o que muita gente evita olhar: a própria vida financeira.
          A proposta é unir ferramenta, método e clareza para ajudar pessoas a criarem uma rotina real de controle.
        </p>

        <p className="text-[#64748B] text-sm leading-relaxed">
          Não é sobre complicar sua vida com termos financeiros.
          <br />
          É sobre mostrar, com clareza, o que precisa ser feito.
        </p>
      </div>
    </section>
  );
}
