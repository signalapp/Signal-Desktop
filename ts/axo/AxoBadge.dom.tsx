// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { unreachable } from './_internal/assert.std.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { type AxoIntl, useAxoIntl } from './_internal/AxoIntl.dom.tsx';

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
export namespace AxoBadge {
  /**
   * Visual style of the badge.
   */
  export type Variant = 'primary' | 'secondary' | 'destructive';

  /**
   * Visual size of the badge.
   * - `sm`: 14px height
   * - `md`: 16px height
   * - `lg`: 18px height
   */
  export type Size = 'dot' | 'sm' | 'md' | 'lg';

  /**
   * What the badge represents.
   * - `number`: A numeric count, displayed with optional overflow formatting.
   * - `'mention'`: Shows an `@`-sign icon.
   * - `'unread'`: A dot with no text content.
   */
  export type Value = number | 'mention' | 'unread' | 'error';

  const baseStyles = tw(
    'flex items-center justify-center-safe overflow-clip',
    'rounded-full font-semibold',
    'forced-color-adjust-none forced-colors:bg-[Mark] forced-colors:text-[MarkText]'
  );

  const Variants = variants<Variant>('AxoBadge.Variant', {
    primary: tw('bg-accent text-primary-oncolor'),
    secondary: tw('bg-primary text-secondary'),
    destructive: tw('bg-destructive text-primary-oncolor'),
  });

  const Sizes = variants<Size>('AxoBadge.Size', {
    dot: tw('size-1.5'),
    sm: tw('size-fit min-h-3.5 min-w-3.5'),
    md: tw('size-fit min-h-4 min-w-4'),
    lg: tw('size-fit min-h-4.5 min-w-4.5'),
  });

  const TextSizes = variants<Size>('AxoBadge.Size', {
    dot: tw('sr-only'),
    sm: tw('text-[8px] leading-3.5'),
    md: tw('text-[11px] leading-4'),
    lg: tw('text-[11px] leading-4.5'),
  });

  const CountSizes = variants<Size>('AxoBadge.Size', {
    dot: tw(),
    sm: tw('px-0.75'),
    md: tw('px-1'),
    lg: tw('px-1.25'),
  });

  /** @testexport */
  export function _getAllSizes(): ReadonlyArray<Size> {
    return Sizes.keys();
  }

  let cachedNumberFormat: Intl.NumberFormat;

  function formatBadgeCount(
    value: number,
    max: number,
    intl: AxoIntl.ContextType
  ): string {
    if (value > max) {
      return intl.get('AxoBadge.MaxOverflow')(max);
    }
    cachedNumberFormat ??= new Intl.NumberFormat();
    return cachedNumberFormat.format(value);
  }

  /**
   * <AxoBadge.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Visual style of the badge. */
    variant: Variant;
    /** Visual size of the badge. */
    size: Size;
    /** What the badge represents. */
    value: Value;
    /** When `value` is a number, values above this are formatted `{max}+`. */
    max: number;
    /** Accessible label for screen readers. Pass `null` if the badge is purely decorative. */
    label: string | null;
  }>;

  /**
   * Renders a colored pill badge.
   *
   * @example Count with overflow
   * ```tsx
   * <AxoBadge.Root
   *   variant="primary"
   *   size="md"
   *   value={42}
   *   max={99}
   *   label="42 unread messages"
   * />
   * ```
   *
   * @example Mention
   * ```tsx
   * <AxoBadge.Root
   *   variant="primary"
   *   size="md"
   *   value="mention"
   *   max={99}
   *   label="You were mentioned"
   * />
   * ```
   *
   * @example Unread
   * ```tsx
   * <AxoBadge.Root
   *   variant="primary"
   *   size="md"
   *   value="unread"
   *   max={99}
   *   label="Marked unread"
   * />
   * ```
   *
   * * @example Update Dot
   * ```tsx
   * <AxoBadge.Root
   *   variant="primary"
   *   size="dot"
   *   value={0}
   *   max={0}
   *   label="Update Available"
   * />
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const { variant, size, value, max } = props;
    const intl = useAxoIntl();

    const children = useMemo(() => {
      if (value === 'unread') {
        return null;
      }
      if (value === 'error') {
        return (
          <span className={TextSizes.get(size)}>
            <AxoSymbol.InlineGlyph symbol="error" label={null} />
          </span>
        );
      }
      if (value === 'mention') {
        return (
          <span className={TextSizes.get(size)}>
            <AxoSymbol.InlineGlyph symbol="at" label={null} />
          </span>
        );
      }
      if (typeof value === 'number') {
        return (
          <span
            aria-hidden
            className={tw(TextSizes.get(size), CountSizes.get(size))}
          >
            {formatBadgeCount(value, max, intl)}
          </span>
        );
      }
      unreachable(value);
    }, [size, value, max, intl]);

    return (
      <span
        aria-label={props.label ?? undefined}
        className={tw(baseStyles, Variants.get(variant), Sizes.get(size))}
      >
        {children}
      </span>
    );
  });

  Root.displayName = 'AxoBadge.Root';
}
