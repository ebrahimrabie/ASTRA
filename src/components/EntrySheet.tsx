import { useEffect, useState } from 'react';
import {
  ApiUnreachableError,
  fetchInstrumentsApi,
  generateUuid,
  submitDailyReadingApi,
} from '../api/client';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { InstrumentItem, ProtocolItem } from '../types';
import { Badge } from './Badge';

export function EntrySheet({
  indicator,
  protocol,
  taskId,
  onClose,
  onSaved,
}: {
  indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
  protocol?: ProtocolItem | null;
  taskId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const {
    isOfflineSim,
    queueOfflineReading,
    refreshAlerts,
    refreshDerived,
    completeTask,
    showToast,
  } = useAstra();
  const { lang, t, trError, formatNum } = useI18n();

  const [instruments, setInstruments] = useState<InstrumentItem[]>([]);
  const [sourceCode, setSourceCode] = useState('CREW_MED_DEVICE');
  const [customSource, setCustomSource] = useState('');
  const [deviceId, setDeviceId] = useState('');

  const [measuredIso, setMeasuredIso] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [lateNote, setLateNote] = useState('');

  // Indicator specific inputs
  const [hrBpm, setHrBpm] = useState('72');
  const [hrContext, setHrContext] = useState<'RESTING' | 'AFTER_EXERCISE' | 'OTHER'>('RESTING');
  const [bpSys, setBpSys] = useState('118');
  const [bpDia, setBpDia] = useState('76');
  const [sleepHours, setSleepHours] = useState('7.5');
  const [sleepStart, setSleepStart] = useState('22:30');
  const [sleepEnd, setSleepEnd] = useState('06:00');
  const [moodLevel, setMoodLevel] = useState('4');
  const [stressScore, setStressScore] = useState('25');
  const [actMinutes, setActMinutes] = useState('60');
  const [actType, setActType] = useState<'RESISTIVE' | 'AEROBIC' | 'OTHER'>('RESISTIVE');
  const [actCompleted, setActCompleted] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInstrumentsApi('DAILY_READING')
      .then((list) => {
        setInstruments(list);
        if (list.length > 0 && (indicator === 'mood' || indicator === 'stress')) {
          setSourceCode('MANUAL');
        }
      })
      .catch(() => {});
  }, [indicator]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parsedMeasuredMs = Date.parse(`${measuredIso}:00.000Z`);
  const needsLateNote =
    !Number.isNaN(parsedMeasuredMs) && parsedMeasuredMs < Date.now() - 7 * 86_400_000;

  const selectedInst = instruments.find((i) => i.code === sourceCode);
  const resolvedSource =
    sourceCode === 'OTHER'
      ? customSource.trim()
      : indicator === 'mood' || indicator === 'stress'
        ? 'Self-report scale, prototype instrument v1'
        : selectedInst
          ? resolveKbText(selectedInst.nameKey, undefined, lang)
          : 'Crew medical device (approved)';

  const handleSetNow = () => {
    setMeasuredIso(new Date().toISOString().slice(0, 16));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (Number.isNaN(parsedMeasuredMs)) {
      setError(t('entry.errInvalidUtc'));
      return;
    }
    if (parsedMeasuredMs > Date.now() + 60_000) {
      setError(t('entry.errFutureTs'));
      return;
    }
    if (needsLateNote && lateNote.trim().length < 3) {
      setError(t('entry.errLateNote'));
      return;
    }
    if (!resolvedSource) {
      setError(t('entry.errNoSource'));
      return;
    }

    const mutationId = generateUuid();
    const payload: Record<string, unknown> = {
      indicator,
      measuredAt: parsedMeasuredMs,
      source: resolvedSource,
      deviceId: deviceId.trim() || null,
      lateEntryNote: needsLateNote ? lateNote.trim() : null,
      provenance:
        indicator === 'mood' || indicator === 'stress' ? 'Self-reported' : 'Manual entry',
      clientMutationId: mutationId,
    };

    if (indicator === 'hr') {
      const bpm = Number(hrBpm);
      if (!Number.isFinite(bpm) || bpm < 20 || bpm > 260) {
        setError(t('entry.errHrRange'));
        return;
      }
      payload.valueNumeric = bpm;
      payload.context = hrContext;
    } else if (indicator === 'bp') {
      const s = Number(bpSys);
      const d = Number(bpDia);
      if (!Number.isFinite(s) || !Number.isFinite(d) || s < 30 || d < 20) {
        setError(t('entry.errBpRange'));
        return;
      }
      payload.systolic = s;
      payload.diastolic = d;
    } else if (indicator === 'sleep') {
      const hrs = Number(sleepHours);
      if (!Number.isFinite(hrs) || hrs < 0 || hrs > 24) {
        setError(t('entry.errSleepRange'));
        return;
      }
      payload.valueNumeric = hrs;
      payload.sleepStartUtc = sleepStart;
      payload.sleepEndUtc = sleepEnd;
    } else if (indicator === 'mood') {
      payload.valueNumeric = Number(moodLevel);
    } else if (indicator === 'stress') {
      const sc = Number(stressScore);
      if (!Number.isFinite(sc) || sc < 0 || sc > 100) {
        setError(t('entry.errStressRange'));
        return;
      }
      payload.valueNumeric = sc;
    } else if (indicator === 'act') {
      const mins = Number(actMinutes);
      if (!Number.isFinite(mins) || mins < 0 || mins > 600) {
        setError(t('entry.errActRange'));
        return;
      }
      payload.valueNumeric = mins;
      payload.activityType = actType;
      payload.activityCompleted = actCompleted;
    }

    const indicatorLabel = t(`indicators.${indicator}.name`);

    if (isOfflineSim || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      await queueOfflineReading(indicatorLabel, payload);
      showToast(t('entry.queuedOfflineToast'));
      onSaved?.();
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitDailyReadingApi(
        payload as Parameters<typeof submitDailyReadingApi>[0]
      );
      if (taskId) {
        await completeTask(taskId);
      }
      await refreshAlerts();
      await refreshDerived();
      showToast(
        res.alerts.length > 0
          ? t('entry.savedAlertsToast', { count: formatNum(res.alerts.length) })
          : t('entry.readingRecordedToast')
      );
      onSaved?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiUnreachableError) {
        await queueOfflineReading(indicatorLabel, payload);
        showToast(t('entry.unreachableQueuedToast'));
        onSaved?.();
        onClose();
        return;
      }
      setError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-sheet-title"
      style={{ justifyContent: 'flex-end', padding: 0 }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 480,
          height: '100dvh',
          borderRadius: 0,
          overflowY: 'auto',
          padding: 20,
        }}
      >
        <div className="section-header">
          <h2 id="entry-sheet-title">
            {protocol
              ? resolveKbText(protocol.titleKey, undefined, lang)
              : t('entry.logFallbackTitle', { indicator: t(`indicators.${indicator}.name`) })}
          </h2>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('entry.close')}
          </button>
        </div>

        {protocol && (
          <div className="banner" role="note">
            <strong>{resolveKbText(protocol.safetyNoteKey, undefined, lang)}</strong>
            <ol className="bullet-list" style={{ marginTop: 8 }}>
              {protocol.steps.map((s) => (
                <li key={s.id}>{resolveKbText(s.textKey, undefined, lang)}</li>
              ))}
            </ol>
          </div>
        )}

        <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
          {indicator === 'hr' && (
            <>
              <div className="field">
                <label htmlFor="entry-hr-bpm">{t('entry.hrBpm')}</label>
                <input
                  id="entry-hr-bpm"
                  type="number"
                  min={20}
                  max={260}
                  className="input"
                  value={hrBpm}
                  onChange={(e) => setHrBpm(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="entry-hr-ctx">{t('entry.hrContext')}</label>
                <select
                  id="entry-hr-ctx"
                  className="input"
                  value={hrContext}
                  onChange={(e) =>
                    setHrContext(e.target.value as 'RESTING' | 'AFTER_EXERCISE' | 'OTHER')
                  }
                >
                  <option value="RESTING">{t('entry.ctxResting')}</option>
                  <option value="AFTER_EXERCISE">{t('entry.ctxAfterEx')}</option>
                  <option value="OTHER">{t('entry.ctxOther')}</option>
                </select>
              </div>
            </>
          )}

          {indicator === 'bp' && (
            <div className="form-row-inline" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="field">
                <label htmlFor="entry-bp-sys">{t('entry.bpSys')}</label>
                <input
                  id="entry-bp-sys"
                  type="number"
                  min={30}
                  max={300}
                  className="input"
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="entry-bp-dia">{t('entry.bpDia')}</label>
                <input
                  id="entry-bp-dia"
                  type="number"
                  min={20}
                  max={200}
                  className="input"
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                />
              </div>
            </div>
          )}

          {indicator === 'sleep' && (
            <>
              <div className="field">
                <label htmlFor="entry-sleep-hours">{t('entry.sleepHours')}</label>
                <input
                  id="entry-sleep-hours"
                  type="number"
                  step="0.1"
                  min={0}
                  max={24}
                  className="input"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                />
              </div>
              <div className="form-row-inline" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="field">
                  <label htmlFor="entry-sleep-start">{t('entry.sleepStartOpt')}</label>
                  <input
                    id="entry-sleep-start"
                    type="time"
                    className="input"
                    value={sleepStart}
                    onChange={(e) => setSleepStart(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="entry-sleep-end">{t('entry.sleepEndOpt')}</label>
                  <input
                    id="entry-sleep-end"
                    type="time"
                    className="input"
                    value={sleepEnd}
                    onChange={(e) => setSleepEnd(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {indicator === 'mood' && (
            <div className="field">
              <label htmlFor="entry-mood">{t('entry.moodLabel')}</label>
              <select
                id="entry-mood"
                className="input"
                value={moodLevel}
                onChange={(e) => setMoodLevel(e.target.value)}
              >
                <option value="1">{t('entry.mood1')}</option>
                <option value="2">{t('entry.mood2')}</option>
                <option value="3">{t('entry.mood3')}</option>
                <option value="4">{t('entry.mood4')}</option>
                <option value="5">{t('entry.mood5')}</option>
              </select>
            </div>
          )}

          {indicator === 'stress' && (
            <div className="field">
              <label htmlFor="entry-stress">{t('entry.stressLabel')}</label>
              <input
                id="entry-stress"
                type="number"
                min={0}
                max={100}
                className="input"
                value={stressScore}
                onChange={(e) => setStressScore(e.target.value)}
              />
            </div>
          )}

          {indicator === 'act' && (
            <>
              <div className="field">
                <label htmlFor="entry-act-type">{t('entry.actTypeLabel')}</label>
                <select
                  id="entry-act-type"
                  className="input"
                  value={actType}
                  onChange={(e) =>
                    setActType(e.target.value as 'RESISTIVE' | 'AEROBIC' | 'OTHER')
                  }
                >
                  <option value="RESISTIVE">{t('entry.actResistive')}</option>
                  <option value="AEROBIC">{t('entry.actAerobic')}</option>
                  <option value="OTHER">{t('entry.actOther')}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="entry-act-mins">{t('entry.actDurationLabel')}</label>
                <input
                  id="entry-act-mins"
                  type="number"
                  min={0}
                  max={600}
                  className="input"
                  value={actMinutes}
                  onChange={(e) => setActMinutes(e.target.value)}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={actCompleted}
                  onChange={(e) => setActCompleted(e.target.checked)}
                />
                <span>{t('entry.actCompleted')}</span>
              </label>
            </>
          )}

          <div className="field">
            <label htmlFor="entry-measured-at">{t('entry.measuredAtUtc')}</label>
            <div className="btn-row">
              <input
                id="entry-measured-at"
                type="datetime-local"
                className="input"
                style={{ flex: 1 }}
                value={measuredIso}
                onChange={(e) => setMeasuredIso(e.target.value)}
              />
              <button type="button" className="btn btn-secondary" onClick={handleSetNow}>
                {t('entry.now')}
              </button>
            </div>
          </div>

          {needsLateNote && (
            <div className="field">
              <label htmlFor="entry-late-note">{t('entry.lateNoteLabel')}</label>
              <input
                id="entry-late-note"
                type="text"
                className="input"
                value={lateNote}
                onChange={(e) => setLateNote(e.target.value)}
                placeholder={t('entry.lateNotePlaceholder')}
              />
            </div>
          )}

          {indicator !== 'mood' && indicator !== 'stress' && (
            <>
              <div className="field">
                <label htmlFor="entry-source">{t('entry.deviceSourceLabel')}</label>
                <select
                  id="entry-source"
                  className="input"
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                >
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.code}>
                      {resolveKbText(inst.nameKey, undefined, lang)}
                    </option>
                  ))}
                </select>
              </div>

              {sourceCode === 'OTHER' && (
                <div className="field">
                  <label htmlFor="entry-custom-source">{t('entry.customSourceLabel')}</label>
                  <input
                    id="entry-custom-source"
                    type="text"
                    className="input"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    placeholder={t('entry.customSourcePlaceholder')}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="entry-device-id">{t('entry.deviceIdOpt')}</label>
                <input
                  id="entry-device-id"
                  type="text"
                  className="input"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder={t('entry.deviceIdPlaceholder')}
                />
              </div>
            </>
          )}

          {(indicator === 'mood' || indicator === 'stress') && (
            <div className="badge-row">
              <Badge label="ACTIVE" />
              <span className="small-text">{t('entry.selfReportBadgeNote')}</span>
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('entry.saving') : t('entry.saveMeasurement')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('entry.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
