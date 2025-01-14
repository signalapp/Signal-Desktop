// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions';
import { WebAudioRecorder } from '../WebAudioRecorder';

export class RecorderClass {
  #context?: AudioContext;
  #input?: GainNode;
  #recorder?: WebAudioRecorder;
  #source?: MediaStreamAudioSourceNode;
  #stream?: MediaStream;
  #blob?: Blob;
  #resolve?: (blob: Blob) => void;

  clear(): void {
    this.#blob = undefined;
    this.#resolve = undefined;

    if (this.#source) {
      this.#source.disconnect();
      this.#source = undefined;
    }

    if (this.#recorder) {
      if (this.#recorder.isRecording()) {
        this.#recorder.cancelRecording();
      }

      // Reach in and terminate the web worker used by WebAudioRecorder, otherwise
      // it gets leaked due to a reference cycle with its onmessage listener
      this.#recorder.worker?.terminate();
      this.#recorder = undefined;
    }

    this.#input = undefined;
    this.#stream = undefined;

    if (this.#context) {
      void this.#context.close();
      this.#context = undefined;
    }
  }

  async start(): Promise<boolean> {
    const hasMicrophonePermission = await requestMicrophonePermissions(false);
    if (!hasMicrophonePermission) {
      log.info(
        'Recorder/start: Microphone permission was denied, new audio recording not allowed.'
      );
      return false;
    }

    this.clear();

    this.#context = new AudioContext();
    this.#input = this.#context.createGain();

    this.#recorder = new WebAudioRecorder(
      this.#input,
      {
        timeLimit: 60 + 3600, // one minute more than our UI-imposed limit
      },
      {
        onComplete: this.onComplete.bind(this),
        onError: this.onError.bind(this),
      }
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // TypeScript doesn't know about these options.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audio: { mandatory: { googAutoGainControl: false } } as any,
      });

      if (!this.#context || !this.#input) {
        const err = new Error(
          'Recorder/getUserMedia/stream: Missing context or input!'
        );
        this.onError(this.#recorder, String(err));
        throw err;
      }
      this.#source = this.#context.createMediaStreamSource(stream);
      this.#source.connect(this.#input);
      this.#stream = stream;
    } catch (err) {
      log.error('Recorder.onGetUserMediaError:', Errors.toLogFormat(err));
      this.clear();
      throw err;
    }

    if (this.#recorder) {
      this.#recorder.startRecording();
      return true;
    }

    return false;
  }

  async stop(): Promise<Blob | undefined> {
    if (!this.#recorder) {
      return;
    }

    if (this.#stream) {
      this.#stream.getTracks().forEach(track => track.stop());
    }

    if (this.#blob) {
      return this.#blob;
    }

    const promise = new Promise<Blob>(resolve => {
      this.#resolve = resolve;
    });

    this.#recorder.finishRecording();

    return promise;
  }

  onComplete(_recorder: WebAudioRecorder, blob: Blob): void {
    this.#blob = blob;
    this.#resolve?.(blob);
  }

  onError(_recorder: WebAudioRecorder, error: string): void {
    if (!this.#recorder) {
      log.warn('Recorder/onError: Called with no recorder');
      return;
    }

    this.clear();

    log.error('Recorder/onError:', Errors.toLogFormat(error));
  }

  getBlob(): Blob {
    if (!this.#blob) {
      throw new Error('no blob found');
    }

    return this.#blob;
  }
}

export const recorder = new RecorderClass();
