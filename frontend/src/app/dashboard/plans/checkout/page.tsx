'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CreditCard, QrCode, FileText, Check, Copy, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/stores/auth';

interface CheckoutData {
  subscriptionId: string;
  paymentId: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  value: number;
  dueDate: string;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'credit_card'>('pix');
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  // Dados do cartão
  const [cardData, setCardData] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
  });
  
  const [holderInfo, setHolderInfo] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    postalCode: '',
    addressNumber: '',
    phone: '',
  });

  const subscriptionId = searchParams.get('subscriptionId');
  const planId = searchParams.get('planId') || 'plus';
  const billingCycle = searchParams.get('billingCycle') || 'monthly';

  useEffect(() => {
    if (subscriptionId) {
      // Já temos o checkout criado
      fetchCheckoutDetails();
    }
  }, [subscriptionId]);

  const fetchCheckoutDetails = async () => {
    try {
      const response = await api.get('/subscription/current');
      if (response.data.success) {
        const subscription = response.data.data.subscription;
        if (subscription?.payments?.[0]) {
          const payment = subscription.payments[0];
          setCheckoutData({
            subscriptionId: subscription.asaasSubscriptionId,
            paymentId: payment.asaasPaymentId,
            pixQrCodeUrl: payment.pixQrCodeUrl,
            pixCopiaECola: payment.pixCopiaECola,
            bankSlipUrl: payment.boletoUrl,
            invoiceUrl: payment.invoiceUrl,
            value: Number(payment.amount),
            dueDate: payment.dueDate,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar checkout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (checkoutData?.pixCopiaECola) {
      navigator.clipboard.writeText(checkoutData.pixCopiaECola);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCreditCardPayment = async () => {
    if (!cardData.number || !cardData.ccv || !holderInfo.cpfCnpj) {
      alert('Preencha todos os campos');
      return;
    }

    setProcessing(true);
    try {
      const response = await api.post('/subscription/checkout/credit-card', {
        planId,
        billingCycle,
        creditCard: cardData,
        creditCardHolderInfo: holderInfo,
      });

      if (response.data.success && response.data.data.success) {
        alert('Pagamento aprovado! Seu plano foi ativado.');
        router.push('/dashboard');
      } else {
        alert('Pagamento não aprovado. Verifique os dados do cartão.');
      }
    } catch (error: any) {
      console.error('Erro no pagamento:', error);
      alert(error.response?.data?.error?.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.push('/dashboard/plans')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para planos
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-[#6C5CE7] text-white p-6">
            <h1 className="text-2xl font-bold">Finalizar Pagamento</h1>
            {checkoutData && (
              <p className="text-purple-200 mt-2">
                Valor: {formatCurrency(checkoutData.value)}
              </p>
            )}
          </div>

          <div className="p-6">
            {/* Seleção de método */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'pix'
                    ? 'border-[#6C5CE7] bg-[#6C5CE7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <QrCode className="w-6 h-6" />
                <span className="font-medium">PIX</span>
              </button>
              
              <button
                onClick={() => setPaymentMethod('boleto')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'boleto'
                    ? 'border-[#6C5CE7] bg-[#6C5CE7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6" />
                <span className="font-medium">Boleto</span>
              </button>
              
              <button
                onClick={() => setPaymentMethod('credit_card')}
                className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'credit_card'
                    ? 'border-[#6C5CE7] bg-[#6C5CE7]/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="font-medium">Cartão</span>
              </button>
            </div>

            {/* Conteúdo por método */}
            {paymentMethod === 'pix' && checkoutData?.pixCopiaECola && (
              <div className="space-y-6">
                {checkoutData.pixQrCodeUrl && (
                  <div className="flex justify-center">
                    <img 
                      src={checkoutData.pixQrCodeUrl} 
                      alt="QR Code PIX" 
                      className="w-64 h-64 border rounded-lg"
                    />
                  </div>
                )}
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-2">Código PIX Copia e Cola:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={checkoutData.pixCopiaECola}
                      readOnly
                      className="flex-1 bg-white border rounded-lg px-4 py-2 text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyPix}
                      className="flex items-center gap-2 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5b4ed6]"
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 text-sm">
                    ✓ Após o pagamento, seu plano será ativado automaticamente em até 5 minutos.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'boleto' && checkoutData?.bankSlipUrl && (
              <div className="space-y-6">
                <div className="text-center">
                  <a
                    href={checkoutData.bankSlipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5b4ed6]"
                  >
                    <FileText className="w-5 h-5" />
                    Baixar Boleto
                  </a>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    ⏰ O boleto pode levar até 3 dias úteis para ser compensado.
                  </p>
                </div>
              </div>
            )}

            {paymentMethod === 'credit_card' && (
              <div className="space-y-6">
                {/* Dados do cartão */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome no cartão
                    </label>
                    <input
                      type="text"
                      value={cardData.holderName}
                      onChange={(e) => setCardData({ ...cardData, holderName: e.target.value })}
                      placeholder="Como está no cartão"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número do cartão
                    </label>
                    <input
                      type="text"
                      value={cardData.number}
                      onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, '') })}
                      placeholder="0000 0000 0000 0000"
                      maxLength={16}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Validade
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cardData.expiryMonth}
                        onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value.replace(/\D/g, '') })}
                        placeholder="MM"
                        maxLength={2}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                      <input
                        type="text"
                        value={cardData.expiryYear}
                        onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value.replace(/\D/g, '') })}
                        placeholder="AA"
                        maxLength={2}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CVV
                    </label>
                    <input
                      type="text"
                      value={cardData.ccv}
                      onChange={(e) => setCardData({ ...cardData, ccv: e.target.value.replace(/\D/g, '') })}
                      placeholder="123"
                      maxLength={4}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                    />
                  </div>
                </div>

                {/* Dados do titular */}
                <div className="border-t pt-6">
                  <h3 className="font-medium text-gray-900 mb-4">Dados do titular</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CPF
                      </label>
                      <input
                        type="text"
                        value={holderInfo.cpfCnpj}
                        onChange={(e) => setHolderInfo({ ...holderInfo, cpfCnpj: e.target.value.replace(/\D/g, '') })}
                        placeholder="000.000.000-00"
                        maxLength={11}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        value={holderInfo.postalCode}
                        onChange={(e) => setHolderInfo({ ...holderInfo, postalCode: e.target.value.replace(/\D/g, '') })}
                        placeholder="00000-000"
                        maxLength={8}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número
                      </label>
                      <input
                        type="text"
                        value={holderInfo.addressNumber}
                        onChange={(e) => setHolderInfo({ ...holderInfo, addressNumber: e.target.value })}
                        placeholder="123"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="text"
                        value={holderInfo.phone}
                        onChange={(e) => setHolderInfo({ ...holderInfo, phone: e.target.value.replace(/\D/g, '') })}
                        placeholder="11999999999"
                        maxLength={11}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreditCardPayment}
                  disabled={processing}
                  className="w-full py-3 bg-[#6C5CE7] text-white rounded-xl font-semibold hover:bg-[#5b4ed6] disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Pagar agora'
                  )}
                </button>

                <div className="flex items-center justify-center gap-4 text-gray-400 text-sm">
                  <span>🔒 Pagamento seguro</span>
                  <span>•</span>
                  <span>SSL criptografado</span>
                </div>
              </div>
            )}

            {/* Sem dados de pagamento */}
            {!checkoutData && paymentMethod !== 'credit_card' && (
              <div className="text-center py-8 text-gray-500">
                <p>Carregando informações de pagamento...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C5CE7]" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
