import JSZip from 'jszip';
import type {
  AlertRecord,
  DailyReadingRecord,
  HazardEntryRecord,
  MissionMemberRecord,
  MissionRecord,
  StoredRuleRecord,
  UserAccount,
} from './db.ts';
import type {
  DataProvenance,
  ExportFormat,
  ExportScope,
  ExportSection,
  UserPreferences,
} from './domain.ts';

export const APP_NAME = 'ASTRA';
export const APP_VERSION = '1.0.0';
export const EXPORT_SCHEMA_VERSION = 4;
export const EXPORT_DISCLAIMER =
  'Decision-support prototype. Not a validated clinical system.';
export const EXPORT_HONESTY_NOTE =
  'Values are exactly as entered. Nothing has been estimated or extrapolated.';

export interface ExportMetadata {
  app_name: string;
  app_version: string;
  schema_version: number;
  exported_at: string;
  exported_at_ms: number;
  exported_by: {
    id: string;
    name: string;
    role: string;
  };
  scope: ExportScope;
  subject_user_id: string | null;
  date_range: {
    from_iso_utc: string;
    to_iso_utc: string;
    from_ms: number;
    to_ms: number;
  };
  included_sections: ExportSection[];
  label_language: 'en' | 'ar';
  data_provenance: Record<DataProvenance, number>;
  disclaimer: string;
  honesty_note: string;
}

export interface ExportBundleInput {
  actor: UserAccount;
  mission: MissionRecord | null;
  roster: MissionMemberRecord[];
  scope: ExportScope;
  subjectUserId: string | null;
  fromMs: number;
  toMs: number;
  include: ExportSection[];
  format: ExportFormat;
  labelLanguage: 'en' | 'ar';
  dailyReadings: DailyReadingRecord[];
  alerts: AlertRecord[];
  problemReports: Array<{
    id: string;
    missionId: string;
    userId: string;
    userName: string;
    urgent: boolean;
    description: string;
    measuredAt: number;
    createdAt: number;
  }>;
  tasks: Array<{
    id: string;
    userId: string;
    userName: string;
    name: string;
    titleKey: string | null;
    scheduledDateUtc: string | null;
    due: string;
    status: string;
    deferReason: string | null;
    createdAt: number;
    updatedAt: number;
  }>;
  hazards: HazardEntryRecord[];
  auditLog: Array<{
    id: string;
    actorUserId: string;
    actorRole: string;
    actionKey: string;
    params: Record<string, unknown>;
    targetUserId: string | null;
    createdAt: number;
  }>;
  preferences: UserPreferences;
  rules: StoredRuleRecord[];
  protocols: Array<{ id: string; titleKey: string; frequency: string; roleScope: string; estimatedMinutes: number; sourceUrl: string }>;
  sources: Array<{ id: string; titleKey: string; organization: string; url: string }>;
  nowMs?: number;
}

