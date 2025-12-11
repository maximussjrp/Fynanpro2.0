'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Wallet, TrendingUp, PiggyBank, CreditCard, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import Logo from '@/components/Logo';

const API_URL = 'http://localhost:3000/api/v1';

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
    <div className="min-h-screen bg-gradient-to-br from-[#1C6DD0] via-[#1557A8] to-[#0D3D6C] relative overflow-hidden flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#22C39A] rounded-full opacity-10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#F4F7FB] rounded-full opacity-10 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <main className="relative w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Marketing */}
          <div className="text-white space-y-8 hidden lg:block">
            <div>
              <h1 className="text-5xl font-bold mb-4 leading-tight" style={{fontFamily: 'Poppins, sans-serif'}}>
                FynanPro <span className="text-[#22C39A]">2.0</span>
              </h1>
              <h2 className="text-3xl font-bold mb-6 leading-tight" style={{fontFamily: 'Poppins, sans-serif'}}>
                Sua vida financeira sob controle. <span className="text-[#22C39A]">Finalmente.</span>
              </h2>
              <p className="text-lg text-white/90 mb-8" style={{fontFamily: 'Inter, sans-serif'}}>
                Gerencie suas finanças de forma simples, inteligente e eficiente.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="bg-[#22C39A] p-3 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Controle Total</h3>
                  <p className="text-sm text-white/80" style={{fontFamily: 'Inter, sans-serif'}}>Acompanhe receitas e despesas</p>
                </div>
              </div>

              <div className="flex items-center gap-4 backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="bg-[#22C39A] p-3 rounded-lg flex-shrink-0">
                  <PiggyBank className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Metas e Orçamentos</h3>
                  <p className="text-sm text-white/80" style={{fontFamily: 'Inter, sans-serif'}}>Monitore seu progresso</p>
                </div>
              </div>

              <div className="flex items-center gap-4 backdrop-blur-sm bg-white/10 p-4 rounded-xl border border-white/20">
                <div className="bg-[#22C39A] p-3 rounded-lg flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Múltiplas Contas</h3>
                  <p className="text-sm text-white/80" style={{fontFamily: 'Inter, sans-serif'}}>Gerencie tudo em um lugar</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Auth Form */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10 w-full max-w-md mx-auto lg:mx-0">
            {/* Logo no formulário mobile */}
            <div className="lg:hidden mb-6 text-center">
              <h1 className="text-3xl font-bold text-[#1C6DD0]" style={{fontFamily: 'Poppins, sans-serif'}}>
                FynanPro <span className="text-[#22C39A]">2.0</span>
              </h1>
            </div>

            <div className="mb-8">
              <div className="flex bg-[#F4F7FB] rounded-xl p-1.5">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 px-4 text-center font-semibold rounded-lg transition-all ${
                    isLogin
                      ? 'bg-white text-[#1C6DD0] shadow-md'
                      : 'text-[#4F4F4F] hover:text-[#1A1A1A]'
                  }`}
                  style={{fontFamily: 'Inter, sans-serif'}}
                >
                  <LogIn className="w-5 h-5 inline mr-2" />
                  Entrar
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 px-4 text-center font-semibold rounded-lg transition-all ${
                    !isLogin
                      ? 'bg-white text-[#1C6DD0] shadow-md'
                      : 'text-[#4F4F4F] hover:text-[#1A1A1A]'
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
                  <label className="block text-sm font-semibold text-[#1A1A1A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-3.5 border-2 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
                    style={{fontFamily: 'Inter, sans-serif'}}
                    placeholder="Seu nome completo"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
                  style={{fontFamily: 'Inter, sans-serif'}}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#1A1A1A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#1C6DD0] focus:border-[#1C6DD0] transition-all bg-[#F9FAFB]"
                  style={{fontFamily: 'Inter, sans-serif'}}
                  placeholder="••••••••"
                  required
                />
              </div>

              {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${
                  message.startsWith('✅')
                    ? 'bg-[#E8F9F4] text-[#22C39A] border-2 border-[#22C39A]'
                    : 'bg-[#FEF2F2] text-[#E74C3C] border-2 border-[#E74C3C]'
                }`} style={{fontFamily: 'Inter, sans-serif'}}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#1C6DD0] to-[#1557A8] hover:from-[#1557A8] hover:to-[#0D3D6C] text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                style={{fontFamily: 'Inter, sans-serif'}}
              >
                {isLoading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <a href="#" className="text-sm font-medium text-[#1C6DD0] hover:text-[#1557A8] hover:underline" style={{fontFamily: 'Inter, sans-serif'}}>
                  Esqueceu sua senha?
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-white/70 text-xs" style={{fontFamily: 'Inter, sans-serif'}}>
          <p>
            © 2025 FynanPro 2.0<br />
            <span className="inline-flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[#22C39A] rounded-full animate-pulse"></span>
              Backend: http://localhost:3000
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}
