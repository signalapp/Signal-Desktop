/* global Signal: false */
/* global assert: false */

'use strict';

describe('Backup', () => {
  describe('_sanitizeFileName', () => {
    it('leaves a basic string alone', () => {
      const initial = 'Hello, how are you #5 (\'fine\' + great).jpg';
      const expected = initial;
      assert.strictEqual(Signal.Backup._sanitizeFileName(initial), expected);
    });

    it('replaces all unknown characters', () => {
      const initial = '!@$%^&*=';
      const expected = '________';
      assert.strictEqual(Signal.Backup._sanitizeFileName(initial), expected);
    });
  });

  describe('_trimFileName', () => {
    it('handles a file with no extension', () => {
      const initial = '0123456789012345678901234567890123456789';
      const expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });

    it('handles a file with a long extension', () => {
      const initial = '0123456789012345678901234567890123456789.01234567890123456789';
      const expected = '012345678901234567890123456789';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });

    it('handles a file with a normal extension', () => {
      const initial = '01234567890123456789012345678901234567890123456789.jpg';
      const expected = '012345678901234567890123.jpg';
      assert.strictEqual(Signal.Backup._trimFileName(initial), expected);
    });
  });

  describe('_getExportAttachmentFileName', () => {
    it('uses original filename if attachment has one', () => {
      const message = {
        body: 'something',
      };
      const index = 0;
      const attachment = {
        fileName: 'blah.jpg',
      };
      const expected = 'blah.jpg';

      const actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('uses attachment id if no filename', () => {
      const message = {
        body: 'something',
      };
      const index = 0;
      const attachment = {
        id: '123',
      };
      const expected = '123';

      const actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('uses filename and contentType if available', () => {
      const message = {
        body: 'something',
      };
      const index = 0;
      const attachment = {
        id: '123',
        contentType: 'image/jpeg',
      };
      const expected = '123.jpeg';

      const actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('handles strange contentType', () => {
      const message = {
        body: 'something',
      };
      const index = 0;
      const attachment = {
        id: '123',
        contentType: 'something',
      };
      const expected = '123.something';

      const actual = Signal.Backup._getExportAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });
  });

  describe('_getAnonymousAttachmentFileName', () => {
    it('uses message id', () => {
      const message = {
        id: 'id-45',
        body: 'something',
      };
      const index = 0;
      const attachment = {
        fileName: 'blah.jpg',
      };
      const expected = 'id-45';

      const actual = Signal.Backup._getAnonymousAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });

    it('appends index if it is above zero', () => {
      const message = {
        id: 'id-45',
        body: 'something',
      };
      const index = 1;
      const attachment = {
        fileName: 'blah.jpg',
      };
      const expected = 'id-45-1';

      const actual = Signal.Backup._getAnonymousAttachmentFileName(
        message,
        index,
        attachment
      );
      assert.strictEqual(actual, expected);
    });
  });

  describe('_getConversationDirName', () => {
    it('uses name if available', () => {
      const conversation = {
        active_at: 123,
        name: '0123456789012345678901234567890123456789',
        id: 'id',
      };
      const expected = '123 (012345678901234567890123456789 id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });

    it('uses just id if name is not available', () => {
      const conversation = {
        active_at: 123,
        id: 'id',
      };
      const expected = '123 (id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });

    it('uses inactive for missing active_at', () => {
      const conversation = {
        name: 'name',
        id: 'id',
      };
      const expected = 'inactive (name id)';
      assert.strictEqual(Signal.Backup._getConversationDirName(conversation), expected);
    });
  });

  describe('_getConversationLoggingName', () => {
    it('uses plain id if conversation is private', () => {
      const conversation = {
        active_at: 123,
        id: 'id',
        type: 'private',
      };
      const expected = '123 (id)';
      assert.strictEqual(
        Signal.Backup._getConversationLoggingName(conversation),
        expected
      );
    });

    it('uses just id if name is not available', () => {
      const conversation = {
        active_at: 123,
        id: 'groupId',
        type: 'group',
      };
      const expected = '123 ([REDACTED_GROUP]pId)';
      assert.strictEqual(
        Signal.Backup._getConversationLoggingName(conversation),
        expected
      );
    });

    it('uses inactive for missing active_at', () => {
      const conversation = {
        id: 'id',
        type: 'private',
      };
      const expected = 'inactive (id)';
      assert.strictEqual(
        Signal.Backup._getConversationLoggingName(conversation),
        expected
      );
    });
  });
});
