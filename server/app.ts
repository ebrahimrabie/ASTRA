import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  AstraRepository,
  ConflictError,
  ForbiddenError,
  type AlertRecord,
  type UserAccount,
} from './db.ts';
import {
  createExportSchema,
  createTaskSchema,
  dailyReadingSchema,
  deferTaskSchema,
  demoLoadScenarioSchema,
  distanceHazardSchema,
  environmentHazardSchema,
  FixedWindowRateLimiter,
  gravityHazardSchema,
  isolationHazardSchema,
  isValidUuid,
  loginSchema,
  missionSetupSchema,
  preferencesSchema,
  problemReportSchema,
  radiationHazardSchema,
  registerSchema,
  updateRuleSchema,
  validateMeasuredAtTimestamp,
  type UserRole,
} from './domain.ts';
import {
  estimateExportRowCount,
  formatExportFilename,
  serializeExportBundle,
} from './exports.ts';
import { EDUCATION_CARDS_SEED } from './kb.ts';
import { applyDemoScenario, DEMO_SCENARIOS } from './seedDemo.ts';

interface ScopedRequest extends Request {
  demoUserId?: string;
  authUser?: UserAccount;
}

interface SessionJwtPayload {
  sub: string;
  role: UserRole;
  tv: number;
}

interface SseClient {
  id: string;
  userId: string;
  role: UserRole;
  missionId: string | null;
  res: Response;
}

const SESSION_COOKIE_NAME = 'astra_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours max JWT lifetime; idle timeout also enforced client-side

function getJwtSecret(): string {
  return process.env.SESSION_SECRET || 'astra-prototype-dev-session-secret-key';
}

