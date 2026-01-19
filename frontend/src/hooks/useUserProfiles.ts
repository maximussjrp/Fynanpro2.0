'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  name: string;
  document?: string;
  documentType: 'PF' | 'PJ';
  isDefault: boolean;
  avatar?: string;
  color?: string;
  bankAccounts?: Array<{
    id: string;
    name: string;
    institution: string;
    type: string;
    ownershipPercent: number;
    isPrimaryOwner: boolean;
  }>;
  transactionCount?: number;
  fiscal?: {
    monthlyLimit: number;
    totalIncome: number;
    percentOfLimit: number;
    alertLevel: 'safe' | 'warning' | 'danger' | 'exceeded';
  };
}

interface ProfileSessionData {
  profiles: UserProfile[];
  needsSelection: boolean;
  defaultProfile: UserProfile | null;
}

const STORAGE_KEY = 'utop_active_profile';

export function useUserProfiles() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Recuperar perfil ativo do localStorage
  const getStoredProfileId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  }, []);

  // Salvar perfil ativo no localStorage
  const saveActiveProfileId = useCallback((profileId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, profileId);
    }
  }, []);

  // Buscar perfis do servidor
  const fetchProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar perfis');
      }

      const data = await response.json();
      const fetchedProfiles: UserProfile[] = data.data?.profiles || [];
      
      setProfiles(fetchedProfiles);

      // Verificar se precisa mostrar seleção
      const storedProfileId = getStoredProfileId();
      const storedProfile = fetchedProfiles.find(p => p.id === storedProfileId);

      if (storedProfile) {
        setActiveProfile(storedProfile);
        setNeedsSelection(false);
      } else if (fetchedProfiles.length === 1) {
        // Se só tem um perfil, usar ele automaticamente
        setActiveProfile(fetchedProfiles[0]);
        saveActiveProfileId(fetchedProfiles[0].id);
        setNeedsSelection(false);
      } else if (fetchedProfiles.length > 1) {
        // Se tem mais de um perfil, precisa perguntar
        const defaultProfile = fetchedProfiles.find(p => p.isDefault);
        if (defaultProfile) {
          setActiveProfile(defaultProfile);
          saveActiveProfileId(defaultProfile.id);
        }
        setNeedsSelection(true);
      } else {
        // Nenhum perfil cadastrado
        setActiveProfile(null);
        setNeedsSelection(false);
      }
    } catch (err: any) {
      console.error('Erro ao buscar perfis:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getStoredProfileId, saveActiveProfileId]);

  // Selecionar perfil ativo
  const selectProfile = useCallback((profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setActiveProfile(profile);
      saveActiveProfileId(profileId);
      setNeedsSelection(false);
    }
  }, [profiles, saveActiveProfileId]);

  // Criar novo perfil
  const createProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao criar perfil');
      }

      const result = await response.json();
      
      // Recarregar lista de perfis
      await fetchProfiles();
      
      return result.data?.profile;
    } catch (err: any) {
      console.error('Erro ao criar perfil:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Atualizar perfil
  const updateProfile = useCallback(async (profileId: string, data: Partial<UserProfile>) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao atualizar perfil');
      }

      const result = await response.json();
      
      // Atualizar lista local
      await fetchProfiles();
      
      return result.data?.profile;
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Deletar perfil
  const deleteProfile = useCallback(async (profileId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao deletar perfil');
      }

      // Se o perfil deletado era o ativo, limpar seleção
      if (activeProfile?.id === profileId) {
        localStorage.removeItem(STORAGE_KEY);
        setActiveProfile(null);
      }

      // Recarregar lista
      await fetchProfiles();
    } catch (err: any) {
      console.error('Erro ao deletar perfil:', err);
      throw err;
    }
  }, [activeProfile, fetchProfiles]);

  // Definir perfil como padrão
  const setDefaultProfile = useCallback(async (profileId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}/set-default`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao definir perfil padrão');
      }

      // Recarregar lista
      await fetchProfiles();
    } catch (err: any) {
      console.error('Erro ao definir perfil padrão:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Vincular conta bancária
  const linkBankAccount = useCallback(async (
    profileId: string, 
    bankAccountId: string, 
    ownershipPercent: number = 100,
    isPrimaryOwner: boolean = true
  ) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}/bank-accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bankAccountId, ownershipPercent, isPrimaryOwner }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao vincular conta bancária');
      }

      // Recarregar lista
      await fetchProfiles();
    } catch (err: any) {
      console.error('Erro ao vincular conta bancária:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Desvincular conta bancária
  const unlinkBankAccount = useCallback(async (profileId: string, bankAccountId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}/bank-accounts/${bankAccountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao desvincular conta bancária');
      }

      // Recarregar lista
      await fetchProfiles();
    } catch (err: any) {
      console.error('Erro ao desvincular conta bancária:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Upload de avatar
  const uploadAvatar = useCallback(async (profileId: string, avatarBase64: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}/avatar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar: avatarBase64 }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao atualizar avatar');
      }

      const result = await response.json();
      
      // Recarregar lista de perfis
      await fetchProfiles();
      
      return result.data?.profile;
    } catch (err: any) {
      console.error('Erro ao fazer upload de avatar:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Remover avatar
  const removeAvatar = useCallback(async (profileId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profiles/${profileId}/avatar`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erro ao remover avatar');
      }

      // Recarregar lista
      await fetchProfiles();
    } catch (err: any) {
      console.error('Erro ao remover avatar:', err);
      throw err;
    }
  }, [fetchProfiles]);

  // Carregar perfis ao montar
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Navegar para gerenciamento de perfis
  const goToProfileManagement = useCallback(() => {
    router.push('/configuracoes/perfis');
  }, [router]);

  return {
    // Estado
    profiles,
    activeProfile,
    activeProfileId: activeProfile?.id || null,
    needsSelection,
    isLoading,
    error,
    
    // Ações
    selectProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefaultProfile,
    linkBankAccount,
    unlinkBankAccount,
    uploadAvatar,
    removeAvatar,
    fetchProfiles,
    goToProfileManagement,
    
    // Helpers
    hasMultipleProfiles: profiles.length > 1,
    hasNoProfiles: profiles.length === 0,
  };
}

export default useUserProfiles;
