// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.js';
import { getUpdatesState } from '../selectors/updates.js';
import { getInstallerState } from '../selectors/installer.js';
import { useInstallerActions } from '../ducks/installer.js';
import { useUpdatesActions } from '../ducks/updates.js';
import { hasExpired as hasExpiredSelector } from '../selectors/expiration.js';
import { missingCaseError } from '../../util/missingCaseError.js';
import { backupsService } from '../../services/backups/index.js';
import { InstallScreen } from '../../components/InstallScreen.js';
import { WidthBreakpoint } from '../../components/_util.js';
import { InstallScreenStep } from '../../types/InstallScreen.js';
import OS from '../../util/os/osMain.js';
import { isStagingServer } from '../../util/isStagingServer.js';
import { createLogger } from '../../logging/log.js';
import { SmartToastManager } from './ToastManager.js';

const log = createLogger('InstallScreen');

type PropsType = ComponentProps<typeof InstallScreen>;

export const SmartInstallScreen = memo(function SmartInstallScreen() {
  const i18n = useSelector(getIntl);
  const installerState = useSelector(getInstallerState);
  const updates = useSelector(getUpdatesState);
  const { startInstaller, retryBackupImport } = useInstallerActions();
  const { startUpdate, forceUpdate } = useUpdatesActions();
  const hasExpired = useSelector(hasExpiredSelector);

  const onCancelBackupImport = useCallback((): void => {
    backupsService.cancelDownloadAndImport();
  }, []);

  let props: PropsType;

  switch (installerState.step) {
    case InstallScreenStep.NotStarted:
      log.error('Installer not started');
      return null;

    case InstallScreenStep.QrCodeNotScanned:
      props = {
        step: InstallScreenStep.QrCodeNotScanned,
        screenSpecificProps: {
          i18n,
          provisioningUrl: installerState.provisioningUrl,
          hasExpired,
          updates,
          currentVersion: window.getVersion(),
          startUpdate,
          forceUpdate,
          retryGetQrCode: startInstaller,
          OS: OS.getName(),
          isStaging: isStagingServer(),
        },
      };
      break;
    case InstallScreenStep.LinkInProgress:
      props = {
        step: InstallScreenStep.LinkInProgress,
        screenSpecificProps: { i18n },
      };
      break;
    case InstallScreenStep.BackupImport:
      props = {
        step: InstallScreenStep.BackupImport,
        screenSpecificProps: {
          i18n,
          ...installerState,
          onCancel: onCancelBackupImport,
          onRetry: retryBackupImport,
          updates,
          currentVersion: window.getVersion(),
          forceUpdate,
          startUpdate,
          OS: OS.getName(),
        },
      };
      break;
    case InstallScreenStep.Error:
      props = {
        step: InstallScreenStep.Error,
        screenSpecificProps: {
          i18n,
          error: installerState.error,
          quit: () => window.IPC.shutdown(),
          tryAgain: startInstaller,
        },
      };
      break;
    default:
      throw missingCaseError(installerState);
  }

  return (
    <>
      <InstallScreen {...props} />
      <SmartToastManager
        disableMegaphone
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
      />
    </>
  );
});
