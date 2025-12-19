'use client';

import { useState, useEffect } from 'react';
import { Shield, Download, Trash2, Check, X, FileText, Lock, Eye, UserX, Database, Mail } from 'lucide-react';

interface PolicySection {
  title: string;
  content: string;
}

interface PolicyData {
  version: string;
  lastUpdated: string;
  company: {
    name: string;
    dpoEmail: string;
  };
  sections: PolicySection[];
  rights: Array<{
    code: string;
    name: string;
    endpoint: string;
  }>;
}

interface Consent {
  id: string;
  type: string;
  accepted: boolean;
  acceptedAt: string | null;
  version: string;
}

export default function PrivacidadePage() {
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'policy' | 'rights' | 'consents'>('policy');
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchPolicy();
    fetchConsents();
  }, []);

  const fetchPolicy = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/policy`);
      const data = await res.json();
      setPolicy(data);
    } catch (error) {
      console.error('Erro ao carregar política:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsents = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/consents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConsents(data.active || []);
    } catch (error) {
      console.error('Erro ao carregar consentimentos:', error);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      // Download como arquivo
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'EXCLUIR MINHA CONTA') {
      alert('Digite exatamente: EXCLUIR MINHA CONTA');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/account`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: deleteConfirm }),
      });

      if (res.ok) {
        localStorage.removeItem('token');
        window.location.href = '/login?deleted=true';
      } else {
        const error = await res.json();
        alert(error.message || 'Erro ao excluir conta');
      }
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      alert('Erro ao excluir conta. Tente novamente.');
    }
  };

  const handleToggleConsent = async (type: string, currentState: boolean) => {
    try {
      const token = localStorage.getItem('token');
      
      if (currentState) {
        // Revogar
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/consents/${type}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Aceitar
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/lgpd/consents`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            version: policy?.version || '1.0.0',
            accepted: true,
          }),
        });
      }
      
      fetchConsents();
    } catch (error) {
      console.error('Erro ao atualizar consentimento:', error);
    }
  };

  const consentLabels: Record<string, { label: string; description: string; required: boolean }> = {
    terms_of_use: {
      label: 'Termos de Uso',
      description: 'Aceite obrigatório para usar o sistema',
      required: true,
    },
    privacy_policy: {
      label: 'Política de Privacidade',
      description: 'Aceite obrigatório para usar o sistema',
      required: true,
    },
    marketing: {
      label: 'Comunicações de Marketing',
      description: 'Receber novidades, promoções e dicas por e-mail',
      required: false,
    },
    data_sharing: {
      label: 'Compartilhamento de Dados',
      description: 'Permitir análises agregadas para melhorar o serviço',
      required: false,
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Shield className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Privacidade e Proteção de Dados</h1>
              <p className="text-gray-400">
                Conforme Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex border-b border-gray-700 mt-6">
          <button
            onClick={() => setActiveTab('policy')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'policy'
                ? 'text-green-500 border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Política de Privacidade
          </button>
          <button
            onClick={() => setActiveTab('rights')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'rights'
                ? 'text-green-500 border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Meus Direitos
          </button>
          <button
            onClick={() => setActiveTab('consents')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'consents'
                ? 'text-green-500 border-b-2 border-green-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Check className="w-4 h-4 inline mr-2" />
            Consentimentos
          </button>
        </div>

        {/* Content */}
        <div className="py-8">
          {/* Política de Privacidade */}
          {activeTab === 'policy' && policy && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-gray-400">Versão:</span> {policy.version}
                  <span className="mx-4 text-gray-600">|</span>
                  <span className="text-gray-400">Atualizado em:</span> {policy.lastUpdated}
                </div>
                <a
                  href={`mailto:${policy.company.dpoEmail}`}
                  className="text-green-500 hover:text-green-400 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Contato DPO
                </a>
              </div>

              {policy.sections.map((section, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-green-500 mb-4">{section.title}</h2>
                  <p className="text-gray-300 whitespace-pre-line">{section.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Meus Direitos */}
          {activeTab === 'rights' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  Direito de Acesso e Portabilidade
                </h2>
                <p className="text-gray-400 mb-4">
                  Você pode exportar todos os seus dados pessoais em formato JSON a qualquer momento.
                </p>
                <button
                  onClick={handleExportData}
                  disabled={exportLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exportLoading ? 'Exportando...' : 'Exportar Meus Dados'}
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  Dados que Armazenamos
                </h2>
                <ul className="text-gray-400 space-y-2">
                  <li>• Informações de perfil (nome, e-mail, telefone)</li>
                  <li>• Transações financeiras que você cadastrou</li>
                  <li>• Contas bancárias e categorias personalizadas</li>
                  <li>• Histórico de consentimentos</li>
                  <li>• Logs de acesso (IP, navegador, data/hora)</li>
                </ul>
              </div>

              <div className="bg-red-900/20 border border-red-900 rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-500">
                  <UserX className="w-5 h-5" />
                  Direito à Eliminação (Exclusão de Conta)
                </h2>
                <p className="text-gray-400 mb-4">
                  Você pode solicitar a exclusão de sua conta e anonimização de todos os seus dados.
                  Esta ação é <strong>irreversível</strong>.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Minha Conta
                </button>
              </div>
            </div>
          )}

          {/* Consentimentos */}
          {activeTab === 'consents' && (
            <div className="space-y-4">
              <p className="text-gray-400 mb-6">
                Gerencie seus consentimentos. Consentimentos obrigatórios não podem ser revogados
                enquanto sua conta estiver ativa.
              </p>

              {Object.entries(consentLabels).map(([type, info]) => {
                const consent = consents.find((c) => c.type === type);
                const isAccepted = consent?.accepted || false;

                return (
                  <div
                    key={type}
                    className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {info.label}
                        {info.required && (
                          <span className="text-xs bg-yellow-600/20 text-yellow-500 px-2 py-0.5 rounded">
                            Obrigatório
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-400">{info.description}</p>
                      {consent?.acceptedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Aceito em: {new Date(consent.acceptedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleConsent(type, isAccepted)}
                      disabled={info.required && isAccepted}
                      className={`p-2 rounded-lg transition-colors ${
                        isAccepted
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-gray-700 text-gray-400'
                      } ${info.required && isAccepted ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                    >
                      {isAccepted ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <Trash2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Excluir Conta</h2>
            </div>
            
            <div className="bg-red-900/20 border border-red-900 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-400">
                <strong>⚠️ Atenção:</strong> Esta ação é irreversível. Todos os seus dados serão
                anonimizados e sua conta será permanentemente desativada.
              </p>
            </div>

            <p className="text-gray-400 mb-4">
              Para confirmar, digite exatamente: <code className="text-red-500">EXCLUIR MINHA CONTA</code>
            </p>

            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Digite a confirmação"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-red-500"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'EXCLUIR MINHA CONTA'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
