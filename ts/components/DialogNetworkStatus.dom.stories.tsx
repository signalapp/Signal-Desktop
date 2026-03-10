// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogNetworkStatus.dom.js';
import { DialogNetworkStatus } from './DialogNetworkStatus.dom.js';
import { SocketStatus } from '../types/SocketStatus.std.js';
import { WidthBreakpoint } from './_util.std.js';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.dom.js';

const { i18n } = window.SignalContext;

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

export function KnobsPlayground(args: PropsType): React.JSX.Element {
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

export function ConnectingWide(): React.JSX.Element {
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

export function ClosingWide(): React.JSX.Element {
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

export function ClosedWide(): React.JSX.Element {
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

export function OfflineWide(): React.JSX.Element {
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

export function OutageWide(): React.JSX.Element {
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

export function ConnectingNarrow(): React.JSX.Element {
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

export function ClosingNarrow(): React.JSX.Element {
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

export function ClosedNarrow(): React.JSX.Element {
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

export function OfflineNarrow(): React.JSX.Element {
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

export function OutageNarrow(): React.JSX.Element {
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
