// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, forwardRef } from 'react';
import type { ButtonHTMLAttributes, FC, ForwardedRef, ReactNode } from 'react';
import type { Styles } from './_internal/css';
import { css } from './_internal/css';
import { AxoSymbol, type AxoSymbolName } from './AxoSymbol';
import { assert } from './_internal/assert';

const Namespace = 'AxoButton';

const baseAxoButtonStyles = css(
  'flex items-center-safe justify-center-safe gap-1 truncate rounded-full select-none',
  'outline-0 outline-border-focused focused:outline-[2.5px]'
);

const AxoButtonTypes = {
  default: css(baseAxoButtonStyles),
  subtle: css(
    baseAxoButtonStyles,
    'bg-fill-secondary',
    'pressed:bg-fill-secondary-pressed'
  ),
  floating: css(
    baseAxoButtonStyles,
    'bg-fill-floating',
    'shadow-elevation-1',
    'pressed:bg-fill-floating-pressed'
  ),
  borderless: css(
    baseAxoButtonStyles,
    'bg-transparent',
    'hovered:bg-fill-secondary',
    'pressed:bg-fill-secondary-pressed'
  ),
} as const satisfies Record<string, Styles>;

const AxoButtonVariants = {
  // default
  secondary: css(
    AxoButtonTypes.default,
    'bg-fill-secondary text-label-primary',
    'pressed:bg-fill-secondary-pressed',
    'disabled:text-label-disabled'
  ),
  primary: css(
    AxoButtonTypes.default,
    'bg-color-fill-primary text-label-primary-on-color',
    'pressed:bg-color-fill-primary-pressed',
    'disabled:text-label-disabled-on-color'
  ),
  affirmative: css(
    AxoButtonTypes.default,
    'bg-color-fill-affirmative text-label-primary-on-color',
    'pressed:bg-color-fill-affirmative-pressed',
    'disabled:text-label-disabled-on-color'
  ),
  destructive: css(
    AxoButtonTypes.default,
    'bg-color-fill-destructive text-label-primary-on-color',
    'pressed:bg-color-fill-destructive-pressed',
    'disabled:text-label-disabled-on-color'
  ),

  // subtle
  'subtle-primary': css(
    AxoButtonTypes.subtle,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'subtle-affirmative': css(
    AxoButtonTypes.subtle,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'subtle-destructive': css(
    AxoButtonTypes.subtle,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),

  // floating
  'floating-secondary': css(
    AxoButtonTypes.floating,
    'text-label-primary',
    'disabled:text-label-disabled'
  ),
  'floating-primary': css(
    AxoButtonTypes.floating,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'floating-affirmative': css(
    AxoButtonTypes.floating,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'floating-destructive': css(
    AxoButtonTypes.floating,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),

  // borderless
  'borderless-secondary': css(
    AxoButtonTypes.borderless,
    'text-label-primary',
    'disabled:text-label-disabled'
  ),
  'borderless-primary': css(
    AxoButtonTypes.borderless,
    'text-color-label-primary',
    'disabled:text-color-label-primary-disabled'
  ),
  'borderless-affirmative': css(
    AxoButtonTypes.borderless,
    'text-color-label-affirmative',
    'disabled:text-color-label-affirmative-disabled'
  ),
  'borderless-destructive': css(
    AxoButtonTypes.borderless,
    'text-color-label-destructive',
    'disabled:text-color-label-destructive-disabled'
  ),
};

const AxoButtonSizes = {
  large: css('px-4 py-2 type-body-medium font-medium'),
  medium: css('px-3 py-1.5 type-body-medium font-medium'),
  small: css('px-2 py-1 type-body-small font-medium'),
} as const satisfies Record<string, Styles>;

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
        className={css(variantStyles, sizeStyles)}
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
