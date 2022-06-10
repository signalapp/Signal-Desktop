// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Message from '../../../types/message/initializeAttachmentMetadata';
import { SignalService } from '../../../protobuf';
import * as MIME from '../../../types/MIME';
import * as Bytes from '../../../Bytes';
import type { MessageAttributesType } from '../../../model-types.d';

function getDefaultMessage(
  props?: Partial<MessageAttributesType>
): MessageAttributesType {
  return {
    id: 'some-id',
    type: 'incoming',
    sent_at: 45,
    received_at: 45,
    timestamp: 45,
    conversationId: 'some-conversation-id',
    ...props,
  };
}

describe('Message', () => {
  describe('initializeAttachmentMetadata', () => {
    it('should classify visual media attachments', async () => {
      const input = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.IMAGE_JPEG,
            data: Bytes.fromString('foo'),
            fileName: 'foo.jpg',
            size: 1111,
          },
        ],
      });
      const expected = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.IMAGE_JPEG,
            data: Bytes.fromString('foo'),
            fileName: 'foo.jpg',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: 1,
        hasFileAttachments: undefined,
      });

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('should classify file attachments', async () => {
      const input = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.APPLICATION_OCTET_STREAM,
            data: Bytes.fromString('foo'),
            fileName: 'foo.bin',
            size: 1111,
          },
        ],
      });
      const expected = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.APPLICATION_OCTET_STREAM,
            data: Bytes.fromString('foo'),
            fileName: 'foo.bin',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: 1,
      });

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('should classify voice message attachments', async () => {
      const input = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: Bytes.fromString('foo'),
            fileName: 'Voice Message.aac',
            size: 1111,
          },
        ],
      });
      const expected = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.AUDIO_AAC,
            flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
            data: Bytes.fromString('foo'),
            fileName: 'Voice Message.aac',
            size: 1111,
          },
        ],
        hasAttachments: 1,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      });

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('does not include long message attachments', async () => {
      const input = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.LONG_MESSAGE,
            data: Bytes.fromString('foo'),
            fileName: 'message.txt',
            size: 1111,
          },
        ],
      });
      const expected = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [
          {
            contentType: MIME.LONG_MESSAGE,
            data: Bytes.fromString('foo'),
            fileName: 'message.txt',
            size: 1111,
          },
        ],
        hasAttachments: 0,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      });

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });

    it('handles not attachments', async () => {
      const input = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [],
      });
      const expected = getDefaultMessage({
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [],
        hasAttachments: 0,
        hasVisualMediaAttachments: undefined,
        hasFileAttachments: undefined,
      });

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });
  });
});
