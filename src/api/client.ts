import type {
  AchievementsSummaryResponse,
  AlertItem,
  AuthUser,
  CalendarTaskItem,
  DailyReadingItem,
  DataProvenance,
  DataSourceItem,
  DemoScenarioItem,
  EducationAnswerFeedback,
  EducationCardDetail,
  EnvStatsResponse,
  ExportFormat,
  ExportJobItem,
  ExportScope,
  ExportSection,
  HazardEntryItem,
  HealthIndicatorItem,
  HistoryItem,
  InstrumentItem,
  MissionDerivedInfo,
  MissionInfo,
  MissionTemplateItem,
  ProtocolItem,
  ReferenceRuleItem,
  ReportSummaryResponse,
  RiskItem,
  RuleChangeLogItem,
  SleepRecordItem,
  TaskItem,
  UserPreferences,
  UserRole,
} from '../types';

const DEMO_USER_STORAGE_KEY = 'astra_demo_user_id';
const REQUEST_TIMEOUT_MS = 10_000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ApiUnreachableError extends Error {
  constructor(message = 'Backend API is unreachable.') {
    super(message);
    this.name = 'ApiUnreachableError';
  }
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;

  constructor(status: number, message: string, code?: string, field?: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDemoUserId(): string | null {
  try {
    const val = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (val && UUID_REGEX.test(val.trim())) {
      return val.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function ensureDemoUserId(): string {
  const existing = getDemoUserId();
  if (existing) {
    return existing;
  }
  const created = generateUuid();
  try {
    window.localStorage.setItem(DEMO_USER_STORAGE_KEY, created);
  } catch {
    // Keep operating in memory if storage is blocked
  }
  return created;
}

export function clearDemoUserId(): void {
  try {
    window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

async function requestJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    userId?: string | null;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  if (options.userId) {
    headers['X-Demo-User'] = options.userId;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    window.clearTimeout(timeoutId);
    throw new ApiUnreachableError();
  }

  window.clearTimeout(timeoutId);

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      if (response.status >= 502 && response.status <= 504) {
        throw new ApiUnreachableError();
      }
      throw new ApiHttpError(response.status, `Request failed (${response.status})`);
    }
    throw new ApiUnreachableError('Invalid response from server.');
  }

  if (!response.ok) {
    const obj =
      payload && typeof payload === 'object'
        ? (payload as { error?: string; code?: string; field?: string })
        : {};
    const message =
      typeof obj.error === 'string' ? obj.error : `Request failed (${response.status})`;
    if (response.status === 401 && obj.code === 'SESSION_EXPIRED') {
      window.dispatchEvent(new CustomEvent('astra:session-expired'));
    }
    throw new ApiHttpError(response.status, message, obj.code, obj.field);
  }

  return payload as T;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await requestJson<{ ok: boolean }>('/api/health-check');
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

// ===== Auth & Mission APIs =====
export async function registerApi(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  inviteCode?: string;
}): Promise<{
  user: AuthUser;
  mission: MissionInfo | null;
  preferences: UserPreferences;
}> {
  return requestJson('/api/auth/register', { method: 'POST', body: input });
}

export async function loginApi(input: {
  email: string;
  password: string;
}): Promise<{
  user: AuthUser;
  mission: MissionInfo | null;
  derived: MissionDerivedInfo | null;
  preferences: UserPreferences;
}> {
  return requestJson('/api/auth/login', { method: 'POST', body: input });
}

export async function fetchMeApi(): Promise<{
  user: AuthUser;
  mission: MissionInfo | null;
  derived: MissionDerivedInfo | null;
  preferences: UserPreferences;
}> {
  return requestJson('/api/auth/me');
}

export async function logoutApi(): Promise<void> {
  await requestJson('/api/auth/logout', { method: 'POST' });
}

export async function logoutAllApi(password: string): Promise<void> {
  await requestJson('/api/auth/logout-all', {
    method: 'POST',
    body: { password },
  });
}

export async function changePasswordApi(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await requestJson('/api/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function fetchPreferencesApi(): Promise<UserPreferences> {
  const res = await requestJson<{ preferences: UserPreferences }>('/api/preferences');
  return res.preferences;
}

export async function savePreferencesApi(
  prefs: UserPreferences
): Promise<UserPreferences> {
  const res = await requestJson<{ preferences: UserPreferences }>('/api/preferences', {
    method: 'PUT',
    body: prefs,
  });
  return res.preferences;
}

export async function deleteMyDataApi(confirmation: string): Promise<void> {
  await requestJson('/api/data/delete', {
    method: 'POST',
    body: { confirmation },
  });
}

export async function clearClientSessionCaches(): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter((r) => new URL(r.url).pathname.startsWith('/api/'))
              .map((r) => cache.delete(r))
          );
        })
      );
    } catch {
      // ignore Cache API restrictions
    }
  }
}

