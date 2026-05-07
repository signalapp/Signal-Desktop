// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import { v4 as generateUuid } from 'uuid';

import type { ReadonlyDeep } from 'type-fest';
import { createLogger } from '../../logging/log.std.ts';
import type { InMemoryAttachmentDraftType } from '../../types/Attachment.std.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import { drop } from '../../util/drop.std.ts';
import { AudioRecorder } from '../../services/audioRecorder.dom.ts';
import { AUDIO_MPEG } from '../../types/MIME.std.ts';
import type { PeakType } from '../../types/Audio.dom.tsx';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { getComposerStateForConversation } from './composer.preload.ts';

import * as Errors from '../../types/errors.std.ts';
import {
  ErrorDialogAudioRecorderType,
  RecordingState,
} from '../../types/AudioRecorder.std.ts';
import { getSelectedConversationId } from '../selectors/nav.std.ts';

const log = createLogger('audioRecorder');
const MAX_PEAKS = 200;

let recorder: AudioRecorder | undefined;
let lastPeakIndex = 0;

// State

export type AudioRecorderStateType = ReadonlyDeep<{
  recordingState: RecordingState;
  peaks: Array<PeakType>;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
}>;

// Actions

const CANCEL_RECORDING = 'audioRecorder/CANCEL_RECORDING';
const COMPLETE_RECORDING = 'audioRecorder/COMPLETE_RECORDING';
const ERROR_RECORDING = 'audioRecorder/ERROR_RECORDING';
const NOW_RECORDING = 'audioRecorder/NOW_RECORDING';
const START_RECORDING = 'audioRecorder/START_RECORDING';
const PEAK = 'audioRecorder/PEAK';

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
type PeakAction = ReadonlyDeep<{
  type: typeof PEAK;
  payload: number;
}>;

type AudioPlayerActionType = ReadonlyDeep<
  | CancelRecordingAction
  | CompleteRecordingAction
  | ErrorRecordingAction
  | NowRecordingAction
  | StartRecordingAction
  | PeakAction
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
  warmupRecording,
};

export const useAudioRecorderActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function warmupRecording(): ThunkAction<void, RootStateType, unknown, never> {
  return async () => {
    drop(AudioRecorder.warmup());
  };
}

function startRecording(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  StartRecordingAction | NowRecordingAction | PeakAction | ErrorRecordingAction
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

    drop(recorder?.stop());
    recorder = new AudioRecorder();

    dispatch({
      type: START_RECORDING,
      payload: undefined,
    });

    try {
      const started = await recorder.start(peak => {
        dispatch({
          type: PEAK,
          payload: peak,
        });
      });

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
      log.error('ERROR_RECORDING', Errors.toLogFormat(err));
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

    if (getSelectedConversationId(state) !== conversationId) {
      log.warn(
        'completeRecording: Recording started in conversation then user switched away'
      );
    }

    const data = await recorder?.stop();
    recorder = undefined;

    try {
      if (!data) {
        throw new Error('completeRecording: no data returned');
      }

      const voiceNoteAttachment: InMemoryAttachmentDraftType = {
        pending: false,
        clientUuid: generateUuid(),
        contentType: AUDIO_MPEG,
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
    await recorder?.stop();

    dispatch({
      type: CANCEL_RECORDING,
      payload: undefined,
    });
  };
}

function errorRecording(
  errorDialogAudioRecorderType: ErrorDialogAudioRecorderType
): ErrorRecordingAction {
  drop(recorder?.stop());

  return {
    type: ERROR_RECORDING,
    payload: errorDialogAudioRecorderType,
  };
}

// Reducer

export function getEmptyState(): AudioRecorderStateType {
  return {
    recordingState: RecordingState.Idle,
    peaks: [],
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
      peaks: [],
    };
  }

  if (action.type === CANCEL_RECORDING || action.type === COMPLETE_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: undefined,
      recordingState: RecordingState.Idle,
      peaks: [],
    };
  }

  if (action.type === ERROR_RECORDING) {
    return {
      ...state,
      errorDialogAudioRecorderType: action.payload,
      peaks: [],
    };
  }

  if (action.type === PEAK) {
    lastPeakIndex += 1;
    // Wrap uint32
    // oxlint-disable-next-line no-bitwise
    lastPeakIndex >>>= 0;
    return {
      ...state,
      peaks: state.peaks.slice(-MAX_PEAKS + 1).concat({
        value: action.payload,
        index: lastPeakIndex,
      }),
    };
  }

  return state;
}
