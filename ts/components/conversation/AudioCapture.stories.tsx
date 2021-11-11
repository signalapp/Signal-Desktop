// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
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

const story = storiesOf('Components/Conversation/AudioCapture', module);

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

story.add('Default', () => {
  return <AudioCapture {...createProps()} />;
});

story.add('Initializing', () => {
  return (
    <AudioCapture
      {...createProps({
        recordingState: RecordingState.Initializing,
      })}
    />
  );
});

story.add('Recording', () => {
  return (
    <AudioCapture
      {...createProps({
        recordingState: RecordingState.Recording,
      })}
    />
  );
});

story.add('Voice Limit', () => {
  return (
    <AudioCapture
      {...createProps({
        errorDialogAudioRecorderType: ErrorDialogAudioRecorderType.Timeout,
        recordingState: RecordingState.Recording,
      })}
    />
  );
});

story.add('Switched Apps', () => {
  return (
    <AudioCapture
      {...createProps({
        errorDialogAudioRecorderType: ErrorDialogAudioRecorderType.Blur,
        recordingState: RecordingState.Recording,
      })}
    />
  );
});
