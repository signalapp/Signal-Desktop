// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  WorkletMessageType,
  RendererMessageType,
} from '../types/AudioRecorder.std.ts';
import { Encoder } from '@signalapp/lame';
import { WaveformBuilder, toPeak } from '../util/waveformBuilder.std.ts';
import { DurationInSeconds } from '../util/durations/index.std.ts';

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

  #totalSamples = 0;
  readonly #waveform = new WaveformBuilder();

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
          waveform: this.#waveform.collect(),
          duration: DurationInSeconds.fromSeconds(
            this.#totalSamples / sampleRate
          ),
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
      this.#totalSamples += 1;
      this.#streamPeaks(sample);
      this.#waveform.push(sample);
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

  #streamPeaks(sample: number): void {
    this.#peakSquares += sample ** 2;
    this.#peakSamples += 1;
    if (this.#peakSamples < PEAK_EVERY) {
      return;
    }

    const meanSquare = this.#peakSquares / this.#peakSamples;
    this.#peakSquares = 0;
    this.#peakSamples = 0;

    const peak = toPeak(meanSquare);
    this.port.postMessage({
      type: 'peak',
      peak,
    } satisfies WorkletMessageType);
  }
}

registerProcessor('mp3-encoder', Mp3Encoder);
