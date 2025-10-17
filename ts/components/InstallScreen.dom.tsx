// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps, ReactElement } from 'react';
import React from 'react';

import { missingCaseError } from '../util/missingCaseError.std.js';
import { InstallScreenStep } from '../types/InstallScreen.std.js';
import { InstallScreenErrorStep } from './installScreen/InstallScreenErrorStep.dom.js';
import { InstallScreenLinkInProgressStep } from './installScreen/InstallScreenLinkInProgressStep.dom.js';
import { InstallScreenQrCodeNotScannedStep } from './installScreen/InstallScreenQrCodeNotScannedStep.dom.js';
import { InstallScreenBackupImportStep } from './installScreen/InstallScreenBackupImportStep.dom.js';

// We can't always use destructuring assignment because of the complexity of this props
//   type.

type PropsType =
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      screenSpecificProps: ComponentProps<
        typeof InstallScreenQrCodeNotScannedStep
      >;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
      screenSpecificProps: ComponentProps<
        typeof InstallScreenLinkInProgressStep
      >;
    }
  | {
      step: InstallScreenStep.BackupImport;
      screenSpecificProps: ComponentProps<typeof InstallScreenBackupImportStep>;
    }
  | {
      step: InstallScreenStep.Error;
      screenSpecificProps: ComponentProps<typeof InstallScreenErrorStep>;
    };

export function InstallScreen(props: Readonly<PropsType>): ReactElement {
  switch (props.step) {
    case InstallScreenStep.Error:
      return <InstallScreenErrorStep {...props.screenSpecificProps} />;
    case InstallScreenStep.QrCodeNotScanned:
      return (
        <InstallScreenQrCodeNotScannedStep {...props.screenSpecificProps} />
      );
    case InstallScreenStep.LinkInProgress:
      return <InstallScreenLinkInProgressStep {...props.screenSpecificProps} />;
    case InstallScreenStep.BackupImport:
      return <InstallScreenBackupImportStep {...props.screenSpecificProps} />;
    default:
      throw missingCaseError(props);
  }
}
