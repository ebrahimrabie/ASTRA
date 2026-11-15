import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from './app.ts';
import { AstraRepository } from './db.ts';
import { computeCo2Stats, FixedWindowRateLimiter } from './domain.ts';

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

test('task lifecycle: create, complete, defer and history entries', async () => {
  await withTestServer(async (baseUrl) => {
    const userA = crypto.randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      'X-Demo-User': userA,
    };

    const createRes1 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: '  Hydration check  ', due: '14:30' }),
    });
    assert.equal(createRes1.status, 201);
    const created1 = (await createRes1.json()) as {
      task: { id: string; name: string; due: string; status: string };
    };
    assert.equal(created1.task.name, 'Hydration check');
    assert.equal(created1.task.due, '14:30');
    assert.equal(created1.task.status, 'PENDING');

    const completeRes = await fetch(
      `${baseUrl}/api/tasks/${created1.task.id}/complete`,
      { method: 'PATCH', headers }
    );
    assert.equal(completeRes.status, 200);
    const completed = (await completeRes.json()) as {
      task: { status: string };
    };
    assert.equal(completed.task.status, 'COMPLETED');

    const createRes2 = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Cabin filter check', due: '16:00' }),
    });
    assert.equal(createRes2.status, 201);
    const created2 = (await createRes2.json()) as {
      task: { id: string; name: string };
    };

    const deferRes = await fetch(
      `${baseUrl}/api/tasks/${created2.task.id}/defer`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reason: 'Awaiting EVA clearance' }),
      }
    );
    assert.equal(deferRes.status, 200);
    const deferred = (await deferRes.json()) as {
      task: { status: string; deferReason: string };
    };
    assert.equal(deferred.task.status, 'DEFERRED');
    assert.equal(deferred.task.deferReason, 'Awaiting EVA clearance');

    const historyRes = await fetch(`${baseUrl}/api/history?limit=100`, {
      headers,
    });
    assert.equal(historyRes.status, 200);
    const historyBody = (await historyRes.json()) as {
      history: Array<{ text: string }>;
    };
    assert.equal(historyBody.history.length, 4);
    assert.equal(
      historyBody.history[0].text,
      'Deferred: Cabin filter check (reason: Awaiting EVA clearance)'
    );
    assert.equal(historyBody.history[1].text, 'Created: Cabin filter check');
    assert.equal(historyBody.history[2].text, 'Completed: Hydration check');
    assert.equal(historyBody.history[3].text, 'Created: Hydration check');
  });
});

test('returns 409 on double complete and invalid state transitions', async () => {
  await withTestServer(async (baseUrl) => {
    const userId = crypto.randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      'X-Demo-User': userId,
    };

    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Dosimeter log', due: '09:00' }),
    });
    assert.equal(createRes.status, 201);
    const { task } = (await createRes.json()) as { task: { id: string } };

    const firstComplete = await fetch(
      `${baseUrl}/api/tasks/${task.id}/complete`,
      { method: 'PATCH', headers }
    );
    assert.equal(firstComplete.status, 200);

    const secondComplete = await fetch(
      `${baseUrl}/api/tasks/${task.id}/complete`,
      { method: 'PATCH', headers }
    );
    assert.equal(secondComplete.status, 409);
    const conflictBody = (await secondComplete.json()) as { error: string };
    assert.match(conflictBody.error, /COMPLETED/);

    const deferAfterComplete = await fetch(
      `${baseUrl}/api/tasks/${task.id}/defer`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reason: 'Too late' }),
      }
    );
    assert.equal(deferAfterComplete.status, 409);
  });
});

test('enforces strict user isolation and rejects missing/invalid X-Demo-User UUIDs', async () => {
  await withTestServer(async (baseUrl) => {
    const noHeaderRes = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(noHeaderRes.status, 401);

    const badUuidRes = await fetch(`${baseUrl}/api/tasks`, {
      headers: { 'X-Demo-User': 'not-a-uuid' },
    });
    assert.equal(badUuidRes.status, 401);

    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Demo-User': userA,
      },
      body: JSON.stringify({ name: 'User A Task', due: '11:00' }),
    });
    assert.equal(createRes.status, 201);
    const { task } = (await createRes.json()) as { task: { id: string } };

    const listB = await fetch(`${baseUrl}/api/tasks`, {
      headers: { 'X-Demo-User': userB },
    });
    assert.equal(listB.status, 200);
    const bodyB = (await listB.json()) as { tasks: unknown[] };
    assert.equal(bodyB.tasks.length, 0);

    const completeByB = await fetch(
      `${baseUrl}/api/tasks/${task.id}/complete`,
      {
        method: 'PATCH',
        headers: { 'X-Demo-User': userB },
      }
    );
    assert.equal(completeByB.status, 404);
  });
});

test('CO2 sample mean and coverage calculation behaves accurately', async () => {
  await withTestServer(async (baseUrl, repo) => {
    const userId = crypto.randomUUID();
    const envRes = await fetch(`${baseUrl}/api/risks/env`, {
      headers: { 'X-Demo-User': userId },
    });
    assert.equal(envRes.status, 200);
    const body = (await envRes.json()) as {
      samples: Array<{ value: number }>;
      latest: { value: number };
      sampleMean: number;
      coverageMinutes: number;
      verifiedHourAverage: number | null;
      status: string;
    };

    assert.equal(body.samples.length, 4);
    assert.equal(body.latest.value, 3.3);
    assert.equal(body.sampleMean, 3.075);
    assert.equal(body.coverageMinutes, 45);
    assert.equal(body.verifiedHourAverage, null);
    assert.equal(body.status, 'INSUFFICIENT DATA');

    repo.insertEnvSample(userId, {
      parameter: 'CO2',
      value: 3.1,
      unit: 'mmHg',
      sampledAt: Date.UTC(2026, 0, 1, 10, 0, 0, 0),
    });
    const updated = repo.getEnvStats(userId);
    assert.equal(updated.coverageMinutes, 60);
    assert.equal(updated.sampleMean, 3.08);
    assert.equal(updated.verifiedHourAverage, 3.08);
    assert.equal(updated.status, 'MONITOR');
  });

  const emptyStats = computeCo2Stats([]);
  assert.equal(emptyStats.sampleMean, null);
  assert.equal(emptyStats.coverageMinutes, 0);
  assert.equal(emptyStats.verifiedHourAverage, null);
});

test('rate limiter allows 100 requests per minute and blocks 101st', () => {
  const limiter = new FixedWindowRateLimiter(100, 60_000);
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 100; i += 1) {
    assert.equal(limiter.consume('127.0.0.1', t0).allowed, true);
  }
  const blocked = limiter.consume('127.0.0.1', t0 + 1000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);

  const afterWindow = limiter.consume('127.0.0.1', t0 + 60_001);
  assert.equal(afterWindow.allowed, true);
});
