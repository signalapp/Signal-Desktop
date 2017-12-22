'use strict';

describe('Backup', function() {
  describe('handleDOMException', function() {
    it('handles null, still calls reject', function() {
      var called = 0;
      var reject = function() {
        called += 1;
      };
      var error = null;
      var prefix = 'something';

      Whisper.Backup.handleDOMException(prefix, error, reject);

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

      Whisper.Backup.handleDOMException(prefix, error, reject);

      assert.strictEqual(called, 1);
    });
  });

  describe('sanitizeFileName', function() {
    it('leaves a basic string alone', function() {
      var initial = 'Hello, how are you #5 (\'fine\' + great).jpg';
      var expected = initial;
      assert.strictEqual(Whisper.Backup.sanitizeFileName(initial), expected);
    });

    it('replaces all unknown characters', function() {
      var initial = '!@$%^&*=';
      var expected = '________';
      assert.strictEqual(Whisper.Backup.sanitizeFileName(initial), expected);
    });
  });

  describe('trimFileName', function() {
    it('handles a file with no extension', function() {
      var initial = '0123456789012345678901234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Whisper.Backup.trimFileName(initial), expected);
    });

    it('handles a file with a long extension', function() {
      var initial = '0123456789012345678901234567890123456789.01234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Whisper.Backup.trimFileName(initial), expected);
    });

    it('handles a file with a normal extension', function() {
      var initial = '01234567890123456789012345678901234567890123456789.jpg';
      var expected = '012345678901234567890123.jpg';
      assert.strictEqual(Whisper.Backup.trimFileName(initial), expected);
    });
  });

  describe('getAttachmentFileName', function() {
    it('uses original filename if attachment has one', function() {
      var attachment = {
        fileName: 'blah.jpg'
      };
      var expected = 'blah.jpg';
      assert.strictEqual(Whisper.Backup.getAttachmentFileName(attachment), expected);
    });

    it('uses attachment id if no filename', function() {
      var attachment = {
        id: '123'
      };
      var expected = '123';
      assert.strictEqual(Whisper.Backup.getAttachmentFileName(attachment), expected);
    });

    it('uses filename and contentType if available', function() {
      var attachment = {
        id: '123',
        contentType: 'image/jpeg'
      };
      var expected = '123.jpeg';
      assert.strictEqual(Whisper.Backup.getAttachmentFileName(attachment), expected);
    });

    it('handles strange contentType', function() {
      var attachment = {
        id: '123',
        contentType: 'something'
      };
      var expected = '123.something';
      assert.strictEqual(Whisper.Backup.getAttachmentFileName(attachment), expected);
    });
  });

  describe('getConversationDirName', function() {
    it('uses name if available', function() {
      var conversation = {
        active_at: 123,
        name: '0123456789012345678901234567890123456789',
        id: 'id'
      };
      var expected = '123 (012345678901234567890123456789 id)';
      assert.strictEqual(Whisper.Backup.getConversationDirName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'id'
      };
      var expected = '123 (id)';
      assert.strictEqual(Whisper.Backup.getConversationDirName(conversation), expected);
    });

    it('uses never for missing active_at', function() {
      var conversation = {
        name: 'name',
        id: 'id'
      };
      var expected = 'never (name id)';
      assert.strictEqual(Whisper.Backup.getConversationDirName(conversation), expected);
    });
  });

  describe('getConversationLoggingName', function() {
    it('uses plain id if conversation is private', function() {
      var conversation = {
        active_at: 123,
        id: 'id',
        type: 'private'
      };
      var expected = '123 (id)';
      assert.strictEqual(Whisper.Backup.getConversationLoggingName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'groupId',
        type: 'group'
      };
      var expected = '123 ([REDACTED_GROUP]pId)';
      assert.strictEqual(Whisper.Backup.getConversationLoggingName(conversation), expected);
    });

    it('uses never for missing active_at', function() {
      var conversation = {
        id: 'id',
        type: 'private'
      };
      var expected = 'never (id)';
      assert.strictEqual(Whisper.Backup.getConversationLoggingName(conversation), expected);
    });
  });
});
