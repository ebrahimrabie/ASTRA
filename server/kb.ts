import type Database from 'better-sqlite3';

export type RuleLabel =
  | 'NASA_REFERENCE'
  | 'CLINICAL_REFERENCE'
  | 'PROTOTYPE_DEFAULT';

export type RuleSeverity =
  | 'INFORMATION'
  | 'MONITOR'
  | 'REVIEW'
  | 'ALERT'
  | 'HIGH_PRIORITY'
  | 'UNKNOWN';

export interface MissionTemplateSeed {
  id: string;
  key: string;
  titleKey: string;
  descriptionKey: string;
  defaultDistanceKm: number;
  orbitalAltitudeKm: number | null;
  orbitPeriodMinutes: number | null;
  sunrisesPerDay: number | null;
  gcrReferenceMsvPerDay: number;
  surfaceGcrReferenceMsvPerDay: number | null;
  typicalEffectiveDoseMin: number | null;
  typicalEffectiveDoseMax: number | null;
  typicalAbsorbedDoseMax: number | null;
  defaultOneWayLightSec: number;
  sourceUrl: string;
}

export interface ReferenceRuleSeed {
  id: string;
  category: string;
  parameter: string;
  severity: RuleSeverity;
  label: RuleLabel;
  status: 'ACTIVE';
  thresholdValue: string;
  thresholdUnit: string;
  titleKey: string;
  explanationKey: string;
  nextStepKey: string;
  sourceCitationKey: string;
  sourceUrl: string;
  notifyDoctor: number;
  notifyCommander: number;
}

export interface InstrumentSeed {
  id: string;
  category: 'RADIATION' | 'DAILY_READING' | 'ENVIRONMENT' | 'DISTANCE';
  code: string;
  nameKey: string;
  descriptionKey: string;
  allowCustom: number;
  sortOrder: number;
}

export interface ProtocolSeed {
  id: string;
  titleKey: string;
  purposeKey: string;
  frequency: 'DAILY' | 'WEEKLY';
  roleScope: 'CREW' | 'COMMANDER';
  estimatedMinutes: number;
  safetyNoteKey: string;
  sourceUrl: string;
  steps: ReadonlyArray<{ stepNumber: number; textKey: string }>;
}

export interface AchievementCatalogSeed {
  id: string;
  key: string;
  kind: 'EDUCATION' | 'CONSISTENCY' | 'MISSION_PROGRESS';
  points: number;
  titleKey: string;
  descriptionKey: string;
  unlockHintKey: string;
  targetValue: number | null;
}

export interface EducationCardSeed {
  key: string;
  achievementId: string;
  titleKey: string;
  summaryKey: string;
  sourceKey: string;
  sourceUrl: string;
  questions: ReadonlyArray<{
    id: string;
    questionKey: string;
    optionsKeys: readonly [string, string, string];
    correctIndex: number;
    explanationKey: string;
  }>;
}

export interface DataSourceSeed {
  id: string;
  titleKey: string;
  organization: string;
  url: string;
  noteKey: string;
}

export const MISSION_TEMPLATES_SEED: ReadonlyArray<MissionTemplateSeed> = [
  {
    id: 'leo_iss',
    key: 'leo_iss',
    titleKey: 'kb.templates.leo_iss.title',
    descriptionKey: 'kb.templates.leo_iss.desc',
    defaultDistanceKm: 400,
    orbitalAltitudeKm: 400,
    orbitPeriodMinutes: 92,
    sunrisesPerDay: 16,
    gcrReferenceMsvPerDay: 1.3,
    surfaceGcrReferenceMsvPerDay: null,
    typicalEffectiveDoseMin: 0.2,
    typicalEffectiveDoseMax: 0.5,
    typicalAbsorbedDoseMax: 0.3,
    defaultOneWayLightSec: 400 / 299792.458,
    sourceUrl: 'https://standards.nasa.gov',
  },
  {
    id: 'lunar',
    key: 'lunar',
    titleKey: 'kb.templates.lunar.title',
    descriptionKey: 'kb.templates.lunar.desc',
    defaultDistanceKm: 384400,
    orbitalAltitudeKm: null,
    orbitPeriodMinutes: null,
    sunrisesPerDay: null,
    gcrReferenceMsvPerDay: 1.3,
    surfaceGcrReferenceMsvPerDay: 0.8,
    typicalEffectiveDoseMin: null,
    typicalEffectiveDoseMax: null,
    typicalAbsorbedDoseMax: null,
    defaultOneWayLightSec: 384400 / 299792.458,
    sourceUrl: 'https://standards.nasa.gov',
  },
  {
    id: 'mars',
    key: 'mars',
    titleKey: 'kb.templates.mars.title',
    descriptionKey: 'kb.templates.mars.desc',
    defaultDistanceKm: 54600000,
    orbitalAltitudeKm: null,
    orbitPeriodMinutes: null,
    sunrisesPerDay: null,
    gcrReferenceMsvPerDay: 1.3,
    surfaceGcrReferenceMsvPerDay: 0.8,
    typicalEffectiveDoseMin: null,
    typicalEffectiveDoseMax: null,
    typicalAbsorbedDoseMax: null,
    defaultOneWayLightSec: 54600000 / 299792.458,
    sourceUrl: 'https://standards.nasa.gov',
  },
];

