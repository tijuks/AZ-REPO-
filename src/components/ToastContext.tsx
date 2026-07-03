import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle2, Info, AlertTriangle, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border text-xs font-medium backdrop-blur-md ${getToastStyles(toast.type)}`}
          >
            {getToastIcon(toast.type)}
            <div className="flex-1 text-slate-100 leading-normal font-sans">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded-md hover:bg-slate-800/50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function getToastStyles(type: ToastType): string {
  switch (type) {
    case 'success':
      return 'bg-slate-900/95 border-emerald-500/30 text-emerald-400 shadow-lg';
    case 'error':
      return 'bg-slate-900/95 border-rose-500/30 text-rose-400 shadow-lg';
    case 'warning':
      return 'bg-slate-900/95 border-amber-500/30 text-amber-400 shadow-lg';
    case 'info':
    default:
      return 'bg-slate-900/95 border-indigo-500/30 text-indigo-400 shadow-lg';
  }
}

function getToastIcon(type: ToastType) {
  const size = "h-5 w-5 shrink-0";
  switch (type) {
    case 'success':
      return <CheckCircle2 className={`${size} text-emerald-400`} />;
    case 'error':
      return <AlertCircle className={`${size} text-rose-400`} />;
    case 'warning':
      return <AlertTriangle className={`${size} text-amber-400`} />;
    case 'info':
    default:
      return <Info className={`${size} text-indigo-400`} />;
  }
}
