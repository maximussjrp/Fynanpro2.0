'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  name: string;
  color: string;
  onUpload: (base64: string) => Promise<void>;
  onRemove?: () => Promise<void>;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';
}

export default function AvatarUpload({
  currentAvatar,
  name,
  color,
  onUpload,
  onRemove,
  size = 'md',
}: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'w-16 h-16 text-xl',
    md: 'w-24 h-24 text-3xl',
    lg: 'w-32 h-32 text-4xl',
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 2MB.');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Converter para base64 e redimensionar
      const base64 = await resizeAndConvert(file, 200, 200);
      await onUpload(base64);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
    } finally {
      setIsUploading(false);
      // Limpar input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resizeAndConvert = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Calcular novo tamanho mantendo proporção
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Erro ao processar imagem'));
            return;
          }

          // Desenhar imagem redimensionada
          ctx.drawImage(img, 0, 0, width, height);

          // Converter para base64 com compressão
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(base64);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setIsUploading(true);
    try {
      await onRemove();
    } catch (err: any) {
      setError(err.message || 'Erro ao remover avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar Container */}
      <div className="relative group">
        {/* Avatar atual ou iniciais */}
        {currentAvatar ? (
          <img
            src={currentAvatar}
            alt={name}
            className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-200 dark:border-gray-600`}
          />
        ) : (
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold`}
            style={{ backgroundColor: color || '#1F4FD8' }}
          >
            {getInitials(name)}
          </div>
        )}

        {/* Overlay de hover */}
        {!isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Loading */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {/* Botão de remover */}
        {currentAvatar && !isUploading && onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-1 -right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Input file escondido */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Texto de ação */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
      >
        {currentAvatar ? 'Alterar foto' : 'Adicionar foto'}
      </button>

      {/* Erro */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
