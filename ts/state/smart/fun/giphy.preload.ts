// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { parseUnknown } from '../../../util/schemas.std.ts';
import {
  fetchJsonViaProxy,
  fetchBytesViaProxy,
} from '../../../textsecure/WebAPI.preload.ts';
import { fetchInSegments } from '../../../components/fun/data/segments.std.ts';
import { safeParseInteger } from '../../../util/numbers.std.ts';
import type { PaginatedGifResults } from '../../../components/fun/panels/FunPanelGifs.dom.tsx';
import {
  GIPHY_SEARCH_QUERY_MAX_CODE_POINTS,
  isGiphyCdnUrl,
} from '../../../util/giphy.std.ts';
import { createLogger } from '../../../logging/log.std.ts';
import { unicodeSlice } from '../../../util/unicodeSlice.std.ts';

const log = createLogger('giphy');

const BASE_API_URL = 'https://api.giphy.com';
const API_KEY = 'ApVVlSyeBfNKK6UWtnBRq9CvAkWsxayB';

const CONTENT_RATING = 'pg-13';
const CONTENT_BUNDLE = 'messaging_non_clips';

const GIF_FIELDS = [
  'id',
  'title',
  'alt_text',
  'images.original.width',
  'images.original.height',
  'images.original.mp4',
  'images.fixed_width.width',
  'images.fixed_width.height',
  'images.fixed_width.mp4',
].join(',');

const GiphyPaginationSchema = z.object({
  offset: z.number().int(),
  total_count: z.number().int(),
  count: z.number().int(),
});

const StringInteger = z.preprocess(input => {
  if (typeof input === 'string') {
    return safeParseInteger(input);
  }
  return input;
}, z.number().int());

const GiphyCdnUrl = z.string().refine(
  input => {
    return isGiphyCdnUrl(input);
  },
  { error: issue => `Expected Giphy CDN URL, got ${String(issue.input)}` }
);

const GiphyImagesSchema = z.object({
  original: z.object({
    width: StringInteger,
    height: StringInteger,
    mp4: GiphyCdnUrl,
  }),
  // fixed width of 200px
  fixed_width: z.object({
    width: StringInteger,
    height: StringInteger,
    mp4: GiphyCdnUrl,
  }),
});

const GiphyGifSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  alt_text: z.string(),
  images: GiphyImagesSchema,
});

const GiphyResultsSchema = z.object({
  pagination: GiphyPaginationSchema,
  data: z.array(GiphyGifSchema),
});

type GiphyPagination = z.infer<typeof GiphyPaginationSchema>;
type GiphyResults = z.infer<typeof GiphyResultsSchema>;

// See https://developers.giphy.com/docs/api/#synthetic-response
const GiphySyntheticErrorResponseSchema = z
  .object({
    meta: z.object({
      status: z.literal(200),
      response_id: z.literal(''),
    }),
  })
  .transform(data => {
    return { type: 'synthetic-error' as const, data };
  });

const GiphySuccessResponseSchema = GiphyResultsSchema.extend({
  meta: z.object({
    status: z.number(),
    response_id: z.string().check(z.minLength(1)),
  }),
}).transform(data => {
  return { type: 'success' as const, data };
});

const GiphyResponseSchema = z.union([
  GiphySuccessResponseSchema,
  GiphySyntheticErrorResponseSchema,
]);

function getNextOffset(pagination: GiphyPagination): number | null {
  const end = pagination.offset + pagination.count;
  if (end >= pagination.total_count) {
    return null;
  }
  return end;
}

function normalizeGiphyResults(results: GiphyResults): PaginatedGifResults {
  return {
    next: getNextOffset(results.pagination),
    gifs: results.data.map(item => {
      return {
        id: item.id,
        title: item.title,
        description: item.alt_text,
        previewMedia: {
          url: item.images.fixed_width.mp4,
          width: item.images.fixed_width.width,
          height: item.images.fixed_width.height,
        },
        attachmentMedia: {
          url: item.images.original.mp4,
          width: item.images.original.width,
          height: item.images.original.height,
        },
      };
    }),
  };
}

export async function fetchGiphySearch(
  query: string,
  limit: number,
  offset: number | null,
  signal?: AbortSignal
): Promise<PaginatedGifResults> {
  const url = new URL('v1/gifs/search', BASE_API_URL);

  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('rating', CONTENT_RATING);
  url.searchParams.set('bundle', CONTENT_BUNDLE);
  url.searchParams.set('fields', GIF_FIELDS);

  let q: string;

  if (Buffer.byteLength(query) > 50) {
    log.warn('giphy search query should be less than 50 chars');
    q = unicodeSlice(query, 0, GIPHY_SEARCH_QUERY_MAX_CODE_POINTS);
  } else {
    q = query;
  }

  url.searchParams.set('q', q);
  url.searchParams.set('limit', `${limit}`);
  if (offset != null) {
    url.searchParams.set('offset', `${offset}`);
  }

  const response = await fetchJsonViaProxy({
    method: 'GET',
    url: url.toString(),
    signal,
  });

  const parsedResponse = parseUnknown(GiphyResponseSchema, response.data);

  if (parsedResponse.type === 'synthetic-error') {
    throw new Error(
      'Received synthetic response from Giphy, app should treat this as an API failure'
    );
  }

  return normalizeGiphyResults(parsedResponse.data);
}

export async function fetchGiphyTrending(
  limit: number,
  offset: number | null,
  signal?: AbortSignal
): Promise<PaginatedGifResults> {
  const url = new URL('v1/gifs/trending', BASE_API_URL);

  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('rating', CONTENT_RATING);
  url.searchParams.set('bundle', CONTENT_BUNDLE);
  url.searchParams.set('fields', GIF_FIELDS);

  url.searchParams.set('limit', `${limit}`);
  if (offset != null) {
    url.searchParams.set('offset', `${offset}`);
  }

  const response = await fetchJsonViaProxy({
    method: 'GET',
    url: url.toString(),
    signal,
  });

  const parsedResponse = parseUnknown(GiphyResponseSchema, response.data);

  if (parsedResponse.type === 'synthetic-error') {
    throw new Error(
      'Received synthetic response from Giphy, app should treat this as an API failure'
    );
  }

  return normalizeGiphyResults(parsedResponse.data);
}

export function fetchGiphyFile(
  giphyCdnUrl: string,
  signal?: AbortSignal
): Promise<Blob> {
  if (!isGiphyCdnUrl(giphyCdnUrl)) {
    throw new Error(
      `fetchGiphyFile: Blocked unsupported url origin: ${giphyCdnUrl}`
    );
  }
  return fetchInSegments(giphyCdnUrl, fetchBytesViaProxy, signal);
}
