// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

export type Props = {
  className?: string;
  marginRatio?: number;
  size: number;
  strokeWidth: number;
};

export function SpinnerV2({
  className,
  marginRatio,
  size,
  strokeWidth,
}: Props): JSX.Element {
  const radius = Math.min(size - strokeWidth / 2, size * (marginRatio ?? 0.8));
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
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
