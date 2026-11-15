import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCalendarTasksApi, fetchProtocolsApi } from '../api/client';
import { Badge } from '../components/Badge';
import { DeferModal } from '../components/DeferModal';
import { EntrySheet } from '../components/EntrySheet';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { CalendarTaskItem, ProtocolItem } from '../types';

const PROTOCOL_TO_INDICATOR: Record<
  string,
  'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act'
> = {
  'PRT-HR': 'hr',
  'PRT-BP': 'bp',
  'PRT-SLP': 'sleep',
  'PRT-MOOD': 'mood',
  'PRT-STR': 'stress',
  'PRT-ACT': 'act',
};

const PROTOCOL_TO_RISK: Record<string, string> = {
  'PRT-RAD': '/risks/rad',
  'PRT-ENV': '/risks/env',
  'PRT-GRV': '/risks/grav',
  'PRT-ISO': '/risks/iso',
  'PRT-DST': '/risks/dist',
};

export function CalendarPage() {
  const navigate = useNavigate();
  const { mission, completeTask, deferTask } = useAstra();
  const { lang, t, formatNum, formatWeekday } = useI18n();
  const [tasks, setTasks] = useState<CalendarTaskItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [activeSheet, setActiveSheet] = useState<{
    indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
    protocol: ProtocolItem | null;
    taskId: string;
  } | null>(null);
  const [deferTarget, setDeferTarget] = useState<CalendarTaskItem | null>(null);

  const loadData = useCallback(() => {
    if (!mission) return;
    fetchCalendarTasksApi()
      .then(setTasks)
      .catch(() => {});
    fetchProtocolsApi()
      .then(setProtocols)
      .catch(() => {});
  }, [mission]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build 7-day window starting from today UTC
  const days = Array.from({ length: 7 }, (_, i) => {
    const now = new Date();
    const ms = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + i
    );
    const iso = new Date(ms).toISOString().slice(0, 10);
    const weekday = formatWeekday(ms, 'short');
    return { iso, weekday };
  });

  const dayTasks = tasks.filter(
    (task) => (task.scheduledDateUtc ?? selectedDay) === selectedDay
  );

  const handleOpenEntry = (task: CalendarTaskItem) => {
    const prtId = task.protocolId ?? '';
    if (prtId in PROTOCOL_TO_RISK) {
      navigate(PROTOCOL_TO_RISK[prtId]);
      return;
    }
    const indicator = PROTOCOL_TO_INDICATOR[prtId] ?? 'hr';
    const protocol = protocols.find((p) => p.id === prtId) ?? null;
    setActiveSheet({ indicator, protocol, taskId: task.id });
  };

  if (!mission) {
    return (
      <div className="empty-state">
        <h1>{t('calendar.emptyTitle')}</h1>
        <p>{t('calendar.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('calendar.title')}</h1>
          <p className="muted-text">
            {t('calendar.subtitle', { mission: mission.name })}
          </p>
        </div>
        <div className="page-header-actions">
          <Badge label="ACTIVE" />
        </div>
      </div>

      <section className="card" aria-label={t('calendar.gridAria')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          {days.map((d) => {
            const count = tasks.filter((item) => item.scheduledDateUtc === d.iso).length;
            const done = tasks.filter(
              (item) => item.scheduledDateUtc === d.iso && item.status === 'COMPLETED'
            ).length;
            const selected = d.iso === selectedDay;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDay(d.iso)}
                className="card card-interactive"
                style={{
                  cursor: 'pointer',
                  textAlign: 'start',
                  padding: 12,
                  borderColor: selected ? 'var(--cyan)' : 'var(--line)',
                }}
              >
                <strong>{d.weekday}</strong>
                <span className="small-text tabular-nums">
                  <bdi dir="ltr">{d.iso}</bdi>
                </span>
                <span className="small-text tabular-nums">
                  {t('calendar.completedCount', {
                    done: formatNum(done),
                    count: formatNum(count),
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-block" aria-labelledby="day-panel-heading">
        <h2 id="day-panel-heading">
          {t('calendar.scheduleForDay', { date: selectedDay })}
        </h2>
        {dayTasks.length === 0 ? (
          <div className="empty-state">
            <p>{t('calendar.noTasksForDay', { date: selectedDay })}</p>
          </div>
        ) : (
          <div className="task-list">
            {dayTasks.map((task) => {
              const title = task.titleKey
                ? resolveKbText(task.titleKey, undefined, lang)
                : task.name;
              const isActionable =
                task.status === 'PENDING' || task.status === 'OVERDUE';
              return (
                <article key={task.id} className="card task-card">
                  <div className="task-info">
                    <div className="task-name">{title}</div>
                    <p className="small-text tabular-nums">
                      {t('calendar.dueUtc', { time: task.due })}{' '}
                      {task.protocolId ? (
                        <bdi dir="ltr">• {task.protocolId}</bdi>
                      ) : null}
                    </p>
                    {task.status === 'DEFERRED' && task.deferReason && (
                      <p className="small-text">
                        {t('calendar.deferralReason', { reason: task.deferReason })}
                      </p>
                    )}
                    <div className="badge-row">
                      <Badge label={task.status} />
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleOpenEntry(task)}
                    >
                      {t('calendar.startEntry')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!isActionable}
                      onClick={() => void completeTask(task.id).then(loadData)}
                    >
                      {t('calendar.complete')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!isActionable}
                      onClick={() => setDeferTarget(task)}
                    >
                      {t('calendar.defer')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {activeSheet && (
        <EntrySheet
          indicator={activeSheet.indicator}
          protocol={activeSheet.protocol}
          taskId={activeSheet.taskId}
          onClose={() => setActiveSheet(null)}
          onSaved={loadData}
        />
      )}

      {deferTarget && (
        <DeferModal
          taskName={
            deferTarget.titleKey
              ? resolveKbText(deferTarget.titleKey, undefined, lang)
              : deferTarget.name
          }
          onCancel={() => setDeferTarget(null)}
          onConfirm={(reason) => {
            const targetId = deferTarget.id;
            setDeferTarget(null);
            void deferTask(targetId, reason).then(loadData);
          }}
        />
      )}
    </>
  );
}
