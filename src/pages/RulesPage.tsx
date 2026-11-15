import { useEffect, useState } from 'react';
import { fetchRulesApi, updateRuleApi } from '../api/client';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { ReferenceRuleItem, RuleChangeLogItem } from '../types';

export function RulesPage() {
  const { authUser, showToast } = useAstra();
  const { lang, t, trError, formatUtcIso } = useI18n();
  const [rules, setRules] = useState<ReferenceRuleItem[]>([]);
  const [changeLog, setChangeLog] = useState<RuleChangeLogItem[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [customThreshold, setCustomThreshold] = useState('');
  const [customGuidance, setCustomGuidance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetchRulesApi()
      .then((res) => {
        setRules(res.rules);
        setChangeLog(res.changeLog);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const isDoctor = authUser?.role === 'DOCTOR';

  const startEdit = (rule: ReferenceRuleItem) => {
    setEditingRuleId(rule.id);
    setCustomThreshold(rule.customThreshold ?? rule.thresholdValue);
    setCustomGuidance(rule.customGuidance ?? resolveKbText(rule.nextStepKey, undefined, lang));
    setError(null);
  };

  const handleSave = async (ruleId: string) => {
    setError(null);
    try {
      await updateRuleApi(ruleId, {
        customThreshold: customThreshold.trim() || undefined,
        customGuidance: customGuidance.trim(),
      });
      setEditingRuleId(null);
      showToast(t('rules.updatedToast', { id: ruleId }));
      load();
    } catch (err) {
      setError(trError(err));
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('rules.title')}</h1>
          <p className="muted-text">{t('rules.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label="ACTIVE" />
        </div>
      </div>

      <div className="banner" role="note">
        {t('rules.editNoteBanner')}
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="section-block">
        {rules.map((rule) => {
          const isProto = rule.label === 'PROTOTYPE_DEFAULT';
          const isEditing = editingRuleId === rule.id;
          return (
            <article key={rule.id} className="card">
              <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <bdi dir="ltr">
                    <strong>{rule.id}</strong>
                  </bdi>
                  <span>{resolveKbText(rule.titleKey, undefined, lang)}</span>
                </div>
                <div className="badge-row">
                  <Badge label={rule.severity} />
                  <Badge label={rule.label} />
                  <Badge
                    label={rule.label === 'PROTOTYPE_DEFAULT' ? 'ACTIVE_PROTO' : 'ACTIVE_REF'}
                    canonicalCode="ACTIVE"
                  />
                </div>
              </div>

              <dl className="kv-list">
                <div className="kv-row">
                  <dt>{t('rules.threshold')}</dt>
                  <dd className="tabular-nums" dir="ltr">
                    <bdi dir="ltr">
                      {rule.customThreshold ?? rule.thresholdValue} ({rule.thresholdUnit})
                    </bdi>
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('rules.explanation')}</dt>
                  <dd>{resolveKbText(rule.explanationKey, undefined, lang)}</dd>
                </div>
                <div className="kv-row">
                  <dt>{t('rules.approvedNextStep')}</dt>
                  <dd>
                    {rule.customGuidance ? (
                      <>
                        <span>{rule.customGuidance}</span>{' '}
                        <Badge label="ORIGINAL_TEXT" canonicalCode="INFORMATION" />
                      </>
                    ) : (
                      resolveKbText(rule.nextStepKey, undefined, lang)
                    )}
                  </dd>
                </div>
                <div className="kv-row">
                  <dt>{t('rules.source')}</dt>
                  <dd>
                    <a
                      href={rule.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--cyan)', textDecoration: 'underline' }}
                    >
                      {resolveKbText(rule.sourceCitationKey, undefined, lang)}
                    </a>
                  </dd>
                </div>
              </dl>

              {isDoctor && isProto && !isEditing && (
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => startEdit(rule)}
                  >
                    {t('rules.editBtn')}
                  </button>
                </div>
              )}

              {isEditing && (
                <div className="form-stack" style={{ marginTop: 8 }}>
                  <div className="field">
                    <label htmlFor={`edit-th-${rule.id}`}>{t('rules.editThresholdLabel')}</label>
                    <input
                      id={`edit-th-${rule.id}`}
                      type="text"
                      className="input"
                      value={customThreshold}
                      onChange={(e) => setCustomThreshold(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-gd-${rule.id}`}>{t('rules.editGuidanceLabel')}</label>
                    <textarea
                      id={`edit-gd-${rule.id}`}
                      className="textarea"
                      value={customGuidance}
                      onChange={(e) => setCustomGuidance(e.target.value)}
                    />
                  </div>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleSave(rule.id)}
                    >
                      {t('rules.saveEditBtn')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingRuleId(null)}
                    >
                      {t('rules.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <section className="card" aria-labelledby="rule-audit-heading">
        <h2 id="rule-audit-heading">{t('rules.auditHeading')}</h2>
        {changeLog.length === 0 ? (
          <p className="muted-text">{t('rules.noRuleMods')}</p>
        ) : (
          <ul className="history-list">
            {changeLog.map((log) => (
              <li key={log.id} className="history-item">
                <span>
                  {t('rules.auditLine', {
                    ruleId: log.rule_id,
                    actor: log.changed_by_name ?? log.changed_by,
                    prev: log.previous_threshold ?? '',
                    next: log.new_threshold ?? '',
                  })}
                </span>
                <bdi className="history-time" dir="ltr">
                  {formatUtcIso(log.created_at)} UTC
                </bdi>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