export function createApiApp(repo: AstraRepository): express.Express {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const sseClients = new Map<string, SseClient>();

  if (!isProd) {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (
            !origin ||
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
          ) {
            callback(null, true);
            return;
          }
          callback(null, false);
        },
        credentials: true,
        allowedHeaders: ['Content-Type', 'X-Demo-User'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      })
    );
  }

  app.use(cookieParser());
  app.use(express.json({ limit: '512kb' }));

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err) {
      res.status(400).json({
        error: 'Invalid JSON request body.',
        code: 'INVALID_JSON',
      });
      return;
    }
    next(err);
  });

  const rateLimiter = new FixedWindowRateLimiter(100, 60_000);
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = rateLimiter.consume(ip);
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded. Maximum 100 requests per minute.',
        code: 'RATE_LIMITED',
      });
      return;
    }
    next();
  });

  const signSessionCookie = (res: Response, user: UserAccount) => {
    const payload: SessionJwtPayload = {
      sub: user.id,
      role: user.role,
      tv: user.tokenVersion,
    };
    const token = jwt.sign(payload, getJwtSecret(), {
      expiresIn: SESSION_TTL_SECONDS,
    });
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd && process.env.HTTPS_COOKIES === 'true',
      path: '/',
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  };

  const resolveAuthUserFromCookie = (req: Request): UserAccount | null => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token || typeof token !== 'string') return null;
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as SessionJwtPayload;
      if (!decoded?.sub) return null;
      const user = repo.findUserById(decoded.sub);
      if (!user) return null;
      if (user.tokenVersion !== decoded.tv) return null;
      return user;
    } catch {
      return null;
    }
  };

  const requireAuth = (
    req: ScopedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const user = resolveAuthUserFromCookie(req);
    if (!user) {
      res.status(401).json({
        error: 'Your session has expired. Please sign in again.',
        code: 'SESSION_EXPIRED',
      });
      return;
    }
    req.authUser = user;
    next();
  };

  const requireDemoOrAuth = (
    req: ScopedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const authUser = resolveAuthUserFromCookie(req);
    if (authUser) {
      req.authUser = authUser;
      req.demoUserId = authUser.id;
      next();
      return;
    }
    const headerVal = req.header('X-Demo-User');
    if (!isValidUuid(headerVal)) {
      res.status(401).json({
        error: 'Valid X-Demo-User UUID header is required.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }
    req.demoUserId = headerVal.trim().toLowerCase();
    next();
  };

  const broadcastAlerts = (alerts: AlertRecord[]) => {
    for (const alert of alerts) {
      for (const client of sseClients.values()) {
        if (client.missionId !== alert.missionId) continue;
        if (client.role !== alert.targetRole) continue;
        if (
          alert.targetRole === 'CREW' &&
          alert.subjectUserId &&
          client.userId !== alert.subjectUserId
        ) {
          continue;
        }
        try {
          client.res.write(`event: alert\n`);
          client.res.write(`data: ${JSON.stringify(alert)}\n\n`);
        } catch {
          // Client disconnected
        }
      }
    }
  };

  // ===== Health check =====
  app.get('/api/health-check', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ===== Knowledge Base (public/read-only reference endpoints) =====
  app.get('/api/templates', (_req: Request, res: Response) => {
    res.json({ templates: repo.listMissionTemplates() });
  });

  app.get('/api/protocols', (_req: Request, res: Response) => {
    res.json({ protocols: repo.listProtocols() });
  });

  app.get('/api/protocols/:id', (req: Request, res: Response) => {
    const protocol = repo.getProtocolById(req.params.id);
    if (!protocol) {
      res.status(404).json({ error: 'Protocol not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ protocol });
  });

  app.get('/api/instruments', (req: Request, res: Response) => {
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    res.json({ instruments: repo.listInstruments(category) });
  });

  app.get('/api/sources', (req: ScopedRequest, res: Response) => {
    const user = resolveAuthUserFromCookie(req);
    const mission = user ? repo.getUserMission(user.id) : null;
    const data = repo.getDataSourcesOverview(mission?.id);
    res.json(data);
  });

  app.get('/api/rules', (_req: Request, res: Response) => {
    res.json({
      rules: repo.listRules(),
      changeLog: repo.listRuleChangeLog(),
    });
  });

  app.get('/api/education/:key', (req: Request, res: Response) => {
    const card = repo.getEducationCard(req.params.key);
    if (!card) {
      res.status(404).json({ error: 'Education card not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ card });
  });

  // ===== Auth Endpoints =====
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue?.message || 'Invalid registration data.',
        code: 'VALIDATION_ERROR',
        field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
      });
      return;
    }

    const { name, email, password, role, inviteCode } = parsed.data;
    try {
      let targetInviteCode: string | null = null;
      if (inviteCode && inviteCode.trim()) {
        const found = repo.db
          .prepare(`SELECT id FROM missions WHERE UPPER(invite_code) = UPPER(?)`)
          .get(inviteCode.trim());
        if (!found) {
          res.status(404).json({
            error: 'No mission found with this invite code.',
            code: 'MISSION_NOT_FOUND',
            field: 'inviteCode',
          });
          return;
        }
        targetInviteCode = inviteCode.trim();
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = repo.createUser({ name, email, passwordHash, role });

      const mission = targetInviteCode
        ? repo.joinMissionByInvite(user.id, user.role, targetInviteCode)
        : null;

      signSessionCookie(res, user);
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        mission,
        preferences: repo.getPreferences(user.id),
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        res.status(409).json({
          error: err.message,
          code: 'EMAIL_EXISTS',
          field: 'email',
        });
        return;
      }
      throw err;
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      res.status(400).json({
        error: issue?.message || 'Invalid credentials.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const user = repo.findUserByEmail(parsed.data.email);
    if (!user) {
      res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }
    const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({
        error: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    signSessionCookie(res, user);
    const mission = repo.getUserMission(user.id);
    const derived = mission ? repo.getMissionDerived(mission) : null;
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      mission,
      derived,
      preferences: repo.getPreferences(user.id),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);
    const derived = mission ? repo.getMissionDerived(mission) : null;
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      mission,
      derived,
      preferences: repo.getPreferences(user.id),
    });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.post(
    '/api/auth/logout-all',
    requireAuth,
    async (req: ScopedRequest, res: Response) => {
      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password) {
        res.status(400).json({
          error: 'Password re-entry is required to sign out of all devices.',
          code: 'PASSWORD_REQUIRED',
          field: 'password',
        });
        return;
      }
      const user = req.authUser!;
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          error: 'Incorrect password.',
          code: 'INVALID_CREDENTIALS',
          field: 'password',
        });
        return;
      }
      repo.incrementTokenVersion(user.id);
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/auth/change-password',
    requireAuth,
    async (req: ScopedRequest, res: Response) => {
      const currentPassword =
        typeof req.body?.currentPassword === 'string'
          ? req.body.currentPassword
          : '';
      const newPassword =
        typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      if (!currentPassword || newPassword.length < 8) {
        res.status(400).json({
          error: 'Current password and new password (min 8 characters) are required.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const user = req.authUser!;
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          error: 'Current password is incorrect.',
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      repo.updateUserPassword(user.id, newHash);
      res.json({ ok: true });
    }
  );

  // ===== Mission Endpoints =====
  app.post(
    '/api/mission/setup',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      if (user.role !== 'COMMANDER') {
        res.status(403).json({
          error: 'Only a Commander can create and configure a mission.',
          code: 'ROLE_FORBIDDEN',
        });
        return;
      }
      const parsed = missionSetupSchema.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        res.status(400).json({
          error: issue?.message || 'Invalid mission configuration.',
          code: 'VALIDATION_ERROR',
          field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
        });
        return;
      }
      const mission = repo.createMission(user.id, parsed.data);
      const derived = repo.getMissionDerived(mission);
      res.status(201).json({ mission, derived });
    }
  );

  app.post(
    '/api/mission/join',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const inviteCode =
        typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim() : '';
      if (!inviteCode) {
        res.status(400).json({
          error: 'Mission invite code is required.',
          code: 'VALIDATION_ERROR',
          field: 'inviteCode',
        });
        return;
      }
      const user = req.authUser!;
      const mission = repo.joinMissionByInvite(user.id, user.role, inviteCode);
      if (!mission) {
        res.status(404).json({
          error: 'No mission found with this invite code.',
          code: 'MISSION_NOT_FOUND',
          field: 'inviteCode',
        });
        return;
      }
      const derived = repo.getMissionDerived(mission);
      res.json({ mission, derived });
    }
  );

  app.get('/api/mission', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);
    if (!mission) {
      res.json({ mission: null, derived: null });
      return;
    }
    const derived = repo.getMissionDerived(mission);
    res.json({ mission, derived });
  });

  app.get(
    '/api/mission/derived',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(404).json({
          error: 'No mission configured for this user.',
          code: 'MISSION_NOT_FOUND',
        });
        return;
      }
      res.json({ derived: repo.getMissionDerived(mission) });
    }
  );

  app.get(
    '/api/mission/roster',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      if (user.role === 'CREW') {
        res.status(403).json({
          error: 'Crew members cannot view full mission roster.',
          code: 'ROLE_FORBIDDEN',
        });
        return;
      }
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.json({ roster: [] });
        return;
      }
      res.json({ roster: repo.getMissionRoster(mission.id) });
    }
  );

  // ===== Rules Editing (Doctor + PROTOTYPE_DEFAULT only) =====
  app.patch(
    '/api/rules/:id',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const parsed = updateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid rule update payload.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const mission = repo.getUserMission(user.id);
      try {
        const updated = repo.updatePrototypeDefaultRule(
          req.params.id,
          user,
          mission?.id ?? null,
          parsed.data
        );
        if (!updated) {
          res.status(404).json({ error: 'Rule not found.', code: 'NOT_FOUND' });
          return;
        }
        res.json({ rule: updated });
      } catch (err) {
        if (err instanceof ForbiddenError) {
          res.status(403).json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    }
  );

  // ===== Daily Readings (Crew / Doctor / Privacy-Scoped) =====
  app.post(
    '/api/daily-readings',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(400).json({
          error: 'Join or configure a mission before entering daily readings.',
          code: 'MISSION_REQUIRED',
        });
        return;
      }

      const parsed = dailyReadingSchema.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        res.status(400).json({
          error: issue?.message || 'Invalid daily reading payload.',
          code: 'VALIDATION_ERROR',
          field: issue?.path?.[0] ? String(issue.path[0]) : undefined,
        });
        return;
      }

      const tsCheck = validateMeasuredAtTimestamp(
        parsed.data.measuredAt,
        parsed.data.lateEntryNote
      );
      if (!tsCheck.ok) {
        res.status(400).json({
          error: tsCheck.error,
          code: tsCheck.code,
          field: 'measuredAt',
        });
        return;
      }

      if (
        parsed.data.indicator === 'bp' &&
        (parsed.data.systolic == null || parsed.data.diastolic == null)
      ) {
        res.status(400).json({
          error: 'Systolic and diastolic values are required for Blood Pressure.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      if (parsed.data.indicator !== 'bp' && parsed.data.valueNumeric == null) {
        res.status(400).json({
          error: 'Measurement value is required.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const result = repo.recordDailyReading(mission.id, user, {
        ...parsed.data,
        dataQuality: tsCheck.quality,
      });

      if (result.alerts.length > 0) {
        broadcastAlerts(result.alerts);
      }

      res.status(result.deduplicated ? 200 : 201).json(result);
    }
  );

  app.get(
    '/api/daily-readings',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.json({ readings: [] });
        return;
      }
      const subjectUserId =
        typeof req.query.subjectUserId === 'string'
          ? req.query.subjectUserId
          : undefined;
      const indicator =
        typeof req.query.indicator === 'string' ? req.query.indicator : undefined;
      const readings = repo.listDailyReadings(mission.id, user, {
        subjectUserId,
        indicator,
      });
      res.json({ readings });
    }
  );

  // ===== Hazards (Commander only) =====
  app.post(
    '/api/hazards',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      if (user.role !== 'COMMANDER') {
        res.status(403).json({
          error: 'Only the Mission Commander can enter mission hazard records.',
          code: 'ROLE_FORBIDDEN',
        });
        return;
      }
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(400).json({
          error: 'Configure a mission before recording hazard entries.',
          code: 'MISSION_REQUIRED',
        });
        return;
      }

      const category = req.body?.category;
      let parsedPayload: Record<string, unknown> | null = null;
      let measuredAt = 0;
      let source = '';
      let deviceId: string | null | undefined = null;
      let lateEntryNote: string | null | undefined = null;
      let provenance: 'Self-reported' | 'Manual entry' | 'Offline-queued' =
        'Manual entry';

      if (category === 'RADIATION') {
        const parsed = radiationHazardSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message || 'Invalid radiation payload.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        parsedPayload = parsed.data;
        measuredAt = parsed.data.measuredAt;
        source = parsed.data.detector;
        deviceId = parsed.data.deviceId;
        lateEntryNote = parsed.data.lateEntryNote;
        provenance = parsed.data.provenance;
      } else if (category === 'ENVIRONMENT') {
        const parsed = environmentHazardSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message || 'Invalid environment payload.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        parsedPayload = parsed.data;
        measuredAt = parsed.data.measuredAt;
        source = parsed.data.source;
        deviceId = parsed.data.deviceId;
        lateEntryNote = parsed.data.lateEntryNote;
        provenance = parsed.data.provenance;
      } else if (category === 'GRAVITY') {
        const parsed = gravityHazardSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message || 'Invalid gravity payload.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        parsedPayload = parsed.data;
        measuredAt = parsed.data.measuredAt;
        source = parsed.data.source;
        lateEntryNote = parsed.data.lateEntryNote;
        provenance = parsed.data.provenance;
      } else if (category === 'ISOLATION') {
        const parsed = isolationHazardSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message || 'Invalid isolation payload.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        parsedPayload = parsed.data;
        measuredAt = parsed.data.measuredAt;
        source = parsed.data.source;
        lateEntryNote = parsed.data.lateEntryNote;
        provenance = parsed.data.provenance;
      } else if (category === 'DISTANCE') {
        const parsed = distanceHazardSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: parsed.error.issues[0]?.message || 'Invalid distance payload.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        parsedPayload = parsed.data;
        measuredAt = parsed.data.measuredAt;
        source = parsed.data.source;
        deviceId = parsed.data.deviceId;
        lateEntryNote = parsed.data.lateEntryNote;
        provenance = parsed.data.provenance;
      } else {
        res.status(400).json({
          error: 'Valid hazard category is required.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const tsCheck = validateMeasuredAtTimestamp(measuredAt, lateEntryNote);
      if (!tsCheck.ok) {
        res.status(400).json({
          error: tsCheck.error,
          code: tsCheck.code,
          field: 'measuredAt',
        });
        return;
      }

      const result = repo.recordHazardEntry(mission.id, user, {
        category,
        payload: parsedPayload,
        measuredAt,
        source,
        deviceId,
        lateEntryNote,
        provenance,
        dataQuality: tsCheck.quality,
        clientMutationId:
          typeof req.body?.clientMutationId === 'string'
            ? req.body.clientMutationId
            : null,
      });

      if (result.alerts.length > 0) {
        broadcastAlerts(result.alerts);
      }

      res.status(201).json(result);
    }
  );

  app.get('/api/hazards', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    if (user.role !== 'COMMANDER') {
      res.status(403).json({
        error: 'Only the Mission Commander can access hazard records.',
        code: 'ROLE_FORBIDDEN',
      });
      return;
    }
    const mission = repo.getUserMission(user.id);
    if (!mission) {
      res.json({ entries: [], aggregate: null });
      return;
    }
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const entries = repo.listHazardEntries(mission.id, user, category);
    const aggregate = repo.getCommanderAggregateStats(mission.id);
    res.json({ entries, aggregate });
  });

  // ===== Alerts, Problem Reports & Calendar =====
  app.get('/api/alerts', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);
    if (!mission) {
      res.json({ alerts: [] });
      return;
    }
    res.json({ alerts: repo.listAlerts(mission.id, user) });
  });

  app.post(
    '/api/alerts/:id/ack',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(404).json({ error: 'Mission not found.', code: 'NOT_FOUND' });
        return;
      }
      try {
        const alert = repo.acknowledgeAlert(mission.id, req.params.id, user);
        if (!alert) {
          res.status(404).json({ error: 'Alert not found.', code: 'NOT_FOUND' });
          return;
        }
        res.json({ alert });
      } catch (err) {
        if (err instanceof ForbiddenError) {
          res.status(403).json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    }
  );

  app.post(
    '/api/problem-reports',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(400).json({
          error: 'Join a mission before submitting a problem report.',
          code: 'MISSION_REQUIRED',
        });
        return;
      }
      const parsed = problemReportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid problem report.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const result = repo.createProblemReport(mission.id, user, parsed.data);
      broadcastAlerts([result.alert]);
      res.status(201).json(result);
    }
  );

  app.get(
    '/api/problem-reports',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.json({ reports: [] });
        return;
      }
      try {
        res.json({ reports: repo.listProblemReports(mission.id, user) });
      } catch (err) {
        if (err instanceof ForbiddenError) {
          res.status(403).json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    }
  );

  app.get('/api/calendar', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);
    if (!mission) {
      res.json({ tasks: [] });
      return;
    }
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    res.json({ tasks: repo.getCalendarTasks(mission.id, user, from, to) });
  });

  app.post('/api/sync', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const results: Array<{ clientMutationId: string; status: string; error?: string }> = [];

    if (mission) {
      for (const item of items) {
        const mutId =
          typeof item?.clientMutationId === 'string' ? item.clientMutationId : '';
        try {
          if (item?.kind === 'DAILY_READING') {
            const parsed = dailyReadingSchema.safeParse(item.payload);
            if (!parsed.success) {
              results.push({
                clientMutationId: mutId,
                status: 'FAILED',
                error: parsed.error.issues[0]?.message || 'Validation failed',
              });
              continue;
            }
            const tsCheck = validateMeasuredAtTimestamp(
              parsed.data.measuredAt,
              parsed.data.lateEntryNote
            );
            if (!tsCheck.ok) {
              results.push({
                clientMutationId: mutId,
                status: 'FAILED',
                error: tsCheck.error,
              });
              continue;
            }
            const out = repo.recordDailyReading(mission.id, user, {
              ...parsed.data,
              provenance: 'Offline-queued',
              dataQuality: tsCheck.quality,
              clientMutationId: mutId || parsed.data.clientMutationId,
            });
            if (out.alerts.length > 0) broadcastAlerts(out.alerts);
            results.push({
              clientMutationId: mutId,
              status: out.deduplicated ? 'DUPLICATE_OK' : 'SYNCED',
            });
          } else {
            results.push({
              clientMutationId: mutId,
              status: 'FAILED',
              error: 'Unsupported mutation kind',
            });
          }
        } catch (e) {
          results.push({
            clientMutationId: mutId,
            status: 'FAILED',
            error: e instanceof Error ? e.message : 'Sync failed',
          });
        }
      }
    }

    const lastSyncAt = mission ? repo.touchMissionSync(mission.id) : Date.now();
    res.json({ ok: true, lastSyncAt, results });
  });

  // ===== SSE Real-Time Alert Stream =====
  app.get('/api/events', requireAuth, (req: ScopedRequest, res: Response) => {
    const user = req.authUser!;
    const mission = repo.getUserMission(user.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sseClients.set(clientId, {
      id: clientId,
      userId: user.id,
      role: user.role,
      missionId: mission?.id ?? null,
      res,
    });

    res.write(`retry: 5000\n`);
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        // Closed
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  // ===== Preferences & Account Data Deletion (Phase 2 ready) =====
  app.get(
    '/api/preferences',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      res.json({ preferences: repo.getPreferences(req.authUser!.id) });
    }
  );

  app.put(
    '/api/preferences',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const parsed = preferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid preferences.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const saved = repo.savePreferences(req.authUser!.id, parsed.data);
      res.json({ preferences: saved });
    }
  );

  app.post(
    '/api/data/delete',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      if (req.body?.confirmation !== 'DELETE') {
        res.status(400).json({
          error: 'Type DELETE to confirm deleting your personal data.',
          code: 'CONFIRMATION_REQUIRED',
        });
        return;
      }
      repo.deleteUserData(req.authUser!.id);
      res.json({ ok: true });
    }
  );

  // ===== Achievements & Education Quizzes =====
  app.get(
    '/api/achievements',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      res.json(repo.getUserAchievementsSummary(user.id, mission));
    }
  );

  app.post(
    '/api/education/:key/answer',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const card = EDUCATION_CARDS_SEED.find((c) => c.key === req.params.key);
      if (!card) {
        res.status(404).json({ error: 'Education card not found.', code: 'NOT_FOUND' });
        return;
      }
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      if (answers.length !== card.questions.length) {
        res.status(400).json({
          error: 'All quiz questions must be answered.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }
      const feedback = card.questions.map((q, idx) => ({
        questionId: q.id,
        correct: answers[idx] === q.correctIndex,
        correctIndex: q.correctIndex,
        explanationKey: q.explanationKey,
      }));
      const allCorrect = feedback.every((f) => f.correct);
      if (allCorrect) {
        repo.awardAchievement(req.authUser!.id, card.key);
      }
      res.json({ passed: allCorrect, feedback });
    }
  );

  // ===== Phase 4: Reports, Exports & Demo Scenarios =====
  app.get(
    '/api/reports/summary',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission) {
        res.status(400).json({
          error: 'Join or configure a mission to generate reports.',
          code: 'MISSION_REQUIRED',
        });
        return;
      }
      const fromMs =
        typeof req.query.fromMs === 'string' && req.query.fromMs !== ''
          ? Number(req.query.fromMs)
          : undefined;
      const toMs =
        typeof req.query.toMs === 'string' && req.query.toMs !== ''
          ? Number(req.query.toMs)
          : undefined;
      const subjectUserId =
        typeof req.query.subjectUserId === 'string' && req.query.subjectUserId !== ''
          ? req.query.subjectUserId
          : undefined;

      res.json(
        repo.getReportSummary(mission, user, {
          fromMs: Number.isFinite(fromMs) ? fromMs : undefined,
          toMs: Number.isFinite(toMs) ? toMs : undefined,
          subjectUserId,
        })
      );
    }
  );

  app.post(
    '/api/exports',
    requireAuth,
    async (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const parsed = createExportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid export options.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const opts = parsed.data;
      const mission = repo.getUserMission(user.id);

      // Role scoping enforcement
      if (user.role === 'CREW') {
        if (
          opts.scope !== 'my' ||
          (opts.subjectUserId && opts.subjectUserId !== user.id) ||
          opts.include.includes('hazards') ||
          opts.include.includes('audit_log')
        ) {
          res.status(403).json({
            error: 'Crew members can only export their own health and task data.',
            code: 'ROLE_FORBIDDEN',
          });
          return;
        }
      } else if (user.role === 'DOCTOR') {
        if (opts.scope === 'mission' || opts.include.includes('hazards')) {
          res.status(403).json({
            error: 'Doctors cannot export mission-level hazard data.',
            code: 'ROLE_FORBIDDEN',
          });
          return;
        }
      } else if (user.role === 'COMMANDER') {
        if (opts.scope === 'crew_member' || opts.scope === 'entire_crew') {
          res.status(403).json({
            error: 'Commanders cannot export individual crew health records.',
            code: 'ROLE_FORBIDDEN',
          });
          return;
        }
      }

      const nowMs = Date.now();
      repo.cleanupExpiredExports(nowMs);
      const recentCount = repo.countRecentExports(user.id, nowMs - 3_600_000);
      if (recentCount >= 5) {
        res.status(429).json({
          error: 'Rate limit exceeded. Maximum 5 exports per hour per user.',
          code: 'RATE_LIMITED',
        });
        return;
      }

      const gathered = repo.gatherExportSources(user, mission, {
        scope: opts.scope,
        subjectUserId: opts.subjectUserId ?? null,
        fromMs: opts.fromMs,
        toMs: opts.toMs,
      });

      // Audit-log whenever a Doctor exports another person's or entire crew's data
      if (
        user.role === 'DOCTOR' &&
        (opts.scope === 'crew_member' || opts.scope === 'entire_crew')
      ) {
        const targetMember = opts.subjectUserId
          ? gathered.roster.find((m) => m.userId === opts.subjectUserId)
          : null;
        repo.insertAuditLog({
          missionId: mission?.id ?? null,
          actorUserId: user.id,
          actorRole: user.role,
          actionKey: 'audit.data_exported',
          params: {
            actorName: user.name,
            targetName:
              opts.scope === 'entire_crew'
                ? 'Entire crew'
                : targetMember?.name ?? opts.subjectUserId ?? 'Crew member',
            scope: opts.scope,
          },
          targetUserId: opts.subjectUserId ?? null,
        });
      }

      const exportId = crypto.randomUUID();
      const fileName = formatExportFilename(opts.scope, opts.format, nowMs);
      const expiresAt = nowMs + 24 * 3_600_000;
      const estimatedRows = estimateExportRowCount({
        dailyReadingsCount: gathered.dailyReadings.length,
        alertsCount: gathered.alerts.length,
        tasksCount: gathered.tasks.length,
        hazardsCount: gathered.hazards.length,
        auditCount: gathered.auditLog.length,
        problemReportsCount: gathered.problemReports.length,
      });

      const bundleInput = {
        actor: user,
        mission,
        roster: gathered.roster,
        scope: opts.scope,
        subjectUserId: opts.subjectUserId ?? null,
        fromMs: opts.fromMs,
        toMs: opts.toMs,
        include: opts.include,
        format: opts.format,
        labelLanguage: opts.labelLanguage,
        dailyReadings: gathered.dailyReadings,
        alerts: gathered.alerts,
        problemReports: gathered.problemReports,
        tasks: gathered.tasks,
        hazards: gathered.hazards,
        auditLog: gathered.auditLog,
        preferences: gathered.preferences,
        rules: gathered.rules,
        protocols: gathered.protocols,
        sources: gathered.sources,
        nowMs,
      };

      if (estimatedRows > 5000) {
        repo.createExportJob({
          id: exportId,
          userId: user.id,
          missionId: mission?.id ?? null,
          scope: opts.scope,
          subjectUserId: opts.subjectUserId ?? null,
          fromMs: opts.fromMs,
          toMs: opts.toMs,
          include: opts.include,
          format: opts.format,
          labelLanguage: opts.labelLanguage,
          status: 'PENDING',
          fileName,
          mimeType:
            opts.format === 'json'
              ? 'application/json; charset=utf-8'
              : 'application/zip',
          fileBytes: 0,
          contentBlob: null,
          createdAt: nowMs,
          expiresAt,
        });

        setTimeout(() => {
          serializeExportBundle(bundleInput)
            .then((out) => {
              repo.updateExportJobReady(
                exportId,
                out.fileName,
                out.mimeType,
                out.buffer
              );
            })
            .catch(() => {
              repo.updateExportJobFailed(exportId);
            });
        }, 10);

        res.status(202).json({
          export: {
            id: exportId,
            status: 'PENDING',
            fileName,
            format: opts.format,
            scope: opts.scope,
            labelLanguage: opts.labelLanguage,
            fileBytes: 0,
            estimatedRows,
            createdAt: nowMs,
            expiresAt,
            downloadUrl: `/api/exports/${exportId}/download`,
          },
        });
        return;
      }

      const built = await serializeExportBundle(bundleInput);
      repo.createExportJob({
        id: exportId,
        userId: user.id,
        missionId: mission?.id ?? null,
        scope: opts.scope,
        subjectUserId: opts.subjectUserId ?? null,
        fromMs: opts.fromMs,
        toMs: opts.toMs,
        include: opts.include,
        format: opts.format,
        labelLanguage: opts.labelLanguage,
        status: 'READY',
        fileName: built.fileName,
        mimeType: built.mimeType,
        fileBytes: built.buffer.byteLength,
        contentBlob: built.buffer,
        createdAt: nowMs,
        expiresAt,
      });

      res.status(201).json({
        export: {
          id: exportId,
          status: 'READY',
          fileName: built.fileName,
          mimeType: built.mimeType,
          format: opts.format,
          scope: opts.scope,
          labelLanguage: opts.labelLanguage,
          fileBytes: built.buffer.byteLength,
          estimatedRows,
          createdAt: nowMs,
          expiresAt,
          downloadUrl: `/api/exports/${exportId}/download`,
        },
      });
    }
  );

  app.get('/api/exports', requireAuth, (req: ScopedRequest, res: Response) => {
    res.json({ exports: repo.listExportJobs(req.authUser!.id) });
  });

  app.get(
    '/api/exports/:id/download',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const job = repo.getExportJobWithBlob(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'Export not found.', code: 'NOT_FOUND' });
        return;
      }
      if (job.userId !== user.id) {
        res.status(403).json({
          error: 'You do not have permission to download this export.',
          code: 'ROLE_FORBIDDEN',
        });
        return;
      }
      if (job.expiresAt <= Date.now()) {
        repo.cleanupExpiredExports(Date.now());
        res.status(410).json({
          error: 'This export has expired and been removed after 24 hours.',
          code: 'EXPORT_EXPIRED',
        });
        return;
      }
      if (job.status !== 'READY' || !job.contentBlob) {
        res.status(409).json({
          error: 'Export file is not ready yet.',
          code: 'EXPORT_NOT_READY',
        });
        return;
      }

      res.setHeader('Content-Type', job.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${job.fileName}"`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(job.contentBlob);
    }
  );

  app.get('/api/demo/scenarios', (_req: Request, res: Response) => {
    res.json({ scenarios: DEMO_SCENARIOS });
  });

  app.post(
    '/api/demo/load-scenario',
    requireAuth,
    (req: ScopedRequest, res: Response) => {
      const user = req.authUser!;
      const mission = repo.getUserMission(user.id);
      if (!mission || !mission.isDemo) {
        res.status(403).json({
          error: 'Demo scenarios can only be loaded inside a DEMO mission.',
          code: 'DEMO_MISSION_ONLY',
        });
        return;
      }

      const parsed = demoLoadScenarioSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: parsed.error.issues[0]?.message || 'Invalid scenario ID.',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      try {
        const result = applyDemoScenario(
          repo,
          mission,
          user,
          parsed.data.scenarioId
        );
        if (result.alerts.length > 0) {
          broadcastAlerts(result.alerts);
        }
        res.json(result);
      } catch (err) {
        if (err instanceof ForbiddenError) {
          res.status(403).json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    }
  );

  // ===== Existing Phase 0 Demo / Task Routes (X-Demo-User OR Auth Cookie) =====
  app.get(
    '/api/tasks',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const tasks = repo.listTasks(req.demoUserId!);
      res.json({ tasks });
    }
  );

  app.post(
    '/api/tasks',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || 'Invalid task payload.';
        res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
        return;
      }
      const task = repo.createTask(req.demoUserId!, parsed.data);
      res.status(201).json({ task });
    }
  );

  app.patch(
    '/api/tasks/:id/complete',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const taskId = req.params.id;
      try {
        const task = repo.completeTask(req.demoUserId!, taskId);
        if (!task) {
          res.status(404).json({ error: 'Task not found.', code: 'NOT_FOUND' });
          return;
        }
        res.json({ task });
      } catch (err) {
        if (err instanceof ConflictError) {
          res.status(409).json({ error: err.message, code: 'CONFLICT' });
          return;
        }
        throw err;
      }
    }
  );

  app.patch(
    '/api/tasks/:id/defer',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const parsed = deferTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message || 'Invalid deferral reason.';
        res.status(400).json({ error: message, code: 'VALIDATION_ERROR' });
        return;
      }

      const taskId = req.params.id;
      try {
        const task = repo.deferTask(
          req.demoUserId!,
          taskId,
          parsed.data.reason
        );
        if (!task) {
          res.status(404).json({ error: 'Task not found.', code: 'NOT_FOUND' });
          return;
        }
        res.json({ task });
      } catch (err) {
        if (err instanceof ConflictError) {
          res.status(409).json({ error: err.message, code: 'CONFLICT' });
          return;
        }
        throw err;
      }
    }
  );

  app.get(
    '/api/history',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const rawLimit = req.query.limit;
      let limit = 100;
      if (typeof rawLimit === 'string') {
        const n = Number(rawLimit);
        if (!Number.isInteger(n) || n < 1 || n > 500) {
          res.status(400).json({
            error: 'limit must be an integer between 1 and 500.',
            code: 'VALIDATION_ERROR',
          });
          return;
        }
        limit = n;
      }
      const history = repo.listHistory(req.demoUserId!, limit);
      res.json({ history });
    }
  );

  app.get(
    '/api/health-indicators',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const indicators = repo.getOrSeedHealthIndicators(req.demoUserId!);
      res.json({ indicators });
    }
  );

  app.get(
    '/api/risks',
    requireDemoOrAuth,
    (_req: ScopedRequest, res: Response) => {
      const risks = repo.getRisks();
      res.json({ risks });
    }
  );

  app.get(
    '/api/risks/env',
    requireDemoOrAuth,
    (req: ScopedRequest, res: Response) => {
      const stats = repo.getOrSeedEnvSamples(req.demoUserId!);
      res.json(stats);
    }
  );

  app.get(
    '/api/sleep',
    requireDemoOrAuth,
    (_req: ScopedRequest, res: Response) => {
      const records = repo.getSleepRecords();
      res.json({ records });
    }
  );

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
  });

  return app;
}
