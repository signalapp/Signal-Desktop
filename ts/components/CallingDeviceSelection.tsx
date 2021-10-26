// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { AudioDevice } from 'ringrtc';

import { Modal } from './Modal';
import type { LocalizerType } from '../types/Util';
import type {
  ChangeIODevicePayloadType,
  MediaDeviceSettings,
} from '../types/Calling';
import { CallingDeviceType } from '../types/Calling';
import { Theme } from '../util/theme';

export type Props = MediaDeviceSettings & {
  changeIODevice: (payload: ChangeIODevicePayloadType) => void;
  i18n: LocalizerType;
  toggleSettings: () => void;
};

function localizeDefault(i18n: LocalizerType, deviceLabel: string): string {
  return deviceLabel.toLowerCase().startsWith('default')
    ? deviceLabel.replace(
        /default/i,
        i18n('callingDeviceSelection__select--default')
      )
    : deviceLabel;
}

function renderAudioOptions(
  devices: Array<AudioDevice>,
  i18n: LocalizerType,
  selectedDevice: AudioDevice | undefined
): JSX.Element {
  if (!devices.length) {
    return (
      <option aria-selected>
        {i18n('callingDeviceSelection__select--no-device')}
      </option>
    );
  }

  return (
    <>
      {devices.map((device: AudioDevice) => {
        const isSelected =
          selectedDevice && selectedDevice.index === device.index;
        return (
          <option
            aria-selected={isSelected}
            key={device.index}
            value={device.index}
          >
            {localizeDefault(i18n, device.name)}
          </option>
        );
      })}
    </>
  );
}

function renderVideoOptions(
  devices: Array<MediaDeviceInfo>,
  i18n: LocalizerType,
  selectedCamera: string | undefined
): JSX.Element {
  if (!devices.length) {
    return (
      <option aria-selected>
        {i18n('callingDeviceSelection__select--no-device')}
      </option>
    );
  }

  return (
    <>
      {devices.map((device: MediaDeviceInfo) => {
        const isSelected = selectedCamera === device.deviceId;

        return (
          <option
            aria-selected={isSelected}
            key={device.deviceId}
            value={device.deviceId}
          >
            {localizeDefault(i18n, device.label)}
          </option>
        );
      })}
    </>
  );
}

function createAudioChangeHandler(
  devices: Array<AudioDevice>,
  changeIODevice: (payload: ChangeIODevicePayloadType) => void,
  type: CallingDeviceType.SPEAKER | CallingDeviceType.MICROPHONE
) {
  return (ev: React.FormEvent<HTMLSelectElement>): void => {
    changeIODevice({
      type,
      selectedDevice: devices[Number(ev.currentTarget.value)],
    });
  };
}

function createCameraChangeHandler(
  changeIODevice: (payload: ChangeIODevicePayloadType) => void
) {
  return (ev: React.FormEvent<HTMLSelectElement>): void => {
    changeIODevice({
      type: CallingDeviceType.CAMERA,
      selectedDevice: String(ev.currentTarget.value),
    });
  };
}

export const CallingDeviceSelection = ({
  availableCameras,
  availableMicrophones,
  availableSpeakers,
  changeIODevice,
  i18n,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  toggleSettings,
}: Props): JSX.Element => {
  const selectedMicrophoneIndex = selectedMicrophone
    ? selectedMicrophone.index
    : undefined;
  const selectedSpeakerIndex = selectedSpeaker
    ? selectedSpeaker.index
    : undefined;

  return (
    <Modal i18n={i18n} theme={Theme.Dark} onClose={toggleSettings}>
      <div className="module-calling-device-selection">
        <button
          type="button"
          className="module-calling-device-selection__close-button"
          onClick={toggleSettings}
          tabIndex={0}
          aria-label={i18n('close')}
        />
      </div>

      <h1 className="module-calling-device-selection__title">
        {i18n('callingDeviceSelection__settings')}
      </h1>

      <label htmlFor="video" className="module-calling-device-selection__label">
        {i18n('callingDeviceSelection__label--video')}
      </label>
      <div className="module-calling-device-selection__select">
        <select
          disabled={!availableCameras.length}
          name="video"
          onChange={createCameraChangeHandler(changeIODevice)}
          value={selectedCamera}
        >
          {renderVideoOptions(availableCameras, i18n, selectedCamera)}
        </select>
      </div>

      <label
        htmlFor="audio-input"
        className="module-calling-device-selection__label"
      >
        {i18n('callingDeviceSelection__label--audio-input')}
      </label>
      <div className="module-calling-device-selection__select">
        <select
          disabled={!availableMicrophones.length}
          name="audio-input"
          onChange={createAudioChangeHandler(
            availableMicrophones,
            changeIODevice,
            CallingDeviceType.MICROPHONE
          )}
          value={selectedMicrophoneIndex}
        >
          {renderAudioOptions(availableMicrophones, i18n, selectedMicrophone)}
        </select>
      </div>

      <label
        htmlFor="audio-output"
        className="module-calling-device-selection__label"
      >
        {i18n('callingDeviceSelection__label--audio-output')}
      </label>
      <div className="module-calling-device-selection__select">
        <select
          disabled={!availableSpeakers.length}
          name="audio-output"
          onChange={createAudioChangeHandler(
            availableSpeakers,
            changeIODevice,
            CallingDeviceType.SPEAKER
          )}
          value={selectedSpeakerIndex}
        >
          {renderAudioOptions(availableSpeakers, i18n, selectedSpeaker)}
        </select>
      </div>
    </Modal>
  );
};
