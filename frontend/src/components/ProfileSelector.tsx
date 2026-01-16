'use client';

import React, { useState, useEffect } from 'react';
import { User, ChevronDown, Check, Users, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  isDefault: boolean;
  documentType: 'PF' | 'PJ';
}

interface ProfileSelectorProps {
  profiles: UserProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  onManageProfiles?: () => void;
  variant?: 'dropdown' | 'modal' | 'inline';
  className?: string;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
];

function getAvatarColor(name: string, customColor?: string): string {
  if (customColor) return customColor;
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function ProfileSelector({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onManageProfiles,
  variant = 'dropdown',
  className,
}: ProfileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.profile-selector')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Quem está usando?
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => onSelectProfile(profile.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                selectedProfileId === profile.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
              )}
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold',
                  getAvatarColor(profile.name, profile.color)
                )}
              >
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(profile.name)
                )}
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {profile.name}
                </p>
                <span className="text-xs text-gray-500">
                  {profile.documentType === 'PJ' ? 'Empresa' : 'Pessoa Física'}
                </span>
              </div>
              {selectedProfileId === profile.id && (
                <Check className="w-5 h-5 text-blue-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-black/50', className)}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Selecione o Perfil
              </h2>
              <p className="text-sm text-gray-500">
                Escolha quem vai usar o sistema agora
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {profiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => {
                  onSelectProfile(profile.id);
                }}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                  selectedProfileId === profile.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold',
                    getAvatarColor(profile.name, profile.color)
                  )}
                >
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(profile.name)
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {profile.name}
                  </p>
                  <span className="text-sm text-gray-500">
                    {profile.documentType === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                    {profile.isDefault && ' • Padrão'}
                  </span>
                </div>
                {selectedProfileId === profile.id && (
                  <Check className="w-6 h-6 text-blue-500" />
                )}
              </button>
            ))}
          </div>

          {onManageProfiles && (
            <button
              onClick={onManageProfiles}
              className="w-full flex items-center justify-center gap-2 p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Gerenciar Perfis
            </button>
          )}
        </div>
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div className={cn('profile-selector relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold',
            selectedProfile
              ? getAvatarColor(selectedProfile.name, selectedProfile.color)
              : 'bg-gray-400'
          )}
        >
          {selectedProfile ? (
            selectedProfile.avatar ? (
              <img
                src={selectedProfile.avatar}
                alt={selectedProfile.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getInitials(selectedProfile.name)
            )
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {selectedProfile?.name || 'Selecionar Perfil'}
          </p>
          {selectedProfile && (
            <span className="text-xs text-gray-500">
              {selectedProfile.documentType === 'PJ' ? 'PJ' : 'PF'}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-2">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 uppercase">
              Perfis Cadastrados
            </p>
          </div>
          
          {profiles.map(profile => (
            <button
              key={profile.id}
              onClick={() => {
                onSelectProfile(profile.id);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                selectedProfileId === profile.id && 'bg-blue-50 dark:bg-blue-900/30'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold',
                  getAvatarColor(profile.name, profile.color)
                )}
              >
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(profile.name)
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {profile.name}
                </p>
                <span className="text-xs text-gray-500">
                  {profile.documentType === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                </span>
              </div>
              {selectedProfileId === profile.id && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
              {profile.isDefault && selectedProfileId !== profile.id && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">
                  Padrão
                </span>
              )}
            </button>
          ))}

          {onManageProfiles && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                <button
                  onClick={() => {
                    onManageProfiles();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">Gerenciar Perfis</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileSelector;
