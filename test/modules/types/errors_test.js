const Path = require('path');

const { assert } = require('chai');

const Errors = require('../../../js/modules/types/errors');

const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');

describe('Errors', () => {
  describe('toLogFormat', () => {
    it('should return error stack trace if present', () => {
      const error = new Error('boom');
      assert.typeOf(error, 'Error');

      const formattedError = Errors.toLogFormat(error);
      assert.include(formattedError, 'errors_test.js');
      assert.include(
        formattedError,
        APP_ROOT_PATH,
        'Formatted stack has app path'
      );
    });

    it('should return error string representation if stack is missing', () => {
      const error = new Error('boom');
      error.stack = null;
      assert.typeOf(error, 'Error');
      assert.isNull(error.stack);

      const formattedError = Errors.toLogFormat(error);
      assert.strictEqual(formattedError, 'Error: boom');
    });

    [0, false, null, undefined].forEach(value => {
      it(`should return \`${value}\` argument`, () => {
        const formattedNonError = Errors.toLogFormat(value);
        assert.strictEqual(formattedNonError, value);
      });
    });
  });
});
