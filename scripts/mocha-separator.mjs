// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { spawnSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { packFilesByDuration } from './utils/packFilesByDuration.mjs';

const MOCHA = join(import.meta.dirname, '..', 'node_modules', '.bin', 'mocha');
const WORKER_COUNT = parseInt(process.env.WORKER_COUNT || '1', 10);
const WORKER_INDEX = parseInt(process.env.WORKER_INDEX || '0', 10);
const DURATIONS = parseDurations(process.env.MOCHA_TIMINGS);

/**
 * @param {string | undefined} json
 * @returns {Readonly<Record<string, number>> | null}
 */
function parseDurations(json) {
  if (json == null || json === '') {
    console.error('No timings in MOCHA_TIMINGS');
    return null;
  }

  let durations;
  try {
    durations = JSON.parse(json);
  } catch (error) {
    console.error('Could not parse MOCHA_TIMINGS:', error);
    return null;
  }

  if (
    durations == null ||
    typeof durations !== 'object' ||
    Array.isArray(durations)
  ) {
    console.error('Expected an object in MOCHA_TIMINGS');
    return null;
  }
  for (const duration of Object.values(durations)) {
    if (typeof duration !== 'number' || !Number.isFinite(duration)) {
      console.error('Expected only numbers in MOCHA_TIMINGS');
      return null;
    }
  }
  return durations;
}

/**
 * @param {ReadonlyArray<string>} files
 * @returns {ReadonlyArray<string>}
 */
function selectFiles(files) {
  if (DURATIONS == null) {
    console.error('Splitting files by index');
    /** @type {Array<string>} */
    const selected = [];
    for (const [index, file] of files.entries()) {
      if (index % WORKER_COUNT === WORKER_INDEX) {
        selected.push(file);
      }
    }
    return selected;
  }

  // MOCHA_TIMINGS uses paths relative to the repository, with forward slashes
  /** @type {Record<string, number>} */
  const fileDurations = {};
  for (const file of files) {
    const key = relative(process.cwd(), file).replaceAll(sep, '/');
    const duration = DURATIONS[key];
    if (duration != null) {
      fileDurations[file] = duration;
    }
  }

  const bins = packFilesByDuration(files, fileDurations, WORKER_COUNT);
  /** @type {Array<string>} */
  const expectedSeconds = [];
  for (const bin of bins) {
    expectedSeconds.push(`${Math.round(bin.duration / 1000)}s`);
  }
  console.error(
    `Splitting files by duration, expected per worker: ${expectedSeconds.join(', ')}`
  );
  return bins[WORKER_INDEX]?.files ?? [];
}

const separator = process.argv.indexOf('--');
if (separator === -1) {
  throw new Error('Expected `--` separator between options and files');
}

const flags = process.argv.slice(2, separator);
const files = process.argv.slice(separator + 1);

const filteredFiles = selectFiles(files);

console.log(`Running on ${filteredFiles.length}/${files.length} of files`);

const { status } = spawnSync(MOCHA, [...flags, ...filteredFiles], {
  stdio: 'inherit',
});

process.exit(status);
