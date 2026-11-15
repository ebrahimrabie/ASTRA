import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeCo2Stats,
  DEFAULT_PREFERENCES,
  RISK_DEFINITIONS,
  SEED_CO2_SAMPLES,
  SEED_HEALTH_INDICATORS,
  SEED_SLEEP_RECORDS,
  type Co2Stats,
  type DataProvenance,
  type DataQuality,
  type EnvSampleRecord,
  type HealthIndicatorRecord,
  type HistoryRecord,
  type RiskDefinition,
  type SleepRecord,
  type TaskRecord,
  type TaskStatus,
  type UserPreferences,
  type UserRole,
} from './domain.ts';
import {
  DATA_SOURCES_SEED,
  EDUCATION_CARDS_SEED,
  seedKnowledgeBase,
  type RuleLabel,
  type RuleSeverity,
} from './kb.ts';
import {
  analyzeCo2Series,
  calculateMissionDerived,
  evaluateActivityRule,
  evaluateBloodPressureRules,
  evaluateEnvironmentHazard,
  evaluateHeartRateRules,
  evaluateMoodAndStressRules,
  evaluateOtherCommanderHazards,
  evaluateRadiationRules,
  evaluateSleepRules,
  type MissionDerived,
  type TriggeredRuleResult,
} from './rulesEngine.ts';

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  readonly code: string;
  constructor(message: string, code = 'FORBIDDEN') {
    super(message);
    this.name = 'ForbiddenError';
    this.code = code;
  }
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: number;
}

export interface MissionRecord {
  id: string;
  name: string;
  inviteCode: string;
  startDateUtc: string;
  plannedDays: number;
  templateId: 'leo_iss' | 'lunar' | 'mars';
  weeklyHazardWeekday: number;
  isDemo: boolean;
  createdBy: string;
  lastSyncAt: number | null;
  createdAt: number;
}

export interface MissionMemberRecord {
  id: string;
  missionId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  joinedAt: number;
}

export interface DailyReadingRecord {
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
  clientMutationId: string | null;
}

export interface HazardEntryRecord {
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

export interface AlertRecord {
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

export interface CalendarTaskRecord {
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

export interface StoredRuleRecord {
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

export class AstraRepository {
  readonly db: Database.Database;

