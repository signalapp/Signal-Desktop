// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function init(sampleRate: number, bitRate: number): void;

export function encode(
  data: Float32Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer>;

export function flush(): Uint8Array<ArrayBuffer>;

export function getLametagFrame(): Uint8Array<ArrayBuffer>;
