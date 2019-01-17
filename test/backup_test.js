/* global Signal: false */
/* global Whisper: false */
/* global assert: false */
/* global textsecure: false */
/* global _: false */

/* eslint-disable no-unreachable, no-console */

'use strict';

describe('Backup', () => {
  describe('_sanitizeFileName', () => {
    it('leaves a basic string alone', () => {
      const initial = "Hello, how are you #5 ('fine' + great).jpg";
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
      const initial =
        '0123456789012345678901234567890123456789.01234567890123456789';
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
      assert.strictEqual(
        Signal.Backup._getConversationDirName(conversation),
        expected
      );
    });

    it('uses just id if name is not available', () => {
      const conversation = {
        active_at: 123,
        id: 'id',
      };
      const expected = '123 (id)';
      assert.strictEqual(
        Signal.Backup._getConversationDirName(conversation),
        expected
      );
    });

    it('uses inactive for missing active_at', () => {
      const conversation = {
        name: 'name',
        id: 'id',
      };
      const expected = 'inactive (name id)';
      assert.strictEqual(
        Signal.Backup._getConversationDirName(conversation),
        expected
      );
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

  describe('end-to-end', () => {
    it('exports then imports to produce the same data we started with', async () => {
      return;

      const { attachmentsPath, fse, glob, path, tmp } = window.test;
      const {
        upgradeMessageSchema,
        loadAttachmentData,
      } = window.Signal.Migrations;

      const key = new Uint8Array([
        1,
        3,
        4,
        5,
        6,
        7,
        8,
        11,
        23,
        34,
        1,
        34,
        3,
        5,
        45,
        45,
        1,
        3,
        4,
        5,
        6,
        7,
        8,
        11,
        23,
        34,
        1,
        34,
        3,
        5,
        45,
        45,
      ]);
      const attachmentsPattern = path.join(attachmentsPath, '**');

      const OUR_NUMBER = '+12025550000';
      const CONTACT_ONE_NUMBER = '+12025550001';
      const CONTACT_TWO_NUMBER = '+12025550002';

      async function wrappedLoadAttachment(attachment) {
        return _.omit(await loadAttachmentData(attachment), ['path']);
      }

      async function clearAllData() {
        await textsecure.storage.protocol.removeAllData();
        await fse.emptyDir(attachmentsPath);
      }

      function removeId(model) {
        return _.omit(model, ['id']);
      }

      const getUndefinedKeys = object =>
        Object.entries(object)
          .filter(([, value]) => value === undefined)
          .map(([name]) => name);
      const omitUndefinedKeys = object =>
        _.omit(object, getUndefinedKeys(object));

      // We want to know which paths have two slashes, since that tells us which files
      //   in the attachment fan-out are files vs. directories.
      const TWO_SLASHES = /[^/]*\/[^/]*\/[^/]*/;
      // On windows, attachmentsPath has a normal windows path format (\ separators), but
      //   glob returns only /. We normalize to / separators for our manipulations.
      const normalizedBase = attachmentsPath.replace(/\\/g, '/');
      function removeDirs(dirs) {
        return _.filter(dirs, fullDir => {
          const dir = fullDir.replace(normalizedBase, '');
          return TWO_SLASHES.test(dir);
        });
      }

      function _mapQuotedAttachments(mapper) {
        return async (message, context) => {
          if (!message.quote) {
            return message;
          }

          const wrappedMapper = async attachment => {
            if (!attachment || !attachment.thumbnail) {
              return attachment;
            }

            return Object.assign({}, attachment, {
              thumbnail: await mapper(attachment.thumbnail, context),
            });
          };

          const quotedAttachments =
            (message.quote && message.quote.attachments) || [];

          return Object.assign({}, message, {
            quote: Object.assign({}, message.quote, {
              attachments: await Promise.all(
                quotedAttachments.map(wrappedMapper)
              ),
            }),
          });
        };
      }

      async function loadAllFilesFromDisk(message) {
        const loadThumbnails = _mapQuotedAttachments(thumbnail => {
          // we want to be bulletproof to thumbnails without data
          if (!thumbnail.path) {
            return thumbnail;
          }

          return wrappedLoadAttachment(thumbnail);
        });

        return Object.assign({}, await loadThumbnails(message), {
          contact: await Promise.all(
            (message.contact || []).map(async contact => {
              return contact && contact.avatar && contact.avatar.avatar
                ? Object.assign({}, contact, {
                    avatar: Object.assign({}, contact.avatar, {
                      avatar: await wrappedLoadAttachment(
                        contact.avatar.avatar
                      ),
                    }),
                  })
                : contact;
            })
          ),
          attachments: await Promise.all(
            (message.attachments || []).map(attachment =>
              wrappedLoadAttachment(attachment)
            )
          ),
        });
      }

      let backupDir;
      try {
        const ATTACHMENT_COUNT = 3;
        const MESSAGE_COUNT = 1;
        const CONVERSATION_COUNT = 1;

        const messageWithAttachments = {
          conversationId: CONTACT_ONE_NUMBER,
          body: 'Totally!',
          source: OUR_NUMBER,
          received_at: 1524185933350,
          timestamp: 1524185933350,
          errors: [],
          attachments: [
            {
              contentType: 'image/gif',
              fileName: 'sad_cat.gif',
              data: new Uint8Array([
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
                1,
                2,
                3,
                4,
                5,
                6,
                7,
                8,
              ]).buffer,
            },
          ],
          hasAttachments: 1,
          hasFileAttachments: undefined,
          hasVisualMediaAttachments: 1,
          quote: {
            text: "Isn't it cute?",
            author: CONTACT_ONE_NUMBER,
            id: 12345678,
            attachments: [
              {
                contentType: 'audio/mp3',
                fileName: 'song.mp3',
              },
              {
                contentType: 'image/gif',
                fileName: 'happy_cat.gif',
                thumbnail: {
                  contentType: 'image/png',
                  data: new Uint8Array([
                    2,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                  ]).buffer,
                },
              },
            ],
          },
          contact: [
            {
              name: {
                displayName: 'Someone Somewhere',
              },
              number: [
                {
                  value: CONTACT_TWO_NUMBER,
                  type: 1,
                },
              ],
              avatar: {
                isProfile: false,
                avatar: {
                  contentType: 'image/png',
                  data: new Uint8Array([
                    3,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7,
                    8,
                  ]).buffer,
                },
              },
            },
          ],
        };

        console.log('Backup test: Clear all data');
        await clearAllData();

        console.log('Backup test: Create models, save to db/disk');
        const message = await upgradeMessageSchema(messageWithAttachments);
        console.log({ message });
        const messageModel = new Whisper.Message(message);
        const id = await window.Signal.Data.saveMessage(
          messageModel.attributes,
          {
            Message: Whisper.Message,
          }
        );
        messageModel.set({ id });

        const conversation = {
          active_at: 1524185933350,
          color: 'orange',
          expireTimer: 0,
          id: CONTACT_ONE_NUMBER,
          lastMessage: 'Heyo!',
          name: 'Someone Somewhere',
          profileAvatar: {
            contentType: 'image/jpeg',
            data: new Uint8Array([
              4,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
            ]).buffer,
            size: 64,
          },
          profileKey: new Uint8Array([
            5,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
          ]).buffer,
          profileName: 'Someone! 🤔',
          profileSharing: true,
          timestamp: 1524185933350,
          tokens: [
            'someone somewhere',
            'someone',
            'somewhere',
            '2025550001',
            '12025550001',
          ],
          type: 'private',
          unreadCount: 0,
          verified: 0,
        };
        console.log({ conversation });
        await window.Signal.Data.saveConversation(conversation, {
          Conversation: Whisper.Conversation,
        });

        console.log(
          'Backup test: Ensure that all attachments were saved to disk'
        );
        const attachmentFiles = removeDirs(glob.sync(attachmentsPattern));
        console.log({ attachmentFiles });
        assert.strictEqual(ATTACHMENT_COUNT, attachmentFiles.length);

        console.log('Backup test: Export!');
        backupDir = tmp.dirSync().name;
        console.log({ backupDir });
        await Signal.Backup.exportToDirectory(backupDir, { key });

        console.log('Backup test: Ensure that messages.zip exists');
        const zipPath = path.join(backupDir, 'messages.zip');
        const messageZipExists = fse.existsSync(zipPath);
        assert.strictEqual(true, messageZipExists);

        console.log(
          'Backup test: Ensure that all attachments made it to backup dir'
        );
        const backupAttachmentPattern = path.join(backupDir, 'attachments/*');
        const backupAttachments = glob.sync(backupAttachmentPattern);
        console.log({ backupAttachments });
        assert.strictEqual(ATTACHMENT_COUNT, backupAttachments.length);

        console.log('Backup test: Clear all data');
        await clearAllData();

        console.log('Backup test: Import!');
        await Signal.Backup.importFromDirectory(backupDir, { key });

        console.log('Backup test: ensure that all attachments were imported');
        const recreatedAttachmentFiles = removeDirs(
          glob.sync(attachmentsPattern)
        );
        console.log({ recreatedAttachmentFiles });
        assert.strictEqual(ATTACHMENT_COUNT, recreatedAttachmentFiles.length);
        assert.deepEqual(attachmentFiles, recreatedAttachmentFiles);

        console.log('Backup test: Check messages');
        const messageCollection = await window.Signal.Data.getAllMessages({
          MessageCollection: Whisper.MessageCollection,
        });
        assert.strictEqual(messageCollection.length, MESSAGE_COUNT);
        const messageFromDB = removeId(messageCollection.at(0).attributes);
        const expectedMessage = omitUndefinedKeys(message);
        console.log({ messageFromDB, expectedMessage });
        assert.deepEqual(messageFromDB, expectedMessage);

        console.log(
          'Backup test: Check that all attachments were successfully imported'
        );
        const messageWithAttachmentsFromDB = await loadAllFilesFromDisk(
          messageFromDB
        );
        const expectedMessageWithAttachments = omitUndefinedKeys(
          messageWithAttachments
        );
        console.log({
          messageWithAttachmentsFromDB,
          expectedMessageWithAttachments,
        });
        assert.deepEqual(
          _.omit(messageWithAttachmentsFromDB, ['schemaVersion']),
          expectedMessageWithAttachments
        );

        console.log('Backup test: Check conversations');
        const conversationCollection = await window.Signal.Data.getAllConversations(
          {
            ConversationCollection: Whisper.ConversationCollection,
          }
        );
        assert.strictEqual(conversationCollection.length, CONVERSATION_COUNT);

        const conversationFromDB = conversationCollection.at(0).attributes;
        console.log({ conversationFromDB, conversation });
        assert.deepEqual(
          conversationFromDB,
          _.omit(conversation, ['profileAvatar'])
        );

        console.log('Backup test: Clear all data');
        await clearAllData();

        console.log('Backup test: Complete!');
      } finally {
        if (backupDir) {
          console.log({ backupDir });
          console.log('Deleting', backupDir);
          await fse.remove(backupDir);
        }
      }
    });
  });
});
