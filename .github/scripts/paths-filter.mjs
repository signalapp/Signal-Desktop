// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

// Prints `name=true|false` per filter for $GITHUB_OUTPUT; all true outside PRs

import { execFile as execFileCallback } from 'node:child_process';
import { matchesGlob } from 'node:path';
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

/** @type {Record<string, ReadonlyArray<string>>} */
const filters = JSON.parse(args.filters);
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

/** @type {ReadonlyArray<string>} */
let changedFiles = [];
if (isPullRequest) {
  const { stdout } = await execFile(
    'git',
    ['diff', '--name-only', args.base, 'HEAD'],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  changedFiles = stdout.split('\n').filter(file => file !== '');
}

for (const [name, globs] of Object.entries(filters)) {
  const matchedFiles = changedFiles.filter(file => {
    return globs.some(glob => matchesGlob(file, glob));
  });
  const changed = !isPullRequest || matchedFiles.length > 0;
  console.log(`${name}=${changed}`);

  // stdout is the step output
  if (!isPullRequest) {
    console.error(`${name}: not a pull request`);
  } else if (matchedFiles.length > 0) {
    console.error(`${name}:\n  ${matchedFiles.join('\n  ')}`);
  } else {
    console.error(`${name}: no matching files changed`);
  }
}
