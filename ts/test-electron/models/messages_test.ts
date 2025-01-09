// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as generateUuid } from 'uuid';

import type { AttachmentType } from '../../types/Attachment';
import type { CallbackResultType } from '../../textsecure/Types.d';
import type { ConversationModel } from '../../models/conversations';
import type { MessageAttributesType } from '../../model-types.d';
import { MessageModel } from '../../models/messages';
import type { RawBodyRange } from '../../types/BodyRange';
import type { StorageAccessType } from '../../types/Storage.d';
import type { WebAPIType } from '../../textsecure/WebAPI';
import { DataWriter } from '../../sql/Client';
import MessageSender from '../../textsecure/SendMessage';
import enMessages from '../../../_locales/en/messages.json';
import { SendStatus } from '../../messages/MessageSendState';
import { SignalService as Proto } from '../../protobuf';
import { generateAci } from '../../types/ServiceId';
import { getAuthor } from '../../messages/helpers';
import { setupI18n } from '../../util/setupI18n';
import {
  APPLICATION_JSON,
  AUDIO_MP3,
  IMAGE_GIF,
  IMAGE_PNG,
  LONG_MESSAGE,
  TEXT_ATTACHMENT,
  VIDEO_MP4,
} from '../../types/MIME';
import { getNotificationDataForMessage } from '../../util/getNotificationDataForMessage';
import { getNotificationTextForMessage } from '../../util/getNotificationTextForMessage';
import { send } from '../../messages/send';

