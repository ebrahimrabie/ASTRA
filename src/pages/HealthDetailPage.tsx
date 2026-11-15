import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FALLBACK_HEALTH_INDICATORS,
  FALLBACK_SLEEP_RECORDS,
  fetchDailyReadingsApi,
  fetchHealthIndicators,
  fetchProtocolsApi,
  fetchRulesApi,
  fetchSleepRecords,
} from '../api/client';
import { Badge } from '../components/Badge';
import { EntrySheet } from '../components/EntrySheet';
import { BackArrowIcon } from '../components/Icons';
import { SleepChart } from '../components/SleepChart';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type {
  DailyReadingItem,
  HealthIndicatorItem,
  ProtocolItem,
  ReferenceRuleItem,
  SleepRecordItem,
} from '../types';

const INDICATOR_RULE_CATEGORY: Record<string, string> = {
  hr: 'HEART_RATE',
  bp: 'BLOOD_PRESSURE',
  sleep: 'SLEEP',
  mood: 'MOOD',
  stress: 'STRESS',
  act: 'ACTIVITY',
};

const INDICATOR_PROTOCOL_ID: Record<string, string> = {
  hr: 'PRT-HR',
  bp: 'PRT-BP',
  sleep: 'PRT-SLP',
  mood: 'PRT-MOOD',
  stress: 'PRT-STR',
  act: 'PRT-ACT',
};

