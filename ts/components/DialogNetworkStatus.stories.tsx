// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogNetworkStatus';
import { DialogNetworkStatus } from './DialogNetworkStatus';
import { SocketStatus } from '../types/SocketStatus';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  hasNetworkDialog: true,
  i18n,
  isOnline: true,
  isOutage: false,
  socketStatus: SocketStatus.CONNECTING,
  manualReconnect: action('manual-reconnect'),
  withinConnectingGracePeriod: false,
  challengeStatus: 'idle' as const,
};

export default {
  title: 'Components/DialogNetworkStatus',
} satisfies Meta<PropsType>;

export function KnobsPlayground(args: PropsType): JSX.Element {
  /*
  const socketStatus = select(
    'socketStatus',
    {
      CONNECTING: SocketStatus.CONNECTING,
      OPEN: SocketStatus.OPEN,
      CLOSING: SocketStatus.CLOSING,
      CLOSED: SocketStatus.CLOSED,
    },
    SocketStatus.CONNECTING
  );
   */

  return (
    <FakeLeftPaneContainer {...args}>
      <DialogNetworkStatus {...defaultProps} {...args} />
    </FakeLeftPaneContainer>
  );
}
KnobsPlayground.args = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
  hasNetworkDialog: true,
  isOnline: true,
  isOutage: false,
  socketStatus: SocketStatus.CONNECTING,
};

export function ConnectingWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        socketStatus={SocketStatus.CONNECTING}
      />
    </FakeLeftPaneContainer>
  );
}

export function ClosingWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        socketStatus={SocketStatus.CLOSING}
      />
    </FakeLeftPaneContainer>
  );
}

export function ClosedWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        socketStatus={SocketStatus.CLOSED}
      />
    </FakeLeftPaneContainer>
  );
}

export function OfflineWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        isOnline={false}
      />
    </FakeLeftPaneContainer>
  );
}

export function OutageWide(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Wide}
        isOnline={false}
        isOutage
      />
    </FakeLeftPaneContainer>
  );
}

export function ConnectingNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        socketStatus={SocketStatus.CONNECTING}
      />
    </FakeLeftPaneContainer>
  );
}

export function ClosingNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        socketStatus={SocketStatus.CLOSING}
      />
    </FakeLeftPaneContainer>
  );
}

export function ClosedNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        socketStatus={SocketStatus.CLOSED}
      />
    </FakeLeftPaneContainer>
  );
}

export function OfflineNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        isOnline={false}
      />
    </FakeLeftPaneContainer>
  );
}

export function OutageNarrow(): JSX.Element {
  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
        isOnline={false}
        isOutage
      />
    </FakeLeftPaneContainer>
  );
}
