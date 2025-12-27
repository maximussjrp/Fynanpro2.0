'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Token de verificação não encontrado');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`);
      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('Email verificado com sucesso!');
        
        // Redireciona para login após 3 segundos
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error?.message || 'Erro ao verificar email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erro de conexão. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 lg:p-12 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">U</span>
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A]" style={{fontFamily: 'Poppins, sans-serif'}}>
            UTOP
          </h1>
        </div>

        {status === 'loading' && (
          <div className="space-y-4">
            <Loader2 className="w-16 h-16 mx-auto text-[#1F4FD8] animate-spin" />
            <h2 className="text-xl font-semibold text-[#0F172A]">Verificando email...</h2>
            <p className="text-[#475569]">Aguarde um momento</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-[#DCFCE7] rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-[#22C55E]" />
            </div>
            <h2 className="text-xl font-semibold text-[#0F172A]">Email Verificado!</h2>
            <p className="text-[#475569]">{message}</p>
            <p className="text-sm text-[#94A3B8]">Redirecionando para login...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-[#FEF2F2] rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-[#EF4444]" />
            </div>
            <h2 className="text-xl font-semibold text-[#0F172A]">Erro na Verificação</h2>
            <p className="text-[#475569]">{message}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Voltar para Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
