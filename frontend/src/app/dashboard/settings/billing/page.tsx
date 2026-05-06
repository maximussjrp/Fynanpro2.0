'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  Crown,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';
import api from '@/lib/api';

interface BillingSummary {
  tenantId: string;
  plan: string;
  status: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  billingSource: string | null;
  subscription: {
    id: string;
    provider: string;
    status: string;
    cycle: string;
    amountCents: number;
    currency: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
  } | null;
  lastPayment: {
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    paymentMethod: string | null;
    dueDate: string | null;
    paidAt: string | null;
    failedAt: string | null;
  } | null;
  ui: {
    severity: 'green' | 'amber' | 'orange' | 'red';
    headline: string;
    cta: 'upgrade' | 'manage' | 'retry' | null;
  };
}

const SEVERITY_STYLES: Record<BillingSummary['ui']['severity'], { bg: string; text: string; border: string; ring: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', ring: 'ring-red-500' },
};

function formatBRL(cents: number, currency = 'BRL'): string {
  if (currency !== 'BRL') return `${(cents / 100).toFixed(2)} ${currency}`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function planLabel(planId: string): string {
  const map: Record<string, string> = {
    trial: 'Teste',
    basic: 'Básico',
    plus: 'Plus',
    premium: 'Premium',
    business: 'Business',
    founder: 'Fundador',
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    semiannual: 'Semestral',
    yearly: 'Anual',
  };
  return map[planId] ?? planId.charAt(0).toUpperCase() + planId.slice(1);
}

function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendente',
    paid: 'Pago',
    failed: 'Falhou',
    refunded: 'Estornado',
  };
  return map[status] ?? status;
}

export default function BillingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchSummary();
  }, []);

  async function fetchSummary() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/subscription/billing-summary');
      if (res.data?.success && res.data?.data) {
        setSummary(res.data.data);
      } else {
        throw new Error(res.data?.error?.message || 'Resposta inesperada do servidor');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Erro ao carregar plano');
    } finally {
      setLoading(false);
    }
  }

  const sev = summary ? SEVERITY_STYLES[summary.ui.severity] : SEVERITY_STYLES.amber;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4F7FB] to-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Voltar para Configurações"
            aria-label="Voltar para Configurações"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="w-8 h-8" />
              Plano e Cobrança
            </h1>
            <p className="text-gray-600 mt-1">
              Acompanhe seu plano, dias restantes de teste e status da assinatura.
            </p>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Não conseguimos carregar seu plano</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={() => void fetchSummary()}
                className="mt-3 text-sm font-semibold text-red-700 underline hover:no-underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && !error && summary && (
          <div className="space-y-6">
            {/* Card principal de status */}
            <div className={`bg-white rounded-2xl shadow-sm border ${sev.border} overflow-hidden`}>
              <div className={`${sev.bg} px-6 py-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  {summary.ui.severity === 'green' ? (
                    <CheckCircle2 className={`w-6 h-6 ${sev.text}`} />
                  ) : (
                    <Clock className={`w-6 h-6 ${sev.text}`} />
                  )}
                  <span className={`font-semibold ${sev.text}`}>{summary.ui.headline}</span>
                </div>
                <span className={`text-xs uppercase font-bold px-3 py-1 rounded-full bg-white ${sev.text} border ${sev.border}`}>
                  {summary.status}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Plano atual</p>
                  <p className="text-xl font-bold text-gray-900 flex items-center gap-2 mt-1">
                    {summary.isTrial ? (
                      <Sparkles className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Crown className="w-5 h-5 text-blue-600" />
                    )}
                    {planLabel(summary.plan)}
                  </p>
                </div>

                {summary.isTrial ? (
                  <div>
                    <p className="text-sm text-gray-500">Dias restantes de teste</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {summary.trialDaysRemaining ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Termina em {formatDate(summary.trialEndsAt)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Próximo vencimento</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatDate(summary.subscription?.currentPeriodEnd ?? null)}
                    </p>
                    {summary.subscription && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatBRL(summary.subscription.amountCents, summary.subscription.currency)} / {summary.subscription.cycle.toLowerCase()}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500">Provedor</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {summary.billingSource
                      ? summary.billingSource === 'asaas'
                        ? 'Asaas'
                        : summary.billingSource === 'stripe'
                        ? 'Stripe'
                        : summary.billingSource
                      : 'Em teste'}
                  </p>
                </div>
              </div>

              {summary.ui.cta && (
                <div className="px-6 pb-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {summary.ui.cta === 'upgrade' && (
                      <button
                        onClick={() => router.push('/dashboard/plans')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A] text-white font-semibold hover:shadow-md transition-shadow"
                      >
                        <Crown className="w-5 h-5" />
                        Escolher plano e ativar
                      </button>
                    )}
                    {summary.ui.cta === 'retry' && (
                      <button
                        onClick={() => router.push('/dashboard/plans')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
                      >
                        <AlertCircle className="w-5 h-5" />
                        Regularizar pagamento
                      </button>
                    )}
                    {summary.ui.cta === 'manage' && (
                      <button
                        onClick={() => router.push('/dashboard/plans')}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                      >
                        Ver outros planos
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Card de subscription detalhada */}
            {summary.subscription && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Detalhes da assinatura
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">ID</dt>
                    <dd className="font-mono text-sm text-gray-900 break-all">{summary.subscription.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd className="font-semibold text-gray-900">{summary.subscription.status}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Ciclo</dt>
                    <dd className="font-semibold text-gray-900">{summary.subscription.cycle}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Valor</dt>
                    <dd className="font-semibold text-gray-900">
                      {formatBRL(summary.subscription.amountCents, summary.subscription.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Início do período</dt>
                    <dd className="font-semibold text-gray-900">{formatDate(summary.subscription.currentPeriodStart)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Fim do período</dt>
                    <dd className="font-semibold text-gray-900">{formatDate(summary.subscription.currentPeriodEnd)}</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Último pagamento */}
            {summary.lastPayment && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Último pagamento</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-gray-500">Status</dt>
                    <dd className="font-semibold text-gray-900">{paymentStatusLabel(summary.lastPayment.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Valor</dt>
                    <dd className="font-semibold text-gray-900">
                      {formatBRL(summary.lastPayment.amountCents, summary.lastPayment.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Método</dt>
                    <dd className="font-semibold text-gray-900">{summary.lastPayment.paymentMethod ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-gray-500">Vencimento</dt>
                    <dd className="font-semibold text-gray-900">{formatDate(summary.lastPayment.dueDate)}</dd>
                  </div>
                  {summary.lastPayment.paidAt && (
                    <div>
                      <dt className="text-sm text-gray-500">Pago em</dt>
                      <dd className="font-semibold text-emerald-700">{formatDate(summary.lastPayment.paidAt)}</dd>
                    </div>
                  )}
                  {summary.lastPayment.failedAt && (
                    <div>
                      <dt className="text-sm text-gray-500">Falha em</dt>
                      <dd className="font-semibold text-red-700">{formatDate(summary.lastPayment.failedAt)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              Dúvidas sobre cobrança? Fale com nosso suporte respondendo qualquer email da UTOP.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
