// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type FC, memo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';

export namespace AxoOutgoingStatus {
  export type Status =
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'paused'
    | 'error';

  const StatusSymbols = variants<Status, AxoSymbol.Name>(
    'AxoOutgoingStatus.Status',
    {
      sending: 'ticks',
      sent: 'check-circle',
      delivered: 'check-circle-on-check-circle',
      read: 'check-circle-on-check-circle-fill',
      paused: 'error-circle',
      error: 'error-circle',
    }
  );

  /**
   * <AxoOutgoingStatus.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    status: Status;
    label: string | null;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <span
        // TODO: Need to do more research on the best way to make this accessible
        // but maybe something like adding role="status"` `aria-live={false}`,
        // and `aria-label` for each status
        className={tw(
          // Transforms (spin) don't apply to inline elements
          'inline-block',
          props.status === 'sending' && 'animate-spin'
        )}
      >
        <AxoSymbol.InlineGlyph
          symbol={StatusSymbols.get(props.status)}
          label={props.label}
          preferWide
        />
      </span>
    );
  });

  Root.displayName = 'AxoOutgoingStatus.Root';
}
