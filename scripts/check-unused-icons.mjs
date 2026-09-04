// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { assert } from './utils/assert.mjs';
import { styleText } from 'node:util';
import fastGlob from 'fast-glob';

const ROOT_DIR = join(import.meta.dirname, '..');
const STYLESHEETS_DIR = join(ROOT_DIR, 'stylesheets');
const MANIFEST_CSS_PATH = join(STYLESHEETS_DIR, 'manifest.css');
const ICON_PATTERNS = ['images/icons/**/*.svg'];

const VERBOSE = process.argv.includes('--verbose');
const FIX = process.argv.includes('--fix');

const icons = await fastGlob(ICON_PATTERNS);
if (icons.length === 0) {
  throw new Error(`No icons found in: ${ICON_PATTERNS.join(', ')}`);
}

const minifiedCss = await readFile(MANIFEST_CSS_PATH, 'utf-8');

// Extract all url("...") values and filter to images/icons/
const urls = Array.from(minifiedCss.matchAll(/url\("([^"]+)"\)/g), match => {
  const url = match.at(1);
  assert(url != null, 'missing url');
  return url;
});

let refCount = 0;
/** @type {Map<string, number>} */
const refs = new Map();

for (const url of urls) {
  if (url.includes('images/icons/')) {
    const ref = relative(ROOT_DIR, resolve(STYLESHEETS_DIR, url));
    refCount += 1;
    const prev = refs.get(ref) ?? 0;
    refs.set(ref, prev + 1);
  }
}

if (refs.size === 0) {
  throw new Error(
    `No icon refs found in ${relative(ROOT_DIR, MANIFEST_CSS_PATH)}`
  );
}

/** @type {Array<string>} */
const unused = [];

const sorted = icons.toSorted((a, b) => {
  const aCount = refs.get(a) ?? 0;
  const bCount = refs.get(b) ?? 0;
  return bCount - aCount;
});

for (const svg of sorted) {
  const count = refs.get(svg) ?? 0;
  if (count === 0) {
    unused.push(svg);
    let log = '';
    log += styleText('red', 'UNUSED:');
    log += ' ';
    log += styleText('dim', `${dirname(svg)}/`);
    log += styleText('red', basename(svg));
    console.log(log);
  } else if (VERBOSE) {
    let log = '';
    log += styleText('green', 'USED:');
    log += ' ';
    log += styleText('cyan', `(refs: ${count})`);
    log += ' ';
    log += styleText('dim', `${dirname(svg)}/`);
    log += styleText('green', basename(svg));
    console.log(log);
  } else {
    continue;
  }
}

const totalCount = icons.length;
const unusedCount = unused.length;
const usedCount = totalCount - unusedCount;

console.log(`Total icons: ${styleText('cyan', `${totalCount}`)}`);
console.log(`Total icon references: ${styleText('cyan', `${refCount}`)}`);
console.log(`Total unused icons: ${styleText('red', `${unusedCount}`)}`);
console.log(`Total used icons: ${styleText('green', `${usedCount}`)}`);

if (FIX) {
  console.log('Deleting unused icons...');
  await Promise.all(
    unused.map(async svg => {
      await rm(relative(ROOT_DIR, svg));
    })
  );
  console.log(`Deleted ${unusedCount} files`);

  if (totalCount === unusedCount) {
    process.stdout.write(
      styleText('bgGreen', 'We did it! We migrated all of the icons!')
    );
    for (let i = 0; i < 5000; i += 1) {
      // oxlint-disable-next-line no-await-in-loop
      await new Promise(cb => setTimeout(cb, 1));
      process.stdout.write(styleText('bgGreen', '!'));
    }
    process.stdout.write('\n');
    console.log(styleText('bgRed', '\n\n\nNow delete this script\n\n\n'));
    process.exit(1);
  }

  process.exit(0);
}

if (unusedCount > 0) {
  console.log();
  console.log(
    styleText('red', 'Found unused icons, run again with --fix to remove')
  );
  console.log();
  process.exit(1);
}
