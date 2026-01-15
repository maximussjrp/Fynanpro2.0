'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Wallet, TrendingUp, PiggyBank, CreditCard, LogIn, UserPlus, Eye, EyeOff, Mail, Lock, User, CheckCircle, Shield, Smartphone } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import Logo from '@/components/Logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function Home() {
  const router = useRouter();
  const { setAuth } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: ''
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);

  // Validação de senha
  const passwordValidation = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    passwordsMatch: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0
  };

  const isPasswordValid = passwordValidation.minLength && 
    passwordValidation.hasUppercase && 
    passwordValidation.hasLowercase && 
    passwordValidation.hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Validação adicional no cadastro
    if (!isLogin) {
      if (!isPasswordValid) {
        setMessage('❌ A senha não atende aos requisitos mínimos');
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setMessage('❌ As senhas não coincidem');
        setIsLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { 
            email: formData.email, 
            password: formData.password,
            fullName: formData.fullName,
            tenantName: formData.fullName.split(' ')[0] + ' Finance'
          };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);

      if (response.data.success) {
        if (isLogin) {
          setMessage('✅ Login realizado com sucesso!');
          
          // Salvar no Zustand store
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
        } else {
          // Cadastro - mostrar mensagem de verificação
          setRegisteredEmail(formData.email);
          setShowVerificationMessage(true);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const errorMsg = error.response?.data?.error?.message || 'Erro ao processar requisição';
      setMessage(`❌ ${errorMsg}`);
      
      // Se email já cadastrado ou não verificado, mostrar opção de reenviar
      if (errorMsg.includes('já cadastrado') || errorMsg.includes('não verificado')) {
        setRegisteredEmail(formData.email);
        setShowResendOption(true);
      } else {
        setShowResendOption(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/resend-verification`, { email: registeredEmail });
      setMessage('✅ Email de verificação reenviado!');
    } catch (error) {
      setMessage('❌ Erro ao reenviar email. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Tela de verificação de email após cadastro
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 lg:p-12 w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-xl flex items-center justify-center border border-[#C9A962]">
              <span className="text-[#C9A962] font-bold text-xl">U</span>
            </div>
            <h1 className="text-3xl font-bold text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
              UTOP
            </h1>
          </div>

          <div className="w-20 h-20 mx-auto bg-[#F5F0E6] rounded-full flex items-center justify-center mb-6">
            <Mail className="w-10 h-10 text-[#C9A962]" />
          </div>

          <h2 className="text-2xl font-bold text-[#0F172A] mb-4">Verifique seu email</h2>
          
          <p className="text-[#475569] mb-2">
            Enviamos um link de verificação para:
          </p>
          <p className="text-[#C9A962] font-semibold mb-6">{registeredEmail}</p>
          
          <p className="text-sm text-[#475569] mb-6">
            Clique no link do email para ativar sua conta e começar a usar o UTOP.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResendVerification}
              disabled={isLoading}
              className="w-full py-3 border-2 border-[#C9A962] text-[#1A1A1A] rounded-xl font-semibold hover:bg-[#F5F0E6] transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Reenviando...' : 'Reenviar email'}
            </button>
            
            <button
              onClick={() => {
                setShowVerificationMessage(false);
                setIsLogin(true);
                setFormData({ email: '', password: '', confirmPassword: '', fullName: '', phone: '' });
              }}
              className="w-full py-3 text-[#475569] hover:text-[#0F172A] font-medium"
            >
              Voltar para login
            </button>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-xl text-sm ${
              message.startsWith('✅') ? 'bg-[#DCFCE7] text-[#22C55E]' : 'bg-[#FEF2F2] text-[#EF4444]'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden flex items-center justify-center p-4">
      {/* Background decorative elements - suave e calmo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#1A1A1A] rounded-full opacity-5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C9A962] rounded-full opacity-5 blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#C9A962] rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <main className="relative w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Marketing UTOP */}
          <div className="space-y-8 hidden lg:block">
            <div>
              {/* UTOP Logo */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-2xl flex items-center justify-center shadow-lg border-2 border-[#C9A962]">
                  <span className="text-[#C9A962] font-bold text-3xl font-poppins">U</span>
                </div>
                <h1 className="text-5xl font-bold text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
                  UTOP
                </h1>
              </div>
              <h2 className="text-3xl font-bold mb-4 leading-tight text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
                Seu dinheiro em <span className="text-[#C9A962]">equilíbrio.</span>
              </h2>
              <p className="text-lg text-[#475569] mb-8" style={{fontFamily: 'Inter, sans-serif'}}>
                Organizar suas finanças pode ser simples, leve e previsível.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-[#1A1A1A] p-3 rounded-xl flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Clareza Total</h3>
                  <p className="text-sm text-[#475569]" style={{fontFamily: 'Inter, sans-serif'}}>Veja suas finanças com tranquilidade</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-[#C9A962] p-3 rounded-xl flex-shrink-0">
                  <PiggyBank className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F172A] mb-1" style={{fontFamily: 'Inter, sans-serif'}}>Sem Pressão</h3>
                  <p className="text-sm text-[#475569]" style={{fontFamily: 'Inter, sans-serif'}}>Tudo sob controle, no seu ritmo</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#CBD5E1]/50">
                <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] p-3 rounded-xl flex-shrink-0 border border-[#C9A962]">
                  <CreditCard className="w-5 h-5 text-[#C9A962]" />
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
                <div className="w-12 h-12 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-xl flex items-center justify-center border border-[#C9A962]">
                  <span className="text-[#C9A962] font-bold text-xl font-poppins">U</span>
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
                      ? 'bg-white text-[#1A1A1A] shadow-md border border-[#C9A962]'
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
                      ? 'bg-white text-[#1A1A1A] shadow-md border border-[#C9A962]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                  style={{fontFamily: 'Inter, sans-serif'}}
                >
                  <UserPlus className="w-5 h-5 inline mr-2" />
                  Cadastrar
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#C9A962] focus:border-[#C9A962] transition-all bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8]"
                        style={{fontFamily: 'Inter, sans-serif'}}
                        placeholder="Seu nome completo"
                        required={!isLogin}
                      />
                    </div>
                  </div>

                  {/* Telefone (opcional) */}
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                      Telefone <span className="text-[#94A3B8] font-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-12 pr-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#C9A962] focus:border-[#C9A962] transition-all bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8]"
                        style={{fontFamily: 'Inter, sans-serif'}}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#C9A962] focus:border-[#C9A962] transition-all bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8]"
                    style={{fontFamily: 'Inter, sans-serif'}}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#C9A962] focus:border-[#C9A962] transition-all bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8]"
                    style={{fontFamily: 'Inter, sans-serif'}}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha (apenas no cadastro) */}
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-[#0F172A] mb-2" style={{fontFamily: 'Inter, sans-serif'}}>
                      Confirmar Senha
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`w-full pl-12 pr-12 py-3.5 border-2 rounded-xl focus:ring-2 transition-all bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] ${
                          formData.confirmPassword.length > 0
                            ? passwordValidation.passwordsMatch
                              ? 'border-[#2563EB] focus:border-[#2563EB] focus:ring-[#2563EB]'
                              : 'border-[#E11D48] focus:border-[#E11D48] focus:ring-[#E11D48]'
                            : 'border-[#CBD5E1] focus:border-[#C9A962] focus:ring-[#C9A962]'
                        }`}
                        style={{fontFamily: 'Inter, sans-serif'}}
                        placeholder="••••••••"
                        required={!isLogin}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569]"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Requisitos da Senha */}
                  <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-[#475569] mb-2">Requisitos da senha:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span>8+ caracteres</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasUppercase ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span>Letra maiúscula</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasLowercase ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span>Letra minúscula</span>
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-[#2563EB]' : 'text-[#94A3B8]'}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span>Número</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${
                  message.startsWith('✅')
                    ? 'bg-[#DBEAFE] text-[#2563EB] border-2 border-[#2563EB]'
                    : 'bg-[#FFF1F2] text-[#E11D48] border-2 border-[#E11D48]'
                }`} style={{fontFamily: 'Inter, sans-serif'}}>
                  {message}
                </div>
              )}

              {/* Botão de reenviar verificação quando email já cadastrado */}
              {showResendOption && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      await axios.post(`${API_URL}/auth/resend-verification`, { email: registeredEmail });
                      setMessage('✅ Email de verificação reenviado! Verifique sua caixa de entrada.');
                      setShowResendOption(false);
                    } catch (error) {
                      setMessage('❌ Erro ao reenviar email. Tente novamente.');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full py-3 border-2 border-[#C9A962] text-[#1A1A1A] rounded-xl font-semibold hover:bg-[#F5F0E6] transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Reenviando...' : '📧 Reenviar email de verificação'}
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading || (!isLogin && (!isPasswordValid || !passwordValidation.passwordsMatch))}
                className="w-full bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] hover:from-[#2A2A2A] hover:to-[#1A1A1A] text-[#C9A962] font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-[#C9A962]"
                style={{fontFamily: 'Inter, sans-serif'}}
              >
                {isLoading ? 'Processando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <a href="#" className="text-sm font-medium text-[#C9A962] hover:text-[#B8983D] hover:underline" style={{fontFamily: 'Inter, sans-serif'}}>
                  Esqueceu sua senha?
                </a>
              </div>
            )}

            {!isLogin && (
              <p className="mt-6 text-center text-xs text-[#94A3B8]">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="/termos" className="text-[#C9A962] hover:underline">Termos de Uso</a>
                {' '}e{' '}
                <a href="/privacidade" className="text-[#C9A962] hover:underline">Política de Privacidade</a>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-[#475569] text-xs" style={{fontFamily: 'Inter, sans-serif'}}>
          <p>
            © 2025 UTOP — Seu dinheiro em equilíbrio<br />
            <span className="inline-flex items-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 bg-[#C9A962] rounded-full animate-pulse"></span>
              Conectado
            </span>
          </p>
        </footer>
      </main>
    </div>
  );
}
