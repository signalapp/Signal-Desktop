// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { Checkbox } from 'radix-ui';
import { AxoSymbol } from './AxoSymbol.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';

const Namespace = 'AxoCheckbox';

export namespace AxoCheckbox {
  type VariantConfig = {
    rootStyles: TailwindStyles;
    iconSize: AxoSymbol.IconSize;
  };

  const Variants: Record<Variant, VariantConfig> = {
    round: {
      rootStyles: tw('size-5 rounded-full'),
      iconSize: 14,
    },
    square: {
      rootStyles: tw('size-4 rounded-sm'),
      iconSize: 12,
    },
  };

  export function _getAllCheckboxVariants(): ReadonlyArray<Variant> {
    return Object.keys(Variants) as Array<Variant>;
  }

  export type Variant = 'round' | 'square';

  export type RootProps = Readonly<{
    id?: string;
    variant: Variant;
    checked: boolean;
    onCheckedChange: (nextChecked: boolean) => void;
    disabled?: boolean;
    required?: boolean;
  }>;

  export const Root = memo((props: RootProps) => {
    const variantConfig = Variants[props.variant];
    return (
      <Checkbox.Root
        id={props.id}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        disabled={props.disabled}
        required={props.required}
        className={tw(
          variantConfig.rootStyles,
          'flex items-center justify-center',
          'border border-border-primary inset-shadow-on-color',
          'data-[state=unchecked]:bg-fill-primary',
          'data-[state=unchecked]:pressed:bg-fill-primary-pressed',
          'data-[state=checked]:bg-color-fill-primary',
          'data-[state=checked]:text-label-primary-on-color',
          'data-[state=checked]:pressed:bg-color-fill-primary-pressed',
          'data-[disabled]:border-border-secondary',
          'data-[state=checked]:data-[disabled]:text-label-disabled-on-color',
          'outline-0 outline-border-focused focused:outline-[2.5px]',
          'overflow-hidden'
        )}
      >
        <Checkbox.Indicator asChild>
          <AxoSymbol.Icon
            symbol="check"
            size={variantConfig.iconSize}
            label={null}
          />
        </Checkbox.Indicator>
      </Checkbox.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;
}
