// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, forwardRef } from 'react';
import type { ButtonHTMLAttributes, FC, ForwardedRef, ReactNode } from 'react';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { assert } from './_internal/assert.dom.js';
import type { SpinnerVariant } from '../components/SpinnerV2.dom.js';
import { SpinnerV2 } from '../components/SpinnerV2.dom.js';

const Namespace = 'AxoButton';

type GenericButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const baseAxoButtonStyles = tw(
  'relative inline-flex max-w-full items-center-safe justify-center-safe rounded-full select-none',
  'outline-0 outline-border-focused focused:outline-[2.5px]',
  'forced-colors:border'
);

const AxoButtonTypes = {
  default: tw(baseAxoButtonStyles),
  subtle: tw(
    baseAxoButtonStyles,
    'bg-fill-secondary',
    'pressed:bg-fill-secondary-pressed'
  ),
  floating: tw(
    baseAxoButtonStyles,
    'bg-fill-floating',
    'shadow-elevation-1',
    'pressed:bg-fill-floating-pressed'
  ),
  borderless: tw(
    baseAxoButtonStyles,
    'bg-transparent',
    'hovered:bg-fill-secondary',
    'pressed:bg-fill-secondary-pressed'
  ),
} as const satisfies Record<string, TailwindStyles>;

