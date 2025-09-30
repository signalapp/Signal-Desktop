// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Modifier } from '@popperjs/core';
import type { OffsetModifier } from '@popperjs/core/lib/modifiers/offset.js';

/**
 * Shorthand for the [offset modifier][0] when you just wanna set the distance.
 *
 * [0]: https://popper.js.org/docs/v2/modifiers/offset/
 */
export const offsetDistanceModifier = (
  distance: number
): Partial<OffsetModifier> => ({
  name: 'offset',
  options: { offset: [undefined, distance] },
});

/**
 * Make the popper element the same width as the reference, even when you resize.
 *
 * Should probably be used with the "top-start", "top-end", "bottom-start", or
 * "bottom-end" placement.
 */
export const sameWidthModifier: Modifier<
  'sameWidth',
  Record<string, unknown>
> = {
  name: 'sameWidth',
  enabled: true,
  phase: 'write',
  fn({ state }) {
    // eslint-disable-next-line no-param-reassign
    state.elements.popper.style.width = `${state.rects.reference.width}px`;
  },
};
