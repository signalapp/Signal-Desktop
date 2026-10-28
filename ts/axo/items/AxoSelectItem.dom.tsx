// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo, useId } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoBaseItem } from './_AxoBaseItem.dom.tsx';
import { AxoSelect } from '../AxoSelect.dom.tsx';
import { AriaList } from '../aria/AriaList.dom.tsx';

export namespace AxoSelectItem {
  /**
   * <AxoSelectItem.Root>
   * --------------------------------------------------------------------------
   */

  export type Option = Readonly<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.Name;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    placeholder: string | null;
    value: string | null;
    onValueChange: (value: string) => void;
    options: ReadonlyArray<Option>;
    forceStackedLayout?: boolean;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const labelId = useId();
    return (
      <AriaList.Item asChild>
        <AxoBaseItem.Root
          disabled={props.disabled}
          forceStackedLayout={props.forceStackedLayout}
        >
          {props.symbol != null && (
            <AxoBaseItem.Leading>
              <AxoBaseItem.Icon symbol={props.symbol} />
            </AxoBaseItem.Leading>
          )}
          <AxoBaseItem.Content>
            <AriaList.Label asChild id={labelId}>
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
                labelledby={labelId}
                disabled={props.disabled}
                value={props.value}
                onValueChange={props.onValueChange}
              >
                <AxoBaseItem.DescribedBy>
                  <AxoSelect.Trigger placeholder={props.placeholder} />
                </AxoBaseItem.DescribedBy>
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
          </AxoBaseItem.Content>
        </AxoBaseItem.Root>
      </AriaList.Item>
    );
  });

  Root.displayName = 'AxoSelectItem.Root';
}
