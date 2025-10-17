// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import React, { memo, useMemo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import { unreachable } from './_internal/assert.dom.js';

const Namespace = 'AxoBadge';

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
  export type BadgeSize = 'sm' | 'md' | 'lg';
  export type BadgeValue = number | 'mention' | 'unread';

  const baseStyles = tw(
    'flex size-fit items-center justify-center-safe overflow-clip',
    'rounded-full font-semibold',
    'bg-color-fill-primary text-label-primary-on-color',
    'select-none'
  );

  type BadgeConfig = Readonly<{
    rootStyles: TailwindStyles;
    countStyles: TailwindStyles;
  }>;

  const BadgeSizes: Record<BadgeSize, BadgeConfig> = {
    sm: {
      rootStyles: tw(baseStyles, 'min-h-3.5 min-w-3.5 text-[8px] leading-3.5'),
      countStyles: tw('px-[3px]'),
    },
    md: {
      rootStyles: tw(baseStyles, 'min-h-4 min-w-4 text-[11px] leading-4'),
      countStyles: tw('px-[4px]'),
    },
    lg: {
      rootStyles: tw(baseStyles, 'min-h-4.5 min-w-4.5 text-[11px] leading-4.5'),
      countStyles: tw('px-[5px]'),
    },
  };

  export function _getAllBadgeSizes(): ReadonlyArray<BadgeSize> {
    return Object.keys(BadgeSizes) as Array<BadgeSize>;
  }

  let cachedNumberFormat: Intl.NumberFormat;

  // eslint-disable-next-line no-inner-declarations
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
   * Component: <AxoBadge.Root>
   * --------------------------
   */

  export type RootProps = Readonly<{
    size: BadgeSize;
    value: BadgeValue;
    max: number;
    maxDisplay: string;
    'aria-label': string | null;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { value, max, maxDisplay } = props;
    const config = BadgeSizes[props.size];

    const children = useMemo(() => {
      if (value === 'unread') {
        return null;
      }
      if (value === 'mention') {
        return (
          <span aria-hidden className={tw('leading-none')}>
            <AxoSymbol.InlineGlyph symbol="at" label={null} />
          </span>
        );
      }
      if (typeof value === 'number') {
        return (
          <span aria-hidden className={config.countStyles}>
            {formatBadgeCount(value, max, maxDisplay)}
          </span>
        );
      }
      unreachable(value);
    }, [value, max, maxDisplay, config]);

    return (
      <span
        aria-label={props['aria-label'] ?? undefined}
        className={config.rootStyles}
      >
        {children}
      </span>
    );
  });

  Root.displayName = `${Namespace}.Root`;
}
