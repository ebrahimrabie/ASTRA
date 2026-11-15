import { useState } from 'react';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';

export function AssistantPage() {
  const { authUser, alerts } = useAstra();
  const { lang, t, formatUtcIso } = useI18n();
  const [showExplanation, setShowExplanation] = useState(false);

  const activeAlerts = alerts.filter((a) => !a.acknowledgedAt);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('assistant.title')}</h1>
          <p className="muted-text">{t('assistant.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label={authUser ? 'ACTIVE' : 'NOT_CONFIGURED'} />
        </div>
      </div>

      <section className="card" aria-labelledby="assistant-scope-heading">
        <h2 id="assistant-scope-heading">{t('assistant.scopeHeading')}</h2>
        <p className="muted-text">{t('assistant.scopeDesc')}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowExplanation(true)}
          >
            {t('assistant.whyBtn')}
          </button>
        </div>
      </section>

      {showExplanation &&
        (activeAlerts.length === 0 ? (
          <section className="card" aria-labelledby="no-alert-heading">
            <div className="section-header">
              <h2 id="no-alert-heading">{t('assistant.noAlertHeading')}</h2>
              <Badge label={authUser ? 'ACTIVE' : 'NOT_CONFIGURED'} />
            </div>
            <p className="muted-text">
              {authUser ? t('assistant.noAlertsAuth') : t('assistant.noAlertsDemo')}
            </p>
          </section>
        ) : (
          activeAlerts.map((alert) => (
            <section
              key={alert.id}
              className="card"
              aria-label={t('assistant.explanationAria', { id: alert.id })}
            >
              <div className="section-header">
                <h2>
                  <bdi dir="ltr">{alert.id}</bdi> —{' '}
                  {resolveKbText(alert.titleKey, alert.params, lang)}
                </h2>
                <Badge label={alert.severity} />
              </div>
              <dl className="kv-list">
                <div className="kv-row">
                  <dt>{t('assistant.triggeredRule')}</dt>
                  <dd>
                    <bdi dir="ltr">{alert.ruleId}</bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.relatedMeasurement')}</dt>
                  <dd>
                    <bdi dir="ltr">{alert.measurementText}</bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.timestampUtc')}</dt>
                  <dd className="tabular-nums">
                    <bdi dir="ltr">
                      {formatUtcIso(alert.measuredAt)} {t('app.utc')}
                    </bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.source')}</dt>
                  <dd>{alert.source}</dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.explanation')}</dt>
                  <dd>{resolveKbText(alert.explanationKey, undefined, lang)}</dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.approvedNextStep')}</dt>
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
                <div className="kv-row">
                  <dt>{t('assistant.escalationContact')}</dt>
                  <dd>
                    {alert.targetRole === 'COMMANDER'
                      ? t('assistant.escCommander')
                      : t('assistant.escDoctor')}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('assistant.ackState')}</dt>
                  <dd>
                    <Badge
                      label={alert.acknowledgedAt ? 'COMPLETED' : 'PENDING'}
                      canonicalCode={alert.acknowledgedAt ? 'COMPLETED' : 'PENDING'}
                    />
                  </dd>
                </div>
              </dl>
            </section>
          ))
        ))}
    </>
  );
}
