'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  PiggyBank,
  Shield,
  Smartphone,
  TrendingUp,
  User,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/stores/auth';
import Logo from '@/components/Logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function LoginPage() {
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
    phone: '',
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);

  const passwordValidation = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    passwordsMatch: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  };

  const isPasswordValid =
    passwordValidation.minLength &&
    passwordValidation.hasUppercase &&
    passwordValidation.hasLowercase &&
    passwordValidation.hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    if (!isLogin) {
      if (!isPasswordValid) {
        setMessage('A senha não atende aos requisitos mínimos.');
        setIsLoading(false);
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setMessage('As senhas não coincidem.');
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
            tenantName: `${formData.fullName.split(' ')[0]} Finance`,
          };

      const response = await axios.post(`${API_URL}${endpoint}`, payload);

      if (response.data.success) {
        if (isLogin) {
          setMessage('Login realizado com sucesso.');

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
            }, 900);
          }
        } else {
          setRegisteredEmail(formData.email);
          setShowVerificationMessage(true);
        }
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || 'Erro ao processar requisição.';
      setMessage(errorMsg);

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
      setMessage('Email de verificação reenviado.');
      setShowResendOption(false);
    } catch {
      setMessage('Erro ao reenviar email. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A]">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/landing-v2"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#475569] transition hover:text-[#1F4FD8]"
          >
            <ArrowLeft size={18} />
            Voltar
          </Link>
          <Logo variant="horizontal-dark" height={42} />
        </div>

        <main className="mx-auto grid min-h-[calc(100vh-96px)] max-w-md place-items-center">
          <div className="w-full rounded-[1.75rem] border border-[#E2E8F0] bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-[#1F4FD8]/10 text-[#1F4FD8]">
              <Mail size={30} />
            </div>
            <h1 className="text-2xl font-black">Verifique seu email</h1>
            <p className="mt-4 text-sm leading-7 text-[#475569]">
              Enviamos um link de verificação para <span className="font-bold text-[#1F4FD8]">{registeredEmail}</span>.
            </p>
            <p className="mt-2 text-sm leading-7 text-[#475569]">
              Clique no link para ativar sua conta e começar a usar o UTOP.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-[#1F4FD8] text-sm font-extrabold text-white transition hover:bg-[#1A44BF] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:text-[#475569]"
              >
                {isLoading ? 'Reenviando...' : 'Reenviar email'}
              </button>
              <button
                onClick={() => {
                  setShowVerificationMessage(false);
                  setIsLogin(true);
                  setFormData({ email: '', password: '', confirmPassword: '', fullName: '', phone: '' });
                }}
                className="h-12 w-full rounded-xl border border-[#CBD5E1] text-sm font-bold text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              >
                Voltar para login
              </button>
            </div>

            {message && <p className="mt-5 text-sm text-[#475569]">{message}</p>}
          </div>
        </main>
      </div>
    );
  }

  const benefitCards = [
    {
      icon: TrendingUp,
      title: 'Clareza total',
      description: 'Veja entradas, gastos e vencimentos sem depender de planilhas.',
    },
    {
      icon: PiggyBank,
      title: 'Rotina simples',
      description: 'Poucos minutos por dia para manter o financeiro no lugar.',
    },
    {
      icon: CreditCard,
      title: 'Decisão segura',
      description: 'Saiba o que vence, quanto sobra e onde ajustar primeiro.',
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#F8FAFC] text-[#0F172A]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_0%,rgba(46,204,154,0.16),transparent_32%),linear-gradient(180deg,#F8FAFC_0%,#EFF6FF_100%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
          <Link
            href="/landing-v2"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[#475569] transition hover:bg-white hover:text-[#1F4FD8]"
          >
            <ArrowLeft size={18} />
            Voltar
          </Link>
          <Logo variant="horizontal-dark" height={44} />
          <div className="hidden w-[72px] sm:block" />
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_0.86fr] lg:py-14">
          <section className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2ECC9A]/30 bg-[#2ECC9A]/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0F766E]">
              <Shield size={14} />
              Acesso seguro ao UTOP
            </div>

            <h1 className="text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl">
              Entre para organizar seu dinheiro com clareza.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-[#475569]">
              Continue de onde parou ou crie sua conta para enxergar gastos, dívidas e próximos
              vencimentos em uma experiência simples.
            </p>

            <div className="mt-9 space-y-4">
              {benefitCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                    <div className="flex gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1F4FD8]/10 text-[#1F4FD8]">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h2 className="font-black text-[#0F172A]">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-[#475569]">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="w-full rounded-[1.75rem] border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-7 grid grid-cols-2 rounded-2xl bg-[#F1F5F9] p-1.5">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${
                  isLogin ? 'bg-[#1F4FD8] text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                type="button"
              >
                <LogIn size={18} />
                Entrar
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${
                  !isLogin ? 'bg-[#1F4FD8] text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
                type="button"
              >
                <UserPlus size={18} />
                Cadastrar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <Field label="Nome completo" icon={User}>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="auth-input"
                      placeholder="Seu nome completo"
                      required
                    />
                  </Field>

                  <Field label="Telefone" detail="opcional" icon={Smartphone}>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="auth-input"
                      placeholder="(11) 99999-9999"
                    />
                  </Field>
                </>
              )}

              <Field label="Email" icon={Mail}>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="auth-input"
                  placeholder="seu@email.com"
                  required
                />
              </Field>

              <Field label="Senha" icon={Lock}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="auth-input pr-12"
                  placeholder="••••••••"
                  required
                />
                <PasswordToggle show={showPassword} onClick={() => setShowPassword(!showPassword)} />
              </Field>

              {!isLogin && (
                <>
                  <Field label="Confirmar senha" icon={Shield}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="auth-input pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <PasswordToggle
                      show={showConfirmPassword}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  </Field>

                  <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                    <p className="mb-3 text-xs font-bold text-[#0F172A]">Requisitos da senha</p>
                    <div className="grid gap-2 text-xs text-[#475569] sm:grid-cols-2">
                      <Requirement ok={passwordValidation.minLength} label="8+ caracteres" />
                      <Requirement ok={passwordValidation.hasUppercase} label="Letra maiúscula" />
                      <Requirement ok={passwordValidation.hasLowercase} label="Letra minúscula" />
                      <Requirement ok={passwordValidation.hasNumber} label="Número" />
                    </div>
                  </div>
                </>
              )}

              {message && (
                <div
                  className={`rounded-2xl border p-4 text-sm font-semibold ${
                    message.toLowerCase().includes('sucesso') || message.toLowerCase().includes('reenviado')
                      ? 'border-[#16A34A]/25 bg-[#16A34A]/10 text-[#166534]'
                      : 'border-[#DC2626]/25 bg-[#DC2626]/10 text-[#991B1B]'
                  }`}
                >
                  {message}
                </div>
              )}

              {showResendOption && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="h-12 w-full rounded-xl border border-[#1F4FD8]/30 text-sm font-bold text-[#1F4FD8] transition hover:bg-[#1F4FD8]/10 disabled:cursor-not-allowed disabled:border-[#CBD5E1] disabled:text-[#64748B]"
                >
                  {isLoading ? 'Reenviando...' : 'Reenviar email de verificação'}
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading || (!isLogin && (!isPasswordValid || !passwordValidation.passwordsMatch))}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F4FD8] text-sm font-extrabold text-white shadow-lg transition hover:bg-[#1A44BF] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:text-[#475569]"
              >
                {isLoading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}
                {!isLoading && <ArrowRight size={17} />}
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <Link href="/forgot-password" className="text-sm font-semibold text-[#1F4FD8] hover:text-[#1A44BF]">
                  Esqueceu sua senha?
                </Link>
              </div>
            )}

            {!isLogin && (
              <p className="mt-6 text-center text-xs leading-6 text-[#475569]">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="/termos" className="text-[#1F4FD8] hover:underline">
                  Termos de Uso
                </a>{' '}
                e{' '}
                <a href="/privacidade" className="text-[#1F4FD8] hover:underline">
                  Política de Privacidade
                </a>
                .
              </p>
            )}
          </section>
        </main>

        <footer className="pb-2 text-center text-xs text-[#475569]">
          © 2026 UTOP. Seu dinheiro em equilíbrio.
        </footer>
      </div>

      <style jsx global>{`
        .auth-input {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          padding: 0 16px 0 46px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .auth-input::placeholder {
          color: #64748b;
        }
        .auth-input:focus {
          border-color: #1f4fd8;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(31, 79, 216, 0.14);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  detail,
  icon: Icon,
  children,
}: {
  label: string;
  detail?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#0F172A]">
        {label} {detail && <span className="font-medium text-[#64748B]">({detail})</span>}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#64748B]" />
        {children}
      </span>
    </label>
  );
}

function PasswordToggle({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-[#64748B] transition hover:text-[#0F172A]"
      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {show ? <EyeOff size={19} /> : <Eye size={19} />}
    </button>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-[#16A34A]' : 'text-[#64748B]'}`}>
      <CheckCircle size={15} />
      <span>{label}</span>
    </div>
  );
}
