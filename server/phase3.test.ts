import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { createApiApp } from './app.ts';
import { AstraRepository } from './db.ts';
import { formatNonClinicalNumber, translateText } from '../src/i18n/index.tsx';

function flattenLeaves(obj: Record<string, unknown>, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out.set(full, v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of flattenLeaves(v as Record<string, unknown>, full)) {
        out.set(ck, cv);
      }
    }
  }
  return out;
}

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

test('EN and AR locale dictionaries and review-status.json match completely and preserve clinical tokens', () => {
  const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'locales/en.json'), 'utf8'));
  const ar = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'locales/ar.json'), 'utf8'));
  const review = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'locales/review-status.json'), 'utf8')
  ) as Record<string, { reviewed: boolean }>;

  const enLeaves = flattenLeaves(en);
  const arLeaves = flattenLeaves(ar);

  assert.equal(enLeaves.size, arLeaves.size, 'EN and AR leaf counts must match');
  for (const [k, enVal] of enLeaves.entries()) {
    const arVal = arLeaves.get(k);
    assert.ok(arVal && arVal.trim().length > 0, `Missing/empty Arabic key: ${k}`);
    assert.ok(
      review[k] && typeof review[k].reviewed === 'boolean',
      `Missing review-status entry: ${k}`
    );

    for (const token of ['ASTRA', 'NASA', 'mmHg', 'bpm', 'mGy', 'mSv', 'kPa']) {
      if (enVal.includes(token)) {
        assert.ok(
          arVal.includes(token),
          `Protected token "${token}" missing in Arabic key ${k}`
        );
      }
    }
  }
});

test('server-stored alert keys resolve in each viewer language and preserve verbatim Doctor/Crew text', async () => {
  await withTestServer(async (baseUrl) => {
    // 1. Register Commander and create mission
    const cmdReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cmdr. Nadia',
        email: 'cmdr.i18n@astra.test',
        password: 'Password123!',
        role: 'COMMANDER',
      }),
    });
    assert.equal(cmdReg.status, 201);
    const cmdCookie = extractCookie(cmdReg);

    const missionRes = await fetch(`${baseUrl}/api/mission/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cmdCookie },
      body: JSON.stringify({
        name: 'I18n Orbital Test',
        startDateUtc: new Date().toISOString().slice(0, 10),
        plannedDays: 30,
        templateId: 'leo_iss',
        weeklyHazardWeekday: 0,
      }),
    });
    assert.equal(missionRes.status, 201);
    const { mission } = (await missionRes.json()) as {
      mission: { inviteCode: string };
    };

    // 2. Register Doctor & Crew in the same mission
    const docReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Omar',
        email: 'doc.i18n@astra.test',
        password: 'Password123!',
        role: 'DOCTOR',
        inviteCode: mission.inviteCode,
      }),
    });
    assert.equal(docReg.status, 201);
    const docCookie = extractCookie(docReg);

    const crewReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Crew Tariq',
        email: 'crew.i18n@astra.test',
        password: 'Password123!',
        role: 'CREW',
        inviteCode: mission.inviteCode,
      }),
    });
    assert.equal(crewReg.status, 201);
    const crewCookie = extractCookie(crewReg);

    // 3. Doctor edits R-STR-01 (PROTOTYPE_DEFAULT) custom guidance verbatim
    const customGuidance = 'Call Flight Surgeon channel 2 after 5 min rest.';
    const patchRule = await fetch(`${baseUrl}/api/rules/R-STR-01`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: docCookie },
      body: JSON.stringify({
        customGuidance,
      }),
    });
    assert.equal(patchRule.status, 200);

    // 4. Crew submits HR = 101 RESTING -> fires R-HR-01 alert, plus Stress = 75 -> fires R-STR-01 with customGuidance
    const hrRes = await fetch(`${baseUrl}/api/daily-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: crewCookie },
      body: JSON.stringify({
        indicator: 'hr',
        valueNumeric: 101,
        context: 'RESTING',
        measuredAt: Date.now() - 1000,
        source: 'Wearable',
        provenance: 'Manual entry',
      }),
    });
    assert.equal(hrRes.status, 201);

    const strRes = await fetch(`${baseUrl}/api/daily-readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: crewCookie },
      body: JSON.stringify({
        indicator: 'stress',
        valueNumeric: 75,
        measuredAt: Date.now() - 500,
        source: 'Self-report scale, prototype instrument v1',
        provenance: 'Self-reported',
      }),
    });
    assert.equal(strRes.status, 201);

    // 5. Doctor fetches alerts -> same alert record resolves to English and Arabic, keeping customGuidance verbatim
    const docAlertsRes = await fetch(`${baseUrl}/api/alerts`, {
      headers: { Cookie: docCookie },
    });
    assert.equal(docAlertsRes.status, 200);
    const { alerts: docAlerts } = (await docAlertsRes.json()) as {
      alerts: Array<{
        ruleId: string;
        titleKey: string;
        nextStepKey: string;
        customGuidance: string | null;
        params: Record<string, unknown>;
      }>;
    };
    const hrAlert = docAlerts.find((a) => a.ruleId === 'R-HR-01');
    assert.ok(hrAlert, 'Expected R-HR-01 alert');
    const strAlert = docAlerts.find((a) => a.ruleId === 'R-STR-01');
    assert.ok(strAlert, 'Expected R-STR-01 alert');
    assert.equal(strAlert.customGuidance, customGuidance);

    const enTitle = translateText('en', hrAlert.titleKey, hrAlert.params);
    const arTitle = translateText('ar', hrAlert.titleKey, hrAlert.params);
    assert.ok(enTitle.includes('101 bpm') && enTitle.includes('Resting heart rate'));
    assert.ok(arTitle.includes('101 bpm') && arTitle.includes('معدل ضربات القلب'));

    // 6. Crew submits a problem report -> verbatim text preserved
    const rawReport = 'Wrist cuff Velcro strap is frayed.';
    const repRes = await fetch(`${baseUrl}/api/problem-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: crewCookie },
      body: JSON.stringify({
        description: rawReport,
        urgent: true,
        measuredAt: Date.now(),
      }),
    });
    assert.equal(repRes.status, 201);

    const { alerts: docAlerts2 } = (await (
      await fetch(`${baseUrl}/api/alerts`, { headers: { Cookie: docCookie } })
    ).json()) as {
      alerts: Array<{
        ruleId: string;
        measurementText: string | null;
        titleKey: string;
        params: Record<string, unknown>;
      }>;
    };
    const repAlert = docAlerts2.find((a) => a.ruleId === 'R-REP-01');
    assert.ok(repAlert);
    assert.equal(repAlert.measurementText, rawReport);
    assert.equal(repAlert.params.reportText, rawReport);
    assert.ok(translateText('ar', repAlert.titleKey, repAlert.params).includes('عاجل'));
  });
});

test('non-clinical numeral formatting toggles cleanly between Western and Arabic-Indic', () => {
  assert.equal(formatNonClinicalNumber('en', 'western', 14), '14');
  assert.equal(formatNonClinicalNumber('ar', 'western', 14), '14');
  assert.equal(formatNonClinicalNumber('ar', 'arabic_indic', 14), '١٤');
});
