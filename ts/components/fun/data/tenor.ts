// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { Simplify } from 'type-fest';
import { strictAssert } from '../../../util/assert';
import { parseUnknown } from '../../../util/schemas';

const BASE_URL = 'https://tenor.googleapis.com/v2';
const API_KEY = 'AIzaSyBt6SUfSsCQic2P2VkNkLjsGI7HGWZI95g';

/**
 * Types
 */

export type TenorNextCursor = string & { TenorHasNextCursor: never };
export type TenorTailCursor = '0' & { TenorHasEndCursor: never };
export type TenorCursor = TenorNextCursor | TenorTailCursor;

const TenorCursorSchema = z.custom<TenorCursor>(
  (value: unknown) => {
    return typeof value === 'string';
  },
  input => {
    return { message: `Expected tenor cursor, got: ${input}` };
  }
);

export type TenorContentFormat = string;
export type TenorContentFilter = 'off' | 'low' | 'medium' | 'high';
export type TenorAspectRatioFilter = 'all' | 'wide' | 'standard';
export type TenorSearchFilter = 'sticker' | 'static' | '-static';

export function isTenorTailCursor(
  cursor: TenorCursor
): cursor is TenorTailCursor {
  return cursor === '0';
}

/**
 * Params
 */

type TenorApiParams = Readonly<{
  key: string;
  client_key?: string;
}>;

type TenorLocalizationParams = Readonly<{
  country?: string;
  locale?: string;
}>;

type TenorSearchFilterParams = Readonly<{
  searchfilter?: ReadonlyArray<TenorSearchFilter>;
  media_filter?: ReadonlyArray<TenorContentFormat>;
  ar_range?: TenorAspectRatioFilter;
}>;

type TenorContentFilterParams = Readonly<{
  contentfilter?: TenorContentFilter;
}>;

type TenorPaginationParams = Readonly<{
  limit?: number;
  pos?: TenorNextCursor;
}>;

/**
 * Response Schemas
 */

const TenorResponseCategorySchema = z.object({
  searchterm: z.string(),
  path: z.string(),
  image: z.string(),
  name: z.string(),
});

const TenorResponseMediaSchema = z.object({
  url: z.string(),
  dims: z.array(z.number()),
  duration: z.number(),
  size: z.number(),
});

const TenorResponseResultSchema = z.object({
  created: z.number(),
  hasaudio: z.boolean(),
  id: z.string(),
  media_formats: z.record(TenorResponseMediaSchema),
  tags: z.array(z.string()),
  title: z.string(),
  content_description: z.string(),
  itemurl: z.string(),
  hascaption: z.boolean().optional(),
  flags: z.array(z.string()),
  bg_color: z.string().optional(),
  url: z.string(),
});

export type TenorResponseCategory = z.infer<typeof TenorResponseCategorySchema>;
export type TenorResponseMedia = z.infer<typeof TenorResponseMediaSchema>;
export type TenorResponseResult = z.infer<typeof TenorResponseResultSchema>;

export type TenorPaginatedResponse<T> = Readonly<{
  next: TenorCursor;
  results: ReadonlyArray<T>;
}>;

/**
 * Endpoints
 */

type TenorEndpoints = Readonly<{
  'v2/search': {
    params: Simplify<
      TenorApiParams &
        TenorLocalizationParams &
        TenorSearchFilterParams &
        TenorContentFilterParams &
        TenorPaginationParams &
        Readonly<{
          q: string;
          random?: boolean;
        }>
    >;
    response: TenorPaginatedResponse<TenorResponseResult>;
  };
  'v2/featured': {
    params: Simplify<
      TenorApiParams &
        TenorLocalizationParams &
        TenorSearchFilterParams &
        TenorContentFilterParams &
        TenorPaginationParams
    >;
    response: TenorPaginatedResponse<TenorResponseResult>;
  };
  'v2/categories': {
    params: Simplify<
      TenorApiParams &
        TenorLocalizationParams &
        TenorContentFilterParams & {
          type: 'featured' | 'trending';
        }
    >;
    response: {
      tags: ReadonlyArray<TenorResponseCategory>;
    };
  };
  // ignored
  // 'v2/search_suggestions'
  // 'v2/autocomplete'
  // 'v2/trending_terms'
  // 'v2/registershare': {},
  // 'v2/posts': {},
}>;

/**
 * Response Schemas
 */

type ResponseSchemaMapType = Readonly<{
  [Path in keyof TenorEndpoints]: z.ZodSchema<TenorEndpoints[Path]['response']>;
}>;

const ResponseSchemaMap: ResponseSchemaMapType = {
  'v2/search': z.object({
    next: TenorCursorSchema,
    results: z.array(TenorResponseResultSchema),
  }),
  'v2/featured': z.object({
    next: TenorCursorSchema,
    results: z.array(TenorResponseResultSchema),
  }),
  'v2/categories': z.object({
    tags: z.array(TenorResponseCategorySchema),
  }),
};

/**
 * Tenor API Client
 *
 * ```ts
 * const response = await tenor('v2/search', {
 *   q: 'hello',
 *   limit: 10,
 * });
 * // >> { next: '...', results: [...] }
 * ````
 */
export async function tenor<Path extends keyof TenorEndpoints>(
  path: Path,
  params: Omit<TenorEndpoints[Path]['params'], 'key'>,
  signal?: AbortSignal
): Promise<TenorEndpoints[Path]['response']> {
  const { messaging } = window.textsecure;
  strictAssert(messaging, 'Missing window.textsecure.messaging');

  const schema = ResponseSchemaMap[path];
  strictAssert(schema, 'Missing schema');

  const url = new URL(path, BASE_URL);

  // Always add the API key
  url.searchParams.set('key', API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }
    // Note: Tenor formats arrays as comma-separated strings
    const param = Array.isArray(value) ? value.join(',') : `${value}`;
    url.searchParams.set(key, param);
  }

  const response = await messaging.server.fetchJsonViaProxy(
    url.toString(),
    signal
  );
  const result = parseUnknown(schema, response.data);
  return result;
}

export async function tenorDownload(
  tenorCdnUrl: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const { messaging } = window.textsecure;
  strictAssert(messaging, 'Missing window.textsecure.messaging');
  const response = await messaging.server.fetchBytesViaProxy(
    tenorCdnUrl,
    signal
  );
  return response.data;
}
