// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { AudioDeviceList } from '@signalapp/ringrtc';

import type { Option } from './Select.dom.tsx';
import { Modal } from './Modal.dom.tsx';
import { Select } from './Select.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import type {
  ChangeIODevicePayloadType,
  MediaDeviceSettings,
} from '../types/Calling.std.ts';
import {
  CallingDeviceType,
  audioDevicePrefToId,
  audioDevicePrefStrToAudioDevicePref,
} from '../types/Calling.std.ts';
import { Theme } from '../util/theme.std.ts';

export type Props = MediaDeviceSettings & {
  changeIODevice: (payload: ChangeIODevicePayloadType) => void;
  i18n: LocalizerType;
  toggleSettings: () => void;
};

function renderDefaultLabel(i18n: LocalizerType, deviceLabel: string): string {
  return i18n('icu:callingDeviceSelection__select--default-nonwin', {
    deviceName: deviceLabel,
  });
}

function renderDefaultComms(i18n: LocalizerType, deviceLabel: string): string {
  return i18n('icu:callingDeviceSelection__select--default_communications', {
    deviceName: deviceLabel,
  });
}

function renderDefaultConsole(
  i18n: LocalizerType,
  deviceLabel: string
): string {
  return i18n('icu:callingDeviceSelection__select--default_console', {
    deviceName: deviceLabel,
  });
}

// returns the devices found or a placeholder option, and a boolean indicating
// whether we found any devices (and should let the user select from the list)
export function renderAudioOptions(
  devices: AudioDeviceList,
  i18n: LocalizerType
): [Array<Option>, boolean] {
  const out = [];
  if (devices.defaults.isWindows) {
    if (devices.defaults.communicationsDevice !== undefined) {
      out.push({
        text: renderDefaultComms(
          i18n,
          devices.defaults.communicationsDevice.name
        ),
        // should match AudioDevicePref
        value: 'windowsCommunications',
      });
    }
    if (devices.defaults.consoleDevice !== undefined) {
      out.push({
        text: renderDefaultConsole(i18n, devices.defaults.consoleDevice.name),
        // should match AudioDevicePref
        value: 'windowsConsole',
      });
    }
  } else if (devices.defaults.device !== undefined) {
    out.push({
      text: renderDefaultLabel(i18n, devices.defaults.device.name),
      // should match AudioDevicePref
      value: 'nonWindowsDefault',
    });
  }

  for (const device of devices.devices) {
    out.push({
      text: device.name,
      value: device.uniqueId,
    });
  }

  if (!out.length) {
    return [
      [
        {
          text: i18n('icu:callingDeviceSelection__select--no-device'),
          value: 'emptyAudioDeviceList',
        },
      ],
      false,
    ];
  }

  return [out, true];
}

function renderVideoOptions(
  devices: Array<MediaDeviceInfo>,
  i18n: LocalizerType
): Array<Option> {
  if (!devices.length) {
    return [
      {
        text: i18n('icu:callingDeviceSelection__select--no-device'),
        value: '',
      },
    ];
  }

  return devices.map((device: MediaDeviceInfo) => {
    return {
      text: device.label,
      value: device.deviceId,
    };
  });
}

function createAudioChangeHandler(
  devices: AudioDeviceList,
  changeIODevice: (payload: ChangeIODevicePayloadType) => void,
  type: CallingDeviceType.SPEAKER | CallingDeviceType.MICROPHONE
) {
  return (value: string): void => {
    const pref = audioDevicePrefStrToAudioDevicePref(value, devices);
    if (pref) {
      changeIODevice({
        type,
        selectedDevice: pref,
      });
    }
  };
}

function createCameraChangeHandler(
  changeIODevice: (payload: ChangeIODevicePayloadType) => void
) {
  return (value: string): void => {
    changeIODevice({
      type: CallingDeviceType.CAMERA,
      selectedDevice: value,
    });
  };
}

export function CallingDeviceSelection({
  availableCameras,
  availableMicrophones,
  availableSpeakers,
  changeIODevice,
  i18n,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  toggleSettings,
}: Props): JSX.Element {
  const selectedMicrophoneId = audioDevicePrefToId(selectedMicrophone);
  const selectedSpeakerId = audioDevicePrefToId(selectedSpeaker);
  const [microphoneOptions, enableMicSelect] = renderAudioOptions(
    availableMicrophones,
    i18n
  );
  const [speakerOptions, enableSpeakerSelect] = renderAudioOptions(
    availableSpeakers,
    i18n
  );

  return (
    <Modal
      modalName="CallingDeviceSelection"
      i18n={i18n}
      theme={Theme.Dark}
      onClose={toggleSettings}
    >
      <div className="module-calling-device-selection">
        <button
          type="button"
          className="module-calling-device-selection__close-button"
          onClick={toggleSettings}
          tabIndex={0}
          aria-label={i18n('icu:close')}
        />
      </div>

      <h1 className="module-calling-device-selection__title">
        {i18n('icu:callingDeviceSelection__settings')}
      </h1>

      <label htmlFor="video" className="module-calling-device-selection__label">
        {i18n('icu:callingDeviceSelection__label--video')}
      </label>
      <div className="module-calling-device-selection__select">
        <Select
          disabled={!availableCameras.length}
          id="camera"
          name="camera"
          onChange={createCameraChangeHandler(changeIODevice)}
          options={renderVideoOptions(availableCameras, i18n)}
          value={selectedCamera}
        />
      </div>

      <label
        htmlFor="audio-input"
        className="module-calling-device-selection__label"
      >
        {i18n('icu:callingDeviceSelection__label--audio-input')}
      </label>
      <div className="module-calling-device-selection__select">
        <Select
          disabled={!enableMicSelect}
          id="audio-input"
          name="audio-input"
          onChange={createAudioChangeHandler(
            availableMicrophones,
            changeIODevice,
            CallingDeviceType.MICROPHONE
          )}
          options={microphoneOptions}
          value={selectedMicrophoneId}
        />
      </div>

      <label
        htmlFor="audio-output"
        className="module-calling-device-selection__label"
      >
        {i18n('icu:callingDeviceSelection__label--audio-output')}
      </label>
      <div className="module-calling-device-selection__select">
        <Select
          disabled={!enableSpeakerSelect}
          id="audio-output"
          name="audio-output"
          onChange={createAudioChangeHandler(
            availableSpeakers,
            changeIODevice,
            CallingDeviceType.SPEAKER
          )}
          options={speakerOptions}
          value={selectedSpeakerId}
        />
      </div>
    </Modal>
  );
}
