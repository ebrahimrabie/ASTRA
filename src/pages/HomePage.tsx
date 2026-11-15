import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FALLBACK_HEALTH_INDICATORS,
  FALLBACK_RISKS,
  fetchDailyReadingsApi,
  fetchHealthIndicators,
  fetchProtocolsApi,
  fetchRisks,
  joinMissionApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { EntrySheet } from '../components/EntrySheet';
import { MissionSetupWizard } from '../components/MissionSetupWizard';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type {
  DailyReadingItem,
  HealthIndicatorItem,
  ProtocolItem,
  RiskItem,
} from '../types';
import { formatDistanceDisplay } from '../utils/units';

export function formatLightTime(seconds: number): string {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(2)} ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')} min`;
}

const HEALTH_CARDS_META: Array<{
  indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
  icon: string;
  protocolId: string;
}> = [
  { indicator: 'hr', icon: '♥', protocolId: 'PRT-HR' },
  { indicator: 'bp', icon: '◍', protocolId: 'PRT-BP' },
  { indicator: 'sleep', icon: '☾', protocolId: 'PRT-SLP' },
  { indicator: 'mood', icon: '☺', protocolId: 'PRT-MOOD' },
  { indicator: 'stress', icon: '≋', protocolId: 'PRT-STR' },
  { indicator: 'act', icon: '➚', protocolId: 'PRT-ACT' },
];