export async function setupMissionApi(input: {
  name: string;
  startDateUtc: string;
  plannedDays: number;
  templateId: 'leo_iss' | 'lunar' | 'mars';
  weeklyHazardWeekday: number;
}): Promise<{ mission: MissionInfo; derived: MissionDerivedInfo }> {
  return requestJson('/api/mission/setup', { method: 'POST', body: input });
}

export async function joinMissionApi(inviteCode: string): Promise<{
  mission: MissionInfo;
  derived: MissionDerivedInfo;
}> {
  return requestJson('/api/mission/join', {
    method: 'POST',
    body: { inviteCode },
  });
}

export async function fetchMissionDerivedApi(): Promise<MissionDerivedInfo> {
  const res = await requestJson<{ derived: MissionDerivedInfo }>('/api/mission/derived');
  return res.derived;
}

export async function fetchMissionRosterApi(): Promise<
  Array<{ id: string; userId: string; name: string; email: string; role: UserRole; joinedAt: number }>
> {
  const res = await requestJson<{
    roster: Array<{ id: string; userId: string; name: string; email: string; role: UserRole; joinedAt: number }>;
  }>('/api/mission/roster');
  return res.roster;
}

// ===== Knowledge Base APIs =====
export async function fetchTemplatesApi(): Promise<MissionTemplateItem[]> {
  const res = await requestJson<{ templates: MissionTemplateItem[] }>('/api/templates');
  return res.templates;
}

export async function fetchProtocolsApi(): Promise<ProtocolItem[]> {
  const res = await requestJson<{ protocols: ProtocolItem[] }>('/api/protocols');
  return res.protocols;
}

export async function fetchInstrumentsApi(category?: string): Promise<InstrumentItem[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await requestJson<{ instruments: InstrumentItem[] }>(`/api/instruments${qs}`);
  return res.instruments;
}

export async function fetchSourcesApi(): Promise<{
  sources: DataSourceItem[];
  rules: ReferenceRuleItem[];
  provenanceCounts: Record<DataProvenance, number>;
}> {
  return requestJson('/api/sources');
}

export async function fetchRulesApi(): Promise<{
  rules: ReferenceRuleItem[];
  changeLog: RuleChangeLogItem[];
}> {
  return requestJson('/api/rules');
}

export async function updateRuleApi(
  ruleId: string,
  patch: { customThreshold?: string; customGuidance?: string }
): Promise<ReferenceRuleItem> {
  const res = await requestJson<{ rule: ReferenceRuleItem }>(
    `/api/rules/${encodeURIComponent(ruleId)}`,
    { method: 'PATCH', body: patch }
  );
  return res.rule;
}

// ===== Readings, Hazards, Alerts, Problem Reports, Calendar =====
export async function submitDailyReadingApi(input: {
  indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
  valueNumeric?: number | null;
  systolic?: number | null;
  diastolic?: number | null;
  context?: 'RESTING' | 'AFTER_EXERCISE' | 'OTHER' | null;
  activityType?: 'RESISTIVE' | 'AEROBIC' | 'OTHER' | null;
  activityCompleted?: boolean | null;
  sleepStartUtc?: string | null;
  sleepEndUtc?: string | null;
  measuredAt: number;
  source: string;
  deviceId?: string | null;
  lateEntryNote?: string | null;
  provenance?: DataProvenance;
  clientMutationId?: string;
}): Promise<{ reading: DailyReadingItem; alerts: AlertItem[]; deduplicated: boolean }> {
  return requestJson('/api/daily-readings', { method: 'POST', body: input });
}