  constructor(dbPath = path.resolve(process.cwd(), 'data', 'astra.db')) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    seedKnowledgeBase(this.db);
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        due TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'DEFERRED', 'OVERDUE')),
        defer_reason TEXT NULL,
        mission_id TEXT NULL,
        protocol_id TEXT NULL,
        scheduled_date_utc TEXT NULL,
        title_key TEXT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        task_id TEXT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS env_samples (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        parameter TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        sampled_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS health_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        indicator TEXT NOT NULL,
        value TEXT NOT NULL,
        unit TEXT NOT NULL,
        recorded_at INTEGER NULL,
        source TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('COMMANDER', 'DOCTOR', 'CREW')),
        token_version INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        start_date_utc TEXT NOT NULL,
        planned_days INTEGER NOT NULL,
        template_id TEXT NOT NULL,
        weekly_hazard_weekday INTEGER NOT NULL DEFAULT 1,
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        last_sync_at INTEGER NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mission_members (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('COMMANDER', 'DOCTOR', 'CREW')),
        joined_at INTEGER NOT NULL,
        UNIQUE(mission_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS mission_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        title_key TEXT NOT NULL,
        description_key TEXT NOT NULL,
        default_distance_km REAL NOT NULL,
        orbital_altitude_km REAL NULL,
        orbit_period_minutes REAL NULL,
        sunrises_per_day INTEGER NULL,
        gcr_reference_msv_day REAL NOT NULL,
        surface_gcr_reference_msv_day REAL NULL,
        typical_effective_min REAL NULL,
        typical_effective_max REAL NULL,
        typical_absorbed_max REAL NULL,
        default_one_way_light_sec REAL NOT NULL,
        source_url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reference_rules (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        parameter TEXT NOT NULL,
        severity TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        threshold_value TEXT NOT NULL,
        threshold_unit TEXT NOT NULL,
        title_key TEXT NOT NULL,
        explanation_key TEXT NOT NULL,
        next_step_key TEXT NOT NULL,
        source_citation_key TEXT NOT NULL,
        source_url TEXT NOT NULL,
        notify_doctor INTEGER NOT NULL,
        notify_commander INTEGER NOT NULL,
        custom_guidance TEXT NULL,
        custom_threshold TEXT NULL,
        updated_at INTEGER NULL
      );

      CREATE TABLE IF NOT EXISTS rule_change_log (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        previous_threshold TEXT NULL,
        new_threshold TEXT NULL,
        previous_guidance TEXT NULL,
        new_guidance TEXT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS protocols (
        id TEXT PRIMARY KEY,
        title_key TEXT NOT NULL,
        purpose_key TEXT NOT NULL,
        frequency TEXT NOT NULL,
        role_scope TEXT NOT NULL,
        estimated_minutes INTEGER NOT NULL,
        safety_note_key TEXT NOT NULL,
        source_url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS protocol_steps (
        id TEXT PRIMARY KEY,
        protocol_id TEXT NOT NULL,
        step_number INTEGER NOT NULL,
        text_key TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS instruments (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        code TEXT NOT NULL,
        name_key TEXT NOT NULL,
        description_key TEXT NOT NULL,
        allow_custom INTEGER NOT NULL,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS achievements_catalog (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        points INTEGER NOT NULL,
        title_key TEXT NOT NULL,
        description_key TEXT NOT NULL,
        unlock_hint_key TEXT NOT NULL,
        target_value INTEGER NULL
      );

      CREATE TABLE IF NOT EXISTS education_cards (
        key TEXT PRIMARY KEY,
        achievement_id TEXT NOT NULL,
        title_key TEXT NOT NULL,
        summary_key TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_url TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS education_quiz (
        id TEXT PRIMARY KEY,
        card_key TEXT NOT NULL,
        question_order INTEGER NOT NULL,
        question_key TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation_key TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        UNIQUE(user_id, achievement_key)
      );

      CREATE TABLE IF NOT EXISTS daily_readings (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        indicator TEXT NOT NULL CHECK (indicator IN ('hr', 'bp', 'sleep', 'mood', 'stress', 'act')),
        value_numeric REAL NULL,
        systolic REAL NULL,
        diastolic REAL NULL,
        context TEXT NULL,
        activity_type TEXT NULL,
        activity_completed INTEGER NULL,
        sleep_start_utc TEXT NULL,
        sleep_end_utc TEXT NULL,
        measured_at INTEGER NOT NULL,
        entered_at INTEGER NOT NULL,
        entered_by TEXT NOT NULL,
        source TEXT NOT NULL,
        device_id TEXT NULL,
        data_quality TEXT NOT NULL,
        late_entry_note TEXT NULL,
        provenance TEXT NOT NULL,
        client_mutation_id TEXT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS hazard_entries (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        entered_by TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('RADIATION', 'ENVIRONMENT', 'GRAVITY', 'ISOLATION', 'DISTANCE')),
        payload_json TEXT NOT NULL,
        computed_json TEXT NOT NULL,
        measured_at INTEGER NOT NULL,
        entered_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        device_id TEXT NULL,
        data_quality TEXT NOT NULL,
        late_entry_note TEXT NULL,
        provenance TEXT NOT NULL,
        client_mutation_id TEXT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL,
        mission_id TEXT NOT NULL,
        subject_user_id TEXT NULL,
        target_role TEXT NOT NULL CHECK (target_role IN ('COMMANDER', 'DOCTOR', 'CREW')),
        rule_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        title_key TEXT NOT NULL,
        params_json TEXT NOT NULL,
        measurement_text TEXT NOT NULL,
        measured_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        explanation_key TEXT NOT NULL,
        next_step_key TEXT NOT NULL,
        custom_guidance TEXT NULL,
        acknowledged_by TEXT NULL,
        acknowledged_at INTEGER NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problem_reports (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        urgent INTEGER NOT NULL,
        description TEXT NOT NULL,
        measured_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        prefs_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        mission_id TEXT NULL,
        actor_user_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action_key TEXT NOT NULL,
        params_json TEXT NOT NULL,
        target_user_id TEXT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        mission_id TEXT NULL,
        scope TEXT NOT NULL,
        subject_user_id TEXT NULL,
        from_ms INTEGER NOT NULL,
        to_ms INTEGER NOT NULL,
        include_json TEXT NOT NULL,
        format TEXT NOT NULL,
        label_language TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING', 'READY', 'FAILED')),
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_bytes INTEGER NOT NULL,
        content_blob BLOB NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
      CREATE INDEX IF NOT EXISTS idx_env_samples_user_id ON env_samples(user_id);
      CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_daily_readings_mission_user ON daily_readings(mission_id, user_id, indicator, measured_at);
      CREATE INDEX IF NOT EXISTS idx_hazard_entries_mission ON hazard_entries(mission_id, category, measured_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_mission_role ON alerts(mission_id, target_role, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_mission ON audit_log(mission_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_exports_user ON exports(user_id, created_at);
    `);

    // Migrate existing tasks table if needed from Phase 0 schema
    const taskCols = this.db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{ name: string }>;
    const taskColNames = new Set(taskCols.map((c) => c.name));
    if (!taskColNames.has('mission_id')) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN mission_id TEXT NULL`);
    }
    if (!taskColNames.has('protocol_id')) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN protocol_id TEXT NULL`);
    }
    if (!taskColNames.has('scheduled_date_utc')) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN scheduled_date_utc TEXT NULL`);
    }
    if (!taskColNames.has('title_key')) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN title_key TEXT NULL`);
    }
  }

  close(): void {
    this.db.close();
  }

  // ===== Legacy / Demo Mode Task & Health Methods (unchanged API behavior) =====
  listTasks(userId: string): TaskRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, name, due, status, defer_reason, created_at, updated_at
         FROM tasks
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC`
      )
      .all(userId) as Array<{
      id: string;
      user_id: string;
      name: string;
      due: string;
      status: TaskStatus;
      defer_reason: string | null;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      due: row.due,
      status: row.status,
      deferReason: row.defer_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  createTask(userId: string, input: { name: string; due: string }): TaskRecord {
    const now = Date.now();
    const taskId = crypto.randomUUID();
    const historyId = crypto.randomUUID();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO tasks (id, user_id, name, due, status, defer_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'PENDING', NULL, ?, ?)`
        )
        .run(taskId, userId, input.name, input.due, now, now);

      this.db
        .prepare(
          `INSERT INTO history (id, user_id, task_id, text, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(historyId, userId, taskId, `Created: ${input.name}`, now);
    });

    tx();

    return {
      id: taskId,
      userId,
      name: input.name,
      due: input.due,
      status: 'PENDING',
      deferReason: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  completeTask(userId: string, taskId: string): TaskRecord | null {
    const existing = this.findTaskForUser(userId, taskId);
    if (!existing) {
      return null;
    }
    if (existing.status !== 'PENDING' && existing.status !== 'OVERDUE') {
      throw new ConflictError(
        `Task cannot be completed from status ${existing.status}.`
      );
    }

    const now = Date.now();
    const historyId = crypto.randomUUID();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE tasks
           SET status = 'COMPLETED', updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(now, taskId, userId);

      this.db
        .prepare(
          `INSERT INTO history (id, user_id, task_id, text, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(historyId, userId, taskId, `Completed: ${existing.name}`, now);
    });

    tx();

    return {
      ...existing,
      status: 'COMPLETED',
      updatedAt: now,
    };
  }

  deferTask(userId: string, taskId: string, reason: string): TaskRecord | null {
    const existing = this.findTaskForUser(userId, taskId);
    if (!existing) {
      return null;
    }
    if (existing.status !== 'PENDING' && existing.status !== 'OVERDUE') {
      throw new ConflictError(
        `Task cannot be deferred from status ${existing.status}.`
      );
    }

    const now = Date.now();
    const historyId = crypto.randomUUID();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE tasks
           SET status = 'DEFERRED', defer_reason = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .run(reason, now, taskId, userId);

      this.db
        .prepare(
          `INSERT INTO history (id, user_id, task_id, text, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          historyId,
          userId,
          taskId,
          `Deferred: ${existing.name} (reason: ${reason})`,
          now
        );
    });

    tx();

    return {
      ...existing,
      status: 'DEFERRED',
      deferReason: reason,
      updatedAt: now,
    };
  }

  private findTaskForUser(userId: string, taskId: string): TaskRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, user_id, name, due, status, defer_reason, created_at, updated_at
         FROM tasks
         WHERE id = ? AND user_id = ?`
      )
      .get(taskId, userId) as
      | {
          id: string;
          user_id: string;
          name: string;
          due: string;
          status: TaskStatus;
          defer_reason: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      due: row.due,
      status: row.status,
      deferReason: row.defer_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listHistory(userId: string, limit = 100): HistoryRecord[] {
    const safeLimit = Math.min(Math.max(1, limit), 500);
    const rows = this.db
      .prepare(
        `SELECT id, user_id, task_id, text, created_at
         FROM history
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`
      )
      .all(userId, safeLimit) as Array<{
      id: string;
      user_id: string;
      task_id: string | null;
      text: string;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      taskId: row.task_id,
      text: row.text,
      createdAt: row.created_at,
    }));
  }

  getOrSeedHealthIndicators(userId: string): HealthIndicatorRecord[] {
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM health_records WHERE user_id = ?`)
      .get(userId) as { cnt: number };

    if (countRow.cnt === 0) {
      const insert = this.db.prepare(
        `INSERT INTO health_records (id, user_id, indicator, value, unit, recorded_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const tx = this.db.transaction(() => {
        for (const item of SEED_HEALTH_INDICATORS) {
          insert.run(
            crypto.randomUUID(),
            userId,
            item.indicator,
            item.value,
            item.unit,
            null,
            null
          );
        }
      });
      tx();
    }

    const rows = this.db
      .prepare(
        `SELECT id, indicator, value, unit, recorded_at, source
         FROM health_records
         WHERE user_id = ?`
      )
      .all(userId) as Array<{
      id: string;
      indicator: string;
      value: string;
      unit: string;
      recorded_at: number | null;
      source: string | null;
    }>;

    const metaMap = new Map(
      SEED_HEALTH_INDICATORS.map((def, idx) => [
        def.indicator,
        { icon: def.icon, name: def.name, order: idx },
      ])
    );

    return rows
      .map((row) => {
        const meta = metaMap.get(row.indicator);
        return {
          id: row.id,
          indicator: row.indicator,
          icon: meta?.icon ?? '•',
          name: meta?.name ?? row.indicator,
          value: row.value,
          unit: row.unit,
          recordedAt: row.recorded_at,
          source: row.source,
        };
      })
      .sort(
        (a, b) =>
          (metaMap.get(a.indicator)?.order ?? 99) -
          (metaMap.get(b.indicator)?.order ?? 99)
      );
  }

  getRisks(): RiskDefinition[] {
    return [...RISK_DEFINITIONS];
  }

  getOrSeedEnvSamples(userId: string): Co2Stats {
    const countRow = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM env_samples WHERE user_id = ?`)
      .get(userId) as { cnt: number };

    if (countRow.cnt === 0) {
      const insert = this.db.prepare(
        `INSERT INTO env_samples (id, user_id, parameter, value, unit, sampled_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const tx = this.db.transaction(() => {
        for (const s of SEED_CO2_SAMPLES) {
          insert.run(
            crypto.randomUUID(),
            userId,
            s.parameter,
            s.value,
            s.unit,
            s.sampledAt
          );
        }
      });
      tx();
    }

    return this.getEnvStats(userId);
  }

  insertEnvSample(
    userId: string,
    input: { parameter: string; value: number; unit: string; sampledAt: number }
  ): EnvSampleRecord {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO env_samples (id, user_id, parameter, value, unit, sampled_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, input.parameter, input.value, input.unit, input.sampledAt);

    return {
      id,
      userId,
      parameter: input.parameter,
      value: input.value,
      unit: input.unit,
      sampledAt: input.sampledAt,
    };
  }

  getEnvStats(userId: string): Co2Stats {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, parameter, value, unit, sampled_at
         FROM env_samples
         WHERE user_id = ? AND parameter = 'CO2'
         ORDER BY sampled_at ASC`
      )
      .all(userId) as Array<{
      id: string;
      user_id: string;
      parameter: string;
      value: number;
      unit: string;
      sampled_at: number;
    }>;

    const samples: EnvSampleRecord[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      parameter: r.parameter,
      value: r.value,
      unit: r.unit,
      sampledAt: r.sampled_at,
    }));

    return computeCo2Stats(samples);
  }

  getSleepRecords(): SleepRecord[] {
    return [...SEED_SLEEP_RECORDS];
  }

  // ===== Phase 1+ Auth & Mission Methods =====
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): UserAccount {
    const emailLower = input.email.trim().toLowerCase();
    const existing = this.findUserByEmail(emailLower);
    if (existing) {
      throw new ConflictError('An account with this email already exists.');
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, token_version, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .run(id, input.name.trim(), emailLower, input.passwordHash, input.role, now);
    return {
      id,
      name: input.name.trim(),
      email: emailLower,
      passwordHash: input.passwordHash,
      role: input.role,
      tokenVersion: 1,
      createdAt: now,
    };
  }

  findUserByEmail(email: string): UserAccount | null {
    const row = this.db
      .prepare(
        `SELECT id, name, email, password_hash, role, token_version, created_at
         FROM users WHERE email = ?`
      )
      .get(email.trim().toLowerCase()) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: UserRole;
          token_version: number;
          created_at: number;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      tokenVersion: row.token_version,
      createdAt: row.created_at,
    };
  }

  findUserById(userId: string): UserAccount | null {
    const row = this.db
      .prepare(
        `SELECT id, name, email, password_hash, role, token_version, created_at
         FROM users WHERE id = ?`
      )
      .get(userId) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: UserRole;
          token_version: number;
          created_at: number;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      tokenVersion: row.token_version,
      createdAt: row.created_at,
    };
  }

  incrementTokenVersion(userId: string): number {
    this.db
      .prepare(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`)
      .run(userId);
    const user = this.findUserById(userId);
    return user?.tokenVersion ?? 1;
  }

  updateUserPassword(userId: string, passwordHash: string): void {
    this.db
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .run(passwordHash, userId);
  }

  // ===== Missions =====
  createMission(
    commanderId: string,
    input: {
      name: string;
      startDateUtc: string;
      plannedDays: number;
      templateId: 'leo_iss' | 'lunar' | 'mars';
      weeklyHazardWeekday: number;
      isDemo?: boolean;
      inviteCode?: string;
    }
  ): MissionRecord {
    const id = crypto.randomUUID();
    const now = Date.now();
    const inviteCode =
      input.inviteCode ||
      `ASTRA-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO missions (
            id, name, invite_code, start_date_utc, planned_days, template_id,
            weekly_hazard_weekday, is_demo, created_by, last_sync_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.name.trim(),
          inviteCode,
          input.startDateUtc,
          input.plannedDays,
          input.templateId,
          input.weeklyHazardWeekday,
          input.isDemo ? 1 : 0,
          commanderId,
          now,
          now
        );

      this.db
        .prepare(
          `INSERT OR IGNORE INTO mission_members (id, mission_id, user_id, role, joined_at)
           VALUES (?, ?, ?, 'COMMANDER', ?)`
        )
        .run(crypto.randomUUID(), id, commanderId, now);

      this.generateDefaultScheduleForMember(
        id,
        commanderId,
        'COMMANDER',
        input.startDateUtc,
        input.weeklyHazardWeekday
      );
    });
    tx();

    return {
      id,
      name: input.name.trim(),
      inviteCode,
      startDateUtc: input.startDateUtc,
      plannedDays: input.plannedDays,
      templateId: input.templateId,
      weeklyHazardWeekday: input.weeklyHazardWeekday,
      isDemo: Boolean(input.isDemo),
      createdBy: commanderId,
      lastSyncAt: now,
      createdAt: now,
    };
  }

  joinMissionByInvite(
    userId: string,
    role: UserRole,
    inviteCode: string
  ): MissionRecord | null {
    const missionRow = this.db
      .prepare(`SELECT * FROM missions WHERE UPPER(invite_code) = UPPER(?)`)
      .get(inviteCode.trim()) as
      | {
          id: string;
          name: string;
          invite_code: string;
          start_date_utc: string;
          planned_days: number;
          template_id: 'leo_iss' | 'lunar' | 'mars';
          weekly_hazard_weekday: number;
          is_demo: number;
          created_by: string;
          last_sync_at: number | null;
          created_at: number;
        }
      | undefined;

    if (!missionRow) return null;

    const now = Date.now();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO mission_members (id, mission_id, user_id, role, joined_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(crypto.randomUUID(), missionRow.id, userId, role, now);

      this.generateDefaultScheduleForMember(
        missionRow.id,
        userId,
        role,
        missionRow.start_date_utc,
        missionRow.weekly_hazard_weekday
      );
    });
    tx();

    return {
      id: missionRow.id,
      name: missionRow.name,
      inviteCode: missionRow.invite_code,
      startDateUtc: missionRow.start_date_utc,
      plannedDays: missionRow.planned_days,
      templateId: missionRow.template_id,
      weeklyHazardWeekday: missionRow.weekly_hazard_weekday,
      isDemo: Boolean(missionRow.is_demo),
      createdBy: missionRow.created_by,
      lastSyncAt: missionRow.last_sync_at,
      createdAt: missionRow.created_at,
    };
  }

  getUserMission(userId: string): MissionRecord | null {
    const row = this.db
      .prepare(
        `SELECT m.*
         FROM missions m
         JOIN mission_members mm ON mm.mission_id = m.id
         WHERE mm.user_id = ?
         ORDER BY mm.joined_at DESC
         LIMIT 1`
      )
      .get(userId) as
      | {
          id: string;
          name: string;
          invite_code: string;
          start_date_utc: string;
          planned_days: number;
          template_id: 'leo_iss' | 'lunar' | 'mars';
          weekly_hazard_weekday: number;
          is_demo: number;
          created_by: string;
          last_sync_at: number | null;
          created_at: number;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      startDateUtc: row.start_date_utc,
      plannedDays: row.planned_days,
      templateId: row.template_id,
      weeklyHazardWeekday: row.weekly_hazard_weekday,
      isDemo: Boolean(row.is_demo),
      createdBy: row.created_by,
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
    };
  }

  getMissionRoster(missionId: string): MissionMemberRecord[] {
    const rows = this.db
      .prepare(
        `SELECT mm.id, mm.mission_id, mm.user_id, u.name, u.email, mm.role, mm.joined_at
         FROM mission_members mm
         JOIN users u ON u.id = mm.user_id
         WHERE mm.mission_id = ?
         ORDER BY mm.joined_at ASC`
      )
      .all(missionId) as Array<{
      id: string;
      mission_id: string;
      user_id: string;
      name: string;
      email: string;
      role: UserRole;
      joined_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      missionId: r.mission_id,
      userId: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      joinedAt: r.joined_at,
    }));
  }

