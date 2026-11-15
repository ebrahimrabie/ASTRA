import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

interface DeferModalProps {
  taskName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function DeferModal({ taskName, onCancel, onConfirm }: DeferModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel]);

  const trimmed = reason.trim();
  const canConfirm = trimmed.length > 0 && trimmed.length <= 300;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="defer-modal-title"
      >
        <h2 id="defer-modal-title">{t('defer.title')}</h2>
        <p className="muted-text">{t('defer.taskLabel', { name: taskName })}</p>

        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) {
              onConfirm(trimmed);
            }
          }}
        >
          <div className="field">
            <label htmlFor="defer-reason-input">{t('defer.reasonLabel')}</label>
            <textarea
              ref={textareaRef}
              id="defer-reason-input"
              className="textarea"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('defer.reasonPlaceholder')}
              required
            />
          </div>

          <div className="btn-row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canConfirm}
            >
              {t('defer.confirm')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              {t('defer.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
