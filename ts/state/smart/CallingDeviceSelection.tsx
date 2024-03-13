// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { CallingDeviceSelection } from '../../components/CallingDeviceSelection';
import { getIntl } from '../selectors/user';
import {
  getAvailableCameras,
  getAvailableMicrophones,
  getAvailableSpeakers,
  getSelectedCamera,
  getSelectedMicrophone,
  getSelectedSpeaker,
} from '../selectors/calling';
import { useCallingActions } from '../ducks/calling';

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
    return (
      <CallingDeviceSelection
        availableCameras={availableCameras}
        availableMicrophones={availableMicrophones}
        availableSpeakers={availableSpeakers}
        changeIODevice={changeIODevice}
        i18n={i18n}
        selectedCamera={selectedCamera}
        selectedMicrophone={selectedMicrophone}
        selectedSpeaker={selectedSpeaker}
        toggleSettings={toggleSettings}
      />
    );
  }
);
