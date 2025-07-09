// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { VideoFrameSource } from '@signalapp/ringrtc';

const COLORS: Array<[number, number, number]> = [
  [0xff, 0x00, 0x00],
  [0xff, 0x99, 0x00],
  [0xff, 0xff, 0x00],
  [0x00, 0xff, 0x00],
  [0x00, 0x99, 0xff],
  [0xff, 0x00, 0xff],
  [0x99, 0x33, 0xff],
];

class FakeGroupCallVideoFrameSource implements VideoFrameSource {
  readonly #sourceArray: Uint8Array;
  readonly #dimensions: [number, number];

  constructor(width: number, height: number, r: number, g: number, b: number) {
    const length = width * height * 4;

    this.#sourceArray = new Uint8Array(length);
    for (let i = 0; i < length; i += 4) {
      this.#sourceArray[i] = r;
      this.#sourceArray[i + 1] = g;
      this.#sourceArray[i + 2] = b;
      this.#sourceArray[i + 3] = 255;
    }

    this.#dimensions = [width, height];
  }

  receiveVideoFrame(
    destinationBuffer: Buffer,
    _maxWidth: number,
    _maxHeight: number
  ): [number, number] | undefined {
    // Simulate network jitter. Also improves performance when testing.
    if (Math.random() < 0.5) {
      return undefined;
    }

    destinationBuffer.set(this.#sourceArray);
    return this.#dimensions;
  }
}

/**
 * This produces a fake video frame source that is a single color.
 *
 * The aspect ratio is fixed at 1.3 because that matches many of our stories.
 */
export function fakeGetGroupCallVideoFrameSource(
  demuxId: number
): VideoFrameSource {
  const color = COLORS[demuxId % COLORS.length];
  if (!color) {
    throw new Error('Expected a color, but it was not found');
  }
  const [r, g, b] = color;

  return new FakeGroupCallVideoFrameSource(13, 10, r, g, b);
}
