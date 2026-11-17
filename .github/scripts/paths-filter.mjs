// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * Prints `name=true|false` per filter for $GITHUB_OUTPUT.
 *
 * A filter is true when all of its conditions match (all optional):
 *
 * - if: a boolean, can be a workflow `${{ }}` expression
 * - paths-any: globs, at least one changed file matches one of them
 * - paths-only: globs, every changed file matches one of them
 *
 * Outside pull requests there's no diff, so `paths-any` counts as matching
 * (gated jobs run) and `paths-only` counts as not matching (nothing is skipped).
 */

import { execFile as execFileCallback } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    filters: { type: 'string' },
  },
});
if (args.base == null || args.filters == null) {
  throw new Error('Usage: paths-filter.mjs --base <rev> --filters <filters>');
}

/**
 * @typedef {Readonly<{
 *   if?: boolean,
 *   'paths-any'?: ReadonlyArray<string>,
 *   'paths-only'?: ReadonlyArray<string>,
 * }>} Filter
 */

const KEYS = new Set(['if', 'paths-any', 'paths-only']);

const { base } = args;
/** @type {Record<string, Filter>} */
const filters = JSON.parse(args.filters);
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

for (const [name, filter] of Object.entries(filters)) {
  const keys = Object.keys(filter);
  const unknownKeys = keys.filter(key => !KEYS.has(key));
  if (keys.length === 0 || unknownKeys.length > 0) {
    throw new Error(`Filter ${name} has no or unknown keys: ${keys.join(', ')}`);
  }
  if (filter.if != null && typeof filter.if !== 'boolean') {
    throw new Error(`Filter ${name} has a non-boolean if: ${filter.if}`);
  }
}

/**
 * @param {ReadonlyArray<string>} pathspecs
 * @returns {Promise<ReadonlyArray<string>>}
 */
async function getChangedFiles(pathspecs) {
  const { stdout } = await execFile(
    'git',
    ['diff', '--name-only', base, 'HEAD', '--', ...pathspecs],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  return stdout.split('\n').filter(file => file !== '');
}

const changedFiles = isPullRequest ? await getChangedFiles([]) : null;

/**
 * @param {Filter} filter
 * @returns {Promise<ReadonlyArray<string>>} reasons the filter doesn't match
 */
async function getMismatches(filter) {
  const {
    if: condition,
    'paths-any': pathsAny,
    'paths-only': pathsOnly,
  } = filter;

  /** @type {Array<string>} */
  const mismatches = [];

  if (condition === false) {
    mismatches.push('`if` is false');
  }

  if (pathsAny != null && changedFiles != null) {
    const pathspecs = pathsAny.map(glob => `:(glob)${glob}`);
    const matchedFiles = await getChangedFiles(pathspecs);
    if (matchedFiles.length === 0) {
      mismatches.push('no changed file matches `paths-any`');
    }
  }

  if (pathsOnly != null) {
    if (changedFiles == null || changedFiles.length === 0) {
      mismatches.push('no changed files to match `paths-only`');
    } else {
      const pathspecs = pathsOnly.map(glob => `:(exclude,glob)${glob}`);
      const otherFiles = await getChangedFiles(pathspecs);
      if (otherFiles.length > 0) {
        mismatches.push(`other files changed:\n  ${otherFiles.join('\n  ')}`);
      }
    }
  }

  return mismatches;
}

const results = await Promise.all(
  Object.entries(filters).map(async filterEntry => {
    const [name, filter] = filterEntry;
    const mismatches = await getMismatches(filter);
    return { name, mismatches };
  })
);

for (const { name, mismatches } of results) {
  // stdout goes to $GITHUB_OUTPUT, stderr to the job log
  console.log(`${name}=${mismatches.length === 0}`);
  if (mismatches.length === 0) {
    console.error(`${name}: matches`);
  } else {
    console.error(`${name}: ${mismatches.join('; ')}`);
  }
}
