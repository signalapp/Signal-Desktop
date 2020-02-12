import * as React from 'react';
import { NetworkStatus } from './NetworkStatus';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  hasNetworkDialog: true,
  i18n,
  isOnline: true,
  isRegistrationDone: true,
  socketStatus: 0,
  relinkDevice: action('relink-device'),
  withinConnectingGracePeriod: false,
};

const permutations = [
  {
    title: 'Connecting',
    props: {
      socketStatus: 0,
    },
  },
  {
    title: 'Closing (online)',
    props: {
      socketStatus: 2,
    },
  },
  {
    title: 'Closed (online)',
    props: {
      socketStatus: 3,
    },
  },
  {
    title: 'Offline',
    props: {
      isOnline: false,
    },
  },
  {
    title: 'Unlinked (online)',
    props: {
      isRegistrationDone: false,
    },
  },
  {
    title: 'Unlinked (offline)',
    props: {
      isOnline: false,
      isRegistrationDone: false,
    },
  },
];

storiesOf('Components/NetworkStatus', module)
  .add('Knobs Playground', () => {
    const hasNetworkDialog = boolean('hasNetworkDialog', true);
    const isOnline = boolean('isOnline', true);
    const isRegistrationDone = boolean('isRegistrationDone', true);
    const socketStatus = select(
      'socketStatus',
      {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
      },
      0
    );

    return (
      <NetworkStatus
        {...defaultProps}
        hasNetworkDialog={hasNetworkDialog}
        isOnline={isOnline}
        isRegistrationDone={isRegistrationDone}
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
