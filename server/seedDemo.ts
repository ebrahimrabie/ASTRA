import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  AstraRepository,
  ForbiddenError,
  type AlertRecord,
  type MissionRecord,
  type UserAccount,
} from './db.ts';
import { SEED_CO2_SAMPLES } from './domain.ts';

export interface DemoScenarioSummary {
  id: number;
  key: string;
  titleKey: string;
  descKey: string;
  targetRoute: string;
}

export const DEMO_SCENARIOS: ReadonlyArray<DemoScenarioSummary> = [
  {
    id: 1,
    key: 'normal_health',
    titleKey: 'demoScenarios.s1.title',
    descKey: 'demoScenarios.s1.desc',
    targetRoute: '/health',
  },
  {
    id: 2,
    key: 'sleep_trend',
    titleKey: 'demoScenarios.s2.title',
    descKey: 'demoScenarios.s2.desc',
    targetRoute: '/health/sleep',
  },
  {
    id: 3,
    key: 'co2_assessment',
    titleKey: 'demoScenarios.s3.title',
    descKey: 'demoScenarios.s3.desc',
    targetRoute: '/risks/env',
  },
  {
    id: 4,
    key: 'radiation_monitoring',
    titleKey: 'demoScenarios.s4.title',
    descKey: 'demoScenarios.s4.desc',
    targetRoute: '/risks/rad',
  },
  {
    id: 5,
    key: 'comm_loss',
    titleKey: 'demoScenarios.s5.title',
    descKey: 'demoScenarios.s5.desc',
    targetRoute: '/protocol',
  },
  {
    id: 6,
    key: 'stale_data',
    titleKey: 'demoScenarios.s6.title',
    descKey: 'demoScenarios.s6.desc',
    targetRoute: '/health',
  },
  {
    id: 7,
    key: 'protocol_reminder',
    titleKey: 'demoScenarios.s7.title',
    descKey: 'demoScenarios.s7.desc',
    targetRoute: '/calendar',
  },
  {
    id: 8,
    key: 'guided_assistant',
    titleKey: 'demoScenarios.s8.title',
    descKey: 'demoScenarios.s8.desc',
    targetRoute: '/assistant',
  },
];

export const DEMO_INVITE_CODE = 'ASTRA-DEMO01';

export async function seedDemoMission(repo: AstraRepository): Promise<{
  mission: MissionRecord;
  commander: UserAccount;
  doctor: UserAccount;
  crew: UserAccount;
}> {
  const passwordHash = await bcrypt.hash('DemoUser123!', 10);

  const ensureUser = (
    name: string,
    email: string,
    role: UserAccount['role']
  ): UserAccount => {
    const existing = repo.findUserByEmail(email);
    if (existing) return existing;
    return repo.createUser({ name, email, passwordHash, role });
  };

  const commander = ensureUser('Cmdr. Demo Vega', 'demo-commander@astra.local', 'COMMANDER');
  const doctor = ensureUser('Dr. Demo Lin', 'demo-doctor@astra.local', 'DOCTOR');
  const crew = ensureUser('Crew Demo Kai', 'demo-crew@astra.local', 'CREW');

  const existingMissionRow = repo.db
    .prepare(`SELECT * FROM missions WHERE invite_code = ?`)
    .get(DEMO_INVITE_CODE) as { id: string } | undefined;

  let mission: MissionRecord;
  if (!existingMissionRow) {
    const startUtc = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    mission = repo.createMission(commander.id, {
      name: 'ASTRA LEO Demo Mission',
      startDateUtc: startUtc,
      plannedDays: 180,
      templateId: 'leo_iss',
      weeklyHazardWeekday: 1,
      isDemo: true,
      inviteCode: DEMO_INVITE_CODE,
    });
    repo.joinMissionByInvite(doctor.id, 'DOCTOR', DEMO_INVITE_CODE);
    repo.joinMissionByInvite(crew.id, 'CREW', DEMO_INVITE_CODE);
  } else {
    repo.joinMissionByInvite(doctor.id, 'DOCTOR', DEMO_INVITE_CODE);
    repo.joinMissionByInvite(crew.id, 'CREW', DEMO_INVITE_CODE);
    mission = repo.getUserMission(commander.id)!;
  }

  return { mission, commander, doctor, crew };
}

