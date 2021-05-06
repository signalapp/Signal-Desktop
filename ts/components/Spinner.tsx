// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

export const SpinnerSvgSizes = ['small', 'normal'] as const;
export type SpinnerSvgSize = typeof SpinnerSvgSizes[number];

export const SpinnerDirections = [
  'outgoing',
  'incoming',
  'on-background',
  'on-captcha',
  'on-progress-dialog',
  'on-avatar',
] as const;
export type SpinnerDirection = typeof SpinnerDirections[number];

export type Props = {
  moduleClassName?: string;
  direction?: SpinnerDirection;
  size?: string;
  svgSize: SpinnerSvgSize;
};

export const Spinner = ({
  moduleClassName,
  size,
  svgSize,
  direction,
}: Props): JSX.Element => (
  <div
    className={classNames(
      'module-spinner__container',
      `module-spinner__container--${svgSize}`,
      direction ? `module-spinner__container--${direction}` : null,
      direction ? `module-spinner__container--${svgSize}-${direction}` : null,
      moduleClassName ? `${moduleClassName}__container` : null
    )}
    style={{
      height: size,
      width: size,
    }}
  >
    <div
      className={classNames(
        'module-spinner__circle',
        `module-spinner__circle--${svgSize}`,
        direction ? `module-spinner__circle--${direction}` : null,
        direction ? `module-spinner__circle--${svgSize}-${direction}` : null,
        moduleClassName ? `${moduleClassName}__circle` : null
      )}
    />
    <div
      className={classNames(
        'module-spinner__arc',
        `module-spinner__arc--${svgSize}`,
        direction ? `module-spinner__arc--${direction}` : null,
        direction ? `module-spinner__arc--${svgSize}-${direction}` : null,
        moduleClassName ? `${moduleClassName}__arc` : null
      )}
    />
  </div>
);
