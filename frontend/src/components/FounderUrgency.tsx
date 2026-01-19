'use client';

import { useState, useEffect } from 'react';
import { X, Users, Flame, Clock, CheckCircle } from 'lucide-react';

// Nomes fictícios para criar FOMO
const FAKE_NAMES = [
  'Maria S.', 'João P.', 'Ana L.', 'Carlos M.', 'Fernanda R.',
  'Pedro H.', 'Juliana C.', 'Lucas A.', 'Beatriz F.', 'Rafael O.',
  'Camila B.', 'Gustavo N.', 'Larissa T.', 'Thiago V.', 'Amanda G.',
  'Bruno K.', 'Isabela D.', 'Rodrigo E.', 'Patrícia W.', 'Diego S.'
];

const CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre',
  'Brasília', 'Salvador', 'Fortaleza', 'Recife', 'Goiânia'
];

interface FounderData {
  available: boolean;
  remaining: number;
  total: number;
}

export function FounderBanner() {
  const [founderData, setFounderData] = useState<FounderData | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchFounderSlots();
    const interval = setInterval(fetchFounderSlots, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchFounderSlots = async () => {
    try {
      const res = await fetch('https://api.utopsistema.com.br/api/v1/subscription/stripe/founder-slots');
      const data = await res.json();
      if (data.success) {
        setFounderData(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
    }
  };

  if (!isVisible || !founderData || !founderData.available) return null;

  const urgencyLevel = founderData.remaining <= 5 ? 'critical' : founderData.remaining <= 10 ? 'high' : 'normal';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] ${
      urgencyLevel === 'critical' ? 'bg-gradient-to-r from-red-600 to-red-500' :
      urgencyLevel === 'high' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' :
      'bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A]'
    } text-white py-2.5 px-4 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm md:text-base">
        <Flame className={`w-5 h-5 ${urgencyLevel === 'critical' ? 'animate-pulse' : ''}`} />
        <span className="font-medium">
          🏆 <strong>Oferta Fundador:</strong> Apenas{' '}
          <span className={`font-bold ${urgencyLevel === 'critical' ? 'text-yellow-300 animate-pulse' : 'text-[#C9A962]'}`}>
            {founderData.remaining} vagas
          </span>{' '}
          restantes para acesso VITALÍCIO por R$ 197
        </span>
        <a 
          href="/login" 
          className={`ml-2 px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
            urgencyLevel === 'critical' 
              ? 'bg-yellow-400 text-red-900 hover:bg-yellow-300' 
              : 'bg-[#C9A962] text-[#1A1A1A] hover:bg-[#D4B86A]'
          }`}
        >
          Garantir Vaga
        </a>
        <button 
          onClick={() => setIsVisible(false)} 
          className="absolute right-4 p-1 hover:bg-white/20 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function FOMONotifications() {
  const [notification, setNotification] = useState<{ name: string; city: string } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mostra primeira notificação após 5 segundos
    const initialTimeout = setTimeout(() => {
      showRandomNotification();
    }, 5000);

    // Depois mostra a cada 15-30 segundos
    const interval = setInterval(() => {
      showRandomNotification();
    }, Math.random() * 15000 + 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  const showRandomNotification = () => {
    const randomName = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];
    
    setNotification({ name: randomName, city: randomCity });
    setIsVisible(true);

    // Esconde após 4 segundos
    setTimeout(() => setIsVisible(false), 4000);
  };

  if (!isVisible || !notification) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[90] animate-slide-in-left">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 max-w-sm flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            {notification.name} de {notification.city}
          </p>
          <p className="text-xs text-gray-500">
            acabou de garantir o acesso Fundador 🏆
          </p>
        </div>
      </div>
    </div>
  );
}

export function FounderCard({ onSelect, isProcessing }: { onSelect: () => void; isProcessing: boolean }) {
  const [founderData, setFounderData] = useState<FounderData | null>(null);

  useEffect(() => {
    fetchFounderSlots();
  }, []);

  const fetchFounderSlots = async () => {
    try {
      const res = await fetch('https://api.utopsistema.com.br/api/v1/subscription/stripe/founder-slots');
      const data = await res.json();
      if (data.success) {
        setFounderData(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
    }
  };

  if (!founderData || !founderData.available) return null;

  const urgencyLevel = founderData.remaining <= 5 ? 'critical' : founderData.remaining <= 10 ? 'high' : 'normal';

  return (
    <div className={`relative overflow-hidden rounded-2xl p-1 ${
      urgencyLevel === 'critical' 
        ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 animate-pulse'
        : 'bg-gradient-to-r from-[#C9A962] via-[#D4B86A] to-[#C9A962]'
    }`}>
      <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2A] rounded-xl p-6 relative">
        {/* Badge de urgência */}
        <div className={`absolute -top-1 -right-1 px-3 py-1 rounded-bl-xl rounded-tr-xl text-xs font-bold ${
          urgencyLevel === 'critical' ? 'bg-red-500 text-white' : 'bg-[#C9A962] text-[#1A1A1A]'
        }`}>
          {urgencyLevel === 'critical' ? '🔥 ÚLTIMAS VAGAS!' : '🏆 OFERTA LIMITADA'}
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#C9A962] to-[#D4B86A] rounded-xl flex items-center justify-center">
            <span className="text-2xl">👑</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Fundador Vitalício</h3>
            <p className="text-[#C9A962] text-sm">Acesso para sempre</p>
          </div>
        </div>

        {/* Preço */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">R$ 197</span>
            <span className="text-gray-400 line-through">R$ 479</span>
          </div>
          <p className="text-[#C9A962] text-sm font-medium">Pagamento único • Nunca mais paga</p>
        </div>

        {/* Contador de vagas */}
        <div className={`mb-4 p-3 rounded-lg ${
          urgencyLevel === 'critical' ? 'bg-red-500/20 border border-red-500/50' : 'bg-[#C9A962]/10 border border-[#C9A962]/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className={`w-5 h-5 ${urgencyLevel === 'critical' ? 'text-red-400' : 'text-[#C9A962]'}`} />
              <span className="text-white text-sm">Vagas restantes:</span>
            </div>
            <span className={`font-bold text-lg ${urgencyLevel === 'critical' ? 'text-red-400' : 'text-[#C9A962]'}`}>
              {founderData.remaining} de {founderData.total}
            </span>
          </div>
          {/* Barra de progresso */}
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                urgencyLevel === 'critical' ? 'bg-red-500' : 'bg-[#C9A962]'
              }`}
              style={{ width: `${((founderData.total - founderData.remaining) / founderData.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {[
            '♾️ Acesso VITALÍCIO ao sistema',
            '🚀 Todas as funcionalidades premium',
            '📊 Relatórios avançados ilimitados',
            '🤖 IA Assistente incluída',
            '⭐ Suporte VIP prioritário',
            '🎁 Todas as atualizações futuras',
          ].map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
              <CheckCircle className="w-4 h-4 text-[#C9A962] flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>

        {/* Botão */}
        <button
          onClick={onSelect}
          disabled={isProcessing}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            urgencyLevel === 'critical'
              ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600'
              : 'bg-gradient-to-r from-[#C9A962] to-[#D4B86A] text-[#1A1A1A] hover:from-[#D4B86A] hover:to-[#DFC87A]'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <Clock className="w-5 h-5 animate-spin" />
              Processando...
            </span>
          ) : (
            '🔒 Garantir Minha Vaga'
          )}
        </button>

        {/* Garantia */}
        <p className="text-center text-gray-400 text-xs mt-3">
          🔒 Pagamento 100% seguro via Stripe
        </p>
      </div>
    </div>
  );
}

// CSS para animação
const styles = `
@keyframes slide-in-left {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-left {
  animation: slide-in-left 0.5s ease-out;
}
`;

// Injetar CSS
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
