// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo, useId } from 'react';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AxoSwitch } from '../AxoSwitch.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';
import { AxoTooltip } from '../AxoTooltip.dom.tsx';

export namespace AxoSwitchItem {
  /**
   * <AxoSwitchItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.Name;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    checked: boolean;
    tooltip?: string | null;
    onCheckedChange: (checked: boolean) => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const id = useId();

    let accessory = (
      <AxoSwitch.Root
        labelledby={id}
        disabled={props.disabled}
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    );

    if (props.tooltip != null) {
      accessory = (
        <AxoTooltip.Root
          label={props.tooltip}
          delay={props.disabled ? 'none' : 'auto'}
        >
          {accessory}
        </AxoTooltip.Root>
      );
    }

    return (
      <AriaList.Item asChild>
        <AxoBaseItem.Root disabled={props.disabled}>
          {props.symbol != null && (
            <AxoBaseItem.Leading>
              <AxoBaseItem.Icon symbol={props.symbol} />
            </AxoBaseItem.Leading>
          )}
          <AxoBaseItem.Content>
            <AxoBaseItem.Body>
              <AriaList.Label asChild id={id}>
                <AxoBaseItem.Label>{props.label}</AxoBaseItem.Label>
              </AriaList.Label>
              {props.description != null && (
                <AriaList.Description asChild>
                  <AxoBaseItem.Description>
                    {props.description}
                  </AxoBaseItem.Description>
                </AriaList.Description>
              )}
            </AxoBaseItem.Body>
            <AxoBaseItem.Trailing>{accessory}</AxoBaseItem.Trailing>
          </AxoBaseItem.Content>
        </AxoBaseItem.Root>
      </AriaList.Item>
    );
  });

  Root.displayName = 'AxoSwitchItem.Root';
}
