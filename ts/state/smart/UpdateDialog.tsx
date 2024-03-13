// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { DialogUpdate } from '../../components/DialogUpdate';
import { getIntl } from '../selectors/user';
import type { WidthBreakpoint } from '../../components/_util';
import { useUpdatesActions } from '../ducks/updates';
import {
  getUpdateDialogType,
  getUpdateDownloadSize,
  getUpdateDownloadedSize,
  getUpdateVersion,
} from '../selectors/updates';

type SmartUpdateDialogProps = Readonly<{
  containerWidthBreakpoint: WidthBreakpoint;
}>;

export const SmartUpdateDialog = memo(function SmartUpdateDialog({
  containerWidthBreakpoint,
}: SmartUpdateDialogProps) {
  const i18n = useSelector(getIntl);
  const { dismissDialog, snoozeUpdate, startUpdate } = useUpdatesActions();
  const dialogType = useSelector(getUpdateDialogType);
  const downloadSize = useSelector(getUpdateDownloadSize);
  const downloadedSize = useSelector(getUpdateDownloadedSize);
  const version = useSelector(getUpdateVersion);
  return (
    <DialogUpdate
      i18n={i18n}
      containerWidthBreakpoint={containerWidthBreakpoint}
      dialogType={dialogType}
      downloadSize={downloadSize}
      downloadedSize={downloadedSize}
      version={version}
      currentVersion={window.getVersion()}
      dismissDialog={dismissDialog}
      snoozeUpdate={snoozeUpdate}
      startUpdate={startUpdate}
    />
  );
});
