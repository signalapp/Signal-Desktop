// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { createLogger } from '../../logging/log.std.ts';
import { getIntl, getUser } from '../selectors/user.std.ts';
import {
  getBackups,
  getLocalBackupWorkflow,
  shouldShowLocalBackupWorkflow,
} from '../selectors/backups.std.ts';
import { useBackupActions } from '../ducks/backups.preload.ts';
import { LocalBackupExportWorkflow } from '../../components/LocalBackupExportWorkflow.dom.tsx';
import { useToastActions } from '../ducks/toast.preload.ts';

const log = createLogger('smart/LocalBackupExportWorkflow');

export const SmartLocalBackupExportWorkflow = memo(
  function SmartLocalBackupExportWorkflow() {
    const backups = useSelector(getBackups);
    const workflow = useSelector(getLocalBackupWorkflow);
    const shouldWeRender = useSelector(shouldShowLocalBackupWorkflow);
    const { osName } = useSelector(getUser);

    const i18n = useSelector(getIntl);

    const { openFileInFolder } = useToastActions();
    const { cancelLocalBackupWorkflow, clearWorkflow } = useBackupActions();

    const containerType = backups.workflow?.type;
    if (containerType !== 'local-backup') {
      log.error(
        `SmartLocalBackupExportWorkflow: containerType is ${containerType}!`
      );
      return;
    }
    if (!shouldWeRender) {
      log.error('SmartLocalBackupExportWorkflow: shouldWeRender=false!');
      return;
    }
    if (!workflow) {
      log.error('SmartLocalBackupExportWorkflow: no workflow!');
      return;
    }

    return (
      <LocalBackupExportWorkflow
        cancelWorkflow={cancelLocalBackupWorkflow}
        clearWorkflow={clearWorkflow}
        i18n={i18n}
        openFileInFolder={openFileInFolder}
        osName={osName}
        workflow={workflow}
      />
    );
  }
);
