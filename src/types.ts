export type TaskStatus = 'PENDING' | 'COMPLETED' | 'DEFERRED' | 'OVERDUE';
export type UserRole = 'COMMANDER' | 'DOCTOR' | 'CREW';
export type DataQuality = 'VALID' | 'LATE' | 'STALE' | 'INVALID';
export type DataProvenance = 'Self-reported' | 'Manual entry' | 'Offline-queued';
export type RuleLabel = 'NASA_REFERENCE' | 'CLINICAL_REFERENCE' | 'PROTOTYPE_DEFAULT';
export type RuleSeverity =
  | 'INFORMATION'
  | 'MONITOR'
  | 'REVIEW'
  | 'ALERT'
  | 'HIGH_PRIORITY'
  | 'UNKNOWN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface MissionInfo {
  id: string;
  name: string;
  inviteCode: string;
  startDateUtc: string;
  plannedDays: number;
  templateId: 'leo_iss' | 'lunar' | 'mars';
  weeklyHazardWeekday: number;
  isDemo: boolean;
  lastSyncAt: number | null;
}

export interface MissionDerivedInfo {
  missionDay: number;
  plannedDays: number;
  progressPercent: number;
  distanceKm: number;
  distanceIsTemplateDefault: boolean;
  oneWayLightSeconds: number;
  roundTripLightSeconds: number;
  lastSyncAt: number | null;
}

export interface MissionTemplateItem {
  id: 'leo_iss' | 'lunar' | 'mars';
  key: string;
  title_key: string;
  description_key: string;
  default_distance_km: number;
  orbital_altitude_km: number | null;
  orbit_period_minutes: number | null;
  sunrises_per_day: number | null;
  gcr_reference_msv_day: number;
  surface_gcr_reference_msv_day: number | null;
  typical_effective_min: number | null;
  typical_effective_max: number | null;
  typical_absorbed_max: number | null;
  default_one_way_light_sec: number;
  source_url: string;
}

export interface ProtocolStepItem {
  id: string;
  stepNumber: number;
  textKey: string;
}

export interface ProtocolItem {
  id: string;
  titleKey: string;
  purposeKey: string;
  frequency: 'DAILY' | 'WEEKLY';
  roleScope: 'CREW' | 'COMMANDER';
  estimatedMinutes: number;
  safetyNoteKey: string;
  sourceUrl: string;
  steps: ProtocolStepItem[];
}

export interface InstrumentItem {
  id: string;
  category: 'RADIATION' | 'DAILY_READING' | 'ENVIRONMENT' | 'DISTANCE';
  code: string;
  nameKey: string;
  descriptionKey: string;
  allowCustom: boolean;
  sortOrder: number;
}

export interface ReferenceRuleItem {
  id: string;
  category: string;
  parameter: string;
  severity: RuleSeverity;
  label: RuleLabel;
  status: string;
  thresholdValue: string;
  thresholdUnit: string;
  titleKey: string;
  explanationKey: string;
  nextStepKey: string;
  sourceCitationKey: string;
  sourceUrl: string;
  notifyDoctor: boolean;
  notifyCommander: boolean;
  customGuidance: string | null;
  customThreshold: string | null;
  updatedAt: number | null;
}

export interface RuleChangeLogItem {
  id: string;
  rule_id: string;
  changed_by: string;
  changed_by_name?: string;
  previous_threshold: string | null;
  new_threshold: string | null;
  previous_guidance: string | null;
  new_guidance: string | null;
  created_at: number;
}

export interface DataSourceItem {
  id: string;
  titleKey: string;
  organization: string;
  url: string;
  noteKey: string;
}

export interface DailyReadingItem {
  id: string;
  missionId: string;
  userId: string;
  indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
  valueNumeric: number | null;
  systolic: number | null;
  diastolic: number | null;
  context: string | null;
  activityType: string | null;
  activityCompleted: boolean | null;
  sleepStartUtc: string | null;
  sleepEndUtc: string | null;
  measuredAt: number;
  enteredAt: number;
  enteredBy: string;
  source: string;
  deviceId: string | null;
  dataQuality: DataQuality;
  lateEntryNote: string | null;
  provenance: DataProvenance;
}

export interface HazardEntryItem {
  id: string;
  missionId: string;
  enteredBy: string;
  category: 'RADIATION' | 'ENVIRONMENT' | 'GRAVITY' | 'ISOLATION' | 'DISTANCE';
  payload: Record<string, unknown>;
  computed: Record<string, unknown>;
  measuredAt: number;
  enteredAt: number;
  source: string;
  deviceId: string | null;
  dataQuality: DataQuality;
  lateEntryNote: string | null;
  provenance: DataProvenance;
}

export interface AlertItem {
  id: string;
  seq: number;
  missionId: string;
  subjectUserId: string | null;
  subjectUserName?: string | null;
  targetRole: UserRole;
  ruleId: string;
  severity: RuleSeverity;
  titleKey: string;
  params: Record<string, unknown>;
  measurementText: string;
  measuredAt: number;
  source: string;
  explanationKey: string;
  nextStepKey: string;
  customGuidance: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: number | null;
  createdAt: number;
}

