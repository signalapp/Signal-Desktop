// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { z } from 'zod';
import { parseUnknown } from '../../../util/schemas.std.js';
import {
  fetchJsonViaProxy,
  fetchBytesViaProxy,
} from '../../../textsecure/WebAPI.preload.js';
import { fetchInSegments } from './segments.std.js';
import { safeParseInteger } from '../../../util/numbers.std.js';
import type { PaginatedGifResults } from '../panels/FunPanelGifs.dom.js';
import {
  getGifCdnUrlOrigin,
  isGifCdnUrlOriginAllowed,
  isGiphyCdnUrlOrigin,
} from '../../../util/gifCdnUrls.dom.js';

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

export type GiphySearchParams = Readonly<{
  query: string;
  limit: number;
  offset: number;
}>;

export type GiphyTrendingParams = Readonly<{
  limit: number;
  offset: number;
}>;

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

const GiphyCdnUrl = z.string().refine(input => {
  const origin = getGifCdnUrlOrigin(input);
  return origin != null && isGiphyCdnUrlOrigin(origin);
});

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

export type GiphyPagination = z.infer<typeof GiphyPaginationSchema>;
export type GiphyImages = z.infer<typeof GiphyImagesSchema>;
export type GiphyGif = z.infer<typeof GiphyGifSchema>;
export type GiphyResults = z.infer<typeof GiphyResultsSchema>;

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

  url.searchParams.set('q', query);
  url.searchParams.set('limit', `${limit}`);
  if (offset != null) {
    url.searchParams.set('offset', `${offset}`);
  }

  const response = await fetchJsonViaProxy({
    method: 'GET',
    url: url.toString(),
    signal,
  });

  const results = parseUnknown(GiphyResultsSchema, response.data);
  return normalizeGiphyResults(results);
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

  const results = parseUnknown(GiphyResultsSchema, response.data);
  return normalizeGiphyResults(results);
}

export function fetchGiphyFile(
  giphyCdnUrl: string,
  signal?: AbortSignal
): Promise<Blob> {
  const origin = getGifCdnUrlOrigin(giphyCdnUrl);
  if (origin == null) {
    throw new Error('fetchGiphyFile: Cannot fetch invalid URL');
  }
  if (!isGifCdnUrlOriginAllowed(origin)) {
    throw new Error(
      `fetchGiphyFile: Blocked unsupported url origin: ${origin}`
    );
  }
  return fetchInSegments(giphyCdnUrl, fetchBytesViaProxy, signal);
}
