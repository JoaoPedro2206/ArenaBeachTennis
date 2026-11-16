import { useContext } from 'react';
import { ToastContext, type ToastApi } from '@/contexts/ToastContext';

/** toast.success('Salvo!') / toast.error('Falhou') em qualquer componente */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa ser usado dentro de <ToastProvider>');
  return context;
}
