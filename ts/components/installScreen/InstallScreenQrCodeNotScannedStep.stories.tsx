// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';

import { storiesOf } from '@storybook/react';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import type { Loadable } from '../../util/loadable';
import { LoadingState } from '../../util/loadable';
import { InstallScreenQrCodeNotScannedStep } from './InstallScreenQrCodeNotScannedStep';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/InstallScreen/InstallScreenQrCodeNotScannedStep',
  module
);

const Simulation = ({ finalResult }: { finalResult: Loadable<string> }) => {
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
    />
  );
};

story.add('QR code loading', () => (
  <InstallScreenQrCodeNotScannedStep
    i18n={i18n}
    provisioningUrl={{
      loadingState: LoadingState.Loading,
    }}
  />
));

story.add('QR code failed to load', () => (
  <InstallScreenQrCodeNotScannedStep
    i18n={i18n}
    provisioningUrl={{
      loadingState: LoadingState.LoadFailed,
      error: new Error('uh oh'),
    }}
  />
));

story.add('QR code loaded', () => (
  <InstallScreenQrCodeNotScannedStep
    i18n={i18n}
    provisioningUrl={{
      loadingState: LoadingState.Loaded,
      value:
        'https://example.com/fake-signal-link?uuid=56cdd548-e595-4962-9a27-3f1e8210a959&pub_key=SW4gdGhlIHZhc3QsIGRlZXAgZm9yZXN0IG9mIEh5cnVsZS4uLg%3D%3D',
    }}
  />
));

story.add('Simulated loading', () => (
  <Simulation
    finalResult={{
      loadingState: LoadingState.Loaded,
      value:
        'https://example.com/fake-signal-link?uuid=56cdd548-e595-4962-9a27-3f1e8210a959&pub_key=SW4gdGhlIHZhc3QsIGRlZXAgZm9yZXN0IG9mIEh5cnVsZS4uLg%3D%3D',
    }}
  />
));

story.add('Simulated failure', () => (
  <Simulation
    finalResult={{
      loadingState: LoadingState.LoadFailed,
      error: new Error('uh oh'),
    }}
  />
));
