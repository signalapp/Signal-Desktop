// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useMemo, type ReactNode } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import { AxoSelectItem } from '../axo/items/AxoSelectItem.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import type { AudioDeviceList } from '@signalapp/ringrtc';
import { findBestMatchingCameraId } from '../calling/findBestMatchingDevice.std.ts';
import type {
  DefaultPref,
  AudioDevicePref,
  MediaDeviceSettingsRenderProps,
} from '../types/Calling.std.ts';
import {
  audioDevicePrefStrToAudioDevicePref,
  audioDevicePrefToId,
} from '../types/Calling.std.ts';

function renderAudioOptions(
  i18n: LocalizerType,
  devices: AudioDeviceList
): ReadonlyArray<AxoSelectItem.Option> {
  const options: Array<AxoSelectItem.Option> = [];

  if (devices.defaults.isWindows) {
    if (devices.defaults.communicationsDevice != null) {
      options.push({
        label: i18n(
          'icu:callingDeviceSelection__select--default_communications',
          {
            deviceName: devices.defaults.communicationsDevice.name,
          }
        ),
        value: 'windowsCommunications' satisfies DefaultPref['type'],
      });
    }
    if (devices.defaults.consoleDevice != null) {
      options.push({
        label: i18n('icu:callingDeviceSelection__select--default_console', {
          deviceName: devices.defaults.consoleDevice.name,
        }),
        value: 'windowsConsole' satisfies DefaultPref['type'],
      });
    }
  } else if (devices.defaults.device != null) {
    options.push({
      label: i18n('icu:callingDeviceSelection__select--default-nonwin', {
        deviceName: devices.defaults.device.name,
      }),
      value: 'nonWindowsDefault' satisfies DefaultPref['type'],
    });
  }

  for (const device of devices.devices) {
    options.push({
      label: device.name,
      value: device.uniqueId,
    });
  }

  return options;
}

function getMatchingVideoValue(
  options: ReadonlyArray<AxoSelectItem.Option>,
  value: string | null
): string | null {
  const hasMatch = options.some(option => {
    return option.value === value;
  });
  return hasMatch ? value : null;
}

function getMatchingAudioValue(
  options: ReadonlyArray<AxoSelectItem.Option>,
  value: string | null
): string | null {
  const available = new Set(options.map(option => option.value));
  if (value != null && available.has(value)) {
    return value;
  }

  const candidates: Array<DefaultPref['type']> = [
    'nonWindowsDefault',

    // Prefer `communications` over `console` on Windows
    'windowsCommunications',
    'windowsConsole',
  ];
  for (const fallback of candidates) {
    if (available.has(fallback)) {
      return fallback;
    }
  }

  return null;
}

export type CallingDeviceSelectionItemsProps = Readonly<
  MediaDeviceSettingsRenderProps & {
    i18n: LocalizerType;
    forceStackedLayout: boolean;
    onSelectedCameraChange: (value: string) => void;
    onSelectedMicrophoneChange: (value: AudioDevicePref) => void;
    onSelectedSpeakerChange: (value: AudioDevicePref) => void;
  }
>;

export function CallingDeviceSelectionItems(
  props: CallingDeviceSelectionItemsProps
): ReactNode {
  const {
    i18n,
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    onSelectedCameraChange,
    onSelectedMicrophoneChange,
    onSelectedSpeakerChange,
  } = props;

  // See ts/calling/findBestMatchingDevice.std.ts
  const fallbackCamera = useMemo(() => {
    return findBestMatchingCameraId({
      available: availableCameras,
      preferred: null,
    });
  }, [availableCameras]);

  const data = useMemo(() => {
    const cameraOptions = availableCameras.map(camera => {
      return {
        label: camera.label,
        value: camera.deviceId,
      };
    });

    const microphoneOptions = renderAudioOptions(i18n, availableMicrophones);
    const speakerOptions = renderAudioOptions(i18n, availableSpeakers);

    const hasCameras = cameraOptions.length !== 0;
    const hasMicrophones = microphoneOptions.length !== 0;
    const hasSpeakers = speakerOptions.length !== 0;

    const cameraValue =
      getMatchingVideoValue(cameraOptions, selectedCamera ?? null) ??
      fallbackCamera;
    const microphoneValue = getMatchingAudioValue(
      microphoneOptions,
      audioDevicePrefToId(selectedMicrophone)
    );
    const speakerValue = getMatchingAudioValue(
      speakerOptions,
      audioDevicePrefToId(selectedSpeaker)
    );

    return {
      hasCameras,
      hasMicrophones,
      hasSpeakers,
      cameraValue,
      microphoneValue,
      speakerValue,
      cameraOptions,
      microphoneOptions,
      speakerOptions,
    };
  }, [
    i18n,
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
    fallbackCamera,
  ]);

  const handleChangeMicrophone = useCallback(
    (value: string) => {
      const match = audioDevicePrefStrToAudioDevicePref(
        value,
        availableMicrophones
      );
      strictAssert(match, 'Missing match');
      onSelectedMicrophoneChange(match);
    },
    [onSelectedMicrophoneChange, availableMicrophones]
  );

  const handleChangeSpeaker = useCallback(
    (value: string) => {
      const match = audioDevicePrefStrToAudioDevicePref(
        value,
        availableSpeakers
      );
      strictAssert(match, 'Missing match');
      onSelectedSpeakerChange(match);
    },
    [onSelectedSpeakerChange, availableSpeakers]
  );

  return (
    <>
      <AxoSelectItem.Root
        forceStackedLayout={props.forceStackedLayout}
        label={i18n('icu:callingDeviceSelection__label--video')}
        disabled={!data.hasCameras}
        value={data.cameraValue}
        onValueChange={onSelectedCameraChange}
        placeholder={
          !data.hasCameras
            ? i18n('icu:callingDeviceSelection__select--no-device')
            : null
        }
        options={data.cameraOptions}
      />

      <AxoSelectItem.Root
        forceStackedLayout={props.forceStackedLayout}
        label={i18n('icu:callingDeviceSelection__label--audio-input')}
        disabled={!data.hasMicrophones}
        value={data.microphoneValue}
        onValueChange={handleChangeMicrophone}
        placeholder={
          !data.hasMicrophones
            ? i18n('icu:callingDeviceSelection__select--no-device')
            : null
        }
        options={data.microphoneOptions}
      />

      <AxoSelectItem.Root
        forceStackedLayout={props.forceStackedLayout}
        label={i18n('icu:callingDeviceSelection__label--audio-output')}
        disabled={!data.hasSpeakers}
        value={data.speakerValue}
        onValueChange={handleChangeSpeaker}
        placeholder={
          !data.hasSpeakers
            ? i18n('icu:callingDeviceSelection__select--no-device')
            : null
        }
        options={data.speakerOptions}
      />
    </>
  );
}
