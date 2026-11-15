import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FALLBACK_HEALTH_INDICATORS,
  fetchDailyReadingsApi,
  fetchHealthIndicators,
  fetchMissionRosterApi,
  fetchProtocolsApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { EntrySheet } from '../components/EntrySheet';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import type {
  DailyReadingItem,
  HealthIndicatorItem,
  ProtocolItem,
  UserRole,
} from '../types';

const INDICATORS_META: Array<{
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

export function HealthListPage() {
  const { demoUserId, authUser, mission } = useAstra();
  const { t } = useI18n();
  const [indicators, setIndicators] = useState<HealthIndicatorItem[]>(
    FALLBACK_HEALTH_INDICATORS
  );
  const [readings, setReadings] = useState<DailyReadingItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [roster, setRoster] = useState<Array<{ userId: string; name: string; role: UserRole }>>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string>('');
  const [entryIndicator, setEntryIndicator] = useState<
    'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act' | null
  >(null);

  const loadMissionData = useCallback(() => {
    if (!authUser || !mission) return;
    fetchDailyReadingsApi(
      authUser.role === 'DOCTOR' && selectedCrewId
        ? { subjectUserId: selectedCrewId }
        : undefined
    )
      .then(setReadings)
      .catch(() => {});
    fetchProtocolsApi()
      .then(setProtocols)
      .catch(() => {});
    if (authUser.role === 'DOCTOR') {
      fetchMissionRosterApi()
        .then(setRoster)
        .catch(() => {});
    }
  }, [authUser, mission, selectedCrewId]);

  useEffect(() => {
    if (authUser) {
      loadMissionData();
      return;
    }
    if (!demoUserId) return;
    let active = true;
    fetchHealthIndicators(demoUserId)
      .then((data) => {
        if (active && data.length > 0) setIndicators(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authUser, demoUserId, loadMissionData]);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('health.title')}</h1>
          <p className="muted-text">
            {authUser ? t('health.subtitleAuth') : t('health.subtitleDemo')}
          </p>
        </div>
        <div className="page-header-actions">
          <Badge label={authUser ? 'ACTIVE' : 'SIMULATED DATA'} />
        </div>
      </div>

      {authUser?.role === 'DOCTOR' && roster.length > 0 && (
        <section className="card">
          <div className="field">
            <label htmlFor="doctor-crew-filter">{t('health.viewCrewLabel')}</label>
            <select
              id="doctor-crew-filter"
              className="input"
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
            >
              <option value="">{t('health.allCrewOption')}</option>
              {roster.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({t(`roles.${m.role}`)})
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      {authUser && mission ? (
        <div className="card-grid">
          {INDICATORS_META.map((meta) => {
            const matching = readings.filter((r) => r.indicator === meta.indicator);
            const latest = matching[0] ?? null;
            const isStale = latest && Date.now() - latest.measuredAt > 86_400_000;
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
                      <span className="small-text">{latest.source}</span>
                    </div>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEntryIndicator(meta.indicator)}
                      >
                        {t('health.enterReading')}
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
            const displayVal =
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
                  <span className="metric-value tabular-nums">{displayVal}</span>
                  {displayUnit && <span className="metric-unit">{displayUnit}</span>}
                </div>
                <div className="badge-row">
                  <Badge label="SIMULATED DATA" />
                  <Badge label="NOT_CONFIGURED" />
                </div>
                <p className="small-text">{t('health.sourceNotSupplied')}</p>
              </Link>
            );
          })}
        </div>
      )}

      {entryIndicator && (
        <EntrySheet
          indicator={entryIndicator}
          protocol={
            protocols.find(
              (p) =>
                p.id ===
                INDICATORS_META.find((m) => m.indicator === entryIndicator)?.protocolId
            ) ?? null
          }
          onClose={() => setEntryIndicator(null)}
          onSaved={loadMissionData}
        />
      )}
    </>
  );
}
