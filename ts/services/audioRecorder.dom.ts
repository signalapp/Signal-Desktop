// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions.dom.ts';
import type { WorkletMessageType } from '../types/AudioRecorder.std.ts';
import * as Bytes from '../Bytes.std.ts';

const log = createLogger('audioRecorder');

let contextPromise: Promise<AudioContext> | undefined;

async function initContext(): Promise<AudioContext> {
  const context = new AudioContext();
  await context.audioWorklet.addModule('bundles/workers/mp3Encoder.js');
  return context;
}

type State = Readonly<
  | {
      type: 'idle';
    }
  | {
      type: 'initializing';
    }
  | {
      type: 'running';
      source: MediaStreamAudioSourceNode;
      promise: Promise<Uint8Array<ArrayBuffer>>;
      worklet: AudioWorkletNode;
    }
>;

export class AudioRecorder {
  #state: State = { type: 'idle' };

  static async warmup(): Promise<void> {
    if (contextPromise == null) {
      contextPromise = initContext();
    }
    await contextPromise;
  }

  async start(onPeak: (peak: number) => void): Promise<boolean> {
    if (this.#state.type !== 'idle') {
      throw new Error('Already started');
    }

    this.#state = { type: 'initializing' };

    const hasMicrophonePermission = await requestMicrophonePermissions(false);
    if (!hasMicrophonePermission) {
      log.info(
        'Recorder/start: Microphone permission was denied, new audio recording not allowed.'
      );
      this.#state = { type: 'idle' };
      return false;
    }

    // oxlint-disable-next-line typescript/await-thenable
    await window.reduxActions.globalModals.ensureSystemMediaPermissions(
      'microphone',
      'voiceNote'
    );

    // Cache global context so that we don't have to initialize worker twice
    if (contextPromise == null) {
      contextPromise = initContext();
    }
    const context = await contextPromise;

    const worklet = new AudioWorkletNode(context, 'mp3-encoder', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
    });

    const { promise, resolve } =
      Promise.withResolvers<Uint8Array<ArrayBuffer>>();
    const chunks = new Array<Uint8Array<ArrayBuffer>>();
    worklet.port.onmessage = ({ data }: { data: WorkletMessageType }) => {
      if (data.type === 'chunk') {
        chunks.push(data.chunk);
        return;
      }
      if (data.type === 'complete') {
        this.#state = { type: 'idle' };
        chunks.push(data.finalFrame);

        const result = Bytes.concatenate(chunks);

        // Replace the original placeholder header with the one that has
        // full audio duration (necessary for VBR encoding).
        result.set(data.lametagFrame);

        resolve(result);
        return;
      }
      if (data.type === 'peak') {
        onPeak(data.peak);
        return;
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
      },
    });

    const source = context.createMediaStreamSource(stream);
    source.connect(worklet);

    this.#state = {
      type: 'running',
      source,
      promise,
      worklet,
    };

    return true;
  }

  async stop(): Promise<Uint8Array<ArrayBuffer> | undefined> {
    if (this.#state.type !== 'running') {
      return undefined;
    }

    this.#state.worklet.port.postMessage({
      type: 'stop',
    });

    // This terminates microphone access
    this.#state.source.mediaStream.getTracks().forEach(track => track.stop());
    this.#state.source.disconnect();

    return this.#state.promise;
  }
}
