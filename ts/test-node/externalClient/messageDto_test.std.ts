// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import type {
  MessageDtoContextType,
  MessageSourceType,
} from '../../externalClient/messageDto.std.ts';
import { toMessageDTO } from '../../externalClient/messageDto.std.ts';
import { MessageKind } from '../../externalClient/protocol.std.ts';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import { IMAGE_PNG } from '../../types/MIME.std.ts';
import type { Emoji } from '../../axo/emoji.std.ts';

const ALICE_ACI = '00000000-0000-4000-8000-00000000000a' as AciString;
const BOB_ACI = '00000000-0000-4000-8000-00000000000b' as AciString;

const context: MessageDtoContextType = {
  resolveConversationId: serviceId =>
    ({ [ALICE_ACI]: 'conv-alice', [BOB_ACI]: 'conv-bob' })[serviceId] ?? null,
  ourConversationId: 'conv-me',
  now: 1_000_000,
  getSendStatus: () => 'delivered',
};

const incoming: MessageSourceType = {
  id: 'msg-1',
  conversationId: 'conv-alice',
  type: 'incoming',
  sent_at: 500,
  received_at_ms: 600,
  body: 'hello',
  sourceServiceId: ALICE_ACI,
  readStatus: ReadStatus.Unread,
};

describe('externalClient/messageDto', () => {
  it('maps an incoming text message with allow-listed fields only', () => {
    const extra = {
      ...incoming,
      source: '+15555550100',
      serverGuid: 'guid',
      dataMessage: new Uint8Array([1]),
    } as MessageSourceType;
    assert.deepEqual(toMessageDTO(extra, context), {
      id: 'msg-1',
      conversationId: 'conv-alice',
      direction: 'incoming',
      kind: MessageKind.Text,
      authorConversationId: 'conv-alice',
      sentAt: 500,
      receivedAt: 600,
      body: 'hello',
      bodyTruncated: false,
      mentions: [],
      attachments: [],
      quote: null,
      edited: false,
      expiresAt: null,
      read: false,
      sendStatus: null,
      reactions: [],
    });
  });

  it('attributes outgoing messages to us and leaves read unset', () => {
    const dto = toMessageDTO(
      { ...incoming, type: 'outgoing', sourceServiceId: undefined },
      context
    );
    assert.strictEqual(dto?.authorConversationId, 'conv-me');
    assert.isNull(dto?.read);
    assert.strictEqual(dto?.sendStatus, 'delivered');
  });

  it('lists reactions by conversation id, oldest first', () => {
    const dto = toMessageDTO(
      {
        ...incoming,
        reactions: [
          {
            emoji: '😂' as Emoji.Variant,
            fromId: 'conv-bob',
            targetTimestamp: 500,
            timestamp: 9,
          },
          {
            emoji: '👍' as Emoji.Variant,
            fromId: 'conv-me',
            targetTimestamp: 500,
            timestamp: 7,
          },
          {
            emoji: undefined,
            fromId: 'conv-alice',
            targetTimestamp: 500,
            timestamp: 8,
          },
        ],
      },
      context
    );
    assert.deepEqual(dto?.reactions, [
      { emoji: '👍', authorConversationId: 'conv-me' },
      { emoji: '😂', authorConversationId: 'conv-bob' },
    ]);
  });

  it('treats read and viewed messages as read', () => {
    for (const readStatus of [ReadStatus.Read, ReadStatus.Viewed, undefined]) {
      assert.isTrue(toMessageDTO({ ...incoming, readStatus }, context)?.read);
    }
  });

  it('skips notifications and other non-chat rows', () => {
    for (const type of [
      'group-v2-change',
      'timer-notification',
      'call-history',
      'keychange',
    ] as const) {
      assert.isUndefined(toMessageDTO({ ...incoming, type }, context), type);
    }
  });

  it('exposes expiry and drops expired disappearing messages', () => {
    const expireTimer = DurationInSeconds.fromSeconds(60);
    const live = toMessageDTO(
      { ...incoming, expireTimer, expirationStartTimestamp: 999_000 },
      context
    );
    assert.strictEqual(live?.expiresAt, 1_059_000);
    assert.isUndefined(
      toMessageDTO(
        { ...incoming, expireTimer, expirationStartTimestamp: 900_000 },
        context
      )
    );
  });

  it('never reveals deleted, erased or view-once content', () => {
    const content = {
      ...incoming,
      bodyRanges: [{ start: 0, length: 1, mentionAci: BOB_ACI }],
      attachments: [{ contentType: IMAGE_PNG, size: 10 }],
      quote: {
        id: 1,
        text: 'quoted',
        attachments: [],
        isViewOnce: false,
        referencedMessageNotFound: false,
      },
    };
    for (const [overrides, kind] of [
      [{ deletedForEveryone: true }, MessageKind.Deleted],
      [{ isViewOnce: true }, MessageKind.ViewOnce],
      [{ isErased: true }, MessageKind.Text],
    ] as const) {
      const dto = toMessageDTO({ ...content, ...overrides }, context);
      assert.strictEqual(dto?.kind, kind);
      assert.isNull(dto?.body);
      assert.isEmpty(dto?.mentions);
      assert.isEmpty(dto?.attachments);
      assert.isNull(dto?.quote);
    }
  });

  it('maps mentions, attachment metadata and quotes without internals', () => {
    const dto = toMessageDTO(
      {
        ...incoming,
        body: '￼ hi',
        bodyRanges: [
          { start: 0, length: 1, mentionAci: BOB_ACI },
          {
            start: 2,
            length: 2,
            mentionAci: '00000000-0000-4000-8000-0000000000ff' as AciString,
          },
        ],
        attachments: [
          {
            contentType: IMAGE_PNG,
            size: 1234,
            fileName: 'a.png',
            width: 10,
            height: 20,
            path: 'secret/path',
            localKey: 'secret-key',
          },
        ],
        quote: {
          id: 42,
          authorAci: BOB_ACI,
          text: 'earlier',
          attachments: [],
          isViewOnce: false,
          referencedMessageNotFound: false,
        },
      },
      context
    );
    assert.deepEqual(dto?.mentions, [
      { start: 0, length: 1, conversationId: 'conv-bob' },
      { start: 2, length: 2, conversationId: null },
    ]);
    assert.deepEqual(dto?.attachments, [
      {
        contentType: IMAGE_PNG,
        size: 1234,
        fileName: 'a.png',
        width: 10,
        height: 20,
      },
    ]);
    assert.deepEqual(dto?.quote, {
      authorConversationId: 'conv-bob',
      sentAt: 42,
      text: 'earlier',
    });
  });

  it('hides the text of a quoted view-once message', () => {
    const dto = toMessageDTO(
      {
        ...incoming,
        quote: {
          id: 1,
          text: 'secret',
          attachments: [],
          isViewOnce: true,
          referencedMessageNotFound: false,
        },
      },
      context
    );
    assert.isNull(dto?.quote?.text);
  });

  it('flags long, edited, sticker and unsupported messages', () => {
    assert.isTrue(
      toMessageDTO(
        {
          ...incoming,
          bodyAttachment: { contentType: IMAGE_PNG, size: 5000 },
        },
        context
      )?.bodyTruncated
    );
    assert.isTrue(
      toMessageDTO(
        {
          ...incoming,
          editHistory: [
            { body: 'b', timestamp: 2, received_at: 2 },
            { body: 'a', timestamp: 1, received_at: 1 },
          ],
        },
        context
      )?.edited
    );
    assert.strictEqual(
      toMessageDTO(
        {
          ...incoming,
          body: undefined,
          sticker: {
            packId: 'p',
            stickerId: 1,
            packKey: 'k',
            data: { contentType: IMAGE_PNG, size: 1 },
          },
        },
        context
      )?.kind,
      MessageKind.Sticker
    );
    assert.strictEqual(
      toMessageDTO({ ...incoming, body: undefined }, context)?.kind,
      MessageKind.Unsupported
    );
  });
});
