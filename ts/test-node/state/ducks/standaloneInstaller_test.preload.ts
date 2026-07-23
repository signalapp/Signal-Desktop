// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert';

import { normalizePin } from '../../../state/ducks/standaloneInstaller.preload.ts';

describe('ducks/standaloneInstaller', () => {
  describe('#normalizePin', () => {
    it('trims', () => {
      assert.strictEqual(normalizePin('  pin \n  '), 'pin');
      assert.strictEqual(normalizePin(' \t\npin      '), 'pin');
      assert.strictEqual(normalizePin('\n\n  pin \t\r\t\t'), 'pin');
    });

    it('normalizes', () => {
      assert.strictEqual(
        normalizePin('\u00F1'), // integrated tilde
        '\u006E\u0303' // separate tilde
      );
      assert.strictEqual(
        normalizePin('\u1E9B\u0323'), // integrated dot above, separate dot below
        '\u0073\u0323\u0307' // separate dot for above and below
      );
      assert.strictEqual(
        normalizePin('Am\u00e9lie'), // integrated accent over the e
        'Ame\u0301lie' // separate accent for the e
      );
    });

    it('translates numerals', () => {
      assert.strictEqual(
        normalizePin('٠١٢٣٤٥٦٧٨٩'), // Eastern Arabic numerals
        '0123456789' // Western Arabic numerals
      );
      assert.strictEqual(
        normalizePin('᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙'), // Thai Tham numerals
        '0123456789' // Western Arabic numerals
      );
      assert.strictEqual(
        normalizePin('⓪①②③④⑤⑥⑦⑧⑨'), // Circled digits
        '0123456789' // Western Arabic numerals
      );
    });
  });
});
