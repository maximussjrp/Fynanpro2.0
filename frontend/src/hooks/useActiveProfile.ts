'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserProfile {
  id: string;
  name: string;
  document?: string;
  documentType: 'PF' | 'PJ';
  avatar?: string;
  color?: string;
  isDefault: boolean;
}

const ACTIVE_PROFILE_KEY = 'utop_active_profile';

export function useActiveProfile() {
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar perfil ativo do localStorage
  useEffect(() => {
    const storedProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (storedProfileId) {
      setActiveProfileId(storedProfileId);
    }
    setIsLoading(false);
  }, []);

  // Buscar dados do perfil ativo
  useEffect(() => {
    const fetchActiveProfile = async () => {
      if (!activeProfileId) {
        setActiveProfile(null);
        return;
      }

      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/profiles/${activeProfileId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const profile = await response.json();
          setActiveProfile(profile);
        } else {
          // Se o perfil não for encontrado, limpar
          localStorage.removeItem(ACTIVE_PROFILE_KEY);
          setActiveProfileId(null);
          setActiveProfile(null);
        }
      } catch (error) {
        console.error('Erro ao buscar perfil ativo:', error);
      }
    };

    fetchActiveProfile();
  }, [activeProfileId]);

  // Definir perfil ativo
  const setActiveProfileById = useCallback((profileId: string | null) => {
    if (profileId) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
    } else {
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
    setActiveProfileId(profileId);
  }, []);

  // Limpar perfil ativo (logout)
  const clearActiveProfile = useCallback(() => {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    setActiveProfileId(null);
    setActiveProfile(null);
  }, []);

  return {
    activeProfileId,
    activeProfile,
    isLoading,
    setActiveProfile: setActiveProfileById,
    clearActiveProfile,
  };
}
