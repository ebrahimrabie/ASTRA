import { z } from 'zod';

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'DEFERRED' | 'OVERDUE';
export type UserRole = 'COMMANDER' | 'DOCTOR' | 'CREW';
export type DataQuality = 'VALID' | 'LATE' | 'STALE' | 'INVALID';
export type DataProvenance = 'Self-reported' | 'Manual entry' | 'Offline-queued';

export interface TaskRecord {
  id: string;
  userId: string;
  name: string;
  due: string;
  status: TaskStatus;
  deferReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryRecord {
  id: string;
  userId: string;
  taskId: string | null;
  text: string;
  createdAt: number;
}

export interface EnvSampleRecord {
  id: string;
  userId: string;
  parameter: string;
  value: number;
  unit: string;
  sampledAt: number;
}

export interface HealthIndicatorRecord {
  id: string;
  indicator: string;
  icon: string;
  name: string;
  value: string;
  unit: string;
  recordedAt: number | null;
  source: string | null;
}

export interface SleepRecord {
  day: string;
  hours: number;
}

export interface RiskDefinition {
  id: string;
  icon: string;
  name: string;
  description: string;
  status: string;
  note: string;
}

export interface Co2Stats {
  samples: EnvSampleRecord[];
  latest: EnvSampleRecord | null;
  sampleMean: number | null;
  coverageMinutes: number;
  verifiedHourAverage: number | null;
  status: 'INSUFFICIENT DATA' | 'MONITOR' | 'ALERT';
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export const createTaskSchema = z.object({
  name: z
    .string({ error: 'Task name is required.' })
    .trim()
    .min(1, 'Task name must be between 1 and 80 characters.')
    .max(80, 'Task name must be between 1 and 80 characters.'),
  due: z
    .string({ error: 'Due time is required.' })
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Due time must be in HH:MM format.'),
});

export const deferTaskSchema = z.object({
  reason: z
    .string({ error: 'Deferral reason is required.' })
    .trim()
    .min(1, 'Reason must be between 1 and 300 characters.')
    .max(300, 'Reason must be between 1 and 300 characters.'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  email: z.string().trim().email('Valid email is required.').max(120),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128),
  role: z.enum(['COMMANDER', 'DOCTOR', 'CREW']),
  inviteCode: z.string().trim().max(32).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const missionSetupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Mission name is required.')
    .max(80, 'Mission name must be 80 characters or fewer.'),
  startDateUtc: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD (UTC).'),
  plannedDays: z.number().int().min(1).max(3650),
  templateId: z.enum(['leo_iss', 'lunar', 'mars']),
  weeklyHazardWeekday: z.number().int().min(0).max(6).default(1),
});

export const dailyReadingSchema = z.object({
  indicator: z.enum(['hr', 'bp', 'sleep', 'mood', 'stress', 'act']),
  valueNumeric: z.number().optional().nullable(),
  systolic: z.number().min(30).max(300).optional().nullable(),
  diastolic: z.number().min(20).max(200).optional().nullable(),
  context: z.enum(['RESTING', 'AFTER_EXERCISE', 'OTHER']).optional().nullable(),
  activityType: z.enum(['RESISTIVE', 'AEROBIC', 'OTHER']).optional().nullable(),
  activityCompleted: z.boolean().optional().nullable(),
  sleepStartUtc: z.string().max(40).optional().nullable(),
  sleepEndUtc: z.string().max(40).optional().nullable(),
  measuredAt: z.number().int(),
  source: z.string().trim().min(1).max(120),
  deviceId: z.string().trim().max(80).optional().nullable(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Self-reported'),
  clientMutationId: z.string().trim().max(80).optional().nullable(),
});

export const radiationHazardSchema = z.object({
  category: z.literal('RADIATION'),
  detector: z.string().trim().min(1).max(120),
  detectorLocation: z.string().trim().min(1).max(120),
  deviceId: z.string().trim().max(80).optional().nullable(),
  periodStart: z.number().int(),
  periodEnd: z.number().int(),
  absorbedRateMgyDay: z.number().min(0).max(10000),
  effectiveRateMsvDay: z.number().min(0).max(10000),
  missionAccumulatedAbsorbedMgy: z.number().min(0).max(100000),
  missionAccumulatedEffectiveMsv: z.number().min(0).max(100000),
  priorCareerEffectiveMsv: z.number().min(0).max(100000).default(0),
  periodEffectiveMsv: z.number().min(0).max(10000).optional(),
  solarEventStatus: z.enum(['NONE', 'SPE_IN_PROGRESS', 'SPE_ENDED']),
  solarEventNotes: z.string().trim().max(500).optional().nullable(),
  measuredAt: z.number().int(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Manual entry'),
});

export const environmentHazardSchema = z.object({
  category: z.literal('ENVIRONMENT'),
  source: z.string().trim().min(1).max(120),
  deviceId: z.string().trim().max(80).optional().nullable(),
  co2Samples: z
    .array(
      z.object({
        valueMmHg: z.number().min(0).max(100),
        sampledAt: z.number().int(),
      })
    )
    .min(1),
  ppO2MmHg: z.number().min(0).max(1000).optional().nullable(),
  totalPressureKpa: z.number().min(0).max(300).optional().nullable(),
  diluentPercent: z.number().min(0).max(100).optional().nullable(),
  tempC: z.number().min(-50).max(100).optional().nullable(),
  rhPercent: z.number().min(0).max(100).optional().nullable(),
  ventilationStatus: z.enum(['NOMINAL', 'DEGRADED', 'OFF']).default('NOMINAL'),
  sevenDayMeanCo2: z.number().min(0).max(100).optional().nullable(),
  measuredAt: z.number().int(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Manual entry'),
});

export const gravityHazardSchema = z.object({
  category: z.literal('GRAVITY'),
  gravityEnvironment: z.string().trim().min(1).max(80),
  weeklyExerciseDays: z.number().int().min(0).max(7),
  source: z.string().trim().min(1).max(120),
  measuredAt: z.number().int(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Manual entry'),
});

export const isolationHazardSchema = z.object({
  category: z.literal('ISOLATION'),
  groundContactSessions: z.number().int().min(0).max(1000),
  daysSinceLastContact: z.number().int().min(0).max(3650),
  source: z.string().trim().min(1).max(120),
  measuredAt: z.number().int(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Manual entry'),
});

export const distanceHazardSchema = z.object({
  category: z.literal('DISTANCE'),
  distanceKm: z.number().min(0).max(1_000_000_000),
  commStatus: z.enum(['NOMINAL', 'DEGRADED', 'LOSS_OF_SIGNAL']),
  source: z.string().trim().min(1).max(120),
  deviceId: z.string().trim().max(80).optional().nullable(),
  measuredAt: z.number().int(),
  lateEntryNote: z.string().trim().max(300).optional().nullable(),
  provenance: z
    .enum(['Self-reported', 'Manual entry', 'Offline-queued'])
    .default('Manual entry'),
});

export const problemReportSchema = z.object({
  urgent: z.boolean().default(false),
  description: z.string().trim().min(3).max(1000),
  measuredAt: z.number().int(),
});

export const updateRuleSchema = z.object({
  customThreshold: z.string().trim().min(1).max(120).optional(),
  customGuidance: z.string().trim().max(500).optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  language: z.enum(['en', 'ar']).default('en'),
  numerals: z.enum(['western', 'arabic_indic']).default('western'),
  notifications: z
    .object({
      inAppMonitor: z.boolean().default(true),
      inAppReview: z.boolean().default(true),
      inAppHighPriority: z.boolean().default(true),
      browserNotifications: z.boolean().default(false),
      dailyReminderTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default('09:00'),
      quietHoursEnabled: z.boolean().default(false),
      quietStart: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default('22:00'),
      quietEnd: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default('06:00'),
    })
    .default({
      inAppMonitor: true,
      inAppReview: true,
      inAppHighPriority: true,
      browserNotifications: false,
      dailyReminderTime: '09:00',
      quietHoursEnabled: false,
      quietStart: '22:00',
      quietEnd: '06:00',
    }),
  units: z
    .object({
      temperature: z.enum(['C', 'F']).default('C'),
      pressure: z.enum(['kPa', 'psia', 'mmHg']).default('kPa'),
      distance: z.enum(['km', 'mi']).default('km'),
    })
    .default({
      temperature: 'C',
      pressure: 'kPa',
      distance: 'km',
    }),
});

export type UserPreferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: UserPreferences = preferencesSchema.parse({});

export const EXPORT_SECTIONS = [
  'daily_readings',
  'activity_sessions',
  'alerts',
  'problem_reports',
  'tasks',
  'baselines',
  'hazards',
  'audit_log',
  'preferences',
  'kb_references',
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];
export type ExportScope = 'my' | 'crew_member' | 'entire_crew' | 'mission';
export type ExportFormat = 'json' | 'csv_zip';

export const createExportSchema = z.object({
  scope: z.enum(['my', 'crew_member', 'entire_crew', 'mission']),
  subjectUserId: z.string().trim().min(1).max(80).optional().nullable(),
  fromMs: z.number().int().min(0),
  toMs: z.number().int().min(0),
  include: z.array(z.enum(EXPORT_SECTIONS)).min(1),
  format: z.enum(['json', 'csv_zip']),
  labelLanguage: z.enum(['en', 'ar']).default('en'),
});

export const demoLoadScenarioSchema = z.object({
  scenarioId: z.number().int().min(1).max(8),
});

export function validateMeasuredAtTimestamp(
  measuredAt: number,
  lateEntryNote?: string | null,
  nowMs = Date.now()
): { ok: true; quality: DataQuality } | { ok: false; code: string; error: string } {
  if (measuredAt > nowMs + 60_000) {
    return {
      ok: false,
      code: 'MEASURED_AT_FUTURE',
      error: 'Measurement timestamp cannot be in the future.',
    };
  }
  const sevenDaysMs = 7 * 86_400_000;
  if (measuredAt < nowMs - sevenDaysMs) {
    if (!lateEntryNote || lateEntryNote.trim().length < 3) {
      return {
        ok: false,
        code: 'LATE_ENTRY_NOTE_REQUIRED',
        error:
          'Measurements older than 7 days require a late entry explanation note.',
      };
    }
    return { ok: true, quality: 'LATE' };
  }
  return { ok: true, quality: 'VALID' };
}

export const SEED_HEALTH_INDICATORS: ReadonlyArray<
  Omit<HealthIndicatorRecord, 'id'>
> = [
  {
    indicator: 'hr',
    icon: '♥',
    name: 'Heart Rate',
    value: '72',
    unit: 'bpm',
    recordedAt: null,
    source: null,
  },
  {
    indicator: 'bp',
    icon: '◍',
    name: 'Blood Pressure',
    value: '118/76',
    unit: 'mmHg',
    recordedAt: null,
    source: null,
  },
  {
    indicator: 'sleep',
    icon: '☾',
    name: 'Sleep',
    value: '7.8',
    unit: 'hours',
    recordedAt: null,
    source: null,
  },
  {
    indicator: 'mood',
    icon: '☺',
    name: 'Mood',
    value: 'Calm',
    unit: '',
    recordedAt: null,
    source: null,
  },
  {
    indicator: 'stress',
    icon: '≋',
    name: 'Stress',
    value: '18',
    unit: '/ 100',
    recordedAt: null,
    source: null,
  },
  {
    indicator: 'act',
    icon: '➚',
    name: 'Physical Activity',
    value: '45',
    unit: 'minutes',
    recordedAt: null,
    source: null,
  },
];

export const RISK_DEFINITIONS: ReadonlyArray<RiskDefinition> = [
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

export const SEED_SLEEP_RECORDS: ReadonlyArray<SleepRecord> = [
  { day: 'Day 1', hours: 7.5 },
  { day: 'Day 2', hours: 7.2 },
  { day: 'Day 3', hours: 6.8 },
  { day: 'Day 4', hours: 6.1 },
  { day: 'Day 5', hours: 5.9 },
];

export const SEED_CO2_SAMPLES: ReadonlyArray<{
  parameter: string;
  value: number;
  unit: string;
  sampledAt: number;
}> = [
  {
    parameter: 'CO2',
    value: 2.8,
    unit: 'mmHg',
    sampledAt: Date.UTC(2026, 0, 1, 9, 0, 0, 0),
  },
  {
    parameter: 'CO2',
    value: 3.0,
    unit: 'mmHg',
    sampledAt: Date.UTC(2026, 0, 1, 9, 15, 0, 0),
  },
  {
    parameter: 'CO2',
    value: 3.2,
    unit: 'mmHg',
    sampledAt: Date.UTC(2026, 0, 1, 9, 30, 0, 0),
  },
  {
    parameter: 'CO2',
    value: 3.3,
    unit: 'mmHg',
    sampledAt: Date.UTC(2026, 0, 1, 9, 45, 0, 0),
  },
];

export function computeCo2Stats(rawSamples: EnvSampleRecord[]): Co2Stats {
  const samples = [...rawSamples].sort((a, b) => a.sampledAt - b.sampledAt);
  if (samples.length === 0) {
    return {
      samples: [],
      latest: null,
      sampleMean: null,
      coverageMinutes: 0,
      verifiedHourAverage: null,
      status: 'INSUFFICIENT DATA',
    };
  }

  const total = samples.reduce((acc, item) => acc + item.value, 0);
  const sampleMean = Number((total / samples.length).toFixed(6));
  const first = samples[0];
  const last = samples[samples.length - 1];
  const coverageMinutes = Math.max(
    0,
    Math.round((last.sampledAt - first.sampledAt) / 60_000)
  );
  const verifiedHourAverage = coverageMinutes >= 60 ? sampleMean : null;

  return {
    samples,
    latest: last,
    sampleMean,
    coverageMinutes,
    verifiedHourAverage,
    status: verifiedHourAverage === null ? 'INSUFFICIENT DATA' : 'MONITOR',
  };
}

export interface RateLimiterBucket {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, RateLimiterBucket>();

  constructor(maxRequests = 100, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  consume(
    key: string,
    now = Date.now()
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      if (this.buckets.size > 5000) {
        this.prune(now);
      }
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }

    if (existing.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      resetAt: existing.resetAt,
    };
  }

  private prune(now: number): void {
    for (const [k, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(k);
      }
    }
  }
}