const COLUMN_LABELS: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    id: 'ID',
    user_id: 'User ID',
    indicator: 'Indicator',
    value_numeric: 'Numeric Value',
    systolic: 'Systolic',
    diastolic: 'Diastolic',
    unit: 'Unit',
    status: 'Status',
    context: 'Context',
    activity_type: 'Activity Type',
    activity_completed: 'Activity Completed',
    measured_at_utc: 'Measured At (UTC)',
    measured_at_ms: 'Measured At (Epoch ms)',
    entered_at_utc: 'Entered At (UTC)',
    entered_at_ms: 'Entered At (Epoch ms)',
    source: 'Source',
    device_id: 'Device ID',
    data_quality: 'Data Quality',
    provenance: 'Provenance',
    late_entry_note: 'Late Entry Note',
    rule_id: 'Rule ID',
    severity: 'Severity',
    target_role: 'Target Role',
    measurement_text: 'Measurement',
    acknowledged_at_utc: 'Acknowledged At (UTC)',
    acknowledged_at_ms: 'Acknowledged At (Epoch ms)',
    created_at_utc: 'Created At (UTC)',
    created_at_ms: 'Created At (Epoch ms)',
    urgent: 'Urgent',
    description: 'Description',
    task_name: 'Task Name',
    scheduled_date_utc: 'Scheduled Date (UTC)',
    due_utc: 'Due Time (UTC)',
    defer_reason: 'Deferral Reason',
    category: 'Category',
    absorbed_rate_mgy_day: 'Absorbed Dose Rate (mGy/day)',
    effective_rate_msv_day: 'Effective Dose Rate (mSv/day)',
    mission_accumulated_absorbed_mgy: 'Mission Absorbed Total (mGy)',
    mission_accumulated_effective_msv: 'Mission Effective Total (mSv)',
    career_total_msv: 'Career Effective Total (mSv)',
    trailing_30d_effective_msv: 'Trailing 30-Day Effective (mSv)',
    co2_sample_mean_mmhg: 'CO2 Sample Mean (mmHg)',
    co2_verified_1h_mmhg: 'CO2 Verified 1h Avg (mmHg)',
    co2_status: 'CO2 Verification Status',
    distance_km: 'Distance (km)',
    one_way_light_sec: 'One-Way Light Time (s)',
    action_key: 'Audit Action',
    actor_user_id: 'Actor User ID',
    actor_role: 'Actor Role',
    target_user_id: 'Target User ID',
    params_json: 'Details JSON',
    label: 'Rule Label',
    threshold_value: 'Threshold',
    threshold_unit: 'Threshold Unit',
    source_url: 'Source URL',
    role: 'Role',
    name: 'Name',
  },
  ar: {
    id: 'المعرف',
    user_id: 'معرف المستخدم',
    indicator: 'المؤشر',
    value_numeric: 'القيمة الرقمية',
    systolic: 'الانقباضي',
    diastolic: 'الانبساطي',
    unit: 'الوحدة',
    status: 'الحالة',
    context: 'السياق',
    activity_type: 'نوع النشاط',
    activity_completed: 'إتمام النشاط',
    measured_at_utc: 'وقت القياس (UTC)',
    measured_at_ms: 'وقت القياس (مللي ثانية)',
    entered_at_utc: 'وقت الإدخال (UTC)',
    entered_at_ms: 'وقت الإدخال (مللي ثانية)',
    source: 'المصدر',
    device_id: 'معرف الجهاز',
    data_quality: 'جودة البيانات',
    provenance: 'مصدر البيانات',
    late_entry_note: 'ملاحظة الإدخال المتأخر',
    rule_id: 'معرف القاعدة',
    severity: 'الخطورة',
    target_role: 'الدور المستهدف',
    measurement_text: 'القياس',
    acknowledged_at_utc: 'وقت الإقرار (UTC)',
    acknowledged_at_ms: 'وقت الإقرار (مللي ثانية)',
    created_at_utc: 'وقت الإنشاء (UTC)',
    created_at_ms: 'وقت الإنشاء (مللي ثانية)',
    urgent: 'عاجل',
    description: 'الوصف',
    task_name: 'اسم المهمة',
    scheduled_date_utc: 'التاريخ المجدول (UTC)',
    due_utc: 'موعد الاستحقاق (UTC)',
    defer_reason: 'سبب التأجيل',
    category: 'الفئة',
    absorbed_rate_mgy_day: 'معدل الجرعة الممتصة (mGy/day)',
    effective_rate_msv_day: 'معدل الجرعة الفعالة (mSv/day)',
    mission_accumulated_absorbed_mgy: 'إجمالي الممتصة للمهمة (mGy)',
    mission_accumulated_effective_msv: 'إجمالي الفعالة للمهمة (mSv)',
    career_total_msv: 'الإجمالي المهني الفعال (mSv)',
    trailing_30d_effective_msv: 'الفعالة لآخر 30 يوماً (mSv)',
    co2_sample_mean_mmhg: 'متوسط عينات CO2 (mmHg)',
    co2_verified_1h_mmhg: 'متوسط ساعة CO2 المحقق (mmHg)',
    co2_status: 'حالة تحقق CO2',
    distance_km: 'المسافة (km)',
    one_way_light_sec: 'زمن الضوء ذهاباً (ث)',
    action_key: 'إجراء التدقيق',
    actor_user_id: 'معرف المنفذ',
    actor_role: 'دور المنفذ',
    target_user_id: 'المستهدف',
    params_json: 'تفاصيل JSON',
    label: 'تصنيف القاعدة',
    threshold_value: 'العتبة',
    threshold_unit: 'وحدة العتبة',
    source_url: 'رابط المصدر',
    role: 'الدور',
    name: 'الاسم',
  },
};

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = typeof value === 'string' ? value : String(value);
  // Formula-injection guard: prefix =, +, -, @, \t, \r with an apostrophe
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildCsvString(
  keys: string[],
  rows: Array<Record<string, unknown>>,
  lang: 'en' | 'ar'
): string {
  const dict = COLUMN_LABELS[lang] ?? COLUMN_LABELS.en;
  const headerLine = keys.map((k) => escapeCsvCell(dict[k] ?? k)).join(',');
  const bodyLines = rows.map((row) =>
    keys.map((k) => escapeCsvCell(row[k])).join(',')
  );
  // Prepend UTF-8 BOM so Excel opens Arabic cleanly
  return `\uFEFF${[headerLine, ...bodyLines].join('\r\n')}\r\n`;
}

