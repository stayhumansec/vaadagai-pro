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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between rounded-t-xl border-b border-gray-3 bg-white px-4 py-3">
          <h3 className="font-medium text-navy">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray hover:text-navy" aria-label={t('modal.close')}>
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-3 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
