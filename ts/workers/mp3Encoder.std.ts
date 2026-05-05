// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  WorkletMessageType,
  RendererMessageType,
} from '../types/AudioRecorder.std.ts';
import { Encoder } from '@signalapp/lame';

declare const sampleRate: number;

type AudioWorkletProcessor = Readonly<{
  port: MessagePort;
}>;

declare const AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (): AudioWorkletProcessor;
};

type AudioWorkletProcessorImpl = Readonly<{
  process(inputs: Array<Array<Float32Array<ArrayBuffer>>>): boolean;
}> &
  AudioWorkletProcessor;

type AudioWorkletProcessorConstructor = Readonly<{
  new (): AudioWorkletProcessorImpl;
}>;

declare function registerProcessor(
  name: string,
  processorCtor: AudioWorkletProcessorConstructor
): void;

const BIT_RATE = 90;
const Q = 7;

class Mp3Encoder
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  #isStopped = false;
  readonly #encoder = new Encoder({
    q: Q,
    sampleRate,
    bitRate: BIT_RATE,
  });

  constructor() {
    super();

    this.port.onmessage = ({ data }: { data: RendererMessageType }) => {
      if (data.type !== 'stop') {
        throw new Error('Unexpected message');
      }
      if (this.#isStopped) {
        throw new Error('Already stopped');
      }
      this.#isStopped = true;

      const chunk = new Uint8Array(this.#encoder.flush());

      const lametagFrame = new Uint8Array(this.#encoder.getLametagFrame());
      this.port.postMessage(
        {
          type: 'complete',
          lametagFrame: lametagFrame,
          finalFrame: chunk,
        } satisfies WorkletMessageType,
        [lametagFrame.buffer, chunk.buffer]
      );
    };
  }

  process(inputs: Array<Array<Float32Array<ArrayBuffer>>>): boolean {
    if (this.#isStopped) {
      return false;
    }

    const [input] = inputs;
    if (input == null) {
      throw new Error(`Invalid input count: ${inputs.length}`);
    }

    const [channel] = input;
    if (channel == null) {
      return true;
    }

    const shared = this.#encoder.encode(channel);
    if (shared.length === 0) {
      return true;
    }

    const copy = new Uint8Array(shared);
    this.port.postMessage(
      {
        type: 'chunk',
        chunk: copy,
      } satisfies WorkletMessageType,
      [copy.buffer]
    );
    return true;
  }
}

registerProcessor('mp3-encoder', Mp3Encoder);
