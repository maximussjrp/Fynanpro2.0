'use client';

import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteMode: 'all' | 'pending') => void;
  recurringName: string;
  paidCount: number;
  pendingCount: number;
}

export default function DeleteRecurringModal({
  isOpen,
  onClose,
  onConfirm,
  recurringName,
  paidCount,
  pendingCount,
}: DeleteRecurringModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Excluir Receita Recorrente
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Você está prestes a excluir a receita recorrente:{' '}
            <span className="font-semibold text-gray-900">{recurringName}</span>
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800 mb-3">
              Esta receita recorrente possui:
            </p>
            <ul className="space-y-2 text-sm">
              {paidCount > 0 && (
                <li className="flex items-center gap-2 text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <strong>{paidCount}</strong> transação(ões) já realizada(s)
                </li>
              )}
              {pendingCount > 0 && (
                <li className="flex items-center gap-2 text-orange-700">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <strong>{pendingCount}</strong> transação(ões) pendente(s)
                </li>
              )}
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            Como deseja proceder?
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-6 border-t border-gray-200">
          {/* Excluir apenas pendentes */}
          <button
            onClick={() => onConfirm('pending')}
            className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir apenas as pendentes
          </button>

          {/* Excluir todas */}
          <button
            onClick={() => onConfirm('all')}
            className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir tudo (incluindo realizadas)
          </button>

          {/* Cancelar */}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all duration-200"
          >
            Cancelar
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
