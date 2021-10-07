// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { DialogUpdate } from './DialogUpdate';
import { DialogType } from '../types/Dialogs';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  dismissDialog: action('dismiss-dialog'),
  downloadSize: 116504357,
  downloadedSize: 61003110,
  hasNetworkDialog: false,
  i18n,
  didSnooze: false,
  showEventsCount: 0,
  snoozeUpdate: action('snooze-update'),
  startUpdate: action('start-update'),
  version: 'v7.7.7',
};

const story = storiesOf('Components/DialogUpdate', module);

story.add('Knobs Playground', () => {
  const dialogType = select('dialogType', DialogType, DialogType.Update);
  const hasNetworkDialog = boolean('hasNetworkDialog', false);
  const didSnooze = boolean('didSnooze', false);

  return (
    <DialogUpdate
      {...defaultProps}
      dialogType={dialogType}
      didSnooze={didSnooze}
      hasNetworkDialog={hasNetworkDialog}
    />
  );
});

story.add('Update', () => (
  <DialogUpdate {...defaultProps} dialogType={DialogType.Update} />
));

story.add('Download Ready', () => (
  <DialogUpdate {...defaultProps} dialogType={DialogType.DownloadReady} />
));

story.add('Downloading', () => (
  <DialogUpdate {...defaultProps} dialogType={DialogType.Downloading} />
));

story.add('Cannot Update', () => (
  <DialogUpdate {...defaultProps} dialogType={DialogType.Cannot_Update} />
));

story.add('macOS RO Error', () => (
  <DialogUpdate {...defaultProps} dialogType={DialogType.MacOS_Read_Only} />
));
