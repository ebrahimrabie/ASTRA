import type { UserPreferences } from '../types';

export const ASTRA_PREFS_STORAGE_KEY = 'astra.prefs';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'dark',
  language: 'en',
  numerals: 'western',
  notifications: {
    inAppMonitor: true,
    inAppReview: true,
    inAppHighPriority: true,
    browserNotifications: false,
    dailyReminderTime: '09:00',
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '06:00',
  },
  units: {
    temperature: 'C',
    pressure: 'kPa',
    distance: 'km',
  },
};

export function mergePreferences(
  partial?: Partial<UserPreferences> | null
): UserPreferences {
  if (!partial) return { ...DEFAULT_USER_PREFERENCES };
  return {
    theme:
      partial.theme === 'light' || partial.theme === 'system' || partial.theme === 'dark'
        ? partial.theme
        : DEFAULT_USER_PREFERENCES.theme,
    language: partial.language === 'ar' ? 'ar' : 'en',
    numerals: partial.numerals === 'arabic_indic' ? 'arabic_indic' : 'western',
    notifications: {
      ...DEFAULT_USER_PREFERENCES.notifications,
      ...(partial.notifications ?? {}),
    },
    units: {
      ...DEFAULT_USER_PREFERENCES.units,
      ...(partial.units ?? {}),
    },
  };
}

export function loadStoredPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_USER_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(ASTRA_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return mergePreferences(parsed);
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function saveStoredPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ASTRA_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota / privacy mode failures
  }
}

export function resolveEffectiveTheme(
  theme: UserPreferences['theme']
): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'dark';
}

export function applyThemeToDocument(theme: UserPreferences['theme']): 'dark' | 'light' {
  const effective = resolveEffectiveTheme(theme);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.style.colorScheme = effective;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', effective === 'dark' ? '#080F20' : '#F4F7FC');
    }
  }
  return effective;
}

export function isWithinQuietHours(
  prefs: UserPreferences,
  nowDate = new Date()
): boolean {
  if (!prefs.notifications.quietHoursEnabled) return false;
  const parseMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const nowMin = nowDate.getUTCHours() * 60 + nowDate.getUTCMinutes();
  const start = parseMin(prefs.notifications.quietStart);
  const end = parseMin(prefs.notifications.quietEnd);
  if (start === end) return false;
  if (start < end) {
    return nowMin >= start && nowMin < end;
  }
  return nowMin >= start || nowMin < end;
}
