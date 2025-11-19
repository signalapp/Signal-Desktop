// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ButtonHTMLAttributes, FC, ForwardedRef } from 'react';
import React, { forwardRef, memo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import type { SpinnerVariant } from '../components/SpinnerV2.dom.js';
import { SpinnerV2 } from '../components/SpinnerV2.dom.js';

const Namespace = 'AxoIconButton';

type GenericButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export namespace AxoIconButton {
  const baseStyles = tw(
    'relative rounded-full select-none',
    'outline-border-focused not-forced-colors:outline-0 not-forced-colors:focused:outline-[2.5px]',
    'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
    'forced-colors:disabled:text-[GrayText]',
    'forced-colors:aria-pressed:bg-[SelectedItem] forced-colors:aria-pressed:text-[SelectedItemText]'
  );

  const pressedStyles = {
    fillInverted: tw(
      'aria-pressed:bg-fill-inverted aria-pressed:pressed:bg-fill-inverted-pressed',
      'aria-pressed:text-label-primary-inverted aria-pressed:disabled:text-label-disabled-inverted'
    ),
    colorFillPrimary: tw(
      'aria-pressed:bg-color-fill-primary aria-pressed:pressed:bg-color-fill-primary-pressed',
      'aria-pressed:text-label-primary-on-color aria-pressed:disabled:text-label-disabled-on-color'
    ),
  };

  const Variants: Record<Variant, TailwindStyles> = {
    secondary: tw(
      'bg-fill-secondary pressed:bg-fill-secondary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-fill-secondary-pressed',
      'text-label-primary disabled:text-label-disabled',
      pressedStyles.fillInverted
    ),
    primary: tw(
      'bg-color-fill-primary pressed:bg-color-fill-primary-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-primary-pressed',
      'text-label-primary-on-color disabled:text-label-disabled-on-color',
      pressedStyles.fillInverted
    ),
    affirmative: tw(
      'bg-color-fill-affirmative pressed:bg-color-fill-affirmative-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-affirmative-pressed',
      'text-label-primary-on-color disabled:text-label-disabled-on-color',
      pressedStyles.fillInverted
    ),
    destructive: tw(
      'bg-color-fill-destructive pressed:bg-color-fill-destructive-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-color-fill-destructive-pressed',
      'text-label-primary-on-color disabled:text-label-disabled-on-color',
      pressedStyles.fillInverted
    ),
    'borderless-secondary': tw(
      'hovered:bg-fill-secondary pressed:bg-fill-secondary-pressed',
      'focus:bg-fill-secondary',
      'data-[axo-dropdownmenu-state=open]:bg-fill-secondary-pressed',
      'text-label-primary disabled:text-label-disabled',
      pressedStyles.colorFillPrimary
    ),
    'floating-secondary': tw(
      'bg-fill-floating pressed:bg-fill-floating-pressed',
      'data-[axo-dropdownmenu-state=open]:bg-fill-floating-pressed',
      'text-label-primary disabled:text-label-disabled',
      'shadow-elevation-1',
      pressedStyles.fillInverted
    ),
  };

  export function _getAllVariants(): ReadonlyArray<Variant> {
    return Object.keys(Variants) as ReadonlyArray<Variant>;
  }

  type SizeConfig = Readonly<{
    buttonStyles: TailwindStyles;
    iconSize: AxoSymbol.IconSize;
  }>;

  const Sizes: Record<Size, SizeConfig> = {
    sm: { buttonStyles: tw('p-[5px]'), iconSize: 18 },
    md: { buttonStyles: tw('p-1.5'), iconSize: 20 },
    lg: { buttonStyles: tw('p-2'), iconSize: 20 },
  };

  export function _getAllSizes(): ReadonlyArray<Size> {
    return Object.keys(Sizes) as ReadonlyArray<Size>;
  }

  export type Variant =
    | 'secondary'
    | 'primary'
    | 'affirmative'
    | 'destructive'
    | 'borderless-secondary'
    | 'floating-secondary';

  export type Size = 'sm' | 'md' | 'lg';

  export type RootProps = Readonly<{
    // required: Should describe the purpose of the button, not the icon.
    'aria-label': string;

    variant: Variant;
    size: Size;
    symbol: AxoSymbol.IconName;

    experimentalSpinner?: { 'aria-label': string } | null;

    disabled?: GenericButtonProps['disabled'];
    onClick?: GenericButtonProps['onClick'];
    'aria-pressed'?: GenericButtonProps['aria-pressed'];
    // Note: Technically we forward all props for Radix, but we restrict the
    // props that the type accepts
  }>;

  export const Root: FC<RootProps> = memo(
    forwardRef((props, ref: ForwardedRef<HTMLButtonElement>) => {
      const { variant, size, symbol, experimentalSpinner, ...rest } = props;

      return (
        <button
          ref={ref}
          {...rest}
          type="button"
          className={tw(
            baseStyles,
            Variants[variant],
            Sizes[size].buttonStyles
          )}
        >
          <span
            className={tw(
              'align-top leading-none forced-color-adjust-none',
              experimentalSpinner != null ? 'opacity-0' : null
            )}
          >
            <AxoSymbol.Icon
              size={Sizes[size].iconSize}
              symbol={symbol}
              label={null}
            />
          </span>
          {experimentalSpinner != null && (
            <Spinner
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

  const SpinnerVariants: Record<Variant, SpinnerVariant> = {
    primary: 'axo-button-spinner-on-color',
    secondary: 'axo-button-spinner-secondary',
    affirmative: 'axo-button-spinner-on-color',
    destructive: 'axo-button-spinner-on-color',
    'floating-secondary': 'axo-button-spinner-secondary',
    'borderless-secondary': 'axo-button-spinner-secondary',
  };

  type SpinnerSizeConfig = { size: number; strokeWidth: number };

  const SpinnerSizes: Record<Size, SpinnerSizeConfig> = {
    lg: { size: 20, strokeWidth: 2 },
    md: { size: 20, strokeWidth: 2 },
    sm: { size: 16, strokeWidth: 1.5 },
  };

  type SpinnerProps = Readonly<{
    buttonVariant: Variant;
    buttonSize: Size;
    'aria-label': string;
  }>;

  // eslint-disable-next-line no-inner-declarations
  function Spinner(props: SpinnerProps): JSX.Element {
    const variant = SpinnerVariants[props.buttonVariant];
    const sizeConfig = SpinnerSizes[props.buttonSize];
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
}
