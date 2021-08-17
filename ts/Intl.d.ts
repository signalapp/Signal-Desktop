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
    // According to [the proposal][0], `isWordLike` is a boolean when `granularity` is
    //   "word" and undefined otherwise. There may be a more rigid way to enforce this
    //   with TypeScript, but an optional property is okay for now.
    //
    // [0]: https://github.com/tc39/proposal-intl-segmenter/blob/e5f982f51cef810111dfeab835d6a934a7cae045/README.md
    isWordLike?: boolean;
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
