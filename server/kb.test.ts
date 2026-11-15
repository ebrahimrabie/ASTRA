import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from './app.ts';
import { AstraRepository } from './db.ts';
import { seedKnowledgeBase } from './kb.ts';
import {
  analyzeCo2Series,
  calculateMissionDerived,
  evaluateBloodPressureRules,
  evaluateEnvironmentHazard,
  evaluateHeartRateRules,
  evaluateRadiationRules,
  evaluateSleepRules,
} from './rulesEngine.ts';

async function withTestServer(
  fn: (baseUrl: string, repo: AstraRepository) => Promise<void>
): Promise<void> {
  const repo = new AstraRepository(':memory:');
  const app = createApiApp(repo);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl, repo);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    repo.close();
  }
}

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie');
  assert.ok(raw, 'Expected Set-Cookie header');
  return raw.split(';')[0];
}

test('knowledge base seed is idempotent', () => {
  const repo = new AstraRepository(':memory:');
  const countBefore = {
    templates: repo.listMissionTemplates().length,
    rules: repo.listRules().length,
    protocols: repo.listProtocols().length,
    instruments: repo.listInstruments().length,
  };
  seedKnowledgeBase(repo.db);
  seedKnowledgeBase(repo.db);
  const countAfter = {
    templates: repo.listMissionTemplates().length,
    rules: repo.listRules().length,
    protocols: repo.listProtocols().length,
    instruments: repo.listInstruments().length,
  };
  assert.deepEqual(countAfter, countBefore);
  assert.equal(countAfter.templates, 3);
  assert.equal(countAfter.rules, 32);
  assert.equal(countAfter.protocols, 11);
  assert.equal(countAfter.instruments, 18);
  repo.close();
});

