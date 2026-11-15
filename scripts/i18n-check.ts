import fs from 'node:fs';
import path from 'node:path';

type Dict = Record<string, unknown>;

function flattenLeaves(obj: Dict, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out.set(full, v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of flattenLeaves(v as Dict, full)) {
        out.set(ck, cv);
      }
    }
  }
  return out;
}

const ALLOWED_TOKENS = new Set([
  'ASTRA',
  'UTC',
  'GMT',
  'bpm',
  'mmHg',
  'kPa',
  'psia',
  'mGy',
  'mSv',
  'Gy',
  'Sv',
  'mGy/day',
  'mSv/day',
  'km',
  'km/s',
  'mi',
  'h',
  'min',
  's',
  'C',
  'F',
  'DELETE',
  'EN',
  'ع',
  'CSV',
  'JSON',
  'ZIP',
  'SSE',
  'ppCO2',
  'ppO2',
  'ISS',
  'LEO',
  'CAD',
  'ISS-RAD',
  'SPE',
  'ALARA',
  'X',
  'Y',
  'M10',
  'M',
  'L',
]);

function isAllowedLiteral(raw: string): boolean {
  const trimmed = raw
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!trimmed) return true;
  if (!/[A-Za-z]/.test(trimmed)) return true;
  if (ALLOWED_TOKENS.has(trimmed)) return true;
  const words = trimmed
    .replace(/[()[\]{}:;.,!?/+×÷—–•<>=\-0-9%°"'`]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => ALLOWED_TOKENS.has(w));
}

function lineAt(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (src.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function scanFile(filePath: string, src: string, errors: string[]): void {
  const rel = path.relative(process.cwd(), filePath);

  const attrRegex =
    /\b(placeholder|title|aria-label|alt)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|\{\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\}|\{\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*\})/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(src)) !== null) {
    const attrName = match[1];
    const val = match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
    if (!isAllowedLiteral(val)) {
      errors.push(`${rel}:${lineAt(src, match.index)}: Hardcoded ${attrName}="${val}"`);
    }
  }

  let i = 0;
  const n = src.length;

  const skipQuoted = (quote: string) => {
    i += 1;
    while (i < n) {
      if (src[i] === '\\') {
        i += 2;
        continue;
      }
      if (src[i] === quote) {
        i += 1;
        return;
      }
      if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        scanBracedExpr();
        continue;
      }
      i += 1;
    }
  };

  const skipComment = (): boolean => {
    if (src[i] === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      return true;
    }
    if (src[i] === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      return true;
    }
    return false;
  };

  const looksLikeJsxStart = (): boolean => {
    if (src[i] !== '<') return false;
    if (src[i + 1] === '>') {
      const before = src.slice(Math.max(0, i - 24), i).trimEnd();
      return /(?:\breturn|\(|\?|:|&&|\|\||=>)$/.test(before);
    }
    const rest = src.slice(i + 1, i + 45);
    if (!/^[A-Za-z][A-Za-z0-9._-]*[\s>\/]/.test(rest)) return false;
    const before = src.slice(Math.max(0, i - 24), i).trimEnd();
    return /(?:\breturn|\(|\?|:|&&|\|\||=>)$/.test(before);
  };

  const scanJsxElement = (): void => {
    // Assumes src[i] === '<'
    if (src[i + 1] === '>') {
      i += 2;
    } else {
      i += 1;
      while (i < n && /[A-Za-z0-9._-]/.test(src[i])) i += 1;
      // Attributes until '>' or '/>'
      while (i < n) {
        if (src[i] === '"' || src[i] === "'") {
          skipQuoted(src[i]);
          continue;
        }
        if (src[i] === '{') {
          i += 1;
          scanBracedExpr();
          continue;
        }
        if (src[i] === '/' && src[i + 1] === '>') {
          i += 2;
          return;
        }
        if (src[i] === '>') {
          i += 1;
          break;
        }
        i += 1;
      }
    }

    // Children until matching '</...>'
    while (i < n) {
      if (src[i] === '{') {
        i += 1;
        scanBracedExpr();
        continue;
      }
      if (src[i] === '<') {
        if (src[i + 1] === '/') {
          const closeEnd = src.indexOf('>', i + 2);
          i = closeEnd !== -1 ? closeEnd + 1 : n;
          return;
        }
        if (src[i + 1] === '>' || /^[A-Za-z]/.test(src[i + 1] ?? '')) {
          scanJsxElement();
          continue;
        }
      }
      const start = i;
      while (i < n && src[i] !== '{' && src[i] !== '<') i += 1;
      const chunk = src.slice(start, i);
      if (!isAllowedLiteral(chunk)) {
        errors.push(`${rel}:${lineAt(src, start)}: Hardcoded JSX text "${chunk.trim()}"`);
      }
    }
  };

  const scanBracedExpr = (): void => {
    // Assumes opening '{' was just consumed
    let depth = 1;
    while (i < n && depth > 0) {
      if (skipComment()) continue;
      if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
        skipQuoted(src[i]);
        continue;
      }
      if (src[i] === '{') {
        depth += 1;
        i += 1;
        continue;
      }
      if (src[i] === '}') {
        depth -= 1;
        i += 1;
        continue;
      }
      if (looksLikeJsxStart()) {
        scanJsxElement();
        continue;
      }
      i += 1;
    }
  };

  while (i < n) {
    if (skipComment()) continue;
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      skipQuoted(src[i]);
      continue;
    }
    if (looksLikeJsxStart()) {
      scanJsxElement();
      continue;
    }
    i += 1;
  }
}

function scanTsxFiles(dir: string): string[] {
  const errors: string[] = [];
  if (!fs.existsSync(dir)) return errors;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(dir, f));

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    scanFile(filePath, content, errors);
  }
  return errors;
}

function main() {
  const root = process.cwd();
  const enPath = path.join(root, 'locales', 'en.json');
  const arPath = path.join(root, 'locales', 'ar.json');
  const reviewPath = path.join(root, 'locales', 'review-status.json');

  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8')) as Dict;
  const arJson = JSON.parse(fs.readFileSync(arPath, 'utf8')) as Dict;
  const reviewJson = fs.existsSync(reviewPath)
    ? (JSON.parse(fs.readFileSync(reviewPath, 'utf8')) as Record<string, { reviewed: boolean }>)
    : {};

  const enLeaves = flattenLeaves(enJson);
  const arLeaves = flattenLeaves(arJson);

  const errors: string[] = [];

  for (const [key, val] of enLeaves.entries()) {
    if (!arLeaves.has(key)) {
      errors.push(`Missing Arabic key: ${key}`);
    } else if (!val.trim()) {
      errors.push(`Empty English value: ${key}`);
    }
  }

  for (const [key, val] of arLeaves.entries()) {
    if (!enLeaves.has(key)) {
      errors.push(`Extra Arabic key not in English: ${key}`);
    } else if (!val.trim()) {
      errors.push(`Empty Arabic value: ${key}`);
    }
    const status = reviewJson[key];
    if (!status || typeof status.reviewed !== 'boolean') {
      errors.push(`Missing review-status entry for key: ${key}`);
    }
  }

  errors.push(...scanTsxFiles(path.join(root, 'src', 'pages')));
  errors.push(...scanTsxFiles(path.join(root, 'src', 'components')));

  if (errors.length > 0) {
    console.error(`i18n-check failed with ${errors.length} issue(s):`);
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `i18n-check passed: ${enLeaves.size} EN/AR keys matched, ${Object.keys(reviewJson).length} review-status entries verified, 0 hardcoded JSX strings.`
  );
}

main();
