// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { WaveformBuilder } from '../../util/waveformBuilder.std.ts';

describe('WaveformBuilder', () => {
  let b: WaveformBuilder;

  beforeEach(() => {
    b = new WaveformBuilder();
  });

  it('should return empty array for empty audio', () => {
    assert.deepStrictEqual(b.collect(), []);
  });

  it('should return squared peaks for a short audio', () => {
    for (let i = 0; i < 10; i += 1) {
      b.push(i / 10);
    }
    assert.deepStrictEqual(
      b.collect(),
      [0, 170, 196, 211, 221, 229, 236, 242, 247, 251]
    );
  });

  it('should return averaged squared peaks for a longer audio', () => {
    for (let i = 0; i < 199; i += 1) {
      const sample = (i % 10) / 10;
      b.push(sample);
    }

    assert.deepStrictEqual(
      b.collect(),
      [
        157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226, 239,
        249, 157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226,
        239, 249, 157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205,
        226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157,
        205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226, 239, 249,
        157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226, 239,
        249, 157, 205, 226, 239, 249, 157, 205, 226, 239, 249, 157, 205, 226,
        239, 247,
      ]
    );
  });

  it('should return averaged squared peaks for a long audio', () => {
    for (let i = 0; i < 999; i += 1) {
      const sample = (i % 10) / 10;
      b.push(sample);
    }

    assert.deepStrictEqual(
      b.collect(),
      [
        226, 234, 230, 231, 235, 226, 234, 230, 231, 235, 226, 234, 230, 231,
        235, 226, 234, 230, 231, 235, 226, 234, 230, 231, 235, 226, 234, 230,
        231, 235, 226, 234, 230, 231, 235, 226, 234, 230, 231, 235, 226, 234,
        230, 231, 235, 226, 234, 230, 231, 235, 226, 234, 230, 231, 235, 226,
        234, 230, 231, 235, 226, 234, 232,
      ]
    );
  });
});
