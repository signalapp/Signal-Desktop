// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare namespace Intl {
  type SegmenterOptions = {
    granularity?: 'grapheme' | 'word' | 'sentence';
  };

  type SegmentData = {
    index: number;
    input: string;
    segment: string;
  };

  interface Segments {
    containing(index: number): SegmentData;

    [Symbol.iterator](): Iterator<SegmentData>;
  }

  // `Intl.Segmenter` is not yet in TypeScript's type definitions, so we add it.
  class Segmenter {
    constructor(locale?: string, options?: SegmenterOptions);

    segment(str: string): Segments;
  }
}
