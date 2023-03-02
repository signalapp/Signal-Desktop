// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum ErrorDialogAudioRecorderType {
  ErrorRecording,
  Timeout,
}

export enum RecordingState {
  Recording = 'recording',
  Initializing = 'initializing',
  Idle = 'idle',
}
