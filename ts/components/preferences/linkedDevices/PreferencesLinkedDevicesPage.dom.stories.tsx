// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { action } from '@storybook/addon-actions';
import { useContext } from 'react';

import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react';

import { setupI18n } from '../../../util/setupI18n.dom.tsx';
import messages from '../../../../_locales/en/messages.json';

import {
  ContactSupportDialog,
  PreferencesLinkedDevicesPage,
} from './PreferencesLinkedDevicesPage.dom.tsx';
import { StorybookThemeContext } from '../../../../.storybook/StorybookThemeContext.std.ts';
import { ThemeType } from '../../../types/Util.std.ts';
import { DAY } from '../../../util/durations/constants.std.ts';
import { LinkDeviceWorkflowStage } from '../../../types/LinkedDevices.std.ts';

import type { Props } from './PreferencesLinkedDevicesPage.dom.tsx';
import type {
  ChoosingTransferMessagesStage,
  ConfirmingWithOSStage,
  ErrorStage,
  ScanningQRCodeStage,
  SendingProvisioningMessageStage,
  TransferringMessagesStage,
  WaitingForLinkCompleteStage,
} from '../../../types/LinkedDevices.std.ts';
import type { LinkedDevice } from '../../../sql/Interface.std.ts';

const useTheme = () => useContext(StorybookThemeContext);

const i18n = setupI18n('en', messages);
const now = Date.now();

export default {
  component: PreferencesLinkedDevicesPage,
  title: 'Components/PreferencesLinkedDevicesPage',
} satisfies Meta<Props>;

function getDefaultProps(): Props {
  return {
    cancelLinking: action('cancelLinking'),
    devices: [],
    i18n,
    moveToChoosingTransferMessages: action('moveToChoosingTransferMessages'),
    refreshDevices: action('refreshDevices'),
    removeDevice: action('removeDevice'),
    renameDevice: action('renameDevice'),
    sendInfoForLink: action('sendInfoForLink'),
    startLinking: action('startLinking'),
    theme: ThemeType.light,
    workflow: undefined,
  };
}

export function Default(): ReactNode {
  const theme = useTheme();

  return <PreferencesLinkedDevicesPage {...getDefaultProps()} theme={theme} />;
}

export function WithDevices(): ReactNode {
  const theme = useTheme();
  const devices: ReadonlyArray<LinkedDevice> = [
    {
      name: 'Laptop',
      id: 2,
      registrationId: 12345,
      lastSeenAt: now - 30 * DAY,
      createdAt: null,
    },
    {
      name: null,
      id: 3,
      registrationId: 11111,
      lastSeenAt: now,
      createdAt: null,
    },
    {
      name: 'iPad',
      id: 5,
      registrationId: 11111,
      lastSeenAt: now - DAY,
      createdAt: now - 2 * DAY,
    },
  ];

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      devices={devices}
    />
  );
}

export function ConfirmingWithOS(): ReactNode {
  const theme = useTheme();
  const workflow: ConfirmingWithOSStage = {
    stage: LinkDeviceWorkflowStage.ConfirmingWithOS,
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ScanningQRCode(): ReactNode {
  const theme = useTheme();
  const workflow: ScanningQRCodeStage = {
    stage: LinkDeviceWorkflowStage.ScanningQRCode,
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ChoosingTransferMessages(): ReactNode {
  const theme = useTheme();
  const workflow: ChoosingTransferMessagesStage = {
    stage: LinkDeviceWorkflowStage.ChoosingTransferMessages,
    candidateDeviceInfo: {
      publicKey: new Uint8Array(),
      address: 'address',
      capabilities: [],
    },
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function SendingProvisioningMessage(): ReactNode {
  const theme = useTheme();
  const workflow: SendingProvisioningMessageStage = {
    stage: LinkDeviceWorkflowStage.SendingProvisioningMessage,
    willTransferMessages: false,
    abortController: new AbortController(),
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function SendingProvisioningMessageWithLinkNSync(): ReactNode {
  const theme = useTheme();
  const workflow: SendingProvisioningMessageStage = {
    stage: LinkDeviceWorkflowStage.SendingProvisioningMessage,
    willTransferMessages: true,
    abortController: new AbortController(),
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function WaitingForLinkComplete(): ReactNode {
  const theme = useTheme();
  const workflow: WaitingForLinkCompleteStage = {
    stage: LinkDeviceWorkflowStage.WaitingForLinkComplete,
    transferMessagesData: undefined,
    tokenIdentifier: 'token',
    abortController: new AbortController(),
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function WaitingForLinkCompleteWithLinkNSync(): ReactNode {
  const theme = useTheme();
  const workflow: WaitingForLinkCompleteStage = {
    stage: LinkDeviceWorkflowStage.WaitingForLinkComplete,
    transferMessagesData: {
      ephemeralBackupKey: new Uint8Array(),
    },
    tokenIdentifier: 'token',
    abortController: new AbortController(),
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function TransferringMessages(): ReactNode {
  const theme = useTheme();
  const workflow: TransferringMessagesStage = {
    stage: LinkDeviceWorkflowStage.TransferringMessages,
    progress: {
      totalBytes: 100_000,
      currentBytes: 60_000,
    },
    deviceId: 2,
    deviceRegistrationId: 999,
    ephemeralBackupKey: new Uint8Array(),
    abortController: new AbortController(),
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ErrorNotEnoughSpace(): ReactNode {
  const theme = useTheme();
  const workflow: TransferringMessagesStage = {
    stage: LinkDeviceWorkflowStage.TransferringMessages,
    progress: {
      totalBytes: 100_000,
      currentBytes: 60_000,
    },
    deviceId: 2,
    deviceRegistrationId: 999,
    ephemeralBackupKey: new Uint8Array(),
    abortController: new AbortController(),
    error: 'not-enough-space',
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ErrorFailedToMakeBackup(): ReactNode {
  const theme = useTheme();
  const workflow: TransferringMessagesStage = {
    stage: LinkDeviceWorkflowStage.TransferringMessages,
    progress: {
      totalBytes: 100_000,
      currentBytes: 60_000,
    },
    deviceId: 2,
    deviceRegistrationId: 999,
    ephemeralBackupKey: new Uint8Array(),
    abortController: new AbortController(),
    error: 'failed-to-make-backup',
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ErrorFailedToUploadBackup(): ReactNode {
  const theme = useTheme();
  const workflow: TransferringMessagesStage = {
    stage: LinkDeviceWorkflowStage.TransferringMessages,
    progress: {
      totalBytes: 100_000,
      currentBytes: 60_000,
    },
    deviceId: 2,
    deviceRegistrationId: 999,
    ephemeralBackupKey: new Uint8Array(),
    abortController: new AbortController(),
    error: 'failed-to-upload',
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ErrorGeneric(): ReactNode {
  const theme = useTheme();
  const workflow: ErrorStage = {
    stage: LinkDeviceWorkflowStage.Error,
  };

  return (
    <PreferencesLinkedDevicesPage
      {...getDefaultProps()}
      theme={theme}
      workflow={workflow}
    />
  );
}

export function ContactSupportDialogStory(): ReactNode {
  return <ContactSupportDialog i18n={i18n} />;
}
