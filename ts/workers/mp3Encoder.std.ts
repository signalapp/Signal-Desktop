// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  WorkletMessageType,
  RendererMessageType,
} from '../types/AudioRecorder.std.ts';
import { Encoder } from '../../components/mp3lameencoder/lib/Mp3LameEncoder.std.mjs';

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

const BIT_RATE = 128;

class Mp3Encoder
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  readonly #encoder: Encoder;

  constructor() {
    super();

    this.#encoder = new Encoder(sampleRate, BIT_RATE);
    this.#encoder.ondata = chunk => {
      this.port.postMessage(
        {
          type: 'chunk',
          chunk,
        } satisfies WorkletMessageType,
        [chunk.buffer]
      );
    };

    this.port.onmessage = ({ data }: { data: RendererMessageType }) => {
      if (data.type !== 'stop') {
        throw new Error('Unexpected message');
      }
      this.#encoder.finish();
      this.port.postMessage({
        type: 'complete',
      } satisfies WorkletMessageType);
    };
  }

  process(inputs: Array<Array<Float32Array<ArrayBuffer>>>): boolean {
    const [input] = inputs;
    if (input == null) {
      throw new Error(`Invalid input count: ${inputs.length}`);
    }

    if (input.length > 0) {
      this.#encoder.encode(input);
    }
    return true;
  }
}

registerProcessor('mp3-encoder', Mp3Encoder);
