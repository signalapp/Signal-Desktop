// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import { DialogType } from '../../types/Dialogs';
import enMessages from '../../../_locales/en/messages.json';

import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
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
  showEventsCount: 0,
  downloadSize: 67 * 1024 * 1024,
  downloadedSize: 15 * 1024 * 1024,
  version: 'v7.7.7',
};

export default {
  title: 'Components/InstallScreen/InstallScreenQrCodeNotScannedStep',
  argTypes: {},
};

function Simulation({ finalResult }: { finalResult: Loadable<string> }) {
  const [provisioningUrl, setProvisioningUrl] = useState<Loadable<string>>({
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
      provisioningUrl={provisioningUrl}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      currentVersion="v6.0.0"
    />
  );
}

export function QrCodeLoading(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      provisioningUrl={{
        loadingState: LoadingState.Loading,
      }}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      currentVersion="v6.0.0"
    />
  );
}

QrCodeLoading.story = {
  name: 'QR code loading',
};

export function QrCodeFailedToLoad(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      provisioningUrl={{
        loadingState: LoadingState.LoadFailed,
        error: new Error('uh oh'),
      }}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      currentVersion="v6.0.0"
    />
  );
}

QrCodeFailedToLoad.story = {
  name: 'QR code failed to load',
};

export function QrCodeLoaded(): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      provisioningUrl={LOADED_URL}
      updates={DEFAULT_UPDATES}
      OS="macOS"
      startUpdate={action('startUpdate')}
      currentVersion="v6.0.0"
    />
  );
}

QrCodeLoaded.story = {
  name: 'QR code loaded',
};

export function SimulatedLoading(): JSX.Element {
  return <Simulation finalResult={LOADED_URL} />;
}

SimulatedLoading.story = {
  name: 'Simulated loading',
};

export function SimulatedFailure(): JSX.Element {
  return (
    <Simulation
      finalResult={{
        loadingState: LoadingState.LoadFailed,
        error: new Error('uh oh'),
      }}
    />
  );
}

SimulatedFailure.story = {
  name: 'Simulated failure',
};

export function WithUpdateKnobs({
  dialogType,
  currentVersion,
}: {
  dialogType: DialogType;
  currentVersion: string;
}): JSX.Element {
  return (
    <InstallScreenQrCodeNotScannedStep
      i18n={i18n}
      provisioningUrl={LOADED_URL}
      hasExpired
      updates={{
        ...DEFAULT_UPDATES,
        dialogType,
      }}
      OS="macOS"
      startUpdate={action('startUpdate')}
      currentVersion={currentVersion}
    />
  );
}

WithUpdateKnobs.story = {
  name: 'With Update Knobs',
  argTypes: {
    dialogType: {
      control: { type: 'select' },
      defaultValue: DialogType.AutoUpdate,
      options: Object.values(DialogType),
    },
    currentVersion: {
      control: { type: 'select' },
      defaultValue: 'v6.0.0',
      options: ['v6.0.0', 'v6.1.0-beta.1'],
    },
  },
};
