// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import { v4 as generateUuid } from 'uuid';

import type { ReadonlyDeep } from 'type-fest';
import * as log from '../../logging/log';
import type { InMemoryAttachmentDraftType } from '../../types/Attachment';
import { SignalService as Proto } from '../../protobuf';
import type { StateType as RootStateType } from '../reducer';
import { fileToBytes } from '../../util/fileToBytes';
import { recorder } from '../../services/audioRecorder';
import { stringToMIMEType } from '../../types/MIME';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import { getComposerStateForConversation } from './composer';

import * as Errors from '../../types/errors';
import {
  ErrorDialogAudioRecorderType,
  RecordingState,
} from '../../types/AudioRecorder';

// State

export type AudioRecorderStateType = ReadonlyDeep<{
  recordingState: RecordingState;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
}>;

// Actions

const CANCEL_RECORDING = 'audioRecorder/CANCEL_RECORDING';
const COMPLETE_RECORDING = 'audioRecorder/COMPLETE_RECORDING';
const ERROR_RECORDING = 'audioRecorder/ERROR_RECORDING';
const NOW_RECORDING = 'audioRecorder/NOW_RECORDING';
const START_RECORDING = 'audioRecorder/START_RECORDING';

type CancelRecordingAction = ReadonlyDeep<{
  type: typeof CANCEL_RECORDING;
  payload: undefined;
}>;
type CompleteRecordingAction = ReadonlyDeep<{
  type: typeof COMPLETE_RECORDING;
  payload: undefined;
}>;
type ErrorRecordingAction = ReadonlyDeep<{
  type: typeof ERROR_RECORDING;
  payload: ErrorDialogAudioRecorderType;
}>;
type StartRecordingAction = ReadonlyDeep<{
  type: typeof START_RECORDING;
  payload: undefined;
}>;
type NowRecordingAction = ReadonlyDeep<{
  type: typeof NOW_RECORDING;
  payload: undefined;
}>;

type AudioPlayerActionType = ReadonlyDeep<
  | CancelRecordingAction
  | CompleteRecordingAction
  | ErrorRecordingAction
  | NowRecordingAction
  | StartRecordingAction
>;

export function getIsRecording(audioRecorder: AudioRecorderStateType): boolean {
  return audioRecorder.recordingState === RecordingState.Recording;
}

// Action Creators

export const actions = {
  cancelRecording,
  completeRecording,
  errorRecording,
  startRecording,
};

export const useAudioRecorderActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function startRecording(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartRecordingAction | NowRecordingAction | ErrorRecordingAction
> {
  return async (dispatch, getState) => {
    const state = getState();

    if (
      getComposerStateForConversation(state.composer, conversationId)
        .attachments.length
    ) {
      return;
    }
    if (state.audioRecorder.recordingState !== RecordingState.Idle) {
      return;
    }

    dispatch({
      type: START_RECORDING,
      payload: undefined,
    });

    try {
      const started = await recorder.start();

      if (started) {
        dispatch({
          type: NOW_RECORDING,
          payload: undefined,
        });
      } else {
        dispatch({
          type: ERROR_RECORDING,
          payload: ErrorDialogAudioRecorderType.ErrorRecording,
        });
      }
    } catch (err) {
      log.error('AudioRecorder/ERROR_RECORDING', Errors.toLogFormat(err));
      dispatch({
        type: ERROR_RECORDING,
        payload: ErrorDialogAudioRecorderType.ErrorRecording,
      });
    }
  };
}

function completeRecordingAction(): CompleteRecordingAction {
  return {
    type: COMPLETE_RECORDING,
    payload: undefined,
  };
}

export function completeRecording(
  conversationId: string,
  onRecordingComplete: (rec: InMemoryAttachmentDraftType) => unknown
): ThunkAction<
  void,
  RootStateType,
  unknown,
  CancelRecordingAction | CompleteRecordingAction
> {
  return async (dispatch, getState) => {
    const state = getState();

    const isSelectedConversation =
      state.conversations.selectedConversationId === conversationId;

    if (!isSelectedConversation) {
      log.warn(
        'completeRecording: Recording started in one conversation and completed in another'
      );
      dispatch(cancelRecording());
      return;
    }

    const blob = await recorder.stop();

    try {
      if (!blob) {
        throw new Error('completeRecording: no blob returned');
      }
      const data = await fileToBytes(blob);

      const voiceNoteAttachment: InMemoryAttachmentDraftType = {
        pending: false,
        clientUuid: generateUuid(),
        contentType: stringToMIMEType(blob.type),
        data,
        size: data.byteLength,
        flags: Proto.AttachmentPointer.Flags.VOICE_MESSAGE,
      };

      onRecordingComplete(voiceNoteAttachment);
    } finally {
      dispatch(completeRecordingAction());
    }
  };
}

function cancelRecording(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CancelRecordingAction
> {
  return async dispatch => {
    await recorder.stop();
    recorder.clear();

    dispatch({
      type: CANCEL_RECORDING,
      payload: undefined,
    });
  };
}

function errorRecording(
  errorDialogAudioRecorderType: ErrorDialogAudioRecorderType
): ErrorRecordingAction {
  void recorder.stop();

  return {
    type: ERROR_RECORDING,
    payload: errorDialogAudioRecorderType,
  };
}

// Reducer

export function getEmptyState(): AudioRecorderStateType {
  return {
    recordingState: RecordingState.Idle,
  };
}

export function reducer(
  state: Readonly<AudioRecorderStateType> = getEmptyState(),
  action: Readonly<AudioPlayerActionType>
): AudioRecorderStateType {
  if (action.type === START_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      recordingState: RecordingState.Initializing,
    };
  }

  if (action.type === NOW_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      recordingState: RecordingState.Recording,
    };
  }

  if (action.type === CANCEL_RECORDING || action.type === COMPLETE_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      recordingState: RecordingState.Idle,
    };
  }

  if (action.type === ERROR_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: action.payload,
    };
  }

  return state;
}
