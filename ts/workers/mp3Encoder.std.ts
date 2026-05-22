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
  process: (inputs: Array<Array<Float32Array<ArrayBuffer>>>) => boolean;
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

// Produce a peak value every 100 milliseconds
const PEAK_EVERY_S = 0.1;
const PEAK_EVERY = Math.round(sampleRate * PEAK_EVERY_S);

// Compute maximum peak over last 5 seconds
const WINDOW_SIZE = Math.round(5 / PEAK_EVERY_S);

const MAX_DECAY = 0.8;

class Mp3Encoder
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  readonly #encoder = new Encoder({
    q: Q,
    sampleRate,
    bitRate: BIT_RATE,
  });
  #isStopped = false;
  #peakSquares = 0;
  #peakSamples = 0;
  #window = new Array<number>();
  #windowOffset = 0;
  #previousMax = 1;

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
          lametagFrame,
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

    for (const sample of channel) {
      this.#peakSquares += sample ** 2;
      this.#peakSamples += 1;
      if (this.#peakSamples < PEAK_EVERY) {
        continue;
      }

      const peak = Math.min(
        1,
        Math.max(0, Math.sqrt(this.#peakSquares / this.#peakSamples))
      );
      this.#window[this.#windowOffset] = peak;
      this.#windowOffset = (this.#windowOffset + 1) % WINDOW_SIZE;

      let max = 1e-23;
      for (const oldPeak of this.#window) {
        max = Math.max(max, oldPeak);
      }

      this.#previousMax *= MAX_DECAY;
      if (this.#previousMax < max) {
        this.#previousMax = max;
      } else {
        max = this.#previousMax;
      }

      this.#peakSquares = 0;
      this.#peakSamples = 0;

      this.port.postMessage({
        type: 'peak',
        peak: peak / max,
      } satisfies WorkletMessageType);
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
