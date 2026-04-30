// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  WorkletMessageType,
  RendererMessageType,
} from '../types/AudioRecorder.std.ts';

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

// Unfortunately `context.audioWorklet.addModule` doesn't wait for top-level
// awaits to be resolved so we have to call `registerProcessor` immediately
// and let the import resolve later on.
const lame = (async () => {
  const result = await import('@signalapp/lame');

  result.init(sampleRate, BIT_RATE);

  return result;
})();

class Mp3Encoder
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  #isStopped = false;

  constructor() {
    super();

    this.port.onmessage = async ({ data }: { data: RendererMessageType }) => {
      if (data.type !== 'stop') {
        throw new Error('Unexpected message');
      }
      this.#isStopped = true;
      const { flush, getLametagFrame } = await lame;
      this.#sendChunk(flush());

      const lametagFrame = new Uint8Array(getLametagFrame());
      this.port.postMessage(
        {
          type: 'complete',
          lametagFrame: lametagFrame,
        } satisfies WorkletMessageType,
        [lametagFrame.buffer]
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
    if (channel != null) {
      void this.#encode(channel);
    }
    return true;
  }

  async #encode(channel: Float32Array<ArrayBuffer>): Promise<void> {
    const { encode } = await lame;
    this.#sendChunk(encode(channel));
  }

  #sendChunk(chunk: Uint8Array<ArrayBuffer>): void {
    const copy = new Uint8Array(chunk);
    this.port.postMessage(
      {
        type: 'chunk',
        chunk: copy,
      } satisfies WorkletMessageType,
      [copy.buffer]
    );
  }
}

registerProcessor('mp3-encoder', Mp3Encoder);
