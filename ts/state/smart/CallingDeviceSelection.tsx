// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { CallingDeviceSelection } from '../../components/CallingDeviceSelection';
import type { StateType } from '../reducer';

import { getIntl } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  const {
    availableMicrophones,
    availableSpeakers,
    selectedMicrophone,
    selectedSpeaker,
    availableCameras,
    selectedCamera,
  } = state.calling;

  return {
    availableCameras,
    availableMicrophones,
    availableSpeakers,
    i18n: getIntl(state),
    selectedCamera,
    selectedMicrophone,
    selectedSpeaker,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartCallingDeviceSelection = smart(CallingDeviceSelection);
