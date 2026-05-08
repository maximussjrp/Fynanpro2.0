'use client';

import Image from 'next/image';
import { MessageCircle, Monitor } from 'lucide-react';

export default function ProductShowcaseSection() {
  return (
    <section className="py-24 px-4 bg-[#080B14]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Sincronizado em Todos os Dispositivos
          </h2>
          <p className="text-lg text-[#94A3B8] max-w-3xl mx-auto">
            Do seu smartphone até o desktop - UTOP está sempre com você, oferecendo a mesma
            experiência poderosa e intuitiva em qualquer lugar.
          </p>
        </div>

        {/* Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Isis Mobile */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-2xl opacity-0 group-hover:opacity-30 transition duration-1000" />

            <div className="relative bg-[#0F1425] border border-[#1E293B] rounded-2xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#F1F5F9]">Isis - Seu Guia IA</h3>
                  <p className="text-sm text-[#64748B]">Conversação inteligente no bolso</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="relative w-full max-w-xs">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent rounded-3xl" />
                  <Image
                    src="/images/mobile-isis-expenses.png"
                    alt="Isis - Assistente de IA no mobile"
                    width={320}
                    height={640}
                    className="w-full h-auto rounded-3xl shadow-2xl"
                    priority
                  />
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-[#F1F5F9] font-medium">✨ Recursos</p>
                <ul className="space-y-2 text-sm text-[#94A3B8]">
                  <li>💬 Chat natural em português</li>
                  <li>📊 Análise de gastos em tempo real</li>
                  <li>💡 Recomendações personalizadas</li>
                  <li>🎯 Metas e alertas inteligentes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right: Desktop + Mobile */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-0 group-hover:opacity-30 transition duration-1000" />

            <div className="relative bg-[#0F1425] border border-[#1E293B] rounded-2xl p-8 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Monitor className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#F1F5F9]">Dashboard Completo</h3>
                  <p className="text-sm text-[#64748B]">Controle total na sua tela</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="relative w-full">
                  <Image
                    src="/images/dashboard-desktop-mobile.png"
                    alt="Dashboard desktop e mobile mockup"
                    width={600}
                    height={400}
                    className="w-full h-auto rounded-xl shadow-2xl"
                    priority
                  />
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <p className="text-[#F1F5F9] font-medium">🎛️ Funcionalidades</p>
                <ul className="space-y-2 text-sm text-[#94A3B8]">
                  <li>📈 Gráficos detalhados e insights</li>
                  <li>🏦 Múltiplas contas sincronizadas</li>
                  <li>🔄 Contas recorrentes automáticas</li>
                  <li>💾 Sincronização em tempo real</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <p className="text-[#94A3B8] mb-6 text-lg">
            Pronto para ter controle total sobre suas finanças?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/login?tab=register"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-8 rounded-lg transition shadow-lg"
            >
              Começar Agora
            </a>
            <a
              href="#demo"
              className="border border-[#334155] text-[#F1F5F9] hover:bg-[#1E293B] font-semibold py-3 px-8 rounded-lg transition"
            >
              Ver Demo Completa
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
