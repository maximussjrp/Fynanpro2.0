'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const validation = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    match: password === confirmPassword && confirmPassword.length > 0,
  };

  const isValid =
    validation.minLength &&
    validation.hasUppercase &&
    validation.hasLowercase &&
    validation.hasNumber &&
    validation.match;

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push('/login'), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsLoading(true);
    setError('');

    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message;
      if (code === 'INVALID_TOKEN') {
        setError(
          'Este link expirou ou já foi usado. Solicite um novo link de recuperação.'
        );
      } else {
        setError(msg || 'Erro ao redefinir senha. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#E2E8F0] text-center">
          <AlertCircle className="text-[#DC2626] mx-auto mb-4" size={48} />
          <h1 className="text-xl font-bold text-[#0F172A] mb-2">
            Link inválido
          </h1>
          <p className="text-sm text-[#475569] mb-6">
            O link de recuperação está incompleto ou malformado.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block w-full py-3 bg-[#1F4FD8] text-white rounded-xl font-bold hover:bg-[#1A44BF] transition-colors"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#E2E8F0] text-center">
          <CheckCircle className="text-[#16A34A] mx-auto mb-4" size={56} />
          <h1 className="text-2xl font-bold text-[#0F172A] mb-2">
            Senha alterada!
          </h1>
          <p className="text-sm text-[#475569] mb-6">
            Sua nova senha foi definida com sucesso. Redirecionando para o
            login...
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 bg-[#1F4FD8] text-white rounded-xl font-bold hover:bg-[#1A44BF] transition-colors"
          >
            Ir para login agora
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-[#475569] hover:text-[#1F4FD8] mb-6 text-sm font-medium"
      >
        <ArrowLeft size={16} />
        Voltar para login
      </Link>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-[#E2E8F0]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1F4FD8]/10 rounded-2xl mb-4">
            <Lock className="text-[#1F4FD8]" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            Nova senha
          </h1>
          <p className="text-sm text-[#475569] mt-2">
            Escolha uma senha forte para sua conta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Nova senha
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua nova senha"
                className="w-full pl-10 pr-10 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1F4FD8]"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F172A] mb-1">
              Confirmar senha
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite novamente"
                className="w-full pl-10 pr-10 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1F4FD8]"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A]"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {password.length > 0 && (
            <div className="bg-[#F8FAFC] rounded-xl p-3 space-y-1">
              <Rule ok={validation.minLength} text="Pelo menos 8 caracteres" />
              <Rule ok={validation.hasUppercase} text="Uma letra maiúscula" />
              <Rule ok={validation.hasLowercase} text="Uma letra minúscula" />
              <Rule ok={validation.hasNumber} text="Um número" />
              {confirmPassword.length > 0 && (
                <Rule ok={validation.match} text="Senhas coincidem" />
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isValid}
            className="w-full bg-[#1F4FD8] hover:bg-[#1A44BF] text-white font-bold py-4 rounded-xl transition-all disabled:bg-[#CBD5E1] disabled:text-[#475569] disabled:cursor-not-allowed shadow-lg"
          >
            {isLoading ? 'Salvando...' : 'Redefinir senha'}
          </button>
        </form>
      </div>

      <footer className="mt-8 text-center text-[#475569] text-xs">
        © 2026 UTOP — Seu dinheiro em equilíbrio
      </footer>
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-center gap-2 text-xs ${
        ok ? 'text-[#166534]' : 'text-[#64748B]'
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
          ok ? 'bg-[#16A34A] text-white' : 'bg-[#E2E8F0] text-[#64748B]'
        }`}
      >
        {ok ? '✓' : '·'}
      </span>
      {text}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="text-[#475569] text-sm">Carregando...</div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
