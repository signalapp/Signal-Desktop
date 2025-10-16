// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { strictAssert } from '../../../util/assert.std.js';
import type { fetchBytesViaProxy } from '../../../textsecure/WebAPI.preload.js';

/** @internal Exported for testing */
export const _SEGMENT_SIZE_BUCKETS: ReadonlyArray<number> = [
  // highest to lowest
  1024 * 1024, // 1MiB
  1024 * 500, // 500 KiB
  1024 * 100, // 100 KiB
  1024 * 50, // 50 KiB
  1024 * 10, // 10 KiB
  1024 * 1, // 1 KiB
];

/** @internal Exported for testing */
export type _SegmentRange = Readonly<{
  startIndex: number;
  endIndexInclusive: number;
  sliceStart: number;
  segmentSize: number;
  sliceSize: number;
}>;

async function fetchContentLength(
  url: string,
  doFetchBytesViaProxy: typeof fetchBytesViaProxy,
  signal?: AbortSignal
): Promise<number> {
  const { response } = await doFetchBytesViaProxy({
    url,
    method: 'HEAD',
    signal,
  });
  const contentLength = Number(response.headers.get('Content-Length'));
  strictAssert(
    Number.isInteger(contentLength),
    'Content-Length must be integer'
  );
  return contentLength;
}

/** @internal Exported for testing */
export function _getSegmentSize(contentLength: number): number {
  const nextLargestSegmentSize = _SEGMENT_SIZE_BUCKETS.find(segmentSize => {
    return contentLength >= segmentSize;
  });
  // If too small, return the content length
  return nextLargestSegmentSize ?? contentLength;
}

/** @internal Exported for testing */
export function _getSegmentRanges(
  contentLength: number,
  segmentSize: number
): ReadonlyArray<_SegmentRange> {
  const segmentRanges: Array<_SegmentRange> = [];
  const segmentCount = Math.ceil(contentLength / segmentSize);
  for (let index = 0; index < segmentCount; index += 1) {
    let startIndex = segmentSize * index;
    let endIndexInclusive = startIndex + segmentSize - 1;
    let sliceSize = segmentSize;
    let sliceStart = 0;

    if (endIndexInclusive > contentLength) {
      endIndexInclusive = contentLength - 1;
      startIndex = contentLength - segmentSize;
      sliceSize = contentLength % segmentSize;
      sliceStart = segmentSize - sliceSize;
    }

    segmentRanges.push({
      startIndex,
      endIndexInclusive,
      sliceStart,
      segmentSize,
      sliceSize,
    });
  }
  return segmentRanges;
}

function assertExpected<T>(actual: T, expected: T, message: string) {
  strictAssert(
    Object.is(actual, expected),
    `${message}: ${actual} (expected: ${expected})`
  );
}

async function fetchSegment(
  url: string,
  segmentRange: _SegmentRange,
  contentLength: number,
  doFetchBytesViaProxy: typeof fetchBytesViaProxy,
  signal?: AbortSignal
): Promise<ArrayBufferView> {
  const { data, response } = await doFetchBytesViaProxy({
    method: 'GET',
    url,
    signal,
    headers: {
      Range: `bytes=${segmentRange.startIndex}-${segmentRange.endIndexInclusive}`,
    },
  });

  assertExpected(
    response.headers.get('Content-Length'),
    `${segmentRange.segmentSize}`,
    'Unexpected Content-Length header'
  );

  assertExpected(
    response.headers.get('Content-Range'),
    `bytes ${segmentRange.startIndex}-${segmentRange.endIndexInclusive}/${contentLength}`,
    'Unexpected Content-Range header'
  );

  assertExpected(
    data.byteLength,
    segmentRange.segmentSize,
    'Unexpected response buffer byte length'
  );

  let slice: ArrayBufferView;
  // Trim duplicate bytes from start of last segment
  if (segmentRange.sliceStart > 0) {
    slice = data.subarray(segmentRange.sliceStart);
  } else {
    slice = data;
  }
  assertExpected(
    slice.byteLength,
    segmentRange.sliceSize,
    'Unexpected slice byte length'
  );
  return slice;
}

export async function fetchInSegments(
  url: string,
  doFetchBytesViaProxy: typeof fetchBytesViaProxy,
  signal?: AbortSignal
): Promise<Blob> {
  const contentLength = await fetchContentLength(
    url,
    doFetchBytesViaProxy,
    signal
  );
  const segmentSize = _getSegmentSize(contentLength);
  const segmentRanges = _getSegmentRanges(contentLength, segmentSize);
  const segmentBuffers = await Promise.all(
    segmentRanges.map(segmentRange => {
      return fetchSegment(
        url,
        segmentRange,
        contentLength,
        doFetchBytesViaProxy,
        signal
      );
    })
  );
  return new Blob(segmentBuffers);
}