export function formatExportFilename(
  scope: ExportScope,
  format: ExportFormat,
  nowMs = Date.now()
): string {
  const iso = new Date(nowMs).toISOString();
  const stamp = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
  const ext = format === 'json' ? 'json' : 'zip';
  return `astra-${scope}-${stamp}.${ext}`;
}

function unitForIndicator(ind: DailyReadingRecord['indicator']): string {
  switch (ind) {
    case 'hr':
      return 'bpm';
    case 'bp':
      return 'mmHg';
    case 'sleep':
      return 'hours';
    case 'mood':
      return 'level_1_to_5';
    case 'stress':
      return 'score_0_to_100';
    case 'act':
      return 'minutes';
    default:
      return 'UNKNOWN';
  }
}

function isoOrNull(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms)
    ? new Date(ms).toISOString()
    : null;
}

export function computeHonestReadingStatus(r: DailyReadingRecord, nowMs: number): string {
  if (r.dataQuality === 'INVALID') return 'INVALID';
  if (nowMs - r.measuredAt > 24 * 3600_000) return 'STALE';
  if (r.indicator === 'bp' && (r.systolic === null || r.diastolic === null)) {
    return 'INSUFFICIENT DATA';
  }
  if (r.indicator !== 'bp' && r.valueNumeric === null) {
    return 'UNKNOWN';
  }
  return r.dataQuality;
}

export function estimateExportRowCount(input: {
  dailyReadingsCount: number;
  alertsCount: number;
  tasksCount: number;
  hazardsCount: number;
  auditCount: number;
  problemReportsCount: number;
}): number {
  return (
    input.dailyReadingsCount +
    input.alertsCount +
    input.tasksCount +
    input.hazardsCount +
    input.auditCount +
    input.problemReportsCount
  );
}

