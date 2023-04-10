// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This takes `unknown` because, sometimes, values from the database don't match our
//   types. In the long term, we should fix that. In the short term, this smoothes over
//   the problem.
// Note: we really need to keep the string length the same for proper bodyRange handling
export function stripNewlinesForLeftPane(text: unknown): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/(\r?\n)/g, substring => {
    const { length } = substring;
    if (length === 2) {
      return '  ';
    }
    if (length === 1) {
      return ' ';
    }
    return '';
  });
}
