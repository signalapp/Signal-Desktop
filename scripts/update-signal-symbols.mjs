// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { readFile, copyFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { assert } from './utils/assert.mjs';
import { z } from 'zod/mini';

const DESIGN_ASSETS_PATH = process.env.DESIGN_ASSETS_PATH;
assert(DESIGN_ASSETS_PATH != null, 'Missing DESIGN_ASSETS_PATH');

const DESKTOP_ROOT_DIR = join(import.meta.dirname, '..');
const DESIGN_ROOT_DIR = resolve(DESKTOP_ROOT_DIR, DESIGN_ASSETS_PATH);

const DESIGN_SYMBOLS_FONT_PATH = join(
  DESIGN_ROOT_DIR,
  'signal-symbols',
  'font',
  'SignalSymbolsVariable.woff2'
);

const DESKTOP_SYMBOLS_FONT_PATH = join(
  DESKTOP_ROOT_DIR,
  'fonts',
  'signal-symbols',
  'SignalSymbolsVariable.woff2'
);

const DESIGN_SYMBOLS_JSON_PATH = join(
  DESIGN_ROOT_DIR,
  'signal-symbols',
  'font',
  'symbols.json'
);

const DESKTOP_SYMBOLS_DEFS_PATH = join(
  DESKTOP_ROOT_DIR,
  'ts',
  'axo',
  '_internal',
  'AxoSymbolDefs.generated.std.ts'
);

/**
 * @typedef {Readonly<{ name: string; unicode: string }>} Glyph
 * @typedef {ReadonlyArray<Glyph>} Glyphs
 * @typedef {string | { ltr: string; rtl: string }} AxoSymbolBidi
 * @typedef {{ icon: AxoSymbolBidi | null; inline: AxoSymbolBidi | null }} AxoSymbolValue
 * @typedef {Readonly<{ name: string; value: AxoSymbolValue }>} AxoSymbol
 */

async function copyVariableFontFile() {
  await copyFile(DESIGN_SYMBOLS_FONT_PATH, DESKTOP_SYMBOLS_FONT_PATH);
}

const SymbolsJsonSchema = z.array(
  z.object({
    name: z.string(),
    unicode: z.string(),
  })
);

/**
 * @param {string} name
 * @param {`-${string}`} tag
 * @returns {boolean}
 */
function hasTag(name, tag) {
  return name.endsWith(tag) || name.includes(`${tag}-`);
}

/**
 * @param {string} name
 * @returns {string}
 */
function stripWide(name) {
  return name.replace(/-wide$/, '').replace(/-wide-/, '-');
}

/**
 * @param {string} name
 * @returns {string}
 */
function stripRtl(name) {
  return name.replace(/-rtl$/, '').replace('-rtl-', '-');
}

/**
 * @param {string} name
 * @returns {string}
 */
function stripFill(name) {
  return name.replace(/-fill$/, '').replace('-fill-', '-');
}

const AUTO_FLIP_PATTERNS = new Set([
  'arrow-*',
  'arrow-up*',
  'arrow-down*',
  'arrow-circle-*',
  'arrow-circle-up*',
  'arrow-circle-down*',
  'arrow-circle-dashed-*',
  'arrow-circle-dashed-up*',
  'arrow-circle-dashed-down*',
  'arrow-square-*',
  'arrow-square-up*',
  'arrow-square-down*',
  'arrow-rectangle-*',
  'chevron-*',
  'chevron-circle-*',
  'chevron-square-*',
  'chevron-shallow-*',
  'textalign-*',
  'arrow-outward-up*-down*',
  'arrow-inward-up*-down*',
  'arrow-square-outward-up*-down*',
  'arrow-square-inward-up*-down*',
  'chevron-rectangle-outward-up*-down*',
]);

const IGNORE_AUTO_RTL = new Set([
  'chevron-outward-left-right', // <-> same when flipped
  'arrow-left-right', // <-> same when flipped
  'arrow-square-left-right', // <-> same when flipped
  'arrow-square-left-right-fill', // <-> same when flipped
  'arrow-outward-upleft-upright-downleft-downright', // × same when flipped
  'arrow-inward-upleft-upright-downleft-downright', // × same when flipped

  'chevron-rectangle-outward-upright-downleft', // TODO: Missing flipped version
]);

/**
 * @param {string} name
 * @returns {{ ltr: string; rtl: string } | null}
 */