export const DATA_SOURCES_SEED: ReadonlyArray<DataSourceSeed> = [
  {
    id: 'src-nasa-std-3001-v1',
    titleKey: 'kb.sources.std3001_v1.title',
    organization: 'NASA',
    url: 'https://standards.nasa.gov',
    noteKey: 'kb.sources.std3001_v1.note',
  },
  {
    id: 'src-nasa-std-3001-v2',
    titleKey: 'kb.sources.std3001_v2.title',
    organization: 'NASA',
    url: 'https://standards.nasa.gov',
    noteKey: 'kb.sources.std3001_v2.note',
  },
  {
    id: 'src-ochmo-tb002',
    titleKey: 'kb.sources.tb002.title',
    organization: 'NASA OCHMO',
    url: 'https://www.nasa.gov',
    noteKey: 'kb.sources.tb002.note',
  },
  {
    id: 'src-ochmo-tb004',
    titleKey: 'kb.sources.tb004.title',
    organization: 'NASA OCHMO',
    url: 'https://www.nasa.gov',
    noteKey: 'kb.sources.tb004.note',
  },
  {
    id: 'src-ochmo-tb020',
    titleKey: 'kb.sources.tb020.title',
    organization: 'NASA OCHMO',
    url: 'https://www.nasa.gov',
    noteKey: 'kb.sources.tb020.note',
  },
  {
    id: 'src-nasa-srag',
    titleKey: 'kb.sources.srag.title',
    organization: 'NASA SRAG',
    url: 'https://srag.jsc.nasa.gov',
    noteKey: 'kb.sources.srag.note',
  },
  {
    id: 'src-ntrs-exercise',
    titleKey: 'kb.sources.ntrs_exercise.title',
    organization: 'NASA NTRS',
    url: 'https://ntrs.nasa.gov',
    noteKey: 'kb.sources.ntrs_exercise.note',
  },
  {
    id: 'src-pmc-radiation',
    titleKey: 'kb.sources.pmc_radiation.title',
    organization: 'PMC / Space Agencies',
    url: 'https://pmc.ncbi.nlm.nih.gov',
    noteKey: 'kb.sources.pmc_radiation.note',
  },
  {
    id: 'src-acc-aha-2017',
    titleKey: 'kb.sources.acc_aha.title',
    organization: 'ACC / AHA',
    url: 'https://www.ahajournals.org',
    noteKey: 'kb.sources.acc_aha.note',
  },
  {
    id: 'src-aasm-srs-2015',
    titleKey: 'kb.sources.aasm_srs.title',
    organization: 'AASM / SRS',
    url: 'https://aasm.org',
    noteKey: 'kb.sources.aasm_srs.note',
  },
];

export const INSTRUMENTS_SEED: ReadonlyArray<InstrumentSeed> = [
  // Radiation instruments
  {
    id: 'inst-rad-cad',
    category: 'RADIATION',
    code: 'CAD',
    nameKey: 'kb.instruments.cad.name',
    descriptionKey: 'kb.instruments.cad.desc',
    allowCustom: 0,
    sortOrder: 1,
  },
  {
    id: 'inst-rad-issrad',
    category: 'RADIATION',
    code: 'ISS-RAD',
    nameKey: 'kb.instruments.iss_rad.name',
    descriptionKey: 'kb.instruments.iss_rad.desc',
    allowCustom: 0,
    sortOrder: 2,
  },
  {
    id: 'inst-rad-rem2',
    category: 'RADIATION',
    code: 'REM2',
    nameKey: 'kb.instruments.rem2.name',
    descriptionKey: 'kb.instruments.rem2.desc',
    allowCustom: 0,
    sortOrder: 3,
  },
  {
    id: 'inst-rad-hera',
    category: 'RADIATION',
    code: 'HERA',
    nameKey: 'kb.instruments.hera.name',
    descriptionKey: 'kb.instruments.hera.desc',
    allowCustom: 0,
    sortOrder: 4,
  },
  {
    id: 'inst-rad-tepc',
    category: 'RADIATION',
    code: 'TEPC',
    nameKey: 'kb.instruments.tepc.name',
    descriptionKey: 'kb.instruments.tepc.desc',
    allowCustom: 0,
    sortOrder: 5,
  },
  {
    id: 'inst-rad-passive',
    category: 'RADIATION',
    code: 'PASSIVE',
    nameKey: 'kb.instruments.passive.name',
    descriptionKey: 'kb.instruments.passive.desc',
    allowCustom: 0,
    sortOrder: 6,
  },
  {
    id: 'inst-rad-other',
    category: 'RADIATION',
    code: 'OTHER',
    nameKey: 'kb.instruments.other.name',
    descriptionKey: 'kb.instruments.other.desc',
    allowCustom: 1,
    sortOrder: 99,
  },

  // Daily-reading devices
  {
    id: 'inst-day-medical',
    category: 'DAILY_READING',
    code: 'CREW_MED_DEVICE',
    nameKey: 'kb.instruments.crew_medical.name',
    descriptionKey: 'kb.instruments.crew_medical.desc',
    allowCustom: 0,
    sortOrder: 1,
  },
  {
    id: 'inst-day-manual',
    category: 'DAILY_READING',
    code: 'MANUAL',
    nameKey: 'kb.instruments.manual.name',
    descriptionKey: 'kb.instruments.manual.desc',
    allowCustom: 0,
    sortOrder: 2,
  },
  {
    id: 'inst-day-wearable',
    category: 'DAILY_READING',
    code: 'WEARABLE',
    nameKey: 'kb.instruments.wearable.name',
    descriptionKey: 'kb.instruments.wearable.desc',
    allowCustom: 0,
    sortOrder: 3,
  },
  {
    id: 'inst-day-other',
    category: 'DAILY_READING',
    code: 'OTHER',
    nameKey: 'kb.instruments.other.name',
    descriptionKey: 'kb.instruments.other.desc',
    allowCustom: 1,
    sortOrder: 99,
  },

  // Environment sources
  {
    id: 'inst-env-vehicle',
    category: 'ENVIRONMENT',
    code: 'VEHICLE_MONITOR',
    nameKey: 'kb.instruments.vehicle_atmo.name',
    descriptionKey: 'kb.instruments.vehicle_atmo.desc',
    allowCustom: 0,
    sortOrder: 1,
  },
  {
    id: 'inst-env-portable',
    category: 'ENVIRONMENT',
    code: 'PORTABLE_GAS',
    nameKey: 'kb.instruments.portable_gas.name',
    descriptionKey: 'kb.instruments.portable_gas.desc',
    allowCustom: 0,
    sortOrder: 2,
  },
  {
    id: 'inst-env-other',
    category: 'ENVIRONMENT',
    code: 'OTHER',
    nameKey: 'kb.instruments.other.name',
    descriptionKey: 'kb.instruments.other.desc',
    allowCustom: 1,
    sortOrder: 99,
  },

  // Distance/communication sources
  {
    id: 'inst-dst-uplink',
    category: 'DISTANCE',
    code: 'MISSION_UPLINK',
    nameKey: 'kb.instruments.mission_uplink.name',
    descriptionKey: 'kb.instruments.mission_uplink.desc',
    allowCustom: 0,
    sortOrder: 1,
  },
  {
    id: 'inst-dst-onboard',
    category: 'DISTANCE',
    code: 'ONBOARD_NAV',
    nameKey: 'kb.instruments.onboard_nav.name',
    descriptionKey: 'kb.instruments.onboard_nav.desc',
    allowCustom: 0,
    sortOrder: 2,
  },
  {
    id: 'inst-dst-template',
    category: 'DISTANCE',
    code: 'TEMPLATE_DEFAULT',
    nameKey: 'kb.instruments.template_default.name',
    descriptionKey: 'kb.instruments.template_default.desc',
    allowCustom: 0,
    sortOrder: 3,
  },
  {
    id: 'inst-dst-other',
    category: 'DISTANCE',
    code: 'OTHER',
    nameKey: 'kb.instruments.other.name',
    descriptionKey: 'kb.instruments.other.desc',
    allowCustom: 1,
    sortOrder: 99,
  },
];