const AxoButtonVariants = {
  // default
  secondary: tw(
    AxoButtonTypes.default,
    'bg-fill-secondary text-label-primary',
    'pressed:bg-fill-secondary-pressed',
    'disabled:text-label-disabled'
  ),
  primary: tw(
    AxoButtonTypes.default,
    'bg-color-fill-primary text-label-primary-on-color',
    'pressed:bg-color-fill-primary-pressed',
    'disabled:text-label-disabled-on-color'
  ),
  affirmative: tw(
    AxoButtonTypes.default,
    'bg-color-fill-affirmative text-label-primary-on-color',
    'pressed:bg-color-fill-affirmative-pressed',
    'disabled:text-label-disabled-on-color'
  ),
  destructive: tw(
    AxoButtonTypes.default,
    'bg-color-fill-destructive text-label-primary-on-color',
    'pressed:bg-color-fill-destructive-pressed',
    'disabled:text-label-disabled-on-color'
  ),

  // subtle
  'subtle-primary': tw(
    AxoButtonTypes.subtle,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'subtle-affirmative': tw(
    AxoButtonTypes.subtle,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'subtle-destructive': tw(
    AxoButtonTypes.subtle,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),

  // floating
  'floating-secondary': tw(
    AxoButtonTypes.floating,
    'text-label-primary',
    'disabled:text-label-disabled'
  ),
  'floating-primary': tw(
    AxoButtonTypes.floating,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'floating-affirmative': tw(
    AxoButtonTypes.floating,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'floating-destructive': tw(
    AxoButtonTypes.floating,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),

  // borderless
  'borderless-secondary': tw(
    AxoButtonTypes.borderless,
    'text-label-primary',
    'disabled:text-label-disabled'
  ),
  'borderless-primary': tw(
    AxoButtonTypes.borderless,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'borderless-affirmative': tw(
    AxoButtonTypes.borderless,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'borderless-destructive': tw(
    AxoButtonTypes.borderless,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),
};

const AxoButtonSizes = {
  lg: tw('min-w-16 px-4 py-2 type-body-medium font-medium'),
  md: tw('min-w-14 px-3 py-1.5 type-body-medium font-medium'),
  sm: tw('min-w-12 px-2 py-1 type-body-small font-medium'),
} as const satisfies Record<string, TailwindStyles>;

type AxoButtonVariant = keyof typeof AxoButtonVariants;
type AxoButtonSize = keyof typeof AxoButtonSizes;

export function _getAllAxoButtonVariants(): ReadonlyArray<AxoButtonVariant> {
  return Object.keys(AxoButtonVariants) as Array<AxoButtonVariant>;
}

export function _getAllAxoButtonSizes(): ReadonlyArray<AxoButtonSize> {
  return Object.keys(AxoButtonSizes) as Array<AxoButtonSize>;
}

const AxoButtonSpinnerVariants: Record<AxoButtonVariant, SpinnerVariant> = {
  primary: 'axo-button-spinner-on-color',
  secondary: 'axo-button-spinner-secondary',
  affirmative: 'axo-button-spinner-on-color',
  destructive: 'axo-button-spinner-on-color',
  'subtle-primary': 'axo-button-spinner-primary',
  'subtle-affirmative': 'axo-button-spinner-affirmative',
  'subtle-destructive': 'axo-button-spinner-destructive',
  'floating-primary': 'axo-button-spinner-primary',
  'floating-secondary': 'axo-button-spinner-secondary',
  'floating-affirmative': 'axo-button-spinner-affirmative',
  'floating-destructive': 'axo-button-spinner-destructive',
  'borderless-primary': 'axo-button-spinner-primary',
  'borderless-secondary': 'axo-button-spinner-secondary',
  'borderless-affirmative': 'axo-button-spinner-affirmative',
  'borderless-destructive': 'axo-button-spinner-destructive',
};

const AxoButtonSpinnerSizes: Record<
  AxoButtonSize,
  { size: number; strokeWidth: number }
> = {
  lg: { size: 20, strokeWidth: 2 },
  md: { size: 20, strokeWidth: 2 },
  sm: { size: 16, strokeWidth: 1.5 },
};

type ExperimentalButtonSpinnerProps = Readonly<{
  buttonVariant: AxoButtonVariant;
  buttonSize: AxoButtonSize;
  'aria-label': string;
}>;

function ExperimentalButtonSpinner(
  props: ExperimentalButtonSpinnerProps
): JSX.Element {
  const variant = AxoButtonSpinnerVariants[props.buttonVariant];
  const sizeConfig = AxoButtonSpinnerSizes[props.buttonSize];
  return (
    <span className={tw('absolute inset-0 flex items-center justify-center')}>
      <SpinnerV2
        size={sizeConfig.size}
        strokeWidth={sizeConfig.strokeWidth}
        variant={variant}
        value="indeterminate"
        ariaLabel={props['aria-label']}
      />
    </span>
  );
}

export namespace AxoButton {
  export type Variant = AxoButtonVariant;
  export type Size = AxoButtonSize;

  export type Width = 'fit' | 'grow' | 'full';

  const Widths: Record<Width, TailwindStyles> = {
    /* Always try to fit to the content of the button */
    fit: tw(''),
    /* Allow the button to grow within a flex container */
    grow: tw('grow'),
    /* Always try to fill the available space */
    full: tw('w-full'),
  };

  export type RootProps = Readonly<{
    variant: AxoButtonVariant;
    size: AxoButtonSize;
    width?: Width;
    symbol?: AxoSymbol.InlineGlyphName;
    arrow?: boolean;
    experimentalSpinner?: { 'aria-label': string } | null;
    disabled?: GenericButtonProps['disabled'];
    onClick?: GenericButtonProps['onClick'];
    children: ReactNode;
    // Note: Technically we forward all props for Radix, but we restrict the
    // props that the type accepts
  }>;

  export const Root: FC<RootProps> = memo(
    forwardRef((props, ref: ForwardedRef<HTMLButtonElement>) => {
      const {
        variant,
        size,
        width,
        symbol,
        arrow,
        experimentalSpinner,
        children,
        ...rest
      } = props;
      const variantStyles = assert(
        AxoButtonVariants[variant],
        `${Namespace}: Invalid variant ${variant}`
      );
      const sizeStyles = assert(
        AxoButtonSizes[size],
        `${Namespace}: Invalid size ${size}`
      );
      const widthStyles = Widths[width ?? 'fit'];

      return (
        <button
          ref={ref}
          {...rest}
          type="button"
          className={tw(variantStyles, sizeStyles, widthStyles)}
        >
          <span
            className={tw(
              'flex shrink grow items-center-safe justify-center-safe gap-1 overflow-hidden',
              experimentalSpinner != null ? 'opacity-0' : null
            )}
          >
            {symbol != null && (
              <AxoSymbol.InlineGlyph symbol={symbol} label={null} />
            )}
            <span className={tw('min-w-0 shrink grow truncate')}>
              {children}
            </span>
            {arrow && (
              <AxoSymbol.InlineGlyph symbol="chevron-[end]" label={null} />
            )}
          </span>
          {experimentalSpinner != null && (
            <ExperimentalButtonSpinner
              buttonVariant={variant}
              buttonSize={size}
              aria-label={experimentalSpinner['aria-label']}
            />
          )}
        </button>
      );
    })
  );

  Root.displayName = `${Namespace}.Root`;
}
