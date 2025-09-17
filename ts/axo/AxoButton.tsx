// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, forwardRef } from 'react';
import type { ButtonHTMLAttributes, FC, ForwardedRef, ReactNode } from 'react';
import type { TailwindStyles } from './tw';
import { tw } from './tw';
import { AxoSymbol, type AxoSymbolName } from './AxoSymbol';
import { assert } from './_internal/assert';

const Namespace = 'AxoButton';

const baseAxoButtonStyles = tw(
  'flex items-center-safe justify-center-safe gap-1 truncate rounded-full select-none',
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
  large: tw('px-4 py-2 type-body-medium font-medium'),
  medium: tw('px-3 py-1.5 type-body-medium font-medium'),
  small: tw('px-2 py-1 type-body-small font-medium'),
} as const satisfies Record<string, TailwindStyles>;

type BaseButtonAttrs = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'style' | 'children'
>;

type AxoButtonVariant = keyof typeof AxoButtonVariants;
type AxoButtonSize = keyof typeof AxoButtonSizes;

type AxoButtonProps = BaseButtonAttrs &
  Readonly<{
    variant: AxoButtonVariant;
    size: AxoButtonSize;
    symbol?: AxoSymbolName;
    arrow?: boolean;
    children: ReactNode;
  }>;

export function _getAllAxoButtonVariants(): ReadonlyArray<AxoButtonVariant> {
  return Object.keys(AxoButtonVariants) as Array<AxoButtonVariant>;
}

export function _getAllAxoButtonSizes(): ReadonlyArray<AxoButtonSize> {
  return Object.keys(AxoButtonSizes) as Array<AxoButtonSize>;
}

// eslint-disable-next-line import/export
export const AxoButton: FC<AxoButtonProps> = memo(
  forwardRef((props, ref: ForwardedRef<HTMLButtonElement>) => {
    const { variant, size, symbol, arrow, children, ...rest } = props;
    const variantStyles = assert(
      AxoButtonVariants[variant],
      `${Namespace}: Invalid variant ${variant}`
    );
    const sizeStyles = assert(
      AxoButtonSizes[size],
      `${Namespace}: Invalid size ${size}`
    );
    return (
      <button
        ref={ref}
        type="button"
        className={tw(variantStyles, sizeStyles)}
        {...rest}
      >
        {symbol != null && (
          <AxoSymbol.InlineGlyph symbol={symbol} label={null} />
        )}
        {children}
        {arrow && <AxoSymbol.InlineGlyph symbol="chevron-[end]" label={null} />}
      </button>
    );
  })
);

AxoButton.displayName = `${Namespace}`;

// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-redeclare, import/export
export namespace AxoButton {
  export type Variant = AxoButtonVariant;
  export type Size = AxoButtonSize;
  export type Props = AxoButtonProps;
}
