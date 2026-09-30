// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// See `protos/SignalService.proto`, `audioWaveform` field
const MAX_WAVEFORM_SIZE = 100;

// oxlint-disable-next-line no-bitwise
const HALF_SIZE = MAX_WAVEFORM_SIZE >>> 1;

export class WaveformBuilder {
  readonly #waveform = new Float64Array(MAX_WAVEFORM_SIZE);
  readonly #secondHalf = this.#waveform.subarray(HALF_SIZE);
  #length = 0;
  #shift = 0;

  public push(sample: number): void {
    // oxlint-disable-next-line no-bitwise
    let index = this.#length >>> this.#shift;

    // Compact waveform
    if (index >= MAX_WAVEFORM_SIZE) {
      for (let i = 0; i < HALF_SIZE; i += 1) {
        const left = this.#waveform[i * 2];
        const right = this.#waveform[i * 2 + 1];
        if (left === undefined || right === undefined) {
          throw new Error('OOB');
        }

        const avg = (left + right) / 2;
        this.#waveform[i] = avg;
      }

      this.#secondHalf.fill(0);

      this.#shift += 1;
      index = HALF_SIZE;
    }

    const current = this.#waveform[index];
    if (current === undefined) {
      throw new Error('OOB');
    }
    // oxlint-disable-next-line no-bitwise
    this.#waveform[index] = current + sample ** 2 / (1 << this.#shift);
    this.#length += 1;
  }

  public collect(): Array<number> {
    // oxlint-disable-next-line no-bitwise
    let length = this.#length >>> this.#shift;

    // Normalize last sample if it is incomplete
    // oxlint-disable-next-line no-bitwise
    const lastSamples = this.#length % (1 << this.#shift);
    if (lastSamples !== 0) {
      const last = this.#waveform[length];
      if (last === undefined) {
        throw new Error('OOB');
      }
      // oxlint-disable-next-line no-bitwise
      this.#waveform[length] = (last * (1 << this.#shift)) / lastSamples;
      length += 1;
    }

    const result = new Array<number>(length);
    for (let i = 0; i < length; i += 1) {
      const meanSquare = this.#waveform[i];
      if (meanSquare === undefined) {
        throw new Error('OOB');
      }

      result[i] = toPeak(meanSquare);
    }

    return result;
  }
}

const NOISE_BED = -60; // db

export function toPeak(meanSquare: number): number {
  // Loosely based on:
  // https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf
  const val = Math.max(0, 10 * Math.log10(meanSquare) - NOISE_BED) / -NOISE_BED;
  return Math.round(val * 255);
}