export async function fetchDailyReadingsApi(params?: {
  subjectUserId?: string;
  indicator?: string;
}): Promise<DailyReadingItem[]> {
  const qs = new URLSearchParams();
  if (params?.subjectUserId) qs.set('subjectUserId', params.subjectUserId);
  if (params?.indicator) qs.set('indicator', params.indicator);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await requestJson<{ readings: DailyReadingItem[] }>(
    `/api/daily-readings${query}`
  );
  return res.readings;
}

export async function submitHazardApi(
  body: Record<string, unknown>
): Promise<{ entry: HazardEntryItem; alerts: AlertItem[] }> {
  return requestJson('/api/hazards', { method: 'POST', body });
}

export async function fetchHazardsApi(category?: string): Promise<{
  entries: HazardEntryItem[];
  aggregate: {
    crewCount: number;
    crewExerciseTotals: Array<{ userId: string; name: string; totalMinutes: number; sessions: number }>;
    recentPsychCheckinsCount: number;
  } | null;
}> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return requestJson(`/api/hazards${qs}`);
}

export async function fetchAlertsApi(): Promise<AlertItem[]> {
  const res = await requestJson<{ alerts: AlertItem[] }>('/api/alerts');
  return res.alerts;
}

export async function acknowledgeAlertApi(alertId: string): Promise<AlertItem> {
  const res = await requestJson<{ alert: AlertItem }>(
    `/api/alerts/${encodeURIComponent(alertId)}/ack`,
    { method: 'POST' }
  );
  return res.alert;
}

export async function submitProblemReportApi(input: {
  urgent: boolean;
  description: string;
  measuredAt: number;
}): Promise<{ reportId: string; alert: AlertItem }> {
  return requestJson('/api/problem-reports', { method: 'POST', body: input });
}

export async function fetchCalendarTasksApi(
  from?: string,
  to?: string
): Promise<CalendarTaskItem[]> {
  const qs = new URLSearchParams();
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await requestJson<{ tasks: CalendarTaskItem[] }>(`/api/calendar${query}`);
  return res.tasks;
}

export async function syncOfflineMutationsApi(
  items: Array<{ clientMutationId: string; kind: string; payload: Record<string, unknown> }>
): Promise<{
  ok: boolean;
  lastSyncAt: number;
  results: Array<{ clientMutationId: string; status: string; error?: string }>;
}> {
  return requestJson('/api/sync', { method: 'POST', body: { items } });
}

// ===== Phase 4: Achievements, Reports, Exports, Demo Scenarios =====
export async function fetchAchievementsApi(): Promise<AchievementsSummaryResponse> {
  return requestJson('/api/achievements');
}

export async function fetchEducationCardApi(key: string): Promise<EducationCardDetail> {
  const res = await requestJson<{ card: EducationCardDetail }>(
    `/api/education/${encodeURIComponent(key)}`
  );
  return res.card;
}

export async function submitEducationAnswersApi(
  key: string,
  answers: number[]
): Promise<{ passed: boolean; feedback: EducationAnswerFeedback[] }> {
  return requestJson(`/api/education/${encodeURIComponent(key)}/answer`, {
    method: 'POST',
    body: { answers },
  });
}

