// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta } from '@storybook/react';
import type { InputType } from '@storybook/types';

/**
 * Converts all optional properties to required properties that can be set to `undefined`.
 */
type Defined<T> = {
  [P in keyof Required<T>]: T[P];
};

/**
 * Ensures that the exported meta object from a storybook file has the correct shape.
 *
 * - `component` is a React component that accepts `Props`
 * - `args` has a default value for everything in `Props`
 *
 * ```ts
 * // 1. Always export default an object with the `component`, `argTypes`, and `args`
 * export default {
 *   component: Component,
 *   argsTypes: {
 *     propName: { control: { type: "text" } },
 *   },
 *   args: {
 *     propName: "defaultValue",
 *     onEvent: action("onEvent"),
 *   },
 *
 * // 3. Always use `satisfies ComponentMeta<Props>`, never use `as` it won't help you
 * } satisfies ComponentMeta<Props>
 * ```
 */
export type ComponentMeta<Props extends object> = Meta<Props> & {
  /** Ensure we're talking about the right component */
  component: React.ComponentType<Props>;
  /** Ensure every prop has a default even if its just `undefined` */
  args: Defined<Props>;
};

export function argPresets<T>(map: Record<string, T>): InputType {
  return {
    control: { type: 'select' },
    options: Object.keys(map),
    mapping: map,
  };
}
