// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AxoSwitch } from '../AxoSwitch.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';

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
    onCheckedChange: (checked: boolean) => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AriaList.Item asChild>
        <AxoBaseItem.Root>
          {props.symbol != null && (
            <AxoBaseItem.Leading>
              <AxoBaseItem.Icon symbol={props.symbol} />
            </AxoBaseItem.Leading>
          )}
          <AxoBaseItem.Content>
            <AxoBaseItem.Body>
              <AriaList.Label asChild>
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
            <AxoBaseItem.Trailing>
              <AxoSwitch.Root
                disabled={props.disabled}
                checked={props.checked}
                onCheckedChange={props.onCheckedChange}
              />
            </AxoBaseItem.Trailing>
          </AxoBaseItem.Content>
        </AxoBaseItem.Root>
      </AriaList.Item>
    );
  });

  Root.displayName = 'AxoSwitchItem.Root';
}
