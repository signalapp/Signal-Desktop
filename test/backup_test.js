'use strict';

describe('Backup', function() {
  describe('sanitizeFileName', function() {
    it('leaves a basic string alone', function() {
      var initial = 'Hello, how are you #5 (\'fine\' + great).jpg';
      var expected = initial;
      assert.strictEqual(Signal.Backup.sanitizeFileName(initial), expected);
    });

    it('replaces all unknown characters', function() {
      var initial = '!@$%^&*=';
      var expected = '________';
      assert.strictEqual(Signal.Backup.sanitizeFileName(initial), expected);
    });
  });

  describe('trimFileName', function() {
    it('handles a file with no extension', function() {
      var initial = '0123456789012345678901234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup.trimFileName(initial), expected);
    });

    it('handles a file with a long extension', function() {
      var initial = '0123456789012345678901234567890123456789.01234567890123456789';
      var expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup.trimFileName(initial), expected);
    });

    it('handles a file with a normal extension', function() {
      var initial = '01234567890123456789012345678901234567890123456789.jpg';
      var expected = '012345678901234567890123.jpg';
      assert.strictEqual(Signal.Backup.trimFileName(initial), expected);
    });
  });

  describe('getAttachmentFileName', function() {
    it('uses original filename if attachment has one', function() {
      var attachment = {
        fileName: 'blah.jpg'
      };
      var expected = 'blah.jpg';
      assert.strictEqual(Signal.Backup.getAttachmentFileName(attachment), expected);
    });

    it('uses attachment id if no filename', function() {
      var attachment = {
        id: '123'
      };
      var expected = '123';
      assert.strictEqual(Signal.Backup.getAttachmentFileName(attachment), expected);
    });

    it('uses filename and contentType if available', function() {
      var attachment = {
        id: '123',
        contentType: 'image/jpeg'
      };
      var expected = '123.jpeg';
      assert.strictEqual(Signal.Backup.getAttachmentFileName(attachment), expected);
    });

    it('handles strange contentType', function() {
      var attachment = {
        id: '123',
        contentType: 'something'
      };
      var expected = '123.something';
      assert.strictEqual(Signal.Backup.getAttachmentFileName(attachment), expected);
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
      assert.strictEqual(Signal.Backup.getConversationDirName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'id'
      };
      var expected = '123 (id)';
      assert.strictEqual(Signal.Backup.getConversationDirName(conversation), expected);
    });

    it('uses never for missing active_at', function() {
      var conversation = {
        name: 'name',
        id: 'id'
      };
      var expected = 'never (name id)';
      assert.strictEqual(Signal.Backup.getConversationDirName(conversation), expected);
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
      assert.strictEqual(Signal.Backup.getConversationLoggingName(conversation), expected);
    });

    it('uses just id if name is not available', function() {
      var conversation = {
        active_at: 123,
        id: 'groupId',
        type: 'group'
      };
      var expected = '123 ([REDACTED_GROUP]pId)';
      assert.strictEqual(Signal.Backup.getConversationLoggingName(conversation), expected);
    });

    it('uses never for missing active_at', function() {
      var conversation = {
        id: 'id',
        type: 'private'
      };
      var expected = 'never (id)';
      assert.strictEqual(Signal.Backup.getConversationLoggingName(conversation), expected);
    });
  });
});
