import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from './app.ts';
import { AstraRepository } from './db.ts';
import {
  compositeOver,
  contrastRatio,
  contrastRatioRgb,
  parseHexColor,
  THEME_PALETTES,
} from '../src/utils/contrast.ts';

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

test('automated WCAG contrast checks pass for Dark and Light theme palettes', () => {
  for (const [themeName, palette] of Object.entries(THEME_PALETTES)) {
    const surfaces = [palette.bg, palette.bg2, palette.card, palette.elevated];

    // Primary and secondary body text must meet >= 4.5:1 on every surface
    for (const surface of surfaces) {
      const rPrimary = contrastRatio(palette.text, surface);
      const rSecondary = contrastRatio(palette.text2, surface);
      assert.ok(
        rPrimary >= 4.5,
        `${themeName}: --text (${palette.text}) on ${surface} = ${rPrimary} < 4.5`
      );
      assert.ok(
        rSecondary >= 4.5,
        `${themeName}: --text2 (${palette.text2}) on ${surface} = ${rSecondary} < 4.5`
      );
    }

    // Accent, semantic colors, and card typography on --card and --bg
    for (const fg of [palette.accent, palette.warning, palette.high, palette.ok, palette.purple]) {
      const ratioCard = contrastRatio(fg, palette.card);
      const ratioBg = contrastRatio(fg, palette.bg);
      assert.ok(
        ratioCard >= 4.5,
        `${themeName}: semantic ${fg} on card (${palette.card}) = ${ratioCard} < 4.5`
      );
      assert.ok(
        ratioBg >= 4.5,
        `${themeName}: semantic ${fg} on bg (${palette.bg}) = ${ratioBg} < 4.5`
      );
    }

    // Primary button foreground/background contrast >= 4.5:1
    const btnContrast = contrastRatio(palette.primaryBtnText, palette.accent);
    assert.ok(
      btnContrast >= 4.5,
      `${themeName}: primary button text contrast = ${btnContrast} < 4.5`
    );

    // Interactive UI borders >= 3.0:1 against card background
    const uiBorderContrast = contrastRatio(palette.borderUi, palette.card);
    assert.ok(
      uiBorderContrast >= 3.0,
      `${themeName}: --border-ui (${palette.borderUi}) on card = ${uiBorderContrast} < 3.0`
    );

    // Badge text/background and badge border/card contrast checks
    const cardRgb = parseHexColor(palette.card);
    for (const [tone, badge] of Object.entries(palette.badges)) {
      const tintBg = compositeOver(parseHexColor(badge.tintHex), badge.tintAlpha, cardRgb);
      const badgeTextRatio = contrastRatioRgb(parseHexColor(badge.text), tintBg);
      const badgeBorderRatio = contrastRatio(badge.border, palette.card);
      assert.ok(
        badgeTextRatio >= 4.5,
        `${themeName}: badge ${tone} text ratio = ${badgeTextRatio} < 4.5`
      );
      assert.ok(
        badgeBorderRatio >= 3.0,
        `${themeName}: badge ${tone} border ratio = ${badgeBorderRatio} < 3.0`
      );
    }
  }
});

test('settings preferences persist server-side, logout & logout-all invalidate sessions with SESSION_EXPIRED', async () => {
  await withTestServer(async (baseUrl) => {
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Crew Aria',
        email: 'aria@astra.test',
        password: 'InitialPassword1!',
        role: 'CREW',
      }),
    });
    assert.equal(reg.status, 201);
    const cookieDeviceA = extractCookie(reg);

    // Login from a second device to get an independent cookie
    const loginB = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'aria@astra.test',
        password: 'InitialPassword1!',
      }),
    });
    assert.equal(loginB.status, 200);
    const cookieDeviceB = extractCookie(loginB);

    // Save preferences from Device A
    const putPrefs = await fetch(`${baseUrl}/api/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieDeviceA },
      body: JSON.stringify({
        theme: 'light',
        language: 'ar',
        numerals: 'arabic_indic',
        notifications: {
          inAppMonitor: true,
          inAppReview: true,
          inAppHighPriority: true,
          browserNotifications: false,
          dailyReminderTime: '07:30',
          quietHoursEnabled: true,
          quietStart: '22:00',
          quietEnd: '05:30',
        },
        units: {
          temperature: 'F',
          pressure: 'psia',
          distance: 'mi',
        },
      }),
    });
    assert.equal(putPrefs.status, 200);

    // Verify Device B reads persisted server preferences
    const meB = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieDeviceB },
    });
    assert.equal(meB.status, 200);
    const meBJson = (await meB.json()) as {
      preferences: { theme: string; language: string; units: { temperature: string; distance: string } };
    };
    assert.equal(meBJson.preferences.theme, 'light');
    assert.equal(meBJson.preferences.language, 'ar');
    assert.equal(meBJson.preferences.units.temperature, 'F');
    assert.equal(meBJson.preferences.units.distance, 'mi');

    // Invalid preferences rejected by Zod
    const badPrefs = await fetch(`${baseUrl}/api/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieDeviceA },
      body: JSON.stringify({ theme: 'neon' }),
    });
    assert.equal(badPrefs.status, 400);

    // Sign out of all devices requires password re-entry
    const wrongPwLogoutAll = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieDeviceA },
      body: JSON.stringify({ password: 'WrongPassword!' }),
    });
    assert.equal(wrongPwLogoutAll.status, 401);

    const logoutAllOk = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieDeviceA },
      body: JSON.stringify({ password: 'InitialPassword1!' }),
    });
    assert.equal(logoutAllOk.status, 200);

    // Both Device A and Device B cookies are now invalid with 401 SESSION_EXPIRED
    const checkA = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieDeviceA },
    });
    assert.equal(checkA.status, 401);
    assert.equal(((await checkA.json()) as { code: string }).code, 'SESSION_EXPIRED');

    const checkB = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieDeviceB },
    });
    assert.equal(checkB.status, 401);
    assert.equal(((await checkB.json()) as { code: string }).code, 'SESSION_EXPIRED');

    // Logout clears cookie
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
    const setCookie = logoutRes.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.includes('astra_session=;'));
  });
});
