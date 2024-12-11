// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// https://en.wikipedia.org/wiki/HSL_and_HSV#From_RGB
export function rgbToHSL(
  r: number,
  g: number,
  b: number
): {
  h: number;
  s: number;
  l: number;
} {
  // Normalize to [0, 1]
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const xMax = Math.max(rn, gn, bn);
  const xMin = Math.min(rn, gn, bn);
  const v = xMax;
  const c = xMax - xMin;
  const l = v - c / 2;
  let h: number;

  if (c === 0) {
    h = 0;
  } else if (v === rn) {
    h = 60 * (((gn - bn) / c + 6) % 6);
  } else if (v === gn) {
    h = 60 * ((bn - rn) / c + 2);
  } else {
    // v === b
    h = 60 * ((rn - gn) / c + 4);
  }

  let s: number;
  if (l === 0 || l === 1) {
    s = 0;
  } else {
    s = (v - l) / Math.min(l, 1 - l);
  }

  return { h, s, l };
}

export function rgbIntToHSL(intValue: number): {
  h: number;
  s: number;
  l: number;
} {
  // eslint-disable-next-line no-bitwise
  const r = (intValue >>> 16) & 0xff;
  // eslint-disable-next-line no-bitwise
  const g = (intValue >>> 8) & 0xff;
  // eslint-disable-next-line no-bitwise
  const b = intValue & 0xff;
  return rgbToHSL(r, g, b);
}