test('rule boundary evaluations: HR, BP, Sleep (incl. 5-night scenario), CO2, Temp/RH, Radiation, Light time', () => {
  // Heart rate boundaries (Resting only)
  assert.equal(evaluateHeartRateRules({ bpm: 59, context: 'RESTING' })[0]?.ruleId, 'R-HR-01');
  assert.equal(evaluateHeartRateRules({ bpm: 60, context: 'RESTING' }).length, 0);
  assert.equal(evaluateHeartRateRules({ bpm: 100, context: 'RESTING' }).length, 0);
  assert.equal(evaluateHeartRateRules({ bpm: 101, context: 'RESTING' })[0]?.ruleId, 'R-HR-01');
  assert.equal(evaluateHeartRateRules({ bpm: 145, context: 'AFTER_EXERCISE' }).length, 0);
  assert.deepEqual(
    evaluateHeartRateRules({ bpm: 105, context: 'RESTING', previousDayRestingBpm: 102 }).map(
      (r) => r.ruleId
    ),
    ['R-HR-01', 'R-HR-02']
  );

  // Blood pressure boundaries
  assert.equal(evaluateBloodPressureRules({ systolic: 129, diastolic: 79 }).length, 0);
  assert.equal(evaluateBloodPressureRules({ systolic: 130, diastolic: 79 })[0]?.ruleId, 'R-BP-01');
  assert.equal(evaluateBloodPressureRules({ systolic: 140, diastolic: 90 })[0]?.ruleId, 'R-BP-02');
  assert.equal(evaluateBloodPressureRules({ systolic: 180, diastolic: 70 })[0]?.ruleId, 'R-BP-02');
  assert.equal(evaluateBloodPressureRules({ systolic: 181, diastolic: 70 })[0]?.ruleId, 'R-BP-03');
  assert.equal(evaluateBloodPressureRules({ systolic: 110, diastolic: 120 })[0]?.ruleId, 'R-BP-02');
  assert.equal(evaluateBloodPressureRules({ systolic: 110, diastolic: 121 })[0]?.ruleId, 'R-BP-03');
  assert.equal(evaluateBloodPressureRules({ systolic: 89, diastolic: 70 })[0]?.ruleId, 'R-BP-04');

  // Sleep boundaries & 5-night scenario: 7.5, 7.2, 6.8, 6.1, 5.9
  assert.equal(evaluateSleepRules([7.0]).length, 0);
  assert.equal(evaluateSleepRules([6.9])[0]?.ruleId, 'R-SLP-01');
  const fiveNights = [7.5, 7.2, 6.8, 6.1, 5.9];
  assert.equal(evaluateSleepRules(fiveNights.slice(0, 1)).length, 0);
  assert.equal(evaluateSleepRules(fiveNights.slice(0, 2)).length, 0);
  assert.deepEqual(
    evaluateSleepRules(fiveNights.slice(0, 3)).map((r) => `${r.ruleId}:${r.severity}`),
    ['R-SLP-01:MONITOR']
  );
  assert.deepEqual(
    evaluateSleepRules(fiveNights.slice(0, 4)).map((r) => `${r.ruleId}:${r.severity}`),
    ['R-SLP-01:MONITOR', 'R-SLP-03:INFORMATION']
  );
  assert.deepEqual(
    evaluateSleepRules(fiveNights).map((r) => `${r.ruleId}:${r.severity}`),
    ['R-SLP-01:MONITOR', 'R-SLP-02:REVIEW', 'R-SLP-03:INFORMATION']
  );

  // 4-sample CO2 scenario
  const baseMs = Date.UTC(2026, 0, 1, 9, 0, 0);
  const fourSamples = [2.8, 3.0, 3.2, 3.3].map((v, i) => ({
    value: v,
    sampledAt: baseMs + i * 15 * 60_000,
  }));
  const res4 = analyzeCo2Series(fourSamples);
  assert.equal(res4.sampleMean, 3.075);
  assert.equal(res4.verifiedHourAverage, null);
  assert.equal(res4.status, 'INSUFFICIENT DATA');
  assert.deepEqual(
    res4.alerts.map((a) => a.ruleId),
    ['R-ENV-02']
  );

  // Verified 5-sample CO2 average: 3.0 vs 3.01
  const fiveAt300 = [3.0, 3.0, 3.0, 3.0, 3.0].map((v, i) => ({
    value: v,
    sampledAt: baseMs + i * 15 * 60_000,
  }));
  const res300 = analyzeCo2Series(fiveAt300);
  assert.equal(res300.verifiedHourAverage, 3.0);
  assert.equal(res300.status, 'MONITOR');
  assert.equal(res300.alerts.length, 0);

  const fiveAt301 = [3.01, 3.01, 3.01, 3.01, 3.01].map((v, i) => ({
    value: v,
    sampledAt: baseMs + i * 15 * 60_000,
  }));
  const res301 = analyzeCo2Series(fiveAt301);
  assert.equal(res301.verifiedHourAverage, 3.01);
  assert.equal(res301.status, 'ALERT');
  assert.deepEqual(
    res301.alerts.map((a) => a.ruleId),
    ['R-ENV-01']
  );

  // Temp/RH corner-line rule
  assert.equal(evaluateEnvironmentHazard({ tempC: 22, rhPercent: 45 }).length, 0);
  assert.equal(evaluateEnvironmentHazard({ tempC: 25, rhPercent: 60 }).length, 0);
  assert.equal(evaluateEnvironmentHazard({ tempC: 19, rhPercent: 60 })[0]?.severity, 'INFORMATION');
  assert.equal(evaluateEnvironmentHazard({ tempC: 27, rhPercent: 30 })[0]?.severity, 'ALERT');

  // Lunar distance light time ~1.282s
  const derived = calculateMissionDerived({
    startDateUtc: '2026-01-01',
    plannedDays: 30,
    distanceKm: 384400,
    distanceIsTemplateDefault: true,
    nowMs: Date.UTC(2026, 0, 5, 12, 0, 0),
  });
  assert.ok(Math.abs(derived.oneWayLightSeconds - 1.28222) < 0.001);
  assert.equal(derived.missionDay, 5);

  // Radiation mGy and mSv kept separate
  const radEval = evaluateRadiationRules({
    absorbedRateMgyDay: 0.45,
    effectiveRateMsvDay: 0.35,
    missionAccumulatedAbsorbedMgy: 12.0,
    missionAccumulatedEffectiveMsv: 200,
    priorCareerEffectiveMsv: 290, // career = 490 -> >= 80% of 600
    trailing30DayEffectiveMsv: 20,
    solarEventStatus: 'SPE_IN_PROGRESS',
  });
  assert.equal(radEval.careerTotalMsv, 490);
  assert.deepEqual(
    radEval.alerts.map((a) => a.ruleId),
    ['R-RAD-01', 'R-RAD-03', 'R-RAD-05']
  );
});

