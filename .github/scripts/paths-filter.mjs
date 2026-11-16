// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

// Prints `name=true|false` per filter for $GITHUB_OUTPUT; all true outside PRs

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

const { base } = args;
/** @type {Record<string, ReadonlyArray<string>>} */
const filters = JSON.parse(args.filters);
const isPullRequest = process.env.GITHUB_EVENT_NAME === 'pull_request';

/**
 * @param {ReadonlyArray<string>} globs
 * @returns {Promise<ReadonlyArray<string>>}
 */
async function getMatchedFiles(globs) {
  const pathspecs = globs.map(glob => `:(glob)${glob}`);
  const { stdout } = await execFile(
    'git',
    ['diff', '--name-only', base, 'HEAD', '--', ...pathspecs],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  return stdout.split('\n').filter(file => file !== '');
}

/** @type {ReadonlyArray<{ name: string, matchedFiles: ReadonlyArray<string> | null }>} */
let results = Object.keys(filters).map(name => {
  return { name, matchedFiles: null };
});
if (isPullRequest) {
  results = await Promise.all(
    Object.entries(filters).map(async filterEntry => {
      const [name, globs] = filterEntry;
      const matchedFiles = await getMatchedFiles(globs);
      return { name, matchedFiles };
    })
  );
}

for (const { name, matchedFiles } of results) {
  const changed = matchedFiles == null || matchedFiles.length > 0;
  // stdout goes to $GITHUB_OUTPUT, stderr to the job log
  console.log(`${name}=${changed}`);

  if (matchedFiles == null) {
    console.error(`${name}: not a pull request`);
  } else if (matchedFiles.length > 0) {
    console.error(`${name}:\n  ${matchedFiles.join('\n  ')}`);
  } else {
    console.error(`${name}: no matching files changed`);
  }
}
