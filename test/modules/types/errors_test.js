const Path = require('path');

const { assert } = require('chai');

const Errors = require('../../../js/modules/types/errors');


const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');

describe('Errors', () => {
  describe('toLogFormat', () => {
    it('should convert non-errors to errors', () => {
      try {
        // eslint-disable-next-line no-throw-literal
        throw 'boom';
      } catch (nonError) {
        assert.typeOf(nonError, 'string');
        assert.isUndefined(nonError.stack);

        const formattedStack = Errors.toLogFormat(nonError);
        assert.include(
          formattedStack,
          APP_ROOT_PATH,
          'Formatted stack has app path'
        );
        return;
      }

      // eslint-disable-next-line no-unreachable
      assert.fail('Expected error to be thrown.');
    });

    it('should add stack to errors without one', () => {
      const error = new Error('boom');
      error.stack = null;
      assert.typeOf(error, 'Error');
      assert.isNull(error.stack);

      const formattedStack = Errors.toLogFormat(error);
      assert.include(formattedStack, '<Original stack missing>');
      assert.include(formattedStack, APP_ROOT_PATH, 'Formatted stack has app path');
    });
  });
});
