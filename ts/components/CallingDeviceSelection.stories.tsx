// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { Props } from './CallingDeviceSelection';
import { CallingDeviceSelection } from './CallingDeviceSelection';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const audioDevice = {
  name: '',
  index: 0,
  uniqueId: '',
  i18nKey: undefined,
};

const createProps = ({
  availableMicrophones = [],
  availableSpeakers = [],
  selectedMicrophone = audioDevice,
  selectedSpeaker = audioDevice,
  availableCameras = [],
  selectedCamera = '',
}: Partial<Props> = {}): Props => ({
  availableCameras,
  availableMicrophones,
  availableSpeakers,
  changeIODevice: action('change-io-device'),
  i18n,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  toggleSettings: action('toggle-settings'),
});

export default {
  title: 'Components/CallingDeviceSelection',
} satisfies Meta<Props>;

export function Default(): JSX.Element {
  return <CallingDeviceSelection {...createProps()} />;
}

export function SomeDevices(): JSX.Element {
  const availableSpeakers = [
    {
      name: 'Default',
      index: 0,
      uniqueId: 'Default',
      i18nKey: 'default_communication_device',
    },
    {
      name: "Natalie's Airpods (Bluetooth)",
      index: 1,
      uniqueId: 'aa',
    },
    {
      name: 'UE Boom (Bluetooth)',
      index: 2,
      uniqueId: 'bb',
    },
  ];
  const selectedSpeaker = availableSpeakers[0];

  const props = createProps({
    availableSpeakers,
    selectedSpeaker,
  });

  return <CallingDeviceSelection {...props} />;
}

export function DefaultDevices(): JSX.Element {
  const availableSpeakers = [
    {
      name: 'default (Headphones)',
      index: 0,
      uniqueId: 'Default',
      i18nKey: 'default_communication_device',
    },
  ];
  const selectedSpeaker = availableSpeakers[0];

  const availableMicrophones = [
    {
      name: 'DefAuLt (Headphones)',
      index: 0,
      uniqueId: 'Default',
      i18nKey: 'default_communication_device',
    },
  ];
  const selectedMicrophone = availableMicrophones[0];

  const props = createProps({
    availableMicrophones,
    availableSpeakers,
    selectedMicrophone,
    selectedSpeaker,
  });

  return <CallingDeviceSelection {...props} />;
}

export function AllDevices(): JSX.Element {
  const availableSpeakers = [
    {
      name: 'Default',
      index: 0,
      uniqueId: 'Default',
      i18nKey: 'default_communication_device',
    },
    {
      name: "Natalie's Airpods (Bluetooth)",
      index: 1,
      uniqueId: 'aa',
    },
    {
      name: 'UE Boom (Bluetooth)',
      index: 2,
      uniqueId: 'bb',
    },
  ];
  const selectedSpeaker = availableSpeakers[0];

  const availableMicrophones = [
    {
      name: 'Default',
      index: 0,
      uniqueId: 'Default',
      i18nKey: 'default_communication_device',
    },
    {
      name: "Natalie's Airpods (Bluetooth)",
      index: 1,
      uniqueId: 'aa',
    },
  ];
  const selectedMicrophone = availableMicrophones[0];

  const availableCameras = [
    {
      deviceId:
        'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
      groupId:
        '63ee218d2446869e40adfc958ff98263e51f74382b0143328ee4826f20a76f47',
      kind: 'videoinput' as MediaDeviceKind,
      label: 'FaceTime HD Camera (Built-in) (9fba:bced)',
      toJSON() {
        return '';
      },
    },
    {
      deviceId:
        'e2db196a31d50ff9b135299dc0beea67f65b1a25a06d8a4ce76976751bb7a08d',
      groupId:
        '218ba7f00d7b1239cca15b9116769e5e7d30cc01104ebf84d667643661e0ecf9',
      kind: 'videoinput' as MediaDeviceKind,
      label: 'Logitech Webcam (4e72:9058)',
      toJSON() {
        return '';
      },
    },
  ];

  const selectedCamera =
    'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c';

  const props = createProps({
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
  });

  return <CallingDeviceSelection {...props} />;
}
