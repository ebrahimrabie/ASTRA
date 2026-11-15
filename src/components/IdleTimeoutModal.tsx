import { useNavigate } from 'react-router-dom';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';

export function IdleTimeoutModal() {
  const navigate = useNavigate();
  const {
    idleCountdownSeconds,
    staySignedIn,
    offlineQueue,
    isOfflineSim,
    signOutAfterSync,
    signOutLocal,
  } = useAstra();
  const { t, formatNum } = useI18n();

  if (idleCountdownSeconds === null) return null;

  const entryPhrase =
    offlineQueue.length === 1
      ? t('idle.entryPhraseSingle')
      : t('idle.entryPhrasePlural');

  return (
    <div className="modal-overlay">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idle-timeout-title"
      >
        <h2 id="idle-timeout-title">{t('idle.title')}</h2>
        <p className="muted-text tabular-nums">
          {t('idle.countdownText', { seconds: formatNum(idleCountdownSeconds) })}
        </p>

        {offlineQueue.length > 0 && (
          <div className="banner" role="alert">
            {t('idle.queueBanner', {
              count: formatNum(offlineQueue.length),
              entryPhrase,
            })}
          </div>
        )}

        <div className="form-stack">
          <button
            type="button"
            className="btn btn-primary"
            onClick={staySignedIn}
          >
            {t('idle.staySignedIn')}
          </button>

          {offlineQueue.length > 0 && !isOfflineSim ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void signOutAfterSync().then((res) => {
                  if (res.ok) navigate('/login', { replace: true });
                });
              }}
            >
              {t('idle.syncThenSignOut')}
            </button>
          ) : null}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void signOutLocal({ exportQueueFirst: offlineQueue.length > 0 }).then(() =>
                navigate('/login', { replace: true })
              );
            }}
          >
            {offlineQueue.length > 0 ? t('idle.exportAndSignOut') : t('idle.signOutNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
