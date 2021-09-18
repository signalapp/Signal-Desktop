// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { DialogNetworkStatus } from './DialogNetworkStatus';
import { SocketStatus } from '../types/SocketStatus';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
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
    <DialogNetworkStatus
      {...defaultProps}
      hasNetworkDialog={hasNetworkDialog}
      isOnline={isOnline}
      socketStatus={socketStatus}
    />
  );
});

story.add('Connecting', () => (
  <DialogNetworkStatus
    {...defaultProps}
    socketStatus={SocketStatus.CONNECTING}
  />
));

story.add('Closing', () => (
  <DialogNetworkStatus {...defaultProps} socketStatus={SocketStatus.CLOSING} />
));

story.add('Closed', () => (
  <DialogNetworkStatus {...defaultProps} socketStatus={SocketStatus.CLOSED} />
));

story.add('Offline', () => (
  <DialogNetworkStatus {...defaultProps} isOnline={false} />
));
