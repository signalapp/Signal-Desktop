// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';
import { createHash } from 'node:crypto';
import { LRUCache } from 'lru-cache';

import { createLogger } from '../ts/logging/log.std.ts';
import * as Errors from '../ts/types/errors.std.ts';
import { createBatcher } from '../ts/util/batcher.std.ts';
import type { BatcherType } from '../ts/util/batcher.std.ts';
import translateNative from '@signalapp/translate-native';

const log = createLogger('translate_channel');

const IS_AVAILABLE_KEY = 'translate:is-available';
const DETECT_KEY = 'translate:detect';
const BATCH_KEY = 'translate:batch';

export type TranslateAvailability = Readonly<{
  available: boolean;
}>;

export type TranslateBatchResult =
  | Readonly<{ ok: true; texts: ReadonlyArray<string> }>
  | Readonly<{ ok: false; code: string }>;

// Recomputing a translation is cheap (on-device, no network, sub-second),
// unlike e.g. attachment thumbnails — this cache exists only to avoid
// redundant native calls when a message re-renders or a conversation is
// revisited within the same app session. Never persisted; gone on quit.
const cache = new LRUCache<string, string>({ max: 500 });

function cacheKey(sourceLang: string, targetLang: string, text: string): string {
  const hash = createHash('sha256').update(text, 'utf8').digest('hex');
  return `${sourceLang} ${targetLang} ${hash}`;
}

// Coalesces same-(source,target) requests that arrive within a short window
// into one native batch call — the whole point of the batch API is doing 40
// short-lived native round-trips as 1 instead. Built on the codebase's
// existing createBatcher (ts/util/batcher.std.ts) rather than a hand-rolled
// timer, so this participates in the shared waitForAllBatchers() shutdown
// sequence for free, same as every other batched subsystem.
const COALESCE_WINDOW_MS = 50;
const MAX_BATCH_SIZE = 50;

type PendingItem = {
  text: string;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
};

// Only used as a Map key, never split back apart. sourceLang/targetLang
// are captured directly in getOrCreateBatcher's closure instead.
function pairKey(sourceLang: string, targetLang: string): string {
  return `${sourceLang} ${targetLang}`;
}

const batchersByPair = new Map<string, BatcherType<PendingItem>>();
// Every item currently added to a batcher but not yet resolved/rejected —
// tracked separately so shutdown() can reject them directly. Resolving or
// rejecting an already-settled Promise is a silent no-op, so it's safe if a
// batcher's own (now-orphaned) flush also tries to settle the same item
// afterward.
const allPendingItems = new Set<PendingItem>();

function getOrCreateBatcher(
  sourceLang: string,
  targetLang: string
): BatcherType<PendingItem> {
  const key = pairKey(sourceLang, targetLang);
  const existing = batchersByPair.get(key);
  if (existing) {
    return existing;
  }

  const batcher = createBatcher<PendingItem>({
    name: `translate:${sourceLang}->${targetLang}`,
    wait: COALESCE_WINDOW_MS,
    maxSize: MAX_BATCH_SIZE,
    processBatch: async items => {
      items.forEach(item => allPendingItems.delete(item));

      if (!translateNative) {
        const err = new Error('unavailable');
        items.forEach(item => item.reject(err));
        return;
      }

      try {
        const translated = await translateNative.translateBatch(
          sourceLang,
          targetLang,
          items.map(item => item.text)
        );
        translated.forEach((text, i) => {
          const item = items[i];
          cache.set(cacheKey(sourceLang, targetLang, item.text), text);
          item.resolve(text);
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('unknown');
        items.forEach(item => item.reject(err));
      }
    },
  });
  batchersByPair.set(key, batcher);
  return batcher;
}

async function translateOne(
  sourceLang: string,
  targetLang: string,
  text: string
): Promise<string> {
  const key = cacheKey(sourceLang, targetLang, text);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  return new Promise<string>((resolve, reject) => {
    const item: PendingItem = { text, resolve, reject };
    allPendingItems.add(item);
    getOrCreateBatcher(sourceLang, targetLang).add(item);
  });
}

export function initialize(): void {
  ipcMain.handle(IS_AVAILABLE_KEY, (): TranslateAvailability => {
    return { available: Boolean(translateNative?.isBatchAvailable()) };
  });

  ipcMain.handle(DETECT_KEY, (_event, texts: ReadonlyArray<string>) => {
    if (!translateNative) {
      return texts.map(() => '');
    }
    return translateNative.detectLanguages([...texts]);
  });

  ipcMain.handle(
    BATCH_KEY,
    async (
      _event,
      {
        sourceLang,
        targetLang,
        texts,
      }: { sourceLang: string; targetLang: string; texts: ReadonlyArray<string> }
    ): Promise<TranslateBatchResult> => {
      if (!translateNative || !translateNative.isBatchAvailable()) {
        return { ok: false, code: 'unavailable' };
      }
      // Split into per-string requests so the coalescing layer can merge
      // them with any other in-flight requests for the same language pair,
      // then reassemble in the caller's original order.
      try {
        const results = await Promise.all(
          texts.map(text => translateOne(sourceLang, targetLang, text))
        );
        return { ok: true, texts: results };
      } catch (error) {
        log.warn('translateBatch failed', Errors.toLogFormat(error));
        const code = error instanceof Error ? error.message : 'unknown';
        return { ok: false, code };
      }
    }
  );
}

export async function shutdown(): Promise<void> {
  const err = new Error('destroyed');
  allPendingItems.forEach(item => item.reject(err));
  allPendingItems.clear();

  for (const batcher of batchersByPair.values()) {
    batcher.unregister();
  }
  batchersByPair.clear();

  try {
    translateNative?.destroy();
  } catch (error) {
    log.warn('translateNative.destroy() failed', Errors.toLogFormat(error));
  }
}
