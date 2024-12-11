// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
export function hslToRGB(
  h: number,
  s: number,
  l: number
): {
  r: number;
  g: number;
  b: number;
} {
  const a = s * Math.min(l, 1 - l);

  function f(n: number): number {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  }

  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4)),
  };
}

export function hslToRGBInt(
  hue: number,
  saturation: number,
  lightness: number
): number {
  const { r, g, b } = hslToRGB(hue, saturation, lightness);
  // eslint-disable-next-line no-bitwise
  return ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
}
