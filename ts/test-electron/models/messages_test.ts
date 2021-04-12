// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

describe('Message', () => {
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
  const ourUuid = window.getGuid();

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
    window.textsecure.storage.put('number_id', `${me}.2`);
    window.textsecure.storage.put('uuid_id', `${ourUuid}.2`);
  });

  after(async () => {
    window.textsecure.storage.put('number_id', null);
    window.textsecure.storage.put('uuid_id', null);

    await window.Signal.Data.removeAll();
    await window.storage.fetch();
  });

  beforeEach(function beforeEach() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  // NOTE: These tests are incomplete.
  describe('send', () => {
    it("saves the result's dataMessage", async () => {
      const message = createMessage({ type: 'outgoing', source });

      const fakeDataMessage = new ArrayBuffer(0);
      const result = {
        dataMessage: fakeDataMessage,
      };
      const promise = Promise.resolve(result);
      await message.send(promise);

      assert.strictEqual(message.get('dataMessage'), fakeDataMessage);
    });

    it('updates the `sent` attribute', async () => {
      const message = createMessage({ type: 'outgoing', source, sent: false });

      await message.send(Promise.resolve({}));

      assert.isTrue(message.get('sent'));
    });

    it("triggers the 'done' event on success", async () => {
      const message = createMessage({ type: 'outgoing', source });

      let callCount = 0;
      message.on('done', () => {
        callCount += 1;
      });

      await message.send(Promise.resolve({}));

      assert.strictEqual(callCount, 1);
    });

    it("triggers the 'sent' event on success", async () => {
      const message = createMessage({ type: 'outgoing', source });

      const listener = sinon.spy();
      message.on('sent', listener);

      await message.send(Promise.resolve({}));

      sinon.assert.calledOnce(listener);
      sinon.assert.calledWith(listener, message);
    });

    it("triggers the 'done' event on failure", async () => {
      const message = createMessage({ type: 'outgoing', source });

      const listener = sinon.spy();
      message.on('done', listener);

      await message.send(Promise.reject(new Error('something went wrong!')));

      sinon.assert.calledOnce(listener);
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
      message.getContact();
    });

    it('gets incoming contact', () => {
      const messages = new window.Whisper.MessageCollection();
      const message = messages.add({
        type: 'incoming',
        source,
      });
      message.getContact();
    });
  });

  describe('isIncoming', () => {
    it('checks if is incoming message', () => {
      const messages = new window.Whisper.MessageCollection();
      let message = messages.add(attributes);
      assert.notOk(message.isIncoming());
      message = messages.add({ type: 'incoming' });
      assert.ok(message.isIncoming());
    });
  });

  describe('isOutgoing', () => {
    it('checks if is outgoing message', () => {
      const messages = new window.Whisper.MessageCollection();
      let message = messages.add(attributes);
      assert.ok(message.isOutgoing());
      message = messages.add({ type: 'incoming' });
      assert.notOk(message.isOutgoing());
    });
  });

  describe('isGroupUpdate', () => {
    it('checks if is group update', () => {
      const messages = new window.Whisper.MessageCollection();
      let message = messages.add(attributes);
      assert.notOk(message.isGroupUpdate());

      message = messages.add({ group_update: true });
      assert.ok(message.isGroupUpdate());
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
          text:
            '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group.',
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
          text:
            '+1 415-555-5555 updated the group. Bob, Alice, Eve joined the group. You joined the group.',
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
          text:
            "+1 415-555-5555 updated the group. Bob joined the group. Group name is now 'blerg'.",
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
          flags:
            window.textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
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
      this.sandbox.stub(window.Signal.OS, 'isLinux').returns(false);

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
      this.sandbox.stub(window.Signal.OS, 'isLinux').returns(true);

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

  describe('isEndSession', () => {
    it('checks if it is end of the session', () => {
      const messages = new window.Whisper.MessageCollection();
      let message = messages.add(attributes);
      assert.notOk(message.isEndSession());

      message = messages.add({ type: 'incoming', source, flags: true });
      assert.ok(message.isEndSession());
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
