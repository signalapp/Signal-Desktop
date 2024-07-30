// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

let cachedSegmenter: Intl.Segmenter;

/**
 * Slice a string by bytes into a valid Unicode string.
 *
 * @example
 * ```ts
 * unicodeSlice('123456', 2, 4); // => '34'
 * // '€' is 3 bytes, slicing it at 2 bytes would result in an invalid character
 * unicodeSlice('€', 0, 2); // => ''
 * // Each emoji is 4 bytes, with zero-width joiner of 3 bytes
 * unicodeSlice('👩‍👩‍👧‍👦', 0, 18); // => '👩‍👩‍👧'
 * ```
 */
export function unicodeSlice(
  input: string,
  begin: number,
  end: number
): string {
  // Until https://chromium-review.googlesource.com/c/v8/v8/+/4190519 is merged,
  // we should limit the input size to avoid allocating tons of memory.
  // This should be longer than any max length we'd expect to slice.
  const slice = input.slice(0, 5e7); // 50MB

  // 'und' is the BCP 47 subtag for "undetermined"
  // Unicode's CLDR doesn't have any special rules for granularity 'grapheme'
  // in any language, so we don't need to rely on loading any locale data.
  cachedSegmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' });

  const graphemes = cachedSegmenter.segment(slice);

  let result = '';
  let byteOffset = 0;

  for (const grapheme of graphemes) {
    const graphemeByteLength = Buffer.byteLength(grapheme.segment);
    const startsBefore = byteOffset < begin;
    byteOffset += graphemeByteLength;
    const endsAfter = byteOffset > end;
    if (startsBefore) {
      continue;
    }
    if (endsAfter) {
      break;
    }
    result += grapheme.segment;
  }

  return result;
}
