// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

function getRatio(min: number, max: number, value: number) {
  return (value - min) / (max - min);
}

const MAX_BLACK = 7;
const MIN_WHITE = 95;

function getHSLValues(percentage: number): [number, number, number] {
  if (percentage <= MAX_BLACK) {
    return [0, 0.5, 0.5 * getRatio(0, MAX_BLACK, percentage)];
  }

  if (percentage >= MIN_WHITE) {
    return [0, 0, Math.min(1, 0.5 + getRatio(MIN_WHITE, 100, percentage))];
  }

  const ratio = getRatio(MAX_BLACK, MIN_WHITE, percentage);

  return [338 * ratio, 1, 0.5];
}

// https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
function hslToRGB(
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

export function getHSL(percentage: number): string {
  const [h, s, l] = getHSLValues(percentage);
  return `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
}

export function getRGBANumber(percentage: number): number {
  const [h, s, l] = getHSLValues(percentage);
  const { r, g, b } = hslToRGB(h, s, l);

  // eslint-disable-next-line no-bitwise
  return 0x100000000 + ((255 << 24) | ((255 & r) << 16) | ((255 & g) << 8) | b);
}

export function getRGBA(percentage: number, alpha = 1): string {
  const [h, s, l] = getHSLValues(percentage);
  const { r, g, b } = hslToRGB(h, s, l);

  const rgbValue = [r, g, b].map(String).join(',');

  return `rgba(${rgbValue},${alpha})`;
}
