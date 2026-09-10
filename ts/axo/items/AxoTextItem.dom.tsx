// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { AxoItem } from './AxoItem.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';

export namespace AxoTextItem {
  /**
   * <AxoTextItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.Name | null;
    label: ReactNode;
    value?: ReactNode;
    description?: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoItem.Root>
        {props.symbol != null && (
          <AxoItem.Leading>
            <AxoItem.Icon symbol={props.symbol} />
          </AxoItem.Leading>
        )}
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label>{props.label}</AxoItem.Label>
            {props.value != null && (
              <AxoItem.Value>{props.value}</AxoItem.Value>
            )}
            {props.description != null && (
              <AxoItem.Value>{props.description}</AxoItem.Value>
            )}
          </AxoItem.Body>
        </AxoItem.Content>
      </AxoItem.Root>
    );
  });

  Root.displayName = 'AxoTextItem.Root';
}
