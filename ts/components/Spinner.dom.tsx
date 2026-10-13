// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import classNames from 'classnames';

export const SpinnerSvgSizes = ['small', 'normal'] as const;
export type SpinnerSvgSize = (typeof SpinnerSvgSizes)[number];

const SPINNER_CONTAINER_SIZES: Record<SpinnerSvgSize, string | null> = {
  small: 'module-spinner__container--small',
  normal: null,
};

export const SpinnerDirections = [
  'outgoing',
  'incoming',
  'on-background',
  'on-primary-button',
  'on-progress-dialog',
  'on-avatar',
] as const;
export type SpinnerDirection = (typeof SpinnerDirections)[number];

const SPINNER_CONTAINER_DIRECTIONS: Record<SpinnerDirection, string> = {
  outgoing: 'module-spinner__container--outgoing',
  incoming: 'module-spinner__container--incoming',
  'on-background': 'module-spinner__container--on-background',
  'on-primary-button': 'module-spinner__container--on-primary-button',
  'on-progress-dialog': 'module-spinner__container--on-progress-dialog',
  'on-avatar': 'module-spinner__container--on-avatar',
};

export type Props = {
  ariaLabel?: string;
  direction?: SpinnerDirection;
  /** @deprecated */
  className?: string;
  role?: string;
  size?: string;
  svgSize: SpinnerSvgSize;
};

/**
 * @deprecated This has been superceded by the more customizable SpinnerV2 component.
 */
export function Spinner({
  ariaLabel,
  direction,
  className,
  role,
  size,
  svgSize,
}: Props): JSX.Element {
  return (
    <div
      className={classNames(
        'module-spinner__container',
        SPINNER_CONTAINER_SIZES[svgSize],
        direction && SPINNER_CONTAINER_DIRECTIONS[direction],
        className
      )}
      role={role}
      aria-label={ariaLabel}
      style={{
        height: size,
        width: size,
      }}
    >
      <div className="module-spinner__circle" />
      <div className="module-spinner__arc" />
    </div>
  );
}