export function HealthDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { demoUserId, authUser, mission } = useAstra();
  const { lang, t, trProvenance, formatNum, formatUtcIso } = useI18n();
  const [indicators, setIndicators] = useState<HealthIndicatorItem[]>(
    FALLBACK_HEALTH_INDICATORS
  );
  const [sleepRecords, setSleepRecords] = useState<SleepRecordItem[]>(
    FALLBACK_SLEEP_RECORDS
  );
  const [readings, setReadings] = useState<DailyReadingItem[]>([]);
  const [rules, setRules] = useState<ReferenceRuleItem[]>([]);
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [showEntry, setShowEntry] = useState(false);

  const loadMissionDetail = useCallback(() => {
    if (!authUser || !mission || !id) return;
    fetchDailyReadingsApi({ indicator: id })
      .then(setReadings)
      .catch(() => {});
    fetchRulesApi()
      .then((res) => {
        const cat = INDICATOR_RULE_CATEGORY[id];
        setRules(res.rules.filter((r) => r.category === cat));
      })
      .catch(() => {});
    fetchProtocolsApi()
      .then((list) => {
        const prtId = INDICATOR_PROTOCOL_ID[id];
        setProtocol(list.find((p) => p.id === prtId) ?? null);
      })
      .catch(() => {});
  }, [authUser, id, mission]);

  useEffect(() => {
    if (authUser) {
      loadMissionDetail();
      return;
    }
    if (!demoUserId) return;
    let active = true;
    fetchHealthIndicators(demoUserId)
      .then((data) => {
        if (active && data.length > 0) setIndicators(data);
      })
      .catch(() => {});

    if (id === 'sleep') {
      fetchSleepRecords(demoUserId)
        .then((records) => {
          if (active && records.length > 0) setSleepRecords(records);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [authUser, demoUserId, id, loadMissionDetail]);

  const indicatorMeta = indicators.find((item) => item.indicator === id);
  if (!indicatorMeta) {
    return (
      <section className="section-block">
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/health')}
          >
            <BackArrowIcon />
            <span>{t('health.backToHealth')}</span>
          </button>
        </div>
        <div className="empty-state">
          <h1>{t('health.indicatorNotFound')}</h1>
          <p>{t('health.indicatorNotFoundDesc')}</p>
        </div>
      </section>
    );
  }

  const typedId = id as 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
  const indicatorName = t(`indicators.${typedId}.name`);
  const indicatorUnit = t(`indicators.${typedId}.unit`);
  const latest = readings[0] ?? null;
  const isStale = latest && Date.now() - latest.measuredAt > 86_400_000;

  const sleepPlotRecords: SleepRecordItem[] =
    authUser && typedId === 'sleep'
      ? [...readings]
          .reverse()
          .map((r, idx) => ({
            day: t('health.entryIndex', { n: idx + 1 }),
            hours: r.valueNumeric ?? 0,
          }))
      : sleepRecords.map((r, idx) => ({
          ...r,
          day: t('health.dayIndex', { n: idx + 1 }),
        }));

  const demoValue =
    typedId === 'mood' && indicatorMeta.value === 'Calm'
      ? t('indicators.moodDemoCalm')
      : indicatorMeta.value;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/health')}
            >
              <BackArrowIcon />
              <span>{t('health.backToHealth')}</span>
            </button>
          </div>
          <h1>
            <span aria-hidden="true">{indicatorMeta.icon} </span>
            {indicatorName}
          </h1>
        </div>
        <div className="page-header-actions">
          <Badge label={authUser ? 'ACTIVE' : 'SIMULATED DATA'} />
          {authUser && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowEntry(true)}
            >
              {t('health.enterReading')}
            </button>
          )}
        </div>
      </div>

      {authUser && mission ? (
        <>
          <section className="card" aria-labelledby="indicator-value-heading">
            <h2 id="indicator-value-heading">{t('health.latestReading')}</h2>
            {!latest ? (
              <div className="empty-state">
                <p>{t('home.noReadingYet')}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setShowEntry(true)}
                >
                  {t('home.enterItNow')}
                </button>
              </div>
            ) : (
              <>
                <div className="metric-value-line" dir="ltr">
                  <span className="metric-value tabular-nums">
                    {typedId === 'bp'
                      ? `${latest.systolic}/${latest.diastolic}`
                      : latest.valueNumeric}
                  </span>
                  {indicatorUnit && <span className="metric-unit">{indicatorUnit}</span>}
                </div>
                <dl className="kv-list">
                  <div className="kv-row">
                    <dt>{t('health.timestampUtc')}</dt>
                    <dd className="tabular-nums">
                      <bdi dir="ltr">
                        {formatUtcIso(latest.measuredAt)} {t('app.utc')}
                      </bdi>
                    </dd>
                  </div>
                  <div className="kv-row">
                    <dt>{t('health.sourceDevice')}</dt>
                    <dd>
                      {latest.source}{' '}
                      {latest.deviceId ? <bdi dir="ltr">({latest.deviceId})</bdi> : ''}
                    </dd>
                  </div>
                  <div className="kv-row">
                    <dt>{t('health.dataQuality')}</dt>
                    <dd>
                      <Badge label={isStale ? 'STALE' : latest.dataQuality} />
                    </dd>
                  </div>
                  <div className="kv-row">
                    <dt>{t('health.provenanceLabel')}</dt>
                    <dd>{trProvenance(latest.provenance)}</dd>
                  </div>
                </dl>
              </>
            )}
          </section>

          <section className="card" aria-labelledby="indicator-history-heading">
            <h2 id="indicator-history-heading">
              {t('health.historyCount', { count: formatNum(readings.length) })}
            </h2>
            {typedId === 'sleep' && sleepPlotRecords.length > 0 && (
              <SleepChart records={sleepPlotRecords} />
            )}
            {readings.length === 0 ? (
              <p className="muted-text">{t('health.noEntriesYet')}</p>
            ) : (
              <ul className="history-list">
                {readings.map((r) => (
                  <li key={r.id} className="history-item">
                    <span>
                      <bdi dir="ltr">
                        {typedId === 'bp'
                          ? `${r.systolic}/${r.diastolic} mmHg`
                          : `${r.valueNumeric} ${indicatorUnit}`}
                      </bdi>
                      {r.context ? ` (${r.context})` : ''} • {r.source}
                    </span>
                    <span className="history-time">
                      <bdi dir="ltr">
                        {formatUtcIso(r.measuredAt)} {t('app.utc')}
                      </bdi>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="indicator-assessment-heading">
            <h2 id="indicator-assessment-heading">{t('health.activeRulesNoDiag')}</h2>
            <p className="small-text">{t('health.rulesLead')}</p>
            {rules.map((r) => (
              <div
                key={r.id}
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div className="section-header">
                  <strong>
                    <bdi dir="ltr">{r.id}</bdi>: {resolveKbText(r.titleKey, undefined, lang)}
                  </strong>
                  <div className="badge-row">
                    <Badge label={r.severity} />
                    <Badge label={r.label} />
                  </div>
                </div>
                <p className="small-text">
                  {t('health.nextStepPrefix')}{' '}
                  {r.customGuidance ? (
                    <>
                      <span>{r.customGuidance}</span>{' '}
                      <Badge label="ORIGINAL_TEXT" canonicalCode="INFORMATION" />
                    </>
                  ) : (
                    resolveKbText(r.nextStepKey, undefined, lang)
                  )}
                </p>
              </div>
            ))}
          </section>

          {protocol && (
            <section className="card" aria-labelledby="indicator-protocol-heading">
              <h2 id="indicator-protocol-heading">
                {resolveKbText(protocol.titleKey, undefined, lang)}
              </h2>
              <p className="small-text">
                {resolveKbText(protocol.safetyNoteKey, undefined, lang)}
              </p>
              <ol className="bullet-list">
                {protocol.steps.map((s) => (
                  <li key={s.id}>{resolveKbText(s.textKey, undefined, lang)}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="card" aria-labelledby="indicator-value-heading">
            <h2 id="indicator-value-heading" className="sr-only">
              {t('health.simDetailsHeading')}
            </h2>
            <div className="metric-value-line" dir="ltr">
              <span className="metric-value tabular-nums">{demoValue}</span>
              {indicatorUnit && <span className="metric-unit">{indicatorUnit}</span>}
            </div>
            <dl className="kv-list">
              <div className="kv-row">
                <dt>{t('health.timestamp')}</dt>
                <dd>
                  <Badge label="UNKNOWN" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('health.source')}</dt>
                <dd>
                  <Badge label="UNKNOWN" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('health.dataQuality')}</dt>
                <dd>
                  <Badge label="UNKNOWN" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('health.baseline')}</dt>
                <dd>
                  <Badge label="NOT_CONFIGURED" />
                </dd>
              </div>
              <div className="kv-row">
                <dt>{t('health.ruleStatus')}</dt>
                <dd>
                  <Badge label="NOT_CONFIGURED" />
                </dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby="indicator-history-heading">
            <h2 id="indicator-history-heading">{t('health.history')}</h2>
            {indicatorMeta.indicator === 'sleep' ? (
              <>
                <SleepChart records={sleepPlotRecords} />
                <p className="small-text">{t('health.sleepDemoCaption')}</p>
              </>
            ) : (
              <div className="empty-state">
                <p>{t('health.insufficientHistory')}</p>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="indicator-assessment-heading">
            <h2 id="indicator-assessment-heading">
              {t('health.assessmentExplanation')}
            </h2>
            <p className="muted-text">{t('safety.noRule')}</p>
          </section>
        </>
      )}

      {showEntry && (
        <EntrySheet
          indicator={typedId}
          protocol={protocol}
          onClose={() => setShowEntry(false)}
          onSaved={loadMissionDetail}
        />
      )}
    </>
  );
}
