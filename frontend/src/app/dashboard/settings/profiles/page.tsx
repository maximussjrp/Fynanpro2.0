'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Plus,
  Edit2,
  Trash2,
  Star,
  Building2,
  Users,
  Wallet,
  AlertTriangle,
  Check,
  X,
  Link as LinkIcon,
  ArrowLeft,
} from 'lucide-react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { cn } from '@/lib/utils';
import AvatarUpload from '@/components/AvatarUpload';
import { toast } from 'sonner';

const AVATAR_COLORS = [
  { value: 'bg-blue-500', label: 'Azul', color: '#3b82f6' },
  { value: 'bg-green-500', label: 'Verde', color: '#22c55e' },
  { value: 'bg-purple-500', label: 'Roxo', color: '#a855f7' },
  { value: 'bg-pink-500', label: 'Rosa', color: '#ec4899' },
  { value: 'bg-orange-500', label: 'Laranja', color: '#f97316' },
  { value: 'bg-teal-500', label: 'Turquesa', color: '#14b8a6' },
  { value: 'bg-indigo-500', label: 'Índigo', color: '#6366f1' },
  { value: 'bg-red-500', label: 'Vermelho', color: '#ef4444' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function formatCPF(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
}

function formatCNPJ(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
}

export default function ProfilesPage() {
  const router = useRouter();
  const {
    profiles,
    activeProfile,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    selectProfile,
    uploadAvatar,
    removeAvatar,
  } = useUserProfiles();

  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    documentType: 'PF' as 'PF' | 'PJ',
    color: 'bg-blue-500',
    isDefault: false,
    avatar: '' as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({
      name: '',
      document: '',
      documentType: 'PF',
      color: 'bg-blue-500',
      isDefault: false,
      avatar: null,
    });
    setEditingProfile(null);
    setFormError(null);
  };

  const openEditForm = (profile: any) => {
    setFormData({
      name: profile.name,
      document: profile.document || '',
      documentType: profile.documentType,
      color: profile.color || 'bg-blue-500',
      isDefault: profile.isDefault,
      avatar: profile.avatar || null,
    });
    setEditingProfile(profile);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      // Preparar dados para envio (converter null para undefined)
      const submitData = {
        ...formData,
        avatar: formData.avatar || undefined,
      };
      
      if (editingProfile) {
        await updateProfile(editingProfile.id, submitData);
      } else {
        await createProfile(submitData);
      }
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (profileId: string) => {
    try {
      await deleteProfile(profileId);
      setDeleteConfirm(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSetDefault = async (profileId: string) => {
    try {
      await setDefaultProfile(profileId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDocument = (value: string) => {
    if (formData.documentType === 'PJ') {
      return formatCNPJ(value);
    }
    return formatCPF(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Perfis de Usuário
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Gerencie os perfis da sua conta (ex: você, cônjuge, empresa)
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Novo Perfil</span>
          </button>
        </div>

        {/* ⚠️ MÓDULO SUSPENSO */}
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-amber-900">
                ⚠️ Módulo e-Financeira / Perfis Fiscais SUSPENSO
              </h3>
              <p className="text-sm text-amber-800 mt-1">
                Este módulo está temporariamente desativado para revisão por inconsistências
                no cálculo do limite mensal e da projeção. <strong>Ninguém deve mexer ou editar
                este módulo sem autorização do Max.</strong> Os monitoramentos fiscais e o widget
                do dashboard estão pausados — os dados de perfis permanecem preservados.
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                Por que criar perfis?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Os perfis permitem separar suas finanças por pessoa (você, cônjuge) ou por CNPJ.
                O sistema monitora automaticamente os limites fiscais do PIX (R$ 5.000/mês para PF, R$ 15.000/mês para PJ)
                por CPF/CNPJ, não por conta.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Profiles List */}
        <div className="space-y-4">
          {profiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Nenhum perfil cadastrado
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crie seu primeiro perfil para começar a organizar suas finanças por pessoa.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Criar Primeiro Perfil
              </button>
            </div>
          ) : (
            profiles.map(profile => (
              <div
                key={profile.id}
                className={cn(
                  'bg-white dark:bg-gray-800 rounded-xl p-6 border-2 transition-all',
                  activeProfile?.id === profile.id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    className={cn(
                      'w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0',
                      profile.color || 'bg-blue-500'
                    )}
                  >
                    {getInitials(profile.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {profile.name}
                      </h3>
                      {profile.isDefault && (
                        <span className="flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                          <Star className="w-3 h-3" />
                          Padrão
                        </span>
                      )}
                      {activeProfile?.id === profile.id && (
                        <span className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Ativo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {profile.documentType === 'PJ' ? (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          Pessoa Jurídica
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          Pessoa Física
                        </span>
                      )}
                      {profile.document && (
                        <span className="font-mono">
                          {profile.documentType === 'PJ'
                            ? formatCNPJ(profile.document)
                            : formatCPF(profile.document)}
                        </span>
                      )}
                    </div>

                    {/* Fiscal Alert */}
                    {profile.fiscal && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Movimentação PIX este mês
                          </span>
                          <span className={cn(
                            'text-sm font-medium',
                            profile.fiscal.alertLevel === 'exceeded' ? 'text-red-600' :
                            profile.fiscal.alertLevel === 'danger' ? 'text-red-500' :
                            profile.fiscal.alertLevel === 'warning' ? 'text-yellow-600' :
                            'text-green-600'
                          )}>
                            R$ {profile.fiscal.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {' / '}
                            R$ {profile.fiscal.monthlyLimit.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={cn(
                              'h-2 rounded-full transition-all',
                              profile.fiscal.alertLevel === 'exceeded' ? 'bg-red-600' :
                              profile.fiscal.alertLevel === 'danger' ? 'bg-red-500' :
                              profile.fiscal.alertLevel === 'warning' ? 'bg-yellow-500' :
                              'bg-green-500'
                            )}
                            style={{ width: `${Math.min(profile.fiscal.percentOfLimit, 100)}%` }}
                          />
                        </div>
                        {profile.fiscal.alertLevel !== 'safe' && (
                          <div className="flex items-center gap-1 mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                            <AlertTriangle className="w-4 h-4" />
                            {profile.fiscal.alertLevel === 'exceeded'
                              ? 'Limite de monitoramento ultrapassado'
                              : profile.fiscal.alertLevel === 'danger'
                              ? 'Atenção: próximo do limite de R$ 5.000'
                              : 'Aviso: 50% do limite atingido'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bank Accounts */}
                    {profile.bankAccounts && profile.bankAccounts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {profile.bankAccounts.map((account: any) => (
                          <span
                            key={account.id}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full"
                          >
                            <Wallet className="w-3 h-3" />
                            {account.name}
                            {account.ownershipPercent < 100 && (
                              <span className="text-gray-400">({account.ownershipPercent}%)</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {activeProfile?.id !== profile.id && (
                      <button
                        onClick={() => selectProfile(profile.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Usar este perfil"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    )}
                    {!profile.isDefault && (
                      <button
                        onClick={() => handleSetDefault(profile.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
                        title="Definir como padrão"
                      >
                        <Star className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(profile)}
                      className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Editar perfil"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {profiles.length > 1 && (
                      <button
                        onClick={() => setDeleteConfirm(profile.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Excluir perfil"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === profile.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Tem certeza que deseja excluir este perfil?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João Silva"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Tipo de Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="documentType"
                        value="PF"
                        checked={formData.documentType === 'PF'}
                        onChange={() => setFormData({ ...formData, documentType: 'PF', document: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Pessoa Física (CPF)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="documentType"
                        value="PJ"
                        checked={formData.documentType === 'PJ'}
                        onChange={() => setFormData({ ...formData, documentType: 'PJ', document: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700 dark:text-gray-300">Pessoa Jurídica (CNPJ)</span>
                    </label>
                  </div>
                </div>

                {/* Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.documentType === 'PJ' ? 'CNPJ' : 'CPF'} (opcional)
                  </label>
                  <input
                    type="text"
                    value={formatDocument(formData.document)}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, document: value });
                    }}
                    placeholder={formData.documentType === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    maxLength={formData.documentType === 'PJ' ? 18 : 14}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.documentType === 'PF'
                      ? 'Limite PIX monitorado: R$ 5.000/mês'
                      : 'Limite PIX monitorado: R$ 15.000/mês'}
                  </p>
                </div>

                {/* Foto de Perfil */}
                {editingProfile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Foto de Perfil
                    </label>
                    <AvatarUpload
                      currentAvatar={formData.avatar}
                      name={formData.name || 'Perfil'}
                      color={AVATAR_COLORS.find(c => c.value === formData.color)?.color || '#3b82f6'}
                      onUpload={async (base64) => {
                        await uploadAvatar(editingProfile.id, base64);
                        setFormData({ ...formData, avatar: base64 });
                        toast.success('Foto atualizada!');
                      }}
                      onRemove={async () => {
                        await removeAvatar(editingProfile.id);
                        setFormData({ ...formData, avatar: null });
                        toast.success('Foto removida!');
                      }}
                      size="lg"
                    />
                  </div>
                )}

                {/* Cor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cor do Avatar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_COLORS.map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: value })}
                        className={cn(
                          'w-10 h-10 rounded-full border-2 transition-all',
                          formData.color === value
                            ? 'border-gray-900 dark:border-white scale-110'
                            : 'border-transparent hover:scale-105'
                        )}
                        style={{ backgroundColor: color }}
                        title={label}
                      />
                    ))}
                  </div>
                </div>

                {/* Padrão */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
                    Definir como perfil padrão
                  </label>
                </div>

                {/* Error */}
                {formError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    disabled={isSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formData.name}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Salvando...' : editingProfile ? 'Salvar' : 'Criar Perfil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