function getAutoFlipNames(name, base) {
  const hasInlineDir = name.includes('left') || name.includes('right');
  if (!hasInlineDir) {
    return null;
  }

  if (IGNORE_AUTO_RTL.has(name)) {
    return null;
  }

  const pattern = stripFill(base)
    .replaceAll('left', '*')
    .replaceAll('right', '*')
    .replace('-fill', '');

  assert(
    AUTO_FLIP_PATTERNS.has(pattern),
    `"${name}" with pattern "${pattern}" is neither ignored or matches an auto-flip pattern`
  );

  return {
    ltr: base.replace('left', '[start]').replace('right', '[end]'),
    rtl: base.replace('right', '[start]').replace('left', '[end]'),
  };
}

async function generateAxoSymbolDefs2() {
  const text = await readFile(DESIGN_SYMBOLS_JSON_PATH, 'utf-8');
  const json = JSON.parse(text);
  const data = SymbolsJsonSchema.parse(json);

  /** @type {Map<string, string>} */
  const ALL = new Map();
  for (const entry of data) {
    ALL.set(entry.name, entry.unicode);
  }

  /** @type {Map<string, string>} */
  const BASE = new Map();
  /** @type {Map<string, string>} */
  const RTL = new Map();
  /** @type {Map<string, string>} */
  const WIDE = new Map();
  /** @type {Map<string, string>} */
  const WIDE_RTL = new Map();

  for (const [name, code] of ALL) {
    const base = stripRtl(stripWide(name));

    const isWide = hasTag(name, '-wide');
    const isRTL = hasTag(name, '-rtl');

    const autoFlip = getAutoFlipNames(name, base);

    if (isRTL) {
      assert(autoFlip == null, 'cannot have rtl and auto flip names');
    }

    if (isWide) {
      if (isRTL) {
        WIDE_RTL.set(base, code);
      } else if (autoFlip != null) {
        WIDE.set(autoFlip.ltr, code);
        WIDE_RTL.set(autoFlip.rtl, code);
      } else {
        WIDE.set(base, code);
      }
    } else if (isRTL) {
      RTL.set(base, code);
    } else if (autoFlip != null) {
      BASE.set(autoFlip.ltr, code);
      RTL.set(autoFlip.rtl, code);
    } else {
      BASE.set(base, code);
    }
  }

  let res = '';

  res += `// Copyright 2026 Signal Messenger, LLC\n`;
  res += `// SPDX-License-Identifier: AGPL-3.0-only\n`;
  res += '\n';

  {
    res += 'export type _AxoSymbolName =\n';
    const lines = [];
    for (const base of BASE.keys()) {
      lines.push(`  | '${base}'`);
    }
    res += lines.join('\n') + ';\n';
    res += '\n';
  }
  res += '\n';
  {
    res += 'const BASE: Record<string, string> = {\n';
    for (const [base, code] of BASE) {
      res += `  '${base}': '\\u{${code}}',\n`;
    }
    res += '};\n';
  }
  res += '\n';
  {
    res += 'const RTL: Record<string, string> = {\n';
    for (const [base, code] of RTL) {
      res += `  '${base}': '\\u{${code}}',\n`;
    }
    res += '};\n';
  }
  res += '\n';
  {
    res += 'const WIDE: Record<string, string> = {\n';
    for (const [base, code] of WIDE) {
      res += `  '${base}': '\\u{${code}}',\n`;
    }
    res += '};\n';
  }
  res += '\n';
  {
    res += 'const WIDE_RTL: Record<string, string> = {\n';
    for (const [base, code] of WIDE_RTL) {
      res += `  '${base}': '\\u{${code}}',\n`;
    }
    res += '};\n';
  }

  res += '\n';

  res += `/** @testexport */
export function _getAllAxoSymbolNames(): ReadonlyArray<_AxoSymbolName> {
  return Object.keys(BASE) as Array<_AxoSymbolName>;
}

export function _getAxoSymbolIcon(
  name: _AxoSymbolName,
  dir: 'ltr' | 'rtl'
): string {
  const value = dir === 'rtl'
    ? (WIDE_RTL[name] ?? RTL[name] ?? WIDE[name] ?? BASE[name])
    : (WIDE[name] ?? BASE[name]);
  if (value == null) {
    throw new TypeError(\`Invalid symbol name for icon: \${name}\`);
  }
  return value;
}

export function _getAxoSymbolInlineGlyph(
  name: _AxoSymbolName,
  dir: 'ltr' | 'rtl'
): string {
  const value = dir === 'rtl'
    ? (RTL[name] ?? BASE[name])
    : BASE[name];
  if (value == null) {
    throw new TypeError(\`Invalid symbol name for inline glyph: \${name}\`);
  }
  return value;
}\n`;

  await writeFile(DESKTOP_SYMBOLS_DEFS_PATH, res, 'utf-8');
}

await Promise.all([copyVariableFontFile(), generateAxoSymbolDefs2()]);
