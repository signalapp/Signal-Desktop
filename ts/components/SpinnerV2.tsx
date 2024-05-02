// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

export const SpinnerSvgSizes = ['small', 'normal'] as const;
export type SpinnerSvgSize = typeof SpinnerSvgSizes[number];

export type Props = {
  className?: string;
  size: number;
  strokeWidth: number;
};

export function SpinnerV2({
  className,
  size,
  strokeWidth,
}: Props): JSX.Element {
  return (
    <svg
      className={classNames('SpinnerV2', className)}
      viewBox={`0 0 ${size * 2} ${size * 2}`}
      style={{
        height: size,
        width: size,
      }}
    >
      <circle
        className="SpinnerV2__Path"
        cx={size}
        cy={size}
        r={size * 0.8}
        fill="none"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
