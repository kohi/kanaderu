import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message?: string;
  detail?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl shadow-lg border p-4 backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-rose-50/95 border-rose-200 text-rose-950'
              : toast.type === 'warning'
              ? 'bg-amber-50/95 border-amber-200 text-amber-950'
              : toast.type === 'success'
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
              : 'bg-indigo-50/95 border-indigo-200 text-indigo-950'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600" />}
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600" />}
            </div>

            <div className="flex-1 text-sm">
              <div className="font-semibold">{toast.title}</div>
              {toast.message && <div className="mt-0.5 opacity-90">{toast.message}</div>}
              {toast.detail && (
                <details className="mt-2 text-xs opacity-75 font-mono bg-black/5 p-2 rounded">
                  <summary className="cursor-pointer font-sans font-medium mb-1">エラー詳細</summary>
                  <pre className="whitespace-pre-wrap overflow-x-auto">{toast.detail}</pre>
                </details>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 p-1 rounded-lg hover:bg-black/5 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