export function applyDemoScenario(
  repo: AstraRepository,
  mission: MissionRecord,
  actor: UserAccount,
  scenarioId: number
): {
  scenarioId: number;
  alerts: AlertRecord[];
  targetRoute: string;
  details: Record<string, unknown>;
} {
  if (!mission.isDemo) {
    throw new ForbiddenError(
      'Demo scenarios can only be loaded into a DEMO mission.',
      'DEMO_MISSION_ONLY'
    );
  }

  const meta = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  if (!meta) {
    throw new ForbiddenError('Unknown demo scenario.', 'UNKNOWN_SCENARIO');
  }

  const now = Date.now();
  const alertsCreated: AlertRecord[] = [];

  // Target subject for crew-reading scenarios (Doctor evaluates on demo crew or self if single)
  const roster = repo.getMissionRoster(mission.id);
  const crewMember =
    actor.role === 'DOCTOR'
      ? repo.findUserById(
          roster.find((m) => m.role === 'CREW')?.userId ?? actor.id
        ) ?? actor
      : actor;

  const clearUserIndicatorReadings = (userId: string, indicator?: string) => {
    if (indicator) {
      repo.db
        .prepare(
          `DELETE FROM daily_readings WHERE mission_id = ? AND user_id = ? AND indicator = ?`
        )
        .run(mission.id, userId, indicator);
    } else {
      repo.db
        .prepare(`DELETE FROM daily_readings WHERE mission_id = ? AND user_id = ?`)
        .run(mission.id, userId);
    }
  };

  if (scenarioId === 1) {
    // 1. Normal health monitoring
    clearUserIndicatorReadings(crewMember.id);
    repo.db
      .prepare(`DELETE FROM alerts WHERE mission_id = ? AND subject_user_id = ?`)
      .run(mission.id, crewMember.id);

    const src = 'Crew medical device (approved)';
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'hr',
      valueNumeric: 72,
      context: 'RESTING',
      measuredAt: now - 300_000,
      source: src,
      deviceId: 'DEMO-HR-01',
      provenance: 'Manual entry',
      dataQuality: 'VALID',
    });
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'bp',
      systolic: 118,
      diastolic: 76,
      measuredAt: now - 240_000,
      source: src,
      deviceId: 'DEMO-BP-01',
      provenance: 'Manual entry',
      dataQuality: 'VALID',
    });
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'sleep',
      valueNumeric: 7.8,
      measuredAt: now - 180_000,
      source: 'Manual measurement',
      provenance: 'Self-reported',
      dataQuality: 'VALID',
    });
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'mood',
      valueNumeric: 4,
      measuredAt: now - 120_000,
      source: 'Manual measurement',
      provenance: 'Self-reported',
      dataQuality: 'VALID',
    });
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'stress',
      valueNumeric: 18,
      measuredAt: now - 60_000,
      source: 'Manual measurement',
      provenance: 'Self-reported',
      dataQuality: 'VALID',
    });
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'act',
      valueNumeric: 45,
      activityType: 'AEROBIC',
      activityCompleted: true,
      measuredAt: now - 30_000,
      source: 'Wearable',
      provenance: 'Manual entry',
      dataQuality: 'VALID',
    });

    return {
      scenarioId,
      alerts: [],
      targetRoute: meta.targetRoute,
      details: { status: 'NORMAL', alertsCount: 0 },
    };
  }

  if (scenarioId === 2 || scenarioId === 8) {
    // 2. Sleep trend review (7.5, 7.2, 6.8, 6.1, 5.9 h)
    // 8. Guided Assistant (ensures Sleep REVIEW alert is active and routes to /assistant)
    clearUserIndicatorReadings(crewMember.id, 'sleep');
    repo.db
      .prepare(
        `DELETE FROM alerts WHERE mission_id = ? AND subject_user_id = ? AND rule_id LIKE 'R-SLP%'`
      )
      .run(mission.id, crewMember.id);

    const hoursSeq = [7.5, 7.2, 6.8, 6.1, 5.9];
    for (let i = 0; i < hoursSeq.length; i += 1) {
      const dayOffset = hoursSeq.length - 1 - i;
      const out = repo.recordDailyReading(mission.id, crewMember, {
        indicator: 'sleep',
        valueNumeric: hoursSeq[i],
        measuredAt: now - dayOffset * 86_400_000 - 3_600_000,
        source: 'Manual measurement',
        deviceId: 'DEMO-SLP-01',
        provenance: 'Self-reported',
        dataQuality: 'VALID',
      });
      alertsCreated.push(...out.alerts);
    }

    return {
      scenarioId,
      alerts: alertsCreated,
      targetRoute: meta.targetRoute,
      details: { sleepHours: hoursSeq, alertsCount: alertsCreated.length },
    };
  }

  if (scenarioId === 3) {
    // 3. CO2 environmental assessment (4 scripted samples -> mean 3.075, coverage 45 min, INSUFFICIENT DATA)
    const co2Samples = SEED_CO2_SAMPLES.map((s) => ({
      valueMmHg: s.value,
      sampledAt: s.sampledAt,
    }));
    if (actor.role === 'COMMANDER') {
      const out = repo.recordHazardEntry(mission.id, actor, {
        category: 'ENVIRONMENT',
        payload: {
          category: 'ENVIRONMENT',
          source: 'Vehicle atmosphere monitor display',
          deviceId: 'DEMO-ENV-01',
          co2Samples,
          ppO2MmHg: 150,
          totalPressureKpa: 101.3,
          diluentPercent: 78,
          tempC: 22.5,
          rhPercent: 45,
          ventilationStatus: 'NOMINAL',
          measuredAt: now - 60_000,
          provenance: 'Manual entry',
        },
        measuredAt: now - 60_000,
        source: 'Vehicle atmosphere monitor display',
        deviceId: 'DEMO-ENV-01',
        provenance: 'Manual entry',
        dataQuality: 'VALID',
      });
      alertsCreated.push(...out.alerts);
    }

    return {
      scenarioId,
      alerts: alertsCreated,
      targetRoute: actor.role === 'COMMANDER' ? meta.targetRoute : '/demo-scenarios',
      details: {
        sampleMean: 3.075,
        coverageMinutes: 45,
        status: 'INSUFFICIENT DATA',
      },
    };
  }

  if (scenarioId === 4) {
    // 4. Radiation monitoring (LEO template prefill: CAD, 0.3 mGy/day absorbed, 0.35 mSv/day effective)
    const prefill = {
      detector: 'CAD',
      detectorLocation: 'Columbus Module',
      absorbedRateMgyDay: 0.3,
      effectiveRateMsvDay: 0.35,
      missionAccumulatedAbsorbedMgy: 9.0,
      missionAccumulatedEffectiveMsv: 10.5,
      priorCareerEffectiveMsv: 0,
      solarEventStatus: 'NONE' as const,
    };

    if (actor.role === 'COMMANDER') {
      const out = repo.recordHazardEntry(mission.id, actor, {
        category: 'RADIATION',
        payload: {
          category: 'RADIATION',
          ...prefill,
          periodStart: now - 7 * 86_400_000,
          periodEnd: now,
          measuredAt: now - 60_000,
          provenance: 'Manual entry',
        },
        measuredAt: now - 60_000,
        source: 'CAD',
        deviceId: 'DEMO-CAD-01',
        provenance: 'Manual entry',
        dataQuality: 'VALID',
      });
      alertsCreated.push(...out.alerts);
    }

    return {
      scenarioId,
      alerts: alertsCreated,
      targetRoute: actor.role === 'COMMANDER' ? meta.targetRoute : '/demo-scenarios',
      details: prefill,
    };
  }

  if (scenarioId === 5) {
    // 5. Communication loss walkthrough (no fake offline mutations, opens Protocol so user toggles real offline mode)
    return {
      scenarioId,
      alerts: [],
      targetRoute: meta.targetRoute,
      details: { stepGuide: 'online -> protocol -> offline -> reading -> sync' },
    };
  }

  if (scenarioId === 6) {
    // 6. Missing or stale data (HR measured > 24 h ago -> STALE)
    clearUserIndicatorReadings(crewMember.id, 'hr');
    const staleAt = now - 26 * 3600_000;
    repo.recordDailyReading(mission.id, crewMember, {
      indicator: 'hr',
      valueNumeric: 68,
      context: 'RESTING',
      measuredAt: staleAt,
      source: 'Crew medical device (approved)',
      deviceId: 'DEMO-HR-STALE',
      provenance: 'Manual entry',
      dataQuality: 'STALE',
    });

    return {
      scenarioId,
      alerts: [],
      targetRoute: meta.targetRoute,
      details: { indicator: 'hr', status: 'STALE', lastValidAt: staleAt },
    };
  }

  // 7. Protocol reminder (creates a PENDING task with due time today UTC)
  const todayUtc = new Date(now).toISOString().slice(0, 10);
  const dueHh = String(new Date(now + 15 * 60_000).getUTCHours()).padStart(2, '0');
  const dueMm = String(new Date(now + 15 * 60_000).getUTCMinutes()).padStart(2, '0');
  const dueStr = `${dueHh}:${dueMm}`;
  const taskId = crypto.randomUUID();
  repo.db
    .prepare(
      `INSERT INTO tasks (
        id, user_id, name, due, status, defer_reason,
        mission_id, protocol_id, scheduled_date_utc, title_key, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PENDING', NULL, ?, 'PRT-HR', ?, 'kb.protocols.PRT-HR.title', ?, ?)`
    )
    .run(taskId, actor.id, 'Resting Heart Rate Check (Demo Reminder)', dueStr, mission.id, todayUtc, now, now);

  return {
    scenarioId,
    alerts: [],
    targetRoute: meta.targetRoute,
    details: { taskId, dueUtc: dueStr, scheduledDateUtc: todayUtc },
  };
}

// CLI execution: `npm run seed:demo`
const isMain =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const repo = new AstraRepository();
  seedDemoMission(repo)
    .then(({ mission, commander, doctor, crew }) => {
      console.log('ASTRA Demo Mission Ready:');
      console.log(`  Mission: ${mission.name} (Invite Code: ${mission.inviteCode})`);
      console.log(`  Commander: ${commander.email} / DemoUser123!`);
      console.log(`  Doctor:    ${doctor.email} / DemoUser123!`);
      console.log(`  Crew:      ${crew.email} / DemoUser123!`);
      repo.close();
    })
    .catch((err) => {
      console.error('Failed to seed demo mission:', err);
      repo.close();
      process.exit(1);
    });
}
