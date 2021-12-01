// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

function getRatio(min: number, max: number, value: number) {
  return (value - min) / (max - min);
}

function getHSLValues(percentage: number): [number, number, number] {
  if (percentage <= 10) {
    return [0, 0, 1 - getRatio(0, 10, percentage)];
  }

  if (percentage < 20) {
    return [0, 0.5, 0.5 * getRatio(10, 20, percentage)];
  }

  const ratio = getRatio(20, 100, percentage);

  return [360 * ratio, 1, 0.5];
}

export function getHSL(percentage: number): string {
  const [h, s, l] = getHSLValues(percentage);
  return `hsl(${h}, ${s * 100}%, ${l * 100}%)`;
}

// https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB_alternative
export function getRGBA(percentage: number, alpha = 1): string {
  const [h, s, l] = getHSLValues(percentage);

  const a = s * Math.min(l, 1 - l);

  function f(n: number): number {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  }

  const rgbValue = [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ]
    .map(String)
    .join(',');

  return `rgba(${rgbValue},${alpha})`;
}
