'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Clock, CreditCard, ArrowRight, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Plan {
  id: string;
  name: string;
  price: number;
  priceYearly: number;
  features: string[];
}

export default function BlockedPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<'trial_expired' | 'suspended' | 'cancelled'>('trial_expired');

  useEffect(() => {
    // Verificar o motivo do bloqueio
    const urlParams = new URLSearchParams(window.location.search);
    const reasonParam = urlParams.get('reason');
    if (reasonParam === 'suspended' || reasonParam === 'cancelled') {
      setReason(reasonParam);
    }

    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/subscription/plans');
      if (response.data.success) {
        // Filtrar apenas planos pagos
        const paidPlans = response.data.data.filter((p: Plan) => p.id !== 'trial');
        setPlans(paidPlans);
      }
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (planId: string) => {
    router.push(`/dashboard/plans?selected=${planId}`);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const getMessage = () => {
    switch (reason) {
      case 'suspended':
        return {
          title: 'Assinatura Suspensa',
          subtitle: 'Sua assinatura está suspensa por falta de pagamento.',
          description: 'Para continuar usando o UTOP e acessar suas finanças, regularize seu pagamento.'
        };
      case 'cancelled':
        return {
          title: 'Assinatura Cancelada',
          subtitle: 'Sua assinatura foi cancelada.',
          description: 'Para continuar usando o UTOP, escolha um novo plano abaixo.'
        };
      default:
        return {
          title: 'Período de Teste Expirado',
          subtitle: 'Seus 30 dias de teste gratuito chegaram ao fim.',
          description: 'Esperamos que você tenha gostado! Escolha um plano para continuar organizando suas finanças.'
        };
    }
  };

  const message = getMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1F4FD8] to-[#6C5CE7] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-6">
            {reason === 'trial_expired' ? (
              <Clock className="w-10 h-10 text-white" />
            ) : (
              <CreditCard className="w-10 h-10 text-white" />
            )}
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4">
            {message.title}
          </h1>
          
          <p className="text-xl text-white/90 mb-2">
            {message.subtitle}
          </p>
          
          <p className="text-white/70 max-w-lg mx-auto">
            {message.description}
          </p>

          {user && (
            <p className="text-white/60 mt-4 text-sm">
              Logado como: {user.email}
            </p>
          )}
        </div>

        {/* Planos */}
        {loading ? (
          <div className="text-center text-white">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4">Carregando planos...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-6 shadow-2xl transform hover:scale-105 transition-all ${
                  plan.id === 'plus' ? 'ring-4 ring-yellow-400 relative' : ''
                }`}
              >
                {plan.id === 'plus' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-[#1F4FD8]">
                      R$ {plan.price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-gray-500">/mês</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    ou R$ {plan.priceYearly.toFixed(2).replace('.', ',')}/ano
                  </p>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    plan.id === 'plus'
                      ? 'bg-[#1F4FD8] hover:bg-[#1a44bf] text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  <Crown className="w-5 h-5" />
                  Assinar {plan.name}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-8 text-center space-y-4">
          <button
            onClick={() => router.push('/dashboard/plans')}
            className="text-white/80 hover:text-white underline"
          >
            Ver todos os detalhes dos planos
          </button>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </div>
        </div>

        {/* Garantia */}
        <div className="mt-8 text-center">
          <p className="text-white/60 text-sm">
            🔒 Pagamento seguro • ✅ Cancele quando quiser • 💬 Suporte humanizado
          </p>
        </div>
      </div>
    </div>
  );
}
