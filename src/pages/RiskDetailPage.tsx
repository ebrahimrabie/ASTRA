import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FALLBACK_ENV_STATS,
  FALLBACK_RISKS,
  FALLBACK_SLEEP_RECORDS,
  fetchEnvStats,
  fetchHazardsApi,
  fetchInstrumentsApi,
  fetchRisks,
  fetchSleepRecords,
  submitHazardApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { Co2Chart } from '../components/Co2Chart';
import { BackArrowIcon } from '../components/Icons';
import { SleepChart } from '../components/SleepChart';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type {
  EnvStatsResponse,
  HazardEntryItem,
  InstrumentItem,
  RiskItem,
  SleepRecordItem,
} from '../types';

function formatUtcHhMm(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const CATEGORY_TO_RISK_ID: Record<HazardEntryItem['category'], string> = {
  RADIATION: 'rad',
  ENVIRONMENT: 'env',
  GRAVITY: 'grav',
  ISOLATION: 'iso',
  DISTANCE: 'dist',
};

export function RiskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    demoUserId,
    authUser,
    mission,
    refreshAlerts,
    refreshDerived,
    showToast,
  } = useAstra();
  const { lang, t, trStatus, trError, formatNum, formatUtcIso } = useI18n();

  const [risks, setRisks] = useState<RiskItem[]>(FALLBACK_RISKS);
  const [envStats, setEnvStats] = useState<EnvStatsResponse>(FALLBACK_ENV_STATS);
  const [sleepRecords, setSleepRecords] = useState<SleepRecordItem[]>(FALLBACK_SLEEP_RECORDS);
  const [entries, setEntries] = useState<HazardEntryItem[]>([]);
  const [aggregate, setAggregate] = useState<{
    crewCount: number;
    crewExerciseTotals: Array<{ userId: string; name: string; totalMinutes: number; sessions: number }>;
    recentPsychCheckinsCount: number;
  } | null>(null);
  const [radInstruments, setRadInstruments] = useState<InstrumentItem[]>([]);
  const [envInstruments, setEnvInstruments] = useState<InstrumentItem[]>([]);
  const [distInstruments, setDistInstruments] = useState<InstrumentItem[]>([]);

  // Common form states
  const [measuredIso, setMeasuredIso] = useState(() => new Date().toISOString().slice(0, 16));
  const [lateNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Radiation form
  const [radDetector, setRadDetector] = useState('CAD');
  const [radCustomDetector, setRadCustomDetector] = useState('');
  const [radLocation, setRadLocation] = useState('Node 2');
  const [radDeviceId, setRadDeviceId] = useState('');
  const [absorbedRate, setAbsorbedRate] = useState('0.25');
  const [effectiveRate, setEffectiveRate] = useState('0.35');
  const [accAbsorbed, setAccAbsorbed] = useState('4.5');
  const [accEffective, setAccEffective] = useState('6.2');
  const [priorCareer, setPriorCareer] = useState('0');
  const [solarStatus, setSolarStatus] = useState<'NONE' | 'SPE_IN_PROGRESS' | 'SPE_ENDED'>('NONE');
  const [solarNotes, setSolarNotes] = useState('');

  // Environment form
  const [envSource, setEnvSource] = useState('VEHICLE_MONITOR');
  const [envCustomSource, setEnvCustomSource] = useState('');
  const [co2Rows, setCo2Rows] = useState<Array<{ valueMmHg: string; offsetMin: number }>>([
    { valueMmHg: '2.4', offsetMin: -60 },
    { valueMmHg: '2.5', offsetMin: -45 },
    { valueMmHg: '2.6', offsetMin: -30 },
    { valueMmHg: '2.7', offsetMin: -15 },
    { valueMmHg: '2.7', offsetMin: 0 },
  ]);
  const [ppO2, setPpO2] = useState('150');
  const [totalPressure, setTotalPressure] = useState('101.3');
  const [diluentPercent, setDiluentPercent] = useState('79');
  const [tempC, setTempC] = useState('22');
  const [rhPercent, setRhPercent] = useState('45');
  const [ventStatus, setVentStatus] = useState<'NOMINAL' | 'DEGRADED' | 'OFF'>('NOMINAL');
  const [sevenDayCo2, setSevenDayCo2] = useState('2.1');

  // Gravity form
  const [gravityEnv, setGravityEnv] = useState('Microgravity (LEO)');
  const [weeklyExDays, setWeeklyExDays] = useState('6');

  // Isolation form
  const [groundSessions, setGroundSessions] = useState('3');
  const [daysSinceContact, setDaysSinceContact] = useState('2');

  // Distance form
  const [distanceKm, setDistanceKm] = useState('384400');
  const [commStatus, setCommStatus] = useState<'NOMINAL' | 'DEGRADED' | 'LOSS_OF_SIGNAL'>('NOMINAL');
  const [distSource, setDistSource] = useState('MISSION_UPLINK');
  const [distCustomSource, setDistCustomSource] = useState('');

  const loadCommanderData = useCallback(() => {
    if (!authUser || authUser.role !== 'COMMANDER' || !mission) return;
    const catMap: Record<string, string> = {
      rad: 'RADIATION',
      env: 'ENVIRONMENT',
      grav: 'GRAVITY',
      iso: 'ISOLATION',
      dist: 'DISTANCE',
    };
    const cat = id ? catMap[id] : undefined;
    fetchHazardsApi(cat)
      .then((res) => {
        setEntries(res.entries);
        setAggregate(res.aggregate);
      })
      .catch(() => {});
    fetchInstrumentsApi('RADIATION').then(setRadInstruments).catch(() => {});
    fetchInstrumentsApi('ENVIRONMENT').then(setEnvInstruments).catch(() => {});
    fetchInstrumentsApi('DISTANCE').then(setDistInstruments).catch(() => {});
  }, [authUser, id, mission]);

  useEffect(() => {
    if (authUser) {
      loadCommanderData();
      return;
    }
    if (!demoUserId) return;
    let active = true;
    fetchRisks(demoUserId)
      .then((data) => {
        if (active && data.length > 0) setRisks(data);
      })
      .catch(() => {});

    if (id === 'env') {
      fetchEnvStats(demoUserId)
        .then((stats) => {
          if (active) setEnvStats(stats);
        })
        .catch(() => {});
    }

    if (id === 'iso') {
      fetchSleepRecords(demoUserId)
        .then((records) => {
          if (active && records.length > 0) setSleepRecords(records);
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [authUser, demoUserId, id, loadCommanderData]);

  if (authUser && authUser.role !== 'COMMANDER') {
    return (
      <section className="card">
        <h1>{t('risks.commanderAccessRequired')}</h1>
        <p className="muted-text">{t('risks.commanderOnlyDesc')}</p>
      </section>
    );
  }

  const risk = risks.find((r) => r.id === id);
  if (!risk) {
    return (
      <section className="section-block">
        <div className="btn-row">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/risks')}>
            <BackArrowIcon /> {t('risks.backToRisks')}
          </button>
        </div>
        <div className="empty-state">
          <h1>{t('risks.notFound')}</h1>
        </div>
      </section>
    );
  }

  const submitCommanderHazard = async (body: Record<string, unknown>) => {
    setFormError(null);
    const measuredAt = Date.parse(`${measuredIso}:00.000Z`);
    if (Number.isNaN(measuredAt)) {
      setFormError(t('risks.invalidUtcErr'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitHazardApi({
        ...body,
        measuredAt,
        lateEntryNote: lateNote.trim() || undefined,
      });
      await refreshAlerts();
      await refreshDerived();
      loadCommanderData();
      showToast(
        res.alerts.length > 0
          ? t('risks.hazardSavedAlertsToast', { count: res.alerts.length })
          : t('risks.hazardSavedToast')
      );
    } catch (err) {
      setFormError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const latestEntry = entries[0] ?? null;

  const firstSampleTime =
    envStats.samples.length > 0 ? formatUtcHhMm(envStats.samples[0].sampledAt) : '—';
  const lastSampleTime = envStats.latest ? formatUtcHhMm(envStats.latest.sampledAt) : '—';

  const localizedRiskName = t(`riskCategories.${risk.id}.name`);
  const localizedRiskDesc = t(`riskCategories.${risk.id}.desc`);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/risks')}>
              <BackArrowIcon /> {t('risks.backToRisks')}
            </button>
          </div>
          <h1>
            <span aria-hidden="true">{risk.icon} </span>
            {localizedRiskName}
          </h1>
          <p className="muted-text">{localizedRiskDesc}</p>
        </div>
        <div className="page-header-actions">
          <Badge label={authUser ? 'COMMANDER' : risk.status} />
        </div>
      </div>

      {/* AUTHENTICATED COMMANDER RADIATION */}
      {authUser && id === 'rad' && (
        <>
          <section className="card" aria-labelledby="rad-edu-heading">
            <h2 id="rad-edu-heading">{t('risks.radEduHeading')}</h2>
            <p className="small-text">{t('risks.radEduBody')}</p>
          </section>

          {latestEntry && (
            <section className="stat-grid-3">
              <article className="card">
                <h3>{t('risks.careerEffTotal')}</h3>
                <div className="metric-value-line" dir="ltr">
                  <bdi dir="ltr" className="metric-value tabular-nums">
                    {String(latestEntry.computed.careerTotalMsv ?? 0)}
                  </bdi>
                  <bdi dir="ltr" className="metric-unit">
                    / 600 mSv ({String(latestEntry.computed.percentOfCareerLimit ?? 0)}%)
                  </bdi>
                </div>
                <p className="small-text tabular-nums">
                  {t('risks.remainingMsv', {
                    val: String(latestEntry.computed.remainingToCareerLimitMsv ?? 600),
                  })}
                </p>
              </article>
              <article className="card">
                <h3>{t('risks.trailing30dEff')}</h3>
                <div className="metric-value-line" dir="ltr">
                  <bdi dir="ltr" className="metric-value tabular-nums">
                    {String(latestEntry.computed.trailing30DayEffectiveMsv ?? 0)}
                  </bdi>
                  <bdi dir="ltr" className="metric-unit">
                    / 250 mSv ({String(latestEntry.computed.percentOf30DayRef ?? 0)}%)
                  </bdi>
                </div>
              </article>
              <article className="card">
                <h3>{t('risks.absorbedSeparate')}</h3>
                <div className="metric-value-line" dir="ltr">
                  <bdi dir="ltr" className="metric-value tabular-nums">
                    {String(
                      (latestEntry.payload as { missionAccumulatedAbsorbedMgy?: number })
                        .missionAccumulatedAbsorbedMgy ?? 0
                    )}
                  </bdi>
                  <span className="metric-unit">{t('risks.mGyMissionTotal')}</span>
                </div>
              </article>
            </section>
          )}

          <section className="card" aria-labelledby="rad-form-heading">
            <h2 id="rad-form-heading">{t('risks.weeklyRadEntry')}</h2>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const nowMs = Date.parse(`${measuredIso}:00.000Z`) || Date.now();
                const detInst = radInstruments.find((i) => i.code === radDetector);
                const detectorName =
                  radDetector === 'OTHER'
                    ? radCustomDetector.trim() || t('risks.otherInstrumentFallback')
                    : detInst
                      ? resolveKbText(detInst.nameKey, undefined, 'en')
                      : radDetector;
                void submitCommanderHazard({
                  category: 'RADIATION',
                  detector: detectorName,
                  detectorLocation: radLocation,
                  deviceId: radDeviceId.trim() || null,
                  periodStart: nowMs - 7 * 86_400_000,
                  periodEnd: nowMs,
                  absorbedRateMgyDay: Number(absorbedRate),
                  effectiveRateMsvDay: Number(effectiveRate),
                  missionAccumulatedAbsorbedMgy: Number(accAbsorbed),
                  missionAccumulatedEffectiveMsv: Number(accEffective),
                  priorCareerEffectiveMsv: Number(priorCareer),
                  solarEventStatus: solarStatus,
                  solarEventNotes: solarNotes.trim() || null,
                });
              }}
            >
              <div className="card-grid">
                <div className="field">
                  <label htmlFor="rad-det">{t('risks.detector')}</label>
                  <select
                    id="rad-det"
                    className="input"
                    value={radDetector}
                    onChange={(e) => setRadDetector(e.target.value)}
                  >
                    {radInstruments.map((i) => (
                      <option key={i.id} value={i.code}>
                        {resolveKbText(i.nameKey, undefined, lang)}
                      </option>
                    ))}
                  </select>
                </div>
                {radDetector === 'OTHER' && (
                  <div className="field">
                    <label htmlFor="rad-det-custom">{t('risks.customDetector')}</label>
                    <input
                      id="rad-det-custom"
                      className="input"
                      value={radCustomDetector}
                      onChange={(e) => setRadCustomDetector(e.target.value)}
                    />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="rad-loc">{t('risks.detectorLocation')}</label>
                  <input
                    id="rad-loc"
                    className="input"
                    value={radLocation}
                    onChange={(e) => setRadLocation(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-dev-id">{t('risks.detectorIdOpt')}</label>
                  <input
                    id="rad-dev-id"
                    className="input"
                    value={radDeviceId}
                    onChange={(e) => setRadDeviceId(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-abs-rate">{t('risks.absRateLabel')}</label>
                  <input
                    id="rad-abs-rate"
                    type="number"
                    step="0.01"
                    className="input"
                    value={absorbedRate}
                    onChange={(e) => setAbsorbedRate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-eff-rate">{t('risks.effRateLabel')}</label>
                  <input
                    id="rad-eff-rate"
                    type="number"
                    step="0.01"
                    className="input"
                    value={effectiveRate}
                    onChange={(e) => setEffectiveRate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-acc-abs">{t('risks.accAbsLabel')}</label>
                  <input
                    id="rad-acc-abs"
                    type="number"
                    step="0.1"
                    className="input"
                    value={accAbsorbed}
                    onChange={(e) => setAccAbsorbed(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-acc-eff">{t('risks.accEffLabel')}</label>
                  <input
                    id="rad-acc-eff"
                    type="number"
                    step="0.1"
                    className="input"
                    value={accEffective}
                    onChange={(e) => setAccEffective(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-prior">{t('risks.priorCareerLabel')}</label>
                  <input
                    id="rad-prior"
                    type="number"
                    step="0.1"
                    className="input"
                    value={priorCareer}
                    onChange={(e) => setPriorCareer(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rad-spe">{t('risks.solarStatusLabel')}</label>
                  <select
                    id="rad-spe"
                    className="input"
                    value={solarStatus}
                    onChange={(e) =>
                      setSolarStatus(
                        e.target.value as 'NONE' | 'SPE_IN_PROGRESS' | 'SPE_ENDED'
                      )
                    }
                  >
                    <option value="NONE">{t('risks.speNone')}</option>
                    <option value="SPE_IN_PROGRESS">{t('risks.speInProgress')}</option>
                    <option value="SPE_ENDED">{t('risks.speEnded')}</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="rad-notes">{t('risks.solarNotesLabel')}</label>
                <input
                  id="rad-notes"
                  className="input"
                  value={solarNotes}
                  onChange={(e) => setSolarNotes(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="rad-measured">{t('risks.measuredAtUtc')}</label>
                <div className="btn-row">
                  <input
                    id="rad-measured"
                    type="datetime-local"
                    className="input"
                    style={{ flex: 1 }}
                    value={measuredIso}
                    onChange={(e) => setMeasuredIso(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMeasuredIso(new Date().toISOString().slice(0, 16))}
                  >
                    {t('risks.now')}
                  </button>
                </div>
              </div>

              {formError && <div className="form-error">{formError}</div>}
              <div className="btn-row">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? t('risks.saving') : t('risks.saveRadEntry')}
                </button>
              </div>
            </form>
          </section>
        </>
      )}

      {/* AUTHENTICATED COMMANDER ENVIRONMENT */}
      {authUser && id === 'env' && (
        <>
          <div className="banner" role="note">
            {t('safety.readOnlyEnv')}
          </div>

          <section className="card" aria-labelledby="env-form-heading">
            <h2 id="env-form-heading">{t('risks.weeklyAtmoHeading')}</h2>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const baseMs = Date.parse(`${measuredIso}:00.000Z`) || Date.now();
                const inst = envInstruments.find((i) => i.code === envSource);
                const srcName =
                  envSource === 'OTHER'
                    ? envCustomSource.trim() || t('risks.otherInstrumentFallback')
                    : inst
                      ? resolveKbText(inst.nameKey, undefined, 'en')
                      : envSource;
                void submitCommanderHazard({
                  category: 'ENVIRONMENT',
                  source: srcName,
                  co2Samples: co2Rows.map((r) => ({
                    valueMmHg: Number(r.valueMmHg),
                    sampledAt: baseMs + r.offsetMin * 60_000,
                  })),
                  ppO2MmHg: ppO2 ? Number(ppO2) : null,
                  totalPressureKpa: totalPressure ? Number(totalPressure) : null,
                  diluentPercent: diluentPercent ? Number(diluentPercent) : null,
                  tempC: tempC ? Number(tempC) : null,
                  rhPercent: rhPercent ? Number(rhPercent) : null,
                  ventilationStatus: ventStatus,
                  sevenDayMeanCo2: sevenDayCo2 ? Number(sevenDayCo2) : null,
                });
              }}
            >
              <div className="field">
                <label htmlFor="env-source">{t('risks.atmoSource')}</label>
                <select
                  id="env-source"
                  className="input"
                  value={envSource}
                  onChange={(e) => setEnvSource(e.target.value)}
                >
                  {envInstruments.map((i) => (
                    <option key={i.id} value={i.code}>
                      {resolveKbText(i.nameKey, undefined, lang)}
                    </option>
                  ))}
                </select>
              </div>
              {envSource === 'OTHER' && (
                <div className="field">
                  <label htmlFor="env-custom">{t('risks.customAtmoSource')}</label>
                  <input
                    id="env-custom"
                    className="input"
                    value={envCustomSource}
                    onChange={(e) => setEnvCustomSource(e.target.value)}
                  />
                </div>
              )}

              <div>
                <strong>{t('risks.co2SamplesHeading')}</strong>
                <div className="card-grid" style={{ marginTop: 8 }}>
                  {co2Rows.map((row, idx) => (
                    <div key={idx} className="field">
                      <label htmlFor={`co2-s-${idx}`}>
                        {t('risks.sampleOffset', {
                          index: formatNum(idx + 1),
                          offset: row.offsetMin >= 0 ? `+${row.offsetMin}` : String(row.offsetMin),
                        })}
                      </label>
                      <input
                        id={`co2-s-${idx}`}
                        type="number"
                        step="0.05"
                        className="input"
                        value={row.valueMmHg}
                        onChange={(e) => {
                          const next = [...co2Rows];
                          next[idx] = { ...row, valueMmHg: e.target.value };
                          setCo2Rows(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-grid">
                <div className="field">
                  <label htmlFor="env-ppo2">{t('risks.ppo2Label')}</label>
                  <input
                    id="env-ppo2"
                    type="number"
                    step="0.1"
                    className="input"
                    value={ppO2}
                    onChange={(e) => setPpO2(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="env-press">
                    {t('risks.pressureLabel', { unit: 'kPa, 34.5–103' })}
                  </label>
                  <input
                    id="env-press"
                    type="number"
                    step="0.1"
                    className="input"
                    value={totalPressure}
                    onChange={(e) => setTotalPressure(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="env-diluent">{t('risks.diluentLabel')}</label>
                  <input
                    id="env-diluent"
                    type="number"
                    step="0.1"
                    className="input"
                    value={diluentPercent}
                    onChange={(e) => setDiluentPercent(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="env-temp">
                    {t('risks.tempLabel', { unit: '°C, 20–25' })}
                  </label>
                  <input
                    id="env-temp"
                    type="number"
                    step="0.5"
                    className="input"
                    value={tempC}
                    onChange={(e) => setTempC(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="env-rh">{t('risks.rhLabel')}</label>
                  <input
                    id="env-rh"
                    type="number"
                    step="1"
                    className="input"
                    value={rhPercent}
                    onChange={(e) => setRhPercent(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="env-vent">{t('risks.ventLabel')}</label>
                  <select
                    id="env-vent"
                    className="input"
                    value={ventStatus}
                    onChange={(e) =>
                      setVentStatus(e.target.value as 'NOMINAL' | 'DEGRADED' | 'OFF')
                    }
                  >
                    <option value="NOMINAL">{t('risks.ventNominal')}</option>
                    <option value="DEGRADED">{t('risks.ventDegraded')}</option>
                    <option value="OFF">{t('risks.ventOff')}</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="env-7d">{t('risks.sevenDayCo2Label')}</label>
                  <input
                    id="env-7d"
                    type="number"
                    step="0.1"
                    className="input"
                    value={sevenDayCo2}
                    onChange={(e) => setSevenDayCo2(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="env-measured">{t('risks.measuredAtUtc')}</label>
                <div className="btn-row">
                  <input
                    id="env-measured"
                    type="datetime-local"
                    className="input"
                    style={{ flex: 1 }}
                    value={measuredIso}
                    onChange={(e) => setMeasuredIso(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMeasuredIso(new Date().toISOString().slice(0, 16))}
                  >
                    {t('risks.now')}
                  </button>
                </div>
              </div>

              {formError && <div className="form-error">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? t('risks.saving') : t('risks.saveEnvLog')}
              </button>
            </form>
          </section>

          {latestEntry && (
            <section className="card">
              <h2>{t('risks.latestCo2Heading')}</h2>
              <p className="small-text">
                {t('risks.co2AnalysisSummary', {
                  count: formatNum(Number(latestEntry.computed.sampleCount ?? 0)),
                  minutes: String(latestEntry.computed.coverageMinutes ?? 0),
                  avg:
                    latestEntry.computed.verifiedHourAverage !== null
                      ? t('risks.co2VerifiedAvgUnit', {
                          value: String(latestEntry.computed.verifiedHourAverage),
                        })
                      : trStatus('INSUFFICIENT DATA'),
                })}
              </p>
            </section>
          )}
        </>
      )}

      {/* AUTHENTICATED COMMANDER GRAVITY */}
      {authUser && id === 'grav' && (
        <>
          <section className="card">
            <h2>{t('risks.weeklyGravHeading')}</h2>
            <p className="small-text">{t('risks.gravRefDesc')}</p>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCommanderHazard({
                  category: 'GRAVITY',
                  gravityEnvironment: gravityEnv,
                  weeklyExerciseDays: Number(weeklyExDays),
                  source: 'Onboard navigation display',
                });
              }}
            >
              <div className="field">
                <label htmlFor="grav-env">{t('risks.gravEnvLabel')}</label>
                <input
                  id="grav-env"
                  className="input"
                  value={gravityEnv}
                  onChange={(e) => setGravityEnv(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="grav-days">{t('risks.weeklyExDaysLabel')}</label>
                <input
                  id="grav-days"
                  type="number"
                  min={0}
                  max={7}
                  className="input"
                  value={weeklyExDays}
                  onChange={(e) => setWeeklyExDays(e.target.value)}
                />
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('risks.saveGravEntry')}
              </button>
            </form>
          </section>

          {aggregate && aggregate.crewExerciseTotals.length > 0 && (
            <section className="card">
              <h2>{t('risks.crewExTotalsHeading')}</h2>
              <ul className="history-list">
                {aggregate.crewExerciseTotals.map((c) => (
                  <li key={c.userId} className="history-item">
                    <span>{c.name}</span>
                    <span className="tabular-nums">
                      {t('risks.crewExItem', {
                        minutes: formatNum(c.totalMinutes),
                        sessions: formatNum(c.sessions),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* AUTHENTICATED COMMANDER ISOLATION (AGGREGATE ONLY) */}
      {authUser && id === 'iso' && (
        <>
          <div className="banner" role="note">
            {t('risks.isoPrivacyBanner')}
          </div>

          {aggregate && (
            <section className="card">
              <h2>{t('risks.aggCheckinHeading')}</h2>
              <p className="tabular-nums">
                {t('risks.aggCheckinText', {
                  count: formatNum(aggregate.recentPsychCheckinsCount),
                  total: formatNum(aggregate.crewCount),
                })}
              </p>
            </section>
          )}

          <section className="card">
            <h2>{t('risks.weeklyIsoHeading')}</h2>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCommanderHazard({
                  category: 'ISOLATION',
                  groundContactSessions: Number(groundSessions),
                  daysSinceLastContact: Number(daysSinceContact),
                  source: 'Mission control uplink',
                });
              }}
            >
              <div className="field">
                <label htmlFor="iso-sessions">{t('risks.groundSessionsLabel')}</label>
                <input
                  id="iso-sessions"
                  type="number"
                  min={0}
                  className="input"
                  value={groundSessions}
                  onChange={(e) => setGroundSessions(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="iso-days">{t('risks.daysSinceContactLabel')}</label>
                <input
                  id="iso-days"
                  type="number"
                  min={0}
                  className="input"
                  value={daysSinceContact}
                  onChange={(e) => setDaysSinceContact(e.target.value)}
                />
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('risks.saveIsoEntry')}
              </button>
            </form>
          </section>
        </>
      )}

      {/* AUTHENTICATED COMMANDER DISTANCE */}
      {authUser && id === 'dist' && (
        <section className="card">
          <h2>{t('risks.weeklyDistHeading')}</h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const inst = distInstruments.find((i) => i.code === distSource);
              const src =
                distSource === 'OTHER'
                  ? distCustomSource.trim() || t('risks.otherInstrumentFallback')
                  : inst
                    ? resolveKbText(inst.nameKey, undefined, 'en')
                    : distSource;
              void submitCommanderHazard({
                category: 'DISTANCE',
                distanceKm: Number(distanceKm),
                commStatus,
                source: src,
              });
            }}
          >
            <div className="field">
              <label htmlFor="dist-km">{t('risks.distKmLabel')}</label>
              <input
                id="dist-km"
                type="number"
                step="0.1"
                min={0}
                className="input"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="dist-comm">{t('risks.commStatusLabel')}</label>
              <select
                id="dist-comm"
                className="input"
                value={commStatus}
                onChange={(e) =>
                  setCommStatus(
                    e.target.value as 'NOMINAL' | 'DEGRADED' | 'LOSS_OF_SIGNAL'
                  )
                }
              >
                <option value="NOMINAL">{t('risks.commNominal')}</option>
                <option value="DEGRADED">{t('risks.commDegraded')}</option>
                <option value="LOSS_OF_SIGNAL">{t('risks.commLoss')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="dist-src">{t('risks.sourceLabel')}</label>
              <select
                id="dist-src"
                className="input"
                value={distSource}
                onChange={(e) => setDistSource(e.target.value)}
              >
                {distInstruments.map((i) => (
                  <option key={i.id} value={i.code}>
                    {resolveKbText(i.nameKey, undefined, lang)}
                  </option>
                ))}
              </select>
            </div>
            {distSource === 'OTHER' && (
              <div className="field">
                <label htmlFor="dist-custom">{t('risks.customDistSource')}</label>
                <input
                  id="dist-custom"
                  className="input"
                  value={distCustomSource}
                  onChange={(e) => setDistCustomSource(e.target.value)}
                />
              </div>
            )}
            {formError && <div className="form-error">{formError}</div>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {t('risks.updateDistBtn')}
            </button>
          </form>
        </section>
      )}

      {/* DEMO MODE FALLBACK VIEWS */}
      {!authUser && id === 'rad' && (
        <section className="card" aria-labelledby="rad-unavail-heading">
          <h2 id="rad-unavail-heading">{t('risks.radUnavailable')}</h2>
          <dl className="kv-list">
            <div className="kv-row">
              <dt>{t('risks.absorbedDoseGy')}</dt>
              <dd><Badge label="UNKNOWN" /></dd>
            </div>
            <div className="kv-row">
              <dt>{t('risks.effectiveDoseSv')}</dt>
              <dd><Badge label="UNKNOWN" /></dd>
            </div>
          </dl>
          <p className="small-text">{t('risks.radSeparateNote')}</p>
        </section>
      )}

      {!authUser && id === 'iso' && (
        <>
          <div className="banner" role="note">
            {t('risks.isoPrivateBanner')}
          </div>
          <section className="card">
            <div className="section-header">
              <h2>{t('risks.sleepTrend')}</h2>
              <Badge label="SIMULATED DATA" />
            </div>
            <SleepChart records={sleepRecords} />
          </section>
        </>
      )}

      {!authUser && id === 'env' && (
        <>
          <div className="banner" role="note">
            {t('safety.readOnlyEnv')}
          </div>
          <section className="card" aria-labelledby="env-co2-chart-heading">
            <div className="section-header">
              <h2 id="env-co2-chart-heading">{t('risks.co2SimChartTitle')}</h2>
              <Badge label="SIMULATED DATA" />
            </div>
            <Co2Chart samples={envStats.samples} />
          </section>
          <section className="stat-grid-3" aria-label={t('risks.co2SummaryMetricsAria')}>
            <article className="card">
              <h3>{t('risks.instantaneousReading')}</h3>
              <div className="metric-value-line" dir="ltr">
                <bdi dir="ltr" className="metric-value tabular-nums">
                  {envStats.latest ? envStats.latest.value.toFixed(1) : '—'}
                </bdi>
                <span className="metric-unit">{envStats.latest?.unit ?? 'mmHg'}</span>
              </div>
              <p className="small-text">
                {t('risks.oneSampleSuffix', { time: lastSampleTime })}
              </p>
            </article>
            <article className="card">
              <h3>{t('risks.illustrativeMean')}</h3>
              <div className="metric-value-line" dir="ltr">
                <bdi dir="ltr" className="metric-value tabular-nums">
                  {envStats.sampleMean !== null ? envStats.sampleMean.toString() : '—'}
                </bdi>
                <span className="metric-unit">mmHg</span>
              </div>
              <p className="small-text">
                {t('risks.meanOfSamplesNote', { count: formatNum(envStats.samples.length) })}
              </p>
            </article>
            <article className="card">
              <h3>{t('risks.verified1hAvg')}</h3>
              <div className="badge-row"><Badge label="INSUFFICIENT DATA" /></div>
              <p className="small-text">
                {t('risks.windowCoverage', {
                  first: firstSampleTime,
                  last: lastSampleTime,
                  minutes: formatNum(envStats.coverageMinutes),
                })}
              </p>
            </article>
          </section>
        </>
      )}

      {!authUser && (id === 'grav' || id === 'dist') && (
        <section className="card">
          <p className="muted-text">{t('risks.demoSignInCommander')}</p>
        </section>
      )}

      {authUser && entries.length > 0 && (
        <section className="card">
          <h2>{t('risks.recordedEntriesHeading', { count: formatNum(entries.length) })}</h2>
          <ul className="history-list">
            {entries.map((entry) => {
              const riskId = CATEGORY_TO_RISK_ID[entry.category];
              const categoryName = riskId
                ? t(`riskCategories.${riskId}.name`)
                : entry.category;
              return (
                <li key={entry.id} className="history-item">
                  <span>
                    {t('risks.recordedEntryLine', {
                      category: categoryName,
                      source: entry.source,
                      quality: trStatus(entry.dataQuality),
                    })}
                  </span>
                  <bdi className="history-time" dir="ltr">
                    {formatUtcIso(entry.measuredAt)} UTC
                  </bdi>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
