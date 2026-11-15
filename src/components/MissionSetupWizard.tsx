import { useEffect, useState } from 'react';
import { fetchTemplatesApi, setupMissionApi } from '../api/client';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { MissionTemplateItem } from '../types';
import { formatDistanceDisplay } from '../utils/units';
import { Badge } from './Badge';

export function MissionSetupWizard() {
  const { authUser, preferences, setSessionData, showToast } = useAstra();
  const { lang, t, trError, formatNum } = useI18n();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [startDateUtc, setStartDateUtc] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [plannedDays, setPlannedDays] = useState(180);
  const [weeklyHazardWeekday, setWeeklyHazardWeekday] = useState(1);
  const [templateId, setTemplateId] = useState<'leo_iss' | 'lunar' | 'mars'>(
    'leo_iss'
  );
  const [templates, setTemplates] = useState<MissionTemplateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplatesApi()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  const selectedTemplate = templates.find((tpl) => tpl.id === templateId);

  const handleNext = () => {
    setError(null);
    if (step === 1 && !name.trim()) {
      setError(t('wizard.errName'));
      return;
    }
    if (step === 2) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateUtc)) {
        setError(t('wizard.errStartDate'));
        return;
      }
      if (!Number.isInteger(plannedDays) || plannedDays < 1 || plannedDays > 3650) {
        setError(t('wizard.errPlannedDays'));
        return;
      }
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const handleLaunch = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await setupMissionApi({
        name: name.trim(),
        startDateUtc,
        plannedDays,
        templateId,
        weeklyHazardWeekday,
      });
      setSessionData({
        user: authUser,
        mission: res.mission,
        derived: res.derived,
      });
      showToast(t('wizard.configuredToast'));
    } catch (err) {
      setError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card hero-card" aria-labelledby="wizard-heading">
      <div className="section-header">
        <div>
          <h1 id="wizard-heading">{t('wizard.title')}</h1>
          <p className="muted-text">
            {t('wizard.stepCounter', { step: formatNum(step) })}
          </p>
        </div>
        <Badge label="COMMANDER" />
      </div>

      <div className="badge-row" role="list" aria-label={t('wizard.stepsAria')}>
        {[
          { n: 1, label: t('wizard.step1') },
          { n: 2, label: t('wizard.step2') },
          { n: 3, label: t('wizard.step3') },
          { n: 4, label: t('wizard.step4') },
        ].map((item) => (
          <Badge
            key={item.n}
            label={item.label}
            canonicalCode={step === item.n ? 'PENDING' : step > item.n ? 'COMPLETED' : 'UNKNOWN'}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="form-stack">
          <div className="field">
            <label htmlFor="wizard-mission-name">{t('wizard.missionNameLabel')}</label>
            <input
              id="wizard-mission-name"
              type="text"
              className="input"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('wizard.missionNamePlaceholder')}
            />
          </div>
          <p className="small-text">{t('wizard.missionNameHint')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="form-stack">
          <div className="field">
            <label htmlFor="wizard-start-date">{t('wizard.startDateLabel')}</label>
            <input
              id="wizard-start-date"
              type="date"
              className="input"
              value={startDateUtc}
              onChange={(e) => setStartDateUtc(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="wizard-planned-days">{t('wizard.plannedDaysLabel')}</label>
            <input
              id="wizard-planned-days"
              type="number"
              min={1}
              max={3650}
              className="input"
              value={plannedDays}
              onChange={(e) => setPlannedDays(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="wizard-hazard-day">{t('wizard.hazardDayLabel')}</label>
            <select
              id="wizard-hazard-day"
              className="input"
              value={weeklyHazardWeekday}
              onChange={(e) => setWeeklyHazardWeekday(Number(e.target.value))}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                <option key={dayIdx} value={dayIdx}>
                  {t('wizard.weekdayUtc', { day: t(`weekdays.${dayIdx}`) })}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form-stack">
          <p className="small-text">{t('wizard.templatesLead')}</p>
          <div className="card-grid">
            {templates.map((tpl) => {
              const selected = tpl.id === templateId;
              const dist = formatDistanceDisplay(
                tpl.default_distance_km,
                preferences.units.distance
              );
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className="card card-interactive"
                  style={{
                    textAlign: 'start',
                    cursor: 'pointer',
                    borderColor: selected ? 'var(--cyan)' : 'var(--line)',
                  }}
                >
                  <div className="metric-card-top">
                    <strong>{resolveKbText(tpl.title_key, undefined, lang)}</strong>
                    {selected && <Badge label="ACTIVE" />}
                  </div>
                  <p className="small-text">
                    {resolveKbText(tpl.description_key, undefined, lang)}
                  </p>
                  <p className="small-text tabular-nums">
                    <bdi dir="ltr">
                      {t('wizard.defaultDistGcr', {
                        dist: dist.formatted,
                        unit: dist.unitLabel,
                        gcr: tpl.gcr_reference_msv_day,
                      })}
                    </bdi>
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="form-stack">
          <dl className="kv-list">
            <div className="kv-row">
              <dt>{t('wizard.missionNameLabel')}</dt>
              <dd>{name.trim()}</dd>
            </div>
            <div className="kv-row">
              <dt>{t('wizard.startDateLabel')}</dt>
              <dd className="tabular-nums">
                <bdi dir="ltr">{startDateUtc}</bdi>
              </dd>
            </div>
            <div className="kv-row">
              <dt>{t('wizard.plannedDaysLabel')}</dt>
              <dd className="tabular-nums">
                {t('wizard.reviewDays', { days: formatNum(plannedDays) })}
              </dd>
            </div>
            <div className="kv-row">
              <dt>{t('wizard.templateLabel')}</dt>
              <dd>
                {selectedTemplate
                  ? resolveKbText(selectedTemplate.title_key, undefined, lang)
                  : templateId}
              </dd>
            </div>
            <div className="kv-row">
              <dt>{t('wizard.weeklyHazardsDayLabel')}</dt>
              <dd>{t(`weekdays.${weeklyHazardWeekday}`)}</dd>
            </div>
          </dl>
          <p className="small-text">{t('wizard.launchSummary')}</p>
        </div>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="btn-row">
        {step > 1 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setStep((s) => s - 1)}
            disabled={submitting}
          >
            {t('wizard.back')}
          </button>
        )}
        {step < 4 ? (
          <button type="button" className="btn btn-primary" onClick={handleNext}>
            {t('wizard.continue')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleLaunch()}
            disabled={submitting}
          >
            {submitting ? t('wizard.launching') : t('wizard.launchMission')}
          </button>
        )}
      </div>
    </section>
  );
}
