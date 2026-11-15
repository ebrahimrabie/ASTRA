import { useI18n } from '../i18n';

type BadgeTone = 'purple' | 'green' | 'amber' | 'red' | 'cyan' | 'neutral';

const TONE_MAP: Record<string, BadgeTone> = {
  SIMULATED: 'purple',
  'SIMULATED DATA': 'purple',
  'DEMO DATA': 'purple',
  DOCTOR: 'purple',
  PROTOTYPE_DEFAULT: 'purple',
  'PROTOTYPE DEFAULT': 'purple',

  ONLINE: 'green',
  COMPLETED: 'green',
  NORMAL: 'green',
  'BACKEND SYNCED': 'green',
  VALID: 'green',
  ACTIVE: 'green',

  OFFLINE: 'amber',
  'SYNC PENDING': 'amber',
  MONITOR: 'amber',
  REVIEW: 'amber',
  STALE: 'amber',
  LATE: 'amber',
  DEFERRED: 'amber',
  'LOCAL ONLY': 'amber',

  ALERT: 'red',
  'HIGH PRIORITY': 'red',
  HIGH_PRIORITY: 'red',
  OVERDUE: 'red',
  INVALID: 'red',

  PENDING: 'cyan',
  CONNECTING: 'cyan',
  INFORMATION: 'cyan',
  COMMANDER: 'cyan',
  NASA_REFERENCE: 'cyan',
  'NASA REFERENCE': 'cyan',
  CLINICAL_REFERENCE: 'cyan',
  'CLINICAL REFERENCE': 'cyan',

  CREW: 'neutral',
  UNKNOWN: 'neutral',
  NOT_CONFIGURED: 'neutral',
  'INSUFFICIENT DATA': 'neutral',
};

const ICON_MAP: Partial<Record<BadgeTone, string>> = {
  red: '!',
  amber: '▲',
  green: '✓',
  cyan: 'ℹ',
};

export function Badge({
  label,
  canonicalCode,
}: {
  label: string;
  canonicalCode?: string;
}) {
  const { t, trStatus } = useI18n();
  const canonical = (canonicalCode ?? label).toUpperCase();
  const tone = TONE_MAP[canonical] ?? TONE_MAP[label.toUpperCase()] ?? 'neutral';
  const icon = ICON_MAP[tone];
  const display = trStatus(label);

  return (
    <span
      className={`badge badge-${tone}`}
      title={canonical}
      aria-description={t('status.STATUS_CODE_A11Y', { code: canonical })}
    >
      {icon && (
        <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
          {icon}
        </span>
      )}
      {display}
    </span>
  );
}
