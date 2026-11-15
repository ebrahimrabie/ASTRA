import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createExportApi,
  fetchReportSummaryApi,
  getExportDownloadUrl,
} from '../api/client';
import { Badge } from '../components/Badge';
import { SleepChart } from '../components/SleepChart';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { ExportFormat, ExportSection, ReportSummaryResponse } from '../types';

type DatePreset = '7d' | '30d' | 'mission' | 'custom';

type ReportToggleKey =
  | 'completeness'
  | 'readings'
  | 'charts'
  | 'alerts'
  | 'compliance'
  | 'hazards'
  | 'problemReports'
  | 'audit'
  | 'baselines';

function toUtcDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function triggerAuthenticatedDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ReportsPage() {
  const { authUser, mission, isOfflineSim, showToast } = useAstra();
  const { lang, t, trStatus, trProvenance, trError, formatNum, formatUtcIso } = useI18n();

  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState<string>(() =>
    toUtcDateInput(Date.now() - 30 * 86_400_000)
  );
  const [customTo, setCustomTo] = useState<string>(() => toUtcDateInput(Date.now()));
  const [subjectUserId, setSubjectUserId] = useState<string>('');
  const [sections, setSections] = useState<Record<ReportToggleKey, boolean>>({
    completeness: true,
    readings: true,
    charts: true,
    alerts: true,
    compliance: true,
    hazards: true,
    problemReports: true,
    audit: true,
    baselines: true,
  });

  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ackUnencrypted, setAckUnencrypted] = useState(false);
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);

  const dateRangeMs = useMemo(() => {
    const now = Date.now();
    if (preset === '7d') {
      return { fromMs: now - 7 * 86_400_000, toMs: now };
    }
    if (preset === '30d') {
      return { fromMs: now - 30 * 86_400_000, toMs: now };
    }
    if (preset === 'mission' && mission) {
      const start = Date.parse(`${mission.startDateUtc}T00:00:00Z`);
      return {
        fromMs: Number.isFinite(start) ? start : now - 90 * 86_400_000,
        toMs: now,
      };
    }
    const parsedFrom = Date.parse(`${customFrom}T00:00:00Z`);
    const parsedTo = Date.parse(`${customTo}T23:59:59Z`);
    return {
      fromMs: Number.isFinite(parsedFrom) ? parsedFrom : now - 30 * 86_400_000,
      toMs: Number.isFinite(parsedTo) ? parsedTo : now,
    };
  }, [preset, mission, customFrom, customTo]);

  const loadSummary = useCallback(async () => {
    if (!authUser || !mission) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchReportSummaryApi({
        fromMs: dateRangeMs.fromMs,
        toMs: dateRangeMs.toMs,
        subjectUserId:
          authUser.role === 'DOCTOR' && subjectUserId ? subjectUserId : undefined,
      });
      setSummary(data);
    } catch (err) {
      setErrorMsg(trError(err));
    } finally {
      setLoading(false);
    }
  }, [authUser, mission, dateRangeMs, subjectUserId, trError]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const toggleSection = (key: ReportToggleKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleQuickExport = async (format: ExportFormat) => {
    if (!authUser || !mission) return;
    if (isOfflineSim) {
      setErrorMsg(t('settings.offlineOnlyErr'));
      return;
    }
    if (!ackUnencrypted) {
      setErrorMsg(t('reports.confirmUnencryptedErr'));
      return;
    }

    const include: ExportSection[] = [];
    if (sections.readings) include.push('daily_readings', 'activity_sessions');
    if (sections.alerts) include.push('alerts');
    if (sections.compliance) include.push('tasks');
    if (sections.baselines) include.push('baselines');
    if (sections.problemReports && authUser.role !== 'COMMANDER') {
      include.push('problem_reports');
    }
    if (sections.hazards && authUser.role === 'COMMANDER') {
      include.push('hazards');
    }
    if (sections.audit && authUser.role !== 'CREW') {
      include.push('audit_log');
    }
    if (include.length === 0) include.push('daily_readings');

    const scope =
      authUser.role === 'COMMANDER'
        ? 'mission'
        : authUser.role === 'DOCTOR'
          ? subjectUserId
            ? 'crew_member'
            : 'entire_crew'
          : 'my';

    setExportBusy(format);
    setErrorMsg('');
    try {
      const job = await createExportApi({
        scope,
        subjectUserId: scope === 'crew_member' ? subjectUserId : null,
        fromMs: dateRangeMs.fromMs,
        toMs: dateRangeMs.toMs,
        include,
        format,
        labelLanguage: lang,
      });
      if (job.status === 'READY') {
        triggerAuthenticatedDownload(getExportDownloadUrl(job.id), job.fileName);
        showToast(t('reports.exportReadyToast'));
      } else {
        showToast(t('reports.exportQueuedToast'));
      }
    } catch (err) {
      setErrorMsg(trError(err, 'settings.exportFailedErr'));
    } finally {
      setExportBusy(null);
    }
  };

  const formatReadingValue = (r: ReportSummaryResponse['readings'][number]) => {
    if (r.indicator === 'bp') {
      return `${r.systolic ?? '—'}/${r.diastolic ?? '—'} mmHg`;
    }
    if (r.indicator === 'hr') return `${r.valueNumeric ?? '—'} bpm`;
    if (r.indicator === 'sleep') return `${r.valueNumeric ?? '—'} h`;
    if (r.indicator === 'mood') return `${r.valueNumeric ?? '—'} / 5`;
    if (r.indicator === 'stress') return `${r.valueNumeric ?? '—'} / 100`;
    if (r.indicator === 'act') return `${r.valueNumeric ?? '—'} min`;
    return String(r.valueNumeric ?? '—');
  };

  const availableToggleKeys: ReportToggleKey[] = [
    'completeness',
    'readings',
    'charts',
    'alerts',
    'compliance',
    'baselines',
    ...(authUser?.role === 'COMMANDER' ? (['hazards'] as const) : []),
    ...(authUser?.role !== 'COMMANDER' ? (['problemReports'] as const) : []),
    ...(authUser?.role !== 'CREW' ? (['audit'] as const) : []),
  ];

  return (
    <>
      <div className="page-header no-print">
        <div className="page-header-left">
          <h1>{t('reports.title')}</h1>
          <p className="muted-text">{t('reports.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          {mission?.isDemo && <Badge label="DEMO DATA" />}
          {authUser && <Badge label={authUser.role} />}
          {summary && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
            >
              {t('reports.printBtn')}
            </button>
          )}
        </div>
      </div>

      {!authUser || !mission ? (
        <section className="empty-state">
          <p>{t('reports.authMissionRequired')}</p>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link to="/" className="btn btn-primary">
              {t('reports.goHomeBtn')}
            </Link>
            {!authUser && (
              <Link to="/login" className="btn btn-secondary">
                {t('auth.signInTitle')}
              </Link>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* Interactive Controls (hidden in @media print) */}
          <section className="card no-print" aria-labelledby="report-filters-heading">
            <h2 id="report-filters-heading">{t('reports.filtersHeading')}</h2>

            <div className="field">
              <label>{t('reports.dateRangeLabel')}</label>
              <div className="btn-row">
                {(['7d', '30d', 'mission', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={preset === p ? 'btn btn-primary' : 'btn btn-secondary'}
                    onClick={() => setPreset(p)}
                  >
                    {t(`reports.preset_${p}`)}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <div className="card-grid">
                <div className="field">
                  <label htmlFor="report-from-utc">{t('reports.fromUtc')}</label>
                  <input
                    id="report-from-utc"
                    type="date"
                    className="input"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="report-to-utc">{t('reports.toUtc')}</label>
                  <input
                    id="report-to-utc"
                    type="date"
                    className="input"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            {authUser.role === 'DOCTOR' && summary && (
              <div className="field">
                <label htmlFor="report-crew-select">{t('reports.crewFilterLabel')}</label>
                <select
                  id="report-crew-select"
                  className="input"
                  value={subjectUserId}
                  onChange={(e) => setSubjectUserId(e.target.value)}
                >
                  <option value="">{t('reports.allCrewOption')}</option>
                  {summary.roster.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({trStatus(m.role)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label>{t('reports.sectionsToggleLabel')}</label>
              <div className="card-grid">
                {availableToggleKeys.map((key) => (
                  <label key={key} className="toggle-row" style={{ cursor: 'pointer' }}>
                    <span>{t(`reports.sec_${key}`)}</span>
                    <input
                      type="checkbox"
                      checked={sections[key]}
                      onChange={() => toggleSection(key)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="banner" role="note">
              <p className="small-text" style={{ marginBottom: 8 }}>
                {t('reports.unencryptedNotice')}
              </p>
              <label
                className="toggle-row"
                style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: 10 }}
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
                disabled={isOfflineSim || exportBusy !== null || !ackUnencrypted}
                onClick={() => void handleQuickExport('json')}
              >
                {exportBusy === 'json' ? t('reports.exporting') : t('reports.exportJsonBtn')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isOfflineSim || exportBusy !== null || !ackUnencrypted}
                onClick={() => void handleQuickExport('csv_zip')}
              >
                {exportBusy === 'csv_zip'
                  ? t('reports.exporting')
                  : t('reports.exportCsvBtn')}
              </button>
              <Link to="/settings" className="btn btn-secondary">
                {t('reports.openExportWizard')}
              </Link>
            </div>
          </section>

          {errorMsg && (
            <div className="form-error no-print" role="alert">
              {errorMsg}
            </div>
          )}

          {loading && <p className="muted-text">{t('reports.loadingReport')}</p>}

          {summary && (
            <div className="section-block" id="printable-report">
              {/* Printable Report Header */}
              <section className="card" aria-labelledby="report-header-title">
                <div className="section-header">
                  <div>
                    <h2 id="report-header-title">{summary.mission.name}</h2>
                    <p className="muted-text">{t('safety.readOnlyPrototype')}</p>
                  </div>
                  <div className="badge-row">
                    {summary.mission.isDemo && <Badge label="DEMO DATA" />}
                    <Badge label={summary.viewerRole} />
                  </div>
                </div>
                <dl className="kv-list">
                  <div className="kv-row">
                    <dt>{t('reports.generatedAtLabel')}</dt>
                    <dd className="tabular-nums">
                      <bdi dir="ltr">
                        {formatUtcIso(summary.generatedAt)} {t('app.utc')}
                      </bdi>
                    </dd>
                  </div>
                  <div className="kv-row">
                    <dt>{t('reports.windowLabel')}</dt>
                    <dd className="tabular-nums">
                      <bdi dir="ltr">
                        {formatUtcIso(summary.fromMs).slice(0, 10)} →{' '}
                        {formatUtcIso(summary.toMs).slice(0, 10)} {t('app.utc')}
                      </bdi>
                    </dd>
                  </div>
                  <div className="kv-row">
                    <dt>{t('reports.missionDayLabel')}</dt>
                    <dd>
                      {t('home.missionDayValue', {
                        day: formatNum(summary.derived.missionDay),
                        planned: formatNum(summary.derived.plannedDays),
                        percent: formatNum(summary.derived.progressPercent),
                      })}
                    </dd>
                  </div>
                </dl>
                <div className="banner" role="note" style={{ marginTop: 10 }}>
                  {t('reports.honestyBanner')}
                </div>
              </section>

              {/* Commander Privacy Notice / Doctor Crew Completeness */}
              {summary.viewerRole === 'DOCTOR' && summary.crewSummary.length > 0 && (
                <section className="card" aria-labelledby="report-crew-summary-h">
                  <h2 id="report-crew-summary-h">{t('reports.doctorCrewSummaryTitle')}</h2>
                  <div className="card-grid">
                    {summary.crewSummary.map((c) => (
                      <article key={c.userId} className="card" style={{ backgroundColor: 'var(--bg2)' }}>
                        <div className="metric-card-top">
                          <strong>{c.name}</strong>
                          <Badge label={c.role} />
                        </div>
                        <p className="small-text">
                          {t('reports.crewSummaryLine', {
                            recorded: formatNum(c.recordedDays),
                            total: formatNum(c.totalDays),
                            readings: formatNum(c.readingsCount),
                            alerts: formatNum(c.openAlerts),
                          })}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Data Completeness */}
              {sections.completeness && (
                <section className="card" aria-labelledby="report-completeness-h">
                  <h2 id="report-completeness-h">{t('reports.sec_completeness')}</h2>
                  <div className="card-grid">
                    {summary.completeness.map((item) => (
                      <div
                        key={item.indicator}
                        className="card"
                        style={{ backgroundColor: 'var(--bg2)' }}
                      >
                        <div className="metric-card-top">
                          <strong>{t(`indicators.${item.indicator}.name`)}</strong>
                          <Badge
                            label={`${formatNum(item.daysRecorded)} / ${formatNum(item.totalDays)}`}
                            canonicalCode={
                              item.daysRecorded > 0 ? 'COMPLETED' : 'INSUFFICIENT DATA'
                            }
                          />
                        </div>
                        <p className="small-text">
                          {t('reports.daysRecordedLine', {
                            indicator: t(`indicators.${item.indicator}.name`),
                            recorded: formatNum(item.daysRecorded),
                            total: formatNum(item.totalDays),
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sleep Chart (stored only, zero extrapolation) */}
              {sections.charts && (
                <section className="card" aria-labelledby="report-charts-h">
                  <h2 id="report-charts-h">{t('reports.sec_charts')}</h2>
                  {summary.sleepSeries.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noStoredSleepChart')}</p>
                    </div>
                  ) : (
                    <SleepChart records={summary.sleepSeries} />
                  )}
                </section>
              )}

              {/* Stored Daily Readings */}
              {sections.readings && (
                <section className="card" aria-labelledby="report-readings-h">
                  <div className="section-header">
                    <h2 id="report-readings-h">{t('reports.sec_readings')}</h2>
                    <Badge label="SIMULATED DATA" />
                  </div>
                  {summary.readings.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noReadingsInWindow')}</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: 13,
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'start' }}>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colIndicator')}</th>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colValue')}</th>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colTimestampUtc')}</th>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colSource')}</th>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colQuality')}</th>
                            <th style={{ padding: '8px 6px' }}>{t('reports.colProvenance')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.readings.slice(0, 100).map((r) => (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '8px 6px' }}>
                                {t(`indicators.${r.indicator}.name`)}
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <bdi dir="ltr">{formatReadingValue(r)}</bdi>
                              </td>
                              <td style={{ padding: '8px 6px' }} className="tabular-nums">
                                <bdi dir="ltr">{formatUtcIso(r.measuredAt)}</bdi>
                              </td>
                              <td style={{ padding: '8px 6px' }}>{r.source}</td>
                              <td style={{ padding: '8px 6px' }}>
                                <Badge label={r.dataQuality} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                {trProvenance(r.provenance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Alerts */}
              {sections.alerts && (
                <section className="card" aria-labelledby="report-alerts-h">
                  <h2 id="report-alerts-h">{t('reports.sec_alerts')}</h2>
                  {summary.alerts.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noAlertsInWindow')}</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {summary.alerts.map((a) => (
                        <div key={a.id} className="history-item">
                          <div>
                            <strong>{t(a.titleKey, a.params)}</strong>
                            <div className="small-text">
                              <bdi dir="ltr">{a.measurementText}</bdi> • {a.source} •{' '}
                              <bdi dir="ltr">
                                {formatUtcIso(a.measuredAt)} {t('app.utc')}
                              </bdi>
                            </div>
                          </div>
                          <div className="badge-row">
                            <Badge label={a.severity} />
                            <Badge
                              label={a.acknowledgedAt ? 'COMPLETED' : 'PENDING'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Tasks Compliance */}
              {sections.compliance && (
                <section className="card" aria-labelledby="report-compliance-h">
                  <h2 id="report-compliance-h">{t('reports.sec_compliance')}</h2>
                  <p className="muted-text">
                    {t('reports.complianceSummaryLine', {
                      done: formatNum(summary.taskCompliance.done),
                      notDone: formatNum(summary.taskCompliance.notDone),
                      deferred: formatNum(summary.taskCompliance.deferred),
                      total: formatNum(summary.taskCompliance.total),
                    })}
                  </p>
                  {summary.viewerRole === 'COMMANDER' &&
                    summary.complianceByMember.length > 0 && (
                      <div className="history-list" style={{ marginTop: 8 }}>
                        {summary.complianceByMember.map((m) => (
                          <div key={m.userId} className="history-item">
                            <span>
                              {m.name} (<Badge label={m.role} />)
                            </span>
                            <span className="small-text">
                              {t('reports.memberComplianceCounts', {
                                done: formatNum(m.doneCount),
                                notDone: formatNum(m.notDoneCount),
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </section>
              )}

              {/* Commander-only Hazards */}
              {sections.hazards && summary.viewerRole === 'COMMANDER' && (
                <section className="card" aria-labelledby="report-hazards-h">
                  <h2 id="report-hazards-h">{t('reports.sec_hazards')}</h2>
                  {summary.hazards.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noHazardsInWindow')}</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {summary.hazards.map((h) => (
                        <div key={h.id} className="history-item">
                          <div>
                            <strong>{h.category}</strong> — {h.source}{' '}
                            <span className="small-text tabular-nums">
                              <bdi dir="ltr">
                                ({formatUtcIso(h.measuredAt)} {t('app.utc')})
                              </bdi>
                            </span>
                            {h.category === 'RADIATION' && (
                              <div className="small-text">
                                <bdi dir="ltr">
                                  {String(h.payload.absorbedRateMgyDay ?? '—')} mGy/day |{' '}
                                  {String(h.payload.effectiveRateMsvDay ?? '—')} mSv/day
                                </bdi>
                              </div>
                            )}
                          </div>
                          <Badge label={h.dataQuality} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Problem Reports (Doctor & Crew self only) */}
              {sections.problemReports && summary.viewerRole !== 'COMMANDER' && (
                <section className="card" aria-labelledby="report-problems-h">
                  <h2 id="report-problems-h">{t('reports.sec_problemReports')}</h2>
                  {summary.problemReports.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noProblemReportsInWindow')}</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {summary.problemReports.map((pr) => (
                        <div key={pr.id} className="history-item">
                          <div>
                            <strong>{pr.userName}</strong>:{' '}
                            <span>{pr.description}</span>
                            <div className="small-text tabular-nums">
                              <bdi dir="ltr">
                                {formatUtcIso(pr.measuredAt)} {t('app.utc')}
                              </bdi>
                            </div>
                          </div>
                          <Badge label={pr.urgent ? 'HIGH PRIORITY' : 'REVIEW'} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Baselines */}
              {sections.baselines && (
                <section className="card" aria-labelledby="report-baselines-h">
                  <h2 id="report-baselines-h">{t('reports.sec_baselines')}</h2>
                  <div className="history-list">
                    {summary.baselines.map((b) => (
                      <div key={b.indicator} className="history-item">
                        <span>
                          {t(`indicators.${b.indicator}.name`)} ({b.unit})
                        </span>
                        <Badge label={b.status} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Audit & Rule Change History */}
              {sections.audit && summary.viewerRole !== 'CREW' && (
                <section className="card" aria-labelledby="report-audit-h">
                  <h2 id="report-audit-h">{t('reports.sec_audit')}</h2>
                  {summary.ruleChanges.length === 0 ? (
                    <div className="empty-state">
                      <p>{t('reports.noRuleChangesInWindow')}</p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {summary.ruleChanges.map((rc) => (
                        <div key={rc.id} className="history-item">
                          <div>
                            <strong>{rc.rule_id}</strong> ({rc.changed_by_name ?? rc.changed_by})
                            <div className="small-text">
                              {rc.previous_threshold ?? '—'} → {rc.new_threshold ?? '—'}
                            </div>
                          </div>
                          <span className="small-text tabular-nums">
                            <bdi dir="ltr">{formatUtcIso(rc.created_at)}</bdi>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Printable Disclaimer Footer */}
              <footer className="card">
                <p className="small-text">
                  {t('safety.disclaimer')} — {resolveKbText('kb.sources.std3001_v2.title', undefined, lang)}
                </p>
              </footer>
            </div>
          )}
        </>
      )}
    </>
  );
}
