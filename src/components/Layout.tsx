import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { Badge } from './Badge';
import { IdleTimeoutModal } from './IdleTimeoutModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SignOutDialog } from './SignOutDialog';

export function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const {
    authUser,
    mission,
    alerts,
    offlineQueue,
    isOfflineSim,
    flushOfflineQueue,
    toastMessage,
    showToast,
  } = useAstra();
  const { t, formatNum } = useI18n();

  const [signOutOpen, setSignOutOpen] = useState(false);
  const sidebarSignOutBtnRef = useRef<HTMLButtonElement | null>(null);

  const connectionBadge = isOfflineSim
    ? 'OFFLINE'
    : offlineQueue.length > 0
      ? 'SYNC PENDING'
      : 'ONLINE';

  const unackCount = alerts.filter((a) => !a.acknowledgedAt).length;
  const isDemoMode = !authUser;
  const isCommander = authUser?.role === 'COMMANDER';

  const navItems = [
    { to: '/', label: t('nav.home'), icon: '⌂', end: true },
    { to: '/health', label: t('nav.health'), icon: '♥', end: false },
    ...(isDemoMode || isCommander
      ? [{ to: '/risks', label: t('nav.risks'), icon: '☢', end: false }]
      : []),
    ...(authUser
      ? [
          { to: '/calendar', label: t('nav.calendar'), icon: '▦', end: false },
          {
            to: '/alerts',
            label:
              unackCount > 0
                ? t('nav.alertsCount', { count: formatNum(unackCount) })
                : t('nav.alerts'),
            icon: '▲',
            end: false,
          },
        ]
      : []),
    { to: '/protocol', label: t('nav.protocol'), icon: '✓', end: false },
    { to: '/achievements', label: t('nav.achievements'), icon: '★', end: false },
    { to: '/reports', label: t('nav.reports'), icon: '▤', end: false },
    { to: '/rules', label: t('nav.rules'), icon: '§', end: false },
    { to: '/sources', label: t('nav.sources'), icon: '⊞', end: false },
    { to: '/telemetry', label: t('nav.telemetry'), icon: '◎', end: false },
    ...(mission?.isDemo || isDemoMode
      ? [{ to: '/demo-scenarios', label: t('nav.demoScenarios'), icon: '▶', end: false }]
      : []),
    { to: '/settings', label: t('nav.settings'), icon: '⚙', end: false },
    { to: '/profile', label: t('nav.profile'), icon: '☺', end: false },
  ];

  const mobileBottomNav = [
    { to: '/', label: t('nav.home'), icon: '⌂', end: true },
    { to: '/health', label: t('nav.health'), icon: '♥', end: false },
    ...(isDemoMode || isCommander
      ? [{ to: '/risks', label: t('nav.risks'), icon: '☢', end: false }]
      : [{ to: '/calendar', label: t('nav.calendar'), icon: '▦', end: false }]),
    { to: '/protocol', label: t('nav.protocol'), icon: '✓', end: false },
    { to: '/settings', label: t('nav.settings'), icon: '⚙', end: false },
  ];

  const handleSyncNow = async () => {
    try {
      const res = await flushOfflineQueue();
      showToast(t('app.syncedItemsToast', { count: formatNum(res.synced) }));
    } catch {
      showToast(t('app.syncFailedToast'));
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t('app.navAria')}>
        <div className="sidebar-brand">
          <NavLink to="/" className="astra-logo">
            {t('app.brand')}
          </NavLink>
          <span className="sidebar-subtitle">{t('app.subtitle')}</span>
          {authUser && (
            <div className="badge-row" style={{ marginTop: 6 }}>
              <Badge label={authUser.role} />
              {mission?.isDemo && <Badge label="DEMO DATA" />}
            </div>
          )}
        </div>

        <nav className="sidebar-nav" aria-label={t('app.mainSectionsAria')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="sidebar-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {isActive && <span className="sr-only"> {t('app.currentPage')}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="sidebar-footer-label">{t('app.link')}</span>
            <Badge label={connectionBadge} />
          </div>
          {offlineQueue.length > 0 && !isOfflineSim && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: 36, padding: '6px 10px', fontSize: 12 }}
              onClick={() => void handleSyncNow()}
            >
              {t('app.syncQueue', { count: formatNum(offlineQueue.length) })}
            </button>
          )}
          <button
            ref={sidebarSignOutBtnRef}
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: 36, padding: '6px 10px', fontSize: 12 }}
            onClick={() => setSignOutOpen(true)}
          >
            {t('app.signOut')}
          </button>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-brand-group">
              <NavLink to="/" className="astra-logo">
                {t('app.brand')}
              </NavLink>
              {authUser && <span className="small-text">{authUser.name}</span>}
            </div>
            <div className="topbar-badges">
              <LanguageSwitcher />
              {mission?.isDemo || isDemoMode ? (
                <Badge label={isDemoMode ? 'SIMULATED DATA' : 'DEMO DATA'} />
              ) : (
                <Badge label="PROTOTYPE DEFAULT" />
              )}
              {authUser && <Badge label={authUser.role} />}
              <Badge label={connectionBadge} />
            </div>
          </div>
        </header>

        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label={t('app.mobileNavAria')}>
        {mobileBottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `bottom-nav-link${isActive ? ' active' : ''}`
            }
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <SignOutDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onSignedOut={() => navigate('/login', { replace: true })}
        triggerRef={sidebarSignOutBtnRef}
      />

      <IdleTimeoutModal />

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
