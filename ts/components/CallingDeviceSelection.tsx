// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { AudioDevice } from '@signalapp/ringrtc';

import type { Option } from './Select.dom.js';
import { Modal } from './Modal.dom.js';
import { Select } from './Select.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import type {
  ChangeIODevicePayloadType,
  MediaDeviceSettings,
} from '../types/Calling.std.js';
import { CallingDeviceType } from '../types/Calling.std.js';
import { Theme } from '../util/theme.std.js';

export type Props = MediaDeviceSettings & {
  changeIODevice: (payload: ChangeIODevicePayloadType) => void;
  i18n: LocalizerType;
  toggleSettings: () => void;
};

function localizeDefault(i18n: LocalizerType, deviceLabel: string): string {
  return deviceLabel.toLowerCase().startsWith('default')
    ? deviceLabel.replace(
        /default/i,
        i18n('icu:callingDeviceSelection__select--default')
      )
    : deviceLabel;
}

function renderAudioOptions(
  devices: Array<AudioDevice>,
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

  return devices.map(device => {
    return {
      text: localizeDefault(i18n, device.name),
      value: device.index,
    };
  });
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
      text: localizeDefault(i18n, device.label),
      value: device.deviceId,
    };
  });
}

function createAudioChangeHandler(
  devices: Array<AudioDevice>,
  changeIODevice: (payload: ChangeIODevicePayloadType) => void,
  type: CallingDeviceType.SPEAKER | CallingDeviceType.MICROPHONE
) {
  return (value: string): void => {
    changeIODevice({
      type,
      selectedDevice: devices[Number(value)],
    });
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
  const selectedMicrophoneIndex = selectedMicrophone
    ? selectedMicrophone.index
    : undefined;
  const selectedSpeakerIndex = selectedSpeaker
    ? selectedSpeaker.index
    : undefined;

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
          disabled={!availableMicrophones.length}
          id="audio-input"
          name="audio-input"
          onChange={createAudioChangeHandler(
            availableMicrophones,
            changeIODevice,
            CallingDeviceType.MICROPHONE
          )}
          options={renderAudioOptions(availableMicrophones, i18n)}
          value={selectedMicrophoneIndex}
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
          disabled={!availableSpeakers.length}
          id="audio-output"
          name="audio-output"
          onChange={createAudioChangeHandler(
            availableSpeakers,
            changeIODevice,
            CallingDeviceType.SPEAKER
          )}
          options={renderAudioOptions(availableSpeakers, i18n)}
          value={selectedSpeakerIndex}
        />
      </div>
    </Modal>
  );
}
