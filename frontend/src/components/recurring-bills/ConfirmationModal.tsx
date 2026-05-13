'use client';

import { X, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  loading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-600',
          iconBg: 'bg-red-100',
          button: 'bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:shadow-lg',
        };
      case 'warning':
        return {
          icon: 'text-yellow-600',
          iconBg: 'bg-yellow-100',
          button: 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:shadow-lg',
        };
      case 'info':
        return {
          icon: 'text-[#1F4FD8]',
          iconBg: 'bg-[#DBEAFE]',
          button: 'bg-gradient-to-r from-[#1F4FD8] to-[#1A44BF] hover:shadow-lg',
        };
      default:
        return {
          icon: 'text-red-600',
          iconBg: 'bg-red-100',
          button: 'bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:shadow-lg',
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${colors.iconBg} flex items-center justify-center`}>
              <AlertCircle className={`w-5 h-5 ${colors.icon}`} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 bg-[#F9FAFB] border-t border-gray-200">
          <Button
            onClick={onClose}
            disabled={loading}
            variant="secondary"
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            variant={type === 'danger' ? 'danger' : 'primary'}
            className="flex-1"
          >
            {loading ? 'Processando...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
