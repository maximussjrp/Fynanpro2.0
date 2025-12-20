'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Wallet, TrendingUp, PiggyBank, CreditCard, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import Logo from '@/components/Logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function Home() {
  const router = useRouter();
  const { setAuth } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { 
            email: formData.email, 
            password: formData.password,
            fullName: formData.fullName,
            tenantName: formData.fullName.split(' ')[0] + ' Finance' // Nome do tenant baseado no nome do usuário
          };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);

      if (response.data.success) {
        setMessage(`✅ ${isLogin ? 'Login realizado' : 'Cadastro realizado'} com sucesso!`);
        console.log('Response:', response.data);
        
        // Salvar no Zustand store (que também salva no localStorage)
        if (response.data.data?.tokens?.accessToken) {
          setAuth(
            {
              accessToken: response.data.data.tokens.accessToken,
              refreshToken: response.data.data.tokens.refreshToken,
            },
            response.data.data.user,
            response.data.data.tenant
          );
          
          setTimeout(() => {
            router.push('/dashboard');
          }, 1500);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMsg = error.response?.data?.error?.message || 'Erro ao processar requisição';
      setMessage(`❌ ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden flex items-center justify-center p-4">
      {/* Background decorative elements - suave e calmo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#1F4FD8] rounded-full opacity-5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#2ECC9A] rounded-full opacity-5 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#9AF0C6] rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <main className="relative w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Marketing UTOP */}
          <div className="space-y-8 hidden lg:block">
            <div>
              {/* UTOP Logo */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-3xl font-poppins">U</span>
                </div>
                <h1 className="text-5xl font-bold text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
                  UTOP
                </h1>
              </div>
              <h2 className="text-3xl font-bold mb-4 leading-tight text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
                Seu dinheiro em <span className="text-[#2ECC9A]">equilíbrio.</span>
              </h2>
              <p className="text-lg text-[#475569] mb-8" style={{fontFamily: 'Inter, sans-serif'}}>
                Organizar suas finanças pode ser simples, leve e previsível.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-[#1F4FD8] p-3 rounded-xl flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Clareza Total</h3>
                  <p className="text-sm text-[#475569]" style={{fontFamily: 'Inter, sans-serif'}}>Veja suas finanças com tranquilidade</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-[#2ECC9A] p-3 rounded-xl flex-shrink-0">
                  <PiggyBank className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Sem Pressão</h3>
                  <p className="text-sm text-[#475569]" style={{fontFamily: 'Inter, sans-serif'}}>Tudo sob controle, no seu ritmo</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] p-3 rounded-xl flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Progressivo</h3>
                  <p className="text-sm text-[#475569]" style={{fontFamily: 'Inter, sans-serif'}}>Crescimento constante e inteligente</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Auth Form */}
          <div className="bg-white rounded-3xl shadow-xl p-8 lg:p-10 w-full max-w-md mx-auto lg:mx-0 border border-[#CBD5E1]/30">
            {/* Logo no formulário mobile */}
            <div className="lg:hidden mb-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl font-poppins">U</span>
                </div>
                <h1 className="text-3xl font-bold text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
                  UTOP
                </h1>
              </div>
              <p className="text-sm text-[#475569]">Seu dinheiro em equilíbrio</p>
            </div>

            <div className="mb-8">
              <div className="flex bg-[#F8FAFC] rounded-xl p-1.5">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 px-4 text-center font-semibold rounded-xl transition-all ${
                    isLogin
                      ? 'bg-white text-[#1F4FD8] shadow-md'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                  style={{fontFamily: 'Inter, sans-serif'}}
                >
                  <LogIn className="w-5 h-5 inline mr-2" />
                  Entrar
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 px-4 text-center font-semibold rounded-xl transition-all ${
                    !isLogin
                      ? 'bg-white text-[#1F4FD8] shadow-md'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                  style={{fontFamily: 'Inter, sans-serif'}}
                >
                  <UserPlus className="w-5 h-5 inline mr-2" />
                  Cadastrar
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F8FAFC]"
                    style={{fontFamily: 'Inter, sans-serif'}}
                    placeholder="Seu nome completo"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F8FAFC]"
                  style={{fontFamily: 'Inter, sans-serif'}}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#1F4FD8] focus:border-[#1F4FD8] transition-all bg-[#F8FAFC]"
                  style={{fontFamily: 'Inter, sans-serif'}}
                  placeholder="••••••••"
                  required
                />
              </div>

              {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${
                  message.startsWith('✅')
                    ? 'bg-[#DCFCE7] text-[#22C55E] border-2 border-[#22C55E]'
                    : 'bg-[#FEF2F2] text-[#EF4444] border-2 border-[#EF4444]'
                }`} style={{fontFamily: 'Inter, sans-serif'}}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A] hover:from-[#1A44BF] hover:to-[#27B589] text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                style={{fontFamily: 'Inter, sans-serif'}}
              >
                {isLoading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <a href="#" className="text-sm font-medium text-[#1F4FD8] hover:text-[#1A44BF] hover:underline" style={{fontFamily: 'Inter, sans-serif'}}>
                  Esqueceu sua senha?
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-[#475569] text-xs" style={{fontFamily: 'Inter, sans-serif'}}>
          <p>
            © 2025 UTOP — Seu dinheiro em equilíbrio<br />
            <span className="inline-flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[#2ECC9A] rounded-full animate-pulse"></span>
              Conectado
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}
