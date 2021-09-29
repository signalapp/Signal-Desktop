// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ThunkAction } from 'redux-thunk';

import * as log from '../../logging/log';
import { AttachmentType } from '../../types/Attachment';
import { SignalService as Proto } from '../../protobuf';
import { StateType as RootStateType } from '../reducer';
import { fileToBytes } from '../../util/fileToBytes';
import { recorder } from '../../services/audioRecorder';
import { stringToMIMEType } from '../../types/MIME';
import { useBoundActions } from '../../hooks/useBoundActions';

export enum ErrorDialogAudioRecorderType {
  Blur,
  Timeout,
}

// State

export type AudioPlayerStateType = {
  readonly isRecording: boolean;
  readonly errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
};

// Actions

const CANCEL_RECORDING = 'audioRecorder/CANCEL_RECORDING';
const COMPLETE_RECORDING = 'audioRecorder/COMPLETE_RECORDING';
const ERROR_RECORDING = 'audioRecorder/ERROR_RECORDING';
const START_RECORDING = 'audioRecorder/START_RECORDING';

type CancelRecordingAction = {
  type: typeof CANCEL_RECORDING;
  payload: undefined;
};
type CompleteRecordingAction = {
  type: typeof COMPLETE_RECORDING;
  payload: undefined;
};
type ErrorRecordingAction = {
  type: typeof ERROR_RECORDING;
  payload: ErrorDialogAudioRecorderType;
};
type StartRecordingAction = {
  type: typeof START_RECORDING;
  payload: undefined;
};

type AudioPlayerActionType =
  | CancelRecordingAction
  | CompleteRecordingAction
  | ErrorRecordingAction
  | StartRecordingAction;

// Action Creators

export const actions = {
  cancelRecording,
  completeRecording,
  errorRecording,
  startRecording,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function startRecording(): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartRecordingAction
> {
  return (dispatch, getState) => {
    if (getState().composer.attachments.length) {
      return;
    }

    recorder.start();

    dispatch({
      type: START_RECORDING,
      payload: undefined,
    });
  };
}

function completeRecordingAction(): CompleteRecordingAction {
  return {
    type: COMPLETE_RECORDING,
    payload: undefined,
  };
}

function completeRecording(
  conversationId: string,
  onSendAudioRecording?: (rec: AttachmentType) => unknown
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

      const voiceNoteAttachment = {
        contentType: stringToMIMEType(blob.type),
        data,
        size: data.byteLength,
        flags: Proto.AttachmentPointer.Flags.VOICE_MESSAGE,
      };

      if (onSendAudioRecording) {
        onSendAudioRecording(voiceNoteAttachment);
      }
    } finally {
      dispatch(completeRecordingAction());
    }
  };
}

function cancelRecording(): CancelRecordingAction {
  recorder.clear();

  return {
    type: CANCEL_RECORDING,
    payload: undefined,
  };
}

function errorRecording(
  errorDialogAudioRecorderType: ErrorDialogAudioRecorderType
): ErrorRecordingAction {
  recorder.stop();

  return {
    type: ERROR_RECORDING,
    payload: errorDialogAudioRecorderType,
  };
}

// Reducer

function getEmptyState(): AudioPlayerStateType {
  return {
    isRecording: false,
  };
}

export function reducer(
  state: Readonly<AudioPlayerStateType> = getEmptyState(),
  action: Readonly<AudioPlayerActionType>
): AudioPlayerStateType {
  if (action.type === START_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      isRecording: true,
    };
  }

  if (action.type === CANCEL_RECORDING || action.type === COMPLETE_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      isRecording: false,
    };
  }

  if (action.type === ERROR_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: action.payload,
      isRecording: false,
    };
  }

  return state;
}
