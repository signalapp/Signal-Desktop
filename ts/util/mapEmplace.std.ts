// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RequireAtLeastOne } from 'type-fest';

export type MapKey<T extends Map<unknown, unknown>> =
  T extends Map<infer Key, unknown> ? Key : never;

export type MapValue<T extends Map<unknown, unknown>> =
  T extends Map<unknown, infer Value> ? Value : never;

export type MapEmplaceOptions<T extends Map<unknown, unknown>> =
  RequireAtLeastOne<{
    insert?: (key: MapKey<T>, map: T) => MapValue<T>;
    update?: (existing: MapValue<T>, key: MapKey<T>, map: T) => MapValue<T>;
  }>;

/**
 * Lightweight polyfill of the `Map.prototype.emplace` TC39 Proposal:
 * @see https://github.com/tc39/proposal-upsert
 *
 * @throws If no `insert()` is provided and key is not present
 *
 * @example Get or Insert:
 * ```ts
 * let pagesByBook = new Map<BookId, Map<PageId, Page>>()
 * for (let page of pages) {
 *   let bookPages = mapEmplace(pagesByBook, page.bookId, {
 *     insert: () => new Map(),
 *   })
 *   bookPages.set(page.id, page)
 * }
 * ```
 *
 * @example Get+Update or Insert:
 * ```ts
 * let unreadPages = new Map<BookId, number>()
 * for (let page of pages) {
 *   if (page.readAt == null) {
 *     mapEmplace(unreadPages, page.bookId, {
 *       insert: () => 1,
 *       update: (prev) => prev + 1,
 *     })
 *   }
 * }
 * ```
 *
 * @example Get+Update or Throw
 * ```ts
 * let PagesCache = new Map<PageId, Page>()
 *
 * function onPageReadEvent(pageId: PageId, readAt: number) {
 *   if (PagesCache.has(pageId)) {
 *     mapEmplace(PagesCache, pageId, {
 *       update(page) {
 *         return { ...page, readAt }
 *       },
 *     })
 *   } else {
 *     // save for later
 *     onEarlyPageReadEvent(pageId, readAt)
 *   }
 * }
 * ```
 */
export function mapEmplace<T extends Map<unknown, unknown>>(
  map: T,
  key: MapKey<T>,
  options: MapEmplaceOptions<T>
): MapValue<T> {
  if (map.has(key)) {
    let value = map.get(key) as MapValue<T>;
    if (options.update != null) {
      value = options.update(value, key, map);
      map.set(key, value);
    }
    return value;
  }
  if (options.insert != null) {
    const value = options.insert(key, map);
    map.set(key, value);
    return value;
  }
  throw new Error('Key was not present in map, and insert() was not provided');
}
