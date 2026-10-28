// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type FC, memo, useMemo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { useAxoIntl } from '../_internal/AxoIntl.dom.tsx';

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

  type StatusLabelKey =
    | 'AxoOutgoingStatus.Sending'
    | 'AxoOutgoingStatus.Sent'
    | 'AxoOutgoingStatus.Delivered'
    | 'AxoOutgoingStatus.Read'
    | 'AxoOutgoingStatus.Paused'
    | 'AxoOutgoingStatus.Error';

  const StatusLabels = variants<Status, StatusLabelKey>(
    'AxoOutgoingStatus.Status',
    {
      sending: 'AxoOutgoingStatus.Sending',
      sent: 'AxoOutgoingStatus.Sent',
      delivered: 'AxoOutgoingStatus.Delivered',
      read: 'AxoOutgoingStatus.Read',
      paused: 'AxoOutgoingStatus.Paused',
      error: 'AxoOutgoingStatus.Error',
    }
  );

  /**
   * <AxoOutgoingStatus.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    status: Status;
    /**
     * Visually hidden label for screen readers. Pass `null` if the status is
     * already described by the surrounding context.
     */
    label?: string | null;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { status } = props;
    const intl = useAxoIntl();

    const label = useMemo(() => {
      // `null` hides the status from screen readers
      if (props.label !== undefined) {
        return props.label;
      }
      return intl.get(StatusLabels.get(status));
    }, [intl, props.label, status]);

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
          label={label}
          preferWide
        />
      </span>
    );
  });

  Root.displayName = 'AxoOutgoingStatus.Root';
}
