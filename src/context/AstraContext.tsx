import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ApiUnreachableError,
  checkApiHealth,
  clearClientSessionCaches,
  clearDemoUserId,
  completeTaskApi,
  createTaskApi,
  deferTaskApi,
  ensureDemoUserId,
  fetchAlertsApi,
  fetchHistory,
  fetchMeApi,
  fetchMissionDerivedApi,
  fetchTasks,
  generateUuid,
  getDemoUserId,
  logoutApi,
  savePreferencesApi,
  syncOfflineMutationsApi,
} from '../api/client';
import type {
  AlertItem,
  AuthUser,
  HistoryItem,
  MissionDerivedInfo,
  MissionInfo,
  SyncStatus,
  TaskItem,
  UserPreferences,
} from '../types';
import {
  clearOfflineQueue,
  enqueueOfflineMutation,
  listOfflineMutations,
  removeOfflineMutation,
  type OfflineMutationItem,
} from '../utils/offlineQueue';
import { translateErrorMessage, translateText } from '../i18n';
import {
  applyThemeToDocument,
  isWithinQuietHours,
  loadStoredPreferences,
  mergePreferences,
  saveStoredPreferences,
} from '../utils/preferences';

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const IDLE_COUNTDOWN_SECONDS = 60;

export function exportOfflineQueueToFile(items: OfflineMutationItem[]): void {
  const payload = {
    app: 'ASTRA',
    exportedAt: new Date().toISOString(),
    disclaimer: 'Decision-support prototype. Not a validated clinical system.',
    note: 'Unsynced offline queue backup exported before sign out.',
    count: items.length,
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `astra-offline-queue-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface AstraContextValue {
  demoUserId: string | null;
  authUser: AuthUser | null;
  authReady: boolean;
  mission: MissionInfo | null;
  missionDerived: MissionDerivedInfo | null;
  alerts: AlertItem[];
  offlineQueue: OfflineMutationItem[];
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<UserPreferences>;
  sessionExpiredNotice: boolean;
  setSessionExpiredNotice: (val: boolean) => void;
  setSessionData: (data: {
    user: AuthUser | null;
    mission: MissionInfo | null;
    derived?: MissionDerivedInfo | null;
    preferences?: UserPreferences | null;
  }) => void;
  refreshSession: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  refreshDerived: () => Promise<void>;
  refreshOfflineQueue: () => Promise<OfflineMutationItem[]>;
  queueOfflineReading: (
    label: string,
    payload: Record<string, unknown>
  ) => Promise<void>;
  flushOfflineQueue: () => Promise<{ synced: number; failed: number }>;
  signOutLocal: (options?: { exportQueueFirst?: boolean }) => Promise<void>;
  signOutAfterSync: () => Promise<{ ok: boolean; error?: string }>;
  idleCountdownSeconds: number | null;
  staySignedIn: () => void;
  enterDemoMode: () => string;
  isOfflineSim: boolean;
  toggleOfflineSim: () => void;
  toastMessage: string | null;
  showToast: (message: string) => void;
  syncStatus: SyncStatus;
  tasks: TaskItem[];
  history: HistoryItem[];
  protocolLoading: boolean;
  loadProtocolData: () => Promise<void>;
  probeBackendHealth: () => Promise<void>;
  addTask: (name: string, due: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deferTask: (taskId: string, reason: string) => Promise<void>;
}

const AstraContext = createContext<AstraContextValue | null>(null);

export function AstraProvider({ children }: { children: React.ReactNode }) {
  const [demoUserId, setDemoUserId] = useState<string | null>(() =>
    getDemoUserId()
  );
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mission, setMission] = useState<MissionInfo | null>(null);
  const [missionDerived, setMissionDerived] = useState<MissionDerivedInfo | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineMutationItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadStoredPreferences()
  );
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [idleCountdownSeconds, setIdleCountdownSeconds] = useState<number | null>(null);

  const [isOfflineSim, setIsOfflineSim] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('CONNECTING');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [protocolLoading, setProtocolLoading] = useState(false);

  const hasLoadedProtocolRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const prefsRef = useRef<UserPreferences>(preferences);
  prefsRef.current = preferences;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Apply theme & listen to OS prefers-color-scheme live when theme === 'system'
  useEffect(() => {
    applyThemeToDocument(preferences.theme);
    saveStoredPreferences(preferences);

    if (
      preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        applyThemeToDocument('system');
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, [preferences]);

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>): Promise<UserPreferences> => {
      const prev = prefsRef.current;
      const merged = mergePreferences({
        ...prev,
        ...patch,
        notifications: {
          ...prev.notifications,
          ...(patch.notifications ?? {}),
        },
        units: {
          ...prev.units,
          ...(patch.units ?? {}),
        },
      });
      setPreferences(merged);
      saveStoredPreferences(merged);
      applyThemeToDocument(merged.theme);

      if (authUser) {
        try {
          const saved = await savePreferencesApi(merged);
          const authoritative = mergePreferences(saved);
          setPreferences(authoritative);
          saveStoredPreferences(authoritative);
          applyThemeToDocument(authoritative.theme);
          return authoritative;
        } catch (err) {
          throw err;
        }
      }
      return merged;
    },
    [authUser]
  );

  const refreshOfflineQueue = useCallback(async () => {
    const items = await listOfflineMutations();
    setOfflineQueue(items);
    return items;
  }, []);

  const refreshAlerts = useCallback(async () => {
    if (!authUser || !mission) {
      setAlerts([]);
      return;
    }
    try {
      const list = await fetchAlertsApi();
      setAlerts(list);
    } catch {
      // keep existing alerts if offline
    }
  }, [authUser, mission]);

  const refreshDerived = useCallback(async () => {
    if (!authUser || !mission) return;
    try {
      const d = await fetchMissionDerivedApi();
      setMissionDerived(d);
    } catch {
      // ignore if offline
    }
  }, [authUser, mission]);

  const setSessionData = useCallback(
    (data: {
      user: AuthUser | null;
      mission: MissionInfo | null;
      derived?: MissionDerivedInfo | null;
      preferences?: UserPreferences | null;
    }) => {
      setAuthUser(data.user);
      setMission(data.mission);
      if (data.derived !== undefined) {
        setMissionDerived(data.derived);
      }
      if (data.preferences) {
        // Server value wins after login
        const serverPrefs = mergePreferences(data.preferences);
        setPreferences(serverPrefs);
        saveStoredPreferences(serverPrefs);
        applyThemeToDocument(serverPrefs.theme);
      }
      if (data.user) {
        clearDemoUserId();
        setDemoUserId(null);
        setSessionExpiredNotice(false);
        setIdleCountdownSeconds(null);
        lastActivityRef.current = Date.now();
        setSyncStatus('BACKEND SYNCED');
      }
    },
    []
  );

  const refreshSession = useCallback(async () => {
    try {
      const data = await fetchMeApi();
      setAuthUser(data.user);
      setMission(data.mission);
      setMissionDerived(data.derived);
      if (data.preferences) {
        const serverPrefs = mergePreferences(data.preferences);
        setPreferences(serverPrefs);
        saveStoredPreferences(serverPrefs);
        applyThemeToDocument(serverPrefs.theme);
      }
      lastActivityRef.current = Date.now();
      setSyncStatus('BACKEND SYNCED');
    } catch {
      setAuthUser(null);
      setMission(null);
      setMissionDerived(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  // Bootstrap auth session and offline queue on mount
  useEffect(() => {
    void refreshOfflineQueue();
    void refreshSession();
  }, [refreshOfflineQueue, refreshSession]);

  // Listen for browser online/offline changes and session expiration events
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineSim(false);
      void checkApiHealth().then((ok) => {
        setSyncStatus(ok ? 'BACKEND SYNCED' : 'LOCAL ONLY');
      });
    };
    const handleOffline = () => {
      setIsOfflineSim(true);
      setSyncStatus('LOCAL ONLY');
    };
    const handleExpired = () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setAuthUser(null);
      setMission(null);
      setMissionDerived(null);
      setAlerts([]);
      setIdleCountdownSeconds(null);
      setSessionExpiredNotice(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('astra:session-expired', handleExpired);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('astra:session-expired', handleExpired);
    };
  }, []);

  // Load alerts and subscribe to SSE when authenticated with a mission
  useEffect(() => {
    if (!authUser || !mission) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setAlerts([]);
      return;
    }

    void refreshAlerts();

    if (typeof EventSource !== 'undefined' && !isOfflineSim) {
      const es = new EventSource('/api/events', { withCredentials: true });
      sseRef.current = es;
      es.addEventListener('alert', (evt) => {
        try {
          const alert = JSON.parse((evt as MessageEvent).data) as AlertItem;
          setAlerts((curr) =>
            curr.some((a) => a.id === alert.id) ? curr : [alert, ...curr]
          );
          const p = prefsRef.current;
          const quiet = isWithinQuietHours(p);
          const isHigh = alert.severity === 'HIGH_PRIORITY';
          // Quiet hours NEVER suppress HIGH_PRIORITY
          const allowedInApp =
            isHigh ||
            (!quiet &&
              ((alert.severity === 'MONITOR' && p.notifications.inAppMonitor) ||
                (alert.severity === 'REVIEW' && p.notifications.inAppReview) ||
                alert.severity === 'ALERT' ||
                alert.severity === 'INFORMATION'));

          if (allowedInApp) {
            const lang = p.language === 'ar' ? 'ar' : 'en';
            showToast(
              translateText(
                lang,
                isHigh ? 'alerts.highPriorityToast' : 'alerts.newAlertToast',
                { id: alert.id }
              )
            );
          }

          if (
            p.notifications.browserNotifications &&
            (isHigh || !quiet) &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            const lang = p.language === 'ar' ? 'ar' : 'en';
            new Notification(
              translateText(
                lang,
                isHigh ? 'alerts.sseHighTitle' : 'alerts.sseNormalTitle',
                { id: alert.id }
              ),
              { body: alert.measurementText }
            );
          }
        } catch {
          // ignore malformed SSE event
        }
      });
      return () => {
        es.close();
        sseRef.current = null;
      };
    }
    return undefined;
  }, [authUser, mission, isOfflineSim, refreshAlerts, showToast]);

  const queueOfflineReading = useCallback(
    async (label: string, payload: Record<string, unknown>) => {
      const item: OfflineMutationItem = {
        clientMutationId:
          typeof payload.clientMutationId === 'string'
            ? payload.clientMutationId
            : generateUuid(),
        kind: 'DAILY_READING',
        payload,
        createdAt: Date.now(),
        label,
        status: 'QUEUED',
      };
      await enqueueOfflineMutation(item);
      await refreshOfflineQueue();
      setSyncStatus('SYNC PENDING');
    },
    [refreshOfflineQueue]
  );

  const flushOfflineQueue = useCallback(async () => {
    const items = await listOfflineMutations();
    if (items.length === 0) {
      return { synced: 0, failed: 0 };
    }
    const res = await syncOfflineMutationsApi(
      items.map((it) => ({
        clientMutationId: it.clientMutationId,
        kind: it.kind,
        payload: it.payload,
      }))
    );
    let synced = 0;
    let failed = 0;
    for (const r of res.results) {
      if (r.status === 'SYNCED' || r.status === 'DUPLICATE_OK') {
        await removeOfflineMutation(r.clientMutationId);
        synced += 1;
      } else {
        failed += 1;
      }
    }
    await refreshOfflineQueue();
    await refreshAlerts();
    await refreshDerived();
    setSyncStatus(failed > 0 ? 'SYNC PENDING' : 'BACKEND SYNCED');
    return { synced, failed };
  }, [refreshAlerts, refreshDerived, refreshOfflineQueue]);

  const signOutLocal = useCallback(
    async (options?: { exportQueueFirst?: boolean }) => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (options?.exportQueueFirst) {
        const queued = await listOfflineMutations();
        if (queued.length > 0) {
          exportOfflineQueueToFile(queued);
        }
      }
      try {
        await logoutApi();
      } catch {
        // Clear local session regardless of network availability
      }
      clearDemoUserId();
      await clearClientSessionCaches();
      await clearOfflineQueue();
      setOfflineQueue([]);
      setDemoUserId(null);
      setAuthUser(null);
      setMission(null);
      setMissionDerived(null);
      setAlerts([]);
      setTasks([]);
      setHistory([]);
      setIdleCountdownSeconds(null);
      // Note: localStorage["astra.prefs"] is intentionally preserved!
      const lang = prefsRef.current.language === 'ar' ? 'ar' : 'en';
      showToast(translateText(lang, 'app.youHaveBeenSignedOut'));
    },
    [showToast]
  );

  const signOutAfterSync = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    const lang = prefsRef.current.language === 'ar' ? 'ar' : 'en';
    try {
      const res = await flushOfflineQueue();
      if (res.failed > 0) {
        return {
          ok: false,
          error: translateText(lang, 'errors.CONFLICT'),
        };
      }
      await signOutLocal();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: translateErrorMessage(lang, err, 'errors.API_UNREACHABLE'),
      };
    }
  }, [flushOfflineQueue, signOutLocal]);

  const staySignedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleCountdownSeconds(null);
  }, []);

  // 30-minute idle timer with 60-second countdown dialog
  useEffect(() => {
    if (!authUser) {
      setIdleCountdownSeconds(null);
      return undefined;
    }

    const recordActivity = () => {
      // Only reset automatically while warning dialog is NOT yet open
      if (idleCountdownSeconds === null) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    for (const ev of events) {
      window.addEventListener(ev, recordActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_LIMIT_MS && idleCountdownSeconds === null) {
        setIdleCountdownSeconds(IDLE_COUNTDOWN_SECONDS);
      } else if (idleCountdownSeconds !== null) {
        setIdleCountdownSeconds((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Auto-timeout expired: preserve queue safety (sync if online, else export before discard)
            void (async () => {
              const queued = await listOfflineMutations();
              if (queued.length > 0 && !isOfflineSim) {
                const synced = await signOutAfterSync();
                if (!synced.ok) {
                  await signOutLocal({ exportQueueFirst: true });
                }
              } else {
                await signOutLocal({ exportQueueFirst: queued.length > 0 });
              }
            })();
            return null;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
      for (const ev of events) {
        window.removeEventListener(ev, recordActivity);
      }
    };
  }, [authUser, idleCountdownSeconds, isOfflineSim, signOutAfterSync, signOutLocal]);

  const enterDemoMode = useCallback(() => {
    const id = ensureDemoUserId();
    setDemoUserId(id);
    setAuthUser(null);
    setMission(null);
    setMissionDerived(null);
    return id;
  }, []);

  const toggleOfflineSim = useCallback(() => {
    setIsOfflineSim((prev) => {
      const next = !prev;
      setSyncStatus(next ? 'LOCAL ONLY' : 'BACKEND SYNCED');
      return next;
    });
  }, []);

  const probeBackendHealth = useCallback(async () => {
    if (isOfflineSim) {
      setSyncStatus(offlineQueue.length > 0 ? 'SYNC PENDING' : 'LOCAL ONLY');
      return;
    }
    const ok = await checkApiHealth();
    setSyncStatus(
      !ok ? 'LOCAL ONLY' : offlineQueue.length > 0 ? 'SYNC PENDING' : 'BACKEND SYNCED'
    );
  }, [isOfflineSim, offlineQueue.length]);

  const activeUserScope = authUser?.id ?? demoUserId;

  const loadProtocolData = useCallback(async () => {
    if (!activeUserScope) {
      return;
    }
    if (!hasLoadedProtocolRef.current) {
      setSyncStatus('CONNECTING');
    }
    setProtocolLoading(true);
    try {
      const demoHdr = authUser ? null : demoUserId;
      const [fetchedTasks, fetchedHistory] = await Promise.all([
        fetchTasks(demoHdr),
        fetchHistory(demoHdr, 100),
      ]);
      setTasks(fetchedTasks);
      setHistory(fetchedHistory);
      setSyncStatus(offlineQueue.length > 0 ? 'SYNC PENDING' : 'BACKEND SYNCED');
      hasLoadedProtocolRef.current = true;
    } catch (err) {
      if (err instanceof ApiUnreachableError) {
        setSyncStatus('LOCAL ONLY');
      } else {
        setSyncStatus('LOCAL ONLY');
      }
    } finally {
      setProtocolLoading(false);
    }
  }, [activeUserScope, authUser, demoUserId, offlineQueue.length]);

  const addTask = useCallback(
    async (rawName: string, due: string) => {
      if (!activeUserScope) {
        return;
      }
      const name = rawName.trim();
      const now = Date.now();
      const tempTaskId = generateUuid();
      const tempHistoryId = generateUuid();
      const demoHdr = authUser ? null : demoUserId;

      const optimisticTask: TaskItem = {
        id: tempTaskId,
        userId: activeUserScope,
        name,
        due,
        status: 'PENDING',
        deferReason: null,
        createdAt: now,
        updatedAt: now,
      };
      const optimisticHistory: HistoryItem = {
        id: tempHistoryId,
        userId: activeUserScope,
        taskId: tempTaskId,
        text: `Created: ${name}`,
        createdAt: now,
      };

      const prevTasks = tasks;
      const prevHistory = history;
      setTasks([optimisticTask, ...prevTasks]);
      setHistory([optimisticHistory, ...prevHistory]);

      const lang = prefsRef.current.language === 'ar' ? 'ar' : 'en';
      if (syncStatus === 'LOCAL ONLY') {
        showToast(translateText(lang, 'protocol.taskCreatedToast'));
        return;
      }

      try {
        const created = await createTaskApi(demoHdr, { name, due });
        setTasks((curr) =>
          curr.map((item) => (item.id === tempTaskId ? created : item))
        );
        setSyncStatus('BACKEND SYNCED');
        try {
          const latestHistory = await fetchHistory(demoHdr, 100);
          setHistory(latestHistory);
        } catch {
          // Keep optimistic history item
        }
        showToast(translateText(lang, 'protocol.taskCreatedToast'));
      } catch (err) {
        if (err instanceof ApiUnreachableError) {
          setSyncStatus('LOCAL ONLY');
          showToast(translateText(lang, 'protocol.taskCreatedToast'));
          return;
        }
        setTasks(prevTasks);
        setHistory(prevHistory);
        showToast(translateText(lang, 'protocol.saveFailedToast'));
      }
    },
    [activeUserScope, authUser, demoUserId, history, showToast, syncStatus, tasks]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!activeUserScope) {
        return;
      }
      const target = tasks.find((t) => t.id === taskId);
      const demoHdr = authUser ? null : demoUserId;

      if (target && target.status !== 'PENDING' && target.status !== 'OVERDUE') {
        return;
      }

      const now = Date.now();
      const prevTasks = tasks;
      const prevHistory = history;

      if (target) {
        const updatedTask: TaskItem = {
          ...target,
          status: 'COMPLETED',
          updatedAt: now,
        };
        const optimisticHistory: HistoryItem = {
          id: generateUuid(),
          userId: activeUserScope,
          taskId,
          text: `Completed: ${target.name}`,
          createdAt: now,
        };
        setTasks((curr) =>
          curr.map((item) => (item.id === taskId ? updatedTask : item))
        );
        setHistory([optimisticHistory, ...prevHistory]);
      }

      const lang = prefsRef.current.language === 'ar' ? 'ar' : 'en';
      if (syncStatus === 'LOCAL ONLY') {
        showToast(translateText(lang, 'protocol.taskCompletedToast'));
        return;
      }

      try {
        const saved = await completeTaskApi(demoHdr, taskId);
        setTasks((curr) =>
          curr.map((item) => (item.id === taskId ? saved : item))
        );
        setSyncStatus('BACKEND SYNCED');
        try {
          const latestHistory = await fetchHistory(demoHdr, 100);
          setHistory(latestHistory);
        } catch {
          // ignore
        }
        showToast(translateText(lang, 'protocol.taskCompletedToast'));
      } catch (err) {
        if (err instanceof ApiUnreachableError) {
          setSyncStatus('LOCAL ONLY');
          showToast(translateText(lang, 'protocol.taskCompletedToast'));
          return;
        }
        setTasks(prevTasks);
        setHistory(prevHistory);
        showToast(translateText(lang, 'protocol.saveFailedToast'));
      }
    },
    [activeUserScope, authUser, demoUserId, history, showToast, syncStatus, tasks]
  );

  const deferTask = useCallback(
    async (taskId: string, rawReason: string) => {
      if (!activeUserScope) {
        return;
      }
      const reason = rawReason.trim();
      const target = tasks.find((t) => t.id === taskId);
      const demoHdr = authUser ? null : demoUserId;
      if ((target && target.status !== 'PENDING' && target.status !== 'OVERDUE') || !reason) {
        return;
      }

      const now = Date.now();
      const prevTasks = tasks;
      const prevHistory = history;

      if (target) {
        const updatedTask: TaskItem = {
          ...target,
          status: 'DEFERRED',
          deferReason: reason,
          updatedAt: now,
        };
        const optimisticHistory: HistoryItem = {
          id: generateUuid(),
          userId: activeUserScope,
          taskId,
          text: `Deferred: ${target.name} (reason: ${reason})`,
          createdAt: now,
        };

        setTasks((curr) =>
          curr.map((item) => (item.id === taskId ? updatedTask : item))
        );
        setHistory([optimisticHistory, ...prevHistory]);
      }

      const lang = prefsRef.current.language === 'ar' ? 'ar' : 'en';
      if (syncStatus === 'LOCAL ONLY') {
        showToast(translateText(lang, 'protocol.taskDeferredToast'));
        return;
      }

      try {
        const saved = await deferTaskApi(demoHdr, taskId, reason);
        setTasks((curr) =>
          curr.map((item) => (item.id === taskId ? saved : item))
        );
        setSyncStatus('BACKEND SYNCED');
        try {
          const latestHistory = await fetchHistory(demoHdr, 100);
          setHistory(latestHistory);
        } catch {
          // ignore
        }
        showToast(translateText(lang, 'protocol.taskDeferredToast'));
      } catch (err) {
        if (err instanceof ApiUnreachableError) {
          setSyncStatus('LOCAL ONLY');
          showToast(translateText(lang, 'protocol.taskDeferredToast'));
          return;
        }
        setTasks(prevTasks);
        setHistory(prevHistory);
        showToast(translateText(lang, 'protocol.saveFailedToast'));
      }
    },
    [activeUserScope, authUser, demoUserId, history, showToast, syncStatus, tasks]
  );

  return (
    <AstraContext.Provider
      value={{
        demoUserId,
        authUser,
        authReady,
        mission,
        missionDerived,
        alerts,
        offlineQueue,
        preferences,
        updatePreferences,
        sessionExpiredNotice,
        setSessionExpiredNotice,
        setSessionData,
        refreshSession,
        refreshAlerts,
        refreshDerived,
        refreshOfflineQueue,
        queueOfflineReading,
        flushOfflineQueue,
        signOutLocal,
        signOutAfterSync,
        idleCountdownSeconds,
        staySignedIn,
        enterDemoMode,
        isOfflineSim,
        toggleOfflineSim,
        toastMessage,
        showToast,
        syncStatus,
        tasks,
        history,
        protocolLoading,
        loadProtocolData,
        probeBackendHealth,
        addTask,
        completeTask,
        deferTask,
      }}
    >
      {children}
    </AstraContext.Provider>
  );
}

export function useAstra(): AstraContextValue {
  const ctx = useContext(AstraContext);
  if (!ctx) {
    throw new Error('useAstra must be used inside AstraProvider');
  }
  return ctx;
}