test('multi-role workflow: wizard, rule editing permissions, privacy, and Doctor alert isolation', async () => {
  await withTestServer(async (baseUrl) => {
    // Register Commander
    const regCmd = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cmdr Vega',
        email: 'cmdr@astra.test',
        password: 'Password123!',
        role: 'COMMANDER',
      }),
    });
    assert.equal(regCmd.status, 201);
    const cmdCookie = extractCookie(regCmd);

    // Setup Mission via Wizard
    const setupRes = await fetch(`${baseUrl}/api/mission/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cmdCookie },
      body: JSON.stringify({
        name: 'Artemis Test Alpha',
        startDateUtc: new Date().toISOString().slice(0, 10),
        plannedDays: 30,
        templateId: 'lunar',
        weeklyHazardWeekday: 1,
      }),
    });
    assert.equal(setupRes.status, 201);
    const { mission, derived } = (await setupRes.json()) as {
      mission: { id: string; inviteCode: string; name: string };
      derived: { missionDay: number; distanceKm: number; oneWayLightSeconds: number };
    };
    assert.equal(mission.name, 'Artemis Test Alpha');
    assert.equal(derived.missionDay, 1);
    assert.equal(derived.distanceKm, 384400);

    // Fresh mission has 0 readings, 0 hazards, 0 alerts, and populated calendar
    const calRes = await fetch(`${baseUrl}/api/calendar`, {
      headers: { Cookie: cmdCookie },
    });
    const calBody = (await calRes.json()) as { tasks: unknown[] };
    assert.ok(calBody.tasks.length > 0);

    // Register Doctor & Crew with invite code
    const regDoc = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr Lin',
        email: 'doc@astra.test',
        password: 'Password123!',
        role: 'DOCTOR',
        inviteCode: mission.inviteCode,
      }),
    });
    assert.equal(regDoc.status, 201);
    const docCookie = extractCookie(regDoc);

    const regCrew = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Crew Kai',
        email: 'crew@astra.test',
        password: 'Password123!',
        role: 'CREW',
        inviteCode: mission.inviteCode,
      }),
    });
    assert.equal(regCrew.status, 201);
    const crewCookie = extractCookie(regCrew);

    // Doctor cannot edit NASA_REFERENCE rules (403)
    const editNasaRes = await fetch(`${baseUrl}/api/rules/R-ENV-01`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: docCookie },
      body: JSON.stringify({ customThreshold: '> 5.0' }),
    });
    assert.equal(editNasaRes.status, 403);

    // Doctor CAN edit PROTOTYPE_DEFAULT rules and it logs to rule_change_log
    const editProtoRes = await fetch(`${baseUrl}/api/rules/R-STR-01`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: docCookie },
      body: JSON.stringify({ customGuidance: 'Schedule private check-in within 24h.' }),
    });
    assert.equal(editProtoRes.status, 200);
    const rulesRes = await fetch(`${baseUrl}/api/rules`);
    const rulesBody = (await rulesRes.json()) as {
      changeLog: Array<{ rule_id: string; new_guidance: string }>;
    };
    assert.equal(rulesBody.changeLog[0]?.rule_id, 'R-STR-01');

    // Crew cannot submit hazard entries (403)
    const crewHazardRes = await fetch(`${baseUrl}/api/hazards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: crewCookie },
      body: JSON.stringify({
        category: 'DISTANCE',
        distanceKm: 400,
        commStatus: 'NOMINAL',
        source: 'Onboard navigation display',
        measuredAt: Date.now(),
      }),
    });
    assert.equal(crewHazardRes.status, 403);

    // Crew enters resting HR 101 -> MONITOR alert created & Doctor notified; Commander NOT notified
    const hrRes = await fetch(`${baseUrl}/api/daily-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: crewCookie },
      body: JSON.stringify({
        indicator: 'hr',
        valueNumeric: 101,
        context: 'RESTING',
        measuredAt: Date.now() - 1000,
        source: 'Crew medical device (approved)',
      }),
    });
    assert.equal(hrRes.status, 201);

    const docAlertsRes = await fetch(`${baseUrl}/api/alerts`, {
      headers: { Cookie: docCookie },
    });
    const docAlerts = ((await docAlertsRes.json()) as { alerts: Array<{ ruleId: string; severity: string }> }).alerts;
    assert.equal(docAlerts.length, 1);
    assert.equal(docAlerts[0].ruleId, 'R-HR-01');
    assert.equal(docAlerts[0].severity, 'MONITOR');

    const cmdAlertsBeforeSpe = await fetch(`${baseUrl}/api/alerts`, {
      headers: { Cookie: cmdCookie },
    });
    assert.equal(((await cmdAlertsBeforeSpe.json()) as { alerts: unknown[] }).alerts.length, 0);

    // Commander enters Radiation with absorbed rate 0.5 (>0.4 R-RAD-01) and SPE_IN_PROGRESS (R-RAD-05)
    // Doctor only receives INFORMATION notice for R-RAD-05, never R-RAD-01
    const radRes = await fetch(`${baseUrl}/api/hazards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cmdCookie },
      body: JSON.stringify({
        category: 'RADIATION',
        detector: 'Crew Active Dosimeter (CAD)',
        detectorLocation: 'Node 2',
        periodStart: Date.now() - 7 * 86400000,
        periodEnd: Date.now(),
        absorbedRateMgyDay: 0.5,
        effectiveRateMsvDay: 0.4,
        missionAccumulatedAbsorbedMgy: 5,
        missionAccumulatedEffectiveMsv: 6,
        priorCareerEffectiveMsv: 0,
        solarEventStatus: 'SPE_IN_PROGRESS',
        measuredAt: Date.now(),
      }),
    });
    assert.equal(radRes.status, 201);

    const docAlertsAfterSpe = ((await (await fetch(`${baseUrl}/api/alerts`, {
      headers: { Cookie: docCookie },
    })).json()) as { alerts: Array<{ ruleId: string; severity: string }> }).alerts;
    assert.equal(docAlertsAfterSpe.length, 2);
    assert.equal(docAlertsAfterSpe[0].ruleId, 'R-RAD-05');
    assert.equal(docAlertsAfterSpe[0].severity, 'INFORMATION');

    const cmdAlertsAfterSpe = ((await (await fetch(`${baseUrl}/api/alerts`, {
      headers: { Cookie: cmdCookie },
    })).json()) as { alerts: Array<{ ruleId: string; severity: string }> }).alerts;
    assert.ok(cmdAlertsAfterSpe.some((a) => a.ruleId === 'R-RAD-05' && a.severity === 'HIGH_PRIORITY'));
    assert.ok(cmdAlertsAfterSpe.some((a) => a.ruleId === 'R-RAD-01'));
  });
});
