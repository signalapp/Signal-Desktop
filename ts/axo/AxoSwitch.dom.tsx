// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { Switch } from 'radix-ui';
import { tw } from './tw.dom.js';
import { AxoSymbol } from './AxoSymbol.dom.js';

const Namespace = 'AxoSwitch';

export namespace AxoSwitch {
  export type RootProps = Readonly<{
    checked: boolean;
    onCheckedChange: (nextChecked: boolean) => void;
    disabled?: boolean;
    required?: boolean;
  }>;

  export const Root = memo((props: RootProps) => {
    return (
      <Switch.Root
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
        disabled={props.disabled}
        required={props.required}
        className={tw(
          'group relative z-0 flex h-[18px] w-8 items-center rounded-full',
          'border border-border-secondary inset-shadow-on-color',
          'bg-fill-secondary',
          'data-[disabled]:bg-fill-primary',
          'pressed:bg-fill-secondary-pressed',
          'outline-0 outline-border-focused focused:outline-[2.5px]',
          'overflow-hidden'
        )}
      >
        <span
          className={tw(
            'absolute top-0 bottom-0',
            'w-5.5 rounded-s-full',
            'group-data-[disabled]:w-7.5 group-data-[disabled]:rounded-full',
            'opacity-0 group-data-[state=checked]:opacity-100',
            '-translate-x-3.5 group-data-[state=checked]:translate-x-0 rtl:translate-x-3.5',
            'bg-color-fill-primary group-pressed:bg-color-fill-primary-pressed',
            'transition-all duration-200 ease-out-cubic',
            'forced-colors:bg-[AccentColor]',
            'forced-colors:group-data-[disabled]:bg-[GrayText]'
          )}
        />
        <span
          className={tw(
            'invisible forced-colors:visible',
            'absolute start-0.5 z-0 text-[12px]',
            'forced-color-adjust-none',
            'forced-colors:text-[AccentColorText]'
          )}
        >
          <AxoSymbol.InlineGlyph symbol="check" label={null} />
        </span>
        <Switch.Thumb
          className={tw(
            'z-10 block size-4 rounded-full',
            // eslint-disable-next-line better-tailwindcss/no-restricted-classes
            'shadow-[#000]/12',
            'shadow-[0.5px_0_0.5px_0.5px,-0.5px_0_0.5px_0.5px]',
            'bg-label-primary-on-color',
            'data-[disabled]:bg-label-disabled-on-color',
            'transition-all duration-200 ease-out-cubic',
            'data-[state=checked]:translate-x-3.5',
            'rtl:data-[state=checked]:-translate-x-3.5',
            'forced-colors:border',
            'forced-colors:data-[disabled]:bg-[ButtonFace]'
          )}
        />
      </Switch.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;
}
