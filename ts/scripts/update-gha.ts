// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import z from 'zod';
import semver from 'semver';

import { drop } from '../util/drop.std.js';
import { strictAssert } from '../util/assert.std.js';

const { GITHUB_TOKEN } = process.env;

const WORKFLOWS_DIR = join(__dirname, '..', '..', '.github', 'workflows');

const REGEXP =
  /uses:\s*(?<path>[^\s]+)@(?<ref>[^\s#]+)(?:\s*#\s*(?<originalRef>[^\n]+))?/g;

const CACHE = new Map<string, string>();

const TagsSchema = z
  .object({
    name: z.string(),
    commit: z.object({
      sha: z.string(),
    }),
  })
  .array();

async function updateAction(fullPath: string): Promise<void> {
  const source = await readFile(fullPath, 'utf8');

  for (const { groups } of source.matchAll(REGEXP)) {
    strictAssert(groups != null, 'Expected regexp to fully match');
    const { path, ref, originalRef } = groups;

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

    const url =
      `https://api.github.com/repos/${encodeURIComponent(org)}/` +
      `${encodeURIComponent(repo)}/tags`;

    // eslint-disable-next-line no-await-in-loop
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

    // eslint-disable-next-line no-await-in-loop
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

async function main(): Promise<void> {
  const actions = await readdir(WORKFLOWS_DIR);

  for (const name of actions) {
    // eslint-disable-next-line no-await-in-loop
    await updateAction(join(WORKFLOWS_DIR, name));
  }
}
drop(main());
