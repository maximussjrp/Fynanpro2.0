'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, Check, LayoutDashboard, PieChart, Bell, Upload, Calendar,
  TrendingUp, Shield, Zap, Target, ChevronDown, Star, Menu, X, MessageCircle, BarChart3, FileSpreadsheet
} from 'lucide-react';

const PLANS = {
  trial: { name: 'Trial', price: 0, period: '14 dias', features: ['Todas as funcionalidades', 'Sem cartão de crédito', 'Cancele quando quiser'] },
  monthly: { name: 'Mensal', price: 39.90, period: '/mês', features: ['Contas ilimitadas', 'Transações ilimitadas', 'Relatórios avançados', 'Suporte por email'] },
  semiannual: { name: 'Semestral', price: 191.40, pricePerMonth: 31.90, period: '/semestre', savings: 'Economize R$ 48', features: ['Tudo do Mensal', 'Suporte prioritário', 'Economia de 20%'] },
  yearly: { name: 'Anual', price: 335.00, pricePerMonth: 27.92, period: '/ano', savings: 'Economize R$ 144', popular: true, features: ['Melhor custo-benefício', 'Economia de 30%', 'Suporte prioritário'] },
};

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-xl flex items-center justify-center border border-[#C9A962]">
                <span className="text-[#C9A962] font-bold text-lg">U</span>
              </div>
              <span className="text-2xl font-bold text-[#0F172A]">UTOP</span>
            </div>
            <div className="hidden lg:flex items-center gap-8">
              <a href="#features" className="text-[#475569] hover:text-[#0F172A] font-medium">Funcionalidades</a>
              <a href="#energia" className="text-[#475569] hover:text-[#0F172A] font-medium">Energia Financeira</a>
              <a href="#precos" className="text-[#475569] hover:text-[#0F172A] font-medium">Preços</a>
            </div>
            <div className="hidden lg:flex items-center gap-4">
              <Link href="/login" className="text-[#475569] hover:text-[#0F172A] font-medium">Entrar</Link>
              <Link href="/login" className="bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] text-[#C9A962] px-6 py-2.5 rounded-xl font-semibold border border-[#C9A962]">Começar Grátis</Link>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-[#475569]">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block py-2 text-[#475569] font-medium">Funcionalidades</a>
              <a href="#energia" className="block py-2 text-[#475569] font-medium">Energia Financeira</a>
              <a href="#precos" className="block py-2 text-[#475569] font-medium">Preços</a>
              <hr />
              <Link href="/login" className="block py-2 text-[#475569] font-medium">Entrar</Link>
              <Link href="/login" className="block w-full text-center bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] text-[#C9A962] px-6 py-3 rounded-xl font-semibold border border-[#C9A962]">Começar Grátis</Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-24 lg:pt-32 pb-16 lg:pb-24 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C9A962] rounded-full opacity-5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#1A1A1A] rounded-full opacity-5 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#F5F0E6] text-[#1A1A1A] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4 text-[#C9A962]" />
                14 dias grátis • Sem cartão de crédito
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-[#0F172A] leading-tight mb-6">
                Organize suas finanças <span className="text-[#C9A962]">sem complicação</span>
              </h1>
              <p className="text-lg lg:text-xl text-[#475569] mb-8 max-w-lg mx-auto lg:mx-0">
                Um sistema simples para você entender para onde seu dinheiro vai — e decidir para onde ele deveria ir.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] text-[#C9A962] px-8 py-4 rounded-xl font-semibold text-lg border border-[#C9A962] group">
                  Começar Gratuitamente
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a href="#features" className="inline-flex items-center justify-center gap-2 bg-white text-[#475569] px-8 py-4 rounded-xl font-semibold text-lg border border-[#E2E8F0]">
                  Ver como funciona
                </a>
              </div>
              <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-[#64748B]">
                <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-[#C9A962]" /><span>Dados criptografados</span></div>
                <div className="flex items-center gap-2"><Check className="w-5 h-5 text-[#C9A962]" /><span>Cancele quando quiser</span></div>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#E2E8F0]">
                <Image src="/images/logo/dashboard-utop.png" alt="Dashboard do UTOP" width={800} height={500} className="w-full h-auto" priority />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:block animate-bounce">
          <ChevronDown className="w-8 h-8 text-[#C9A962]" />
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-6">Se você já se perguntou...</h2>
            <div className="space-y-4 text-lg text-[#475569]">
              <p className="flex items-center justify-center gap-3"><span className="text-2xl">🤔</span>"Onde foi parar meu salário?"</p>
              <p className="flex items-center justify-center gap-3"><span className="text-2xl">📱</span>"Quanto estou gastando com delivery?"</p>
              <p className="flex items-center justify-center gap-3"><span className="text-2xl">😰</span>"Vou conseguir pagar as contas esse mês?"</p>
            </div>
            <p className="mt-8 text-xl text-[#0F172A] font-semibold">...o <span className="text-[#C9A962]">UTOP</span> foi feito pra você.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 lg:py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-4">O que o UTOP faz por você</h2>
            <p className="text-lg text-[#475569] max-w-2xl mx-auto">Funcionalidades reais para organizar sua vida financeira</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: LayoutDashboard, title: 'Dashboard Completo', desc: 'Receitas, despesas, contas atrasadas e saldo em tempo real.', dark: true },
              { icon: PieChart, title: 'Relatórios Visuais', desc: 'Gráficos de fluxo de caixa, pizza por categoria. Exporte PDF e Excel.', dark: false },
              { icon: Target, title: 'Planejamento Anual (DRE)', desc: 'Compare esperado vs realizado por categoria. Controle como empresa.', dark: true },
              { icon: Upload, title: 'Importação Automática', desc: 'Importe extratos OFX do seu banco. Menos digitação, mais precisão.', dark: false },
              { icon: Calendar, title: 'Calendário Financeiro', desc: 'Visualize todas as contas a pagar e receber no calendário.', dark: true },
              { icon: Bell, title: 'Chatbot Inteligente', desc: 'Tire dúvidas e controle suas finanças conversando com o assistente.', dark: false },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-[#E2E8F0] hover:shadow-lg transition-shadow">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${f.dark ? 'bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] border border-[#C9A962]' : 'bg-[#C9A962]'}`}>
                  <f.icon className={`w-7 h-7 ${f.dark ? 'text-[#C9A962]' : 'text-white'}`} />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A] mb-3">{f.title}</h3>
                <p className="text-[#475569]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS - RELATÓRIOS E CHATBOT */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <BarChart3 className="w-4 h-4" /> Relatórios Profissionais
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-6">Saiba exatamente para onde vai seu dinheiro</h2>
              <ul className="space-y-4 text-[#475569]">
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#22C55E] mt-1 flex-shrink-0" /><span><strong>Fluxo de Caixa:</strong> Gráfico de evolução receitas vs despesas ao longo do tempo</span></li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#22C55E] mt-1 flex-shrink-0" /><span><strong>Top Categorias:</strong> Veja onde você mais gasta com gráfico de pizza detalhado</span></li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#22C55E] mt-1 flex-shrink-0" /><span><strong>Exportação:</strong> Baixe seus relatórios em PDF ou Excel quando precisar</span></li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] rounded-2xl p-6 shadow-lg border border-[#E2E8F0]">
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-[#22C55E] rounded-xl p-3 text-white text-center"><p className="text-xs">Receitas</p><p className="font-bold text-sm">R$ 60.729</p></div>
                <div className="bg-[#EF4444] rounded-xl p-3 text-white text-center"><p className="text-xs">Despesas</p><p className="font-bold text-sm">R$ 56.347</p></div>
                <div className="bg-[#3B82F6] rounded-xl p-3 text-white text-center"><p className="text-xs">Saldo</p><p className="font-bold text-sm">R$ 4.382</p></div>
                <div className="bg-[#A855F7] rounded-xl p-3 text-white text-center"><p className="text-xs">Economia</p><p className="font-bold text-sm">7.2%</p></div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-[#E2E8F0]">
                <p className="text-sm font-semibold text-[#0F172A] mb-3">📊 Top Categorias de Despesa</p>
                <div className="space-y-2">
                  {[
                    { cat: 'Aluguel', pct: 23, color: '#EF4444' },
                    { cat: 'Mercado', pct: 11, color: '#3B82F6' },
                    { cat: 'Combustível', pct: 9, color: '#F59E0B' },
                    { cat: 'Plano de Saúde', pct: 8, color: '#22C55E' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{backgroundColor: c.color}}></div>
                      <span className="text-sm text-[#475569] flex-1">{c.cat}</span>
                      <span className="text-sm font-semibold text-[#0F172A]">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-6 shadow-lg border border-[#C9A962]/30">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#C9A962] rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#1A1A1A]" />
                </div>
                <div>
                  <p className="text-white font-semibold">Assistente UTOP</p>
                  <p className="text-gray-400 text-xs">Online agora</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-[#2A2A2A] rounded-xl rounded-tl-none p-3 max-w-[80%]">
                  <p className="text-gray-300 text-sm">Olá! Como posso ajudar com suas finanças hoje?</p>
                </div>
                <div className="bg-[#C9A962] rounded-xl rounded-tr-none p-3 max-w-[80%] ml-auto">
                  <p className="text-[#1A1A1A] text-sm">Quanto gastei com alimentação esse mês?</p>
                </div>
                <div className="bg-[#2A2A2A] rounded-xl rounded-tl-none p-3 max-w-[80%]">
                  <p className="text-gray-300 text-sm">Você gastou <span className="text-[#C9A962] font-semibold">R$ 1.441,55</span> com alimentação em Janeiro. Isso representa 22.8% do seu orçamento.</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-[#C9A962]/10 text-[#C9A962] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <MessageCircle className="w-4 h-4" /> Assistente Inteligente
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-6">Converse com suas finanças</h2>
              <ul className="space-y-4 text-[#475569]">
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#C9A962] mt-1 flex-shrink-0" /><span><strong>Pergunte qualquer coisa:</strong> Quanto gastei? Qual meu saldo? Tenho contas atrasadas?</span></li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#C9A962] mt-1 flex-shrink-0" /><span><strong>Respostas instantâneas:</strong> Informações em tempo real sobre suas finanças</span></li>
                <li className="flex items-start gap-3"><Check className="w-5 h-5 text-[#C9A962] mt-1 flex-shrink-0" /><span><strong>Dicas personalizadas:</strong> Sugestões baseadas no seu perfil de gastos</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ENERGIA FINANCEIRA */}
      <section id="energia" className="py-16 lg:py-24 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A962] rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#C9A962] rounded-full blur-3xl"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#C9A962]/20 text-[#C9A962] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" /> Exclusivo UTOP
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">Não é só sobre números. <span className="text-[#C9A962]">É sobre escolhas.</span></h2>
              <p className="text-lg text-gray-300 mb-8">O UTOP classifica seus gastos por tipo de energia, ajudando você a entender o impacto real de cada decisão.</p>
              <div className="space-y-4">
                {[
                  { emoji: '🏠', title: 'Sobrevivência', desc: 'O que você precisa: moradia, alimentação, saúde.', color: '#22C55E' },
                  { emoji: '🎯', title: 'Escolha', desc: 'O que você quer: lazer, restaurantes, streaming.', color: '#3B82F6' },
                  { emoji: '🚀', title: 'Futuro', desc: 'O que você investe: poupança, investimentos.', color: '#A855F7' },
                  { emoji: '⚡', title: 'Energia Perdida', desc: 'O que não te serve: taxas, juros, desperdícios.', color: '#EF4444' },
                ].map((e, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: `${e.color}20`}}>
                      <span className="text-xl">{e.emoji}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{e.title}</h3>
                      <p className="text-gray-400 text-sm">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#2A2A2A] rounded-2xl p-8 border border-[#C9A962]/30">
              <h3 className="text-lg font-semibold text-[#C9A962] mb-6">Sua Energia Financeira</h3>
              <div className="space-y-4">
                {[
                  { label: '🏠 Sobrevivência', pct: 45, color: '#22C55E' },
                  { label: '🎯 Escolha', pct: 25, color: '#3B82F6' },
                  { label: '🚀 Futuro', pct: 20, color: '#A855F7' },
                  { label: '⚡ Energia Perdida', pct: 10, color: '#EF4444' },
                ].map((b, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-300">{b.label}</span>
                      <span style={{color: b.color}}>{b.pct}%</span>
                    </div>
                    <div className="h-3 bg-[#1A1A1A] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width: `${b.pct}%`, backgroundColor: b.color}}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-[#C9A962]/20">
                <p className="text-center text-gray-400 text-sm">Você está investindo <span className="text-[#C9A962] font-semibold">20%</span> no seu futuro!</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-4">Preços transparentes</h2>
            <p className="text-lg text-[#475569]">Comece grátis. Pague só quando fizer sentido.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {/* Trial */}
            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">Trial</h3>
              <div className="mb-4"><span className="text-3xl font-bold">Grátis</span><span className="text-[#64748B] text-sm ml-2">14 dias</span></div>
              <ul className="space-y-3 mb-6">{PLANS.trial.features.map((f,i) => <li key={i} className="flex items-center gap-2 text-sm text-[#475569]"><Check className="w-4 h-4 text-[#C9A962]" />{f}</li>)}</ul>
              <Link href="/login" className="block w-full text-center py-3 rounded-xl font-semibold border-2 border-[#C9A962] text-[#1A1A1A] hover:bg-[#F5F0E6]">Começar Grátis</Link>
            </div>
            {/* Mensal */}
            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">Mensal</h3>
              <div className="mb-4"><span className="text-3xl font-bold">R$ 39,90</span><span className="text-[#64748B] text-sm ml-2">/mês</span></div>
              <ul className="space-y-3 mb-6">{PLANS.monthly.features.map((f,i) => <li key={i} className="flex items-center gap-2 text-sm text-[#475569]"><Check className="w-4 h-4 text-[#C9A962]" />{f}</li>)}</ul>
              <Link href="/login" className="block w-full text-center py-3 rounded-xl font-semibold border-2 border-[#E2E8F0] text-[#475569] hover:border-[#C9A962]">Assinar</Link>
            </div>
            {/* Semestral */}
            <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-[#E2E8F0]">
              <div className="inline-block bg-[#DCFCE7] text-[#22C55E] text-xs font-semibold px-2 py-1 rounded-full mb-2">Economize R$ 48</div>
              <h3 className="text-lg font-bold text-[#0F172A] mb-2">Semestral</h3>
              <div className="mb-4"><span className="text-3xl font-bold">R$ 31,90</span><span className="text-[#64748B] text-sm ml-2">/mês</span></div>
              <p className="text-xs text-[#64748B] mb-4">R$ 191,40 a cada 6 meses</p>
              <ul className="space-y-3 mb-6">{PLANS.semiannual.features.map((f,i) => <li key={i} className="flex items-center gap-2 text-sm text-[#475569]"><Check className="w-4 h-4 text-[#C9A962]" />{f}</li>)}</ul>
              <Link href="/login" className="block w-full text-center py-3 rounded-xl font-semibold border-2 border-[#E2E8F0] text-[#475569] hover:border-[#C9A962]">Assinar</Link>
            </div>
            {/* Anual */}
            <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-6 border-2 border-[#C9A962] relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C9A962] text-[#1A1A1A] text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1"><Star className="w-3 h-3" />POPULAR</div>
              <h3 className="text-lg font-bold text-white mb-2 mt-2">Anual</h3>
              <div className="mb-4"><span className="text-3xl font-bold text-[#C9A962]">R$ 27,92</span><span className="text-gray-400 text-sm ml-2">/mês</span></div>
              <p className="text-xs text-gray-400 mb-2">R$ 335,00 por ano</p>
              <div className="inline-block bg-[#C9A962]/20 text-[#C9A962] text-xs font-semibold px-2 py-1 rounded-full mb-4">Economize R$ 144</div>
              <ul className="space-y-3 mb-6">{PLANS.yearly.features.map((f,i) => <li key={i} className="flex items-center gap-2 text-sm text-gray-300"><Check className="w-4 h-4 text-[#C9A962]" />{f}</li>)}</ul>
              <Link href="/login" className="block w-full text-center py-3 rounded-xl font-semibold bg-[#C9A962] text-[#1A1A1A] hover:bg-[#B8983D]">Assinar</Link>
            </div>
          </div>
          <p className="text-center text-sm text-[#64748B] mt-8">Cancele quando quiser. Sem pegadinhas.</p>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 lg:py-24 bg-[#FAFAFA]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-[#0F172A] mb-6">Pronto para organizar suas finanças?</h2>
          <p className="text-lg text-[#475569] mb-8">Comece hoje, é grátis por 14 dias. Não pedimos cartão.</p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] text-[#C9A962] px-10 py-4 rounded-xl font-semibold text-lg border border-[#C9A962] group">
            Criar Conta Grátis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1A1A1A] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center border border-[#C9A962]">
                  <span className="text-[#C9A962] font-bold">U</span>
                </div>
                <span className="text-2xl font-bold">UTOP</span>
              </div>
              <p className="text-gray-400 text-sm max-w-xs">Seu dinheiro em equilíbrio. Sistema financeiro pessoal desenvolvido para simplificar sua vida.</p>
            </div>
            <div>
              <h4 className="font-semibold text-[#C9A962] mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-white">Preços</a></li>
                <li><Link href="/login" className="hover:text-white">Entrar</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#C9A962] mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacidade" className="hover:text-white">Política de Privacidade</Link></li>
                <li><a href="#" className="hover:text-white">Termos de Uso</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-500">
            <p>© 2026 UTOP — Todos os direitos reservados</p>
            <p className="mt-2">Desenvolvido por Max Guarinieri</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
