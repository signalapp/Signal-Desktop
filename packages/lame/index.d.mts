// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type Options = Readonly<{
  q: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  sampleRate: number;
  bitRate: number;
}>;

export class Encoder {
  constructor(options: Options);

  encode(
    data: Float32Array<ArrayBuffer>,
  ): Uint8Array<ArrayBuffer>;

  flush(): Uint8Array<ArrayBuffer>;

  getLametagFrame(): Uint8Array<ArrayBuffer>;
}
