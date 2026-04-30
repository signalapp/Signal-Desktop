// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export namespace utf8 {
  const SURROGATE_MASK = 0b11111100_00000000;
  const HIGH_SURROGATE = 0b11011000_00000000;
  const LOW_SURROGATE = 0b11011100_00000000;

  /** Source: https://codeberg.org/indutny/protopiler/src/branch/main/lib/utf8.mjs */
  function _getByteLength(
    input: string,
    onlyNeedToKnowIsOver: number | null
  ): number {
    let size = 0;
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      if (code < 0x80) {
        // One byte: 0x00-0x7f
        size += 1;
      } else if (code < 0x800) {
        // Two bytes: 0x80-0x7ff
        size += 2;
        // oxlint-disable-next-line no-bitwise
      } else if ((code & SURROGATE_MASK) === HIGH_SURROGATE) {
        i += 1;
        if (i === input.length) {
          // Missing low surrogate, encode \ufffd
          size += 3;
          continue;
        }

        const second = input.charCodeAt(i);
        // oxlint-disable-next-line no-bitwise
        if ((second & SURROGATE_MASK) !== LOW_SURROGATE) {
          i -= 1;

          // Missing low surrogate, encode \ufffd
          size += 3;
          continue;
        }

        // Four bytes through a surrogate pair
        size += 4;
      } else {
        // Three bytes: 0x800-0xffff, or low surrogate without high surrogate
        size += 3;
      }

      if (onlyNeedToKnowIsOver != null && size > onlyNeedToKnowIsOver) {
        break;
      }
    }
    return size;
  }

  export function getByteLength(input: string): number {
    return _getByteLength(input, null);
  }

  const MIN_BYTES_PER_CHAR = 1;
  const MAX_BYTES_PER_CHAR = 3;

  function _minPossibleBytes(input: string) {
    return input.length * MIN_BYTES_PER_CHAR;
  }

  function _maxPossibleBytes(input: string) {
    return input.length * MAX_BYTES_PER_CHAR;
  }

  export function lt(input: string, n: number): boolean {
    return _maxPossibleBytes(input) < n || _getByteLength(input, n) < n;
  }

  export function lte(input: string, n: number): boolean {
    return _maxPossibleBytes(input) <= n || _getByteLength(input, n) <= n;
  }

  export function gt(input: string, n: number): boolean {
    return _minPossibleBytes(input) > n || _getByteLength(input, n) > n;
  }

  export function gte(input: string, n: number): boolean {
    return _minPossibleBytes(input) >= n || _getByteLength(input, n) >= n;
  }

  let segmenter: Intl.Segmenter;
  function getSegmenter() {
    segmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' });
    return segmenter;
  }

  function _getGraphemeCount(
    input: string,
    onlyNeedToKnowIsOver: number | null
  ): number {
    if (input.length === 0) {
      return 0;
    }

    let result = 0;
    // oxlint-disable-next-line no-unused-vars
    for (const _grapheme of getSegmenter().segment(input)) {
      result += 1;

      if (onlyNeedToKnowIsOver != null && result > onlyNeedToKnowIsOver) {
        break;
      }
    }

    return result;
  }

  export function getGraphemeCount(input: string): number {
    return _getGraphemeCount(input, null);
  }

  export function truncateGraphemes(input: string, maxBytes: number): string {
    if (maxBytes === 0) {
      return '';
    }

    let count = 0;
    let result = '';

    for (const item of getSegmenter().segment(input)) {
      count += 1;
      result += item.segment;

      if (count === maxBytes) {
        break;
      }
    }

    return result;
  }

  export function truncateBytesAndGraphemes(
    value: string,
    maxBytes: number,
    maxGraphemes: number
  ): string {
    if (lte(value, maxBytes)) {
      return truncateGraphemes(value, maxGraphemes);
    }

    let result = '';
    let remainingBytes = maxBytes;
    let remainingGraphemes = maxGraphemes;

    for (const grapheme of getSegmenter().segment(value)) {
      remainingBytes -= _getByteLength(grapheme.segment, remainingBytes);
      remainingGraphemes -= 1;

      if (remainingBytes >= 0 && remainingGraphemes >= 0) {
        result += grapheme.segment;
      }

      if (remainingBytes <= 0 && remainingGraphemes <= 0) {
        break;
      }
    }

    return result;
  }
}
