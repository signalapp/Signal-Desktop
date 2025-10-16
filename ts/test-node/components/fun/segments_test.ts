// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import {
  _getSegmentRanges,
  _getSegmentSize,
  _SEGMENT_SIZE_BUCKETS,
  type _SegmentRange,
} from '../../../components/fun/data/segments.std.js';

const SMALLEST_BUCKET = Math.min(..._SEGMENT_SIZE_BUCKETS);

describe('segments', () => {
  describe('_getSegmentSize', () => {
    function check(contentLength: number, expectedSize: number, label: string) {
      assert.equal(_getSegmentSize(contentLength), expectedSize, label);
    }

    it('should use the content-length if its shorter than the smallest segment size', () => {
      check(0, 0, 'zero');
      check(1, 1, 'one');
      check(10, 10, 'ten');
      check(SMALLEST_BUCKET - 1, SMALLEST_BUCKET - 1, 'smallest - 1');
      check(SMALLEST_BUCKET - 10, SMALLEST_BUCKET - 10, 'smallest - 10');
    });

    it('should pick the closest smaller bucket to the content-length', () => {
      _SEGMENT_SIZE_BUCKETS.forEach((size, index) => {
        check(size, size, `exact size ${size}`);
        check(size + 1, size, `size ${size} + 1`);
        check(size + 10, size, `size ${size} + 10`);
        const largerSize = _SEGMENT_SIZE_BUCKETS[index - 1] ?? null; // Note: at() wraps
        if (largerSize != null) {
          check(largerSize - 1, size, `larger size ${largerSize} - 1`);
          check(largerSize - 10, size, `larger size ${largerSize} - 10`);
        }
      });
    });
  });

  describe('_getSegmentRanges', () => {
    function check(
      contentLength: number,
      segmentSize: number,
      expected: ReadonlyArray<_SegmentRange>
    ) {
      assert.deepEqual(_getSegmentRanges(contentLength, segmentSize), expected);
    }

    function segmentAtIndex(segmentSize: number, index: number): _SegmentRange {
      return {
        startIndex: segmentSize * index,
        endIndexInclusive: segmentSize * (index + 1) - 1,
        sliceStart: 0,
        sliceSize: segmentSize,
        segmentSize,
      };
    }

    function finalSegment(contentLength: number, segmentSize: number) {
      const offset = contentLength % segmentSize;
      return {
        startIndex: contentLength - segmentSize,
        endIndexInclusive: contentLength - 1,
        sliceStart: segmentSize - offset,
        sliceSize: offset,
        segmentSize,
      };
    }

    it('should return 0 segments for contentLength 0', () => {
      const contentLength = 0;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, []);
    });

    it('should return 1 segments for contentLength equal to bucket segmentSize', () => {
      const contentLength = SMALLEST_BUCKET;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [segmentAtIndex(segmentSize, 0)]);
    });

    it('should return 2 segments for contentLength slightly bigger than segmentSize', () => {
      const offset = 10;
      const contentLength = SMALLEST_BUCKET + offset;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [
        segmentAtIndex(segmentSize, 0),
        finalSegment(contentLength, segmentSize),
      ]);
    });

    it('should return 2 segments for contentLength equal to 2x segmentSize', () => {
      const contentLength = SMALLEST_BUCKET * 2;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [
        segmentAtIndex(segmentSize, 0),
        segmentAtIndex(segmentSize, 1),
      ]);
    });

    it('should return 3 segments for contentLength slightly bigger than 2x segmentSize', () => {
      const offset = 10;
      const contentLength = SMALLEST_BUCKET * 2 + offset;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [
        segmentAtIndex(segmentSize, 0),
        segmentAtIndex(segmentSize, 1),
        finalSegment(contentLength, segmentSize),
      ]);
    });

    it('should return 3 segments for contentLength equal to 3x segmentSize', () => {
      const contentLength = SMALLEST_BUCKET * 3;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [
        segmentAtIndex(segmentSize, 0),
        segmentAtIndex(segmentSize, 1),
        segmentAtIndex(segmentSize, 2),
      ]);
    });

    it('should return 4 segments for contentLength slightly bigger than 3x segmentSize', () => {
      const offset = 10;
      const contentLength = SMALLEST_BUCKET * 3 + offset;
      const segmentSize = SMALLEST_BUCKET;
      check(contentLength, segmentSize, [
        segmentAtIndex(segmentSize, 0),
        segmentAtIndex(segmentSize, 1),
        segmentAtIndex(segmentSize, 2),
        finalSegment(contentLength, segmentSize),
      ]);
    });
  });
});
