// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './InstallScreenChoosingDeviceNameStep';
import { InstallScreenChoosingDeviceNameStep } from './InstallScreenChoosingDeviceNameStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreen/InstallScreenChoosingDeviceNameStep',
} satisfies Meta<PropsType>;

function Wrapper() {
  const [deviceName, setDeviceName] = useState<string>('Default value');

  return (
    <InstallScreenChoosingDeviceNameStep
      i18n={i18n}
      deviceName={deviceName}
      setBackupFile={action('setBackupFile')}
      setDeviceName={setDeviceName}
      onSubmit={action('onSubmit')}
    />
  );
}

export function Default(): JSX.Element {
  return <Wrapper />;
}
