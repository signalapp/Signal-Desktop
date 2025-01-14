// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryFn } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import { DialogType } from '../../types/Dialogs';
import { InstallScreenQRCodeError } from '../../types/InstallScreen';
import enMessages from '../../../_locales/en/messages.json';
import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
import type { PropsType } from './InstallScreenQrCodeNotScannedStep';
import { InstallScreenQrCodeNotScannedStep } from './InstallScreenQrCodeNotScannedStep';

const i18n = setupI18n('en', enMessages);

const LOADED_URL = {
  loadingState: LoadingState.Loaded as const,
  value:
    'sgnl://linkdevice?uuid=b33f6338-aaf1-4853-9aff-6652369f6b52&pub_key=BTpRKRtFeJGga1M3Na4PzZevMvVIWmTWQIpn0BJI3x10',
};

const DEFAULT_UPDATES = {
  dialogType: DialogType.None,
  didSnooze: false,
  isCheckingForUpdates: false,
  showEventsCount: 0,
  downloadSize: 67 * 1024 * 1024,
  downloadedSize: 15 * 1024 * 1024,
  version: 'v7.7.7',
};

export default {
  title: 'Components/InstallScreen/InstallScreenQrCodeNotScannedStep',
  argTypes: {},
} satisfies Meta<PropsType>;

function Simulation({
  finalResult,
}: {
  finalResult: Loadable<string, InstallScreenQRCodeError>;
}) {
  const [provisioningUrl, setProvisioningUrl] = useState<
    Loadable<string, InstallScreenQRCodeError>
  >({
    loadingState: LoadingState.Loading,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setProvisioningUrl(finalResult);
    }, 2000);
    return () => {
      clearTimeout(timeout);
    };
  }, [finalResult]);

  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      isStaging={false}
      provisioningUrl={provisioningUrl}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={action('forceUpdate')}
      currentVersion="v6.0.0"
      retryGetQrCode={action('retryGetQrCode')}
    />
  );
}

export function QrCodeLoading(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      isStaging={false}
      provisioningUrl={{
        loadingState: LoadingState.Loading,
      }}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={action('forceUpdate')}
      currentVersion="v6.0.0"
      retryGetQrCode={action('retryGetQrCode')}
    />
  );
}

export function QrCodeFailedToLoad(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      isStaging={false}
      provisioningUrl={{
        loadingState: LoadingState.LoadFailed,
        error: InstallScreenQRCodeError.Unknown,
      }}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={action('forceUpdate')}
      currentVersion="v6.0.0"
      retryGetQrCode={action('retryGetQrCode')}
    />
  );
}

export function QrCodeLoaded(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      isStaging={false}
      provisioningUrl={LOADED_URL}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={action('forceUpdate')}
      currentVersion="v6.0.0"
      retryGetQrCode={action('retryGetQrCode')}
    />
  );
}

export function SimulatedLoading(): JSX.Element {
  return <Simulation finalResult={LOADED_URL} />;
}

export function SimulatedMaxRotationsError(): JSX.Element {
  return (
    <Simulation
      finalResult={{
        loadingState: LoadingState.LoadFailed,
        error: InstallScreenQRCodeError.MaxRotations,
      }}
    />
  );
}

export function SimulatedUnknownError(): JSX.Element {
  return (
    <Simulation
      finalResult={{
        loadingState: LoadingState.LoadFailed,
        error: InstallScreenQRCodeError.Unknown,
      }}
    />
  );
}

export function SimulatedNetworkIssue(): JSX.Element {
  return (
    <Simulation
      finalResult={{
        loadingState: LoadingState.LoadFailed,
        error: InstallScreenQRCodeError.NetworkIssue,
      }}
    />
  );
}

export function SimulatedTimeout(): JSX.Element {
  return (
    <Simulation
      finalResult={{
        loadingState: LoadingState.LoadFailed,
        error: InstallScreenQRCodeError.Timeout,
      }}
    />
  );
}

export const WithUpdateKnobs: StoryFn<PropsType & { dialogType: DialogType }> =
  // eslint-disable-next-line react/function-component-definition
  function WithUpdateKnobs({
    dialogType,
    currentVersion,
  }: {
    dialogType: DialogType;
    currentVersion: string;
  }): JSX.Element {
    return (
      <InstallScreenQrCodeNotScannedStep
        i18n={i18n}
        isStaging={false}
        provisioningUrl={LOADED_URL}
        hasExpired
        updates={{
          ...DEFAULT_UPDATES,
          dialogType,
        }}
        OS="macOS"
        startUpdate={action('startUpdate')}
        forceUpdate={action('forceUpdate')}
        currentVersion={currentVersion}
        retryGetQrCode={action('retryGetQrCode')}
      />
    );
  };

WithUpdateKnobs.argTypes = {
  dialogType: {
    control: { type: 'select' },
    options: Object.values(DialogType),
  },
  currentVersion: {
    control: { type: 'select' },
    options: ['v6.0.0', 'v6.1.0-beta.1'],
  },
};
WithUpdateKnobs.args = {
  dialogType: DialogType.AutoUpdate,
  currentVersion: 'v6.0.0',
};
