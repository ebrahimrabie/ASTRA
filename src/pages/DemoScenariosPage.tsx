import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FALLBACK_ENV_STATS,
  fetchDemoScenariosApi,
  loadDemoScenarioApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { Co2Chart } from '../components/Co2Chart';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import type { DemoScenarioItem, EnvSampleItem } from '../types';

function computeClientCo2Stats(rawSamples: EnvSampleItem[]) {
  const samples = [...rawSamples].sort((a, b) => a.sampledAt - b.sampledAt);
  if (samples.length === 0) {
    return {
      samples: [],
      sampleMean: null as number | null,
      coverageMinutes: 0,
      maxGapMinutes: 0,
      verifiedHourAverage: null as number | null,
      status: 'INSUFFICIENT DATA' as const,
    };
  }

  let maxGapMinutes = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const gap = Math.round((samples[i].sampledAt - samples[i - 1].sampledAt) / 60_000);
    if (gap > maxGapMinutes) maxGapMinutes = gap;
  }

  const total = samples.reduce((sum, s) => sum + s.value, 0);
  const sampleMean = Number((total / samples.length).toFixed(4));
  const coverageMinutes = Math.max(
    0,
    Math.round((samples[samples.length - 1].sampledAt - samples[0].sampledAt) / 60_000)
  );
  const isVerified =
    samples.length >= 5 && coverageMinutes >= 60 && maxGapMinutes <= 20;
  const verifiedHourAverage = isVerified ? sampleMean : null;

  let status: 'INSUFFICIENT DATA' | 'MONITOR' | 'ALERT' = 'INSUFFICIENT DATA';
  if (verifiedHourAverage !== null) {
    status = verifiedHourAverage > 3.0 ? 'ALERT' : 'MONITOR';
  }

  return {
    samples,
    sampleMean,
    coverageMinutes,
    maxGapMinutes,
    verifiedHourAverage,
    status,
  };
}

