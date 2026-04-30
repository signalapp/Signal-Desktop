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

// Sent by `ts/workers/mp3Encoder.std.ts`
export type WorkletMessageType = Readonly<
  | {
      type: 'chunk';
      chunk: Uint8Array<ArrayBuffer>;
    }
  | {
      type: 'complete';
      lametagFrame: Uint8Array<ArrayBuffer>;
    }
>;

// Sent by `ts/services/audioRecorder.dom.ts`
export type RendererMessageType = Readonly<{
  type: 'stop';
}>;
