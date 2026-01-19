'use client';

import React, { useEffect, useState } from 'react';
import { User, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  name: string;
  document?: string;
  documentType: 'PF' | 'PJ';
  avatar?: string;
  color?: string;
  isDefault: boolean;
}

interface ProfileSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
  profiles: UserProfile[];
  isLoading?: boolean;
}

export default function ProfileSelectorModal({
  isOpen,
  onClose,
  onSelectProfile,
  profiles,
  isLoading = false,
}: ProfileSelectorModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleSelectProfile = (profile: UserProfile) => {
    // Salvar perfil selecionado no localStorage
    localStorage.setItem('utop_active_profile', profile.id);
    onSelectProfile(profile.id);
    onClose();
  };

  const handleManageProfiles = () => {
    onClose();
    router.push('/dashboard/settings/profiles');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay com blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm" />
      
      {/* Conteúdo */}
      <div className="relative z-10 w-full max-w-4xl px-4">
        {/* Logo ou título */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Quem está usando?</h1>
          <p className="text-gray-400">Selecione seu perfil para continuar</p>
        </div>

        {/* Grid de perfis */}
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelectProfile(profile)}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-300 hover:bg-white/5"
              >
                {/* Avatar */}
                <div className="relative">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="w-28 h-28 rounded-lg object-cover border-2 border-transparent group-hover:border-white transition-all duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-28 h-28 rounded-lg flex items-center justify-center text-white text-4xl font-bold border-2 border-transparent group-hover:border-white transition-all duration-300 group-hover:scale-105"
                      style={{ backgroundColor: profile.color || '#1F4FD8' }}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  {/* Badge de padrão */}
                  {profile.isDefault && (
                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-medium">
                      Padrão
                    </div>
                  )}
                </div>

                {/* Nome */}
                <span className="text-gray-300 group-hover:text-white font-medium text-lg transition-colors">
                  {profile.name}
                </span>

                {/* Documento */}
                {profile.document && (
                  <span className="text-gray-500 text-xs">
                    {profile.documentType}: {profile.document}
                  </span>
                )}
              </button>
            ))}

            {/* Botão de adicionar perfil */}
            <button
              onClick={handleManageProfiles}
              className="group flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-300 hover:bg-white/5"
            >
              <div className="w-28 h-28 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-600 group-hover:border-gray-400 transition-all duration-300">
                <Plus className="w-12 h-12 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <span className="text-gray-500 group-hover:text-gray-400 font-medium text-lg transition-colors">
                Gerenciar
              </span>
            </button>
          </div>
        )}

        {/* Botão de cancelar */}
        <div className="mt-10 text-center">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Continuar sem selecionar
          </button>
        </div>
      </div>
    </div>
  );
}
