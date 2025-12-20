'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  Bell,
  Plus,
  X,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Users,
  Edit
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  targetPlans?: string[];
  targetTenants?: string[];
  isActive: boolean;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
}

interface AnnouncementFormData {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  targetPlans: string[];
  startsAt: string;
  endsAt: string;
}

const PLANS = ['trial', 'basic', 'plus', 'premium', 'business'];

const TYPE_CONFIG = {
  info: { icon: Info, color: 'bg-blue-100 text-blue-700 border-blue-300', iconColor: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700 border-yellow-300', iconColor: 'text-yellow-500' },
  success: { icon: CheckCircle, color: 'bg-green-100 text-green-700 border-green-300', iconColor: 'text-green-500' },
  error: { icon: AlertCircle, color: 'bg-red-100 text-red-700 border-red-300', iconColor: 'text-red-500' },
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    message: '',
    type: 'info',
    targetPlans: [],
    startsAt: new Date().toISOString().split('T')[0],
    endsAt: '',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/admin/announcements');
      if (response.data.success) {
        setAnnouncements(response.data.data);
      }
    } catch (error) {
      toast.error('Erro ao carregar anúncios');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      type: 'info',
      targetPlans: [],
      startsAt: new Date().toISOString().split('T')[0],
      endsAt: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post('/admin/announcements', {
        ...formData,
        startsAt: new Date(formData.startsAt),
        endsAt: formData.endsAt ? new Date(formData.endsAt) : null,
        targetPlans: formData.targetPlans.length > 0 ? formData.targetPlans : null,
      });
      
      toast.success('Anúncio criado!');
      setShowModal(false);
      resetForm();
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao criar anúncio');
    }
  };

  const toggleAnnouncement = async (announcement: Announcement) => {
    try {
      await api.patch(`/admin/announcements/${announcement.id}/toggle`, {
        isActive: !announcement.isActive
      });
      toast.success(`Anúncio ${announcement.isActive ? 'desativado' : 'ativado'}!`);
      fetchAnnouncements();
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C5CE7]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Anúncios do Sistema</h1>
          <p className="text-gray-500">Comunique-se com os usuários</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5]"
        >
          <Plus className="w-5 h-5" />
          Novo Anúncio
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.map((announcement) => {
          const typeConfig = TYPE_CONFIG[announcement.type];
          const TypeIcon = typeConfig.icon;
          
          return (
            <div 
              key={announcement.id} 
              className={`bg-white rounded-lg shadow-sm overflow-hidden border-l-4 ${
                announcement.isActive ? typeConfig.color.split(' ')[2] : 'border-gray-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${announcement.isActive ? typeConfig.color.split(' ')[0] : 'bg-gray-100'}`}>
                    <TypeIcon className={`w-5 h-5 ${announcement.isActive ? typeConfig.iconColor : 'text-gray-400'}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className={`font-semibold ${announcement.isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                        {announcement.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        announcement.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {announcement.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    
                    <p className={`text-sm ${announcement.isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                      {announcement.message}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(announcement.startsAt)}
                        {announcement.endsAt && ` - ${formatDate(announcement.endsAt)}`}
                      </span>
                      {announcement.targetPlans && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {announcement.targetPlans.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAnnouncement(announcement)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title={announcement.isActive ? 'Desativar' : 'Ativar'}
                    >
                      {announcement.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {announcements.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">Nenhum anúncio cadastrado</p>
            <p className="text-sm text-gray-400">Crie um anúncio para comunicar-se com os usuários</p>
          </div>
        )}
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="font-semibold mb-4">Preview de como aparece para o usuário</h3>
        <div className="space-y-3">
          {Object.entries(TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <div key={type} className={`p-4 rounded-lg border ${config.color}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  <div>
                    <p className="font-medium">Título do anúncio ({type})</p>
                    <p className="text-sm opacity-80">Mensagem de exemplo para o tipo {type}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Novo Anúncio</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  placeholder="Título do anúncio"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  rows={3}
                  placeholder="Conteúdo do anúncio"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>).map((type) => {
                    const config = TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type })}
                        className={`p-2 rounded-lg border text-center transition-colors ${
                          formData.type === type
                            ? config.color
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${formData.type === type ? config.iconColor : 'text-gray-400'}`} />
                        <span className="text-xs capitalize">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#6C5CE7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exibir para planos
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((plan) => (
                    <label key={plan} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.targetPlans.includes(plan)}
                        onChange={(e) => {
                          const newPlans = e.target.checked
                            ? [...formData.targetPlans, plan]
                            : formData.targetPlans.filter(p => p !== plan);
                          setFormData({ ...formData, targetPlans: newPlans });
                        }}
                        className="w-4 h-4 text-[#6C5CE7] rounded"
                      />
                      <span className="text-sm capitalize">{plan}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Deixe vazio para exibir para todos
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#6C5CE7] text-white rounded-lg hover:bg-[#5B4BD5]"
                >
                  Criar Anúncio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
