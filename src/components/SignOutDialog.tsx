import { useEffect, useRef, useState } from 'react';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';

interface SignOutDialogProps {
  open: boolean;
  onClose: () => void;
  onSignedOut: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function SignOutDialog({
  open,
  onClose,
  onSignedOut,
  triggerRef,
}: SignOutDialogProps) {
  const {
    offlineQueue,
    isOfflineSim,
    signOutLocal,
    signOutAfterSync,
  } = useAstra();
  const { t, formatNum } = useI18n();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    primaryBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        triggerRef?.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  const hasQueue = offlineQueue.length > 0;
  const closeAndReturnFocus = () => {
    onClose();
    window.setTimeout(() => triggerRef?.current?.focus(), 0);
  };

  const handleSyncAndSignOut = async () => {
    setBusy(true);
    setError(null);
    const res = await signOutAfterSync();
    setBusy(false);
    if (res.ok) {
      onClose();
      onSignedOut();
    } else {
      setError(res.error || t('errors.API_UNREACHABLE'));
    }
  };

  const handleExportAndSignOut = async () => {
    setBusy(true);
    setError(null);
    await signOutLocal({ exportQueueFirst: true });
    setBusy(false);
    onClose();
    onSignedOut();
  };

  const handleDiscardAndSignOut = async () => {
    setBusy(true);
    setError(null);
    await signOutLocal();
    setBusy(false);
    onClose();
    onSignedOut();
  };

  const entryWord =
    offlineQueue.length === 1 ? t('signout.entrySingle') : t('signout.entryPlural');

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          closeAndReturnFocus();
        }
      }}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-dialog-title"
      >
        <h2 id="signout-dialog-title">{t('signout.title')}</h2>

        {hasQueue ? (
          <>
            <div className="banner" role="alert">
              {t('signout.queueWarning', {
                count: formatNum(offlineQueue.length),
                entryWord,
              })}
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-stack">
              {!isOfflineSim && (
                <button
                  ref={primaryBtnRef}
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void handleSyncAndSignOut()}
                >
                  {busy ? t('signout.syncing') : t('signout.syncAndSignOut')}
                </button>
              )}
              <button
                ref={isOfflineSim ? primaryBtnRef : undefined}
                type="button"
                className={isOfflineSim ? 'btn btn-primary' : 'btn btn-secondary'}
                disabled={busy}
                onClick={() => void handleExportAndSignOut()}
              >
                {t('signout.exportAndSignOut')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void handleDiscardAndSignOut()}
              >
                {t('signout.discardAndSignOut')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={closeAndReturnFocus}
              >
                {t('signout.cancel')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted-text">{t('signout.body')}</p>
            <div className="btn-row">
              <button
                ref={primaryBtnRef}
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void handleDiscardAndSignOut()}
              >
                {busy ? t('signout.signingOut') : t('signout.confirm')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={closeAndReturnFocus}
              >
                {t('signout.cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