  touchMissionSync(missionId: string): number {
    const now = Date.now();
    this.db
      .prepare(`UPDATE missions SET last_sync_at = ? WHERE id = ?`)
      .run(now, missionId);
    return now;
  }

  private generateDefaultScheduleForMember(
    missionId: string,
    userId: string,
    role: UserRole,
    startDateUtc: string,
    weeklyHazardWeekday: number
  ): void {
    const now = Date.now();
    const todayIso = new Date(now).toISOString().slice(0, 10);
    const prefs = this.getPreferences(userId);
    const dailyDue = prefs.notifications.dailyReminderTime || '09:00';

    const existingCount = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM tasks WHERE mission_id = ? AND user_id = ?`
        )
        .get(missionId, userId) as { cnt: number }
    ).cnt;
    if (existingCount > 0) return;

    const insertTask = this.db.prepare(
      `INSERT INTO tasks (
        id, user_id, name, due, status, defer_reason,
        mission_id, protocol_id, scheduled_date_utc, title_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', NULL, ?, ?, ?, ?, ?, ?)`
    );

    const dailyProtocols: Array<{ id: string; name: string; titleKey: string }> = [
      { id: 'PRT-HR', name: 'Resting Heart Rate Check', titleKey: 'kb.protocols.PRT-HR.title' },
      { id: 'PRT-BP', name: 'Blood Pressure Check', titleKey: 'kb.protocols.PRT-BP.title' },
      { id: 'PRT-SLP', name: 'Morning Sleep Log', titleKey: 'kb.protocols.PRT-SLP.title' },
      { id: 'PRT-MOOD', name: 'Daily Mood Self-Check', titleKey: 'kb.protocols.PRT-MOOD.title' },
      { id: 'PRT-STR', name: 'Daily Stress Rating', titleKey: 'kb.protocols.PRT-STR.title' },
      { id: 'PRT-ACT', name: 'Countermeasure Activity Log', titleKey: 'kb.protocols.PRT-ACT.title' },
    ];

    // Generate daily tasks for today + next 6 days (so calendar is immediately populated)
    for (let offset = 0; offset < 7; offset += 1) {
      const dateMs = Date.UTC(
        Number(todayIso.slice(0, 4)),
        Number(todayIso.slice(5, 7)) - 1,
        Number(todayIso.slice(8, 10)) + offset
      );
      const dateUtc = new Date(dateMs).toISOString().slice(0, 10);
      if (dateUtc < startDateUtc) continue;

      if (role === 'CREW' || role === 'COMMANDER') {
        for (const prt of dailyProtocols) {
          insertTask.run(
            crypto.randomUUID(),
            userId,
            prt.name,
            dailyDue,
            missionId,
            prt.id,
            dateUtc,
            prt.titleKey,
            now,
            now
          );
        }
      }

      if (role === 'COMMANDER') {
        const dow = new Date(dateMs).getUTCDay();
        if (dow === weeklyHazardWeekday || offset === 0) {
          const weeklyProtocols = [
            { id: 'PRT-RAD', name: 'Weekly Radiation Dosimetry', titleKey: 'kb.protocols.PRT-RAD.title' },
            { id: 'PRT-ENV', name: 'Weekly Cabin Atmosphere Sampling', titleKey: 'kb.protocols.PRT-ENV.title' },
            { id: 'PRT-GRV', name: 'Weekly Altered Gravity & Exercise Review', titleKey: 'kb.protocols.PRT-GRV.title' },
            { id: 'PRT-ISO', name: 'Weekly Isolation & Contact Log', titleKey: 'kb.protocols.PRT-ISO.title' },
            { id: 'PRT-DST', name: 'Weekly Distance & Link Status', titleKey: 'kb.protocols.PRT-DST.title' },
          ];
          for (const prt of weeklyProtocols) {
            insertTask.run(
              crypto.randomUUID(),
              userId,
              prt.name,
              '12:00',
              missionId,
              prt.id,
              dateUtc,
              prt.titleKey,
              now,
              now
            );
          }
        }
      }
    }
  }

