const Path = require('path');

const { assert } = require('chai');

const Errors = require('../../../js/modules/types/errors');


const APP_ROOT_PATH = Path.join(__dirname, '..', '..', '..');

describe('Errors', () => {
  describe('toLogFormat', () => {
    it('should redact sensitive paths in stack trace', () => {
      try {
        throw new Error('boom');
      } catch (error) {
        assert.include(
          error.stack,
          APP_ROOT_PATH,
          'Unformatted stack has sensitive paths'
        );

        const formattedStack = Errors.toLogFormat(error);
        assert.notInclude(
          formattedStack,
          APP_ROOT_PATH,
          'Formatted stack does not have sensitive paths'
        );
        assert.include(
          formattedStack,
          '[REDACTED]',
          'Formatted stack has redactions'
        );
        return;
      }
      // eslint-disable-next-line no-unreachable
      assert.fail('Expected error to be thrown.');
    });
  });
});
