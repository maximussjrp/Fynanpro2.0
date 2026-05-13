'use client';

import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: email.trim().toLowerCase(),
      });

      setSubmitted(true);
      setMessage(
        response.data?.message ||
          'Se o email estiver cadastrado, você receberá um link para redefinir sua senha.'
      );
    } catch (error: any) {
      // Por segurança o backend sempre retorna sucesso, mas tratamos erro de rede
      setMessage(
        'Erro de conexão. Verifique sua internet e tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] flex items-center justify-center px-4 py-12">
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
              <Mail className="text-[#1F4FD8]" size={28} />
            </div>
            <h1
              className="text-2xl font-bold text-[#0F172A]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              Esqueceu sua senha?
            </h1>
            <p className="text-sm text-[#475569] mt-2">
              {submitted
                ? 'Verifique seu email para continuar'
                : 'Informe seu email e enviaremos um link para redefinir sua senha.'}
            </p>
          </div>

          {submitted ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
                <CheckCircle className="text-[#16A34A] flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-green-800">
                  <p className="font-semibold mb-1">Email enviado!</p>
                  <p>{message}</p>
                  <p className="mt-2 text-green-700">
                    O link é válido por <strong>1 hora</strong>. Não esqueça de conferir
                    a caixa de spam.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                  setMessage('');
                }}
                className="w-full py-3 border-2 border-[#CBD5E1] text-[#0F172A] rounded-xl font-semibold hover:bg-[#F8FAFC] transition-colors"
              >
                Enviar para outro email
              </button>

              <Link
                href="/login"
                className="block text-center w-full py-3 bg-[#1F4FD8] text-white rounded-xl font-bold hover:bg-[#1A44BF] transition-colors"
              >
                Voltar para login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1F4FD8] focus:border-transparent"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
              </div>

              {message && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-[#1F4FD8] hover:bg-[#1A44BF] text-white font-bold py-4 rounded-xl transition-all disabled:bg-[#CBD5E1] disabled:text-[#475569] disabled:cursor-not-allowed shadow-lg"
              >
                {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <p className="text-center text-xs text-[#475569]">
                Lembrou a senha?{' '}
                <Link
                  href="/login"
                  className="text-[#1F4FD8] hover:underline font-medium"
                >
                  Entrar
                </Link>
              </p>
            </form>
          )}
        </div>

        <footer className="mt-8 text-center text-[#475569] text-xs">
          © 2026 UTOP — Seu dinheiro em equilíbrio
        </footer>
      </div>
    </div>
  );
}
