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
      <div className="min-h-screen bg-[#070A12] px-4 py-8 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/landing-v2"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={18} />
            Voltar
          </Link>
          <Logo variant="horizontal-dark" height={42} />
        </div>

        <main className="mx-auto grid min-h-[calc(100vh-96px)] max-w-md place-items-center">
          <div className="w-full rounded-[1.75rem] border border-white/[0.08] bg-[#101827] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
              <Mail size={30} />
            </div>
            <h1 className="text-2xl font-black">Verifique seu email</h1>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Enviamos um link de verificação para <span className="font-bold text-emerald-300">{registeredEmail}</span>.
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              Clique no link para ativar sua conta e começar a usar o UTOP.
            </p>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleResendVerification}
                disabled={isLoading}
                className="h-12 w-full rounded-xl bg-emerald-400 text-sm font-extrabold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {isLoading ? 'Reenviando...' : 'Reenviar email'}
              </button>
              <button
                onClick={() => {
                  setShowVerificationMessage(false);
                  setIsLogin(true);
                  setFormData({ email: '', password: '', confirmPassword: '', fullName: '', phone: '' });
                }}
                className="h-12 w-full rounded-xl border border-white/[0.08] text-sm font-bold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                Voltar para login
              </button>
            </div>

            {message && <p className="mt-5 text-sm text-slate-400">{message}</p>}
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
    <div className="min-h-screen overflow-hidden bg-[#070A12] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_0%,rgba(16,185,129,0.16),transparent_32%),linear-gradient(180deg,#0B1020_0%,#070A12_72%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between border-b border-white/[0.06] pb-5">
          <Link
            href="/landing-v2"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeft size={18} />
            Voltar
          </Link>
          <Logo variant="horizontal-dark" height={44} />
          <div className="hidden w-[72px] sm:block" />
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1fr_0.86fr] lg:py-14">
          <section className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              <Shield size={14} />
              Acesso seguro ao UTOP
            </div>

            <h1 className="text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl">
              Entre para organizar seu dinheiro com clareza.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
              Continue de onde parou ou crie sua conta para enxergar gastos, dívidas e próximos
              vencimentos em uma experiência simples.
            </p>

            <div className="mt-9 space-y-4">
              {benefitCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-[#101827]/90 p-5">
                    <div className="flex gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h2 className="font-black text-white">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="w-full rounded-[1.75rem] border border-white/[0.08] bg-[#101827] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.48)] sm:p-8">
            <div className="mb-7 grid grid-cols-2 rounded-2xl bg-white/[0.04] p-1.5">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${
                  isLogin ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                type="button"
              >
                <LogIn size={18} />
                Entrar
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-extrabold transition ${
                  !isLogin ? 'bg-emerald-400 text-slate-950' : 'text-slate-400 hover:text-white'
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

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <p className="mb-3 text-xs font-bold text-slate-300">Requisitos da senha</p>
                    <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
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
                      ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300'
                      : 'border-rose-300/25 bg-rose-300/10 text-rose-200'
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
                  className="h-12 w-full rounded-xl border border-emerald-300/25 text-sm font-bold text-emerald-300 transition hover:bg-emerald-300/10 disabled:opacity-60"
                >
                  {isLoading ? 'Reenviando...' : 'Reenviar email de verificação'}
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading || (!isLogin && (!isPasswordValid || !passwordValidation.passwordsMatch))}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-extrabold text-slate-950 shadow-[0_18px_48px_rgba(16,185,129,0.24)] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar conta'}
                {!isLoading && <ArrowRight size={17} />}
              </button>
            </form>

            {isLogin && (
              <div className="mt-6 text-center">
                <Link href="/forgot-password" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                  Esqueceu sua senha?
                </Link>
              </div>
            )}

            {!isLogin && (
              <p className="mt-6 text-center text-xs leading-6 text-slate-500">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="/termos" className="text-emerald-300 hover:underline">
                  Termos de Uso
                </a>{' '}
                e{' '}
                <a href="/privacidade" className="text-emerald-300 hover:underline">
                  Política de Privacidade
                </a>
                .
              </p>
            )}
          </section>
        </main>

        <footer className="pb-2 text-center text-xs text-slate-600">
          © 2026 UTOP. Seu dinheiro em equilíbrio.
        </footer>
      </div>

      <style jsx global>{`
        .auth-input {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          padding: 0 16px 0 46px;
          color: #f8fafc;
          outline: none;
          transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
        }
        .auth-input::placeholder {
          color: #64748b;
        }
        .auth-input:focus {
          border-color: rgba(110, 231, 183, 0.5);
          background: rgba(255, 255, 255, 0.065);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
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
      <span className="mb-2 block text-sm font-bold text-slate-200">
        {label} {detail && <span className="font-medium text-slate-500">({detail})</span>}
      </span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-500" />
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
      className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-slate-500 transition hover:text-slate-200"
      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {show ? <EyeOff size={19} /> : <Eye size={19} />}
    </button>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-emerald-300' : 'text-slate-500'}`}>
      <CheckCircle size={15} />
      <span>{label}</span>
    </div>
  );
}
