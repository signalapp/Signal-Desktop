// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, FC } from 'react';
import { memo, useId } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoItem } from './AxoItem.dom.tsx';
import { AxoTooltip } from '../AxoTooltip.dom.tsx';

export namespace AxoClickableItem {
  /**
   * <AxoClickableItem.Root>
   * --------------------------------------------------------------------------
   */

  export type Variant = 'secondary' | 'destructive';
  export type ArrowKind = 'next' | 'external-link';

  export type RootProps = Readonly<{
    variant?: Variant;
    symbol?: AxoSymbol.Name;
    label: ReactNode;
    description?: ReactNode;
    value?: ReactNode;
    accessory?: ReactNode;
    arrow?: ArrowKind;
    disabled?: boolean;
    tooltip?: string | null;
    onClick: () => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const id = useId();

    let trigger = (
      <AxoItem.HiddenTrigger labelledby={id} onClick={props.onClick} />
    );

    if (props.tooltip != null) {
      trigger = (
        <AxoTooltip.Root
          label={props.tooltip}
          delay={props.disabled ? 'none' : 'auto'}
        >
          <AxoItem.HiddenTrigger labelledby={id} onClick={props.onClick} />
        </AxoTooltip.Root>
      );
    }

    return (
      <AxoItem.Root variant={props.variant} disabled={props.disabled}>
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
            {trigger}
            {props.accessory && (
              <AxoItem.Accessory>{props.accessory}</AxoItem.Accessory>
            )}
          </AxoItem.Body>
          {props.arrow != null && (
            <AxoItem.Trailing>
              <AxoItem.Arrow kind={props.arrow} />
            </AxoItem.Trailing>
          )}
        </AxoItem.Content>
      </AxoItem.Root>
    );
  });

  Root.displayName = 'AxoClickableItem.Root';
}