export const REFERENCE_RULES_SEED: ReadonlyArray<ReferenceRuleSeed> = [
  // Radiation
  {
    id: 'R-RAD-01',
    category: 'RADIATION',
    parameter: 'absorbed_dose_rate',
    severity: 'INFORMATION',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '> 0.4',
    thresholdUnit: 'mGy/day',
    titleKey: 'kb.rules.R-RAD-01.title',
    explanationKey: 'kb.rules.R-RAD-01.explanation',
    nextStepKey: 'kb.rules.R-RAD-01.next_step',
    sourceCitationKey: 'kb.rules.R-RAD-01.source',
    sourceUrl: 'https://srag.jsc.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-RAD-02',
    category: 'RADIATION',
    parameter: 'effective_dose_margin_50',
    severity: 'MONITOR',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '>= 50%',
    thresholdUnit: '% of 600 mSv / 250 mSv',
    titleKey: 'kb.rules.R-RAD-02.title',
    explanationKey: 'kb.rules.R-RAD-02.explanation',
    nextStepKey: 'kb.rules.R-RAD-02.next_step',
    sourceCitationKey: 'kb.rules.R-RAD-02.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-RAD-03',
    category: 'RADIATION',
    parameter: 'effective_dose_margin_80',
    severity: 'ALERT',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '>= 80%',
    thresholdUnit: '% of 600 mSv / 250 mSv',
    titleKey: 'kb.rules.R-RAD-03.title',
    explanationKey: 'kb.rules.R-RAD-03.explanation',
    nextStepKey: 'kb.rules.R-RAD-03.next_step',
    sourceCitationKey: 'kb.rules.R-RAD-03.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-RAD-04',
    category: 'RADIATION',
    parameter: 'effective_dose_limit',
    severity: 'ALERT',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '>= 600 career / >= 250 30-day',
    thresholdUnit: 'mSv',
    titleKey: 'kb.rules.R-RAD-04.title',
    explanationKey: 'kb.rules.R-RAD-04.explanation',
    nextStepKey: 'kb.rules.R-RAD-04.next_step',
    sourceCitationKey: 'kb.rules.R-RAD-04.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-RAD-05',
    category: 'RADIATION',
    parameter: 'solar_event_status',
    severity: 'HIGH_PRIORITY',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'SPE_IN_PROGRESS',
    thresholdUnit: 'status',
    titleKey: 'kb.rules.R-RAD-05.title',
    explanationKey: 'kb.rules.R-RAD-05.explanation',
    nextStepKey: 'kb.rules.R-RAD-05.next_step',
    sourceCitationKey: 'kb.rules.R-RAD-05.source',
    sourceUrl: 'https://www.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 1,
  },

  // Environment, Gravity, Isolation, Distance
  {
    id: 'R-ENV-01',
    category: 'ENVIRONMENT',
    parameter: 'ppco2_verified_1h',
    severity: 'ALERT',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '> 3.0',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-ENV-01.title',
    explanationKey: 'kb.rules.R-ENV-01.explanation',
    nextStepKey: 'kb.rules.R-ENV-01.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-02',
    category: 'ENVIRONMENT',
    parameter: 'ppco2_single_incomplete',
    severity: 'INFORMATION',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '> 3.0 (incomplete coverage)',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-ENV-02.title',
    explanationKey: 'kb.rules.R-ENV-02.explanation',
    nextStepKey: 'kb.rules.R-ENV-02.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-02.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-03',
    category: 'ENVIRONMENT',
    parameter: 'ppco2_7d_avg',
    severity: 'INFORMATION',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '> 2.5',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-ENV-03.title',
    explanationKey: 'kb.rules.R-ENV-03.explanation',
    nextStepKey: 'kb.rules.R-ENV-03.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-03.source',
    sourceUrl: 'https://www.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-04',
    category: 'ENVIRONMENT',
    parameter: 'ppo2',
    severity: 'MONITOR',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'outside 145-155',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-ENV-04.title',
    explanationKey: 'kb.rules.R-ENV-04.explanation',
    nextStepKey: 'kb.rules.R-ENV-04.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-04.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-05',
    category: 'ENVIRONMENT',
    parameter: 'total_pressure_or_diluent',
    severity: 'ALERT',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'outside 34.5-103 kPa or diluent < 30%',
    thresholdUnit: 'kPa / %',
    titleKey: 'kb.rules.R-ENV-05.title',
    explanationKey: 'kb.rules.R-ENV-05.explanation',
    nextStepKey: 'kb.rules.R-ENV-05.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-05.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-06',
    category: 'ENVIRONMENT',
    parameter: 'temp_humidity_envelope',
    severity: 'ALERT',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'Perf 20-25C / 30-60% RH; Health (18C,75%)-(27C,25%)',
    thresholdUnit: 'C / %RH',
    titleKey: 'kb.rules.R-ENV-06.title',
    explanationKey: 'kb.rules.R-ENV-06.explanation',
    nextStepKey: 'kb.rules.R-ENV-06.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-06.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ENV-07',
    category: 'ENVIRONMENT',
    parameter: 'ventilation_status',
    severity: 'MONITOR',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'Degraded or Off',
    thresholdUnit: 'status',
    titleKey: 'kb.rules.R-ENV-07.title',
    explanationKey: 'kb.rules.R-ENV-07.explanation',
    nextStepKey: 'kb.rules.R-ENV-07.next_step',
    sourceCitationKey: 'kb.rules.R-ENV-07.source',
    sourceUrl: 'https://www.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-GRV-01',
    category: 'GRAVITY',
    parameter: 'weekly_exercise_days',
    severity: 'INFORMATION',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '< 6 days/week',
    thresholdUnit: 'days',
    titleKey: 'kb.rules.R-GRV-01.title',
    explanationKey: 'kb.rules.R-GRV-01.explanation',
    nextStepKey: 'kb.rules.R-GRV-01.next_step',
    sourceCitationKey: 'kb.rules.R-GRV-01.source',
    sourceUrl: 'https://ntrs.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-ISO-01',
    category: 'ISOLATION',
    parameter: 'days_since_ground_contact',
    severity: 'INFORMATION',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '> 7',
    thresholdUnit: 'days',
    titleKey: 'kb.rules.R-ISO-01.title',
    explanationKey: 'kb.rules.R-ISO-01.explanation',
    nextStepKey: 'kb.rules.R-ISO-01.next_step',
    sourceCitationKey: 'kb.rules.R-ISO-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-DST-01',
    category: 'DISTANCE',
    parameter: 'comm_degraded',
    severity: 'MONITOR',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'DEGRADED',
    thresholdUnit: 'status',
    titleKey: 'kb.rules.R-DST-01.title',
    explanationKey: 'kb.rules.R-DST-01.explanation',
    nextStepKey: 'kb.rules.R-DST-01.next_step',
    sourceCitationKey: 'kb.rules.R-DST-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-DST-02',
    category: 'DISTANCE',
    parameter: 'comm_loss',
    severity: 'ALERT',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'LOSS_OF_SIGNAL',
    thresholdUnit: 'status',
    titleKey: 'kb.rules.R-DST-02.title',
    explanationKey: 'kb.rules.R-DST-02.explanation',
    nextStepKey: 'kb.rules.R-DST-02.next_step',
    sourceCitationKey: 'kb.rules.R-DST-02.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },

  // Crew Health Rules (notify Doctor)
  {
    id: 'R-HR-01',
    category: 'HEART_RATE',
    parameter: 'resting_hr',
    severity: 'MONITOR',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '< 60 or > 100',
    thresholdUnit: 'bpm',
    titleKey: 'kb.rules.R-HR-01.title',
    explanationKey: 'kb.rules.R-HR-01.explanation',
    nextStepKey: 'kb.rules.R-HR-01.next_step',
    sourceCitationKey: 'kb.rules.R-HR-01.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-HR-02',
    category: 'HEART_RATE',
    parameter: 'resting_hr_consecutive',
    severity: 'REVIEW',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '2 consecutive days outside 60-100',
    thresholdUnit: 'bpm',
    titleKey: 'kb.rules.R-HR-02.title',
    explanationKey: 'kb.rules.R-HR-02.explanation',
    nextStepKey: 'kb.rules.R-HR-02.next_step',
    sourceCitationKey: 'kb.rules.R-HR-02.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-BP-01',
    category: 'BLOOD_PRESSURE',
    parameter: 'bp_elevated',
    severity: 'MONITOR',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'systolic >= 130 or diastolic >= 80',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-BP-01.title',
    explanationKey: 'kb.rules.R-BP-01.explanation',
    nextStepKey: 'kb.rules.R-BP-01.next_step',
    sourceCitationKey: 'kb.rules.R-BP-01.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-BP-02',
    category: 'BLOOD_PRESSURE',
    parameter: 'bp_stage2',
    severity: 'REVIEW',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'systolic >= 140 or diastolic >= 90',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-BP-02.title',
    explanationKey: 'kb.rules.R-BP-02.explanation',
    nextStepKey: 'kb.rules.R-BP-02.next_step',
    sourceCitationKey: 'kb.rules.R-BP-02.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-BP-03',
    category: 'BLOOD_PRESSURE',
    parameter: 'bp_crisis',
    severity: 'HIGH_PRIORITY',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'systolic > 180 or diastolic > 120',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-BP-03.title',
    explanationKey: 'kb.rules.R-BP-03.explanation',
    nextStepKey: 'kb.rules.R-BP-03.next_step',
    sourceCitationKey: 'kb.rules.R-BP-03.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-BP-04',
    category: 'BLOOD_PRESSURE',
    parameter: 'bp_low',
    severity: 'MONITOR',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: 'systolic < 90 or diastolic < 60',
    thresholdUnit: 'mmHg',
    titleKey: 'kb.rules.R-BP-04.title',
    explanationKey: 'kb.rules.R-BP-04.explanation',
    nextStepKey: 'kb.rules.R-BP-04.next_step',
    sourceCitationKey: 'kb.rules.R-BP-04.source',
    sourceUrl: 'https://www.ahajournals.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-SLP-01',
    category: 'SLEEP',
    parameter: 'sleep_duration',
    severity: 'MONITOR',
    label: 'CLINICAL_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '< 7.0',
    thresholdUnit: 'hours',
    titleKey: 'kb.rules.R-SLP-01.title',
    explanationKey: 'kb.rules.R-SLP-01.explanation',
    nextStepKey: 'kb.rules.R-SLP-01.next_step',
    sourceCitationKey: 'kb.rules.R-SLP-01.source',
    sourceUrl: 'https://aasm.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-SLP-02',
    category: 'SLEEP',
    parameter: 'sleep_consecutive_short',
    severity: 'REVIEW',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '3 consecutive nights < 7.0',
    thresholdUnit: 'hours',
    titleKey: 'kb.rules.R-SLP-02.title',
    explanationKey: 'kb.rules.R-SLP-02.explanation',
    nextStepKey: 'kb.rules.R-SLP-02.next_step',
    sourceCitationKey: 'kb.rules.R-SLP-02.source',
    sourceUrl: 'https://aasm.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-SLP-03',
    category: 'SLEEP',
    parameter: 'sleep_downward_trend',
    severity: 'INFORMATION',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '>= 3 consecutive decreasing steps',
    thresholdUnit: 'steps',
    titleKey: 'kb.rules.R-SLP-03.title',
    explanationKey: 'kb.rules.R-SLP-03.explanation',
    nextStepKey: 'kb.rules.R-SLP-03.next_step',
    sourceCitationKey: 'kb.rules.R-SLP-03.source',
    sourceUrl: 'https://aasm.org',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-MOOD-01',
    category: 'MOOD',
    parameter: 'mood_consecutive_very_low',
    severity: 'REVIEW',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'level 1 for 2 consecutive days',
    thresholdUnit: 'level',
    titleKey: 'kb.rules.R-MOOD-01.title',
    explanationKey: 'kb.rules.R-MOOD-01.explanation',
    nextStepKey: 'kb.rules.R-MOOD-01.next_step',
    sourceCitationKey: 'kb.rules.R-MOOD-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-STR-01',
    category: 'STRESS',
    parameter: 'stress_high_day',
    severity: 'MONITOR',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '>= 70',
    thresholdUnit: '/ 100',
    titleKey: 'kb.rules.R-STR-01.title',
    explanationKey: 'kb.rules.R-STR-01.explanation',
    nextStepKey: 'kb.rules.R-STR-01.next_step',
    sourceCitationKey: 'kb.rules.R-STR-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-STR-02',
    category: 'STRESS',
    parameter: 'stress_consecutive',
    severity: 'REVIEW',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '>= 70 for 3 consecutive days',
    thresholdUnit: '/ 100',
    titleKey: 'kb.rules.R-STR-02.title',
    explanationKey: 'kb.rules.R-STR-02.explanation',
    nextStepKey: 'kb.rules.R-STR-02.next_step',
    sourceCitationKey: 'kb.rules.R-STR-02.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-ACT-01',
    category: 'ACTIVITY',
    parameter: 'weekly_exercise_reference',
    severity: 'INFORMATION',
    label: 'NASA_REFERENCE',
    status: 'ACTIVE',
    thresholdValue: '< 6 days x 150 min',
    thresholdUnit: 'minutes/week',
    titleKey: 'kb.rules.R-ACT-01.title',
    explanationKey: 'kb.rules.R-ACT-01.explanation',
    nextStepKey: 'kb.rules.R-ACT-01.next_step',
    sourceCitationKey: 'kb.rules.R-ACT-01.source',
    sourceUrl: 'https://ntrs.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-DATA-01',
    category: 'DATA_COMPLETENESS',
    parameter: 'missing_daily_entries',
    severity: 'INFORMATION',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: '2 consecutive days without entries',
    thresholdUnit: 'days',
    titleKey: 'kb.rules.R-DATA-01.title',
    explanationKey: 'kb.rules.R-DATA-01.explanation',
    nextStepKey: 'kb.rules.R-DATA-01.next_step',
    sourceCitationKey: 'kb.rules.R-DATA-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
  {
    id: 'R-DATA-02',
    category: 'DATA_COMPLETENESS',
    parameter: 'overdue_weekly_hazard',
    severity: 'UNKNOWN',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'overdue >= 1 day',
    thresholdUnit: 'days',
    titleKey: 'kb.rules.R-DATA-02.title',
    explanationKey: 'kb.rules.R-DATA-02.explanation',
    nextStepKey: 'kb.rules.R-DATA-02.next_step',
    sourceCitationKey: 'kb.rules.R-DATA-02.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 0,
    notifyCommander: 1,
  },
  {
    id: 'R-REP-01',
    category: 'PROBLEM_REPORT',
    parameter: 'crew_problem_report',
    severity: 'REVIEW',
    label: 'PROTOTYPE_DEFAULT',
    status: 'ACTIVE',
    thresholdValue: 'Standard -> REVIEW / Urgent -> HIGH_PRIORITY',
    thresholdUnit: 'report',
    titleKey: 'kb.rules.R-REP-01.title',
    explanationKey: 'kb.rules.R-REP-01.explanation',
    nextStepKey: 'kb.rules.R-REP-01.next_step',
    sourceCitationKey: 'kb.rules.R-REP-01.source',
    sourceUrl: 'https://standards.nasa.gov',
    notifyDoctor: 1,
    notifyCommander: 0,
  },
];

export const PROTOCOLS_SEED: ReadonlyArray<ProtocolSeed> = [
  {
    id: 'PRT-HR',
    titleKey: 'kb.protocols.PRT-HR.title',
    purposeKey: 'kb.protocols.PRT-HR.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 7,
    safetyNoteKey: 'kb.protocols.PRT-HR.safety',
    sourceUrl: 'https://www.ahajournals.org',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-HR.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-HR.step2' },
      { stepNumber: 3, textKey: 'kb.protocols.PRT-HR.step3' },
      { stepNumber: 4, textKey: 'kb.protocols.PRT-HR.step4' },
    ],
  },
  {
    id: 'PRT-BP',
    titleKey: 'kb.protocols.PRT-BP.title',
    purposeKey: 'kb.protocols.PRT-BP.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 10,
    safetyNoteKey: 'kb.protocols.PRT-BP.safety',
    sourceUrl: 'https://www.ahajournals.org',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-BP.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-BP.step2' },
      { stepNumber: 3, textKey: 'kb.protocols.PRT-BP.step3' },
      { stepNumber: 4, textKey: 'kb.protocols.PRT-BP.step4' },
    ],
  },
  {
    id: 'PRT-SLP',
    titleKey: 'kb.protocols.PRT-SLP.title',
    purposeKey: 'kb.protocols.PRT-SLP.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 3,
    safetyNoteKey: 'kb.protocols.PRT-SLP.safety',
    sourceUrl: 'https://aasm.org',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-SLP.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-SLP.step2' },
    ],
  },
  {
    id: 'PRT-MOOD',
    titleKey: 'kb.protocols.PRT-MOOD.title',
    purposeKey: 'kb.protocols.PRT-MOOD.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 2,
    safetyNoteKey: 'kb.protocols.PRT-MOOD.safety',
    sourceUrl: 'https://standards.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-MOOD.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-MOOD.step2' },
    ],
  },
  {
    id: 'PRT-STR',
    titleKey: 'kb.protocols.PRT-STR.title',
    purposeKey: 'kb.protocols.PRT-STR.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 2,
    safetyNoteKey: 'kb.protocols.PRT-STR.safety',
    sourceUrl: 'https://standards.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-STR.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-STR.step2' },
    ],
  },
  {
    id: 'PRT-ACT',
    titleKey: 'kb.protocols.PRT-ACT.title',
    purposeKey: 'kb.protocols.PRT-ACT.purpose',
    frequency: 'DAILY',
    roleScope: 'CREW',
    estimatedMinutes: 5,
    safetyNoteKey: 'kb.protocols.PRT-ACT.safety',
    sourceUrl: 'https://ntrs.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-ACT.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-ACT.step2' },
    ],
  },
  {
    id: 'PRT-RAD',
    titleKey: 'kb.protocols.PRT-RAD.title',
    purposeKey: 'kb.protocols.PRT-RAD.purpose',
    frequency: 'WEEKLY',
    roleScope: 'COMMANDER',
    estimatedMinutes: 10,
    safetyNoteKey: 'kb.protocols.PRT-RAD.safety',
    sourceUrl: 'https://srag.jsc.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-RAD.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-RAD.step2' },
      { stepNumber: 3, textKey: 'kb.protocols.PRT-RAD.step3' },
    ],
  },
  {
    id: 'PRT-ENV',
    titleKey: 'kb.protocols.PRT-ENV.title',
    purposeKey: 'kb.protocols.PRT-ENV.purpose',
    frequency: 'WEEKLY',
    roleScope: 'COMMANDER',
    estimatedMinutes: 75,
    safetyNoteKey: 'kb.protocols.PRT-ENV.safety',
    sourceUrl: 'https://standards.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-ENV.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-ENV.step2' },
    ],
  },
  {
    id: 'PRT-GRV',
    titleKey: 'kb.protocols.PRT-GRV.title',
    purposeKey: 'kb.protocols.PRT-GRV.purpose',
    frequency: 'WEEKLY',
    roleScope: 'COMMANDER',
    estimatedMinutes: 10,
    safetyNoteKey: 'kb.protocols.PRT-GRV.safety',
    sourceUrl: 'https://ntrs.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-GRV.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-GRV.step2' },
    ],
  },
  {
    id: 'PRT-ISO',
    titleKey: 'kb.protocols.PRT-ISO.title',
    purposeKey: 'kb.protocols.PRT-ISO.purpose',
    frequency: 'WEEKLY',
    roleScope: 'COMMANDER',
    estimatedMinutes: 5,
    safetyNoteKey: 'kb.protocols.PRT-ISO.safety',
    sourceUrl: 'https://standards.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-ISO.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-ISO.step2' },
    ],
  },
  {
    id: 'PRT-DST',
    titleKey: 'kb.protocols.PRT-DST.title',
    purposeKey: 'kb.protocols.PRT-DST.purpose',
    frequency: 'WEEKLY',
    roleScope: 'COMMANDER',
    estimatedMinutes: 5,
    safetyNoteKey: 'kb.protocols.PRT-DST.safety',
    sourceUrl: 'https://standards.nasa.gov',
    steps: [
      { stepNumber: 1, textKey: 'kb.protocols.PRT-DST.step1' },
      { stepNumber: 2, textKey: 'kb.protocols.PRT-DST.step2' },
    ],
  },
];

