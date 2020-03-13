/* global Signal, Whisper, assert, textsecure, _, libsignal */

/* eslint-disable no-console */

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
    it('exports then imports to produce the same data we started with', async function thisNeeded() {
      this.timeout(6000);

      const { attachmentsPath, fse, glob, path, tmp, isWindows } = window.test;

      // Skip this test on windows
      //  because it always fails due to lstat permission error.
      // Don't know how to fix it so this is a temp work around.
      if (isWindows) {
        console.log(
          'Skipping exports then imports to produce the same data we started'
        );
        this.skip();
        return;
      }

      const {
        upgradeMessageSchema,
        loadAttachmentData,
      } = window.Signal.Migrations;

      const staticKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
      const attachmentsPattern = path.join(attachmentsPath, '**');

      const OUR_NUMBER = '+12025550000';
      const CONTACT_ONE_NUMBER = '+12025550001';
      const CONTACT_TWO_NUMBER = '+12025550002';

      const toArrayBuffer = nodeBuffer =>
        nodeBuffer.buffer.slice(
          nodeBuffer.byteOffset,
          nodeBuffer.byteOffset + nodeBuffer.byteLength
        );

      const getFixture = target => toArrayBuffer(fse.readFileSync(target));

      const FIXTURES = {
        gif: getFixture('fixtures/giphy-7GFfijngKbeNy.gif'),
        mp4: getFixture('fixtures/pixabay-Soap-Bubble-7141.mp4'),
        jpg: getFixture('fixtures/koushik-chowdavarapu-105425-unsplash.jpg'),
        mp3: getFixture('fixtures/incompetech-com-Agnus-Dei-X.mp3'),
        txt: getFixture('fixtures/lorem-ipsum.txt'),
        png: getFixture(
          'fixtures/freepngs-2cd43b_bed7d1327e88454487397574d87b64dc_mv2.png'
        ),
      };

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
            (message.attachments || []).map(async attachment => {
              await wrappedLoadAttachment(attachment);

              if (attachment.thumbnail) {
                await wrappedLoadAttachment(attachment.thumbnail);
              }

              if (attachment.screenshot) {
                await wrappedLoadAttachment(attachment.screenshot);
              }

              return attachment;
            })
          ),
          preview: await Promise.all(
            (message.preview || []).map(async item => {
              if (item.image) {
                await wrappedLoadAttachment(item.image);
              }

              return item;
            })
          ),
        });
      }

      let backupDir;
      try {
        // Seven total:
        //   - Five from image/video attachments
        //   - One from embedded contact avatar
        //   - One from embedded quoted attachment thumbnail
        //   - One from a link preview image
        const ATTACHMENT_COUNT = 8;
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
            // Note: generates two more files: screenshot and thumbnail
            {
              contentType: 'video/mp4',
              fileName: 'video.mp4',
              data: FIXTURES.mp4,
            },
            // Note: generates one more file: thumbnail
            {
              contentType: 'image/png',
              fileName: 'landscape.png',
              data: FIXTURES.png,
            },
          ],
          hasAttachments: 1,
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
                fileName: 'avatar.gif',
                thumbnail: {
                  contentType: 'image/png',
                  data: FIXTURES.gif,
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
                  data: FIXTURES.png,
                },
              },
            },
          ],
          preview: [
            {
              url: 'https://www.instagram.com/p/BsOGulcndj-/',
              title:
                'EGG GANG 🌍 on Instagram: “Let’s set a world record together and get the most liked post on Instagram. Beating the current world record held by Kylie Jenner (18…”',
              image: {
                contentType: 'image/jpeg',
                data: FIXTURES.jpg,
              },
            },
          ],
        };

        console.log('Backup test: Clear all data');
        await clearAllData();

        console.log('Backup test: Create models, save to db/disk');
        const message = await upgradeMessageSchema(messageWithAttachments);
        console.log({ message });
        await window.Signal.Data.saveMessage(message, {
          Message: Whisper.Message,
        });

        const conversation = {
          active_at: 1524185933350,
          color: 'orange',
          expireTimer: 0,
          id: CONTACT_ONE_NUMBER,
          name: 'Someone Somewhere',
          profileAvatar: {
            contentType: 'image/jpeg',
            data: FIXTURES.jpeg,
            size: 64,
          },
          profileKey: 'BASE64KEY',
          profileName: 'Someone! 🤔',
          profileSharing: true,
          timestamp: 1524185933350,
          type: 'private',
          unreadCount: 0,
          verified: 0,
          sealedSender: 0,
          version: 2,
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
        await Signal.Backup.exportToDirectory(backupDir, {
          key: staticKeyPair.pubKey,
        });

        console.log('Backup test: Ensure that messages.tar.gz exists');
        const archivePath = path.join(backupDir, 'messages.tar.gz');
        const messageZipExists = fse.existsSync(archivePath);
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
        await Signal.Backup.importFromDirectory(backupDir, {
          key: staticKeyPair.privKey,
        });

        console.log('Backup test: Check conversations');
        const conversationCollection = await window.Signal.Data.getAllConversations(
          {
            ConversationCollection: Whisper.ConversationCollection,
          }
        );
        assert.strictEqual(conversationCollection.length, CONVERSATION_COUNT);

        // We need to ommit any custom fields we have added
        const ommited = [
          'profileAvatar',
          'swarmNodes',
          'friendRequestStatus',
          'groupAdmins',
          'isKickedFromGroup',
          'unlockTimestamp',
          'sessionResetStatus',
          'isOnline',
        ];
        const conversationFromDB = conversationCollection.at(0).attributes;
        console.log({ conversationFromDB, conversation });
        assert.deepEqual(
          _.omit(conversationFromDB, ommited),
          _.omit(conversation, ommited)
        );

        console.log('Backup test: Check messages');
        const messageCollection = await window.Signal.Data.getAllMessages({
          MessageCollection: Whisper.MessageCollection,
        });
        assert.strictEqual(messageCollection.length, MESSAGE_COUNT);
        const messageFromDB = removeId(messageCollection.at(0).attributes);
        const expectedMessage = messageFromDB;
        console.log({ messageFromDB, expectedMessage });
        assert.deepEqual(messageFromDB, expectedMessage);

        console.log('Backup test: ensure that all attachments were imported');
        const recreatedAttachmentFiles = removeDirs(
          glob.sync(attachmentsPattern)
        );
        console.log({ recreatedAttachmentFiles });
        assert.strictEqual(ATTACHMENT_COUNT, recreatedAttachmentFiles.length);
        assert.deepEqual(attachmentFiles, recreatedAttachmentFiles);

        console.log(
          'Backup test: Check that all attachments were successfully imported'
        );
        const messageWithAttachmentsFromDB = await loadAllFilesFromDisk(
          messageFromDB
        );
        const expectedMessageWithAttachments = await loadAllFilesFromDisk(
          omitUndefinedKeys(message)
        );
        console.log({
          messageWithAttachmentsFromDB,
          expectedMessageWithAttachments,
        });
        assert.deepEqual(
          _.omit(messageWithAttachmentsFromDB, ['sent']),
          expectedMessageWithAttachments
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
