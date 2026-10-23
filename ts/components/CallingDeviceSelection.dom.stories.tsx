// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { Props } from './CallingDeviceSelection.dom.tsx';
import { CallingDeviceSelection } from './CallingDeviceSelection.dom.tsx';
import type { AudioDevicePref } from '../types/Calling.std.ts';
import { getEmptyAudioDeviceList } from '../types/Calling.std.ts';
import type { AudioDeviceList } from '@signalapp/ringrtc';

const { i18n } = window.SignalContext;

const audioDevice = {
  name: '',
  uniqueId: '',
};

const createProps = ({
  availableMicrophones = getEmptyAudioDeviceList(false),
  availableSpeakers = getEmptyAudioDeviceList(false),
  selectedMicrophone = { type: 'specificDevice', device: audioDevice },
  selectedSpeaker = { type: 'nonWindowsDefault' },
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
  const availableSpeakers: AudioDeviceList = {
    devices: [
      {
        name: 'Default',
        uniqueId: 'Default',
      },
      {
        name: "Natalie's Airpods (Bluetooth)",
        uniqueId: 'aa',
      },
      {
        name: 'UE Boom (Bluetooth)',
        uniqueId: 'bb',
      },
    ],
    defaults: {
      isWindows: false,
      device: { name: 'Default', uniqueId: 'Default' },
    },
  };
  const selectedSpeaker: AudioDevicePref = {
    type: 'specificDevice',
    device: {
      name: 'Default',
      uniqueId: 'Default',
    },
  };

  const props = createProps({
    availableSpeakers,
    selectedSpeaker,
  });

  return <CallingDeviceSelection {...props} />;
}

export function DefaultDevices(): JSX.Element {
  const availableSpeakers: AudioDeviceList = {
    devices: [
      {
        name: 'default (Headphones)',
        uniqueId: 'Default',
      },
    ],
    defaults: {
      isWindows: true,
      consoleDevice: { name: 'Console', uniqueId: 'console' },
      communicationsDevice: { name: 'Comms', uniqueId: 'comms' },
    },
  };
  const selectedSpeaker: AudioDevicePref = { type: 'nonWindowsDefault' };

  const availableMicrophones: AudioDeviceList = {
    devices: [
      {
        name: 'DefAuLt (Microphone)',
        uniqueId: 'Default',
      },
    ],
    defaults: {
      isWindows: true,
      consoleDevice: { name: 'Console Mic', uniqueId: 'console' },
      communicationsDevice: { name: 'Comms Mic', uniqueId: 'comms' },
    },
  };
  const selectedMicrophone: AudioDevicePref = { type: 'nonWindowsDefault' };

  const props = createProps({
    availableMicrophones,
    availableSpeakers,
    selectedMicrophone,
    selectedSpeaker,
  });

  return <CallingDeviceSelection {...props} />;
}

export function AllDevices(): JSX.Element {
  const availableSpeakers: AudioDeviceList = {
    devices: [
      {
        name: 'Default',
        uniqueId: 'Default',
      },
      {
        name: "Natalie's Airpods (Bluetooth)",
        uniqueId: 'aa',
      },
      {
        name: 'UE Boom (Bluetooth)',
        uniqueId: 'bb',
      },
    ],
    defaults: {
      isWindows: false,
      device: { name: 'Default', uniqueId: 'Default' },
    },
  };
  const selectedSpeaker: AudioDevicePref = { type: 'windowsConsole' };

  const availableMicrophones: AudioDeviceList = {
    devices: [
      {
        name: 'Default',
        uniqueId: 'Default',
      },
      {
        name: "Natalie's Airpods (Bluetooth)",
        uniqueId: 'aa',
      },
    ],
    defaults: {
      isWindows: false,
      device: {
        name: 'Monitor of UE Boom (Bluetooth)',
        uniqueId: 'bb.monitor',
      },
    },
  };
  const selectedMicrophone: AudioDevicePref = { type: 'windowsCommunications' };

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
