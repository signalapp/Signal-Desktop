// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CallingDeviceSelection } from '../../components/CallingDeviceSelection.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import {
  getAvailableCameras,
  getAvailableMicrophones,
  getAvailableSpeakers,
  getSelectedCamera,
  getSelectedMicrophone,
  getSelectedSpeaker,
} from '../selectors/calling.std.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import {
  CallingDeviceType,
  type AudioDevicePref,
} from '../../types/Calling.std.ts';
import { drop } from '../../util/drop.std.ts';

export const SmartCallingDeviceSelection = memo(
  function SmartCallingDeviceSelection() {
    const i18n = useSelector(getIntl);
    const availableMicrophones = useSelector(getAvailableMicrophones);
    const selectedMicrophone = useSelector(getSelectedMicrophone);
    const availableSpeakers = useSelector(getAvailableSpeakers);
    const selectedSpeaker = useSelector(getSelectedSpeaker);
    const availableCameras = useSelector(getAvailableCameras);
    const selectedCamera = useSelector(getSelectedCamera);
    const { changeIODevice, toggleSettings } = useCallingActions();

    const handleClose = useCallback(() => {
      toggleSettings(false);
    }, [toggleSettings]);

    const handleSelectedCameraChange = useCallback(
      (selectedDevice: string) => {
        drop(
          changeIODevice({
            type: CallingDeviceType.CAMERA,
            selectedDevice,
          })
        );
      },
      [changeIODevice]
    );

    const handleSelectedMicrophoneChange = useCallback(
      (selectedDevice: AudioDevicePref) => {
        drop(
          changeIODevice({
            type: CallingDeviceType.MICROPHONE,
            selectedDevice,
          })
        );
      },
      [changeIODevice]
    );

    const handleSelectedSpeakerChange = useCallback(
      (selectedDevice: AudioDevicePref) => {
        drop(
          changeIODevice({
            type: CallingDeviceType.SPEAKER,
            selectedDevice,
          })
        );
      },
      [changeIODevice]
    );

    return (
      <CallingDeviceSelection
        i18n={i18n}
        onClose={handleClose}
        availableCameras={availableCameras}
        availableMicrophones={availableMicrophones}
        availableSpeakers={availableSpeakers}
        selectedCamera={selectedCamera}
        selectedMicrophone={selectedMicrophone}
        selectedSpeaker={selectedSpeaker}
        onSelectedCameraChange={handleSelectedCameraChange}
        onSelectedMicrophoneChange={handleSelectedMicrophoneChange}
        onSelectedSpeakerChange={handleSelectedSpeakerChange}
      />
    );
  }
);
