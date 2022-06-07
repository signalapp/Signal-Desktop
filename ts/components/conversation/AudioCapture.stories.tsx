// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';

import {
  ErrorDialogAudioRecorderType,
  RecordingState,
} from '../../state/ducks/audioRecorder';
import type { PropsType } from './AudioCapture';
import { AudioCapture } from './AudioCapture';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/AudioCapture',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  cancelRecording: action('cancelRecording'),
  completeRecording: action('completeRecording'),
  conversationId: '123',
  draftAttachments: [],
  errorDialogAudioRecorderType: overrideProps.errorDialogAudioRecorderType,
  errorRecording: action('errorRecording'),
  i18n,
  recordingState: select(
    'recordingState',
    RecordingState,
    overrideProps.recordingState || RecordingState.Idle
  ),
  onSendAudioRecording: action('onSendAudioRecording'),
  startRecording: action('startRecording'),
});

export const Default = (): JSX.Element => {
  return <AudioCapture {...createProps()} />;
};

export const _Initializing = (): JSX.Element => {
  return (
    <AudioCapture
      {...createProps({
        recordingState: RecordingState.Initializing,
      })}
    />
  );
};

export const _Recording = (): JSX.Element => {
  return (
    <AudioCapture
      {...createProps({
        recordingState: RecordingState.Recording,
      })}
    />
  );
};

export const VoiceLimit = (): JSX.Element => {
  return (
    <AudioCapture
      {...createProps({
        errorDialogAudioRecorderType: ErrorDialogAudioRecorderType.Timeout,
        recordingState: RecordingState.Recording,
      })}
    />
  );
};

export const SwitchedApps = (): JSX.Element => {
  return (
    <AudioCapture
      {...createProps({
        errorDialogAudioRecorderType: ErrorDialogAudioRecorderType.Blur,
        recordingState: RecordingState.Recording,
      })}
    />
  );
};
