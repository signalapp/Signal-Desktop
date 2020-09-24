import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { UpdateDialog } from './UpdateDialog';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  ackRender: action('ack-render'),
  dismissDialog: action('dismiss-dialog'),
  hasNetworkDialog: false,
  i18n,
  didSnooze: false,
  showEventsCount: 0,
  snoozeUpdate: action('snooze-update'),
  startUpdate: action('start-update'),
};

const permutations = [
  {
    title: 'Update',
    props: {
      dialogType: 1,
    },
  },
  {
    title: 'Update (didSnooze=true)',
    props: {
      dialogType: 1,
      didSnooze: true,
    },
  },
  {
    title: 'Cannot Update',
    props: {
      dialogType: 2,
    },
  },
  {
    title: 'MacOS Read Only Error',
    props: {
      dialogType: 3,
    },
  },
];

storiesOf('Components/UpdateDialog', module)
  .add('Knobs Playground', () => {
    const dialogType = select(
      'dialogType',
      {
        None: 0,
        Update: 1,
        Cannot_Update: 2,
        MacOS_Read_Only: 3,
      },
      1
    );
    const hasNetworkDialog = boolean('hasNetworkDialog', false);
    const didSnooze = boolean('didSnooze', false);

    return (
      <UpdateDialog
        {...defaultProps}
        dialogType={dialogType}
        didSnooze={didSnooze}
        hasNetworkDialog={hasNetworkDialog}
      />
    );
  })
  .add('Iterations', () => {
    return permutations.map(({ props, title }) => (
      <>
        <h3>{title}</h3>
        <UpdateDialog {...defaultProps} {...props} />
      </>
    ));
  });
