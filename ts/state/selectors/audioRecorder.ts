// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer';
import type { AudioRecorderStateType } from '../ducks/audioRecorder';

export function getAudioRecorder(state: StateType): AudioRecorderStateType {
  return state.audioRecorder;
}

export const getErrorDialogAudioRecorderType = createSelector(
  getAudioRecorder,
  audioRecorder => {
    return audioRecorder.errorDialogAudioRecorderType;
  }
);

export const getRecordingState = createSelector(
  getAudioRecorder,
  audioRecorder => {
    return audioRecorder.recordingState;
  }
);
