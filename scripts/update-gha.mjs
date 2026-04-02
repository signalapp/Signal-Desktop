// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import z from 'zod';
import semver from 'semver';
import { assert } from './utils/assert.mjs';

const { GITHUB_TOKEN } = process.env;

const WORKFLOWS_DIR = join(import.meta.dirname, '..', '.github', 'workflows');

const REGEXP =
  /uses:\s*(?<path>[^\s]+)@(?<ref>[^\s#]+)(?:\s*#\s*(?<originalRef>[^\n]+))?/g;

/** @type {Map<string, string>} */
const CACHE = new Map();

const TagsSchema = z
  .object({
    name: z.string(),
    commit: z.object({
      sha: z.string(),
    }),
  })
  .array();

/**
 * @param {string} fullPath
 * @returns {Promise<void>}
 */
async function updateAction(fullPath) {
  const source = await readFile(fullPath, 'utf8');

  for (const { groups } of source.matchAll(REGEXP)) {
    assert(groups != null, 'Expected regexp to fully match');
    const { path, ref, originalRef } = groups;
    assert(path != null, 'Missing path');
    assert(ref != null, 'Missing ref');
    assert(originalRef != null, 'Missing originalRef');

    // Skip local actions
    if (path.startsWith('.')) {
      continue;
    }

    // Skip internal actions
    if (path.startsWith('signalapp/')) {
      continue;
    }

    const cacheKey = `${path}@${originalRef}`;
    if (CACHE.has(cacheKey)) {
      continue;
    }

    const [org, repo] = path.split('/', 2);
    assert(repo != null, 'Missing repo');

    const url =
      `https://api.github.com/repos/${encodeURIComponent(org)}/` +
      `${encodeURIComponent(repo)}/tags`;

    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(url, {
      headers: {
        authorization: GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : '',
        'user-agent':
          'Mozilla/5.0 (Macintosh; ' +
          'Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}, status: ${res.status}`);
    }

    // oxlint-disable-next-line no-await-in-loop
    const tags = TagsSchema.parse(await res.json())
      // Filter out invalid tags
      .filter(tag => semver.valid(tag.name))
      // Sort by latest release first
      .sort((a, b) => semver.compare(b.name, a.name));

    const targetRef = originalRef ?? ref;
    let range = targetRef;

    // Pad tag to be valid semver range
    if (/^v\d+$/.test(range)) {
      range = `^${range}.0.0`;
    } else if (/^v\d+\.d+$/.test(range)) {
      range = `^${range}.0`;
    }

    // Pick first match
    const match = tags.find(tag => semver.satisfies(tag.name, range));
    if (!match) {
      throw new Error(`Tag ${targetRef} not found for ${path}`);
    }

    CACHE.set(cacheKey, `uses: ${path}@${match.commit.sha} # ${targetRef}`);
  }

  const result = source.replace(
    REGEXP,
    (match, _p1, _p2, _p3, _offset, _string, groups) => {
      const { path, originalRef } = groups;

      const cacheKey = `${path}@${originalRef}`;
      return CACHE.get(cacheKey) || match;
    }
  );
  await writeFile(fullPath, result);
}

const actions = await readdir(WORKFLOWS_DIR);

for (const name of actions) {
  // oxlint-disable-next-line no-await-in-loop
  await updateAction(join(WORKFLOWS_DIR, name));
}
