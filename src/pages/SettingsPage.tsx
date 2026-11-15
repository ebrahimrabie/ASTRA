import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  changePasswordApi,
  createExportApi,
  deleteMyDataApi,
  fetchAlertsApi,
  fetchDailyReadingsApi,
  fetchMissionRosterApi,
  getExportDownloadUrl,
  listExportsApi,
  logoutAllApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { SignOutDialog } from '../components/SignOutDialog';
import { exportOfflineQueueToFile, useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import type {
  ExportFormat,
  ExportJobItem,
  ExportScope,
  ExportSection,
  UserPreferences,
  UserRole,
} from '../types';

type SettingsSection =
  | 'appearance'
  | 'notifications'
  | 'units'
  | 'data'
  | 'account';

const SECTION_IDS: SettingsSection[] = [
  'appearance',
  'notifications',
  'units',
  'data',
  'account',
];

const SECTION_LABEL_KEYS: Record<SettingsSection, string> = {
  appearance: 'settings.secAppearance',
  notifications: 'settings.secNotifications',
  units: 'settings.secUnits',
  data: 'settings.secData',
  account: 'settings.secAccount',
};

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    authUser,
    mission,
    preferences,
    updatePreferences,
    offlineQueue,
    isOfflineSim,
    signOutLocal,
    showToast,
  } = useAstra();
  const { lang, t, trStatus, trError, formatNum, formatUtcIso } = useI18n();

  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [sectionStatus, setSectionStatus] = useState<
    Record<SettingsSection, { saved?: string; error?: string }>
  >({
    appearance: {},
    notifications: {},
    units: {},
    data: {},
    account: {},
  });

  // Notifications local form state synced with preferences
  const [notifForm, setNotifForm] = useState(preferences.notifications);
  useEffect(() => {
    setNotifForm(preferences.notifications);
  }, [preferences.notifications]);

  // Password change state
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // Sign out & Sign out of all devices
  const [signOutOpen, setSignOutOpen] = useState(false);
  const signOutBtnRef = useRef<HTMLButtonElement | null>(null);
  const [logoutAllPw, setLogoutAllPw] = useState('');
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  // Delete data confirmation
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [browserPerm, setBrowserPerm] = useState<string>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  // Section 15 Data Export Wizard State
  const [exportScope, setExportScope] = useState<ExportScope>('my');
  const [exportSubjectUserId, setExportSubjectUserId] = useState<string>('');
  const [exportDatePreset, setExportDatePreset] = useState<'7d' | '30d' | 'mission' | 'custom'>('30d');
  const [exportCustomFrom, setExportCustomFrom] = useState<string>(() =>
    new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  );
  const [exportCustomTo, setExportCustomTo] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportLabelLang, setExportLabelLang] = useState<'en' | 'ar'>(lang);
  const [exportInclude, setExportInclude] = useState<ExportSection[]>([
    'daily_readings',
    'activity_sessions',
    'alerts',
    'tasks',
    'baselines',
    'preferences',
    'kb_references',
  ]);
  const [ackUnencrypted, setAckUnencrypted] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [accountPkgBusy, setAccountPkgBusy] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJobItem[]>([]);
  const [roster, setRoster] = useState<Array<{ userId: string; name: string; role: UserRole }>>([]);

  useEffect(() => {
    setExportLabelLang(lang);
  }, [lang]);

  const rolePermittedSections = useMemo<ExportSection[]>(() => {
    const role = authUser?.role ?? 'CREW';
    const base: ExportSection[] = ['daily_readings', 'activity_sessions', 'alerts'];
    if (role !== 'COMMANDER') base.push('problem_reports');
    base.push('tasks', 'baselines');
    if (role === 'COMMANDER') base.push('hazards');
    if (role !== 'CREW') base.push('audit_log');
    base.push('preferences', 'kb_references');
    return base;
  }, [authUser?.role]);

  useEffect(() => {
    setExportInclude((prev) => prev.filter((s) => rolePermittedSections.includes(s)));
  }, [rolePermittedSections]);

  const refreshExportJobs = useCallback(async () => {
    if (!authUser) {
      setExportJobs([]);
      return;
    }
    try {
      const jobs = await listExportsApi();
      setExportJobs(jobs);
    } catch {
      // ignore if offline
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser || (activeSection !== 'data' && activeSection !== 'account')) return;
    void refreshExportJobs();
    if (
      mission &&
      (authUser.role === 'DOCTOR' || authUser.role === 'COMMANDER') &&
      roster.length === 0
    ) {
      void fetchMissionRosterApi()
        .then((list) => {
          setRoster(list.map((m) => ({ userId: m.userId, name: m.name, role: m.role })));
          if (!exportSubjectUserId && list.length > 0) {
            const firstOther = list.find((m) => m.userId !== authUser.id) ?? list[0];
            setExportSubjectUserId(firstOther.userId);
          }
        })
        .catch(() => {
          // ignore if offline
        });
    }
  }, [activeSection, authUser, mission, roster.length, exportSubjectUserId, refreshExportJobs]);

  useEffect(() => {
    if (!exportJobs.some((j) => j.status === 'PENDING')) return undefined;
    const timer = window.setInterval(() => {
      void refreshExportJobs();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [exportJobs, refreshExportJobs]);

  const exportRangeMs = useMemo(() => {
    const now = Date.now();
    if (exportDatePreset === '7d') {
      return { fromMs: now - 7 * 86_400_000, toMs: now };
    }
    if (exportDatePreset === '30d') {
      return { fromMs: now - 30 * 86_400_000, toMs: now };
    }
    if (exportDatePreset === 'mission' && mission) {
      const start = Date.parse(`${mission.startDateUtc}T00:00:00Z`);
      return {
        fromMs: Number.isFinite(start) ? start : now - 90 * 86_400_000,
        toMs: now,
      };
    }
    const f = Date.parse(`${exportCustomFrom}T00:00:00Z`);
    const to = Date.parse(`${exportCustomTo}T23:59:59Z`);
    return {
      fromMs: Number.isFinite(f) ? f : now - 30 * 86_400_000,
      toMs: Number.isFinite(to) ? to : now,
    };
  }, [exportDatePreset, mission, exportCustomFrom, exportCustomTo]);

  const setSaved = (sec: SettingsSection, msg = t('settings.savedMsg')) => {
    setSectionStatus((prev) => ({ ...prev, [sec]: { saved: msg } }));
  };
  const setErr = (sec: SettingsSection, error: string) => {
    setSectionStatus((prev) => ({ ...prev, [sec]: { error } }));
  };

  const handlePrefsPatch = async (
    sec: SettingsSection,
    patch: Partial<UserPreferences>
  ) => {
    setSectionStatus((prev) => ({ ...prev, [sec]: {} }));
    try {
      await updatePreferences(patch);
      setSaved(sec, t('settings.savedMsg'));
    } catch (err) {
      setErr(sec, trError(err));
    }
  };

  const handleRequestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') {
      setBrowserPerm('unsupported');
      setErr('notifications', t('settings.browserUnsupported'));
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setBrowserPerm(result);
      if (result === 'granted') {
        await handlePrefsPatch('notifications', {
          notifications: { ...notifForm, browserNotifications: true },
        });
      } else {
        setErr(
          'notifications',
          t('settings.browserPermMsg', {
            result: t(`settings.perm_${result}`),
          })
        );
      }
    } catch {
      setErr('notifications', t('settings.browserPermErr'));
    }
  };

  const triggerFileDownload = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleToggleExportSection = (sec: ExportSection) => {
    setExportInclude((prev) =>
      prev.includes(sec) ? prev.filter((item) => item !== sec) : [...prev, sec]
    );
  };

  const handleWizardExport = async () => {
    if (isOfflineSim || !authUser) {
      setErr('data', t('settings.offlineOnlyErr'));
      return;
    }
    if (exportInclude.length === 0) {
      setErr('data', t('settings.exportSelectSectionErr'));
      return;
    }
    if (!ackUnencrypted) {
      setErr('data', t('reports.confirmUnencryptedErr'));
      return;
    }
    setExportBusy(true);
    setSectionStatus((prev) => ({ ...prev, data: {} }));
    try {
      const job = await createExportApi({
        scope: exportScope,
        subjectUserId:
          exportScope === 'crew_member' ? exportSubjectUserId || null : null,
        fromMs: exportRangeMs.fromMs,
        toMs: exportRangeMs.toMs,
        include: exportInclude,
        format: exportFormat,
        labelLanguage: exportLabelLang,
      });
      await refreshExportJobs();
      if (job.status === 'READY') {
        triggerFileDownload(getExportDownloadUrl(job.id), job.fileName);
        setSaved('data', t('settings.exportReadyMsg', { name: job.fileName }));
      } else {
        setSaved('data', t('settings.exportPendingMsg'));
      }
    } catch (err) {
      setErr('data', trError(err, 'settings.exportFailedErr'));
    } finally {
      setExportBusy(false);
    }
  };

  const handleAccountDataPackage = async () => {
    if (isOfflineSim || !authUser) {
      setErr('account', t('settings.offlineOnlyErr'));
      return;
    }
    setAccountPkgBusy(true);
    setSectionStatus((prev) => ({ ...prev, account: {} }));
    try {
      const startMs = mission
        ? Date.parse(`${mission.startDateUtc}T00:00:00Z`) || 0
        : 0;
      const include: ExportSection[] = [
        'daily_readings',
        'activity_sessions',
        'alerts',
        ...(authUser.role !== 'COMMANDER' ? (['problem_reports'] as const) : []),
        'tasks',
        'baselines',
        ...(authUser.role === 'COMMANDER' ? (['hazards'] as const) : []),
        ...(authUser.role !== 'CREW' ? (['audit_log'] as const) : []),
        'preferences',
        'kb_references',
      ];
      const job = await createExportApi({
        scope: 'my',
        fromMs: startMs,
        toMs: Date.now(),
        include,
        format: 'json',
        labelLanguage: lang,
      });
      if (job.status === 'READY') {
        triggerFileDownload(getExportDownloadUrl(job.id), job.fileName);
        setSaved('account', t('settings.jsonExportedMsg'));
      } else {
        setSaved('account', t('settings.exportPendingMsg'));
      }
    } catch (err) {
      setErr('account', trError(err, 'settings.exportFailedErr'));
    } finally {
      setAccountPkgBusy(false);
    }
  };

  const handlePersonalJsonExport = async () => {
    if (isOfflineSim) {
      setErr('data', t('settings.offlineOnlyErr'));
      return;
    }
    try {
      const [readings, alerts] = authUser
        ? await Promise.all([
            fetchDailyReadingsApi({ subjectUserId: authUser.id }),
            fetchAlertsApi(),
          ])
        : [[], []];
      const pkg = {
        app: 'ASTRA',
        exportedAt: new Date().toISOString(),
        disclaimer: 'Decision-support prototype. Not a validated clinical system.',
        note: 'Values are exactly as entered. Nothing has been estimated or extrapolated.',
        user: authUser
          ? { id: authUser.id, name: authUser.name, role: authUser.role }
          : { mode: 'DEMO' },
        mission: mission ? { id: mission.id, name: mission.name } : null,
        preferences,
        readings,
        alerts,
      };
      const blob = new Blob([JSON.stringify(pkg, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `astra-my-data-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}Z.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved('data', t('settings.jsonExportedMsg'));
    } catch (err) {
      setErr('data', trError(err, 'settings.exportFailedErr'));
    }
  };

  const handleDeleteMyData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) {
      setErr('data', t('settings.deleteAuthErr'));
      return;
    }
    if (deleteText.trim() !== 'DELETE') {
      setErr('data', t('settings.deleteConfirmErr'));
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteMyDataApi('DELETE');
      setDeleteText('');
      setSaved('data', t('settings.deleteSuccessMsg'));
      showToast(t('settings.deleteToast'));
    } catch (err) {
      setErr('data', trError(err));
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curPw || newPw.length < 8) {
      setErr('account', t('settings.pwLenErr'));
      return;
    }
    if (newPw !== confirmPw) {
      setErr('account', t('settings.pwMismatchErr'));
      return;
    }
    setPwBusy(true);
    try {
      await changePasswordApi(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setSaved('account', t('settings.pwUpdatedMsg'));
    } catch (err) {
      setErr('account', trError(err));
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogoutAllDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoutAllPw) {
      setErr('account', t('settings.logoutAllPwErr'));
      return;
    }
    setLogoutAllBusy(true);
    try {
      await logoutAllApi(logoutAllPw);
      await signOutLocal();
      navigate('/login', { replace: true });
    } catch (err) {
      setErr('account', trError(err));
    } finally {
      setLogoutAllBusy(false);
    }
  };

  const status = sectionStatus[activeSection];
  const localizedPerm =
    browserPerm === 'default' ||
    browserPerm === 'granted' ||
    browserPerm === 'denied' ||
    browserPerm === 'unsupported'
      ? t(`settings.perm_${browserPerm}`)
      : browserPerm;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('settings.title')}</h1>
          <p className="muted-text">{t('settings.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Link to="/profile" className="btn btn-secondary">
            {t('settings.profileLink')}
          </Link>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.sectionsAria')}>
          {SECTION_IDS.map((secId) => (
            <button
              key={secId}
              type="button"
              className={`settings-nav-btn${activeSection === secId ? ' active' : ''}`}
              aria-current={activeSection === secId ? 'page' : undefined}
              onClick={() => setActiveSection(secId)}
            >
              {t(SECTION_LABEL_KEYS[secId])}
            </button>
          ))}
        </nav>

        <div className="section-block">
          {status.saved && (
            <div className="banner" role="status" style={{ borderColor: 'var(--ok)' }}>
              <strong>{status.saved}</strong>
            </div>
          )}
          {status.error && (
            <div className="form-error" role="alert">
              {status.error}
            </div>
          )}

          {activeSection === 'appearance' && (
            <section className="card" aria-labelledby="settings-appearance-heading">
              <h2 id="settings-appearance-heading">{t('settings.secAppearance')}</h2>

              <div className="field">
                <label>{t('settings.themeLabel')}</label>
                <div className="segmented-group" role="group" aria-label={t('settings.themeAria')}>
                  {(['dark', 'light', 'system'] as const).map((themeVal) => (
                    <button
                      key={themeVal}
                      type="button"
                      className={`segmented-btn${preferences.theme === themeVal ? ' active' : ''}`}
                      onClick={() => void handlePrefsPatch('appearance', { theme: themeVal })}
                    >
                      {themeVal === 'dark'
                        ? t('settings.themeDark')
                        : themeVal === 'light'
                          ? t('settings.themeLight')
                          : t('settings.themeSystem')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>{t('settings.languageLabel')}</label>
                <div
                  className="segmented-group"
                  role="group"
                  aria-label={t('settings.languageAria')}
                >
                  <button
                    type="button"
                    className={`segmented-btn${preferences.language === 'en' ? ' active' : ''}`}
                    onClick={() => void handlePrefsPatch('appearance', { language: 'en' })}
                  >
                    {t('settings.english')}
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn${preferences.language === 'ar' ? ' active' : ''}`}
                    onClick={() => void handlePrefsPatch('appearance', { language: 'ar' })}
                  >
                    {t('settings.arabic')}
                  </button>
                </div>
              </div>

              <div className="field">
                <label>{t('settings.numeralsLabel')}</label>
                <div
                  className="segmented-group"
                  role="group"
                  aria-label={t('settings.numeralsAria')}
                >
                  <button
                    type="button"
                    className={`segmented-btn${preferences.numerals === 'western' ? ' active' : ''}`}
                    onClick={() =>
                      void handlePrefsPatch('appearance', { numerals: 'western' })
                    }
                  >
                    {t('settings.numeralsWestern')}
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn${preferences.numerals === 'arabic_indic' ? ' active' : ''}`}
                    onClick={() =>
                      void handlePrefsPatch('appearance', { numerals: 'arabic_indic' })
                    }
                  >
                    {t('settings.numeralsArabicIndic')}
                  </button>
                </div>
                <p className="small-text">{t('settings.numeralsHint')}</p>
              </div>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="card" aria-labelledby="settings-notif-heading">
              <h2 id="settings-notif-heading">{t('settings.secNotifications')}</h2>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handlePrefsPatch('notifications', { notifications: notifForm });
                }}
              >
                <label className="toggle-row">
                  <span>{t('settings.inAppMonitor')}</span>
                  <input
                    type="checkbox"
                    checked={notifForm.inAppMonitor}
                    onChange={(e) =>
                      setNotifForm({ ...notifForm, inAppMonitor: e.target.checked })
                    }
                  />
                </label>

                <label className="toggle-row">
                  <span>{t('settings.inAppReview')}</span>
                  <input
                    type="checkbox"
                    checked={notifForm.inAppReview}
                    onChange={(e) =>
                      setNotifForm({ ...notifForm, inAppReview: e.target.checked })
                    }
                  />
                </label>

                <label className="toggle-row">
                  <span>{t('settings.inAppHighPriority')}</span>
                  <input
                    type="checkbox"
                    checked={notifForm.inAppHighPriority}
                    onChange={(e) =>
                      setNotifForm({
                        ...notifForm,
                        inAppHighPriority: e.target.checked,
                      })
                    }
                  />
                </label>

                <div className="toggle-row">
                  <div>
                    <div>{t('settings.browserNotifs', { perm: localizedPerm })}</div>
                    <div className="small-text">{t('settings.browserNotifsDesc')}</div>
                  </div>
                  <div className="btn-row">
                    <input
                      type="checkbox"
                      aria-label={t('settings.browserNotifsAria')}
                      checked={notifForm.browserNotifications}
                      onChange={(e) =>
                        setNotifForm({
                          ...notifForm,
                          browserNotifications: e.target.checked,
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleRequestBrowserPermission()}
                    >
                      {t('settings.requestPerm')}
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="notif-reminder-utc">{t('settings.reminderUtc')}</label>
                  <input
                    id="notif-reminder-utc"
                    type="time"
                    className="input"
                    value={notifForm.dailyReminderTime}
                    onChange={(e) =>
                      setNotifForm({
                        ...notifForm,
                        dailyReminderTime: e.target.value,
                      })
                    }
                  />
                </div>

                <label className="toggle-row">
                  <span>{t('settings.quietHoursToggle')}</span>
                  <input
                    type="checkbox"
                    checked={notifForm.quietHoursEnabled}
                    onChange={(e) =>
                      setNotifForm({
                        ...notifForm,
                        quietHoursEnabled: e.target.checked,
                      })
                    }
                  />
                </label>

                {notifForm.quietHoursEnabled && (
                  <div className="card-grid">
                    <div className="field">
                      <label htmlFor="quiet-start">{t('settings.quietStart')}</label>
                      <input
                        id="quiet-start"
                        type="time"
                        className="input"
                        value={notifForm.quietStart}
                        onChange={(e) =>
                          setNotifForm({ ...notifForm, quietStart: e.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="quiet-end">{t('settings.quietEnd')}</label>
                      <input
                        id="quiet-end"
                        type="time"
                        className="input"
                        value={notifForm.quietEnd}
                        onChange={(e) =>
                          setNotifForm({ ...notifForm, quietEnd: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="btn-row">
                  <button type="submit" className="btn btn-primary">
                    {t('settings.saveNotifsBtn')}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeSection === 'units' && (
            <section className="card" aria-labelledby="settings-units-heading">
              <h2 id="settings-units-heading">{t('settings.displayUnitsTitle')}</h2>

              <div className="banner" role="note">
                {t('settings.unitsBanner')}
              </div>

              <div className="field">
                <label>{t('settings.tempLabel')}</label>
                <div
                  className="segmented-group"
                  role="group"
                  aria-label={t('settings.tempUnitAria')}
                >
                  {(['C', 'F'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`segmented-btn${preferences.units.temperature === u ? ' active' : ''}`}
                      onClick={() =>
                        void handlePrefsPatch('units', {
                          units: { ...preferences.units, temperature: u },
                        })
                      }
                    >
                      {u === 'C' ? t('settings.tempC') : t('settings.tempF')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>{t('settings.pressureLabel')}</label>
                <div
                  className="segmented-group"
                  role="group"
                  aria-label={t('settings.pressureUnitAria')}
                >
                  {(['kPa', 'psia', 'mmHg'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`segmented-btn${preferences.units.pressure === u ? ' active' : ''}`}
                      onClick={() =>
                        void handlePrefsPatch('units', {
                          units: { ...preferences.units, pressure: u },
                        })
                      }
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>{t('settings.distLabel')}</label>
                <div
                  className="segmented-group"
                  role="group"
                  aria-label={t('settings.distanceUnitAria')}
                >
                  {(['km', 'mi'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`segmented-btn${preferences.units.distance === u ? ' active' : ''}`}
                      onClick={() =>
                        void handlePrefsPatch('units', {
                          units: { ...preferences.units, distance: u },
                        })
                      }
                    >
                      {u === 'km' ? t('settings.distKm') : t('settings.distMi')}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'data' && (
            <>
              <section className="card" aria-labelledby="settings-export-heading">
                <div className="section-header">
                  <h2 id="settings-export-heading">{t('settings.exportTitle')}</h2>
                  <Badge label={authUser?.role ?? 'SIMULATED DATA'} />
                </div>
                <p className="muted-text">{t('settings.exportDesc')}</p>

                {!authUser && (
                  <div className="banner" role="note">
                    {t('settings.exportAuthRequired')}
                  </div>
                )}

                {authUser && (
                  <div className="form-stack">
                    {/* Step 1: Scope */}
                    <div className="field">
                      <label>{t('settings.exportStep1Scope')}</label>
                      <div className="btn-row">
                        <button
                          type="button"
                          className={
                            exportScope === 'my' ? 'btn btn-primary' : 'btn btn-secondary'
                          }
                          onClick={() => setExportScope('my')}
                        >
                          {t('settings.scopeMy')}
                        </button>
                        {authUser.role === 'DOCTOR' && (
                          <>
                            <button
                              type="button"
                              className={
                                exportScope === 'crew_member'
                                  ? 'btn btn-primary'
                                  : 'btn btn-secondary'
                              }
                              onClick={() => setExportScope('crew_member')}
                            >
                              {t('settings.scopeCrewMember')}
                            </button>
                            <button
                              type="button"
                              className={
                                exportScope === 'entire_crew'
                                  ? 'btn btn-primary'
                                  : 'btn btn-secondary'
                              }
                              onClick={() => setExportScope('entire_crew')}
                            >
                              {t('settings.scopeEntireCrew')}
                            </button>
                          </>
                        )}
                        {authUser.role === 'COMMANDER' && (
                          <button
                            type="button"
                            className={
                              exportScope === 'mission'
                                ? 'btn btn-primary'
                                : 'btn btn-secondary'
                            }
                            onClick={() => setExportScope('mission')}
                          >
                            {t('settings.scopeMission')}
                          </button>
                        )}
                      </div>
                    </div>

                    {authUser.role === 'DOCTOR' && exportScope === 'crew_member' && (
                      <div className="field">
                        <label htmlFor="export-crew-select">
                          {t('settings.selectCrewMember')}
                        </label>
                        <select
                          id="export-crew-select"
                          className="input"
                          value={exportSubjectUserId}
                          onChange={(e) => setExportSubjectUserId(e.target.value)}
                        >
                          {roster.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name} ({trStatus(m.role)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Step 2: Date Range */}
                    <div className="field">
                      <label>{t('settings.exportStep2Dates')}</label>
                      <div className="btn-row">
                        {(['7d', '30d', 'mission', 'custom'] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={
                              exportDatePreset === p
                                ? 'btn btn-primary'
                                : 'btn btn-secondary'
                            }
                            onClick={() => setExportDatePreset(p)}
                          >
                            {t(`reports.preset_${p}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {exportDatePreset === 'custom' && (
                      <div className="card-grid">
                        <div className="field">
                          <label htmlFor="export-from-utc">{t('reports.fromUtc')}</label>
                          <input
                            id="export-from-utc"
                            type="date"
                            className="input"
                            value={exportCustomFrom}
                            onChange={(e) => setExportCustomFrom(e.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="export-to-utc">{t('reports.toUtc')}</label>
                          <input
                            id="export-to-utc"
                            type="date"
                            className="input"
                            value={exportCustomTo}
                            onChange={(e) => setExportCustomTo(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Step 3: Content Sections */}
                    <div className="field">
                      <label>{t('settings.exportStep3Content')}</label>
                      <div className="card-grid">
                        {rolePermittedSections.map((sec) => (
                          <label
                            key={sec}
                            className="toggle-row"
                            style={{ cursor: 'pointer' }}
                          >
                            <span>{t(`settings.exportSec_${sec}`)}</span>
                            <input
                              type="checkbox"
                              checked={exportInclude.includes(sec)}
                              onChange={() => handleToggleExportSection(sec)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Step 4: Format & Step 5: Label Language */}
                    <div className="card-grid">
                      <div className="field">
                        <label>{t('settings.exportStep4Format')}</label>
                        <div className="segmented-group">
                          <button
                            type="button"
                            className={`segmented-btn${exportFormat === 'json' ? ' active' : ''}`}
                            onClick={() => setExportFormat('json')}
                          >
                            JSON
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn${exportFormat === 'csv_zip' ? ' active' : ''}`}
                            onClick={() => setExportFormat('csv_zip')}
                          >
                            {t('settings.formatCsvZip')}
                          </button>
                        </div>
                      </div>

                      <div className="field">
                        <label>{t('settings.exportStep5Lang')}</label>
                        <div className="segmented-group">
                          <button
                            type="button"
                            className={`segmented-btn${exportLabelLang === 'en' ? ' active' : ''}`}
                            onClick={() => setExportLabelLang('en')}
                          >
                            {t('settings.english')}
                          </button>
                          <button
                            type="button"
                            className={`segmented-btn${exportLabelLang === 'ar' ? ' active' : ''}`}
                            onClick={() => setExportLabelLang('ar')}
                          >
                            {t('settings.arabic')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="banner" role="note">
                      <p className="small-text" style={{ marginBottom: 8 }}>
                        {t('settings.exportWarningLine', {
                          count: formatNum(exportInclude.length),
                        })}
                      </p>
                      <label
                        className="toggle-row"
                        style={{
                          cursor: 'pointer',
                          justifyContent: 'flex-start',
                          gap: 10,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={ackUnencrypted}
                          onChange={(e) => setAckUnencrypted(e.target.checked)}
                        />
                        <span>{t('settings.unencryptedAckLabel')}</span>
                      </label>
                    </div>

                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          isOfflineSim ||
                          exportBusy ||
                          !ackUnencrypted ||
                          exportInclude.length === 0
                        }
                        onClick={() => void handleWizardExport()}
                      >
                        {exportBusy
                          ? t('reports.exporting')
                          : t('settings.generateExportBtn')}
                      </button>
                      <Link to="/reports" className="btn btn-secondary">
                        {t('settings.printableReportBtn')}
                      </Link>
                      {offlineQueue.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => exportOfflineQueueToFile(offlineQueue)}
                        >
                          {t('settings.exportQueueBtn', {
                            count: formatNum(offlineQueue.length),
                          })}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!authUser && offlineQueue.length > 0 && (
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => exportOfflineQueueToFile(offlineQueue)}
                    >
                      {t('settings.exportQueueBtn', {
                        count: formatNum(offlineQueue.length),
                      })}
                    </button>
                  </div>
                )}

                {isOfflineSim && (
                  <p className="small-text">{t('settings.offlineExportNote')}</p>
                )}
              </section>

              {authUser && (
                <section className="card" aria-labelledby="settings-past-exports-heading">
                  <h2 id="settings-past-exports-heading">{t('settings.pastExportsTitle')}</h2>
                  <p className="small-text">{t('settings.pastExportsRetention')}</p>
                  {exportJobs.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('settings.noExportsYet')}</p>
                    </div>
                  ) : (
                    <div className="history-list" style={{ marginTop: 10 }}>
                      {exportJobs.map((job) => (
                        <div key={job.id} className="history-item">
                          <div>
                            <strong>
                              <bdi dir="ltr">{job.fileName}</bdi>
                            </strong>
                            <div className="small-text">
                              {t(`settings.scope_${job.scope}`)} •{' '}
                              {job.format === 'csv_zip' ? 'ZIP/CSV' : 'JSON'} •{' '}
                              <bdi dir="ltr">
                                {formatUtcIso(job.createdAt)} {t('app.utc')}
                              </bdi>{' '}
                              •{' '}
                              {t('settings.sizeKb', {
                                kb: formatNum(
                                  Math.max(1, Math.round(job.fileBytes / 1024))
                                ),
                              })}
                            </div>
                          </div>
                          <div className="badge-row">
                            <Badge label={job.status} />
                            {job.status === 'READY' && (
                              <a
                                href={getExportDownloadUrl(job.id)}
                                download={job.fileName}
                                className="btn btn-secondary"
                                style={{ minHeight: 34, padding: '4px 10px', fontSize: 12 }}
                              >
                                {t('settings.downloadBtn')}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              <section className="card" aria-labelledby="settings-privacy-heading">
                <h2 id="settings-privacy-heading">{t('settings.privacyTitle')}</h2>
                <p className="muted-text">{t('settings.privacyBody')}</p>
              </section>

              <section className="card" aria-labelledby="settings-delete-heading">
                <h2 id="settings-delete-heading">{t('settings.deleteTitle')}</h2>
                <p className="muted-text">{t('settings.deleteDesc')}</p>

                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isOfflineSim}
                    onClick={() => void handlePersonalJsonExport()}
                  >
                    {t('settings.exportFirst')}
                  </button>
                </div>

                <form className="form-stack" onSubmit={(e) => void handleDeleteMyData(e)}>
                  <div className="field">
                    <label htmlFor="delete-confirm-input">{t('settings.typeDeletePrompt')}</label>
                    <input
                      id="delete-confirm-input"
                      type="text"
                      className="input"
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder={t('settings.deletePlaceholder')}
                    />
                  </div>
                  <div className="btn-row">
                    <button
                      type="submit"
                      className="btn btn-danger"
                      disabled={deleteBusy || !authUser}
                    >
                      {deleteBusy ? t('settings.deleting') : t('settings.deleteBtn')}
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}

          {activeSection === 'account' && (
            <>
              <section className="card" aria-labelledby="settings-session-heading">
                <h2 id="settings-session-heading">{t('settings.sessionTitle')}</h2>
                {authUser ? (
                  <dl className="kv-list">
                    <div className="kv-row">
                      <dt>{t('settings.nameLabel')}</dt>
                      <dd>{authUser.name}</dd>
                    </div>
                    <div className="kv-row">
                      <dt>{t('settings.emailLabel')}</dt>
                      <dd dir="ltr">
                        <bdi dir="ltr">{authUser.email}</bdi>
                      </dd>
                    </div>
                    <div className="kv-row">
                      <dt>{t('settings.roleLabel')}</dt>
                      <dd><Badge label={authUser.role} /></dd>
                    </div>
                    <div className="kv-row">
                      <dt>{t('settings.missionLabel')}</dt>
                      <dd>{mission ? mission.name : <Badge label="NOT_CONFIGURED" />}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="muted-text">{t('settings.demoSessionNote')}</p>
                )}

                <div className="btn-row">
                  {authUser && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isOfflineSim || accountPkgBusy}
                      onClick={() => void handleAccountDataPackage()}
                    >
                      {accountPkgBusy
                        ? t('reports.exporting')
                        : t('settings.downloadMyDataPkgBtn')}
                    </button>
                  )}
                  <button
                    ref={signOutBtnRef}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSignOutOpen(true)}
                  >
                    {t('settings.signOutBtn')}
                  </button>
                </div>
              </section>

              {authUser && (
                <>
                  <section className="card" aria-labelledby="settings-pw-heading">
                    <h2 id="settings-pw-heading">{t('settings.changePwTitle')}</h2>
                    <form
                      className="form-stack"
                      onSubmit={(e) => void handleChangePassword(e)}
                    >
                      <div className="field">
                        <label htmlFor="pw-current">{t('settings.curPw')}</label>
                        <input
                          id="pw-current"
                          type="password"
                          className="input"
                          value={curPw}
                          onChange={(e) => setCurPw(e.target.value)}
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="pw-new">{t('settings.newPw')}</label>
                        <input
                          id="pw-new"
                          type="password"
                          className="input"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="pw-confirm">{t('settings.confirmPw')}</label>
                        <input
                          id="pw-confirm"
                          type="password"
                          className="input"
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                      <div className="btn-row">
                        <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                          {pwBusy ? t('settings.updatingPw') : t('settings.changePwBtn')}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="card" aria-labelledby="settings-logoutall-heading">
                    <h2 id="settings-logoutall-heading">{t('settings.logoutAllTitle')}</h2>
                    <p className="muted-text">{t('settings.logoutAllDesc')}</p>
                    <form
                      className="form-stack"
                      onSubmit={(e) => void handleLogoutAllDevices(e)}
                    >
                      <div className="field">
                        <label htmlFor="logout-all-pw">{t('settings.reenterPw')}</label>
                        <input
                          id="logout-all-pw"
                          type="password"
                          className="input"
                          value={logoutAllPw}
                          onChange={(e) => setLogoutAllPw(e.target.value)}
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="btn-row">
                        <button
                          type="submit"
                          className="btn btn-danger"
                          disabled={logoutAllBusy}
                        >
                          {logoutAllBusy ? t('settings.revoking') : t('settings.logoutAllBtn')}
                        </button>
                      </div>
                    </form>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <SignOutDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onSignedOut={() => navigate('/login', { replace: true })}
        triggerRef={signOutBtnRef}
      />
    </>
  );
}
