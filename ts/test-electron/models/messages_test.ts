// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { SendStatus } from '../../messages/MessageSendState';
import MessageSender from '../../textsecure/SendMessage';
import type { WebAPIType } from '../../textsecure/WebAPI';
import type { CallbackResultType } from '../../textsecure/Types.d';
import type { StorageAccessType } from '../../types/Storage.d';
import { UUID } from '../../types/UUID';
import { SignalService as Proto } from '../../protobuf';
import { getContact } from '../../messages/helpers';

describe('Message', () => {
  const STORAGE_KEYS_TO_RESTORE: Array<keyof StorageAccessType> = [
    'number_id',
    'uuid_id',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldStorageValues = new Map<keyof StorageAccessType, any>();

  const i18n = setupI18n('en', enMessages);

  const attributes = {
    type: 'outgoing',
    body: 'hi',
    conversationId: 'foo',
    attachments: [],
    received_at: new Date().getTime(),
  };

  const source = '+1 415-555-5555';
  const me = '+14155555556';
  const ourUuid = UUID.generate().toString();

  function createMessage(attrs: { [key: string]: unknown }) {
    const messages = new window.Whisper.MessageCollection();
    return messages.add({
      received_at: Date.now(),
      ...attrs,
    });
  }

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    STORAGE_KEYS_TO_RESTORE.forEach(key => {
      oldStorageValues.set(key, window.textsecure.storage.get(key));
    });
    window.textsecure.storage.put('number_id', `${me}.2`);
    window.textsecure.storage.put('uuid_id', `${ourUuid}.2`);
  });

  after(async () => {
    await window.Signal.Data.removeAll();
    await window.storage.fetch();

    oldStorageValues.forEach((oldValue, key) => {
      if (oldValue) {
        window.textsecure.storage.put(key, oldValue);
      } else {
        window.textsecure.storage.remove(key);
      }
    });
  });

  beforeEach(function beforeEach() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  // NOTE: These tests are incomplete.
  describe('send', () => {
    let oldMessageSender: undefined | MessageSender;

    beforeEach(function beforeEach() {
      oldMessageSender = window.textsecure.messaging;

      window.textsecure.messaging =
        oldMessageSender ?? new MessageSender({} as WebAPIType);
      this.sandbox
        .stub(window.textsecure.messaging, 'sendSyncMessage')
        .resolves({});
    });

    afterEach(() => {
      if (oldMessageSender) {
        window.textsecure.messaging = oldMessageSender;
      } else {
        // `window.textsecure.messaging` can be undefined in tests. Instead of updating
        //   the real type, I just ignore it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window.textsecure as any).messaging;
      }
    });

    it('updates `sendStateByConversationId`', async function test() {
      this.sandbox.useFakeTimers(1234);

      const ourConversationId =
        window.ConversationController.getOurConversationIdOrThrow();
      const conversation1 =
        await window.ConversationController.getOrCreateAndWait(
          'a072df1d-7cee-43e2-9e6b-109710a2131c',
          'private'
        );
      const conversation2 =
        await window.ConversationController.getOrCreateAndWait(
          '62bd8ef1-68da-4cfd-ac1f-3ea85db7473e',
          'private'
        );

      const message = createMessage({
        type: 'outgoing',
        conversationId: (
          await window.ConversationController.getOrCreateAndWait(
            '71cc190f-97ba-4c61-9d41-0b9444d721f9',
            'group'
          )
        ).id,
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Pending,
            updatedAt: 123,
          },
          [conversation1.id]: {
            status: SendStatus.Pending,
            updatedAt: 123,
          },
          [conversation2.id]: {
            status: SendStatus.Pending,
            updatedAt: 456,
          },
        },
      });

      const fakeDataMessage = new Uint8Array(0);
      const conversation1Uuid = conversation1.get('uuid');
      const ignoredUuid = UUID.generate().toString();

      if (!conversation1Uuid) {
        throw new Error('Test setup failed: conversation1 should have a UUID');
      }

      const promise = Promise.resolve<CallbackResultType>({
        successfulIdentifiers: [conversation1Uuid, ignoredUuid],
        errors: [
          Object.assign(new Error('failed'), {
            identifier: conversation2.get('uuid'),
          }),
        ],
        dataMessage: fakeDataMessage,
      });

      await message.send(promise);

      const result = message.get('sendStateByConversationId') || {};
      assert.hasAllKeys(result, [
        ourConversationId,
        conversation1.id,
        conversation2.id,
      ]);
      assert.strictEqual(result[ourConversationId]?.status, SendStatus.Sent);
      assert.strictEqual(result[ourConversationId]?.updatedAt, 1234);
      assert.strictEqual(result[conversation1.id]?.status, SendStatus.Sent);
      assert.strictEqual(result[conversation1.id]?.updatedAt, 1234);
      assert.strictEqual(result[conversation2.id]?.status, SendStatus.Failed);
      assert.strictEqual(result[conversation2.id]?.updatedAt, 1234);
    });

    it('saves errors from promise rejections with errors', async () => {
      const message = createMessage({ type: 'outgoing', source });

      const promise = Promise.reject(new Error('foo bar'));
      await message.send(promise);

      const errors = message.get('errors') || [];
      assert.lengthOf(errors, 1);
      assert.strictEqual(errors[0].message, 'foo bar');
    });

    it('saves errors from promise rejections with objects', async () => {
      const message = createMessage({ type: 'outgoing', source });

      const result = {
        errors: [new Error('baz qux')],
      };
      const promise = Promise.reject(result);
      await message.send(promise);

      const errors = message.get('errors') || [];
      assert.lengthOf(errors, 1);
      assert.strictEqual(errors[0].message, 'baz qux');
    });
  });

  describe('getContact', () => {
    it('gets outgoing contact', () => {
      const messages = new window.Whisper.MessageCollection();
      const message = messages.add(attributes);
      assert.exists(getContact(message.attributes));
    });

    it('gets incoming contact', () => {
      const messages = new window.Whisper.MessageCollection();
      const message = messages.add({
        type: 'incoming',
        source,
      });
      assert.exists(getContact(message.attributes));
    });
  });

  // Note that some of this method's behavior is untested:
  // - Call history
  // - Contacts
  // - Expiration timer updates
  // - Key changes
  // - Profile changes
  // - Stickers
  describe('getNotificationData', () => {
    it('handles unsupported messages', () => {
      assert.deepEqual(
        createMessage({
          supportedVersionAtReceive: 0,
          requiredProtocolVersion: Infinity,
        }).getNotificationData(),
        { text: 'Unsupported message' }
      );
    });

    it('handles erased tap-to-view messages', () => {
      assert.deepEqual(
        createMessage({
          isViewOnce: true,
          isErased: true,
        }).getNotificationData(),
        { text: 'View-once Media' }
      );
    });

    it('handles tap-to-view photos', () => {
      assert.deepEqual(
        createMessage({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: 'image/png',
            },
          ],
        }).getNotificationData(),
        { text: 'View-once Photo', emoji: '📷' }
      );
    });

    it('handles tap-to-view videos', () => {
      assert.deepEqual(
        createMessage({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: 'video/mp4',
            },
          ],
        }).getNotificationData(),
        { text: 'View-once Video', emoji: '🎥' }
      );
    });

    it('handles non-media tap-to-view file types', () => {
      assert.deepEqual(
        createMessage({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: 'text/plain',
            },
          ],
        }).getNotificationData(),
        { text: 'Media Message', emoji: '📎' }
      );
    });

    it('handles group updates where you left the group', () => {
      assert.deepEqual(
        createMessage({
          group_update: {
            left: 'You',
          },
        }).getNotificationData(),
        { text: 'You are no longer a member of the group.' }
      );
    });

    it('handles group updates where someone left the group', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: {
            left: 'Alice',
          },
        }).getNotificationData(),
        { text: 'Alice left the group.' }
      );
    });

    it('handles empty group updates with a generic message', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source: 'Alice',
          group_update: {},
        }).getNotificationData(),
        { text: 'Alice updated the group.' }
      );
    });

    it('handles group name updates by you', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source: me,
          group_update: { name: 'blerg' },
        }).getNotificationData(),
        {
          text: "You updated the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles group name updates by someone else', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { name: 'blerg' },
        }).getNotificationData(),
        {
          text: "+1 415-555-5555 updated the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles group avatar updates', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { avatarUpdated: true },
        }).getNotificationData(),
        {
          text: '+1 415-555-5555 updated the group. Group avatar was updated.',
        }
      );
    });

    it('handles you joining the group', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { joined: [me] },
        }).getNotificationData(),
        {
          text: '+1 415-555-5555 updated the group. You joined the group.',
        }
      );
    });

    it('handles someone else joining the group', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { joined: ['Bob'] },
        }).getNotificationData(),
        {
          text: '+1 415-555-5555 updated the group. Bob joined the group.',
        }
      );
    });

    it('handles multiple people joining the group', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { joined: ['Bob', 'Alice', 'Eve'] },
        }).getNotificationData(),
        {
          text: '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group.',
        }
      );
    });

    it('handles multiple people joining the group, including you', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { joined: ['Bob', me, 'Alice', 'Eve'] },
        }).getNotificationData(),
        {
          text: '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group. You joined the group.',
        }
      );
    });

    it('handles multiple changes to group properties', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          group_update: { joined: ['Bob'], name: 'blerg' },
        }).getNotificationData(),
        {
          text: "+1 415-555-5555 updated the group. Bob joined the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles a session ending', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          flags: true,
        }).getNotificationData(),
        { text: i18n('sessionEnded') }
      );
    });

    it('handles incoming message errors', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          errors: [{}],
        }).getNotificationData(),
        { text: i18n('incomingError') }
      );
    });

    const attachmentTestCases = [
      {
        title: 'GIF',
        attachment: {
          contentType: 'image/gif',
        },
        expectedText: 'GIF',
        expectedEmoji: '🎡',
      },
      {
        title: 'photo',
        attachment: {
          contentType: 'image/png',
        },
        expectedText: 'Photo',
        expectedEmoji: '📷',
      },
      {
        title: 'video',
        attachment: {
          contentType: 'video/mp4',
        },
        expectedText: 'Video',
        expectedEmoji: '🎥',
      },
      {
        title: 'voice message',
        attachment: {
          contentType: 'audio/ogg',
          flags: Proto.AttachmentPointer.Flags.VOICE_MESSAGE,
        },
        expectedText: 'Voice Message',
        expectedEmoji: '🎤',
      },
      {
        title: 'audio message',
        attachment: {
          contentType: 'audio/ogg',
          fileName: 'audio.ogg',
        },
        expectedText: 'Audio Message',
        expectedEmoji: '🔈',
      },
      {
        title: 'plain text',
        attachment: {
          contentType: 'text/plain',
        },
        expectedText: 'File',
        expectedEmoji: '📎',
      },
      {
        title: 'unspecified-type',
        attachment: {
          contentType: null,
        },
        expectedText: 'File',
        expectedEmoji: '📎',
      },
    ];
    attachmentTestCases.forEach(
      ({ title, attachment, expectedText, expectedEmoji }) => {
        it(`handles single ${title} attachments`, () => {
          assert.deepEqual(
            createMessage({
              type: 'incoming',
              source,
              attachments: [attachment],
            }).getNotificationData(),
            { text: expectedText, emoji: expectedEmoji }
          );
        });

        it(`handles multiple attachments where the first is a ${title}`, () => {
          assert.deepEqual(
            createMessage({
              type: 'incoming',
              source,
              attachments: [
                attachment,
                {
                  contentType: 'text/html',
                },
              ],
            }).getNotificationData(),
            { text: expectedText, emoji: expectedEmoji }
          );
        });

        it(`respects the caption for ${title} attachments`, () => {
          assert.deepEqual(
            createMessage({
              type: 'incoming',
              source,
              attachments: [attachment],
              body: 'hello world',
            }).getNotificationData(),
            { text: 'hello world', emoji: expectedEmoji }
          );
        });
      }
    );

    it('handles a "plain" message', () => {
      assert.deepEqual(
        createMessage({
          type: 'incoming',
          source,
          body: 'hello world',
        }).getNotificationData(),
        { text: 'hello world' }
      );
    });
  });

  describe('getNotificationText', () => {
    it("returns a notification's text", () => {
      assert.strictEqual(
        createMessage({
          type: 'incoming',
          source,
          body: 'hello world',
        }).getNotificationText(),
        'hello world'
      );
    });

    it("shows a notification's emoji on non-Linux", function test() {
      this.sandbox.replace(window.Signal, 'OS', {
        ...window.Signal.OS,
        isLinux() {
          return false;
        },
      });

      assert.strictEqual(
        createMessage({
          type: 'incoming',
          source,
          attachments: [
            {
              contentType: 'image/png',
            },
          ],
        }).getNotificationText(),
        '📷 Photo'
      );
    });

    it('hides emoji on Linux', function test() {
      this.sandbox.replace(window.Signal, 'OS', {
        ...window.Signal.OS,
        isLinux() {
          return true;
        },
      });

      assert.strictEqual(
        createMessage({
          type: 'incoming',
          source,
          attachments: [
            {
              contentType: 'image/png',
            },
          ],
        }).getNotificationText(),
        'Photo'
      );
    });
  });
});

describe('MessageCollection', () => {
  it('should be ordered oldest to newest', () => {
    const messages = new window.Whisper.MessageCollection();
    // Timestamps
    const today = Date.now();
    const tomorrow = today + 12345;

    // Add threads
    messages.add({ received_at: today });
    messages.add({ received_at: tomorrow });

    const { models } = messages;
    const firstTimestamp = models[0].get('received_at');
    const secondTimestamp = models[1].get('received_at');

    // Compare timestamps
    assert(typeof firstTimestamp === 'number');
    assert(typeof secondTimestamp === 'number');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    assert(firstTimestamp! < secondTimestamp!);
  });
});
