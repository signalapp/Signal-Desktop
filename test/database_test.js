'use strict';

describe('Database', function() {
  describe('cleanMessageAttachments', function() {
    it('does not modify a message with no attachments field', function() {
      const message = {};
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('does not modify a message with no attachments', function() {
      const message = {
        attachments: [],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('does not modify a message with an attachment with a string fileName', function() {
      const message = {
        attachments: [{
          fileName: 'blah.jpg',
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('does not modify a message with an attachment with no fileName and a number id', function() {
      const message = {
        attachments: [{
          id: 4,
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      console.log(message);
      assert.strictEqual(actual, false);
    });

    it('does not modify a message with an attachment with no fileName and a string id', function() {
      const message = {
        attachments: [{
          id: '4',
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);
      console.log(message);

      assert.strictEqual(actual, false);
    });

    it('eliminates non-string fileName', function() {
      const message = {
        attachments: [{
          fileName: 4,
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.isUndefined(message.attachments[0].fileName);
      assert.strictEqual(actual, true);
    });

    it('eliminates object id', function() {
      const message = {
        attachments: [{
          id: {
            info: 'yes',
          },
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.strictEqual(typeof message.attachments[0].id, 'string');
      assert.strictEqual(actual, true);
    });

    it('eliminates non-string contentType', function() {
      const message = {
        attachments: [{
          contentType: 4,
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.isUndefined(message.attachments[0].contentType);
      assert.strictEqual(actual, true);
    });

    it('drops an attachment with no data attribute', function() {
      const message = {
        attachments: [{
          id: 1,
          data: null,
        }, {
          id: 2,
          data: 'something'
        }],
      };
      const actual = window.Whisper.Database.cleanMessageAttachments(message);

      assert.strictEqual(message.attachments.length, 1);
      assert.strictEqual(message.attachments[0].id, 2);
      assert.strictEqual(actual, true);
    });
  });

  describe('dropZeroLengthAttachments', function() {
    it('does not modify a message with no attachments field', function() {
      const message = {};
      const actual = window.Whisper.Database.dropZeroLengthAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('does not modify a message with no attachments', function() {
      const message = {
        attachments: [],
      };
      const actual = window.Whisper.Database.dropZeroLengthAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('does not modify a message with an attachment with a non-zero data field', function() {
      const message = {
        attachments: [{
          fileName: 'blah.jpg',
          data: 'something',
        }],
      };
      const actual = window.Whisper.Database.dropZeroLengthAttachments(message);

      assert.strictEqual(actual, false);
    });

    it('drops an attachment with null or zero-length data field', function() {
      const message = {
        attachments: [{
          id: 1,
          data: null,
        }, {
          id: 3,
          data: {
            byteLength: 1,
          },
        }],
      };
      const actual = window.Whisper.Database.dropZeroLengthAttachments(message);

      assert.strictEqual(message.attachments.length, 1);
      assert.strictEqual(message.attachments[0].id, 3);
      assert.strictEqual(actual, true);
    });
  });
});
