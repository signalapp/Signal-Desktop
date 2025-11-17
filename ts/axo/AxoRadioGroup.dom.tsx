// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { RadioGroup } from 'radix-ui';
import type { FC, ReactNode } from 'react';
import React, { memo, useId, useMemo } from 'react';
import { tw } from './tw.dom.js';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.js';

export const Namespace = 'AxoRadioGroup';

/**
 * @example Anatomy
 * ```tsx
 * <AxoRadioGroup.Root>
 *   <AxoRadioGroup.Item>
 *     <AxoRadioGroup.Indicator/>
 *     <AxoRadioGroup.Label>...</AxoRadioGroup.Label>
 *   </AxoRadioGroup.Item>
 * </AxoAlertDialog.Root>
 * ```
 */
export namespace AxoRadioGroup {
  /**
   * Component: <AxoRadioGroup.Root>
   * -------------------------------
   */

  export type RootProps = Readonly<{
    value: string | null;
    onValueChange: (value: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <RadioGroup.Root
        value={props.value}
        onValueChange={props.onValueChange}
        disabled={props.disabled}
        className={tw('flex flex-col')}
      >
        {props.children}
      </RadioGroup.Root>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoRadioGroup.Item>
   * -------------------------------
   */

  type ItemContextType = Readonly<{
    id: string;
    value: string;
    disabled: boolean;
  }>;

  const ItemContext = createStrictContext<ItemContextType>(`${Namespace}.Item`);

  export type ItemProps = Readonly<{
    value: string;
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    const { value, disabled = false } = props;
    const id = useId();

    const context = useMemo((): ItemContextType => {
      return { id, value, disabled };
    }, [id, value, disabled]);

    return (
      <ItemContext.Provider value={context}>
        <label htmlFor={id} className={tw('flex gap-3 py-2.5')}>
          {props.children}
        </label>
      </ItemContext.Provider>
    );
  });

  Item.displayName = `${Namespace}.Item`;

  /**
   * Component: <AxoRadioGroup.Indicator>
   * ------------------------------------
   */

  export type IndicatorProps = Readonly<{
    // ...
  }>;

  export const Indicator: FC<IndicatorProps> = memo(() => {
    const context = useStrictContext(ItemContext);
    return (
      <RadioGroup.Item
        id={context.id}
        value={context.value}
        disabled={context.disabled}
        className={tw(
          'flex size-5 shrink-0 items-center justify-center rounded-full',
          'border border-border-primary inset-shadow-on-color',
          'data-[state=unchecked]:bg-fill-primary',
          'data-[state=unchecked]:pressed:bg-fill-primary-pressed',
          'data-[state=checked]:bg-color-fill-primary',
          'data-[state=checked]:pressed:bg-color-fill-primary-pressed',
          'data-[disabled]:border-border-secondary',
          'outline-0 outline-border-focused focused:outline-[2.5px]',
          'overflow-hidden',
          'forced-colors:data-[state=checked]:bg-[SelectedItem]'
        )}
      >
        <RadioGroup.Indicator asChild>
          <span
            className={tw(
              'size-[9px] rounded-full',
              'data-[state=checked]:bg-label-primary-on-color',
              'data-[state=checked]:data-[disabled]:bg-label-disabled-on-color',
              'forced-colors:data-[state=checked]:bg-[SelectedItemText]'
            )}
          />
        </RadioGroup.Indicator>
      </RadioGroup.Item>
    );
  });

  Indicator.displayName = `${Namespace}.Indicator`;

  /**
   * Component: <AxoRadioGroup.Indicator>
   * ------------------------------------
   */

  export type LabelProps = Readonly<{
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return (
      <span className={tw('truncate type-body-large text-label-primary')}>
        {props.children}
      </span>
    );
  });

  Label.displayName = `${Namespace}.Label`;
}
