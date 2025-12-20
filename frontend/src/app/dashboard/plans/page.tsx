'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Loader2, Crown, Star, Zap, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface Plan {
  id: string;
  name: string;
  price: number;
  priceYearly: number;
  features: string[];
  limits: Record<string, any>;
}

export default function PlansPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('trial');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/subscription/plans');
      if (response.data.success) {
        setPlans(response.data.data);
      }
      
      // Buscar plano atual
      const current = await api.get('/subscription/current');
      if (current.data.success) {
        setCurrentPlan(current.data.data.currentPlan);
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

    try {
      const response = await api.post('/subscription/checkout', {
        planId,
        billingCycle,
        billingType: 'PIX'
      });

      if (response.data.success) {
        // Redirecionar para página de pagamento
        router.push(`/dashboard/plans/checkout?subscriptionId=${response.data.data.subscriptionId}`);
      }
    } catch (error: any) {
      console.error('Erro ao iniciar checkout:', error);
      alert(error.response?.data?.error?.message || 'Erro ao processar');
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'basic': return <Zap className="w-8 h-8 text-blue-500" />;
      case 'plus': return <Star className="w-8 h-8 text-purple-500" />;
      case 'premium': return <Crown className="w-8 h-8 text-yellow-500" />;
      case 'business': return <Building2 className="w-8 h-8 text-gray-700" />;
      default: return <Zap className="w-8 h-8 text-gray-400" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calculateDiscount = (monthly: number, yearly: number) => {
    const monthlyTotal = monthly * 12;
    const discount = ((monthlyTotal - yearly) / monthlyTotal) * 100;
    return Math.round(discount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C5CE7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Escolha o plano ideal para você
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Comece grátis por 14 dias. Cancele quando quiser.
          </p>

          {/* Toggle Mensal/Anual */}
          <div className="inline-flex items-center bg-white rounded-full p-1 shadow-sm border">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#6C5CE7] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-[#6C5CE7] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Anual
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                -16%
              </span>
            </button>
          </div>
        </div>

        {/* Plano Atual */}
        {currentPlan && currentPlan !== 'trial' && (
          <div className="mb-8 text-center">
            <span className="inline-flex items-center px-4 py-2 bg-[#6C5CE7]/10 text-[#6C5CE7] rounded-full text-sm font-medium">
              <Crown className="w-4 h-4 mr-2" />
              Plano atual: {plans.find(p => p.id === currentPlan)?.name || currentPlan}
            </span>
          </div>
        )}

        {/* Grid de Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.filter(p => p.id !== 'trial').map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;
            const isPopular = plan.id === 'plus';
            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.price;
            const monthlyPrice = billingCycle === 'yearly' ? plan.priceYearly / 12 : plan.price;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
                  isPopular ? 'ring-2 ring-[#6C5CE7]' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Badge Popular */}
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-[#6C5CE7] text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
                    ⭐ Mais Popular
                  </div>
                )}

                {/* Badge Plano Atual */}
                {isCurrentPlan && (
                  <div className="absolute top-0 left-0 bg-green-500 text-white px-4 py-1 text-xs font-bold rounded-br-lg">
                    ✓ Seu Plano
                  </div>
                )}

                <div className="p-6">
                  {/* Ícone e Nome */}
                  <div className="flex items-center gap-3 mb-4">
                    {getPlanIcon(plan.id)}
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  </div>

                  {/* Preço */}
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatCurrency(monthlyPrice)}
                      </span>
                      <span className="text-gray-500 mb-1">/mês</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-gray-500 mt-1">
                        {formatCurrency(price)} cobrado anualmente
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
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
                          ? 'bg-[#6C5CE7] text-white hover:bg-[#5b4ed6]'
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

        {/* FAQ ou Garantia */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Cancele a qualquer momento</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Suporte por chat</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span>Dados 100% seguros</span>
            </div>
          </div>
        </div>

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
