// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from './assert.std.tsx';

export namespace AxoMath {
  export function clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  /** Works the same way as CSS `progress([no-clamp] <min> <value> <max>)` */
  export function progress(
    value: number,
    min: number,
    max: number,
    noClamp?: boolean
  ): number {
    assert(max > min, 'max must be greater than min');
    const result = (value - min) / (max - min);
    return noClamp ? result : clamp(result, 0, 1);
  }

  export function circumference(radius: number): number {
    return radius * 2 * Math.PI;
  }

  export function pseudoRandomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
