import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FALLBACK_RISKS, fetchHazardsApi, fetchRisks } from '../api/client';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import type { HazardEntryItem, RiskItem } from '../types';

const RISK_CATEGORY_MAP: Record<string, HazardEntryItem['category']> = {
  rad: 'RADIATION',
  env: 'ENVIRONMENT',
  grav: 'GRAVITY',
  iso: 'ISOLATION',
  dist: 'DISTANCE',
};

export function RisksListPage() {
  const { demoUserId, authUser, mission } = useAstra();
  const { t, formatUtcIso } = useI18n();
  const [risks, setRisks] = useState<RiskItem[]>(FALLBACK_RISKS);
  const [entries, setEntries] = useState<HazardEntryItem[]>([]);

  useEffect(() => {
    if (authUser) {
      if (authUser.role === 'COMMANDER' && mission) {
        fetchHazardsApi()
          .then((res) => setEntries(res.entries))
          .catch(() => {});
      }
      return;
    }
    if (!demoUserId) return;
    let active = true;
    fetchRisks(demoUserId)
      .then((data) => {
        if (active && data.length > 0) setRisks(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authUser, demoUserId, mission]);

  if (authUser && authUser.role !== 'COMMANDER') {
    return (
      <section className="card">
        <h1>{t('risks.commanderOnlyTitle')}</h1>
        <p className="muted-text">{t('risks.commanderOnlyDesc')}</p>
      </section>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('risks.title')}</h1>
          <p className="muted-text">
            {authUser ? t('risks.subtitleAuth') : t('risks.subtitleDemo')}
          </p>
        </div>
        <div className="page-header-actions">
          <Badge label={authUser ? 'COMMANDER' : 'SIMULATED DATA'} />
        </div>
      </div>

      <div className="card-grid">
        {risks.map((risk) => {
          const cat = RISK_CATEGORY_MAP[risk.id];
          const latest = authUser ? entries.find((e) => e.category === cat) : null;
          const localizedName = t(`riskCategories.${risk.id}.name`);
          const localizedDesc = t(`riskCategories.${risk.id}.desc`);
          const localizedNote = t(`riskCategories.${risk.id}.note`);
          const tsFormatted = latest ? `${formatUtcIso(latest.measuredAt)} UTC` : '';

          return (
            <article key={risk.id} className="card">
              <div className="metric-card-top">
                <span className="metric-title">
                  <span className="metric-icon" aria-hidden="true">
                    {risk.icon}
                  </span>
                  <span>{localizedName}</span>
                </span>
              </div>

              <p className="muted-text">{localizedDesc}</p>

              <div className="badge-row">
                <Badge
                  label={
                    authUser
                      ? latest
                        ? latest.dataQuality
                        : 'PENDING'
                      : risk.status
                  }
                />
              </div>

              <p className="small-text">
                {authUser
                  ? latest
                    ? t('risks.lastEntry', {
                        ts: tsFormatted,
                        source: latest.source,
                      })
                    : t('risks.noWeeklyEntry')
                  : localizedNote}
              </p>

              <div className="btn-row">
                <Link to={`/risks/${risk.id}`} className="btn btn-primary">
                  {authUser ? t('risks.openAndEnter') : t('risks.details')}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
