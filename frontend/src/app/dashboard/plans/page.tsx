'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, Crown, Zap, ExternalLink, AlertCircle, CheckCircle2, Sparkles, Calendar, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Plan {
  id: string;
  name: string;
  price: number;
  pricePerMonth?: number;
  period: string;
  periodLabel: string;
  savings?: string;
  popular?: boolean;
  features: string[];
  limits: Record<string, any>;
}

export default function PlansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('trial');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Verificar parâmetros de retorno do Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      setMessage({ type: 'success', text: 'Assinatura realizada com sucesso! Sua conta foi atualizada.' });
      router.replace('/dashboard/plans');
    } else if (canceled === 'true') {
      setMessage({ type: 'error', text: 'Checkout cancelado. Você pode tentar novamente quando quiser.' });
      router.replace('/dashboard/plans');
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      let response;
      try {
        response = await api.get('/subscription/stripe/plans');
      } catch {
        response = await api.get('/subscription/plans');
      }
      
      if (response.data.success) {
        const planData = response.data.data.plans || response.data.data;
        const plansArray = Array.isArray(planData) ? planData : Object.values(planData);
        // Filtrar plano trial
        const paidPlans = plansArray.filter((p: Plan) => p.id !== 'trial');
        setPlans(paidPlans);
      }
      
      // Buscar status atual da assinatura
      try {
        const current = await api.get('/subscription/stripe/status');
        if (current.data.success) {
          setCurrentPlan(current.data.data.plan);
        }
      } catch {
        try {
          const current = await api.get('/subscription/current');
          if (current.data.success) {
            setCurrentPlan(current.data.data.currentPlan);
          }
        } catch {}
      }
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'trial' || planId === currentPlan) return;
    
    setSelectedPlan(planId);
    setProcessing(true);
    setMessage(null);

    try {
      const response = await api.post('/subscription/stripe/checkout', {
        planId,
      });

      if (response.data.success && response.data.data.url) {
        window.location.href = response.data.data.url;
      } else {
        throw new Error('URL de checkout não retornada');
      }
    } catch (error: any) {
      console.error('Erro ao iniciar checkout:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error?.message || 'Erro ao processar. Tente novamente.' 
      });
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/subscription/stripe/portal');
      if (response.data.success && response.data.data.url) {
        window.location.href = response.data.data.url;
      }
    } catch (error: any) {
      console.error('Erro ao abrir portal:', error);
      setMessage({ 
        type: 'error', 
        text: 'Erro ao abrir portal de gerenciamento.' 
      });
    } finally {
      setProcessing(false);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'monthly': return <Clock className="w-8 h-8 text-blue-500" />;
      case 'quarterly': return <Calendar className="w-8 h-8 text-purple-500" />;
      case 'semiannual': return <Zap className="w-8 h-8 text-orange-500" />;
      case 'yearly': return <Crown className="w-8 h-8 text-yellow-500" />;
      default: return <Sparkles className="w-8 h-8 text-gray-400" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Ordenar planos: mensal, trimestral, semestral, anual
  const orderedPlans = ['monthly', 'quarterly', 'semiannual', 'yearly']
    .map(id => plans.find(p => p.id === id))
    .filter(Boolean) as Plan[];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C5CE7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Escolha seu plano
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            Todas as funcionalidades incluídas. Escolha o período que melhor se adapta a você.
          </p>
          <p className="text-sm text-gray-500">
            Quanto maior o período, maior a economia!
          </p>
        </div>

        {/* Plano Atual */}
        {currentPlan && currentPlan !== 'trial' && (
          <div className="mb-8 text-center space-y-4">
            <span className="inline-flex items-center px-4 py-2 bg-[#6C5CE7]/10 text-[#6C5CE7] rounded-full text-sm font-medium">
              <Crown className="w-4 h-4 mr-2" />
              Plano atual: {plans.find(p => p.id === currentPlan)?.name || currentPlan}
            </span>
            <div>
              <button
                onClick={handleManageSubscription}
                disabled={processing}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#6C5CE7] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Gerenciar assinatura
              </button>
            </div>
          </div>
        )}

        {/* Mensagem de Feedback */}
        {message && (
          <div className={`mb-8 p-4 rounded-xl flex items-center gap-3 max-w-2xl mx-auto ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {orderedPlans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isPopular = (plan as any).popular || plan.id === 'yearly';
            const pricePerMonth = (plan as any).pricePerMonth || plan.price;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                  isPopular ? 'ring-2 ring-[#6C5CE7] scale-105' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Badge Popular */}
                {isPopular && !isCurrentPlan && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-[#6C5CE7] to-purple-500 text-white px-4 py-2 text-center text-sm font-bold">
                    🔥 Melhor custo-benefício
                  </div>
                )}

                {/* Badge Plano Atual */}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 right-0 bg-green-500 text-white px-4 py-2 text-center text-sm font-bold">
                    ✓ Seu Plano Atual
                  </div>
                )}

                <div className={`p-6 ${isPopular || isCurrentPlan ? 'pt-14' : ''}`}>
                  {/* Ícone e Nome */}
                  <div className="flex items-center gap-3 mb-4">
                    {getPlanIcon(plan.id)}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{(plan as any).periodLabel || ''}</p>
                    </div>
                  </div>

                  {/* Economia */}
                  {(plan as any).savings && (
                    <div className="mb-4">
                      <span className="inline-block bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full">
                        {(plan as any).savings}
                      </span>
                    </div>
                  )}

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold text-gray-900">
                        {formatCurrency(pricePerMonth)}
                      </span>
                      <span className="text-gray-500 mb-1">/mês</span>
                    </div>
                    {plan.id !== 'monthly' && (
                      <p className="text-sm text-gray-500 mt-1">
                        Total: {formatCurrency(plan.price)}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.slice(0, 5).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Botão */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || processing}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isPopular
                          ? 'bg-gradient-to-r from-[#6C5CE7] to-purple-500 text-white hover:opacity-90'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {processing && selectedPlan === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : isCurrentPlan ? (
                      'Plano Atual'
                    ) : (
                      'Assinar Agora'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Garantias */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-wrap justify-center items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Cancele a qualquer momento</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Pagamento seguro via Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Dados 100% protegidos</span>
            </div>
          </div>
        </div>

        {/* Trial Info */}
        {currentPlan === 'trial' && (
          <div className="mt-8 text-center p-6 bg-blue-50 rounded-2xl max-w-2xl mx-auto">
            <p className="text-blue-800">
              <strong>🎉 Você está no período de teste!</strong><br />
              Aproveite todas as funcionalidades gratuitamente. Ao assinar, seu trial será convertido.
            </p>
          </div>
        )}

        {/* Link voltar */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#6C5CE7] hover:underline"
          >
            ← Voltar para o Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
