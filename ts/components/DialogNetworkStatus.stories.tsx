// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

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
  socketStatus: SocketStatus.CONNECTING,
  manualReconnect: action('manual-reconnect'),
  withinConnectingGracePeriod: false,
  challengeStatus: 'idle' as const,
};

const story = storiesOf('Components/DialogNetworkStatus', module);

story.add('Knobs Playground', () => {
  const containerWidthBreakpoint = select(
    'containerWidthBreakpoint',
    WidthBreakpoint,
    WidthBreakpoint.Wide
  );
  const hasNetworkDialog = boolean('hasNetworkDialog', true);
  const isOnline = boolean('isOnline', true);
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

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogNetworkStatus
        {...defaultProps}
        containerWidthBreakpoint={containerWidthBreakpoint}
        hasNetworkDialog={hasNetworkDialog}
        isOnline={isOnline}
        socketStatus={socketStatus}
      />
    </FakeLeftPaneContainer>
  );
});

(
  [
    ['wide', WidthBreakpoint.Wide],
    ['narrow', WidthBreakpoint.Narrow],
  ] as const
).forEach(([name, containerWidthBreakpoint]) => {
  const defaultPropsForBreakpoint = {
    ...defaultProps,
    containerWidthBreakpoint,
  };

  story.add(`Connecting (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogNetworkStatus
        {...defaultPropsForBreakpoint}
        socketStatus={SocketStatus.CONNECTING}
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Closing (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogNetworkStatus
        {...defaultPropsForBreakpoint}
        socketStatus={SocketStatus.CLOSING}
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Closed (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogNetworkStatus
        {...defaultPropsForBreakpoint}
        socketStatus={SocketStatus.CLOSED}
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Offline (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogNetworkStatus {...defaultPropsForBreakpoint} isOnline={false} />
    </FakeLeftPaneContainer>
  ));
});