export function DemoScenariosPage() {
  const navigate = useNavigate();
  const { authUser, mission, refreshAlerts, refreshDerived, showToast } = useAstra();
  const { t, trError, formatNum, formatUtcIso } = useI18n();

  const [scenarios, setScenarios] = useState<DemoScenarioItem[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Scenario 3 live CO2 calculator (starts with exact 4 seeded samples)
  const [co2Samples, setCo2Samples] = useState<EnvSampleItem[]>(
    () => FALLBACK_ENV_STATS.samples
  );
  const [nextTimeUtc, setNextTimeUtc] = useState('10:00');
  const [nextMmHg, setNextMmHg] = useState('3.4');

  const isDemoAllowed = !authUser || Boolean(mission?.isDemo);

  const loadList = useCallback(async () => {
    try {
      const list = await fetchDemoScenariosApi();
      setScenarios(list);
    } catch (err) {
      setErrorMsg(trError(err));
    }
  }, [trError]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const co2Stats = useMemo(() => computeClientCo2Stats(co2Samples), [co2Samples]);

  const handleLoadScenario = async (item: DemoScenarioItem) => {
    if (!isDemoAllowed) {
      setErrorMsg(t('demoScenarios.realMissionBlocked'));
      return;
    }

    if (!authUser) {
      showToast(t('demoScenarios.previewNavigateToast', { id: formatNum(item.id) }));
      navigate(item.targetRoute);
      return;
    }

    setLoadingId(item.id);
    setErrorMsg('');
    try {
      const res = await loadDemoScenarioApi(item.id);
      await Promise.all([refreshAlerts(), refreshDerived()]);
      showToast(t('demoScenarios.loadedToast', { id: formatNum(item.id) }));

      if (item.id === 3) {
        setCo2Samples(FALLBACK_ENV_STATS.samples);
        setNextTimeUtc('10:00');
        setNextMmHg('3.4');
      }

      if (res.targetRoute && res.targetRoute !== '/demo-scenarios') {
        navigate(res.targetRoute);
      }
    } catch (err) {
      setErrorMsg(trError(err));
    } finally {
      setLoadingId(null);
    }
  };

  const handleAddCo2Sample = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(nextMmHg);
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(nextTimeUtc.trim());
    if (!timeMatch || !Number.isFinite(val) || val < 0 || val > 100) {
      setErrorMsg(t('demoScenarios.invalidCo2Input'));
      return;
    }
    setErrorMsg('');
    const hh = Number(timeMatch[1]);
    const mm = Number(timeMatch[2]);
    const sampledAt = Date.UTC(2026, 0, 1, hh, mm, 0, 0);
    setCo2Samples((prev) => [
      ...prev,
      {
        id: `demo-co2-${Date.now()}-${prev.length + 1}`,
        userId: 'demo',
        parameter: 'CO2',
        value: val,
        unit: 'mmHg',
        sampledAt,
      },
    ]);

    const nextDate = new Date(sampledAt + 15 * 60_000);
    setNextTimeUtc(
      `${String(nextDate.getUTCHours()).padStart(2, '0')}:${String(nextDate.getUTCMinutes()).padStart(2, '0')}`
    );
  };

  const handleResetCo2Samples = () => {
    setCo2Samples(FALLBACK_ENV_STATS.samples);
    setNextTimeUtc('10:00');
    setNextMmHg('3.4');
    setErrorMsg('');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('demoScenarios.title')}</h1>
          <p className="muted-text">{t('demoScenarios.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label="DEMO DATA" />
        </div>
      </div>

      <div className="banner" role="note">
        <strong>{t('demoScenarios.demoBannerTitle')}</strong> — {t('demoScenarios.demoBannerBody')}
      </div>

      {!isDemoAllowed ? (
        <section className="empty-state">
          <p>{t('demoScenarios.realMissionBlocked')}</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary">
              {t('reports.goHomeBtn')}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {errorMsg && (
            <div className="form-error" role="alert">
              {errorMsg}
            </div>
          )}

          <section className="card-grid" aria-label={t('demoScenarios.listAria')}>
            {scenarios.map((sc) => (
              <article key={sc.id} className="card">
                <div className="metric-card-top">
                  <Badge label={`#${formatNum(sc.id)}`} canonicalCode="INFORMATION" />
                  <Badge label="DEMO DATA" />
                </div>
                <h2 style={{ marginTop: 6 }}>{t(sc.titleKey)}</h2>
                <p className="muted-text">{t(sc.descKey)}</p>
                <div className="btn-row" style={{ marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loadingId !== null}
                    onClick={() => void handleLoadScenario(sc)}
                  >
                    {loadingId === sc.id
                      ? t('demoScenarios.loadingBtn')
                      : t('demoScenarios.loadBtn')}
                  </button>
                </div>
              </article>
            ))}
          </section>

          {/* Interactive Scenario 3 CO2 1-Hour Coverage Sandbox */}
          <section className="card" aria-labelledby="demo-co2-heading">
            <div className="section-header">
              <h2 id="demo-co2-heading">{t('demoScenarios.co2SandboxTitle')}</h2>
              <Badge label={co2Stats.status} />
            </div>
            <p className="muted-text">{t('demoScenarios.co2SandboxDesc')}</p>

            <div className="badge-row" style={{ marginBottom: 12 }}>
              <Badge
                label={t('demoScenarios.sampleCountBadge', {
                  count: formatNum(co2Stats.samples.length),
                })}
                canonicalCode="INFORMATION"
              />
              <Badge
                label={t('demoScenarios.coverageBadge', {
                  mins: formatNum(co2Stats.coverageMinutes),
                })}
                canonicalCode={
                  co2Stats.coverageMinutes >= 60 ? 'COMPLETED' : 'INSUFFICIENT DATA'
                }
              />
              <Badge
                label={t('demoScenarios.meanBadge', {
                  mean:
                    co2Stats.sampleMean !== null
                      ? co2Stats.sampleMean.toFixed(3)
                      : '—',
                })}
                canonicalCode={co2Stats.status}
              />
              <Badge
                label={
                  co2Stats.verifiedHourAverage !== null
                    ? t('demoScenarios.verifiedBadge', {
                        avg: co2Stats.verifiedHourAverage.toFixed(3),
                      })
                    : t('demoScenarios.unverifiedBadge')
                }
                canonicalCode={
                  co2Stats.verifiedHourAverage !== null
                    ? co2Stats.status
                    : 'INSUFFICIENT DATA'
                }
              />
            </div>

            <Co2Chart samples={co2Stats.samples} />

            <form
              className="form-stack"
              style={{ marginTop: 14 }}
              onSubmit={handleAddCo2Sample}
            >
              <div className="card-grid">
                <div className="field">
                  <label htmlFor="demo-co2-time">{t('demoScenarios.timeUtcLabel')}</label>
                  <input
                    id="demo-co2-time"
                    type="time"
                    className="input"
                    value={nextTimeUtc}
                    onChange={(e) => setNextTimeUtc(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="demo-co2-val">{t('demoScenarios.valueMmHgLabel')}</label>
                  <input
                    id="demo-co2-val"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    className="input"
                    value={nextMmHg}
                    onChange={(e) => setNextMmHg(e.target.value)}
                  />
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">
                  {t('demoScenarios.addSampleBtn')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetCo2Samples}
                >
                  {t('demoScenarios.resetSamplesBtn')}
                </button>
              </div>
            </form>

            <div className="history-list" style={{ marginTop: 12 }}>
              {co2Stats.samples.map((s) => (
                <div key={s.id} className="history-item">
                  <span>
                    <bdi dir="ltr">{formatUtcIso(s.sampledAt).slice(11, 16)} UTC</bdi>
                  </span>
                  <strong>
                    <bdi dir="ltr">
                      {s.value.toFixed(1)} {s.unit}
                    </bdi>
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
