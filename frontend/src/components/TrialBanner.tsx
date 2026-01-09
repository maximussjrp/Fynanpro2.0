'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Crown, X, ArrowRight, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface TrialBannerProps {
  tenantId?: string;
}

interface SubscriptionStatus {
  plan: string;
  status: string;
  trialEndsAt?: string;
  daysRemaining?: number;
  isActive: boolean;
  periodEnd?: string;
}

export default function TrialBanner({ tenantId }: TrialBannerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [tenantId]);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/subscription/current');
      if (response.data.success) {
        const data = response.data.data;
        
        // Calcular dias restantes
        let daysRemaining = data.daysRemaining;
        let periodEnd = null;
        
        // Se tem assinatura com período definido
        if (data.subscription?.currentPeriodEnd) {
          periodEnd = data.subscription.currentPeriodEnd;
          const now = new Date();
          const endDate = new Date(periodEnd);
          const diffTime = endDate.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        setStatus({
          plan: data.currentPlan || 'trial',
          status: data.status || 'active',
          trialEndsAt: data.trialEndsAt,
          daysRemaining: daysRemaining,
          isActive: data.isActive !== false,
          periodEnd: periodEnd,
        });

        // Se mudou de trial para plano pago, mostrar sucesso
        const previousPlan = localStorage.getItem('lastKnownPlan');
        if (previousPlan === 'trial' && data.currentPlan !== 'trial') {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
        }
        localStorage.setItem('lastKnownPlan', data.currentPlan || 'trial');
      }
    } catch (error) {
      console.error('Erro ao buscar status da assinatura:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    const dismissKey = `subscriptionBannerDismissed_${status?.plan}`;
    localStorage.setItem(dismissKey, new Date().toDateString());
    setDismissed(true);
  };

  const handleUpgrade = () => {
    router.push('/dashboard/plans');
  };

  if (loading) return null;

  // Banner de sucesso após assinar
  if (showSuccess && status && status.plan !== 'trial') {
    return (
      <div className="relative mb-6 rounded-xl p-4 shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/20">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">🎉 Parabéns! Assinatura ativada com sucesso!</h3>
            <p className="text-sm opacity-90">
              Você agora tem acesso ao plano {status.plan.charAt(0).toUpperCase() + status.plan.slice(1)}. 
              Aproveite todas as funcionalidades!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  // Verificar se foi dispensado hoje
  const dismissKey = `subscriptionBannerDismissed_${status.plan}`;
  const wasDismissedToday = localStorage.getItem(dismissKey) === new Date().toDateString();
  if (wasDismissedToday || dismissed) return null;

  const isTrial = status.plan === 'trial';
  const daysRemaining = status.daysRemaining ?? 30;
  
  // PLANO PAGO: só mostrar se faltar 7 dias ou menos para vencer
  if (!isTrial && daysRemaining > 7) {
    return null;
  }

  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining <= 0;

  // Configurações visuais
  let bgClass = 'bg-gradient-to-r from-[#6C5CE7] to-purple-600 text-white';
  let title = '';
  let subtitle = '';

  if (isTrial) {
    if (isExpired) {
      bgClass = 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      title = 'Seu período de teste expirou!';
      subtitle = 'Assine agora para continuar usando todas as funcionalidades';
    } else if (isUrgent) {
      bgClass = 'bg-gradient-to-r from-orange-500 to-amber-500 text-white';
      title = daysRemaining === 1 ? '⚠️ Último dia de teste!' : `⚠️ ${daysRemaining} dias restantes no seu teste gratuito`;
      subtitle = 'Assine agora para não perder acesso às suas finanças!';
    } else {
      title = `🎉 ${daysRemaining} dias restantes no seu teste gratuito`;
      subtitle = 'Aproveite todas as funcionalidades. Assine quando estiver pronto!';
    }
  } else {
    const planName = status.plan.charAt(0).toUpperCase() + status.plan.slice(1);
    if (isExpired) {
      bgClass = 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      title = `Seu plano ${planName} venceu!`;
      subtitle = 'Renove agora para continuar usando o sistema';
    } else if (isUrgent) {
      bgClass = 'bg-gradient-to-r from-orange-500 to-amber-500 text-white';
      title = daysRemaining === 1 ? `⚠️ Seu plano ${planName} vence amanhã!` : `⚠️ Seu plano ${planName} vence em ${daysRemaining} dias`;
      subtitle = 'Renove para garantir acesso contínuo';
    } else {
      bgClass = 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
      title = `📅 Seu plano ${planName} vence em ${daysRemaining} dias`;
      subtitle = 'Lembre-se de renovar para continuar aproveitando';
    }
  }

  return (
    <div className={`relative mb-6 rounded-xl p-4 shadow-lg transition-all ${bgClass}`}>
      {!isExpired && (
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-white/20">
            {isExpired ? <Crown className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-sm opacity-90">{subtitle}</p>
          </div>
        </div>

        <button
          onClick={handleUpgrade}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
            isExpired || isUrgent ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          <Crown className="w-4 h-4" />
          {isTrial ? 'Ver Planos' : 'Renovar'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {isTrial && !isExpired && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1 opacity-75">
            <span>Início do trial</span>
            <span>{daysRemaining} dias restantes</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, ((30 - daysRemaining) / 30) * 100))}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
