// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { getIntl } from '../selectors/user.std.ts';
import { getUpdatesState } from '../selectors/updates.std.ts';
import { getInstallerState } from '../selectors/installer.std.ts';
import { useInstallerActions } from '../ducks/installer.preload.ts';
import { useUpdatesActions } from '../ducks/updates.preload.ts';
import { hasExpired as hasExpiredSelector } from '../selectors/expiration.dom.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { backupsService } from '../../services/backups/index.preload.ts';
import { InstallScreen } from '../../components/InstallScreen.dom.tsx';
import { WidthBreakpoint } from '../../components/_util.std.ts';
import { InstallScreenStep } from '../../types/InstallScreen.std.ts';
import OS from '../../util/os/osMain.node.ts';
import { isStagingServer } from '../../util/isStagingServer.dom.ts';
import { createLogger } from '../../logging/log.std.ts';
import { SmartToastManager } from './ToastManager.preload.tsx';
import { shouldNeverBeCalled } from '../../util/shouldNeverBeCalled.std.ts';

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
        expandNarrowLeftPane={shouldNeverBeCalled}
        containerWidthBreakpoint={WidthBreakpoint.Narrow}
      />
    </>
  );
});
