// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Path from 'node:path';
import { assert } from 'chai';
import * as Errors from '../../types/errors.std.js';

const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');

describe('Errors', () => {
  describe('toLogFormat', () => {
    it('should return error stack trace if present', () => {
      const error = new Error('boom');
      assert.typeOf(error, 'Error');

      const formattedError = Errors.toLogFormat(error);
      assert.include(formattedError, 'errors_test.node.js');
      assert.include(
        formattedError,
        APP_ROOT_PATH,
        'Formatted stack has app path'
      );
    });

    it('should return error string representation if stack is missing', () => {
      const error = new Error('boom');
      error.stack = undefined;
      assert.typeOf(error, 'Error');
      assert.isUndefined(error.stack);

      const formattedError = Errors.toLogFormat(error);
      assert.strictEqual(formattedError, 'boom');
    });

    [0, false, null, undefined].forEach(value => {
      it(`should return \`${value}\` argument`, () => {
        const formattedNonError = Errors.toLogFormat(value);
        assert.strictEqual(formattedNonError, String(value));
      });
    });
  });
});
