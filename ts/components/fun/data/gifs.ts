// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../../../util/assert';
import type { GifType } from '../panels/FunPanelGifs';
import type {
  TenorContentFormat,
  TenorNextCursor,
  TenorResponseResult,
} from './tenor';
import { tenor, isTenorTailCursor } from './tenor';

const PREVIEW_CONTENT_FORMAT: TenorContentFormat = 'mediumgif';
const ATTACHMENT_CONTENT_FORMAT: TenorContentFormat = 'mp4';

function toGif(result: TenorResponseResult): GifType {
  const preview = result.media_formats[PREVIEW_CONTENT_FORMAT];
  strictAssert(preview, `Missing ${PREVIEW_CONTENT_FORMAT}`);
  const attachment = result.media_formats[ATTACHMENT_CONTENT_FORMAT];
  strictAssert(attachment, `Missing ${ATTACHMENT_CONTENT_FORMAT}`);
  return {
    id: result.id,
    title: result.title,
    description: result.content_description,
    previewMedia: {
      url: preview.url,
      width: preview.dims[0],
      height: preview.dims[1],
    },
    attachmentMedia: {
      url: attachment.url,
      width: attachment.dims[0],
      height: attachment.dims[1],
    },
  };
}

export type GifsPaginated = Readonly<{
  next: TenorNextCursor | null;
  gifs: ReadonlyArray<GifType>;
}>;

export async function fetchFeatured(
  limit: number,
  cursor: TenorNextCursor | null,
  signal?: AbortSignal
): Promise<GifsPaginated> {
  const response = await tenor(
    'v2/featured',
    {
      // contentfilter: 'medium',
      media_filter: [PREVIEW_CONTENT_FORMAT, ATTACHMENT_CONTENT_FORMAT],
      limit,
      pos: cursor ?? undefined,
    },
    signal
  );

  const next = isTenorTailCursor(response.next) ? null : response.next;
  const gifs = response.results.map(result => toGif(result));
  return { next, gifs };
}

export async function fetchSearch(
  query: string,
  limit: number,
  cursor: TenorNextCursor | null,
  signal?: AbortSignal
): Promise<GifsPaginated> {
  const response = await tenor(
    'v2/search',
    {
      q: query,
      contentfilter: 'medium',
      media_filter: [PREVIEW_CONTENT_FORMAT, ATTACHMENT_CONTENT_FORMAT],
      limit,
      pos: cursor ?? undefined,
    },
    signal
  );

  const next = isTenorTailCursor(response.next) ? null : response.next;
  const gifs = response.results.map(result => toGif(result));
  return { next, gifs };
}
