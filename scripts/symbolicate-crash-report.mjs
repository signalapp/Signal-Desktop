// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { tmpdir } from 'node:os';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { gunzip as gunzipCb } from 'node:zlib';
import { join, basename } from 'node:path';
import { promisify } from 'node:util';
import { symbolicate } from '@electron/symbolicate-mac';
import pMap from 'p-map';
import { assert } from './utils/assert.mjs';

/// <reference path="./utils/symbolicate-mac.d.ts">

const gunzip = promisify(gunzipCb);

if (!process.argv[2]) {
  throw new Error('Usage: node symbolicate-crash-report.js <input>');
}
const INPUT_FILE = process.argv[2];

let file = await readFile(INPUT_FILE);
try {
  file = await gunzip(file);
} catch (error) {
  console.error('Failed to decompress, perhaps file is a plaintext?');
}

const matches = file
  .toString()
  .matchAll(
    /WARN[^\n]*crashReports:\s+dump=\[REDACTED\]([0-9a-z]+).dmp\s+mtime="([\d\-T:.Z]+)"\s+({(\n|.)*?\n})/g
  );

/**
 * @param {string | undefined} filename
 * @returns {string}
 */
function moduleName(filename) {
  if (!filename) {
    return '';
  }

  if (filename.startsWith('signal-desktop-')) {
    return 'electron';
  }

  if (filename.startsWith('Signal') && filename.endsWith('.exe')) {
    return 'electron.exe.pdb';
  }
  return filename;
}

/** @type {Array<string>} */
const dumps = [];
for (const match of matches) {
  const [, dump, mtime, json] = match;
  assert(dump != null, 'Missing dump');
  assert(mtime != null, 'Missing mtime');
  assert(json != null, 'Missing json');
  const out = [];

  let info;
  try {
    info = JSON.parse(json);
  } catch (error) {
    console.error('Failed to parse JSON, ignoring', dump, mtime, error);
    continue;
  }

  out.push(`## dump=${dump} mtime=${mtime}`);
  out.push('');
  out.push('```');

  for (const [index, frame] of info.crashing_thread.frames.entries()) {
    out.push(`${index} ${moduleName(frame.module)} ${frame.offset} () + 0`);
  }

  out.push('');

  for (const m of info.modules) {
    const filename = moduleName(m.filename);

    out.push(
      `${m.base_addr} - ${m.end_addr} ` +
        `${filename.replace(/\s+/g, '-')} (${m.version}) ` +
        `<${m.debug_id.slice(0, -1)}> ${filename}`
    );
  }
  out.push('```');

  dumps.push(out.join('\n'));
}

const tmpFolder = await mkdtemp(join(tmpdir(), 'parse-crash-reports'));

const result = await pMap(
  dumps,
  async (text, i) => {
    const tmpFile = join(tmpFolder, `${i}.txt`);
    await writeFile(tmpFile, text);

    console.error(`Symbolicating: ${tmpFile}`);
    return symbolicate({ file: tmpFile });
  },
  { concurrency: 1 }
);

console.log(`# Crash Report ${basename(INPUT_FILE)}`);
console.log('');
console.log(result.join('\n'));
