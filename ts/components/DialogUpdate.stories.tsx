// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
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

export default {
  title: 'Components/DialogUpdate',
};

export const KnobsPlayground = (): JSX.Element => {
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
};

export const UpdateWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      dialogType={DialogType.Update}
      currentVersion="5.24.0"
    />
  </FakeLeftPaneContainer>
);

UpdateWide.story = {
  name: 'Update (Wide)',
};

export const DownloadReadyWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.DownloadReady}
      downloadSize={30123456}
    />
  </FakeLeftPaneContainer>
);

DownloadReadyWide.story = {
  name: 'DownloadReady (Wide)',
};

export const FullDownloadReadyWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.FullDownloadReady}
      downloadSize={300123456}
    />
  </FakeLeftPaneContainer>
);

FullDownloadReadyWide.story = {
  name: 'FullDownloadReady (Wide)',
};

export const DownloadingWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.Downloading}
    />
  </FakeLeftPaneContainer>
);

DownloadingWide.story = {
  name: 'Downloading (Wide)',
};

export const CannotUpdateWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.Cannot_Update}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateWide.story = {
  name: 'Cannot_Update (Wide)',
};

export const CannotUpdateBetaWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0-beta.1"
      dialogType={DialogType.Cannot_Update}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateBetaWide.story = {
  name: 'Cannot_Update_Beta (Wide)',
};

export const CannotUpdateRequireManualWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.Cannot_Update_Require_Manual}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateRequireManualWide.story = {
  name: 'Cannot_Update_Require_Manual (Wide)',
};

export const CannotUpdateRequireManualBetaWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0-beta.1"
      dialogType={DialogType.Cannot_Update_Require_Manual}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateRequireManualBetaWide.story = {
  name: 'Cannot_Update_Require_Manual_Beta (Wide)',
};

export const MacOSReadOnlyWide = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Wide}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Wide}
      currentVersion="5.24.0"
      dialogType={DialogType.MacOS_Read_Only}
    />
  </FakeLeftPaneContainer>
);

MacOSReadOnlyWide.story = {
  name: 'MacOS_Read_Only (Wide)',
};

export const UpdateNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      dialogType={DialogType.Update}
      currentVersion="5.24.0"
    />
  </FakeLeftPaneContainer>
);

UpdateNarrow.story = {
  name: 'Update (Narrow)',
};

export const DownloadReadyNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.DownloadReady}
      downloadSize={30123456}
    />
  </FakeLeftPaneContainer>
);

DownloadReadyNarrow.story = {
  name: 'DownloadReady (Narrow)',
};

export const FullDownloadReadyNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.FullDownloadReady}
      downloadSize={300123456}
    />
  </FakeLeftPaneContainer>
);

FullDownloadReadyNarrow.story = {
  name: 'FullDownloadReady (Narrow)',
};

export const DownloadingNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.Downloading}
    />
  </FakeLeftPaneContainer>
);

DownloadingNarrow.story = {
  name: 'Downloading (Narrow)',
};

export const CannotUpdateNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.Cannot_Update}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateNarrow.story = {
  name: 'Cannot Update (Narrow)',
};

export const CannotUpdateBetaNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0-beta.1"
      dialogType={DialogType.Cannot_Update}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateBetaNarrow.story = {
  name: 'Cannot Update Beta (Narrow)',
};

export const CannotUpdateRequireManualNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.Cannot_Update_Require_Manual}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateRequireManualNarrow.story = {
  name: 'Cannot_Update_Require_Manual (Narrow)',
};

export const CannotUpdateRequireManualBetaNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0-beta.1"
      dialogType={DialogType.Cannot_Update_Require_Manual}
    />
  </FakeLeftPaneContainer>
);

CannotUpdateRequireManualBetaNarrow.story = {
  name: 'Cannot_Update_Require_Manual_Beta (Narrow)',
};

export const MacOSReadOnlyNarrow = (): JSX.Element => (
  <FakeLeftPaneContainer containerWidthBreakpoint={WidthBreakpoint.Narrow}>
    <DialogUpdate
      {...defaultProps}
      containerWidthBreakpoint={WidthBreakpoint.Narrow}
      currentVersion="5.24.0"
      dialogType={DialogType.MacOS_Read_Only}
    />
  </FakeLeftPaneContainer>
);

MacOSReadOnlyNarrow.story = {
  name: 'MacOS_Read_Only (Narrow)',
};