export const ACHIEVEMENTS_CATALOG_SEED: ReadonlyArray<AchievementCatalogSeed> = [
  {
    id: 'ach-edu-rad',
    key: 'edu_radiation',
    kind: 'EDUCATION',
    points: 10,
    titleKey: 'kb.achievements.edu_radiation.title',
    descriptionKey: 'kb.achievements.edu_radiation.desc',
    unlockHintKey: 'kb.achievements.edu_radiation.hint',
    targetValue: null,
  },
  {
    id: 'ach-edu-sleep',
    key: 'edu_sleep',
    kind: 'EDUCATION',
    points: 10,
    titleKey: 'kb.achievements.edu_sleep.title',
    descriptionKey: 'kb.achievements.edu_sleep.desc',
    unlockHintKey: 'kb.achievements.edu_sleep.hint',
    targetValue: null,
  },
  {
    id: 'ach-edu-exercise',
    key: 'edu_exercise',
    kind: 'EDUCATION',
    points: 10,
    titleKey: 'kb.achievements.edu_exercise.title',
    descriptionKey: 'kb.achievements.edu_exercise.desc',
    unlockHintKey: 'kb.achievements.edu_exercise.hint',
    targetValue: null,
  },
  {
    id: 'ach-edu-readiness',
    key: 'edu_readiness',
    kind: 'EDUCATION',
    points: 10,
    titleKey: 'kb.achievements.edu_readiness.title',
    descriptionKey: 'kb.achievements.edu_readiness.desc',
    unlockHintKey: 'kb.achievements.edu_readiness.hint',
    targetValue: null,
  },
  {
    id: 'ach-cons-7',
    key: 'consistency_7',
    kind: 'CONSISTENCY',
    points: 20,
    titleKey: 'kb.achievements.consistency_7.title',
    descriptionKey: 'kb.achievements.consistency_7.desc',
    unlockHintKey: 'kb.achievements.consistency_7.hint',
    targetValue: 7,
  },
  {
    id: 'ach-cons-14',
    key: 'consistency_14',
    kind: 'CONSISTENCY',
    points: 30,
    titleKey: 'kb.achievements.consistency_14.title',
    descriptionKey: 'kb.achievements.consistency_14.desc',
    unlockHintKey: 'kb.achievements.consistency_14.hint',
    targetValue: 14,
  },
  {
    id: 'ach-cons-30',
    key: 'consistency_30',
    kind: 'CONSISTENCY',
    points: 50,
    titleKey: 'kb.achievements.consistency_30.title',
    descriptionKey: 'kb.achievements.consistency_30.desc',
    unlockHintKey: 'kb.achievements.consistency_30.hint',
    targetValue: 30,
  },
  {
    id: 'ach-prog-25',
    key: 'progress_25',
    kind: 'MISSION_PROGRESS',
    points: 10,
    titleKey: 'kb.achievements.progress_25.title',
    descriptionKey: 'kb.achievements.progress_25.desc',
    unlockHintKey: 'kb.achievements.progress_25.hint',
    targetValue: 25,
  },
  {
    id: 'ach-prog-50',
    key: 'progress_50',
    kind: 'MISSION_PROGRESS',
    points: 10,
    titleKey: 'kb.achievements.progress_50.title',
    descriptionKey: 'kb.achievements.progress_50.desc',
    unlockHintKey: 'kb.achievements.progress_50.hint',
    targetValue: 50,
  },
  {
    id: 'ach-prog-75',
    key: 'progress_75',
    kind: 'MISSION_PROGRESS',
    points: 10,
    titleKey: 'kb.achievements.progress_75.title',
    descriptionKey: 'kb.achievements.progress_75.desc',
    unlockHintKey: 'kb.achievements.progress_75.hint',
    targetValue: 75,
  },
  {
    id: 'ach-prog-100',
    key: 'progress_100',
    kind: 'MISSION_PROGRESS',
    points: 10,
    titleKey: 'kb.achievements.progress_100.title',
    descriptionKey: 'kb.achievements.progress_100.desc',
    unlockHintKey: 'kb.achievements.progress_100.hint',
    targetValue: 100,
  },
];