export interface CalendarTaskItem {
  id: string;
  missionId: string | null;
  userId: string;
  name: string;
  titleKey: string | null;
  protocolId: string | null;
  scheduledDateUtc: string | null;
  due: string;
  status: TaskStatus;
  deferReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'ar';
  numerals: 'western' | 'arabic_indic';
  notifications: {
    inAppMonitor: boolean;
    inAppReview: boolean;
    inAppHighPriority: boolean;
    browserNotifications: boolean;
    dailyReminderTime: string;
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
  };
  units: {
    temperature: 'C' | 'F';
    pressure: 'kPa' | 'psia' | 'mmHg';
    distance: 'km' | 'mi';
  };
}

export interface TaskItem {
  id: string;
  userId: string;
  name: string;
  due: string;
  status: TaskStatus;
  deferReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryItem {
  id: string;
  userId: string;
  taskId: string | null;
  text: string;
  createdAt: number;
}

export interface HealthIndicatorItem {
  id: string;
  indicator: string;
  icon: string;
  name: string;
  value: string;
  unit: string;
  recordedAt: number | null;
  source: string | null;
}

export interface SleepRecordItem {
  day: string;
  hours: number;
}

export interface RiskItem {
  id: string;
  icon: string;
  name: string;
  description: string;
  status: string;
  note: string;
}

export interface EnvSampleItem {
  id: string;
  userId: string;
  parameter: string;
  value: number;
  unit: string;
  sampledAt: number;
}

export interface EnvStatsResponse {
  samples: EnvSampleItem[];
  latest: EnvSampleItem | null;
  sampleMean: number | null;
  coverageMinutes: number;
  verifiedHourAverage: number | null;
  status: 'INSUFFICIENT DATA' | 'MONITOR' | 'ALERT';
}

export type SyncStatus = 'CONNECTING' | 'BACKEND SYNCED' | 'LOCAL ONLY' | 'SYNC PENDING';

// ===== Phase 4 Types =====
export interface AchievementCatalogItem {
  id: string;
  key: string;
  kind: 'EDUCATION' | 'CONSISTENCY' | 'MISSION_PROGRESS';
  points: number;
  titleKey: string;
  descriptionKey: string;
  unlockHintKey: string;
  targetValue: number | null;
  unlockedAt: number | null;
}

export interface AchievementsSummaryResponse {
  totalPoints: number;
  items: AchievementCatalogItem[];
}

export interface EducationQuizQuestion {
  id: string;
  questionKey: string;
  optionsKeys: readonly [string, string, string];
  correctIndex: number;
  explanationKey: string;
}

export interface EducationCardDetail {
  key: string;
  achievementId: string;
  titleKey: string;
  summaryKey: string;
  sourceKey: string;
  sourceUrl: string;
  questions: EducationQuizQuestion[];
}

export interface EducationAnswerFeedback {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanationKey: string;
}

export interface ReportSummaryResponse {
  generatedAt: number;
  fromMs: number;
  toMs: number;
  totalDays: number;
  viewerRole: UserRole;
  mission: MissionInfo;
  derived: MissionDerivedInfo;
  roster: Array<{ userId: string; name: string; role: UserRole }>;
  completeness: Array<{
    indicator: 'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act';
    daysRecorded: number;
    totalDays: number;
  }>;
  readings: DailyReadingItem[];
  sleepSeries: SleepRecordItem[];
  alerts: AlertItem[];
  tasks: CalendarTaskItem[];
  taskCompliance: {
    total: number;
    done: number;
    deferred: number;
    notDone: number;
  };
  complianceByMember: Array<{
    userId: string;
    name: string;
    role: UserRole;
    doneCount: number;
    notDoneCount: number;
  }>;
  crewSummary: Array<{
    userId: string;
    name: string;
    role: UserRole;
    readingsCount: number;
    recordedDays: number;
    totalDays: number;
    openAlerts: number;
  }>;
  problemReports: Array<{
    id: string;
    userId: string;
    userName: string;
    urgent: boolean;
    description: string;
    measuredAt: number;
    createdAt: number;
  }>;
  ruleChanges: RuleChangeLogItem[];
  hazards: HazardEntryItem[];
  baselines: Array<{
    indicator: string;
    value: number | null;
    unit: string;
    status: string;
  }>;
}

export type ExportSection =
  | 'daily_readings'
  | 'activity_sessions'
  | 'alerts'
  | 'problem_reports'
  | 'tasks'
  | 'baselines'
  | 'hazards'
  | 'audit_log'
  | 'preferences'
  | 'kb_references';

export type ExportScope = 'my' | 'crew_member' | 'entire_crew' | 'mission';
export type ExportFormat = 'json' | 'csv_zip';

export interface ExportJobItem {
  id: string;
  userId?: string;
  missionId?: string | null;
  scope: ExportScope;
  subjectUserId?: string | null;
  fromMs: number;
  toMs: number;
  include: ExportSection[];
  format: ExportFormat;
  labelLanguage: 'en' | 'ar';
  status: 'PENDING' | 'READY' | 'FAILED';
  fileName: string;
  mimeType: string;
  fileBytes: number;
  estimatedRows?: number;
  expiresAt: number;
  createdAt: number;
  downloadUrl?: string;
}

export interface DemoScenarioItem {
  id: number;
  key: string;
  titleKey: string;
  descKey: string;
  targetRoute: string;
}