export function HomePage() {
  const {
    demoUserId,
    authUser,
    mission,
    missionDerived,
    alerts,
    preferences,
    isOfflineSim,
    setSessionData,
    showToast,
  } = useAstra();
  const { lang, t, trProvenance, trError, formatNum, formatUtcIso } = useI18n();

  const [indicators, setIndicators] = useState<HealthIndicatorItem[]>(
    FALLBACK_HEALTH_INDICATORS
  );
  const [risks, setRisks] = useState<RiskItem[]>(FALLBACK_RISKS);
  const [readings, setReadings] = useState<DailyReadingItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [showCalcPopover, setShowCalcPopover] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [entryIndicator, setEntryIndicator] = useState<
    'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act' | null
  >(null);

  const loadMissionHealth = useCallback(() => {
    if (!authUser || !mission) return;
    fetchDailyReadingsApi()
      .then(setReadings)
      .catch(() => {});
    fetchProtocolsApi()
      .then(setProtocols)
      .catch(() => {});
  }, [authUser, mission]);

  useEffect(() => {
    if (authUser) {
      loadMissionHealth();
      return;
    }
    if (!demoUserId) return;
    let active = true;
    Promise.allSettled([
      fetchHealthIndicators(demoUserId),
      fetchRisks(demoUserId),
    ]).then(([healthRes, riskRes]) => {
      if (!active) return;
      if (healthRes.status === 'fulfilled' && healthRes.value.length > 0) {
        setIndicators(healthRes.value);
      }
      if (riskRes.status === 'fulfilled' && riskRes.value.length > 0) {
        setRisks(riskRes.value);
      }
    });
    return () => {
      active = false;
    };
  }, [authUser, demoUserId, loadMissionHealth]);

  const handleJoinMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    if (!inviteCode.trim()) {
      setJoinError(t('home.inviteRequiredError'));
      return;
    }
    try {
      const res = await joinMissionApi(inviteCode.trim());
      setSessionData({
        user: authUser,
        mission: res.mission,
        derived: res.derived,
      });
      showToast(t('home.joinedToast', { name: res.mission.name }));
    } catch (err) {
      setJoinError(trError(err));
    }
  };

  if (authUser && !mission) {
    if (authUser.role === 'COMMANDER') {
      return <MissionSetupWizard />;
    }
    return (
      <section className="card hero-card" aria-labelledby="join-mission-heading">
        <h1 id="join-mission-heading">{t('home.joinMissionTitle')}</h1>
        <p className="muted-text">{t('home.joinMissionDesc')}</p>
        <form className="form-stack" onSubmit={(e) => void handleJoinMission(e)}>
          <div className="field">
            <label htmlFor="join-invite-input">{t('home.inviteCodeLabel')}</label>
            <input
              id="join-invite-input"
              type="text"
              dir="ltr"
              className="input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder={t('auth.invitePlaceholder')}
            />
          </div>
          {joinError && (
            <div className="form-error" role="alert">
              {joinError}
            </div>
          )}
          <div className="btn-row">
            <button type="submit" className="btn btn-primary">
              {t('home.joinMissionTitle')}
            </button>
          </div>
        </form>
      </section>
    );
  }

  const connectionBadge = isOfflineSim ? 'OFFLINE' : 'ONLINE';
  const unackAlerts = alerts.filter((a) => !a.acknowledgedAt);

  return (
    <>
      <section className="card hero-card" aria-labelledby="mission-overview-heading">
        <div className="section-header">
          <div>
            <h1 id="mission-overview-heading">
              {mission ? mission.name : t('home.missionOverview')}
            </h1>
            <p className="muted-text">{t('safety.readOnlyPrototype')}</p>
          </div>
          <Badge label={mission?.isDemo || !authUser ? 'SIMULATED DATA' : 'ACTIVE'} />
        </div>

        {mission && missionDerived ? (
          <>
            <dl className="kv-list">
              <div className="kv-row">
                <dt>{t('home.missionDayLabel')}</dt>
                <dd className="tabular-nums">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 260 }}>
                    <span>
                      {t('home.missionDayValue', {
                        day: formatNum(missionDerived.missionDay),
                        planned: formatNum(missionDerived.plannedDays),
                        percent: formatNum(missionDerived.progressPercent),
                      })}
                    </span>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={t('home.missionProgressLabel')}
                      aria-valuenow={missionDerived.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, missionDerived.progressPercent))}%`,
                        }}
                      />
                    </div>
                  </div>
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.distanceLabel')}</dt>
                <dd className="tabular-nums">
                  {(() => {
                    const dist = formatDistanceDisplay(
                      missionDerived.distanceKm,
                      preferences.units.distance
                    );
                    return (
                      <bdi dir="ltr">
                        {dist.formatted} {dist.unitLabel}
                      </bdi>
                    );
                  })()}{' '}
                  {missionDerived.distanceIsTemplateDefault && (
                    <Badge label="TEMPLATE_DEFAULT_DISTANCE" canonicalCode="INFORMATION" />
                  )}
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.oneWayDelayLabel')}</dt>
                <dd className="tabular-nums">
                  <bdi dir="ltr">{formatLightTime(missionDerived.oneWayLightSeconds)}</bdi>{' '}
                  {t('home.roundTripInline', {
                    rt: formatLightTime(missionDerived.roundTripLightSeconds),
                  })}
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.connectionLabel')}</dt>
                <dd>
                  <Badge label={connectionBadge} />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.lastSyncLabel')}</dt>
                <dd className="tabular-nums">
                  {missionDerived.lastSyncAt ? (
                    <bdi dir="ltr">
                      {formatUtcIso(missionDerived.lastSyncAt)} {t('app.utc')}
                    </bdi>
                  ) : (
                    t('home.notSyncedYet')
                  )}
                </dd>
              </div>
              {authUser?.role === 'COMMANDER' && (
                <div className="kv-row">
                  <dt>{t('home.crewInviteCode')}</dt>
                  <dd>
                    <strong>
                      <bdi dir="ltr">{mission.inviteCode}</bdi>
                    </strong>
                  </dd>
                </div>
              )}
            </dl>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCalcPopover((v) => !v)}
              >
                {t('home.howCalculated')}
              </button>
              <Link to="/calendar" className="btn btn-primary">
                {t('home.openCalendar')}
              </Link>
              <Link to="/telemetry" className="btn btn-secondary">
                {t('home.flightTelemetry')}
              </Link>
              <Link to="/assistant" className="btn btn-secondary">
                {t('home.guidedAssistant')}
              </Link>
            </div>

            {showCalcPopover && (
              <div className="banner" role="note">
                <strong>{t('home.formulasPrefix')}</strong> {t('home.formulasText')}
              </div>
            )}
          </>
        ) : (
          <>
            <dl className="kv-list">
              <div className="kv-row">
                <dt>{t('home.missionNameLabel')}</dt>
                <dd>
                  <Badge label="NOT_CONFIGURED" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.missionDayLabel')}</dt>
                <dd>
                  <Badge label="NOT_CONFIGURED" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.connectionLabel')}</dt>
                <dd>
                  <Badge label={connectionBadge} />
                  <span className="small-text">{t('home.simulatedWord')}</span>
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('home.lastSyncLabel')}</dt>
                <dd>
                  <Badge label="UNKNOWN" />
                </dd>
              </div>
            </dl>
            <div className="btn-row">
              <Link to="/assistant" className="btn btn-primary">
                {t('home.guidedHealthAssistant')}
              </Link>
              <Link to="/telemetry" className="btn btn-secondary">
                {t('home.flightTelemetry')}
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="section-block" aria-labelledby="home-health-heading">
        <div className="section-header">
          <h2 id="home-health-heading">{t('home.healthOverviewHeading')}</h2>
          <Link to="/health" className="btn btn-secondary">
            {t('home.viewAllHealth')}
          </Link>
        </div>

        {authUser && mission ? (
          <div className="card-grid">
            {HEALTH_CARDS_META.map((meta) => {
              const mine = readings.filter(
                (r) => r.userId === authUser.id && r.indicator === meta.indicator
              );
              const latest = mine[0] ?? null;
              const isStale =
                latest && Date.now() - latest.measuredAt > 86_400_000;
              return (
                <article key={meta.indicator} className="card">
                  <div className="metric-card-top">
                    <Link to={`/health/${meta.indicator}`} className="metric-title">
                      <span className="metric-icon" aria-hidden="true">
                        {meta.icon}
                      </span>
                      <span>{t(`indicators.${meta.indicator}.name`)}</span>
                    </Link>
                  </div>

                  {!latest ? (
                    <div className="empty-state" style={{ padding: 14 }}>
                      <p>{t('home.noReadingYet')}</p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setEntryIndicator(meta.indicator)}
                      >
                        {t('home.enterItNow')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="metric-value-line" dir="ltr">
                        <span className="metric-value tabular-nums">
                          {meta.indicator === 'bp'
                            ? `${latest.systolic}/${latest.diastolic}`
                            : latest.valueNumeric}
                        </span>
                        <span className="metric-unit">
                          {t(`indicators.${meta.indicator}.unit`)}
                        </span>
                      </div>
                      <div className="badge-row">
                        <Badge label={isStale ? 'STALE' : latest.dataQuality} />
                        <span className="small-text">
                          {trProvenance(latest.provenance)}
                        </span>
                      </div>
                      <p className="small-text tabular-nums">
                        <bdi dir="ltr">
                          {formatUtcIso(latest.measuredAt)} {t('app.utc')}
                        </bdi>
                      </p>
                      <div className="btn-row">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setEntryIndicator(meta.indicator)}
                        >
                          {t('home.logNew')}
                        </button>
                        <Link to={`/health/${meta.indicator}`} className="btn btn-secondary">
                          {t('home.details')}
                        </Link>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card-grid">
            {indicators.map((item) => {
              const displayValue =
                item.indicator === 'mood' && item.value === 'Calm'
                  ? t('indicators.moodDemoCalm')
                  : item.value;
              const displayUnit = t(`indicators.${item.indicator}.unit`);
              return (
                <Link
                  key={item.indicator}
                  to={`/health/${item.indicator}`}
                  className="card card-interactive"
                >
                  <div className="metric-card-top">
                    <span className="metric-title">
                      <span className="metric-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span>{t(`indicators.${item.indicator}.name`)}</span>
                    </span>
                  </div>
                  <div className="metric-value-line" dir="ltr">
                    <span className="metric-value tabular-nums">{displayValue}</span>
                    {displayUnit && <span className="metric-unit">{displayUnit}</span>}
                  </div>
                  <div className="badge-row">
                    <Badge label="SIMULATED DATA" />
                    <Badge label="NOT_CONFIGURED" />
                  </div>
                  <p className="small-text">{t('home.timestampSourceMissing')}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {(!authUser || authUser.role === 'COMMANDER') && (
        <section className="section-block" aria-labelledby="home-risks-heading">
          <div className="section-header">
            <h2 id="home-risks-heading">{t('home.missionRisksCommander')}</h2>
            <Link to="/risks" className="btn btn-secondary">
              {t('home.viewAllRisks')}
            </Link>
          </div>
          <div className="card-grid">
            {risks.map((risk) => (
              <Link
                key={risk.id}
                to={`/risks/${risk.id}`}
                className="card card-interactive"
              >
                <div className="metric-card-top">
                  <span className="metric-title">
                    <span className="metric-icon" aria-hidden="true">
                      {risk.icon}
                    </span>
                    <span>{t(`riskCategories.${risk.id}.name`)}</span>
                  </span>
                </div>
                <div className="badge-row">
                  <Badge label={authUser ? 'ACTIVE' : risk.status} />
                </div>
                <p className="small-text">
                  {authUser
                    ? t('home.openCommanderLog')
                    : t(`riskCategories.${risk.id}.note`)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section-block" aria-labelledby="home-alerts-heading">
        <div className="section-header">
          <h2 id="home-alerts-heading">{t('home.activeAlertsHeading')}</h2>
          {authUser && (
            <Link to="/alerts" className="btn btn-secondary">
              {t('home.openAlerts')}
            </Link>
          )}
        </div>
        {authUser ? (
          unackAlerts.length === 0 ? (
            <div className="empty-state">
              <p>{t('safety.noAlertActive')}</p>
            </div>
          ) : (
            <div className="section-block">
              {unackAlerts.slice(0, 3).map((a) => (
                <article key={a.id} className="card">
                  <div className="section-header">
                    <strong>
                      <bdi dir="ltr">{a.id}</bdi>
                    </strong>
                    <Badge label={a.severity} />
                  </div>
                  <p>{resolveKbText(a.titleKey, a.params, lang)}</p>
                </article>
              ))}
            </div>
          )
        ) : (
          <div className="empty-state">
            <p>{t('home.noActiveAlertsDemo')}</p>
          </div>
        )}
      </section>

      {entryIndicator && (
        <EntrySheet
          indicator={entryIndicator}
          protocol={
            protocols.find(
              (p) =>
                p.id ===
                HEALTH_CARDS_META.find((m) => m.indicator === entryIndicator)?.protocolId
            ) ?? null
          }
          onClose={() => setEntryIndicator(null)}
          onSaved={loadMissionHealth}
        />
      )}
    </>
  );
}
