// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { unreachable } from './_internal/assert.std.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoBadge.Root aria-label="42 unread messages">
 *   <AxoBadge.Count value={42} max={999}/>
 * </AxoBadge.Root>
 *
 * <AxoBadge.Root aria-label="Marked unread"/>
 *
 * <AxoBadge.Root aria-label="You were mentioned">
 *   <AxoBadge.Icon symbol="at" />
 * </AxoBadge.Root>
 * ````
 */
export namespace ExperimentalAxoBadge {
  /**
   * Visual size of the badge.
   * - `sm`: 14px height
   * - `md`: 16px height
   * - `lg`: 18px height
   */
  export type Size = 'sm' | 'md' | 'lg';

  /**
   * What the badge represents.
   * - `number`: A numeric count, displayed with optional overflow formatting.
   * - `'mention'`: Shows an `@`-sign icon.
   * - `'unread'`: A dot with no text content.
   */
  export type Value = number | 'mention' | 'unread';

  const baseStyles = tw(
    'flex size-fit items-center justify-center-safe overflow-clip',
    'rounded-full font-semibold',
    'bg-color-fill-primary text-label-primary-on-color',
    'forced-color-adjust-none forced-colors:bg-[Mark] forced-colors:text-[MarkText]',
    'select-none'
  );

  const Sizes = variants<Size>('AxoBadge.Size', {
    sm: tw(baseStyles, 'min-h-3.5 min-w-3.5 text-[8px] leading-3.5'),
    md: tw(baseStyles, 'min-h-4 min-w-4 text-[11px] leading-4'),
    lg: tw(baseStyles, 'min-h-4.5 min-w-4.5 text-[11px] leading-4.5'),
  });

  const CountSizes = variants<Size>('AxoBadge.Size', {
    sm: tw('px-[3px]'),
    md: tw('px-[4px]'),
    lg: tw('px-[5px]'),
  });

  /** @testexport */
  export function _getAllSizes(): ReadonlyArray<Size> {
    return Sizes.keys();
  }

  let cachedNumberFormat: Intl.NumberFormat;

  function formatBadgeCount(
    value: number,
    max: number,
    maxDisplay: string
  ): string {
    if (value > max) {
      return maxDisplay;
    }
    cachedNumberFormat ??= new Intl.NumberFormat();
    return cachedNumberFormat.format(value);
  }

  /**
   * <AxoBadge.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Visual size of the badge. */
    size: Size;
    /** What the badge represents. */
    value: Value;
    /** When `value` is a number, values above this are replaced with `maxDisplay`. */
    max: number;
    /** The string shown when the numeric `value` exceeds `max` (e.g. `"999+"`). */
    maxDisplay: string;
    /** Accessible label for screen readers. Pass `null` if the badge is purely decorative. */
    label: string | null;
  }>;

  /**
   * Renders a colored pill badge.
   *
   * @example Count with overflow
   * ```tsx
   * <ExperimentalAxoBadge.Root size="md" value={42} max={99} maxDisplay="99+" label="42 unread messages" />
   * ```
   *
   * @example Mention
   * ```tsx
   * <ExperimentalAxoBadge.Root size="md" value="mention" max={0} maxDisplay="" label="You were mentioned" />
   * ```
   *
   * @example Unread dot
   * ```tsx
   * <ExperimentalAxoBadge.Root size="md" value="unread" max={0} maxDisplay="" label="Marked unread" />
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { size, value, max, maxDisplay } = props;

    const children = useMemo(() => {
      if (value === 'unread') {
        return null;
      }
      if (value === 'mention') {
        return <AxoSymbol.InlineGlyph symbol="at" label={null} />;
      }
      if (typeof value === 'number') {
        return (
          <span aria-hidden className={CountSizes.get(size)}>
            {formatBadgeCount(value, max, maxDisplay)}
          </span>
        );
      }
      unreachable(value);
    }, [size, value, max, maxDisplay]);

    return (
      <span aria-label={props.label ?? undefined} className={Sizes.get(size)}>
        {children}
      </span>
    );
  });

  Root.displayName = 'AxoBadge.Root';
}
