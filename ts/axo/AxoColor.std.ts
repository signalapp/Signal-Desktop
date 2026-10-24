// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// oxlint-disable signal-desktop/enforce-file-suffix

import { parseColor } from 'react-aria-components';
import type { Color as AriaColor } from 'react-aria-components';
import type { Tagged } from 'type-fest';
import { assert } from './_internal/assert.std.tsx';

const TOKEN: unique symbol = Symbol('private-constructor');

let CREATE: typeof AxoColor.__internals.create;
let GETTER: typeof AxoColor.__internals.getter;

export class AxoColor {
  readonly #color: AriaColor;

  static {
    CREATE = color => new AxoColor(color, TOKEN);
    GETTER = color => color.#color;
  }

  private constructor(color: AriaColor, token: typeof TOKEN) {
    assert(token === TOKEN, 'AxoColor: Illegal constructor');
    this.#color = color;
  }

  static parse(input: string): AxoColor {
    return new AxoColor(parseColor(input), TOKEN);
  }

  static fromHSL(input: AxoColor.HSLParams): AxoColor {
    return AxoColor.parse(
      `hsl(${input.hue}, ${input.saturation}%, ${input.lightness}%)`
    );
  }

  static fromARGBInt(input: AxoColor.ARGBInt): AxoColor {
    /* oxlint-disable no-bitwise */
    const rgb = (input & 0x00_ff_ff_ff) << 8; // drop the alpha channel
    const a = input >>> 24;
    const rgba = (rgb | a) >>> 0;
    /* oxlint-enable no-bitwise */

    const hex = `#${rgba.toString(16).padStart(8, '0')}`;
    return AxoColor.parse(hex);
  }

  css(): AxoColor.CSS {
    return this.#color.toString('css') as AxoColor.CSS;
  }

  argbInt(): AxoColor.ARGBInt {
    /* oxlint-disable no-bitwise */
    const alpha = this.#color.getChannelValue('alpha');
    const alphaByte = Math.round(alpha * 255); // 0xFF
    const alphaPrefix = (alphaByte << 24) >>> 0; // 0xFF_00_00_00
    /* oxlint-enable no-bitwise */

    // Note: `toHexInt()` drops the alpha channel
    const rgb = this.#color.toHexInt();
    const argb = alphaPrefix + rgb;

    return argb as AxoColor.ARGBInt;
  }

  hsl(): AxoColor.HSL {
    let hsl: AriaColor;

    if (this.#color.getColorSpace() === 'hsl') {
      hsl = this.#color;
    } else {
      hsl = this.#color.toFormat('hsl');
    }

    const hue = hsl.getChannelValue('hue');
    const saturation = hsl.getChannelValue('saturation');
    const lightness = hsl.getChannelValue('lightness');

    return { hue, saturation, lightness } as AxoColor.HSL;
  }
}

export namespace AxoColor {
  /**
   * AxoColor.CSS
   * --------------------------------------------------------------------------
   */

  export type CSS = Tagged<string, 'AxoColor.CSS'>;

  /**
   * AxoColor.ARGBInt
   * --------------------------------------------------------------------------
   */

  export type ARGBInt = Tagged<number, 'AxoColor.ARGBInt'>;

  /**
   * AxoColor.HSL
   * --------------------------------------------------------------------------
   */

  export type HSL = Tagged<HSLChannels, 'AxoColor.HSL'>;

  type HSLChannels = Readonly<{
    hue: Hue;
    saturation: Saturation;
    lightness: Lightness;
  }>;

  export type Hue = Tagged<number, 'AxoColor.Hue'>;
  export type Saturation = Tagged<number, 'AxoColor.Saturation'>;
  export type Lightness = Tagged<number, 'AxoColor.Lightness'>;

  export type HSLParams = Readonly<{
    hue: number;
    saturation: number;
    lightness: number;
  }>;

  /**
   * Internals
   * --------------------------------------------------------------------------
   */

  export namespace __internals {
    export function create(color: AriaColor): AxoColor {
      return CREATE(color);
    }

    export function getter(color: AxoColor): AriaColor {
      return GETTER(color);
    }
  }
}
