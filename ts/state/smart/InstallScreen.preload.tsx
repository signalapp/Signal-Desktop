// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.std.js';
import { getUpdatesState } from '../selectors/updates.std.js';
import { getInstallerState } from '../selectors/installer.std.js';
import { useInstallerActions } from '../ducks/installer.preload.js';
import { useUpdatesActions } from '../ducks/updates.preload.js';
import { hasExpired as hasExpiredSelector } from '../selectors/expiration.dom.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { backupsService } from '../../services/backups/index.preload.js';
import { InstallScreen } from '../../components/InstallScreen.dom.js';
import { WidthBreakpoint } from '../../components/_util.std.js';
import { InstallScreenStep } from '../../types/InstallScreen.std.js';
import OS from '../../util/os/osMain.node.js';
import { isStagingServer } from '../../util/isStagingServer.dom.js';
import { createLogger } from '../../logging/log.std.js';
import { SmartToastManager } from './ToastManager.preload.js';

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
