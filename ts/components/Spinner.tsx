// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { getClassNamesFor } from '../util/getClassNamesFor';

export const SpinnerSvgSizes = ['small', 'normal'] as const;
export type SpinnerSvgSize = (typeof SpinnerSvgSizes)[number];

export const SpinnerDirections = [
  'outgoing',
  'incoming',
  'on-background',
  'on-primary-button',
  'on-progress-dialog',
  'on-avatar',
] as const;
export type SpinnerDirection = (typeof SpinnerDirections)[number];

export type Props = {
  ariaLabel?: string;
  direction?: SpinnerDirection;
  moduleClassName?: string;
  role?: string;
  size?: string;
  svgSize: SpinnerSvgSize;
};

export function Spinner({
  ariaLabel,
  direction,
  moduleClassName,
  role,
  size,
  svgSize,
}: Props): JSX.Element {
  const getClassName = getClassNamesFor('module-spinner', moduleClassName);

  return (
    <div
      className={classNames(
        getClassName('__container'),
        getClassName(`__container--${svgSize}`),
        getClassName(direction && `__container--${direction}`),
        getClassName(direction && `__container--${svgSize}-${direction}`)
      )}
      role={role}
      aria-label={ariaLabel}
      style={{
        height: size,
        width: size,
      }}
    >
      <div
        className={classNames(
          getClassName('__circle'),
          getClassName(`__circle--${svgSize}`),
          getClassName(direction && `__circle--${direction}`),
          getClassName(direction && `__circle--${svgSize}-${direction}`)
        )}
      />
      <div
        className={classNames(
          getClassName('__arc'),
          getClassName(`__arc--${svgSize}`),
          getClassName(direction && `__arc--${direction}`),
          getClassName(direction && `__arc--${svgSize}-${direction}`)
        )}
      />
    </div>
  );
}
