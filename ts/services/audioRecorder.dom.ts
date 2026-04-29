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

  async start(): Promise<boolean> {
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
        resolve(Bytes.concatenate(chunks));
        return;
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      // TypeScript doesn't know about these options.
      // oxlint-disable-next-line typescript/no-explicit-any
      audio: { mandatory: { googAutoGainControl: false } } as any,
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
