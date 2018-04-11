'use strict';

describe('Backup', function() {
  describe('_sanitizeFileName', function() {
    it('leaves a basic string alone', function() {
      var initial = 'Hello, how are you #5 (\'fine\' + great).jpg';
      var expected = initial;
      assert.strictEqual(Signal.Backup._sanitizeFileName(initial), expected);
    });

    it('replaces all unknown characters', function() {
      var initial = '!@$%^&*=';
      var expected = '________';
      assert.strictEqual(Signal.Backup._sanitizeFileName(initial), expected);
    });
  });

  describe('_trimFileName', function() {
    it('handles a file with no extension', function() {
      var initial = '0123456789012345678901234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });

    it('handles a file with a long extension', function() {
      var initial = '0123456789012345678901234567890123456789.01234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });

    it('handles a file with a normal extension', function() {
      var initial = '01234567890123456789012345678901234567890123456789.jpg';
      var expected = '012345678901234567890123.jpg';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });
  });

  describe('_getExportAttachmentFileName', function() {
    it('uses original filename if attachment has one', function() {
      var message = {
        body: 'something',
      };
      var index = 0;
      var attachment = {
        fileName: 'blah.jpg'
      };
      var expected = 'blah.jpg';

      var actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('uses attachment id if no filename', function() {
      var message = {
        body: 'something',
      };
      var index = 0;
      var attachment = {
        id: '123'
      };
      var expected = '123';

      var actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('uses filename and contentType if available', function() {
      var message = {
        body: 'something',
      };
      var index = 0;
      var attachment = {
        id: '123',
        contentType: 'image/jpeg'
      };
      var expected = '123.jpeg';

      var actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('handles strange contentType', function() {
      var message = {
        body: 'something',
      };
      var index = 0;
      var attachment = {
        id: '123',
        contentType: 'something'
      };
      var expected = '123.something';

      var actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });
  });

  describe('_getAnonymousAttachmentFileName', function() {
    it('uses message id', function() {
      var message = {
        id: 'id-45',
        body: 'something',
      };
      var index = 0;
      var attachment = {
        fileName: 'blah.jpg'
      };
      var expected = 'id-45';

      var actual = Signal.Backup._getAnonymousAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('appends index if it is above zero', function() {
      var message = {
        id: 'id-45',
        body: 'something',
      };
      var index = 1;
      var attachment = {
        fileName: 'blah.jpg'
      };
      var expected = 'id-45-1';

      var actual = Signal.Backup._getAnonymousAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });
  });

  describe('_getConversationDirName', function() {
    it('uses name if available', function() {
      var conversation = {
        active_at: 123,
        name: '0123456789012345678901234567890123456789',
        id: 'id'
      };
      var expected = '123 (012345678901234567890123456789 id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'id'
      };
      var expected = '123 (id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });

    it('uses inactive for missing active_at', function() {
      var conversation = {
        name: 'name',
        id: 'id'
      };
      var expected = 'inactive (name id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });
  });

  describe('_getConversationLoggingName', function() {
    it('uses plain id if conversation is private', function() {
      var conversation = {
        active_at: 123,
        id: 'id',
        type: 'private'
      };
      var expected = '123 (id)';
      assert.strictEqual(Signal.Backup._getConversationLoggingName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'groupId',
        type: 'group'
      };
      var expected = '123 ([REDACTED_GROUP]pId)';
      assert.strictEqual(Signal.Backup._getConversationLoggingName(conversation), expected);
    });

    it('uses inactive for missing active_at', function() {
      var conversation = {
        id: 'id',
        type: 'private'
      };
      var expected = 'inactive (id)';
      assert.strictEqual(Signal.Backup._getConversationLoggingName(conversation), expected);
    });
  });
});
