// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { lookup as nativeLookup } from 'dns';
import type { LookupOneOptions } from 'dns';
import fetch from 'node-fetch';
import { z } from 'zod';

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { strictAssert } from './assert';
import { SECOND } from './durations';

const HOST_ALLOWLIST = new Set([
  // Production
  'chat.signal.org',
  'storage.signal.org',
  'cdsi.signal.org',
  'cdn.signal.org',
  'cdn2.signal.org',
  'create.signal.art',

  // Staging
  'chat.staging.signal.org',
  'storage-staging.signal.org',
  'cdsi.staging.signal.org',
  'cdn-staging.signal.org',
  'cdn2-staging.signal.org',
  'create.staging.signal.art',

  // Common
  'updates2.signal.org',
  'sfu.voip.signal.org',
]);

const dohResponseSchema = z.object({
  Status: z.number(),
  Answer: z.array(
    z.object({
      data: z.string(),
      TTL: z.number(),
    })
  ),
  Comment: z.string().optional(),
});

type CacheEntry = Readonly<{
  data: string;
  expiresAt: number;
}>;

export class DNSCache {
  private readonly ipv4 = new Map<string, Array<CacheEntry>>();
  private readonly ipv6 = new Map<string, Array<CacheEntry>>();

  public get(hostname: string, family: 4 | 6): string | undefined {
    const map = this.getMap(family);

    const entries = map.get(hostname);
    if (!entries) {
      return undefined;
    }

    // Cleanup old records
    this.cleanup(entries);
    if (entries.length === 0) {
      map.delete(hostname);
      return undefined;
    }

    // Pick a random record
    return this.pick(entries);
  }

  public setAndPick(
    hostname: string,
    family: 4 | 6,
    entries: Array<CacheEntry>
  ): string {
    strictAssert(entries.length !== 0, 'should have at least on entry');

    const map = this.getMap(family);

    // Just overwrite the entries - we shouldn't get here unless it was a cache
    // miss.
    map.set(hostname, entries);

    return this.pick(entries);
  }

  // Private

  private getMap(family: 4 | 6): Map<string, Array<CacheEntry>> {
    return family === 4 ? this.ipv4 : this.ipv6;
  }

  private pick(entries: Array<CacheEntry>): string {
    const index = Math.floor(Math.random() * entries.length);
    return entries[index].data;
  }

  private cleanup(entries: Array<CacheEntry>): void {
    const now = Date.now();
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const { expiresAt } = entries[i];
      if (expiresAt <= now) {
        entries.splice(i, 1);
      }
    }
  }
}

const cache = new DNSCache();

export async function doh(hostname: string, family: 4 | 6): Promise<string> {
  const cached = cache.get(hostname, family);
  if (cached !== undefined) {
    log.info(`dns/doh: using cached value for ${hostname}/IPv${family}`);
    return cached;
  }

  const url = new URL('https://1.1.1.1/dns-query');
  url.searchParams.append('name', hostname);
  url.searchParams.append('type', family === 4 ? 'A' : 'AAAA');
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/dns-json',
      'user-agent': 'Electron',
    },
  });

  if (!res.ok) {
    throw new Error(
      `DoH request for ${hostname} failed with http status: ${res.status}`
    );
  }

  const {
    Status: status,
    Answer: answer,
    Comment: comment,
  } = dohResponseSchema.parse(await res.json());

  if (status !== 0) {
    throw new Error(`DoH request for ${hostname} failed: ${status}/${comment}`);
  }

  if (answer.length === 0) {
    throw new Error(`DoH request for ${hostname} failed: empty answer`);
  }

  const now = Date.now();
  return cache.setAndPick(
    hostname,
    family,
    answer.map(({ data, TTL }) => {
      return { data, expiresAt: now + TTL * SECOND };
    })
  );
}

export function lookupWithFallback(
  hostname: string,
  opts: LookupOneOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string,
    family: number
  ) => void
): void {
  // Node.js support various signatures, but we only support one.
  strictAssert(typeof opts === 'object', 'missing options');
  strictAssert(Boolean(opts.all) !== true, 'options.all is not supported');
  strictAssert(typeof callback === 'function', 'missing callback');

  nativeLookup(hostname, opts, async (err, ...nativeArgs) => {
    if (!err) {
      return callback(err, ...nativeArgs);
    }

    if (!HOST_ALLOWLIST.has(hostname)) {
      log.error(
        `dns/lookup: failed for ${hostname}, ` +
          `err: ${Errors.toLogFormat(err)}. not retrying`
      );
      return callback(err, ...nativeArgs);
    }

    const family = opts.family === 6 ? 6 : 4;

    log.error(
      `dns/lookup: failed for ${hostname}, err: ${Errors.toLogFormat(err)}. ` +
        `Retrying with DoH (IPv${family})`
    );

    try {
      const answer = await doh(hostname, family);
      callback(null, answer, family);
    } catch (fallbackErr) {
      callback(fallbackErr, '', 0);
    }
  });
}
