// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { RadioGroup } from 'radix-ui';
import { memo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AriaLabelled } from '../aria/AriaLabelled.dom.tsx';

export namespace AxoBaseRadioGroup {
  /**
   * <AxoBaseRadioGroup.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    asChild?: boolean;
    /**
     * The value given as data when submitted with a name.
     */
    value: string;
    /**
     * When true, prevents the user from interacting with the radio item.
     */
    disabled?: boolean;
    /**
     * Should be an `Indicator` and a `Label`.
     */
    children: ReactNode;
  }>;

  /**
   * A single radio option.
   */
  export const Item: FC<ItemProps> = memo(props => {
    return (
      <AriaLabelled.Root asChild>
        <RadioGroup.Item {...props} />
      </AriaLabelled.Root>
    );
  });

  Item.displayName = 'AxoRadioGroup.Item';

  /**
   * <AxoBaseRadioGroup.Indicator>
   * --------------------------------------------------------------------------
   */

  export const Indicator: FC = memo(() => {
    return (
      <RadioGroup.Indicator asChild forceMount>
        <span
          className={tw(
            'group',
            'flex size-5 shrink-0 items-center justify-center rounded-full',
            'border border-primary inset-shadow-on-color',
            'data-[state=unchecked]:bg-control',
            'data-[state=unchecked]:enabled:active:bg-control-pressed',
            'data-[state=checked]:bg-accent',
            'data-[state=checked]:active:bg-accent-pressed',
            'data-disabled:border-secondary',
            'outline-none keyboard-mode:focus:axo-focus-ring',
            'overflow-hidden',
            'forced-colors:data-[state=checked]:bg-[SelectedItem]'
          )}
        >
          <span
            className={tw(
              'size-2.25 rounded-full',
              'group-data-[state=checked]:bg-(--axo-color-label-primary-oncolor)',
              'group-data-[state=checked]:data-disabled:bg-(--axo-color-label-disabled-oncolor)',
              'forced-colors:group-data-[state=checked]:bg-[SelectedItemText]'
            )}
          />
        </span>
      </RadioGroup.Indicator>
    );
  });

  Indicator.displayName = 'AxoBaseRadioGroup.Indicator';

  /**
   * <AxoBaseRadioGroup.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return <AriaLabelled.Label {...props} />;
  });

  Label.displayName = 'AxoBaseRadioGroup.Label';

  /**
   * <AxoBaseRadioGroup.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return <AriaLabelled.Description {...props} />;
  });

  Description.displayName = 'AxoBaseRadioGroup.Description';
}
