import type { RuleSeverity } from './kb.ts';

export const SPEED_OF_LIGHT_KM_S = 299792.458;
export const NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV = 600;
export const NASA_30DAY_EFFECTIVE_DOSE_REF_MSV = 250;

export interface MissionDerived {
  missionDay: number;
  plannedDays: number;
  progressPercent: number;
  distanceKm: number;
  distanceIsTemplateDefault: boolean;
  oneWayLightSeconds: number;
  roundTripLightSeconds: number;
  lastSyncAt: number | null;
}

export function calculateMissionDerived(params: {
  startDateUtc: string; // YYYY-MM-DD
  plannedDays: number;
  distanceKm: number;
  distanceIsTemplateDefault: boolean;
  nowMs?: number;
  lastSyncAt?: number | null;
}): MissionDerived {
  const now = params.nowMs ?? Date.now();
  const nowDate = new Date(now);
  const todayUtcMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  const [y, m, d] = params.startDateUtc.split('-').map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d);
  const diffDays = Math.floor((todayUtcMs - startUtcMs) / 86_400_000) + 1;
  const missionDay = Math.max(1, diffDays);
  const progressPercent =
    params.plannedDays > 0
      ? Number(
          Math.min(100, Math.max(0, (missionDay / params.plannedDays) * 100)).toFixed(2)
        )
      : 0;
  const oneWayLightSeconds = params.distanceKm / SPEED_OF_LIGHT_KM_S;
  const roundTripLightSeconds = oneWayLightSeconds * 2;

  return {
    missionDay,
    plannedDays: params.plannedDays,
    progressPercent,
    distanceKm: params.distanceKm,
    distanceIsTemplateDefault: params.distanceIsTemplateDefault,
    oneWayLightSeconds,
    roundTripLightSeconds,
    lastSyncAt: params.lastSyncAt ?? null,
  };
}

export interface TriggeredRuleResult {
  ruleId: string;
  severity: RuleSeverity;
  titleKey: string;
  params: Record<string, string | number>;
  notifyDoctor: boolean;
  notifyCommander: boolean;
}

