// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, FC } from 'react';
import { memo, useId } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoItem } from './AxoItem.dom.tsx';

export namespace AxoClickableItem {
  /**
   * <AxoClickableItem.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.Name;
    label: ReactNode;
    description?: ReactNode;
    value?: ReactNode;
    accessory?: ReactNode;
    arrow: boolean;
    disabled?: boolean;
    onClick: () => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const id = useId();
    return (
      <AxoItem.Root disabled={props.disabled}>
        {props.symbol != null && (
          <AxoItem.Leading>
            <AxoItem.Icon symbol={props.symbol} />
          </AxoItem.Leading>
        )}
        <AxoItem.Content>
          <AxoItem.Body>
            <AxoItem.Label id={id}>{props.label}</AxoItem.Label>
            {props.value != null && (
              <AxoItem.Value>{props.value}</AxoItem.Value>
            )}
            {props.description != null && (
              <AxoItem.Description>{props.description}</AxoItem.Description>
            )}
            <AxoItem.HiddenTrigger labelledby={id} onClick={props.onClick} />
            {props.accessory && (
              <AxoItem.Accessory>{props.accessory}</AxoItem.Accessory>
            )}
          </AxoItem.Body>
          {props.arrow && (
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          )}
        </AxoItem.Content>
      </AxoItem.Root>
    );
  });

  Root.displayName = 'AxoClickableItem.Root';
}