export async function serializeExportBundle(input: ExportBundleInput): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  metadata: ExportMetadata;
}> {
  const nowMs = input.nowMs ?? Date.now();
  const includeSet = new Set(input.include);
  const provenanceCounts: Record<DataProvenance, number> = {
    'Self-reported': 0,
    'Manual entry': 0,
    'Offline-queued': 0,
  };

  for (const r of input.dailyReadings) {
    if (r.provenance in provenanceCounts) provenanceCounts[r.provenance] += 1;
  }
  if (input.actor.role === 'COMMANDER') {
    for (const h of input.hazards) {
      if (h.provenance in provenanceCounts) provenanceCounts[h.provenance] += 1;
    }
  }

  const metadata: ExportMetadata = {
    app_name: APP_NAME,
    app_version: APP_VERSION,
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date(nowMs).toISOString(),
    exported_at_ms: nowMs,
    exported_by: {
      id: input.actor.id,
      name: input.actor.name,
      role: input.actor.role,
    },
    scope: input.scope,
    subject_user_id: input.subjectUserId,
    date_range: {
      from_iso_utc: new Date(input.fromMs).toISOString(),
      to_iso_utc: new Date(input.toMs).toISOString(),
      from_ms: input.fromMs,
      to_ms: input.toMs,
    },
    included_sections: input.include,
    label_language: input.labelLanguage,
    data_provenance: provenanceCounts,
    disclaimer: EXPORT_DISCLAIMER,
    honesty_note: EXPORT_HONESTY_NOTE,
  };

  const data: Record<string, unknown> = {};

  if (input.actor.role === 'COMMANDER' && input.scope === 'mission' && input.mission) {
    data.mission_roster = input.roster.map((m) => ({
      user_id: m.userId,
      name: m.name,
      role: m.role,
      joined_at_utc: isoOrNull(m.joinedAt),
      joined_at_ms: m.joinedAt,
    }));
  }

  if (includeSet.has('daily_readings')) {
    const filtered = input.dailyReadings.filter((r) => {
      if (r.indicator === 'act') return false;
      // Double-defense privacy guard: Commander mission export NEVER exposes another user's health or psych values
      if (input.actor.role === 'COMMANDER' && r.userId !== input.actor.id) return false;
      if (input.actor.role === 'CREW' && r.userId !== input.actor.id) return false;
      return true;
    });
    data.daily_readings = filtered.map((r) => ({
      id: r.id,
      user_id: r.userId,
      indicator: r.indicator,
      value_numeric: r.valueNumeric ?? null,
      systolic: r.systolic ?? null,
      diastolic: r.diastolic ?? null,
      unit: unitForIndicator(r.indicator),
      status: computeHonestReadingStatus(r, nowMs),
      context: r.context ?? null,
      measured_at_utc: isoOrNull(r.measuredAt),
      measured_at_ms: r.measuredAt,
      entered_at_utc: isoOrNull(r.enteredAt),
      entered_at_ms: r.enteredAt,
      source: r.source || 'UNKNOWN',
      device_id: r.deviceId ?? null,
      data_quality: r.dataQuality,
      provenance: r.provenance,
      late_entry_note: r.lateEntryNote ?? null,
    }));
  }

  if (includeSet.has('activity_sessions')) {
    const filtered = input.dailyReadings.filter((r) => {
      if (r.indicator !== 'act') return false;
      if (input.actor.role === 'CREW' && r.userId !== input.actor.id) return false;
      // Commander may see non-ranked crew exercise sessions when scope === 'mission', never psych data
      if (
        input.actor.role === 'COMMANDER' &&
        input.scope === 'my' &&
        r.userId !== input.actor.id
      ) {
        return false;
      }
      return true;
    });
    data.activity_sessions = filtered.map((r) => ({
      id: r.id,
      user_id: r.userId,
      indicator: 'act',
      value_numeric: r.valueNumeric ?? null,
      unit: 'minutes',
      status: computeHonestReadingStatus(r, nowMs),
      activity_type: r.activityType ?? null,
      activity_completed: r.activityCompleted ?? null,
      measured_at_utc: isoOrNull(r.measuredAt),
      measured_at_ms: r.measuredAt,
      entered_at_utc: isoOrNull(r.enteredAt),
      entered_at_ms: r.enteredAt,
      source: r.source || 'UNKNOWN',
      device_id: r.deviceId ?? null,
      data_quality: r.dataQuality,
      provenance: r.provenance,
    }));
  }

  if (includeSet.has('alerts')) {
    const filteredAlerts = input.alerts.filter((a) => {
      if (input.actor.role === 'CREW') {
        return a.targetRole === 'CREW' && a.subjectUserId === input.actor.id;
      }
      if (input.actor.role === 'COMMANDER') {
        return a.targetRole === 'COMMANDER';
      }
      return a.targetRole === 'DOCTOR';
    });
    data.alerts = filteredAlerts.map((a) => ({
      id: a.id,
      rule_id: a.ruleId,
      severity: a.severity,
      target_role: a.targetRole,
      user_id: a.subjectUserId ?? null,
      measurement_text: a.measurementText,
      source: a.source || 'UNKNOWN',
      measured_at_utc: isoOrNull(a.measuredAt),
      measured_at_ms: a.measuredAt,
      acknowledged_at_utc: isoOrNull(a.acknowledgedAt),
      acknowledged_at_ms: a.acknowledgedAt ?? null,
      created_at_utc: isoOrNull(a.createdAt),
      created_at_ms: a.createdAt,
    }));
  }

  if (includeSet.has('problem_reports') && input.actor.role !== 'COMMANDER') {
    const filteredReports = input.problemReports.filter((pr) =>
      input.actor.role === 'CREW' ? pr.userId === input.actor.id : true
    );
    data.problem_reports = filteredReports.map((pr) => ({
      id: pr.id,
      user_id: pr.userId,
      urgent: pr.urgent,
      description: pr.description,
      measured_at_utc: isoOrNull(pr.measuredAt),
      measured_at_ms: pr.measuredAt,
      created_at_utc: isoOrNull(pr.createdAt),
      created_at_ms: pr.createdAt,
    }));
  }

  if (includeSet.has('tasks')) {
    const filteredTasks = input.tasks.filter((t) =>
      input.actor.role === 'CREW' || input.scope === 'my'
        ? t.userId === input.actor.id
        : true
    );
    data.tasks = filteredTasks.map((t) => ({
      id: t.id,
      user_id: t.userId,
      task_name: t.name,
      scheduled_date_utc: t.scheduledDateUtc ?? null,
      due_utc: t.due,
      status: t.status,
      // Compliance only in mission scope for Commander; never leak personal deferral notes if psych-sensitive
      defer_reason:
        input.actor.role === 'COMMANDER' &&
        input.scope === 'mission' &&
        t.userId !== input.actor.id
          ? null
          : t.deferReason ?? null,
      created_at_utc: isoOrNull(t.createdAt),
      created_at_ms: t.createdAt,
    }));
  }

  if (includeSet.has('baselines')) {
    data.baselines = [
      {
        indicator: 'hr',
        value_numeric: null,
        unit: 'bpm',
        status: 'NOT_CONFIGURED',
        source: null,
      },
      {
        indicator: 'bp',
        value_numeric: null,
        unit: 'mmHg',
        status: 'NOT_CONFIGURED',
        source: null,
      },
      {
        indicator: 'sleep',
        value_numeric: null,
        unit: 'hours',
        status: 'NOT_CONFIGURED',
        source: null,
      },
    ];
  }

  // Strictly Commander only — Doctor NEVER receives hazards
  if (includeSet.has('hazards') && input.actor.role === 'COMMANDER') {
    data.hazards = input.hazards.map((h) => {
      const p = h.payload as Record<string, unknown>;
      const c = h.computed as Record<string, unknown>;
      return {
        id: h.id,
        category: h.category,
        absorbed_rate_mgy_day:
          typeof p.absorbedRateMgyDay === 'number' ? p.absorbedRateMgyDay : null,
        effective_rate_msv_day:
          typeof p.effectiveRateMsvDay === 'number' ? p.effectiveRateMsvDay : null,
        mission_accumulated_absorbed_mgy:
          typeof p.missionAccumulatedAbsorbedMgy === 'number'
            ? p.missionAccumulatedAbsorbedMgy
            : null,
        mission_accumulated_effective_msv:
          typeof p.missionAccumulatedEffectiveMsv === 'number'
            ? p.missionAccumulatedEffectiveMsv
            : null,
        career_total_msv:
          typeof c.careerTotalMsv === 'number' ? c.careerTotalMsv : null,
        trailing_30d_effective_msv:
          typeof c.trailing30DayEffectiveMsv === 'number'
            ? c.trailing30DayEffectiveMsv
            : null,
        co2_sample_mean_mmhg:
          typeof c.sampleMean === 'number' ? c.sampleMean : null,
        co2_verified_1h_mmhg:
          typeof c.verifiedHourAverage === 'number' ? c.verifiedHourAverage : null,
        co2_status:
          typeof c.co2Status === 'string'
            ? c.co2Status
            : h.category === 'ENVIRONMENT'
              ? 'INSUFFICIENT DATA'
              : null,
        distance_km: typeof p.distanceKm === 'number' ? p.distanceKm : null,
        one_way_light_sec:
          typeof c.oneWayLightSeconds === 'number' ? c.oneWayLightSeconds : null,
        measured_at_utc: isoOrNull(h.measuredAt),
        measured_at_ms: h.measuredAt,
        entered_at_utc: isoOrNull(h.enteredAt),
        entered_at_ms: h.enteredAt,
        source: h.source || 'UNKNOWN',
        device_id: h.deviceId ?? null,
        data_quality: h.dataQuality,
        provenance: h.provenance,
        // Never emit individual psych metrics; Isolation entry stores only ground contact counts
        ground_contact_sessions:
          typeof p.groundContactSessions === 'number' ? p.groundContactSessions : null,
        days_since_last_contact:
          typeof p.daysSinceLastContact === 'number' ? p.daysSinceLastContact : null,
      };
    });
  }

  if (includeSet.has('audit_log') && input.actor.role !== 'CREW') {
    data.audit_log = input.auditLog.map((a) => ({
      id: a.id,
      action_key: a.actionKey,
      actor_user_id: a.actorUserId,
      actor_role: a.actorRole,
      target_user_id: a.targetUserId ?? null,
      params_json: JSON.stringify(a.params),
      created_at_utc: isoOrNull(a.createdAt),
      created_at_ms: a.createdAt,
    }));
  }

  if (includeSet.has('preferences')) {
    data.preferences = input.preferences;
  }

  if (includeSet.has('kb_references')) {
    data.kb_references = {
      rules: input.rules.map((r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        label: r.label,
        status: r.status,
        threshold_value: r.customThreshold ?? r.thresholdValue,
        threshold_unit: r.thresholdUnit,
        source_url: r.sourceUrl,
      })),
      protocols: input.protocols,
      sources: input.sources,
    };
  }

  const fileName = formatExportFilename(input.scope, input.format, nowMs);

  if (input.format === 'json') {
    const payload = { metadata, data };
    return {
      buffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      fileName,
      mimeType: 'application/json; charset=utf-8',
      metadata,
    };
  }

  // CSV ZIP
  const zip = new JSZip();
  const readmeLines = [
    `${APP_NAME} Export Package (v${APP_VERSION}, Schema v${EXPORT_SCHEMA_VERSION})`,
    `Exported At (UTC): ${metadata.exported_at}`,
    `Exported By: ${metadata.exported_by.name} (${metadata.exported_by.role})`,
    `Scope: ${metadata.scope}`,
    `Date Range (UTC): ${metadata.date_range.from_iso_utc} .. ${metadata.date_range.to_iso_utc}`,
    `Included Sections: ${metadata.included_sections.join(', ')}`,
    `Label Language: ${metadata.label_language}`,
    `Data Provenance: Self-reported=${provenanceCounts['Self-reported']}, Manual entry=${provenanceCounts['Manual entry']}, Offline-queued=${provenanceCounts['Offline-queued']}`,
    `Disclaimer: ${EXPORT_DISCLAIMER}`,
    `Integrity Note: ${EXPORT_HONESTY_NOTE}`,
  ];
  zip.file('README.txt', `\uFEFF${readmeLines.join('\r\n')}\r\n`);

  const addCsvSection = (
    name: string,
    keys: string[],
    rows: Array<Record<string, unknown>>
  ) => {
    zip.file(`${name}.csv`, buildCsvString(keys, rows, input.labelLanguage));
  };

  if (Array.isArray(data.mission_roster)) {
    addCsvSection(
      'mission_roster',
      ['user_id', 'name', 'role', 'created_at_utc', 'created_at_ms'],
      (data.mission_roster as Array<Record<string, unknown>>).map((r) => ({
        user_id: r.user_id,
        name: r.name,
        role: r.role,
        created_at_utc: r.joined_at_utc,
        created_at_ms: r.joined_at_ms,
      }))
    );
  }

  if (Array.isArray(data.daily_readings)) {
    addCsvSection(
      'daily_readings',
      [
        'id',
        'user_id',
        'indicator',
        'value_numeric',
        'systolic',
        'diastolic',
        'unit',
        'status',
        'context',
        'measured_at_utc',
        'measured_at_ms',
        'entered_at_utc',
        'entered_at_ms',
        'source',
        'device_id',
        'data_quality',
        'provenance',
        'late_entry_note',
      ],
      data.daily_readings as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.activity_sessions)) {
    addCsvSection(
      'activity_sessions',
      [
        'id',
        'user_id',
        'indicator',
        'value_numeric',
        'unit',
        'status',
        'activity_type',
        'activity_completed',
        'measured_at_utc',
        'measured_at_ms',
        'source',
        'device_id',
        'data_quality',
        'provenance',
      ],
      data.activity_sessions as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.alerts)) {
    addCsvSection(
      'alerts',
      [
        'id',
        'rule_id',
        'severity',
        'target_role',
        'user_id',
        'measurement_text',
        'source',
        'measured_at_utc',
        'measured_at_ms',
        'acknowledged_at_utc',
        'acknowledged_at_ms',
        'created_at_utc',
        'created_at_ms',
      ],
      data.alerts as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.problem_reports)) {
    addCsvSection(
      'problem_reports',
      [
        'id',
        'user_id',
        'urgent',
        'description',
        'measured_at_utc',
        'measured_at_ms',
        'created_at_utc',
        'created_at_ms',
      ],
      data.problem_reports as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.tasks)) {
    addCsvSection(
      'tasks',
      [
        'id',
        'user_id',
        'task_name',
        'scheduled_date_utc',
        'due_utc',
        'status',
        'defer_reason',
        'created_at_utc',
        'created_at_ms',
      ],
      data.tasks as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.baselines)) {
    addCsvSection(
      'baselines',
      ['indicator', 'value_numeric', 'unit', 'status', 'source'],
      data.baselines as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.hazards)) {
    addCsvSection(
      'hazards',
      [
        'id',
        'category',
        'absorbed_rate_mgy_day',
        'effective_rate_msv_day',
        'mission_accumulated_absorbed_mgy',
        'mission_accumulated_effective_msv',
        'career_total_msv',
        'trailing_30d_effective_msv',
        'co2_sample_mean_mmhg',
        'co2_verified_1h_mmhg',
        'co2_status',
        'distance_km',
        'one_way_light_sec',
        'measured_at_utc',
        'measured_at_ms',
        'source',
        'device_id',
        'data_quality',
        'provenance',
      ],
      data.hazards as Array<Record<string, unknown>>
    );
  }

  if (Array.isArray(data.audit_log)) {
    addCsvSection(
      'audit_log',
      [
        'id',
        'action_key',
        'actor_user_id',
        'actor_role',
        'target_user_id',
        'params_json',
        'created_at_utc',
        'created_at_ms',
      ],
      data.audit_log as Array<Record<string, unknown>>
    );
  }

  if (data.preferences) {
    addCsvSection('preferences', ['description', 'params_json'], [
      {
        description: 'User preferences',
        params_json: JSON.stringify(data.preferences),
      },
    ]);
  }

  if (data.kb_references) {
    const kb = data.kb_references as { rules: Array<Record<string, unknown>> };
    addCsvSection(
      'reference_rules',
      ['id', 'category', 'severity', 'label', 'status', 'threshold_value', 'threshold_unit', 'source_url'],
      kb.rules
    );
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    buffer,
    fileName,
    mimeType: 'application/zip',
    metadata,
  };
}