describe('Message', () => {
  const STORAGE_KEYS_TO_RESTORE: Array<keyof StorageAccessType> = [
    'number_id',
    'uuid_id',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldStorageValues = new Map<keyof StorageAccessType, any>();

  const i18n = setupI18n('en', enMessages);

  const attributes = {
    type: 'outgoing' as const,
    body: 'hi',
    conversationId: 'foo',
    attachments: [],
    received_at: new Date().getTime(),
  };

  const source = '+1 415-555-5555';
  const me = '+14155555556';
  const ourServiceId = generateAci();

  function createMessage(attrs: Partial<MessageAttributesType>): MessageModel {
    const id = generateUuid();
    return window.MessageCache.register(
      new MessageModel({
        id,
        ...attrs,
        sent_at: Date.now(),
        received_at: Date.now(),
      } as MessageAttributesType)
    );
  }

  function createMessageAndGetNotificationData(attrs: {
    [key: string]: unknown;
  }) {
    const message = createMessage(attrs);
    return getNotificationDataForMessage(message.attributes);
  }

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    STORAGE_KEYS_TO_RESTORE.forEach(key => {
      oldStorageValues.set(key, window.textsecure.storage.get(key));
    });
    await window.textsecure.storage.put('number_id', `${me}.2`);
    await window.textsecure.storage.put('uuid_id', `${ourServiceId}.2`);
  });

  after(async () => {
    await DataWriter.removeAll();
    await window.storage.fetch();

    await Promise.all(
      Array.from(oldStorageValues.entries()).map(([key, oldValue]) => {
        if (oldValue) {
          return window.textsecure.storage.put(key, oldValue);
        }
        return window.textsecure.storage.remove(key);
      })
    );
  });

  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();
  });

  // NOTE: These tests are incomplete.
  describe('send', () => {
    let oldMessageSender: undefined | MessageSender;

    beforeEach(function (this: Mocha.Context) {
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

    it('updates `sendStateByConversationId`', async function (this: Mocha.Context) {
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
      const conversation1Uuid = conversation1.getServiceId();
      const ignoredUuid = generateAci();

      if (!conversation1Uuid) {
        throw new Error('Test setup failed: conversation1 should have a UUID');
      }

      const promise = Promise.resolve<CallbackResultType>({
        successfulServiceIds: [conversation1Uuid, ignoredUuid],
        errors: [
          Object.assign(new Error('failed'), {
            serviceId: conversation2.getServiceId(),
          }),
        ],
        dataMessage: fakeDataMessage,
        editMessage: undefined,
      });

      await send(message, {
        promise,
        targetTimestamp: message.get('timestamp'),
      });

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
      await send(message, {
        promise,
        targetTimestamp: message.get('timestamp'),
      });

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
      await send(message, {
        promise,
        targetTimestamp: message.get('timestamp'),
      });

      const errors = message.get('errors') || [];
      assert.lengthOf(errors, 1);
      assert.strictEqual(errors[0].message, 'baz qux');
    });
  });

  describe('getContact', () => {
    it('gets outgoing contact', () => {
      const message = createMessage(attributes);
      assert.exists(getAuthor(message.attributes));
    });

    it('gets incoming contact', () => {
      const message = createMessage({
        type: 'incoming',
        source,
      });
      assert.exists(getAuthor(message.attributes));
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
    let alice: ConversationModel | undefined;
    let bob: ConversationModel | undefined;
    let eve: ConversationModel | undefined;
    before(() => {
      alice = window.ConversationController.getOrCreate(
        generateUuid(),
        'private'
      );
      alice.set({ systemGivenName: 'Alice' });

      bob = window.ConversationController.getOrCreate(
        generateUuid(),
        'private'
      );
      bob.set({ systemGivenName: 'Bob' });

      eve = window.ConversationController.getOrCreate(
        generateUuid(),
        'private'
      );
      eve.set({ systemGivenName: 'Eve' });
    });

    it('handles unsupported messages', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          supportedVersionAtReceive: 0,
          requiredProtocolVersion: Infinity,
        }),
        { text: 'Unsupported message' }
      );
    });

    it('handles erased tap-to-view messages', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          isViewOnce: true,
          isErased: true,
        }),
        { text: 'View-once Media' }
      );
    });

    it('handles tap-to-view photos', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: IMAGE_PNG,
              size: 0,
            },
          ],
        }),
        { text: 'View-once Photo', emoji: '📷' }
      );
    });

    it('handles tap-to-view videos', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: VIDEO_MP4,
              size: 0,
            },
          ],
        }),
        { text: 'View-once Video', emoji: '🎥' }
      );
    });

    it('handles non-media tap-to-view file types', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          isViewOnce: true,
          isErased: false,
          attachments: [
            {
              contentType: LONG_MESSAGE,
              size: 0,
            },
          ],
        }),
        { text: 'Media Message', emoji: '📎' }
      );
    });

    it('handles group updates where you left the group', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          group_update: {
            left: 'You',
          },
        }),
        { text: 'You are no longer a member of the group.' }
      );
    });

    it('handles group updates where someone left the group', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: {
            left: alice?.getServiceId(),
          },
        }),
        { text: 'Alice left the group.' }
      );
    });

    it('handles empty group updates with a generic message', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source: alice?.getServiceId(),
          group_update: {},
        }),
        { text: 'Alice updated the group.' }
      );
    });

    it('handles group name updates by you', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source: me,
          group_update: { name: 'blerg' },
        }),
        {
          text: "You updated the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles group name updates by someone else', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: { name: 'blerg' },
        }),
        {
          text: "+1 415-555-5555 updated the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles group avatar updates', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: { avatarUpdated: true },
        }),
        {
          text: '+1 415-555-5555 updated the group. Group avatar was updated.',
        }
      );
    });

    it('handles you joining the group', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: { joined: [me] },
        }),
        {
          text: '+1 415-555-5555 updated the group. You joined the group.',
        }
      );
    });

    it('handles someone else joining the group', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: { joined: [bob?.getServiceId()] },
        }),
        {
          text: '+1 415-555-5555 updated the group. Bob joined the group.',
        }
      );
    });

    it('handles multiple people joining the group', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: {
            joined: [
              bob?.getServiceId(),
              alice?.getServiceId(),
              eve?.getServiceId(),
            ],
          },
        }),
        {
          text: '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group.',
        }
      );
    });

    it('handles multiple people joining the group, including you', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: {
            joined: [
              bob?.getServiceId(),
              me,
              alice?.getServiceId(),
              eve?.getServiceId(),
            ],
          },
        }),
        {
          text: '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group. You joined the group.',
        }
      );
    });

    it('handles multiple changes to group properties', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          group_update: { joined: [bob?.getServiceId()], name: 'blerg' },
        }),
        {
          text: "+1 415-555-5555 updated the group. Bob joined the group. Group name is now 'blerg'.",
        }
      );
    });

    it('handles a session ending', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          flags: 1,
        }),
        { text: i18n('icu:sessionEnded') }
      );
    });

    it('handles incoming message errors', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          errors: [new Error()],
        }),
        { text: i18n('icu:incomingError') }
      );
    });

    const attachmentTestCases: Array<{
      title: string;
      attachment: AttachmentType;
      expectedResult: {
        text: string;
        emoji: string;
        bodyRanges?: Array<RawBodyRange>;
      };
    }> = [
      {
        title: 'GIF',
        attachment: {
          contentType: IMAGE_GIF,
          size: 0,
        },
        expectedResult: {
          text: 'GIF',
          emoji: '🎡',
          bodyRanges: [],
        },
      },
      {
        title: 'photo',
        attachment: {
          contentType: IMAGE_PNG,
          size: 0,
        },
        expectedResult: {
          text: 'Photo',
          emoji: '📷',
          bodyRanges: [],
        },
      },
      {
        title: 'video',
        attachment: {
          contentType: VIDEO_MP4,
          size: 0,
        },
        expectedResult: {
          text: 'Video',
          emoji: '🎥',
          bodyRanges: [],
        },
      },
      {
        title: 'voice message',
        attachment: {
          contentType: AUDIO_MP3,
          flags: Proto.AttachmentPointer.Flags.VOICE_MESSAGE,
          size: 0,
        },
        expectedResult: {
          text: 'Voice Message',
          emoji: '🎤',
          bodyRanges: [],
        },
      },
      {
        title: 'audio message',
        attachment: {
          contentType: AUDIO_MP3,
          fileName: 'audio.mp3',
          size: 0,
        },
        expectedResult: {
          text: 'Audio Message',
          emoji: '🔈',
          bodyRanges: [],
        },
      },
      {
        title: 'plain text',
        attachment: {
          contentType: LONG_MESSAGE,
          size: 0,
        },
        expectedResult: {
          text: 'File',
          emoji: '📎',
          bodyRanges: [],
        },
      },
      {
        title: 'unspecified-type',
        attachment: {
          contentType: APPLICATION_JSON,
          size: 0,
        },
        expectedResult: {
          text: 'File',
          emoji: '📎',
          bodyRanges: [],
        },
      },
    ];
    attachmentTestCases.forEach(({ title, attachment, expectedResult }) => {
      it(`handles single ${title} attachments`, () => {
        assert.deepEqual(
          createMessageAndGetNotificationData({
            type: 'incoming',
            source,
            attachments: [attachment],
          }),
          expectedResult
        );
      });

      it(`handles multiple attachments where the first is a ${title}`, () => {
        assert.deepEqual(
          createMessageAndGetNotificationData({
            type: 'incoming',
            source,
            attachments: [
              attachment,
              {
                contentType: TEXT_ATTACHMENT,
                size: 0,
              },
            ],
          }),
          expectedResult
        );
      });

      it(`respects the caption for ${title} attachments`, () => {
        assert.deepEqual(
          createMessageAndGetNotificationData({
            type: 'incoming',
            source,
            attachments: [attachment],
            body: 'hello world',
          }),
          { ...expectedResult, text: 'hello world' }
        );
      });
    });

    it('handles a "plain" message', () => {
      assert.deepEqual(
        createMessageAndGetNotificationData({
          type: 'incoming',
          source,
          body: 'hello world',
        }),
        { text: 'hello world', bodyRanges: [] }
      );
    });
  });

  describe('getNotificationText', () => {
    it("returns a notification's text", async () => {
      const message = createMessage({
        conversationId: (
          await window.ConversationController.getOrCreateAndWait(
            generateUuid(),
            'private'
          )
        ).id,
        type: 'incoming',
        source,
        body: 'hello world',
      });

      assert.strictEqual(
        getNotificationTextForMessage(message.attributes),
        'hello world'
      );
    });

    it("shows a notification's emoji on non-Linux", async function (this: Mocha.Context) {
      this.sandbox.replace(window.Signal, 'OS', {
        ...window.Signal.OS,
        isLinux() {
          return false;
        },
      });
      const message = createMessage({
        conversationId: (
          await window.ConversationController.getOrCreateAndWait(
            generateUuid(),
            'private'
          )
        ).id,
        type: 'incoming',
        source,
        attachments: [
          {
            contentType: IMAGE_PNG,
            size: 0,
          },
        ],
      });
      assert.strictEqual(
        getNotificationTextForMessage(message.attributes),
        '📷 Photo'
      );
    });

    it('hides emoji on Linux', async function (this: Mocha.Context) {
      this.sandbox.replace(window.Signal, 'OS', {
        ...window.Signal.OS,
        isLinux() {
          return true;
        },
      });

      const message = createMessage({
        conversationId: (
          await window.ConversationController.getOrCreateAndWait(
            generateUuid(),
            'private'
          )
        ).id,
        type: 'incoming',
        source,
        attachments: [
          {
            contentType: IMAGE_PNG,
            size: 0,
          },
        ],
      });

      assert.strictEqual(
        getNotificationTextForMessage(message.attributes),
        'Photo'
      );
    });
  });
});
