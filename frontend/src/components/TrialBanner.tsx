'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Crown, X, ArrowRight } from 'lucide-react';
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
}

export default function TrialBanner({ tenantId }: TrialBannerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if banner was dismissed today
    const dismissedDate = localStorage.getItem('trialBannerDismissed');
    if (dismissedDate === new Date().toDateString()) {
      setDismissed(true);
    }
    
    fetchSubscriptionStatus();
  }, [tenantId]);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await api.get('/subscription/stripe/status');
      if (response.data.success) {
        setStatus(response.data.data);
      }
    } catch (error) {
      // If Stripe endpoint fails, try legacy endpoint
      try {
        const response = await api.get('/subscription/current');
        if (response.data.success) {
          const data = response.data.data;
          setStatus({
            plan: data.currentPlan || 'trial',
            status: data.status || 'trial',
            trialEndsAt: data.trialEndsAt,
            daysRemaining: data.daysRemaining,
            isActive: data.isActive !== false,
          });
        }
      } catch {
        // Ignore errors
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('trialBannerDismissed', new Date().toDateString());
    setDismissed(true);
  };

  const handleUpgrade = () => {
    router.push('/dashboard/plans');
  };

  // Don't show if loading, dismissed, or not in trial
  if (loading || dismissed) return null;
  if (!status || status.plan !== 'trial') return null;

  const daysRemaining = status.daysRemaining ?? 14;
  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining <= 0;

  return (
    <div 
      className={`relative mb-6 rounded-xl p-4 shadow-lg transition-all ${
        isExpired 
          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
          : isUrgent 
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
            : 'bg-gradient-to-r from-[#6C5CE7] to-purple-600 text-white'
      }`}
    >
      {/* Close button */}
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
          <div className={`p-2 rounded-full ${isExpired || isUrgent ? 'bg-white/20' : 'bg-white/20'}`}>
            {isExpired ? (
              <Crown className="w-6 h-6" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
          </div>
          
          <div>
            {isExpired ? (
              <>
                <h3 className="font-bold text-lg">Seu período de teste expirou!</h3>
                <p className="text-sm opacity-90">
                  Assine agora para continuar usando todas as funcionalidades
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-lg">
                  {isUrgent ? '⚠️ ' : '🎉 '}
                  {daysRemaining === 1 
                    ? 'Último dia de teste!' 
                    : `${daysRemaining} dias restantes no seu teste gratuito`}
                </h3>
                <p className="text-sm opacity-90">
                  {isUrgent 
                    ? 'Assine agora para não perder acesso às suas finanças!'
                    : 'Aproveite todas as funcionalidades. Assine quando estiver pronto!'}
                </p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleUpgrade}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
            isExpired || isUrgent
              ? 'bg-white text-gray-900 hover:bg-gray-100'
              : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          <Crown className="w-4 h-4" />
          Ver Planos
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar for trial */}
      {!isExpired && (
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1 opacity-75">
            <span>Início do trial</span>
            <span>{daysRemaining} dias restantes</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, ((14 - daysRemaining) / 14) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
