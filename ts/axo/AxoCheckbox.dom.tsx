// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { Checkbox } from 'radix-ui';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { tw } from './tw.dom.js';

const Namespace = 'AxoCheckbox';

export namespace AxoCheckbox {
  export type RootProps = Readonly<{
    id?: string;
    checked: boolean;
    onCheckedChange: (nextChecked: boolean) => void;
    disabled?: boolean;
    required?: boolean;
  }>;

  export const Root = memo((props: RootProps) => {
    return (
      <Checkbox.Root
        id={props.id}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        disabled={props.disabled}
        required={props.required}
        className={tw(
          'flex size-5 items-center justify-center rounded-full',
          'border border-border-primary inset-shadow-on-color',
          'data-[state=unchecked]:bg-fill-primary',
          'data-[state=unchecked]:pressed:bg-fill-primary-pressed',
          'data-[state=checked]:bg-color-fill-primary',
          'data-[state=checked]:pressed:bg-color-fill-primary-pressed',
          'data-[disabled]:border-border-secondary',
          'outline-0 outline-border-focused focused:outline-[2.5px]',
          'overflow-hidden'
        )}
      >
        <Checkbox.Indicator
          className={tw(
            'data-[state=checked]:text-label-primary-on-color',
            'data-[state=checked]:data-[disabled]:text-label-disabled-on-color'
          )}
        >
          <AxoSymbol.Icon symbol="check" size={14} label={null} />
        </Checkbox.Indicator>
      </Checkbox.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;
}
