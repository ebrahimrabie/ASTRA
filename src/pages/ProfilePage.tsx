import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';

export function ProfilePage() {
  const { authUser, mission, isOfflineSim, toggleOfflineSim, offlineQueue } =
    useAstra();
  const { t } = useI18n();
  const connectionBadge = isOfflineSim
    ? 'OFFLINE'
    : offlineQueue.length > 0
      ? 'SYNC PENDING'
      : 'ONLINE';

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('profile.title')}</h1>
          <p className="muted-text">
            {authUser
              ? `${authUser.name} (${t(`roles.${authUser.role}`)})`
              : t('profile.subtitleDemo')}
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/settings" className="btn btn-primary">
            {t('profile.openSettings')}
          </Link>
        </div>
      </div>

      <section className="card" aria-labelledby="demo-profile-heading">
        <div className="section-header">
          <h2 id="demo-profile-heading">
            {authUser ? t('profile.accountProfile') : t('profile.demoProfile')}
          </h2>
          {authUser ? <Badge label={authUser.role} /> : <Badge label="DEMO DATA" />}
        </div>
        {authUser ? (
          <dl className="kv-list">
            <div className="kv-row">
              <dt>{t('profile.nameLabel')}</dt>
              <dd>{authUser.name}</dd>
            </div>
            <div className="kv-row">
              <dt>{t('profile.emailLabel')}</dt>
              <dd>
                <bdi dir="ltr">{authUser.email}</bdi>
              </dd>
            </div>
            <div className="kv-row">
              <dt>{t('profile.missionLabel')}</dt>
              <dd>{mission ? mission.name : <Badge label="NOT_CONFIGURED" />}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted-text">{t('profile.demoSessionDesc')}</p>
        )}
      </section>

      <section className="card" aria-labelledby="conn-sim-heading">
        <div className="section-header">
          <h2 id="conn-sim-heading">{t('profile.connSimTitle')}</h2>
          <Badge label={connectionBadge} />
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={toggleOfflineSim}
          >
            {isOfflineSim ? t('profile.reconnect') : t('profile.simulateOffline')}
          </button>
          {offlineQueue.length > 0 && <Badge label="SYNC PENDING" />}
        </div>

        {isOfflineSim && <p className="small-text">{t('profile.offlineNote')}</p>}
      </section>

      <section className="card" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">{t('profile.privacyTitle')}</h2>
        <p className="muted-text">{t('safety.privacyNote')}</p>
      </section>

      <section className="card" aria-labelledby="settings-shortcut-heading">
        <h2 id="settings-shortcut-heading">{t('profile.configTitle')}</h2>
        <p className="muted-text">{t('profile.configDesc')}</p>
        <div className="btn-row">
          <Link to="/settings" className="btn btn-secondary">
            {t('profile.goToSettings')}
          </Link>
        </div>
      </section>
    </>
  );
}
