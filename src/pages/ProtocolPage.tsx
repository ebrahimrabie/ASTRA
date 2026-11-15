import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProtocolsApi } from '../api/client';
import { Badge } from '../components/Badge';
import { DeferModal } from '../components/DeferModal';
import { EntrySheet } from '../components/EntrySheet';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import { resolveKbText } from '../i18n/kbCatalogEn';
import type { ProtocolItem, TaskItem } from '../types';

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

export function ProtocolPage() {
  const navigate = useNavigate();
  const {
    authUser,
    syncStatus,
    tasks,
    history,
    protocolLoading,
    loadProtocolData,
    probeBackendHealth,
    addTask,
    completeTask,
    deferTask,
  } = useAstra();
  const { lang, t, formatNum, formatUtcIso } = useI18n();

  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [taskName, setTaskName] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deferTarget, setDeferTarget] = useState<TaskItem | null>(null);
  const [sheetProtocol, setSheetProtocol] = useState<ProtocolItem | null>(null);
  const deferTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void loadProtocolData();
    fetchProtocolsApi().then(setProtocols).catch(() => {});
  }, [loadProtocolData]);

  useEffect(() => {
    const handleFocus = () => {
      void probeBackendHealth();
    };
    window.addEventListener('focus', handleFocus);
    const intervalId = window.setInterval(() => {
      void probeBackendHealth();
    }, 10_000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [probeBackendHealth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = taskName.trim();
    if (!trimmedName || !dueTime) {
      setFormError(t('protocol.missingTaskFields'));
      return;
    }
    setFormError(null);
    await addTask(trimmedName, dueTime);
    setTaskName('');
    setDueTime('');
  };

  const closeDeferModal = () => {
    setDeferTarget(null);
    window.requestAnimationFrame(() => {
      deferTriggerRef.current?.focus();
    });
  };

  const handleStartProtocol = (prt: ProtocolItem) => {
    if (prt.id in PROTOCOL_TO_RISK) {
      navigate(PROTOCOL_TO_RISK[prt.id]);
      return;
    }
    setSheetProtocol(prt);
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{t('protocol.title')}</h1>
          <p className="muted-text">{t('protocol.subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <Badge label={syncStatus} />
        </div>
      </div>

      <div className="banner" role="note">
        {t('safety.protoProtocol')}
      </div>

      <section className="section-block" aria-labelledby="seeded-protocols-heading">
        <h2 id="seeded-protocols-heading">
          {t('protocol.seededHeading', { count: formatNum(protocols.length) })}
        </h2>
        <div className="card-grid">
          {protocols.map((prt) => (
            <article key={prt.id} className="card">
              <div className="section-header">
                <bdi dir="ltr">
                  <strong>{prt.id}</strong>
                </bdi>
                <div className="badge-row">
                  <Badge label={prt.frequency} canonicalCode="INFORMATION" />
                  <Badge label={prt.roleScope} />
                </div>
              </div>
              <h3>{resolveKbText(prt.titleKey, undefined, lang)}</h3>
              <p className="small-text">{resolveKbText(prt.purposeKey, undefined, lang)}</p>
              <p className="small-text tabular-nums">
                {t('protocol.estMinutes', { minutes: formatNum(prt.estimatedMinutes) })}
              </p>
              <ol className="bullet-list" style={{ fontSize: 13 }}>
                {prt.steps.map((s) => (
                  <li key={s.id}>{resolveKbText(s.textKey, undefined, lang)}</li>
                ))}
              </ol>
              {authUser && (
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={prt.roleScope === 'COMMANDER' && authUser.role !== 'COMMANDER'}
                    onClick={() => handleStartProtocol(prt)}
                  >
                    {t('protocol.startEntry')}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="create-task-heading">
        <h2 id="create-task-heading">{t('protocol.createCustomHeading')}</h2>
        <form className="form-stack" onSubmit={handleSubmit} noValidate>
          <div className="form-row-inline">
            <div className="field">
              <label htmlFor="task-name-input">{t('protocol.taskNameLabel')}</label>
              <input
                id="task-name-input"
                type="text"
                className="input"
                maxLength={80}
                value={taskName}
                onChange={(e) => {
                  setTaskName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder={t('protocol.taskNamePlaceholder')}
              />
            </div>

            <div className="field">
              <label htmlFor="task-due-input">{t('protocol.dueTimeLabel')}</label>
              <input
                id="task-due-input"
                type="time"
                className="input"
                value={dueTime}
                onChange={(e) => {
                  setDueTime(e.target.value);
                  if (formError) setFormError(null);
                }}
              />
            </div>

            <button type="submit" className="btn btn-primary">
              {t('protocol.createTaskBtn')}
            </button>
          </div>

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}
        </form>
      </section>

      <section className="section-block" aria-labelledby="tasks-list-heading">
        <div className="section-header">
          <h2 id="tasks-list-heading">{t('protocol.queueHeading')}</h2>
          {protocolLoading && <Badge label="CONNECTING" />}
        </div>

        {tasks.length === 0 ? (
          <div className="empty-state">
            <p>{t('protocol.emptyQueue')}</p>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => {
              const isPending = task.status === 'PENDING' || task.status === 'OVERDUE';
              return (
                <article key={task.id} className="card task-card">
                  <div className="task-info">
                    <div className="task-name">{task.name}</div>
                    <p className="small-text tabular-nums">
                      {t('protocol.dueSimple', { due: task.due })}
                    </p>
                    {task.status === 'DEFERRED' && task.deferReason && (
                      <p className="small-text">
                        {t('protocol.deferralReason', { reason: task.deferReason })}
                      </p>
                    )}
                    <div className="badge-row">
                      <Badge label={task.status} />
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!isPending}
                      onClick={() => void completeTask(task.id)}
                      aria-label={t('protocol.completeAria', { name: task.name })}
                    >
                      {t('protocol.complete')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!isPending}
                      onClick={(e) => {
                        deferTriggerRef.current = e.currentTarget;
                        setDeferTarget(task);
                      }}
                      aria-label={t('protocol.deferAria', { name: task.name })}
                    >
                      {t('protocol.defer')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="task-history-heading">
        <h2 id="task-history-heading">{t('protocol.historyHeading')}</h2>
        {history.length === 0 ? (
          <div className="empty-state">
            <p>{t('protocol.noActionsRecorded')}</p>
          </div>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.id} className="history-item">
                <span>{entry.text}</span>
                <bdi className="history-time" dir="ltr">
                  {formatUtcIso(entry.createdAt)} UTC
                </bdi>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheetProtocol && (
        <EntrySheet
          indicator={PROTOCOL_TO_INDICATOR[sheetProtocol.id] ?? 'hr'}
          protocol={sheetProtocol}
          onClose={() => setSheetProtocol(null)}
        />
      )}

      {deferTarget && (
        <DeferModal
          taskName={deferTarget.name}
          onCancel={closeDeferModal}
          onConfirm={(reason) => {
            const targetId = deferTarget.id;
            closeDeferModal();
            void deferTask(targetId, reason);
          }}
        />
      )}
    </>
  );
}