export function evaluateHeartRateRules(params: {
  bpm: number;
  context: 'RESTING' | 'AFTER_EXERCISE' | 'OTHER';
  previousDayRestingBpm?: number | null;
}): TriggeredRuleResult[] {
  if (params.context !== 'RESTING') {
    return [];
  }
  const results: TriggeredRuleResult[] = [];
  const isOutside = params.bpm < 60 || params.bpm > 100;
  if (isOutside) {
    results.push({
      ruleId: 'R-HR-01',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-HR-01',
      params: { value: params.bpm, unit: 'bpm' },
      notifyDoctor: true,
      notifyCommander: false,
    });
    if (
      params.previousDayRestingBpm !== undefined &&
      params.previousDayRestingBpm !== null &&
      (params.previousDayRestingBpm < 60 || params.previousDayRestingBpm > 100)
    ) {
      results.push({
        ruleId: 'R-HR-02',
        severity: 'REVIEW',
        titleKey: 'alerts.titles.R-HR-02',
        params: { value: params.bpm, prev: params.previousDayRestingBpm, unit: 'bpm' },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
  }
  return results;
}

export function evaluateBloodPressureRules(params: {
  systolic: number;
  diastolic: number;
}): TriggeredRuleResult[] {
  const { systolic, diastolic } = params;
  if (systolic > 180 || diastolic > 120) {
    return [
      {
        ruleId: 'R-BP-03',
        severity: 'HIGH_PRIORITY',
        titleKey: 'alerts.titles.R-BP-03',
        params: { systolic, diastolic, unit: 'mmHg' },
        notifyDoctor: true,
        notifyCommander: false,
      },
    ];
  }
  if (systolic >= 140 || diastolic >= 90) {
    return [
      {
        ruleId: 'R-BP-02',
        severity: 'REVIEW',
        titleKey: 'alerts.titles.R-BP-02',
        params: { systolic, diastolic, unit: 'mmHg' },
        notifyDoctor: true,
        notifyCommander: false,
      },
    ];
  }
  if (systolic >= 130 || diastolic >= 80) {
    return [
      {
        ruleId: 'R-BP-01',
        severity: 'MONITOR',
        titleKey: 'alerts.titles.R-BP-01',
        params: { systolic, diastolic, unit: 'mmHg' },
        notifyDoctor: true,
        notifyCommander: false,
      },
    ];
  }
  if (systolic < 90 || diastolic < 60) {
    return [
      {
        ruleId: 'R-BP-04',
        severity: 'MONITOR',
        titleKey: 'alerts.titles.R-BP-04',
        params: { systolic, diastolic, unit: 'mmHg' },
        notifyDoctor: true,
        notifyCommander: false,
      },
    ];
  }
  return [];
}

/**
 * Evaluates sleep rules on a chronological list of nightly hours (oldest -> newest).
 * Evaluates rules specifically for the newest entry in the sequence.
 */
export function evaluateSleepRules(chronologicalHours: number[]): TriggeredRuleResult[] {
  if (chronologicalHours.length === 0) {
    return [];
  }
  const results: TriggeredRuleResult[] = [];
  const latest = chronologicalHours[chronologicalHours.length - 1];

  if (latest < 7.0) {
    results.push({
      ruleId: 'R-SLP-01',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-SLP-01',
      params: { hours: latest, unit: 'hours' },
      notifyDoctor: true,
      notifyCommander: false,
    });
  }

  if (chronologicalHours.length >= 3) {
    const last3 = chronologicalHours.slice(-3);
    if (last3.every((h) => h < 7.0)) {
      results.push({
        ruleId: 'R-SLP-02',
        severity: 'REVIEW',
        titleKey: 'alerts.titles.R-SLP-02',
        params: { hours: latest, nights: 3, unit: 'hours' },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
  }

  // Downward trend of 3 or more consecutive decreasing steps (requires >= 4 entries)
  if (chronologicalHours.length >= 4) {
    const last4 = chronologicalHours.slice(-4);
    if (last4[0] > last4[1] && last4[1] > last4[2] && last4[2] > last4[3]) {
      results.push({
        ruleId: 'R-SLP-03',
        severity: 'INFORMATION',
        titleKey: 'alerts.titles.R-SLP-03',
        params: { hours: latest, steps: 3, unit: 'hours' },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
  }

  return results;
}

export function evaluateMoodAndStressRules(params: {
  chronologicalMoodLevels?: number[]; // 1..5 where 1 = Very low
  chronologicalStressScores?: number[]; // 0..100
}): TriggeredRuleResult[] {
  const results: TriggeredRuleResult[] = [];
  const moods = params.chronologicalMoodLevels ?? [];
  if (moods.length >= 2) {
    const last2 = moods.slice(-2);
    if (last2[0] === 1 && last2[1] === 1) {
      results.push({
        ruleId: 'R-MOOD-01',
        severity: 'REVIEW',
        titleKey: 'alerts.titles.R-MOOD-01',
        params: { days: 2 },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
  }

  const stresses = params.chronologicalStressScores ?? [];
  if (stresses.length >= 1) {
    const latest = stresses[stresses.length - 1];
    if (latest >= 70) {
      results.push({
        ruleId: 'R-STR-01',
        severity: 'MONITOR',
        titleKey: 'alerts.titles.R-STR-01',
        params: { score: latest, unit: '/ 100' },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
    if (stresses.length >= 3 && stresses.slice(-3).every((s) => s >= 70)) {
      results.push({
        ruleId: 'R-STR-02',
        severity: 'REVIEW',
        titleKey: 'alerts.titles.R-STR-02',
        params: { score: latest, days: 3, unit: '/ 100' },
        notifyDoctor: true,
        notifyCommander: false,
      });
    }
  }
  return results;
}

export function evaluateActivityRule(weeklyDaysCompleted: number): TriggeredRuleResult[] {
  if (weeklyDaysCompleted < 6) {
    return [
      {
        ruleId: 'R-ACT-01',
        severity: 'INFORMATION',
        titleKey: 'alerts.titles.R-ACT-01',
        params: { days: weeklyDaysCompleted, target: 6 },
        notifyDoctor: true,
        notifyCommander: false,
      },
    ];
  }
  return [];
}

export interface RadiationEvaluation {
  careerTotalMsv: number;
  percentOfCareerLimit: number;
  remainingToCareerLimitMsv: number;
  trailing30DayEffectiveMsv: number;
  percentOf30DayRef: number;
  alerts: TriggeredRuleResult[];
}

export function evaluateRadiationRules(params: {
  absorbedRateMgyDay: number;
  effectiveRateMsvDay: number;
  missionAccumulatedAbsorbedMgy: number;
  missionAccumulatedEffectiveMsv: number;
  priorCareerEffectiveMsv: number;
  trailing30DayEffectiveMsv: number;
  solarEventStatus: 'NONE' | 'SPE_IN_PROGRESS' | 'SPE_ENDED';
}): RadiationEvaluation {
  const careerTotalMsv = Number(
    (params.priorCareerEffectiveMsv + params.missionAccumulatedEffectiveMsv).toFixed(4)
  );
  const percentOfCareerLimit = Number(
    ((careerTotalMsv / NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV) * 100).toFixed(2)
  );
  const remainingToCareerLimitMsv = Number(
    (NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV - careerTotalMsv).toFixed(4)
  );
  const percentOf30DayRef = Number(
    ((params.trailing30DayEffectiveMsv / NASA_30DAY_EFFECTIVE_DOSE_REF_MSV) * 100).toFixed(2)
  );

  const alerts: TriggeredRuleResult[] = [];

  if (params.absorbedRateMgyDay > 0.4) {
    alerts.push({
      ruleId: 'R-RAD-01',
      severity: 'INFORMATION',
      titleKey: 'alerts.titles.R-RAD-01',
      params: { value: params.absorbedRateMgyDay, unit: 'mGy/day' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  if (
    careerTotalMsv >= NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV ||
    params.trailing30DayEffectiveMsv >= NASA_30DAY_EFFECTIVE_DOSE_REF_MSV
  ) {
    alerts.push({
      ruleId: 'R-RAD-04',
      severity: 'ALERT',
      titleKey: 'alerts.titles.R-RAD-04',
      params: { careerMsv: careerTotalMsv, day30Msv: params.trailing30DayEffectiveMsv, unit: 'mSv' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  } else if (
    careerTotalMsv >= NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV * 0.8 ||
    params.trailing30DayEffectiveMsv >= NASA_30DAY_EFFECTIVE_DOSE_REF_MSV * 0.8
  ) {
    alerts.push({
      ruleId: 'R-RAD-03',
      severity: 'ALERT',
      titleKey: 'alerts.titles.R-RAD-03',
      params: { percent: Math.max(percentOfCareerLimit, percentOf30DayRef), unit: '%' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  } else if (
    careerTotalMsv >= NASA_CAREER_EFFECTIVE_DOSE_LIMIT_MSV * 0.5 ||
    params.trailing30DayEffectiveMsv >= NASA_30DAY_EFFECTIVE_DOSE_REF_MSV * 0.5
  ) {
    alerts.push({
      ruleId: 'R-RAD-02',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-RAD-02',
      params: { percent: Math.max(percentOfCareerLimit, percentOf30DayRef), unit: '%' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  if (params.solarEventStatus === 'SPE_IN_PROGRESS') {
    alerts.push({
      ruleId: 'R-RAD-05',
      severity: 'HIGH_PRIORITY',
      titleKey: 'alerts.titles.R-RAD-05',
      params: { status: 'SPE_IN_PROGRESS' },
      // Commander receives HIGH PRIORITY immediately; Doctor receives INFORMATION notice only
      notifyDoctor: true,
      notifyCommander: true,
    });
  }

  return {
    careerTotalMsv,
    percentOfCareerLimit,
    remainingToCareerLimitMsv,
    trailing30DayEffectiveMsv: params.trailing30DayEffectiveMsv,
    percentOf30DayRef,
    alerts,
  };
}

export interface Co2ProtocolAnalysis {
  sampleCount: number;
  sampleMean: number | null;
  coverageMinutes: number;
  maxGapMinutes: number;
  verifiedHourAverage: number | null;
  status: 'INSUFFICIENT DATA' | 'MONITOR' | 'ALERT';
  alerts: TriggeredRuleResult[];
}

export function analyzeCo2Series(
  samples: ReadonlyArray<{ value: number; sampledAt: number }>,
  sevenDayMean?: number | null
): Co2ProtocolAnalysis {
  const sorted = [...samples].sort((a, b) => a.sampledAt - b.sampledAt);
  if (sorted.length === 0) {
    return {
      sampleCount: 0,
      sampleMean: null,
      coverageMinutes: 0,
      maxGapMinutes: 0,
      verifiedHourAverage: null,
      status: 'INSUFFICIENT DATA',
      alerts: [],
    };
  }

  const total = sorted.reduce((acc, s) => acc + s.value, 0);
  const sampleMean = Number((total / sorted.length).toFixed(6));
  const coverageMinutes = Math.max(
    0,
    Math.round((sorted[sorted.length - 1].sampledAt - sorted[0].sampledAt) / 60_000)
  );
  let maxGapMinutes = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = Math.round((sorted[i].sampledAt - sorted[i - 1].sampledAt) / 60_000);
    if (gap > maxGapMinutes) maxGapMinutes = gap;
  }

  // Protocol: >= 5 samples, spanning >= 60 minutes, no gap > 20 minutes
  const isVerified = sorted.length >= 5 && coverageMinutes >= 60 && maxGapMinutes <= 20;
  const verifiedHourAverage = isVerified ? sampleMean : null;

  const alerts: TriggeredRuleResult[] = [];
  if (verifiedHourAverage !== null) {
    if (verifiedHourAverage > 3.0) {
      alerts.push({
        ruleId: 'R-ENV-01',
        severity: 'ALERT',
        titleKey: 'alerts.titles.R-ENV-01',
        params: { value: verifiedHourAverage, unit: 'mmHg' },
        notifyDoctor: false,
        notifyCommander: true,
      });
    }
  } else if (sorted.some((s) => s.value > 3.0)) {
    alerts.push({
      ruleId: 'R-ENV-02',
      severity: 'INFORMATION',
      titleKey: 'alerts.titles.R-ENV-02',
      params: { value: Math.max(...sorted.map((s) => s.value)), unit: 'mmHg' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  if (sevenDayMean !== undefined && sevenDayMean !== null && sevenDayMean > 2.5) {
    alerts.push({
      ruleId: 'R-ENV-03',
      severity: 'INFORMATION',
      titleKey: 'alerts.titles.R-ENV-03',
      params: { value: sevenDayMean, unit: 'mmHg' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  return {
    sampleCount: sorted.length,
    sampleMean,
    coverageMinutes,
    maxGapMinutes,
    verifiedHourAverage,
    status:
      verifiedHourAverage === null
        ? 'INSUFFICIENT DATA'
        : verifiedHourAverage > 3.0
          ? 'ALERT'
          : 'MONITOR',
    alerts,
  };
}

export function evaluateEnvironmentHazard(params: {
  ppO2MmHg?: number | null;
  totalPressureKpa?: number | null;
  diluentPercent?: number | null;
  tempC?: number | null;
  rhPercent?: number | null;
  ventilationStatus?: 'NOMINAL' | 'DEGRADED' | 'OFF';
}): TriggeredRuleResult[] {
  const alerts: TriggeredRuleResult[] = [];

  if (
    params.ppO2MmHg !== undefined &&
    params.ppO2MmHg !== null &&
    (params.ppO2MmHg < 145 || params.ppO2MmHg > 155)
  ) {
    alerts.push({
      ruleId: 'R-ENV-04',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-ENV-04',
      params: { value: params.ppO2MmHg, unit: 'mmHg' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  const badPressure =
    params.totalPressureKpa !== undefined &&
    params.totalPressureKpa !== null &&
    (params.totalPressureKpa < 34.5 || params.totalPressureKpa > 103);
  const badDiluent =
    params.diluentPercent !== undefined &&
    params.diluentPercent !== null &&
    params.diluentPercent < 30;
  if (badPressure || badDiluent) {
    alerts.push({
      ruleId: 'R-ENV-05',
      severity: 'ALERT',
      titleKey: 'alerts.titles.R-ENV-05',
      params: {
        pressure: params.totalPressureKpa ?? 'UNKNOWN',
        diluent: params.diluentPercent ?? 'UNKNOWN',
      },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  if (
    params.tempC !== undefined &&
    params.tempC !== null &&
    params.rhPercent !== undefined &&
    params.rhPercent !== null
  ) {
    const t = params.tempC;
    const rh = params.rhPercent;
    const inPerformanceZone = t >= 20 && t <= 25 && rh >= 30 && rh <= 60;
    if (!inPerformanceZone) {
      const maxRhAtTemp = 75 - ((75 - 25) / (27 - 18)) * (t - 18);
      const inHealthLimits =
        t >= 18 && t <= 27 && rh >= 25 && rh <= 75 && rh <= maxRhAtTemp + 1e-9;
      alerts.push({
        ruleId: 'R-ENV-06',
        severity: inHealthLimits ? 'INFORMATION' : 'ALERT',
        titleKey: inHealthLimits
          ? 'alerts.titles.R-ENV-06.info'
          : 'alerts.titles.R-ENV-06.alert',
        params: { tempC: t, rhPercent: rh },
        notifyDoctor: false,
        notifyCommander: true,
      });
    }
  }

  if (
    params.ventilationStatus === 'DEGRADED' ||
    params.ventilationStatus === 'OFF'
  ) {
    alerts.push({
      ruleId: 'R-ENV-07',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-ENV-07',
      params: { status: params.ventilationStatus },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }

  return alerts;
}

export function evaluateOtherCommanderHazards(params: {
  gravityExerciseDays?: number | null;
  daysSinceGroundContact?: number | null;
  commStatus?: 'NOMINAL' | 'DEGRADED' | 'LOSS_OF_SIGNAL';
}): TriggeredRuleResult[] {
  const alerts: TriggeredRuleResult[] = [];
  if (
    params.gravityExerciseDays !== undefined &&
    params.gravityExerciseDays !== null &&
    params.gravityExerciseDays < 6
  ) {
    alerts.push({
      ruleId: 'R-GRV-01',
      severity: 'INFORMATION',
      titleKey: 'alerts.titles.R-GRV-01',
      params: { days: params.gravityExerciseDays, target: 6 },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }
  if (
    params.daysSinceGroundContact !== undefined &&
    params.daysSinceGroundContact !== null &&
    params.daysSinceGroundContact > 7
  ) {
    alerts.push({
      ruleId: 'R-ISO-01',
      severity: 'INFORMATION',
      titleKey: 'alerts.titles.R-ISO-01',
      params: { days: params.daysSinceGroundContact },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }
  if (params.commStatus === 'DEGRADED') {
    alerts.push({
      ruleId: 'R-DST-01',
      severity: 'MONITOR',
      titleKey: 'alerts.titles.R-DST-01',
      params: { status: 'DEGRADED' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  } else if (params.commStatus === 'LOSS_OF_SIGNAL') {
    alerts.push({
      ruleId: 'R-DST-02',
      severity: 'ALERT',
      titleKey: 'alerts.titles.R-DST-02',
      params: { status: 'LOSS_OF_SIGNAL' },
      notifyDoctor: false,
      notifyCommander: true,
    });
  }
  return alerts;
}
