// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { NetworkStatus } from './NetworkStatus';
import { SocketStatus } from '../types/SocketStatus';
import { setup as setupI18n } from '../../js/modules/i18n';
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

const permutations = [
  {
    title: 'Connecting',
    props: {
      socketStatus: SocketStatus.CONNECTING,
    },
  },
  {
    title: 'Closing (online)',
    props: {
      socketStatus: SocketStatus.CLOSING,
    },
  },
  {
    title: 'Closed (online)',
    props: {
      socketStatus: SocketStatus.CLOSED,
    },
  },
  {
    title: 'Offline',
    props: {
      isOnline: false,
    },
  },
];

storiesOf('Components/NetworkStatus', module)
  .add('Knobs Playground', () => {
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
      <NetworkStatus
        {...defaultProps}
        hasNetworkDialog={hasNetworkDialog}
        isOnline={isOnline}
        socketStatus={socketStatus}
      />
    );
  })
  .add('Iterations', () => {
    return permutations.map(({ props, title }) => (
      <>
        <h3>{title}</h3>
        <NetworkStatus {...defaultProps} {...props} />
      </>
    ));
  });
