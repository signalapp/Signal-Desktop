/* global Whisper */

'use strict';

describe('Database', () => {
  describe('handleDOMException', () => {
    it('handles null, still calls reject', () => {
      let called = 0;
      const reject = () => {
        called += 1;
      };
      const error = null;
      const prefix = 'something';

      Whisper.Database.handleDOMException(prefix, error, reject);

      assert.strictEqual(called, 1);
    });

    it('handles object code and message', () => {
      let called = 0;
      const reject = () => {
        called += 1;
      };
      const error = {
        code: 4,
        message: 'some cryptic error',
      };
      const prefix = 'something';

      Whisper.Database.handleDOMException(prefix, error, reject);

      assert.strictEqual(called, 1);
    });
  });
});
