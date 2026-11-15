import type { UserPreferences } from '../types';

/**
 * Display-time unit conversions only.
 * Stored database values ALWAYS remain in base units:
 * - Temperature: Celsius (C)
 * - Cabin / partial pressures: kPa (atmosphere total) or mmHg (BP / ppO2 / ppCO2)
 * - Distance: kilometers (km)
 * - Blood Pressure: ALWAYS mmHg (never converted)
 * - Radiation: absorbed (mGy) and effective (mSv) are NEVER converted into each other
 */

export function formatTemperatureDisplay(
  tempC: number,
  unit: UserPreferences['units']['temperature']
): { value: number; formatted: string; unitLabel: string } {
  if (unit === 'F') {
    const f = Number(((tempC * 9) / 5 + 32).toFixed(1));
    return { value: f, formatted: `${f}`, unitLabel: 'F' };
  }
  const c = Number(tempC.toFixed(1));
  return { value: c, formatted: `${c}`, unitLabel: 'C' };
}

export function formatPressureFromKpa(
  pressureKpa: number,
  unit: UserPreferences['units']['pressure']
): { value: number; formatted: string; unitLabel: string } {
  if (unit === 'psia') {
    const psia = Number((pressureKpa * 0.1450377).toFixed(2));
    return { value: psia, formatted: `${psia}`, unitLabel: 'psia' };
  }
  if (unit === 'mmHg') {
    const mmhg = Number((pressureKpa * 7.50062).toFixed(1));
    return { value: mmhg, formatted: `${mmhg}`, unitLabel: 'mmHg' };
  }
  const kpa = Number(pressureKpa.toFixed(1));
  return { value: kpa, formatted: `${kpa}`, unitLabel: 'kPa' };
}

export function formatDistanceDisplay(
  distanceKm: number,
  unit: UserPreferences['units']['distance']
): { value: number; formatted: string; unitLabel: string } {
  if (unit === 'mi') {
    const mi = distanceKm * 0.621371;
    const rounded = distanceKm >= 1000 ? Math.round(mi) : Number(mi.toFixed(1));
    return {
      value: rounded,
      formatted: `${rounded.toLocaleString('en-US')}`,
      unitLabel: 'mi',
    };
  }
  const rounded = distanceKm >= 100 ? Math.round(distanceKm) : Number(distanceKm.toFixed(1));
  return {
    value: rounded,
    formatted: `${rounded.toLocaleString('en-US')}`,
    unitLabel: 'km',
  };
}
