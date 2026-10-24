// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState, type ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { CallingDeviceSelection } from './CallingDeviceSelection.dom.tsx';
import type { AudioDevice, AudioDeviceList } from '@signalapp/ringrtc';
import type {
  AudioDevicePref,
  AvailableCamerasRenderProps,
} from '../types/Calling.std.ts';
import { getEmptyAudioDeviceList } from '../types/Calling.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/CallingDeviceSelection',
} satisfies Meta;

function toAudioDevice(name: string, uniqueId: string): AudioDevice {
  return { name, uniqueId };
}

function toCamera(
  label: string,
  deviceId: string
): AvailableCamerasRenderProps {
  return { label, deviceId };
}

const DEFAULT_CAMERA = '';
const DEFAULT_AUDIO_DEVICE = toAudioDevice('', '');

const DEFAULT_AVAILABLE_MICROPHONES = getEmptyAudioDeviceList(false);
const DEFAULT_AVAILABLE_SPEAKERS = getEmptyAudioDeviceList(false);

const DEFAULT_MICROPHONE: AudioDevicePref = {
  type: 'specificDevice',
  device: DEFAULT_AUDIO_DEVICE,
};
const DEFAULT_SPEAKER: AudioDevicePref = { type: 'nonWindowsDefault' };

type TemplateProps = Readonly<{
  availableCameras?: ReadonlyArray<AvailableCamerasRenderProps>;
  availableMicrophones?: AudioDeviceList;
  availableSpeakers?: AudioDeviceList;
  defaultPreferredMicrophone?: AudioDevicePref;
  defaultPreferredSpeaker?: AudioDevicePref;
  defaultPreferredCamera?: string | null;
}>;

function Template(props: TemplateProps): ReactNode {
  const [selectedMicrophone, setPreferredMicrophone] = useState(
    props.defaultPreferredMicrophone ?? DEFAULT_MICROPHONE
  );
  const [selectedSpeaker, setSelectedSpeaker] = useState(
    props.defaultPreferredSpeaker ?? DEFAULT_SPEAKER
  );
  const [selectedCamera, setSelectedCamera] = useState(
    props.defaultPreferredCamera ?? DEFAULT_CAMERA
  );

  return (
    <CallingDeviceSelection
      i18n={i18n}
      onClose={action('onClose')}
      availableCameras={props.availableCameras ?? []}
      availableMicrophones={
        props.availableMicrophones ?? DEFAULT_AVAILABLE_MICROPHONES
      }
      availableSpeakers={props.availableSpeakers ?? DEFAULT_AVAILABLE_SPEAKERS}
      selectedCamera={selectedCamera}
      selectedMicrophone={selectedMicrophone}
      selectedSpeaker={selectedSpeaker}
      onSelectedCameraChange={setSelectedCamera}
      onSelectedMicrophoneChange={setPreferredMicrophone}
      onSelectedSpeakerChange={setSelectedSpeaker}
    />
  );
}

export function Default(): ReactNode {
  return <Template />;
}

export function SomeDevices(): ReactNode {
  const defaultSpeaker = toAudioDevice('Default', 'Default');

  const availableSpeakers: AudioDeviceList = {
    devices: [
      defaultSpeaker,
      toAudioDevice("Natalie's Airpods (Bluetooth)", 'aa'),
      toAudioDevice('UE Boom (Bluetooth)', 'bb'),
    ],
    defaults: {
      isWindows: false,
      device: defaultSpeaker,
    },
  };

  const selectedSpeaker: AudioDevicePref = {
    type: 'specificDevice',
    device: defaultSpeaker,
  };

  return (
    <Template
      availableSpeakers={availableSpeakers}
      defaultPreferredSpeaker={selectedSpeaker}
    />
  );
}

export function DefaultDevices(): ReactNode {
  const availableSpeakers: AudioDeviceList = {
    devices: [toAudioDevice('default (Headphones)', 'Default')],
    defaults: {
      isWindows: true,
      consoleDevice: toAudioDevice('Console', 'console'),
      communicationsDevice: toAudioDevice('Comms', 'comms'),
    },
  };

  const availableMicrophones: AudioDeviceList = {
    devices: [toAudioDevice('DefAuLt (Microphone)', 'Default')],
    defaults: {
      isWindows: true,
      consoleDevice: toAudioDevice('Console Mic', 'console'),
      communicationsDevice: toAudioDevice('Comms Mic', 'comms'),
    },
  };

  const selectedSpeaker: AudioDevicePref = { type: 'windowsConsole' };
  const selectedMicrophone: AudioDevicePref = {
    type: 'windowsCommunications',
  };

  return (
    <Template
      availableSpeakers={availableSpeakers}
      defaultPreferredSpeaker={selectedSpeaker}
      availableMicrophones={availableMicrophones}
      defaultPreferredMicrophone={selectedMicrophone}
    />
  );
}

export function AllDevices(): ReactNode {
  const availableSpeakers: AudioDeviceList = {
    devices: [
      toAudioDevice('Default', 'Default'),
      toAudioDevice("Natalie's Airpods (Bluetooth)", 'aa'),
      toAudioDevice('UE Boom (Bluetooth)', 'bb'),
    ],
    defaults: {
      isWindows: false,
      device: { name: 'Default', uniqueId: 'Default' },
    },
  };
  const selectedSpeaker: AudioDevicePref = { type: 'nonWindowsDefault' };

  const availableMicrophones: AudioDeviceList = {
    devices: [
      toAudioDevice('Default', 'Default'),
      toAudioDevice("Natalie's Airpods (Bluetooth)", 'aa'),
    ],
    defaults: {
      isWindows: false,
      device: toAudioDevice('Monitor of UE Boom (Bluetooth)', 'bb.monitor'),
    },
  };
  const selectedMicrophone: AudioDevicePref = { type: 'nonWindowsDefault' };

  const selectedCamera =
    'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c';

  const availableCameras = [
    toCamera('FaceTime HD Camera (Built-in) (9fba:bced)', selectedCamera),
    toCamera(
      'Logitech Webcam (4e72:9058)',
      'e2db196a31d50ff9b135299dc0beea67f65b1a25a06d8a4ce76976751bb7a08d'
    ),
  ];

  return (
    <Template
      availableCameras={availableCameras}
      availableMicrophones={availableMicrophones}
      availableSpeakers={availableSpeakers}
      defaultPreferredCamera={selectedCamera}
      defaultPreferredMicrophone={selectedMicrophone}
      defaultPreferredSpeaker={selectedSpeaker}
    />
  );
}
