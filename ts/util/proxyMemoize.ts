// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createProxy, getUntracked, isChanged } from 'proxy-compare';

export type ExcludeNull<O> = Exclude<O, null>;

export type ProxyMemoizeOptions<Result> = Readonly<{
  // For debugging
  name: string;

  equalityFn?: (prev: Result, next: Result) => boolean;
}>;

export function proxyMemoize<Params extends ReadonlyArray<object>, Result>(
  fn: (...params: Params) => ExcludeNull<Result>,
  { equalityFn }: ProxyMemoizeOptions<ExcludeNull<Result>>
): (...param: Params) => ExcludeNull<Result> {
  type CacheEntryType = Readonly<{
    params: Params;
    result: ExcludeNull<Result>;
  }>;

  const cache = new WeakMap<object, CacheEntryType>();
  const affected = new WeakMap<object, unknown>();
  const proxyCache = new WeakMap<object, unknown>();
  const changedCache = new WeakMap<object, unknown>();

  return (...params: Params): ExcludeNull<Result> => {
    if (params.length < 1) {
      throw new Error('At least one parameter is required');
    }

    const cacheKey = params[0];

    const entry = cache.get(cacheKey);

    if (entry && entry.params.length === params.length) {
      let isValid = true;
      for (const [i, cachedParam] of entry.params.entries()) {
        // Proxy wasn't even touched - we are good to go.
        const wasUsed = affected.has(cachedParam);
        if (!wasUsed) {
          continue;
        }

        if (isChanged(cachedParam, params[i], affected, changedCache)) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        return entry.result;
      }
    }

    const proxies = params.map(param =>
      createProxy(param, affected, proxyCache)
    ) as unknown as Params;

    const trackedResult = fn(...proxies);
    const untrackedResult = getUntracked(trackedResult);

    // eslint-disable-next-line eqeqeq
    let result = untrackedResult === null ? trackedResult : untrackedResult;

    // Try to reuse result if custom equality check is configured.
    if (entry && equalityFn && equalityFn(entry.result, result)) {
      ({ result } = entry);
    }

    cache.set(cacheKey, {
      params,
      result,
    });
    return result;
  };
}
