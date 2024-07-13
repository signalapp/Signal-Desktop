// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { SplitTextOptionsType } from '../../util/splitText';
import { splitText } from '../../util/splitText';

describe('splitText', () => {
  describe('grapheme granularity', () => {
    const options: SplitTextOptionsType = {
      granularity: 'grapheme',
      shouldBreak: x => x.length > 6,
    };

    it('splits text into one line', () => {
      assert.deepEqual(splitText('signal', options), ['signal']);
    });

    it('splits text into two lines', () => {
      assert.deepEqual(splitText('signal.0123', options), ['signal', '.0123']);
    });

    it('splits text into three lines', () => {
      assert.deepEqual(splitText('signal.01234567', options), [
        'signal',
        '.01234',
        '567',
      ]);
    });
  });

  describe('word granularity', () => {
    const options: SplitTextOptionsType = {
      granularity: 'word',
      shouldBreak: x => x.length > 6,
    };

    it('splits text into one line', () => {
      assert.deepEqual(splitText('signal', options), ['signal']);
    });

    it('splits text into two lines', () => {
      assert.deepEqual(splitText('signal.0123', options), ['signal.', '0123']);
    });

    it('splits text into three lines', () => {
      assert.deepEqual(splitText('aaaaaa b b ccccc', options), [
        'aaaaaa',
        'b b',
        'ccccc',
      ]);
    });

    it('trims lines', () => {
      assert.deepEqual(splitText('signa 0123', options), ['signa', '0123']);
    });
  });
});
