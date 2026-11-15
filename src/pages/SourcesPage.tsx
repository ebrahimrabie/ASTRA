import { useEffect, useState } from 'react';
import { fetchSourcesApi } from '../api/client';
import { Badge } from '../components/Badge';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { DataProvenance, DataSourceItem, ReferenceRuleItem } from '../types';

export function SourcesPage() {
  const { lang, t, trProvenance, formatNum } = useI18n();
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [rules, setRules] = useState<ReferenceRuleItem[]>([]);
  const [provenance, setProvenance] = useState<Record<DataProvenance, number>>({
    'Self-reported': 0,
    'Manual entry': 0,
    'Offline-queued': 0,
  });

  useEffect(() => {
    fetchSourcesApi()
      .then((res) => {
        setSources(res.sources);
        setRules(res.rules);
        setProvenance(res.provenanceCounts);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('sources.title')}</h1>
          <p className="muted-text">{t('sources.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label="NASA REFERENCE" />
        </div>
      </div>

      <div className="banner" role="alert">
        {t('safety.std3001Warning')}
      </div>

      <section className="stat-grid-3" aria-label={t('sources.provenanceAria')}>
        <article className="card">
          <h3>{trProvenance('Self-reported')}</h3>
          <div className="metric-value tabular-nums">{formatNum(provenance['Self-reported'])}</div>
          <p className="small-text">{t('sources.selfReportedDesc')}</p>
        </article>
        <article className="card">
          <h3>{trProvenance('Manual entry')}</h3>
          <div className="metric-value tabular-nums">{formatNum(provenance['Manual entry'])}</div>
          <p className="small-text">{t('sources.manualEntryDesc')}</p>
        </article>
        <article className="card">
          <h3>{trProvenance('Offline-queued')}</h3>
          <div className="metric-value tabular-nums">{formatNum(provenance['Offline-queued'])}</div>
          <p className="small-text">{t('sources.offlineQueuedDesc')}</p>
        </article>
      </section>

      <section className="section-block" aria-labelledby="source-docs-heading">
        <h2 id="source-docs-heading">{t('sources.docsHeading')}</h2>
        <div className="card-grid">
          {sources.map((src) => (
            <article key={src.id} className="card">
              <div className="metric-card-top">
                <bdi dir="ltr">
                  <strong>{src.organization}</strong>
                </bdi>
              </div>
              <h3>{resolveKbText(src.titleKey, undefined, lang)}</h3>
              <p className="small-text">{resolveKbText(src.noteKey, undefined, lang)}</p>
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                {t('sources.openSource', { host: src.url.replace('https://', '') })}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="sources-rule-table-heading">
        <h2 id="sources-rule-table-heading">{t('sources.summaryHeading')}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'start', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '8px 6px' }}>{t('sources.colRuleId')}</th>
                <th style={{ padding: '8px 6px' }}>{t('sources.colParameter')}</th>
                <th style={{ padding: '8px 6px' }}>{t('sources.colValue')}</th>
                <th style={{ padding: '8px 6px' }}>{t('sources.colLabel')}</th>
                <th style={{ padding: '8px 6px' }}>{t('sources.colStatus')}</th>
                <th style={{ padding: '8px 6px' }}>{t('sources.colSource')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>
                    <bdi dir="ltr">{r.id}</bdi>
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <bdi dir="ltr">{r.parameter}</bdi>
                  </td>
                  <td style={{ padding: '8px 6px' }} dir="ltr">
                    <bdi dir="ltr">
                      {r.customThreshold ?? r.thresholdValue} {r.thresholdUnit}
                    </bdi>
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <Badge label={r.label} />
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <Badge label={r.status} />
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--cyan)', textDecoration: 'underline' }}
                    >
                      {resolveKbText(r.sourceCitationKey, undefined, lang)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