export const EDUCATION_CARDS_SEED: ReadonlyArray<EducationCardSeed> = [
  {
    key: 'edu_radiation',
    achievementId: 'ach-edu-rad',
    titleKey: 'kb.education.edu_radiation.title',
    summaryKey: 'kb.education.edu_radiation.summary',
    sourceKey: 'kb.education.edu_radiation.source',
    sourceUrl: 'https://srag.jsc.nasa.gov',
    questions: [
      {
        id: 'rad-q1',
        questionKey: 'kb.education.edu_radiation.q1.prompt',
        optionsKeys: [
          'kb.education.edu_radiation.q1.opt0',
          'kb.education.edu_radiation.q1.opt1',
          'kb.education.edu_radiation.q1.opt2',
        ],
        correctIndex: 1,
        explanationKey: 'kb.education.edu_radiation.q1.exp',
      },
      {
        id: 'rad-q2',
        questionKey: 'kb.education.edu_radiation.q2.prompt',
        optionsKeys: [
          'kb.education.edu_radiation.q2.opt0',
          'kb.education.edu_radiation.q2.opt1',
          'kb.education.edu_radiation.q2.opt2',
        ],
        correctIndex: 0,
        explanationKey: 'kb.education.edu_radiation.q2.exp',
      },
      {
        id: 'rad-q3',
        questionKey: 'kb.education.edu_radiation.q3.prompt',
        optionsKeys: [
          'kb.education.edu_radiation.q3.opt0',
          'kb.education.edu_radiation.q3.opt1',
          'kb.education.edu_radiation.q3.opt2',
        ],
        correctIndex: 2,
        explanationKey: 'kb.education.edu_radiation.q3.exp',
      },
    ],
  },
  {
    key: 'edu_sleep',
    achievementId: 'ach-edu-sleep',
    titleKey: 'kb.education.edu_sleep.title',
    summaryKey: 'kb.education.edu_sleep.summary',
    sourceKey: 'kb.education.edu_sleep.source',
    sourceUrl: 'https://aasm.org',
    questions: [
      {
        id: 'slp-q1',
        questionKey: 'kb.education.edu_sleep.q1.prompt',
        optionsKeys: [
          'kb.education.edu_sleep.q1.opt0',
          'kb.education.edu_sleep.q1.opt1',
          'kb.education.edu_sleep.q1.opt2',
        ],
        correctIndex: 1,
        explanationKey: 'kb.education.edu_sleep.q1.exp',
      },
      {
        id: 'slp-q2',
        questionKey: 'kb.education.edu_sleep.q2.prompt',
        optionsKeys: [
          'kb.education.edu_sleep.q2.opt0',
          'kb.education.edu_sleep.q2.opt1',
          'kb.education.edu_sleep.q2.opt2',
        ],
        correctIndex: 2,
        explanationKey: 'kb.education.edu_sleep.q2.exp',
      },
      {
        id: 'slp-q3',
        questionKey: 'kb.education.edu_sleep.q3.prompt',
        optionsKeys: [
          'kb.education.edu_sleep.q3.opt0',
          'kb.education.edu_sleep.q3.opt1',
          'kb.education.edu_sleep.q3.opt2',
        ],
        correctIndex: 0,
        explanationKey: 'kb.education.edu_sleep.q3.exp',
      },
    ],
  },
  {
    key: 'edu_exercise',
    achievementId: 'ach-edu-exercise',
    titleKey: 'kb.education.edu_exercise.title',
    summaryKey: 'kb.education.edu_exercise.summary',
    sourceKey: 'kb.education.edu_exercise.source',
    sourceUrl: 'https://ntrs.nasa.gov',
    questions: [
      {
        id: 'ex-q1',
        questionKey: 'kb.education.edu_exercise.q1.prompt',
        optionsKeys: [
          'kb.education.edu_exercise.q1.opt0',
          'kb.education.edu_exercise.q1.opt1',
          'kb.education.edu_exercise.q1.opt2',
        ],
        correctIndex: 1,
        explanationKey: 'kb.education.edu_exercise.q1.exp',
      },
      {
        id: 'ex-q2',
        questionKey: 'kb.education.edu_exercise.q2.prompt',
        optionsKeys: [
          'kb.education.edu_exercise.q2.opt0',
          'kb.education.edu_exercise.q2.opt1',
          'kb.education.edu_exercise.q2.opt2',
        ],
        correctIndex: 0,
        explanationKey: 'kb.education.edu_exercise.q2.exp',
      },
      {
        id: 'ex-q3',
        questionKey: 'kb.education.edu_exercise.q3.prompt',
        optionsKeys: [
          'kb.education.edu_exercise.q3.opt0',
          'kb.education.edu_exercise.q3.opt1',
          'kb.education.edu_exercise.q3.opt2',
        ],
        correctIndex: 2,
        explanationKey: 'kb.education.edu_exercise.q3.exp',
      },
    ],
  },
  {
    key: 'edu_readiness',
    achievementId: 'ach-edu-readiness',
    titleKey: 'kb.education.edu_readiness.title',
    summaryKey: 'kb.education.edu_readiness.summary',
    sourceKey: 'kb.education.edu_readiness.source',
    sourceUrl: 'https://standards.nasa.gov',
    questions: [
      {
        id: 'rd-q1',
        questionKey: 'kb.education.edu_readiness.q1.prompt',
        optionsKeys: [
          'kb.education.edu_readiness.q1.opt0',
          'kb.education.edu_readiness.q1.opt1',
          'kb.education.edu_readiness.q1.opt2',
        ],
        correctIndex: 0,
        explanationKey: 'kb.education.edu_readiness.q1.exp',
      },
      {
        id: 'rd-q2',
        questionKey: 'kb.education.edu_readiness.q2.prompt',
        optionsKeys: [
          'kb.education.edu_readiness.q2.opt0',
          'kb.education.edu_readiness.q2.opt1',
          'kb.education.edu_readiness.q2.opt2',
        ],
        correctIndex: 1,
        explanationKey: 'kb.education.edu_readiness.q2.exp',
      },
      {
        id: 'rd-q3',
        questionKey: 'kb.education.edu_readiness.q3.prompt',
        optionsKeys: [
          'kb.education.edu_readiness.q3.opt0',
          'kb.education.edu_readiness.q3.opt1',
          'kb.education.edu_readiness.q3.opt2',
        ],
        correctIndex: 2,
        explanationKey: 'kb.education.edu_readiness.q3.exp',
      },
    ],
  },
];

