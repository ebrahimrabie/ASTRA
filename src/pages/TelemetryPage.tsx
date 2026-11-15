import { useState } from 'react';
import { Badge } from '../components/Badge';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { formatDistanceDisplay } from '../utils/units';
import { formatLightTime } from './HomePage';

const EARTH_MOON_KM = 384_400;

export function TelemetryPage() {
  const { isOfflineSim, mission, missionDerived, preferences } = useAstra();
  const { t, formatNum, formatUtcIso } = useI18n();
  const [showCalc, setShowCalc] = useState(false);
  const connectionBadge = isOfflineSim ? 'OFFLINE' : 'ONLINE';
  const distFormatted =
    missionDerived !== null
      ? formatDistanceDisplay(missionDerived.distanceKm, preferences.units.distance)
      : null;

  const distanceKm = missionDerived?.distanceKm ?? null;
  // Log scale from 100 km to 500,000,000 km mapped across [122 .. 496]
  const mapLogX = (km: number): number => {
    const minLog = Math.log10(100);
    const maxLog = Math.log10(500_000_000);
    const clamped = Math.max(100, Math.min(500_000_000, km));
    const ratio = (Math.log10(clamped) - minLog) / (maxLog - minLog);
    return 122 + ratio * (496 - 122);
  };

  const moonX = mapLogX(EARTH_MOON_KM);
  const craftX = distanceKm !== null ? mapLogX(distanceKm) : 516;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('telemetry.title')}</h1>
          <p className="muted-text">
            {missionDerived ? t('telemetry.subtitleAuth') : t('telemetry.subtitleDemo')}
          </p>
        </div>
        <div className="page-header-actions">
          <Badge label={missionDerived ? 'ACTIVE' : 'SIMULATED DATA'} />
        </div>
      </div>

      <section className="card" aria-labelledby="telemetry-schematic-heading">
        <div className="section-header">
          <h2 id="telemetry-schematic-heading">{t('telemetry.schematicHeading')}</h2>
          <Badge label={t('safety.schematicNotToScale')} canonicalCode="INFORMATION" />
        </div>

        <div className="chart-container" dir="ltr">
          <svg
            className="chart-svg"
            viewBox="0 0 600 175"
            role="img"
            aria-label={
              distanceKm !== null
                ? t('telemetry.svgAriaKnown', { km: distanceKm })
                : t('telemetry.svgAriaUnknown')
            }
          >
            <circle cx="80" cy="86" r="32" fill="var(--blue)" />
            <text x="80" y="140" textAnchor="middle" fill="var(--text2)" fontSize="12">
              {t('telemetry.earth')}
            </text>

            <line
              x1="122"
              y1="86"
              x2="496"
              y2="86"
              stroke="var(--line)"
              strokeWidth="2"
              strokeDasharray="6 6"
            />

            {/* Moon Reference Marker at 384,400 km */}
            <circle cx={moonX} cy="86" r="6" fill="var(--text2)" />
            <text x={moonX} y="114" textAnchor="middle" fill="var(--text2)" fontSize="10">
              {t('telemetry.moonLabel')}
            </text>

            {/* Spacecraft position */}
            {distanceKm !== null && (
              <line
                x1="112"
                y1="86"
                x2={craftX}
                y2="86"
                stroke="var(--purple)"
                strokeWidth="2.5"
                strokeDasharray="8 4"
              />
            )}
            <circle cx={craftX} cy="86" r="10" fill="var(--cyan)" />
            <text x={craftX} y="140" textAnchor="middle" fill="var(--text2)" fontSize="12">
              {t('telemetry.spacecraft')}
            </text>

            <text
              x="308"
              y="44"
              textAnchor="middle"
              fill="var(--text)"
              fontSize="14"
              fontWeight="600"
            >
              {distFormatted !== null
                ? t('telemetry.distanceKnown', {
                    val: distFormatted.formatted,
                    unit: distFormatted.unitLabel,
                  })
                : t('telemetry.distanceUnknown')}
            </text>
            <text x="308" y="164" textAnchor="middle" fill="var(--text2)" fontSize="11">
              {t('telemetry.schematicCaption')}
            </text>
          </svg>
        </div>
      </section>

      <section className="card" aria-labelledby="telemetry-kv-heading">
        <div className="section-header">
          <h2 id="telemetry-kv-heading">{t('telemetry.paramsHeading')}</h2>
          {missionDerived && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCalc((v) => !v)}
            >
              {t('telemetry.howCalculated')}
            </button>
          )}
        </div>

        {showCalc && (
          <div className="banner" role="note">
            {t('telemetry.calcBanner')}
          </div>
        )}

        <dl className="kv-list">
          <div className="kv-row">
            <dt>{t('telemetry.missionLabel')}</dt>
            <dd>{mission ? mission.name : <Badge label="NOT_CONFIGURED" />}</dd>
          </div>
          <div className="kv-row">
            <dt>{t('telemetry.timelineLabel')}</dt>
            <dd className="tabular-nums">
              {missionDerived ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 260 }}>
                  <span>
                    {t('telemetry.timelineVal', {
                      day: formatNum(missionDerived.missionDay),
                      planned: formatNum(missionDerived.plannedDays),
                      percent: formatNum(missionDerived.progressPercent),
                    })}
                  </span>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={t('home.missionProgressLabel')}
                    aria-valuenow={missionDerived.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(0, Math.min(100, missionDerived.progressPercent))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Badge label="NOT_CONFIGURED" />
              )}
            </dd>
          </div>
          <div className="kv-row">
            <dt>{t('telemetry.distanceLabel')}</dt>
            <dd className="tabular-nums">
              {missionDerived && distFormatted ? (
                <>
                  <bdi dir="ltr">
                    {distFormatted.formatted} {distFormatted.unitLabel}
                  </bdi>{' '}
                  {missionDerived.distanceIsTemplateDefault && (
                    <Badge label="TEMPLATE_DEFAULT_DISTANCE" canonicalCode="INFORMATION" />
                  )}
                </>
              ) : (
                <Badge label="UNKNOWN" />
              )}
            </dd>
          </div>
          <div className="kv-row">
            <dt>{t('telemetry.oneWayLabel')}</dt>
            <dd className="tabular-nums">
              {missionDerived ? (
                <>
                  <bdi dir="ltr">{formatLightTime(missionDerived.oneWayLightSeconds)}</bdi>{' '}
                  {t('home.roundTripInline', {
                    rt: formatLightTime(missionDerived.roundTripLightSeconds),
                  })}
                </>
              ) : (
                <Badge label="UNKNOWN" />
              )}
            </dd>
          </div>
          <div className="kv-row">
            <dt>{t('telemetry.connectionLabel')}</dt>
            <dd>
              <Badge label={connectionBadge} />
            </dd>
          </div>
          <div className="kv-row">
            <dt>{t('telemetry.lastSyncLabel')}</dt>
            <dd className="tabular-nums">
              {missionDerived?.lastSyncAt ? (
                <bdi dir="ltr">
                  {formatUtcIso(missionDerived.lastSyncAt)} {t('app.utc')}
                </bdi>
              ) : (
                <Badge label="UNKNOWN" />
              )}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
