// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { InstallScreenChoosingDeviceNameStep } from './InstallScreenChoosingDeviceNameStep';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/InstallScreen/InstallScreenChoosingDeviceNameStep',
  module
);

story.add('Default', () => {
  const Wrapper = () => {
    const [deviceName, setDeviceName] = useState<string>('Default value');

    return (
      <InstallScreenChoosingDeviceNameStep
        i18n={i18n}
        deviceName={deviceName}
        setDeviceName={setDeviceName}
        onSubmit={action('onSubmit')}
      />
    );
  };

  return <Wrapper />;
});
