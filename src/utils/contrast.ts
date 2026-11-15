export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RgbColor {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

export function compositeOver(
  fg: RgbColor,
  alpha: number,
  bg: RgbColor
): RgbColor {
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  };
}

export function relativeLuminance(rgb: RgbColor): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(parseHexColor(fgHex));
  const l2 = relativeLuminance(parseHexColor(bgHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function contrastRatioRgb(fg: RgbColor, bg: RgbColor): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export const THEME_PALETTES = {
  dark: {
    bg: '#080F20',
    bg2: '#0D172A',
    card: '#141D32',
    elevated: '#202B42',
    line: '#2a3652',
    borderUi: '#566A94',
    accent: '#35CFFF',
    primaryBtnText: '#06101F',
    blue: '#258CFF',
    purple: '#8A78FF',
    text: '#E2E9FF',
    text2: '#AAB8D4',
    warning: '#F3B65A',
    high: '#F06B78',
    ok: '#52D6B5',
    badges: {
      purple: { text: '#CFC6FF', border: '#8A78FF', tintAlpha: 0.16, tintHex: '#8A78FF' },
      green: { text: '#7EEAD0', border: '#52D6B5', tintAlpha: 0.14, tintHex: '#52D6B5' },
      amber: { text: '#F7C97E', border: '#F3B65A', tintAlpha: 0.14, tintHex: '#F3B65A' },
      red: { text: '#F79AA3', border: '#F06B78', tintAlpha: 0.15, tintHex: '#F06B78' },
      cyan: { text: '#7EE0FF', border: '#35CFFF', tintAlpha: 0.14, tintHex: '#35CFFF' },
      neutral: { text: '#C7D3EB', border: '#6A7B9E', tintAlpha: 0.14, tintHex: '#AAB8D4' },
    },
  },
  light: {
    bg: '#F4F7FC',
    bg2: '#EAF0F9',
    card: '#FFFFFF',
    elevated: '#F0F4FB',
    line: '#D3DCEB',
    borderUi: '#5E7091',
    accent: '#0077B6',
    primaryBtnText: '#FFFFFF',
    blue: '#1A6FD6',
    purple: '#5B48D6',
    text: '#0E1A33',
    text2: '#475775',
    warning: '#9A6200',
    high: '#C62839',
    ok: '#12795F',
    badges: {
      purple: { text: '#4C3AC7', border: '#5B48D6', tintAlpha: 0.1, tintHex: '#5B48D6' },
      green: { text: '#0F6B54', border: '#12795F', tintAlpha: 0.1, tintHex: '#12795F' },
      amber: { text: '#855400', border: '#9A6200', tintAlpha: 0.1, tintHex: '#9A6200' },
      red: { text: '#B02030', border: '#C62839', tintAlpha: 0.1, tintHex: '#C62839' },
      cyan: { text: '#006399', border: '#0077B6', tintAlpha: 0.1, tintHex: '#0077B6' },
      neutral: { text: '#374763', border: '#5E7091', tintAlpha: 0.12, tintHex: '#475775' },
    },
  },
} as const;
