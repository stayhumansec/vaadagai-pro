import type { ReactNode } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  const { t } = useLanguage();
  return (
    <div
      className="animate-overlay-in fixed inset-0 z-40 flex items-center justify-center bg-navy/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-modal-in flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-gray-3 bg-white/95 px-4 py-3 backdrop-blur">
          <h3 className="font-semibold tracking-tight text-navy">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray transition-colors hover:bg-gray-4 hover:text-navy"
            aria-label={t('modal.close')}
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-3 bg-gray-4/40 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
