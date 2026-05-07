'use client';

import { ShieldCheck, Zap, Eye } from 'lucide-react';

const pillars = [
  {
    icon: ShieldCheck,
    title: 'Estabilidade',
    description: 'Produto construído para funcionar de forma consistente, sem surpresas.',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.15)',
  },
  {
    icon: Eye,
    title: 'Clareza dos dados',
    description: 'Informações que você consegue entender e confiar, sem enrolação.',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.15)',
  },
  {
    icon: Zap,
    title: 'Simplicidade primeiro',
    description: 'Antes de adicionar complexidade, priorizamos que o essencial funcione bem.',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.15)',
  },
];

export default function TrustSection() {
  return (
    <section className="py-24 px-4 sm:px-6 bg-[#080B14]">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-xl mb-16">
          <p className="text-[#10B981] text-xs font-semibold uppercase tracking-widest mb-5">Por que confiar</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7FB] tracking-tight leading-[1.1]">
            Controle financeiro precisa gerar confiança, não dúvida.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-3xl p-7 flex flex-col gap-4"
                style={{
                  background: p.bg,
                  border: `1px solid ${p.border}`,
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: p.bg, border: `1px solid ${p.border}` }}
                >
                  <Icon size={20} style={{ color: p.color }} />
                </div>
                <h3 className="font-bold text-[#F5F7FB] text-base">{p.title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{p.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
