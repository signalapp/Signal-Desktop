// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import { RadioGroup } from 'radix-ui';
import { AxoList } from './AxoList.dom.tsx';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AxoBaseRadioGroup } from '../controls/_AxoBaseRadioGroup.dom.tsx';

export namespace AxoRadioGroupList {
  /**
   * <AxoRadioGroupList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    title?: ReactNode;
    description?: ReactNode;
    help?: ReactNode;

    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;

    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoList.Root>
        {props.title != null && (
          <AxoList.Header>
            <AxoList.Title>{props.title}</AxoList.Title>
            {/* We probably don't ever want to show a description without a title */}
            {props.description != null && (
              <AxoList.Description>{props.description}</AxoList.Description>
            )}
          </AxoList.Header>
        )}
        <AxoList.Body>
          <RadioGroup.Root
            asChild
            value={props.value}
            onValueChange={props.onValueChange}
            disabled={props.disabled}
          >
            <AxoBaseItem.Group spacing="md">{props.children}</AxoBaseItem.Group>
          </RadioGroup.Root>
        </AxoList.Body>
        {props.help != null && (
          <AxoList.Footer>
            <AxoList.Help>{props.help}</AxoList.Help>
          </AxoList.Footer>
        )}
      </AxoList.Root>
    );
  });

  Root.displayName = 'AxoRadioGroupList.Root';

  /**
   * <AxoRadioGroupList.Item>
   * --------------------------------------------------------------------------
   */

  export type ItemProps = Readonly<{
    value: string;
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Item: FC<ItemProps> = memo(props => {
    return (
      <AxoBaseRadioGroup.Item
        value={props.value}
        disabled={props.disabled}
        asChild
      >
        <AxoBaseItem.Root>
          <AxoBaseItem.LeadingSlot>
            <AxoBaseRadioGroup.Indicator />
          </AxoBaseItem.LeadingSlot>
          <AxoBaseItem.Content>
            <AxoBaseItem.Body>{props.children}</AxoBaseItem.Body>
          </AxoBaseItem.Content>
        </AxoBaseItem.Root>
      </AxoBaseRadioGroup.Item>
    );
  });

  Item.displayName = 'AxoRadioGroupList.Item';

  /**
   * <AxoRadioGroupList.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return (
      <AxoBaseRadioGroup.Label asChild>
        <AxoBaseItem.Title>{props.children}</AxoBaseItem.Title>
      </AxoBaseRadioGroup.Label>
    );
  });

  Label.displayName = 'AxoRadioGroupList.Label';

  /**
   * <AxoRadioGroupList.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <AxoBaseRadioGroup.Description asChild>
        <AxoBaseItem.Description>{props.children}</AxoBaseItem.Description>
      </AxoBaseRadioGroup.Description>
    );
  });

  Description.displayName = 'AxoRadioGroupList.Description';
}