export function seedKnowledgeBase(db: Database.Database): void {
  const tx = db.transaction(() => {
    const insertTemplate = db.prepare(`
      INSERT INTO mission_templates (
        id, key, title_key, description_key, default_distance_km,
        orbital_altitude_km, orbit_period_minutes, sunrises_per_day,
        gcr_reference_msv_day, surface_gcr_reference_msv_day,
        typical_effective_min, typical_effective_max, typical_absorbed_max,
        default_one_way_light_sec, source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title_key = excluded.title_key,
        description_key = excluded.description_key,
        default_distance_km = excluded.default_distance_km,
        orbital_altitude_km = excluded.orbital_altitude_km,
        orbit_period_minutes = excluded.orbit_period_minutes,
        sunrises_per_day = excluded.sunrises_per_day,
        gcr_reference_msv_day = excluded.gcr_reference_msv_day,
        surface_gcr_reference_msv_day = excluded.surface_gcr_reference_msv_day,
        typical_effective_min = excluded.typical_effective_min,
        typical_effective_max = excluded.typical_effective_max,
        typical_absorbed_max = excluded.typical_absorbed_max,
        default_one_way_light_sec = excluded.default_one_way_light_sec,
        source_url = excluded.source_url
    `);
    for (const tpl of MISSION_TEMPLATES_SEED) {
      insertTemplate.run(
        tpl.id,
        tpl.key,
        tpl.titleKey,
        tpl.descriptionKey,
        tpl.defaultDistanceKm,
        tpl.orbitalAltitudeKm,
        tpl.orbitPeriodMinutes,
        tpl.sunrisesPerDay,
        tpl.gcrReferenceMsvPerDay,
        tpl.surfaceGcrReferenceMsvPerDay,
        tpl.typicalEffectiveDoseMin,
        tpl.typicalEffectiveDoseMax,
        tpl.typicalAbsorbedDoseMax,
        tpl.defaultOneWayLightSec,
        tpl.sourceUrl
      );
    }

    const insertRule = db.prepare(`
      INSERT INTO reference_rules (
        id, category, parameter, severity, label, status,
        threshold_value, threshold_unit, title_key, explanation_key,
        next_step_key, source_citation_key, source_url,
        notify_doctor, notify_commander, custom_guidance, custom_threshold, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        parameter = excluded.parameter,
        label = excluded.label,
        status = excluded.status,
        title_key = excluded.title_key,
        explanation_key = excluded.explanation_key,
        next_step_key = excluded.next_step_key,
        source_citation_key = excluded.source_citation_key,
        source_url = excluded.source_url,
        notify_doctor = excluded.notify_doctor,
        notify_commander = excluded.notify_commander
    `);
    for (const r of REFERENCE_RULES_SEED) {
      insertRule.run(
        r.id,
        r.category,
        r.parameter,
        r.severity,
        r.label,
        r.status,
        r.thresholdValue,
        r.thresholdUnit,
        r.titleKey,
        r.explanationKey,
        r.nextStepKey,
        r.sourceCitationKey,
        r.sourceUrl,
        r.notifyDoctor,
        r.notifyCommander
      );
    }

    const insertInstrument = db.prepare(`
      INSERT INTO instruments (id, category, code, name_key, description_key, allow_custom, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        code = excluded.code,
        name_key = excluded.name_key,
        description_key = excluded.description_key,
        allow_custom = excluded.allow_custom,
        sort_order = excluded.sort_order
    `);
    for (const inst of INSTRUMENTS_SEED) {
      insertInstrument.run(
        inst.id,
        inst.category,
        inst.code,
        inst.nameKey,
        inst.descriptionKey,
        inst.allowCustom,
        inst.sortOrder
      );
    }

    const insertProtocol = db.prepare(`
      INSERT INTO protocols (id, title_key, purpose_key, frequency, role_scope, estimated_minutes, safety_note_key, source_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title_key = excluded.title_key,
        purpose_key = excluded.purpose_key,
        frequency = excluded.frequency,
        role_scope = excluded.role_scope,
        estimated_minutes = excluded.estimated_minutes,
        safety_note_key = excluded.safety_note_key,
        source_url = excluded.source_url
    `);
    const insertStep = db.prepare(`
      INSERT INTO protocol_steps (id, protocol_id, step_number, text_key)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        step_number = excluded.step_number,
        text_key = excluded.text_key
    `);
    for (const prt of PROTOCOLS_SEED) {
      insertProtocol.run(
        prt.id,
        prt.titleKey,
        prt.purposeKey,
        prt.frequency,
        prt.roleScope,
        prt.estimatedMinutes,
        prt.safetyNoteKey,
        prt.sourceUrl
      );
      for (const st of prt.steps) {
        insertStep.run(`${prt.id}-S${st.stepNumber}`, prt.id, st.stepNumber, st.textKey);
      }
    }

    const insertAch = db.prepare(`
      INSERT INTO achievements_catalog (id, key, kind, points, title_key, description_key, unlock_hint_key, target_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        key = excluded.key,
        kind = excluded.kind,
        points = excluded.points,
        title_key = excluded.title_key,
        description_key = excluded.description_key,
        unlock_hint_key = excluded.unlock_hint_key,
        target_value = excluded.target_value
    `);
    for (const ach of ACHIEVEMENTS_CATALOG_SEED) {
      insertAch.run(
        ach.id,
        ach.key,
        ach.kind,
        ach.points,
        ach.titleKey,
        ach.descriptionKey,
        ach.unlockHintKey,
        ach.targetValue
      );
    }

    const insertCard = db.prepare(`
      INSERT INTO education_cards (key, achievement_id, title_key, summary_key, source_key, source_url)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        achievement_id = excluded.achievement_id,
        title_key = excluded.title_key,
        summary_key = excluded.summary_key,
        source_key = excluded.source_key,
        source_url = excluded.source_url
    `);
    const insertQuiz = db.prepare(`
      INSERT INTO education_quiz (id, card_key, question_order, question_key, options_json, correct_index, explanation_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        question_order = excluded.question_order,
        question_key = excluded.question_key,
        options_json = excluded.options_json,
        correct_index = excluded.correct_index,
        explanation_key = excluded.explanation_key
    `);
    for (const card of EDUCATION_CARDS_SEED) {
      insertCard.run(
        card.key,
        card.achievementId,
        card.titleKey,
        card.summaryKey,
        card.sourceKey,
        card.sourceUrl
      );
      card.questions.forEach((q, idx) => {
        insertQuiz.run(
          q.id,
          card.key,
          idx + 1,
          q.questionKey,
          JSON.stringify(q.optionsKeys),
          q.correctIndex,
          q.explanationKey
        );
      });
    }
  });

  tx();
}
