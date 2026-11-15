import { useEffect, useState } from 'react';
import {
  acknowledgeAlertApi,
  submitProblemReportApi,
} from '../api/client';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';

export function AlertsPage() {
  const { authUser, alerts, refreshAlerts, showToast } = useAstra();
  const { lang, t, trError, formatNum, formatUtcIso } = useI18n();
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshAlerts();
  }, [refreshAlerts]);

  const handleAck = async (id: string) => {
    try {
      await acknowledgeAlertApi(id);
      await refreshAlerts();
      showToast(t('alerts.ackToast', { id }));
    } catch (err) {
      showToast(trError(err, 'alerts.ackFailedToast'));
    }
  };

  const handleProblemReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 3) {
      setError(t('alerts.reportMinLenErr'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitProblemReportApi({
        urgent,
        description: description.trim(),
        measuredAt: Date.now(),
      });
      setDescription('');
      setUrgent(false);
      await refreshAlerts();
      showToast(t('alerts.reportSentToast', { id: res.alert.id }));
    } catch (err) {
      setError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('alerts.title')}</h1>
          <p className="muted-text">{t('alerts.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          {authUser && <Badge label={authUser.role} />}
        </div>
      </div>

      {authUser?.role !== 'DOCTOR' && (
        <section className="card" aria-labelledby="report-problem-heading">
          <h2 id="report-problem-heading">{t('alerts.reportHeading')}</h2>
          <p className="small-text">{t('alerts.reportHelp')}</p>
          <form className="form-stack" onSubmit={(e) => void handleProblemReport(e)}>
            <div className="field">
              <label htmlFor="problem-desc">{t('alerts.reportDescLabel')}</label>
              <textarea
                id="problem-desc"
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('alerts.reportPlaceholder')}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              <span>{t('alerts.urgentCheckbox')}</span>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? t('alerts.sending') : t('alerts.submitReport')}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="section-block" aria-labelledby="alerts-feed-heading">
        <h2 id="alerts-feed-heading">
          {t('alerts.feedHeading', { count: formatNum(alerts.length) })}
        </h2>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <p>{t('safety.noAlertActive')}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article key={alert.id} className="card">
              <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>
                    <bdi dir="ltr">{alert.id}</bdi>
                  </strong>
                  <span>{resolveKbText(alert.titleKey, alert.params, lang)}</span>
                </div>
                <div className="badge-row">
                  <Badge label={alert.severity} />
                  <Badge
                    label={alert.acknowledgedAt ? 'COMPLETED' : 'PENDING'}
                    canonicalCode={alert.acknowledgedAt ? 'COMPLETED' : 'PENDING'}
                  />
                </div>
              </div>

              <dl className="kv-list">
                <div className="kv-row">
                  <dt>{t('alerts.relatedMeasurement')}</dt>
                  <dd>
                    {alert.ruleId === 'R-REP-01' ? (
                      <>
                        <span>{alert.measurementText}</span>{' '}
                        <Badge label="ORIGINAL_TEXT" canonicalCode="INFORMATION" />
                      </>
                    ) : (
                      <bdi dir="ltr">{alert.measurementText}</bdi>
                    )}
                  </dd>
                </div>
                {alert.subjectUserName && (
                  <div className="kv-row">
                    <dt>{t('alerts.crewMember')}</dt>
                    <dd>{alert.subjectUserName}</dd>
                  </div>
                )}
                <div className="kv-row">
                  <dt>{t('alerts.timestamp')}</dt>
                  <dd className="tabular-nums">
                    <bdi dir="ltr">
                      {formatUtcIso(alert.measuredAt)} {t('app.utc')}
                    </bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('alerts.source')}</dt>
                  <dd>{alert.source}</dd>
                </div>
                <div className="kv-row">
                  <dt>{t('alerts.triggeredRule')}</dt>
                  <dd>
                    <bdi dir="ltr">{alert.ruleId}</bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('alerts.explanation')}</dt>
                  <dd>{resolveKbText(alert.explanationKey, undefined, lang)}</dd>
                </div>
                <div className="kv-row">
                  <dt>{t('alerts.approvedNextStep')}</dt>
                  <dd>
                    {alert.customGuidance ? (
                      <>
                        <span>{alert.customGuidance}</span>{' '}
                        <Badge label="ORIGINAL_TEXT" canonicalCode="INFORMATION" />
                      </>
                    ) : (
                      resolveKbText(alert.nextStepKey, undefined, lang)
                    )}
                  </dd>
                </div>
              </dl>

              {!alert.acknowledgedAt && (
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleAck(alert.id)}
                  >
                    {t('alerts.ackButton')}
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