  getCalendarTasks(
    missionId: string,
    viewer: { id: string; role: UserRole },
    fromDate?: string,
    toDate?: string
  ): CalendarTaskRecord[] {
    let sql = `SELECT id, mission_id, user_id, name, title_key, protocol_id, scheduled_date_utc, due, status, defer_reason, created_at, updated_at
               FROM tasks WHERE mission_id = ?`;
    const params: unknown[] = [missionId];

    // Privacy & Role: Crew sees own tasks; Doctor sees own/crew compliance summary; Commander sees mission tasks
    if (viewer.role === 'CREW') {
      sql += ` AND user_id = ?`;
      params.push(viewer.id);
    }
    if (fromDate) {
      sql += ` AND (scheduled_date_utc IS NULL OR scheduled_date_utc >= ?)`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND (scheduled_date_utc IS NULL OR scheduled_date_utc <= ?)`;
      params.push(toDate);
    }
    sql += ` ORDER BY scheduled_date_utc ASC, due ASC`;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      mission_id: string | null;
      user_id: string;
      name: string;
      title_key: string | null;
      protocol_id: string | null;
      scheduled_date_utc: string | null;
      due: string;
      status: TaskStatus;
      defer_reason: string | null;
      created_at: number;
      updated_at: number;
    }>;

    const nowDateUtc = new Date().toISOString().slice(0, 10);
    return rows.map((r) => {
      const effectiveStatus: TaskStatus =
        r.status === 'PENDING' && r.scheduled_date_utc && r.scheduled_date_utc < nowDateUtc
          ? 'OVERDUE'
          : r.status;
      return {
        id: r.id,
        missionId: r.mission_id,
        userId: r.user_id,
        name: r.name,
        titleKey: r.title_key,
        protocolId: r.protocol_id,
        scheduledDateUtc: r.scheduled_date_utc,
        due: r.due,
        status: effectiveStatus,
        deferReason: r.defer_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  getMissionDerived(mission: MissionRecord): MissionDerived {
    const tpl = this.db
      .prepare(`SELECT default_distance_km FROM mission_templates WHERE id = ?`)
      .get(mission.templateId) as { default_distance_km: number } | undefined;

    const latestDistanceRow = this.db
      .prepare(
        `SELECT payload_json
         FROM hazard_entries
         WHERE mission_id = ? AND category = 'DISTANCE'
         ORDER BY measured_at DESC
         LIMIT 1`
      )
      .get(mission.id) as { payload_json: string } | undefined;

    let distanceKm = tpl?.default_distance_km ?? 400;
    let distanceIsTemplateDefault = true;
    if (latestDistanceRow) {
      const payload = JSON.parse(latestDistanceRow.payload_json) as { distanceKm?: number };
      if (typeof payload.distanceKm === 'number') {
        distanceKm = payload.distanceKm;
        distanceIsTemplateDefault = false;
      }
    }

    return calculateMissionDerived({
      startDateUtc: mission.startDateUtc,
      plannedDays: mission.plannedDays,
      distanceKm,
      distanceIsTemplateDefault,
      lastSyncAt: mission.lastSyncAt,
    });
  }

  // ===== Knowledge Base Readers & Doctor Rule Editing =====
  listMissionTemplates() {
    return this.db.prepare(`SELECT * FROM mission_templates ORDER BY default_distance_km ASC`).all();
  }

  listProtocols() {
    const protocols = this.db.prepare(`SELECT * FROM protocols`).all() as Array<Record<string, unknown>>;
    const steps = this.db
      .prepare(`SELECT * FROM protocol_steps ORDER BY step_number ASC`)
      .all() as Array<{ id: string; protocol_id: string; step_number: number; text_key: string }>;

    const stepsMap = new Map<string, Array<{ id: string; stepNumber: number; textKey: string }>>();
    for (const s of steps) {
      const arr = stepsMap.get(s.protocol_id) ?? [];
      arr.push({ id: s.id, stepNumber: s.step_number, textKey: s.text_key });
      stepsMap.set(s.protocol_id, arr);
    }

    return protocols.map((p) => ({
      id: p.id as string,
      titleKey: p.title_key as string,
      purposeKey: p.purpose_key as string,
      frequency: p.frequency as string,
      roleScope: p.role_scope as string,
      estimatedMinutes: p.estimated_minutes as number,
      safetyNoteKey: p.safety_note_key as string,
      sourceUrl: p.source_url as string,
      steps: stepsMap.get(p.id as string) ?? [],
    }));
  }

  getProtocolById(id: string) {
    const list = this.listProtocols();
    return list.find((p) => p.id === id) ?? null;
  }

  listInstruments(category?: string) {
    const rows = category
      ? (this.db
          .prepare(`SELECT * FROM instruments WHERE category = ? ORDER BY sort_order ASC`)
          .all(category) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(`SELECT * FROM instruments ORDER BY category ASC, sort_order ASC`)
          .all() as Array<Record<string, unknown>>);

    return rows.map((r) => ({
      id: r.id as string,
      category: r.category as string,
      code: r.code as string,
      nameKey: r.name_key as string,
      descriptionKey: r.description_key as string,
      allowCustom: Boolean(r.allow_custom),
      sortOrder: r.sort_order as number,
    }));
  }

  listRules(): StoredRuleRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM reference_rules ORDER BY id ASC`)
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      category: r.category as string,
      parameter: r.parameter as string,
      severity: r.severity as RuleSeverity,
      label: r.label as RuleLabel,
      status: r.status as string,
      thresholdValue: r.threshold_value as string,
      thresholdUnit: r.threshold_unit as string,
      titleKey: r.title_key as string,
      explanationKey: r.explanation_key as string,
      nextStepKey: r.next_step_key as string,
      sourceCitationKey: r.source_citation_key as string,
      sourceUrl: r.source_url as string,
      notifyDoctor: Boolean(r.notify_doctor),
      notifyCommander: Boolean(r.notify_commander),
      customGuidance: (r.custom_guidance as string | null) ?? null,
      customThreshold: (r.custom_threshold as string | null) ?? null,
      updatedAt: (r.updated_at as number | null) ?? null,
    }));
  }

  getRuleById(id: string): StoredRuleRecord | null {
    return this.listRules().find((r) => r.id === id) ?? null;
  }

  updatePrototypeDefaultRule(
    ruleId: string,
    actor: UserAccount,
    missionId: string | null,
    patch: { customThreshold?: string; customGuidance?: string }
  ): StoredRuleRecord | null {
    if (actor.role !== 'DOCTOR') {
      throw new ForbiddenError('Only Doctors can edit prototype default rules.', 'ROLE_FORBIDDEN');
    }
    const existing = this.getRuleById(ruleId);
    if (!existing) {
      return null;
    }
    if (existing.label === 'NASA_REFERENCE' && patch.customThreshold !== undefined) {
      throw new ForbiddenError(
        'NASA REFERENCE thresholds are read-only and cannot be modified.',
        'NASA_REFERENCE_READONLY'
      );
    }
    if (existing.label !== 'PROTOTYPE_DEFAULT') {
      throw new ForbiddenError(
        'Only PROTOTYPE_DEFAULT rules can be modified by a Doctor.',
        'RULE_READONLY'
      );
    }

    const now = Date.now();
    const newThreshold = patch.customThreshold ?? existing.customThreshold;
    const newGuidance = patch.customGuidance ?? existing.customGuidance;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE reference_rules
           SET custom_threshold = ?, custom_guidance = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(newThreshold, newGuidance, now, ruleId);

      this.db
        .prepare(
          `INSERT INTO rule_change_log (
            id, rule_id, changed_by, previous_threshold, new_threshold,
            previous_guidance, new_guidance, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          ruleId,
          actor.id,
          existing.customThreshold ?? existing.thresholdValue,
          newThreshold,
          existing.customGuidance,
          newGuidance,
          now
        );

      this.insertAuditLog({
        missionId,
        actorUserId: actor.id,
        actorRole: actor.role,
        actionKey: 'audit.rule_updated',
        params: { ruleId, actorName: actor.name },
        targetUserId: null,
      });
    });
    tx();

    return this.getRuleById(ruleId);
  }

  listRuleChangeLog() {
    return this.db
      .prepare(
        `SELECT rcl.*, u.name AS changed_by_name
         FROM rule_change_log rcl
         LEFT JOIN users u ON u.id = rcl.changed_by
         ORDER BY rcl.created_at DESC
         LIMIT 100`
      )
      .all();
  }

  getDataSourcesOverview(missionId?: string) {
    const provenanceRows = missionId
      ? (this.db
          .prepare(
            `SELECT provenance, COUNT(*) AS cnt FROM (
               SELECT provenance FROM daily_readings WHERE mission_id = ?
               UNION ALL
               SELECT provenance FROM hazard_entries WHERE mission_id = ?
             ) GROUP BY provenance`
          )
          .all(missionId, missionId) as Array<{ provenance: string; cnt: number }>)
      : [];

    const counts: Record<DataProvenance, number> = {
      'Self-reported': 0,
      'Manual entry': 0,
      'Offline-queued': 0,
    };
    for (const r of provenanceRows) {
      if (r.provenance in counts) {
        counts[r.provenance as DataProvenance] = r.cnt;
      }
    }

    return {
      sources: DATA_SOURCES_SEED,
      rules: this.listRules(),
      provenanceCounts: counts,
    };
  }

  // ===== Daily Readings & Rule Evaluation =====
  recordDailyReading(
    missionId: string,
    user: UserAccount,
    input: {
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
      provenance: DataProvenance;
      dataQuality: DataQuality;
      clientMutationId?: string | null;
    }
  ): { reading: DailyReadingRecord; alerts: AlertRecord[]; deduplicated: boolean } {
    if (input.clientMutationId) {
      const existing = this.db
        .prepare(`SELECT * FROM daily_readings WHERE client_mutation_id = ?`)
        .get(input.clientMutationId) as Record<string, unknown> | undefined;
      if (existing) {
        return {
          reading: this.mapDailyReading(existing),
          alerts: [],
          deduplicated: true,
        };
      }
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    const alertsCreated: AlertRecord[] = [];

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO daily_readings (
            id, mission_id, user_id, indicator, value_numeric, systolic, diastolic,
            context, activity_type, activity_completed, sleep_start_utc, sleep_end_utc,
            measured_at, entered_at, entered_by, source, device_id, data_quality,
            late_entry_note, provenance, client_mutation_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          missionId,
          user.id,
          input.indicator,
          input.valueNumeric ?? null,
          input.systolic ?? null,
          input.diastolic ?? null,
          input.context ?? null,
          input.activityType ?? null,
          input.activityCompleted === undefined || input.activityCompleted === null
            ? null
            : input.activityCompleted
              ? 1
              : 0,
          input.sleepStartUtc ?? null,
          input.sleepEndUtc ?? null,
          input.measuredAt,
          now,
          user.id,
          input.source,
          input.deviceId ?? null,
          input.dataQuality,
          input.lateEntryNote ?? null,
          input.provenance,
          input.clientMutationId ?? null
        );

      let triggered: TriggeredRuleResult[] = [];
      let measurementText = '';

      if (input.indicator === 'hr' && typeof input.valueNumeric === 'number') {
        const ctx = input.context ?? 'RESTING';
        measurementText = `${input.valueNumeric} bpm (${ctx})`;
        const prevRow = this.db
          .prepare(
            `SELECT value_numeric FROM daily_readings
             WHERE mission_id = ? AND user_id = ? AND indicator = 'hr' AND context = 'RESTING'
               AND id != ?
               AND strftime('%Y-%m-%d', measured_at / 1000, 'unixepoch') = strftime('%Y-%m-%d', (? - 86400000) / 1000, 'unixepoch')
             ORDER BY measured_at DESC LIMIT 1`
          )
          .get(missionId, user.id, id, input.measuredAt) as
          | { value_numeric: number }
          | undefined;
        triggered = evaluateHeartRateRules({
          bpm: input.valueNumeric,
          context: ctx,
          previousDayRestingBpm: prevRow?.value_numeric ?? null,
        });
      } else if (
        input.indicator === 'bp' &&
        typeof input.systolic === 'number' &&
        typeof input.diastolic === 'number'
      ) {
        measurementText = `${input.systolic}/${input.diastolic} mmHg`;
        triggered = evaluateBloodPressureRules({
          systolic: input.systolic,
          diastolic: input.diastolic,
        });
      } else if (input.indicator === 'sleep' && typeof input.valueNumeric === 'number') {
        measurementText = `${input.valueNumeric} hours`;
        const sleepRows = this.db
          .prepare(
            `SELECT value_numeric FROM daily_readings
             WHERE mission_id = ? AND user_id = ? AND indicator = 'sleep' AND value_numeric IS NOT NULL
             ORDER BY measured_at ASC`
          )
          .all(missionId, user.id) as Array<{ value_numeric: number }>;
        triggered = evaluateSleepRules(sleepRows.map((r) => r.value_numeric));
      } else if (input.indicator === 'mood' && typeof input.valueNumeric === 'number') {
        measurementText = `Mood level ${input.valueNumeric}/5`;
        const moodRows = this.db
          .prepare(
            `SELECT value_numeric FROM daily_readings
             WHERE mission_id = ? AND user_id = ? AND indicator = 'mood' AND value_numeric IS NOT NULL
             ORDER BY measured_at ASC`
          )
          .all(missionId, user.id) as Array<{ value_numeric: number }>;
        triggered = evaluateMoodAndStressRules({
          chronologicalMoodLevels: moodRows.map((r) => r.value_numeric),
        });
      } else if (input.indicator === 'stress' && typeof input.valueNumeric === 'number') {
        measurementText = `${input.valueNumeric} / 100`;
        const stressRows = this.db
          .prepare(
            `SELECT value_numeric FROM daily_readings
             WHERE mission_id = ? AND user_id = ? AND indicator = 'stress' AND value_numeric IS NOT NULL
             ORDER BY measured_at ASC`
          )
          .all(missionId, user.id) as Array<{ value_numeric: number }>;
        triggered = evaluateMoodAndStressRules({
          chronologicalStressScores: stressRows.map((r) => r.value_numeric),
        });
      } else if (input.indicator === 'act' && typeof input.valueNumeric === 'number') {
        measurementText = `${input.valueNumeric} minutes`;
        const sevenDaysAgo = input.measuredAt - 7 * 86_400_000;
        const daysRow = this.db
          .prepare(
            `SELECT COUNT(DISTINCT strftime('%Y-%m-%d', measured_at / 1000, 'unixepoch')) AS days
             FROM daily_readings
             WHERE mission_id = ? AND user_id = ? AND indicator = 'act' AND measured_at >= ?`
          )
          .get(missionId, user.id, sevenDaysAgo) as { days: number };
        if (daysRow.days >= 1 && daysRow.days < 6) {
          triggered = evaluateActivityRule(daysRow.days);
        }
      }

      for (const tr of triggered) {
        const rule = this.getRuleById(tr.ruleId);
        if (!rule) continue;
        // Notify Doctor and Crew subject (privacy preserved: Commander never notified on individual crew health)
        if (tr.notifyDoctor) {
          alertsCreated.push(
            this.insertAlert({
              missionId,
              subjectUserId: user.id,
              targetRole: 'DOCTOR',
              rule,
              severity: tr.severity,
              titleKey: tr.titleKey,
              params: { ...tr.params, subjectName: user.name },
              measurementText,
              measuredAt: input.measuredAt,
              source: input.source,
            })
          );
        }
        alertsCreated.push(
          this.insertAlert({
            missionId,
            subjectUserId: user.id,
            targetRole: 'CREW',
            rule,
            severity: tr.severity,
            titleKey: tr.titleKey,
            params: { ...tr.params, subjectName: user.name },
            measurementText,
            measuredAt: input.measuredAt,
            source: input.source,
          })
        );
      }

      this.touchMissionSync(missionId);
    });

    tx();

    const row = this.db
      .prepare(`SELECT * FROM daily_readings WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    return {
      reading: this.mapDailyReading(row),
      alerts: alertsCreated,
      deduplicated: false,
    };
  }

  listDailyReadings(
    missionId: string,
    viewer: UserAccount,
    options?: { subjectUserId?: string; indicator?: string }
  ): DailyReadingRecord[] {
    let sql = `SELECT * FROM daily_readings WHERE mission_id = ?`;
    const params: unknown[] = [missionId];

    if (viewer.role === 'CREW') {
      sql += ` AND user_id = ?`;
      params.push(viewer.id);
    } else if (viewer.role === 'COMMANDER') {
      // Commander sees ONLY own readings plus non-ranked logged activity minutes for crew
      if (options?.indicator === 'act') {
        sql += ` AND (user_id = ? OR indicator = 'act')`;
        params.push(viewer.id);
      } else {
        sql += ` AND user_id = ?`;
        params.push(viewer.id);
      }
    } else if (viewer.role === 'DOCTOR' && options?.subjectUserId) {
      sql += ` AND user_id = ?`;
      params.push(options.subjectUserId);
    }

    if (options?.indicator) {
      sql += ` AND indicator = ?`;
      params.push(options.indicator);
    }

    sql += ` ORDER BY measured_at DESC`;
    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapDailyReading(r));
  }

  private mapDailyReading(r: Record<string, unknown>): DailyReadingRecord {
    return {
      id: r.id as string,
      missionId: r.mission_id as string,
      userId: r.user_id as string,
      indicator: r.indicator as DailyReadingRecord['indicator'],
      valueNumeric: (r.value_numeric as number | null) ?? null,
      systolic: (r.systolic as number | null) ?? null,
      diastolic: (r.diastolic as number | null) ?? null,
      context: (r.context as string | null) ?? null,
      activityType: (r.activity_type as string | null) ?? null,
      activityCompleted:
        r.activity_completed === null || r.activity_completed === undefined
          ? null
          : Boolean(r.activity_completed),
      sleepStartUtc: (r.sleep_start_utc as string | null) ?? null,
      sleepEndUtc: (r.sleep_end_utc as string | null) ?? null,
      measuredAt: r.measured_at as number,
      enteredAt: r.entered_at as number,
      enteredBy: r.entered_by as string,
      source: r.source as string,
      deviceId: (r.device_id as string | null) ?? null,
      dataQuality: r.data_quality as DataQuality,
      lateEntryNote: (r.late_entry_note as string | null) ?? null,
      provenance: r.provenance as DataProvenance,
      clientMutationId: (r.client_mutation_id as string | null) ?? null,
    };
  }

  // ===== Hazards (Commander only) =====
  recordHazardEntry(
    missionId: string,
    commander: UserAccount,
    input: {
      category: HazardEntryRecord['category'];
      payload: Record<string, unknown>;
      measuredAt: number;
      source: string;
      deviceId?: string | null;
      lateEntryNote?: string | null;
      provenance: DataProvenance;
      dataQuality: DataQuality;
      clientMutationId?: string | null;
    }
  ): { entry: HazardEntryRecord; alerts: AlertRecord[] } {
    if (commander.role !== 'COMMANDER') {
      throw new ForbiddenError('Only the Mission Commander can enter hazard data.');
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    let computed: Record<string, unknown> = {};
    const alertsCreated: AlertRecord[] = [];

    const tx = this.db.transaction(() => {
      let triggered: TriggeredRuleResult[] = [];
      let measurementText = '';

      if (input.category === 'RADIATION') {
        const p = input.payload as {
          detector: string;
          detectorLocation: string;
          periodStart: number;
          periodEnd: number;
          absorbedRateMgyDay: number;
          effectiveRateMsvDay: number;
          missionAccumulatedAbsorbedMgy: number;
          missionAccumulatedEffectiveMsv: number;
          priorCareerEffectiveMsv?: number;
          periodEffectiveMsv?: number;
          solarEventStatus: 'NONE' | 'SPE_IN_PROGRESS' | 'SPE_ENDED';
        };
        const thirtyDaysAgo = input.measuredAt - 30 * 86_400_000;
        const priorRadRows = this.db
          .prepare(
            `SELECT payload_json FROM hazard_entries
             WHERE mission_id = ? AND category = 'RADIATION' AND measured_at >= ?`
          )
          .all(missionId, thirtyDaysAgo) as Array<{ payload_json: string }>;

        let trailing30DayEffectiveMsv = 0;
        for (const r of priorRadRows) {
          const prevP = JSON.parse(r.payload_json) as {
            periodEffectiveMsv?: number;
            effectiveRateMsvDay?: number;
            periodStart?: number;
            periodEnd?: number;
          };
          if (typeof prevP.periodEffectiveMsv === 'number') {
            trailing30DayEffectiveMsv += prevP.periodEffectiveMsv;
          } else if (
            typeof prevP.effectiveRateMsvDay === 'number' &&
            typeof prevP.periodStart === 'number' &&
            typeof prevP.periodEnd === 'number'
          ) {
            const days = Math.max(1, (prevP.periodEnd - prevP.periodStart) / 86_400_000);
            trailing30DayEffectiveMsv += prevP.effectiveRateMsvDay * days;
          }
        }
        const currentPeriodDays = Math.max(1, (p.periodEnd - p.periodStart) / 86_400_000);
        const currentPeriodDose =
          typeof p.periodEffectiveMsv === 'number'
            ? p.periodEffectiveMsv
            : p.effectiveRateMsvDay * currentPeriodDays;
        trailing30DayEffectiveMsv = Number((trailing30DayEffectiveMsv + currentPeriodDose).toFixed(4));

        const evalRes = evaluateRadiationRules({
          absorbedRateMgyDay: p.absorbedRateMgyDay,
          effectiveRateMsvDay: p.effectiveRateMsvDay,
          missionAccumulatedAbsorbedMgy: p.missionAccumulatedAbsorbedMgy,
          missionAccumulatedEffectiveMsv: p.missionAccumulatedEffectiveMsv,
          priorCareerEffectiveMsv: p.priorCareerEffectiveMsv ?? 0,
          trailing30DayEffectiveMsv,
          solarEventStatus: p.solarEventStatus,
        });
        computed = {
          careerTotalMsv: evalRes.careerTotalMsv,
          percentOfCareerLimit: evalRes.percentOfCareerLimit,
          remainingToCareerLimitMsv: evalRes.remainingToCareerLimitMsv,
          trailing30DayEffectiveMsv: evalRes.trailing30DayEffectiveMsv,
          percentOf30DayRef: evalRes.percentOf30DayRef,
        };
        triggered = evalRes.alerts;
        measurementText = `${p.absorbedRateMgyDay} mGy/day | ${p.effectiveRateMsvDay} mSv/day | SPE: ${p.solarEventStatus}`;
      } else if (input.category === 'ENVIRONMENT') {
        const p = input.payload as {
          co2Samples: Array<{ valueMmHg: number; sampledAt: number }>;
          ppO2MmHg?: number | null;
          totalPressureKpa?: number | null;
          diluentPercent?: number | null;
          tempC?: number | null;
          rhPercent?: number | null;
          ventilationStatus: 'NOMINAL' | 'DEGRADED' | 'OFF';
          sevenDayMeanCo2?: number | null;
        };
        const co2Analysis = analyzeCo2Series(
          p.co2Samples.map((s) => ({ value: s.valueMmHg, sampledAt: s.sampledAt })),
          p.sevenDayMeanCo2
        );
        const envAlerts = evaluateEnvironmentHazard({
          ppO2MmHg: p.ppO2MmHg,
          totalPressureKpa: p.totalPressureKpa,
          diluentPercent: p.diluentPercent,
          tempC: p.tempC,
          rhPercent: p.rhPercent,
          ventilationStatus: p.ventilationStatus,
        });
        computed = {
          sampleCount: co2Analysis.sampleCount,
          sampleMean: co2Analysis.sampleMean,
          coverageMinutes: co2Analysis.coverageMinutes,
          maxGapMinutes: co2Analysis.maxGapMinutes,
          verifiedHourAverage: co2Analysis.verifiedHourAverage,
          co2Status: co2Analysis.status,
        };
        triggered = [...co2Analysis.alerts, ...envAlerts];
        measurementText = `CO2 mean ${co2Analysis.sampleMean ?? 'N/A'} mmHg (${co2Analysis.coverageMinutes} min coverage)`;
      } else if (input.category === 'GRAVITY') {
        const p = input.payload as { gravityEnvironment: string; weeklyExerciseDays: number };
        computed = { weeklyExerciseDays: p.weeklyExerciseDays };
        triggered = evaluateOtherCommanderHazards({
          gravityExerciseDays: p.weeklyExerciseDays,
        });
        measurementText = `${p.gravityEnvironment}, ${p.weeklyExerciseDays}/6 exercise days`;
      } else if (input.category === 'ISOLATION') {
        const p = input.payload as { groundContactSessions: number; daysSinceLastContact: number };
        computed = { daysSinceLastContact: p.daysSinceLastContact };
        triggered = evaluateOtherCommanderHazards({
          daysSinceGroundContact: p.daysSinceLastContact,
        });
        measurementText = `${p.daysSinceLastContact} days since last ground contact`;
      } else if (input.category === 'DISTANCE') {
        const p = input.payload as {
          distanceKm: number;
          commStatus: 'NOMINAL' | 'DEGRADED' | 'LOSS_OF_SIGNAL';
        };
        const oneWayLightSeconds = p.distanceKm / 299792.458;
        computed = {
          distanceKm: p.distanceKm,
          oneWayLightSeconds,
          roundTripLightSeconds: oneWayLightSeconds * 2,
          commStatus: p.commStatus,
        };
        triggered = evaluateOtherCommanderHazards({ commStatus: p.commStatus });
        measurementText = `${p.distanceKm} km | Link: ${p.commStatus}`;
      }

      this.db
        .prepare(
          `INSERT INTO hazard_entries (
            id, mission_id, entered_by, category, payload_json, computed_json,
            measured_at, entered_at, source, device_id, data_quality,
            late_entry_note, provenance, client_mutation_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          missionId,
          commander.id,
          input.category,
          JSON.stringify(input.payload),
          JSON.stringify(computed),
          input.measuredAt,
          now,
          input.source,
          input.deviceId ?? null,
          input.dataQuality,
          input.lateEntryNote ?? null,
          input.provenance,
          input.clientMutationId ?? null
        );

      for (const tr of triggered) {
        const rule = this.getRuleById(tr.ruleId);
        if (!rule) continue;
        if (tr.notifyCommander) {
          alertsCreated.push(
            this.insertAlert({
              missionId,
              subjectUserId: null,
              targetRole: 'COMMANDER',
              rule,
              severity: tr.severity,
              titleKey: tr.titleKey,
              params: tr.params,
              measurementText,
              measuredAt: input.measuredAt,
              source: input.source,
            })
          );
        }
        // Only R-RAD-05 sends an INFORMATION notice to the Doctor
        if (tr.notifyDoctor && tr.ruleId === 'R-RAD-05') {
          alertsCreated.push(
            this.insertAlert({
              missionId,
              subjectUserId: null,
              targetRole: 'DOCTOR',
              rule,
              severity: 'INFORMATION',
              titleKey: 'alerts.titles.R-RAD-05.doctor_info',
              params: tr.params,
              measurementText,
              measuredAt: input.measuredAt,
              source: input.source,
            })
          );
        }
      }

      this.touchMissionSync(missionId);
    });

    tx();

    const row = this.db
      .prepare(`SELECT * FROM hazard_entries WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    return { entry: this.mapHazardEntry(row), alerts: alertsCreated };
  }

  listHazardEntries(
    missionId: string,
    viewer: UserAccount,
    category?: string
  ): HazardEntryRecord[] {
    if (viewer.role !== 'COMMANDER') {
      throw new ForbiddenError('Only the Mission Commander can access hazard records.');
    }
    let sql = `SELECT * FROM hazard_entries WHERE mission_id = ?`;
    const params: unknown[] = [missionId];
    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    sql += ` ORDER BY measured_at DESC`;
    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapHazardEntry(r));
  }

  private mapHazardEntry(r: Record<string, unknown>): HazardEntryRecord {
    return {
      id: r.id as string,
      missionId: r.mission_id as string,
      enteredBy: r.entered_by as string,
      category: r.category as HazardEntryRecord['category'],
      payload: JSON.parse(r.payload_json as string) as Record<string, unknown>,
      computed: JSON.parse(r.computed_json as string) as Record<string, unknown>,
      measuredAt: r.measured_at as number,
      enteredAt: r.entered_at as number,
      source: r.source as string,
      deviceId: (r.device_id as string | null) ?? null,
      dataQuality: r.data_quality as DataQuality,
      lateEntryNote: (r.late_entry_note as string | null) ?? null,
      provenance: r.provenance as DataProvenance,
    };
  }

  // ===== Alerts & Problem Reports =====
  private insertAlert(input: {
    missionId: string;
    subjectUserId: string | null;
    targetRole: UserRole;
    rule: StoredRuleRecord;
    severity: RuleSeverity;
    titleKey: string;
    params: Record<string, unknown>;
    measurementText: string;
    measuredAt: number;
    source: string;
  }): AlertRecord {
    const seqRow = this.db
      .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS nextSeq FROM alerts`)
      .get() as { nextSeq: number };
    const seq = seqRow.nextSeq;
    const id = `ASTRA-ALR-${String(seq).padStart(6, '0')}`;
    const now = Date.now();

    this.db
      .prepare(
        `INSERT INTO alerts (
          id, seq, mission_id, subject_user_id, target_role, rule_id, severity,
          title_key, params_json, measurement_text, measured_at, source,
          explanation_key, next_step_key, custom_guidance, acknowledged_by,
          acknowledged_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
      )
      .run(
        id,
        seq,
        input.missionId,
        input.subjectUserId,
        input.targetRole,
        input.rule.id,
        input.severity,
        input.titleKey,
        JSON.stringify(input.params),
        input.measurementText,
        input.measuredAt,
        input.source,
        input.rule.explanationKey,
        input.rule.nextStepKey,
        input.rule.customGuidance,
        now
      );

    return {
      id,
      seq,
      missionId: input.missionId,
      subjectUserId: input.subjectUserId,
      targetRole: input.targetRole,
      ruleId: input.rule.id,
      severity: input.severity,
      titleKey: input.titleKey,
      params: input.params,
      measurementText: input.measurementText,
      measuredAt: input.measuredAt,
      source: input.source,
      explanationKey: input.rule.explanationKey,
      nextStepKey: input.rule.nextStepKey,
      customGuidance: input.rule.customGuidance,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: now,
    };
  }

  listAlerts(missionId: string, viewer: UserAccount): AlertRecord[] {
    let sql = `SELECT a.*, u.name AS subject_user_name
               FROM alerts a
               LEFT JOIN users u ON u.id = a.subject_user_id
               WHERE a.mission_id = ? AND a.target_role = ?`;
    const params: unknown[] = [missionId, viewer.role];
    if (viewer.role === 'CREW') {
      sql += ` AND a.subject_user_id = ?`;
      params.push(viewer.id);
    }
    sql += ` ORDER BY a.created_at DESC, a.seq DESC LIMIT 200`;

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      seq: r.seq as number,
      missionId: r.mission_id as string,
      subjectUserId: (r.subject_user_id as string | null) ?? null,
      subjectUserName: (r.subject_user_name as string | null) ?? null,
      targetRole: r.target_role as UserRole,
      ruleId: r.rule_id as string,
      severity: r.severity as RuleSeverity,
      titleKey: r.title_key as string,
      params: JSON.parse(r.params_json as string) as Record<string, unknown>,
      measurementText: r.measurement_text as string,
      measuredAt: r.measured_at as number,
      source: r.source as string,
      explanationKey: r.explanation_key as string,
      nextStepKey: r.next_step_key as string,
      customGuidance: (r.custom_guidance as string | null) ?? null,
      acknowledgedBy: (r.acknowledged_by as string | null) ?? null,
      acknowledgedAt: (r.acknowledged_at as number | null) ?? null,
      createdAt: r.created_at as number,
    }));
  }

  acknowledgeAlert(missionId: string, alertId: string, actor: UserAccount): AlertRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM alerts WHERE id = ? AND mission_id = ?`)
      .get(alertId, missionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (row.target_role !== actor.role) {
      throw new ForbiddenError('Cannot acknowledge an alert targeted to another role.');
    }
    if (actor.role === 'CREW' && row.subject_user_id !== actor.id) {
      throw new ForbiddenError('Cannot acknowledge another crew member alert.');
    }

    const now = Date.now();
    this.db
      .prepare(`UPDATE alerts SET acknowledged_by = ?, acknowledged_at = ? WHERE id = ?`)
      .run(actor.id, now, alertId);

    const updated = this.listAlerts(missionId, actor).find((a) => a.id === alertId);
    return updated ?? null;
  }

  createProblemReport(
    missionId: string,
    reporter: UserAccount,
    input: { urgent: boolean; description: string; measuredAt: number }
  ): { reportId: string; alert: AlertRecord } {
    const reportId = crypto.randomUUID();
    const now = Date.now();
    let createdAlert!: AlertRecord;

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO problem_reports (id, mission_id, user_id, urgent, description, measured_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          reportId,
          missionId,
          reporter.id,
          input.urgent ? 1 : 0,
          input.description.trim(),
          input.measuredAt,
          now
        );

      const rule = this.getRuleById('R-REP-01')!;
      createdAlert = this.insertAlert({
        missionId,
        subjectUserId: reporter.id,
        targetRole: 'DOCTOR',
        rule,
        severity: input.urgent ? 'HIGH_PRIORITY' : 'REVIEW',
        titleKey: input.urgent
          ? 'alerts.titles.R-REP-01.urgent'
          : 'alerts.titles.R-REP-01.standard',
        params: {
          subjectName: reporter.name,
          reportText: input.description.trim(),
        },
        measurementText: input.description.trim(),
        measuredAt: input.measuredAt,
        source: 'Self-report (Problem report)',
      });
    });
    tx();

    return { reportId, alert: createdAlert };
  }

  listProblemReports(missionId: string, viewer: UserAccount) {
    if (viewer.role === 'COMMANDER') {
      throw new ForbiddenError('Problem reports contain medical/personal details and are restricted.');
    }
    const sql =
      viewer.role === 'DOCTOR'
        ? `SELECT pr.*, u.name AS user_name FROM problem_reports pr JOIN users u ON u.id = pr.user_id WHERE pr.mission_id = ? ORDER BY pr.created_at DESC`
        : `SELECT pr.*, u.name AS user_name FROM problem_reports pr JOIN users u ON u.id = pr.user_id WHERE pr.mission_id = ? AND pr.user_id = ? ORDER BY pr.created_at DESC`;
    return viewer.role === 'DOCTOR'
      ? this.db.prepare(sql).all(missionId)
      : this.db.prepare(sql).all(missionId, viewer.id);
  }

  // ===== Aggregate-only summary for Isolation (Commander) & Exercise totals =====
  getCommanderAggregateStats(missionId: string) {
    const crewRows = this.db
      .prepare(
        `SELECT mm.user_id, u.name, mm.role
         FROM mission_members mm
         JOIN users u ON u.id = mm.user_id
         WHERE mm.mission_id = ?`
      )
      .all(missionId) as Array<{ user_id: string; name: string; role: UserRole }>;

    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const exerciseRows = this.db
      .prepare(
        `SELECT user_id, SUM(COALESCE(value_numeric, 0)) AS total_minutes, COUNT(*) AS sessions
         FROM daily_readings
         WHERE mission_id = ? AND indicator = 'act' AND measured_at >= ?
         GROUP BY user_id`
      )
      .all(missionId, sevenDaysAgo) as Array<{
      user_id: string;
      total_minutes: number;
      sessions: number;
    }>;

    const exMap = new Map(exerciseRows.map((r) => [r.user_id, r]));
    const crewExerciseTotals = crewRows
      .filter((c) => exMap.has(c.user_id))
      .map((c) => ({
        userId: c.user_id,
        name: c.name,
        totalMinutes: exMap.get(c.user_id)!.total_minutes,
        sessions: exMap.get(c.user_id)!.sessions,
      }));

    // Aggregate-only mood/stress submission count (never individual values)
    const psychCountRow = this.db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) AS crew_submitted
         FROM daily_readings
         WHERE mission_id = ? AND indicator IN ('mood', 'stress') AND measured_at >= ?`
      )
      .get(missionId, Date.now() - 86_400_000) as { crew_submitted: number };

    return {
      crewCount: crewRows.length,
      crewExerciseTotals,
      recentPsychCheckinsCount: psychCountRow.crew_submitted,
    };
  }

  // ===== Preferences, Audit Log, Education & Achievements =====
  getPreferences(userId: string): UserPreferences {
    const row = this.db
      .prepare(`SELECT prefs_json FROM user_preferences WHERE user_id = ?`)
      .get(userId) as { prefs_json: string } | undefined;
    if (!row) return { ...DEFAULT_PREFERENCES };
    try {
      return {
        ...DEFAULT_PREFERENCES,
        ...(JSON.parse(row.prefs_json) as Partial<UserPreferences>),
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  savePreferences(userId: string, prefs: UserPreferences): UserPreferences {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO user_preferences (user_id, prefs_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           prefs_json = excluded.prefs_json,
           updated_at = excluded.updated_at`
      )
      .run(userId, JSON.stringify(prefs), now);
    return prefs;
  }

  insertAuditLog(input: {
    missionId: string | null;
    actorUserId: string;
    actorRole: UserRole;
    actionKey: string;
    params: Record<string, unknown>;
    targetUserId: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO audit_log (id, mission_id, actor_user_id, actor_role, action_key, params_json, target_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        crypto.randomUUID(),
        input.missionId,
        input.actorUserId,
        input.actorRole,
        input.actionKey,
        JSON.stringify(input.params),
        input.targetUserId,
        Date.now()
      );
  }

  listAuditLog(missionId: string, viewer: UserAccount) {
    let sql = `SELECT * FROM audit_log WHERE mission_id = ?`;
    const params: unknown[] = [missionId];
    if (viewer.role === 'CREW') {
      sql += ` AND actor_user_id = ?`;
      params.push(viewer.id);
    }
    sql += ` ORDER BY created_at DESC LIMIT 200`;
    return this.db.prepare(sql).all(...params);
  }

  getEducationCard(key: string) {
    return EDUCATION_CARDS_SEED.find((c) => c.key === key) ?? null;
  }

  getUserAchievementsSummary(userId: string, mission: MissionRecord | null) {
    const catalog = this.db
      .prepare(`SELECT * FROM achievements_catalog ORDER BY rowid ASC`)
      .all() as Array<{
      id: string;
      key: string;
      kind: string;
      points: number;
      title_key: string;
      description_key: string;
      unlock_hint_key: string;
      target_value: number | null;
    }>;

    // Auto-award mission progress & consistency milestones (never based on health values!)
    if (mission) {
      const derived = this.getMissionDerived(mission);
      for (const pct of [25, 50, 75, 100]) {
        if (derived.progressPercent >= pct) {
          this.awardAchievement(userId, `progress_${pct}`);
        }
      }

      const completeDays = this.countCompletedDailyReadingDays(mission.id, userId);
      for (const target of [7, 14, 30]) {
        if (completeDays >= target) {
          this.awardAchievement(userId, `consistency_${target}`);
        }
      }
    }

    const earnedRows = this.db
      .prepare(`SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = ?`)
      .all(userId) as Array<{ achievement_key: string; unlocked_at: number }>;
    const earnedMap = new Map(earnedRows.map((r) => [r.achievement_key, r.unlocked_at]));

    let totalPoints = 0;
    const items = catalog.map((item) => {
      const unlockedAt = earnedMap.get(item.key) ?? null;
      if (unlockedAt !== null) {
        totalPoints += item.points;
      }
      return {
        id: item.id,
        key: item.key,
        kind: item.kind,
        points: item.points,
        titleKey: item.title_key,
        descriptionKey: item.description_key,
        unlockHintKey: item.unlock_hint_key,
        targetValue: item.target_value,
        unlockedAt,
      };
    });

    return { totalPoints, items };
  }

  awardAchievement(userId: string, achievementKey: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_key, unlocked_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(crypto.randomUUID(), userId, achievementKey, Date.now());
  }

  countCompletedDailyReadingDays(missionId: string, userId: string): number {
    const rows = this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d', measured_at / 1000, 'unixepoch') AS day_utc,
                COUNT(DISTINCT indicator) AS ind_cnt
         FROM daily_readings
         WHERE mission_id = ? AND user_id = ?
         GROUP BY day_utc
         HAVING ind_cnt >= 6`
      )
      .all(missionId, userId) as Array<{ day_utc: string; ind_cnt: number }>;
    return rows.length;
  }

  deleteUserData(userId: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM daily_readings WHERE user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM tasks WHERE user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM history WHERE user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM user_achievements WHERE user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM problem_reports WHERE user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM alerts WHERE subject_user_id = ?`).run(userId);
      this.db.prepare(`DELETE FROM exports WHERE user_id = ?`).run(userId);
    });
    tx();
  }

  // ===== Phase 4: Reports =====
  getReportSummary(
    mission: MissionRecord,
    viewer: UserAccount,
    filters: { fromMs?: number; toMs?: number; subjectUserId?: string }
  ) {
    const now = Date.now();
    const startMs = Date.parse(`${mission.startDateUtc}T00:00:00Z`);
    const fromMs =
      typeof filters.fromMs === 'number' && Number.isFinite(filters.fromMs)
        ? filters.fromMs
        : Math.min(startMs, now - 30 * 86_400_000);
    const toMs =
      typeof filters.toMs === 'number' && Number.isFinite(filters.toMs)
        ? filters.toMs
        : now;

    const totalDays = Math.max(
      1,
      Math.ceil((Math.max(fromMs, toMs) - fromMs) / 86_400_000) || 1
    );

    const derived = this.getMissionDerived(mission);
    const roster = this.getMissionRoster(mission.id);

    // Role-scoped daily readings
    let subjectFilterId: string | undefined;
    if (viewer.role === 'CREW') {
      subjectFilterId = viewer.id;
    } else if (viewer.role === 'DOCTOR' && filters.subjectUserId) {
      subjectFilterId = filters.subjectUserId;
    } else if (viewer.role === 'COMMANDER') {
      subjectFilterId = viewer.id;
    }

    const allReadings = this.listDailyReadings(mission.id, viewer, {
      subjectUserId: subjectFilterId,
    }).filter((r) => r.measuredAt >= fromMs && r.measuredAt <= toMs);

    // For Commander report: NEVER expose individual crew psych values (mood, stress, sleep)
    const safeReadings =
      viewer.role === 'COMMANDER'
        ? allReadings.filter((r) => r.userId === viewer.id)
        : allReadings;

    const indicators: Array<'hr' | 'bp' | 'sleep' | 'mood' | 'stress' | 'act'> = [
      'hr',
      'bp',
      'sleep',
      'mood',
      'stress',
      'act',
    ];
    const completeness = indicators.map((ind) => {
      const daysSet = new Set(
        safeReadings
          .filter((r) => r.indicator === ind)
          .map((r) => new Date(r.measuredAt).toISOString().slice(0, 10))
      );
      return {
        indicator: ind,
        daysRecorded: daysSet.size,
        totalDays,
      };
    });

    // Stored-only sleep trend (zero extrapolation)
    const sleepSeries = safeReadings
      .filter((r) => r.indicator === 'sleep' && typeof r.valueNumeric === 'number')
      .slice()
      .sort((a, b) => a.measuredAt - b.measuredAt)
      .map((r) => ({
        day: new Date(r.measuredAt).toISOString().slice(0, 10),
        hours: r.valueNumeric as number,
      }));

    // Stored-only alerts scoped by role
    const alerts = this.listAlerts(mission.id, viewer).filter(
      (a) => a.createdAt >= fromMs && a.createdAt <= toMs
    );

    // Tasks compliance (done / not done)
    const tasks = this.getCalendarTasks(mission.id, viewer).filter((t) => {
      if (!t.scheduledDateUtc) return true;
      const tMs = Date.parse(`${t.scheduledDateUtc}T00:00:00Z`);
      return tMs >= fromMs - 86_400_000 && tMs <= toMs + 86_400_000;
    });
    const completedTasksCount = tasks.filter((t) => t.status === 'COMPLETED').length;
    const deferredTasksCount = tasks.filter((t) => t.status === 'DEFERRED').length;

    // Problem reports (Doctor & Crew self only; NEVER Commander)
    const problemReports =
      viewer.role === 'COMMANDER'
        ? []
        : (this.listProblemReports(mission.id, viewer) as Array<Record<string, unknown>>)
            .filter(
              (pr) =>
                (pr.created_at as number) >= fromMs &&
                (pr.created_at as number) <= toMs
            )
            .map((pr) => ({
              id: pr.id as string,
              userId: pr.user_id as string,
              userName: pr.user_name as string,
              urgent: Boolean(pr.urgent),
              description: pr.description as string,
              measuredAt: pr.measured_at as number,
              createdAt: pr.created_at as number,
            }));

    // Rule change audit log (Doctor/Commander)
    const ruleChanges =
      viewer.role === 'CREW'
        ? []
        : (this.listRuleChangeLog() as Array<Record<string, unknown>>).filter(
            (rc) =>
              (rc.created_at as number) >= fromMs &&
              (rc.created_at as number) <= toMs
          );

    // Hazards (COMMANDER ONLY — Doctor & Crew NEVER see hazards)
    const hazards =
      viewer.role === 'COMMANDER'
        ? this.listHazardEntries(mission.id, viewer).filter(
            (h) => h.measuredAt >= fromMs && h.measuredAt <= toMs
          )
        : [];

    // Doctor crew completeness summary (Doctor only)
    const crewSummary =
      viewer.role === 'DOCTOR'
        ? roster
            .filter((m) => m.role !== 'DOCTOR')
            .map((m) => {
              const memberReadings = this.listDailyReadings(mission.id, viewer, {
                subjectUserId: m.userId,
              }).filter((r) => r.measuredAt >= fromMs && r.measuredAt <= toMs);
              const recordedDays = new Set(
                memberReadings.map((r) =>
                  new Date(r.measuredAt).toISOString().slice(0, 10)
                )
              ).size;
              const openAlerts = alerts.filter(
                (a) => a.subjectUserId === m.userId && !a.acknowledgedAt
              ).length;
              return {
                userId: m.userId,
                name: m.name,
                role: m.role,
                readingsCount: memberReadings.length,
                recordedDays,
                totalDays,
                openAlerts,
              };
            })
        : [];

    // Commander compliance breakdown (done / not done per crew member, NO psych data)
    const complianceByMember =
      viewer.role === 'COMMANDER'
        ? roster.map((m) => {
            const mTasks = tasks.filter((t) => t.userId === m.userId);
            return {
              userId: m.userId,
              name: m.name,
              role: m.role,
              doneCount: mTasks.filter((t) => t.status === 'COMPLETED').length,
              notDoneCount: mTasks.filter((t) => t.status !== 'COMPLETED').length,
            };
          })
        : [];

    return {
      generatedAt: now,
      fromMs,
      toMs,
      totalDays,
      viewerRole: viewer.role,
      mission,
      derived,
      roster: roster.map((r) => ({ userId: r.userId, name: r.name, role: r.role })),
      completeness,
      readings: safeReadings,
      sleepSeries,
      alerts,
      tasks,
      taskCompliance: {
        total: tasks.length,
        done: completedTasksCount,
        deferred: deferredTasksCount,
        notDone: tasks.length - completedTasksCount,
      },
      complianceByMember,
      crewSummary,
      problemReports,
      ruleChanges,
      hazards,
      baselines: [
        { indicator: 'hr', value: null, unit: 'bpm', status: 'NOT_CONFIGURED' },
        { indicator: 'bp', value: null, unit: 'mmHg', status: 'NOT_CONFIGURED' },
        { indicator: 'sleep', value: null, unit: 'hours', status: 'NOT_CONFIGURED' },
      ],
    };
  }

  // ===== Phase 4: Data Exports Lifecycle & Rate Limiting =====
  cleanupExpiredExports(nowMs = Date.now()): void {
    this.db.prepare(`DELETE FROM exports WHERE expires_at <= ?`).run(nowMs);
  }

  countRecentExports(userId: string, sinceMs: number): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM exports WHERE user_id = ? AND created_at >= ?`
      )
      .get(userId, sinceMs) as { cnt: number };
    return row.cnt;
  }

  gatherExportSources(
    actor: UserAccount,
    mission: MissionRecord | null,
    input: {
      scope: 'my' | 'crew_member' | 'entire_crew' | 'mission';
      subjectUserId: string | null;
      fromMs: number;
      toMs: number;
    }
  ) {
    const roster = mission ? this.getMissionRoster(mission.id) : [];

    // Resolve daily readings with strict role + privacy guards
    let dailyReadings: DailyReadingRecord[] = [];
    if (mission) {
      if (actor.role === 'CREW') {
        dailyReadings = this.listDailyReadings(mission.id, actor, {
          subjectUserId: actor.id,
        });
      } else if (actor.role === 'DOCTOR') {
        const subId =
          input.scope === 'my'
            ? actor.id
            : input.scope === 'crew_member'
              ? input.subjectUserId ?? actor.id
              : undefined;
        dailyReadings = this.listDailyReadings(mission.id, actor, {
          subjectUserId: subId,
        });
      } else if (actor.role === 'COMMANDER') {
        if (input.scope === 'my') {
          dailyReadings = this.listDailyReadings(mission.id, actor).filter(
            (r) => r.userId === actor.id
          );
        } else {
          // Mission scope: Commander gets own daily readings + non-ranked crew exercise sessions ONLY
          const own = this.listDailyReadings(mission.id, actor).filter(
            (r) => r.userId === actor.id
          );
          const crewActs = this.listDailyReadings(mission.id, actor, {
            indicator: 'act',
          }).filter((r) => r.userId !== actor.id);
          dailyReadings = [...own, ...crewActs];
        }
      }
      dailyReadings = dailyReadings.filter(
        (r) => r.measuredAt >= input.fromMs && r.measuredAt <= input.toMs
      );
    }

    const alerts = mission
      ? this.listAlerts(mission.id, actor).filter((a) => {
          if (a.createdAt < input.fromMs || a.createdAt > input.toMs) return false;
          if (actor.role === 'DOCTOR' && input.scope === 'crew_member' && input.subjectUserId) {
            return a.subjectUserId === input.subjectUserId;
          }
          if (actor.role === 'DOCTOR' && input.scope === 'my') {
            return a.subjectUserId === actor.id;
          }
          return true;
        })
      : [];

    const problemReports =
      mission && actor.role !== 'COMMANDER'
        ? (this.listProblemReports(mission.id, actor) as Array<Record<string, unknown>>)
            .filter((pr) => {
              const createdAt = pr.created_at as number;
              if (createdAt < input.fromMs || createdAt > input.toMs) return false;
              if (input.scope === 'my') return pr.user_id === actor.id;
              if (actor.role === 'DOCTOR' && input.scope === 'crew_member' && input.subjectUserId) {
                return pr.user_id === input.subjectUserId;
              }
              return true;
            })
            .map((pr) => ({
              id: pr.id as string,
              missionId: pr.mission_id as string,
              userId: pr.user_id as string,
              userName: pr.user_name as string,
              urgent: Boolean(pr.urgent),
              description: pr.description as string,
              measuredAt: pr.measured_at as number,
              createdAt: pr.created_at as number,
            }))
        : [];

    const nameMap = new Map(roster.map((m) => [m.userId, m.name]));
    const tasks = mission
      ? this.getCalendarTasks(mission.id, actor)
          .filter((t) => {
            if (input.scope === 'my' && t.userId !== actor.id) return false;
            if (actor.role === 'DOCTOR' && input.scope === 'crew_member' && input.subjectUserId) {
              if (t.userId !== input.subjectUserId) return false;
            }
            if (!t.scheduledDateUtc) return true;
            const ms = Date.parse(`${t.scheduledDateUtc}T00:00:00Z`);
            return ms >= input.fromMs - 86_400_000 && ms <= input.toMs + 86_400_000;
          })
          .map((t) => ({
            ...t,
            userName: nameMap.get(t.userId) ?? actor.name,
          }))
      : [];

    const hazards =
      mission && actor.role === 'COMMANDER'
        ? this.listHazardEntries(mission.id, actor).filter(
            (h) => h.measuredAt >= input.fromMs && h.measuredAt <= input.toMs
          )
        : [];

    const auditLog =
      mission && actor.role !== 'CREW'
        ? (this.listAuditLog(mission.id, actor) as Array<Record<string, unknown>>)
            .filter(
              (a) =>
                (a.created_at as number) >= input.fromMs &&
                (a.created_at as number) <= input.toMs
            )
            .map((a) => ({
              id: a.id as string,
              actorUserId: a.actor_user_id as string,
              actorRole: a.actor_role as string,
              actionKey: a.action_key as string,
              params: JSON.parse((a.params_json as string) || '{}') as Record<string, unknown>,
              targetUserId: (a.target_user_id as string | null) ?? null,
              createdAt: a.created_at as number,
            }))
        : [];

    return {
      roster,
      dailyReadings,
      alerts,
      problemReports,
      tasks,
      hazards,
      auditLog,
      preferences: this.getPreferences(actor.id),
      rules: this.listRules(),
      protocols: this.listProtocols().map((p) => ({
        id: p.id,
        titleKey: p.titleKey,
        frequency: p.frequency,
        roleScope: p.roleScope,
        estimatedMinutes: p.estimatedMinutes,
        sourceUrl: p.sourceUrl,
      })),
      sources: DATA_SOURCES_SEED.map((s) => ({
        id: s.id,
        titleKey: s.titleKey,
        organization: s.organization,
        url: s.url,
      })),
    };
  }

  createExportJob(input: {
    id: string;
    userId: string;
    missionId: string | null;
    scope: string;
    subjectUserId: string | null;
    fromMs: number;
    toMs: number;
    include: string[];
    format: string;
    labelLanguage: string;
    status: 'PENDING' | 'READY' | 'FAILED';
    fileName: string;
    mimeType: string;
    fileBytes: number;
    contentBlob: Buffer | null;
    createdAt: number;
    expiresAt: number;
  }) {
    this.db
      .prepare(
        `INSERT INTO exports (
          id, user_id, mission_id, scope, subject_user_id, from_ms, to_ms,
          include_json, format, label_language, status, file_name, mime_type,
          file_bytes, content_blob, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.missionId,
        input.scope,
        input.subjectUserId,
        input.fromMs,
        input.toMs,
        JSON.stringify(input.include),
        input.format,
        input.labelLanguage,
        input.status,
        input.fileName,
        input.mimeType,
        input.fileBytes,
        input.contentBlob,
        input.expiresAt,
        input.createdAt
      );
  }

  updateExportJobReady(
    id: string,
    fileName: string,
    mimeType: string,
    contentBlob: Buffer
  ): void {
    this.db
      .prepare(
        `UPDATE exports
         SET status = 'READY', file_name = ?, mime_type = ?, file_bytes = ?, content_blob = ?
         WHERE id = ?`
      )
      .run(fileName, mimeType, contentBlob.byteLength, contentBlob, id);
  }

  updateExportJobFailed(id: string): void {
    this.db.prepare(`UPDATE exports SET status = 'FAILED' WHERE id = ?`).run(id);
  }

  listExportJobs(userId: string, nowMs = Date.now()) {
    this.cleanupExpiredExports(nowMs);
    const rows = this.db
      .prepare(
        `SELECT id, user_id, mission_id, scope, subject_user_id, from_ms, to_ms,
                include_json, format, label_language, status, file_name, mime_type,
                file_bytes, expires_at, created_at
         FROM exports
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .all(userId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      missionId: (r.mission_id as string | null) ?? null,
      scope: r.scope as string,
      subjectUserId: (r.subject_user_id as string | null) ?? null,
      fromMs: r.from_ms as number,
      toMs: r.to_ms as number,
      include: JSON.parse((r.include_json as string) || '[]') as string[],
      format: r.format as string,
      labelLanguage: r.label_language as 'en' | 'ar',
      status: r.status as 'PENDING' | 'READY' | 'FAILED',
      fileName: r.file_name as string,
      mimeType: r.mime_type as string,
      fileBytes: r.file_bytes as number,
      expiresAt: r.expires_at as number,
      createdAt: r.created_at as number,
    }));
  }

  getExportJobWithBlob(exportId: string) {
    const row = this.db
      .prepare(`SELECT * FROM exports WHERE id = ?`)
      .get(exportId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      missionId: (row.mission_id as string | null) ?? null,
      scope: row.scope as string,
      subjectUserId: (row.subject_user_id as string | null) ?? null,
      fromMs: row.from_ms as number,
      toMs: row.to_ms as number,
      include: JSON.parse((row.include_json as string) || '[]') as string[],
      format: row.format as string,
      labelLanguage: row.label_language as 'en' | 'ar',
      status: row.status as 'PENDING' | 'READY' | 'FAILED',
      fileName: row.file_name as string,
      mimeType: row.mime_type as string,
      fileBytes: row.file_bytes as number,
      contentBlob: (row.content_blob as Buffer | null) ?? null,
      expiresAt: row.expires_at as number,
      createdAt: row.created_at as number,
    };
  }
}
