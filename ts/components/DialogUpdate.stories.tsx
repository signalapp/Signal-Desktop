// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { DialogUpdate } from './DialogUpdate';
import { DialogType } from '../types/Dialogs';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  containerWidthBreakpoint: WidthBreakpoint.Wide,
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
  const containerWidthBreakpoint = select(
    'containerWidthBreakpoint',
    WidthBreakpoint,
    WidthBreakpoint.Wide
  );
  const dialogType = select('dialogType', DialogType, DialogType.Update);
  const hasNetworkDialog = boolean('hasNetworkDialog', false);
  const didSnooze = boolean('didSnooze', false);

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultProps}
        containerWidthBreakpoint={containerWidthBreakpoint}
        dialogType={dialogType}
        didSnooze={didSnooze}
        hasNetworkDialog={hasNetworkDialog}
        currentVersion="5.24.0"
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

  story.add(`Update (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.Update}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Download Ready (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.DownloadReady}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Downloading (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.Downloading}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Cannot Update (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.Cannot_Update}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`Cannot Update Beta (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.Cannot_Update}
        currentVersion="5.24.0-beta.1"
      />
    </FakeLeftPaneContainer>
  ));

  story.add(`macOS RO Error (${name} container)`, () => (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogUpdate
        {...defaultPropsForBreakpoint}
        dialogType={DialogType.MacOS_Read_Only}
        currentVersion="5.24.0"
      />
    </FakeLeftPaneContainer>
  ));
});