export async function fetchReportSummaryApi(params?: {
  fromMs?: number;
  toMs?: number;
  subjectUserId?: string;
}): Promise<ReportSummaryResponse> {
  const qs = new URLSearchParams();
  if (params?.fromMs !== undefined) qs.set('fromMs', String(params.fromMs));
  if (params?.toMs !== undefined) qs.set('toMs', String(params.toMs));
  if (params?.subjectUserId) qs.set('subjectUserId', params.subjectUserId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return requestJson(`/api/reports/summary${query}`);
}

export async function createExportApi(input: {
  scope: ExportScope;
  subjectUserId?: string | null;
  fromMs: number;
  toMs: number;
  include: ExportSection[];
  format: ExportFormat;
  labelLanguage: 'en' | 'ar';
}): Promise<ExportJobItem> {
  const res = await requestJson<{ export: ExportJobItem }>('/api/exports', {
    method: 'POST',
    body: input,
  });
  return res.export;
}

export async function listExportsApi(): Promise<ExportJobItem[]> {
  const res = await requestJson<{ exports: ExportJobItem[] }>('/api/exports');
  return res.exports;
}

export function getExportDownloadUrl(exportId: string): string {
  return `/api/exports/${encodeURIComponent(exportId)}/download`;
}

export async function fetchDemoScenariosApi(): Promise<DemoScenarioItem[]> {
  const res = await requestJson<{ scenarios: DemoScenarioItem[] }>(
    '/api/demo/scenarios'
  );
  return res.scenarios;
}

export async function loadDemoScenarioApi(scenarioId: number): Promise<{
  scenarioId: number;
  alerts: AlertItem[];
  targetRoute: string;
  details: Record<string, unknown>;
}> {
  return requestJson('/api/demo/load-scenario', {
    method: 'POST',
    body: { scenarioId },
  });
}

// ===== Legacy / Demo API Functions (kept 100% intact) =====
export async function fetchTasks(userId?: string | null): Promise<TaskItem[]> {
  const res = await requestJson<{ tasks: TaskItem[] }>('/api/tasks', { userId });
  return res.tasks;
}

export async function createTaskApi(
  userId: string | null | undefined,
  input: { name: string; due: string }
): Promise<TaskItem> {
  const res = await requestJson<{ task: TaskItem }>('/api/tasks', {
    method: 'POST',
    userId,
    body: input,
  });
  return res.task;
}

export async function completeTaskApi(
  userId: string | null | undefined,
  taskId: string
): Promise<TaskItem> {
  const res = await requestJson<{ task: TaskItem }>(
    `/api/tasks/${encodeURIComponent(taskId)}/complete`,
    {
      method: 'PATCH',
      userId,
    }
  );
  return res.task;
}

export async function deferTaskApi(
  userId: string | null | undefined,
  taskId: string,
  reason: string
): Promise<TaskItem> {
  const res = await requestJson<{ task: TaskItem }>(
    `/api/tasks/${encodeURIComponent(taskId)}/defer`,
    {
      method: 'PATCH',
      userId,
      body: { reason },
    }
  );
  return res.task;
}

export async function fetchHistory(
  userId?: string | null,
  limit = 100
): Promise<HistoryItem[]> {
  const res = await requestJson<{ history: HistoryItem[] }>(
    `/api/history?limit=${limit}`,
    { userId }
  );
  return res.history;
}

export async function fetchHealthIndicators(
  userId: string
): Promise<HealthIndicatorItem[]> {
  const res = await requestJson<{ indicators: HealthIndicatorItem[] }>(
    '/api/health-indicators',
    { userId }
  );
  return res.indicators;
}

export async function fetchRisks(userId: string): Promise<RiskItem[]> {
  const res = await requestJson<{ risks: RiskItem[] }>('/api/risks', { userId });
  return res.risks;
}

export async function fetchEnvStats(userId: string): Promise<EnvStatsResponse> {
  return requestJson<EnvStatsResponse>('/api/risks/env', { userId });
}

export async function fetchSleepRecords(
  userId: string
): Promise<SleepRecordItem[]> {
  const res = await requestJson<{ records: SleepRecordItem[] }>('/api/sleep', {
    userId,
  });
  return res.records;
}

export const FALLBACK_HEALTH_INDICATORS: HealthIndicatorItem[] = [
  {
    id: 'hr',
    indicator: 'hr',
    icon: '♥',
    name: 'Heart Rate',
    value: '72',
    unit: 'bpm',
    recordedAt: null,
    source: null,
  },
  {
    id: 'bp',
    indicator: 'bp',
    icon: '◍',
    name: 'Blood Pressure',
    value: '118/76',
    unit: 'mmHg',
    recordedAt: null,
    source: null,
  },
  {
    id: 'sleep',
    indicator: 'sleep',
    icon: '☾',
    name: 'Sleep',
    value: '7.8',
    unit: 'hours',
    recordedAt: null,
    source: null,
  },
  {
    id: 'mood',
    indicator: 'mood',
    icon: '☺',
    name: 'Mood',
    value: 'Calm',
    unit: '',
    recordedAt: null,
    source: null,
  },
  {
    id: 'stress',
    indicator: 'stress',
    icon: '≋',
    name: 'Stress',
    value: '18',
    unit: '/ 100',
    recordedAt: null,
    source: null,
  },
  {
    id: 'act',
    indicator: 'act',
    icon: '➚',
    name: 'Physical Activity',
    value: '45',
    unit: 'minutes',
    recordedAt: null,
    source: null,
  },
];

export const FALLBACK_RISKS: RiskItem[] = [
  {
    id: 'rad',
    icon: '☢',
    name: 'Space Radiation',
    description:
      'Galactic cosmic rays, solar particle events and trapped radiation.',
    status: 'UNKNOWN',
    note: 'Radiation data unavailable',
  },
  {
    id: 'grav',
    icon: '⊙',
    name: 'Altered Gravity / Microgravity',
    description: 'Exposure to altered gravity during the mission.',
    status: 'NOT_CONFIGURED',
    note: 'No gravity environment or exercise records supplied',
  },
  {
    id: 'iso',
    icon: '◌',
    name: 'Isolation & Confinement',
    description: 'Mood, stress and sleep context for behavioral health.',
    status: 'NOT_CONFIGURED',
    note: 'Private. No approved assessments configured',
  },
  {
    id: 'env',
    icon: '▣',
    name: 'Hostile / Closed Environment',
    description: 'CO2, O2, cabin pressure, temperature, humidity.',
    status: 'INSUFFICIENT DATA',
    note: 'CO2: 4 simulated samples, one-hour coverage unverified',
  },
  {
    id: 'dist',
    icon: '◎',
    name: 'Distance from Earth',
    description: 'Mission distance, light time and communication status.',
    status: 'UNKNOWN',
    note: 'No mission distance configured',
  },
];

export const FALLBACK_SLEEP_RECORDS: SleepRecordItem[] = [
  { day: 'Day 1', hours: 7.5 },
  { day: 'Day 2', hours: 7.2 },
  { day: 'Day 3', hours: 6.8 },
  { day: 'Day 4', hours: 6.1 },
  { day: 'Day 5', hours: 5.9 },
];

export const FALLBACK_ENV_STATS: EnvStatsResponse = {
  samples: [
    {
      id: 'co2-1',
      userId: 'local',
      parameter: 'CO2',
      value: 2.8,
      unit: 'mmHg',
      sampledAt: Date.UTC(2026, 0, 1, 9, 0, 0, 0),
    },
    {
      id: 'co2-2',
      userId: 'local',
      parameter: 'CO2',
      value: 3.0,
      unit: 'mmHg',
      sampledAt: Date.UTC(2026, 0, 1, 9, 15, 0, 0),
    },
    {
      id: 'co2-3',
      userId: 'local',
      parameter: 'CO2',
      value: 3.2,
      unit: 'mmHg',
      sampledAt: Date.UTC(2026, 0, 1, 9, 30, 0, 0),
    },
    {
      id: 'co2-4',
      userId: 'local',
      parameter: 'CO2',
      value: 3.3,
      unit: 'mmHg',
      sampledAt: Date.UTC(2026, 0, 1, 9, 45, 0, 0),
    },
  ],
  latest: {
    id: 'co2-4',
    userId: 'local',
    parameter: 'CO2',
    value: 3.3,
    unit: 'mmHg',
    sampledAt: Date.UTC(2026, 0, 1, 9, 45, 0, 0),
  },
  sampleMean: 3.075,
  coverageMinutes: 45,
  verifiedHourAverage: null,
  status: 'INSUFFICIENT DATA',
};
