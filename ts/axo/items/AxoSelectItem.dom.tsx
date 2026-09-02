// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AxoSelect } from '../AxoSelect.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';

export namespace AxoSelectItem {
  /**
   * <AxoSelectItem.Root>
   * --------------------------------------------------------------------------
   */

  type Option = Readonly<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.Name;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    placeholder: string;
    value: string | null;
    onValueChange: (value: string) => void;
    options: ReadonlyArray<Option>;
  }>;

  export const Root: FC<RootProps> = memo(props => {
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
              <AxoBaseItem.Accessory>
                <AxoSelect.Root
                  disabled={props.disabled}
                  value={props.value}
                  onValueChange={props.onValueChange}
                >
                  <AxoSelect.Trigger placeholder={props.placeholder} />
                  <AxoSelect.Content>
                    {props.options.map(item => {
                      return (
                        <AxoSelect.Item
                          key={item.value}
                          value={item.value}
                          disabled={item.disabled}
                        >
                          <AxoSelect.ItemText>{item.label}</AxoSelect.ItemText>
                        </AxoSelect.Item>
                      );
                    })}
                  </AxoSelect.Content>
                </AxoSelect.Root>
              </AxoBaseItem.Accessory>
            </AxoBaseItem.Body>
          </AxoBaseItem.Content>
        </AxoBaseItem.Root>
      </AriaList.Item>
    );
  });

  Root.displayName = 'AxoSelectItem.Root';
}
