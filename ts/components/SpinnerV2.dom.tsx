// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { tw, type TailwindStyles } from '../axo/tw.dom.js';
import { roundFractionForProgressBar } from '../util/numbers.std.js';

export type Props = {
  value?: number | 'indeterminate'; // default: 'indeterminate'
  min?: number; // default: 0
  max?: number; // default: 1
  variant?: SpinnerVariant;
  ariaLabel?: string;
  marginRatio?: number;
  size: number;
  strokeWidth: number;
};

type SpinnerVariantStyles = Readonly<{
  fg: TailwindStyles;
  bg: TailwindStyles;
}>;

const SpinnerVariants = {
  normal: {
    bg: tw('stroke-label-disabled-on-color'),
    fg: tw('stroke-label-primary-on-color'),
  },
  'no-background': {
    bg: tw('stroke-none'),
    fg: tw('stroke-label-primary-on-color'),
  },
  'no-background-incoming': {
    bg: tw('stroke-none'),
    fg: tw('stroke-label-primary'),
  },
  'no-background-light': {
    bg: tw('stroke-none'),
    fg: tw('stroke-border-primary'),
  },
  brand: {
    bg: tw('stroke-fill-secondary'),
    fg: tw('stroke-border-selected'),
  },
  'axo-button-spinner-secondary': {
    bg: tw('stroke-none'),
    fg: tw('stroke-label-primary'),
  },
  'axo-button-spinner-on-color': {
    bg: tw('stroke-none'),
    fg: tw('stroke-label-primary-on-color'),
  },
  'axo-button-spinner-primary': {
    bg: tw('stroke-none'),
    fg: tw('stroke-color-label-primary'),
  },
  'axo-button-spinner-affirmative': {
    bg: tw('stroke-none'),
    fg: tw('stroke-color-label-affirmative'),
  },
  'axo-button-spinner-destructive': {
    bg: tw('stroke-none'),
    fg: tw('stroke-color-label-destructive'),
  },
} as const satisfies Record<string, SpinnerVariantStyles>;

export type SpinnerVariant = keyof typeof SpinnerVariants;

export function SpinnerV2({
  value = 'indeterminate',
  min = 0,
  max = 1,
  variant = 'normal',
  marginRatio,
  size,
  strokeWidth,
  ariaLabel,
}: Props): JSX.Element {
  const sizeInPixels = `${size}px`;

  const radius = Math.min(
    size / 2 - strokeWidth / 2,
    (size / 2) * (marginRatio ?? 0.8)
  );
  const circumference = radius * 2 * Math.PI;

  const { bg, fg } = SpinnerVariants[variant];

  const bgElem = (
    <circle
      className={tw(bg, 'fill-none')}
      strokeWidth={strokeWidth}
      r={radius}
      cx={size / 2}
      cy={size / 2}
    />
  );

  if (value === 'indeterminate') {
    return (
      <svg
        className={tw('fill-none')}
        aria-label={ariaLabel}
        width={sizeInPixels}
        height={sizeInPixels}
      >
        {bgElem}
        <g className={tw('origin-center animate-spinner-v2-rotate')}>
          <circle
            className={tw(fg, 'animate-spinner-v2-dash fill-none')}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            style={{
              strokeLinecap: 'round',
            }}
            strokeWidth={strokeWidth}
          />
        </g>
      </svg>
    );
  }
  const fractionComplete = roundFractionForProgressBar(
    (value - min) / (max - min)
  );

  return (
    <svg
      className={tw('fill-none')}
      width={sizeInPixels}
      height={sizeInPixels}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {bgElem}
      <g className={tw('origin-center -rotate-90')}>
        <circle
          className={tw(
            fg,
            'fill-none transition-[stroke-dashoffset] duration-500 ease-out-cubic'
          )}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          style={{ strokeLinecap: 'round' }}
          strokeWidth={strokeWidth}
          // setting the strokeDashArray to be the circumference of the ring
          // means each dash will cover the whole ring
          strokeDasharray={circumference}
          // offsetting the dash as a fraction of the circumference allows
          // showing the progress
          strokeDashoffset={(1 - fractionComplete) * circumference}
        />
      </g>
    </svg>
  );
}
