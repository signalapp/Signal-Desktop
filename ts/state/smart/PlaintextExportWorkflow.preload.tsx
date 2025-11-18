// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { createLogger } from '../../logging/log.std.js';
import { getIntl, getUser } from '../selectors/user.std.js';
import {
  getBackups,
  getWorkflow,
  shouldShowPlaintextWorkflow,
} from '../selectors/backups.std.js';
import { useBackupActions } from '../ducks/backups.preload.js';
import { PlaintextExportWorkflow } from '../../components/PlaintextExportWorkflow.dom.js';
import { useToastActions } from '../ducks/toast.preload.js';

const log = createLogger('smart/PlaintextExportWorkflow');

export const SmartPlaintextExportWorkflow = memo(
  function SmartPlaintextExportWorkflow() {
    const backups = useSelector(getBackups);
    const workflow = useSelector(getWorkflow);
    const shouldWeRender = useSelector(shouldShowPlaintextWorkflow);
    const { osName } = useSelector(getUser);

    const i18n = useSelector(getIntl);

    const { openFileInFolder } = useToastActions();
    const { cancelWorkflow, clearWorkflow, verifyWithOSForExport } =
      useBackupActions();

    const containerType = backups.workflow?.type;
    if (containerType !== 'plaintext-export') {
      log.error(
        `SmartPlaintextExportWorkflow: containerType is ${containerType}!`
      );
      return;
    }
    if (!shouldWeRender) {
      log.error('SmartPlaintextExportWorkflow: shouldWeRender=false!');
      return;
    }
    if (!workflow) {
      log.error('SmartPlaintextExportWorkflow: no workflow!');
      return;
    }

    return (
      <PlaintextExportWorkflow
        cancelWorkflow={cancelWorkflow}
        clearWorkflow={clearWorkflow}
        i18n={i18n}
        openFileInFolder={openFileInFolder}
        osName={osName}
        verifyWithOSForExport={verifyWithOSForExport}
        workflow={workflow}
      />
    );
  }
);
