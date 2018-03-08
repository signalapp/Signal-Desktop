'use strict';

describe('Database', function() {
  describe('handleDOMException', function() {
    it('handles null, still calls reject', function() {
      var called = 0;
      var reject = function() {
        called += 1;
      };
      var error = null;
      var prefix = 'something';

      Whisper.Database.handleDOMException(prefix, error, reject);

      assert.strictEqual(called, 1);
    });

    it('handles object code and message', function() {
      var called = 0;
      var reject = function() {
        called += 1;
      };
      var error = {
        code: 4,
        message: 'some cryptic error',
      };
      var prefix = 'something';

      Whisper.Database.handleDOMException(prefix, error, reject);

      assert.strictEqual(called, 1);
    });
  });
});
