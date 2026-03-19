// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type {
  EditHistoryType,
  MessageAttributesType,
} from '../../model-types.d.ts';
import type { AttachmentType } from '../../types/Attachment.std.js';
import { IMAGE_JPEG, LONG_MESSAGE } from '../../types/MIME.std.js';
import { generateMessageId } from '../../util/generateMessageId.node.js';
import { ensureBodyAttachmentsAreSeparated } from '../../util/queueAttachmentDownloads.preload.js';
import { createLogger } from '../../logging/log.std.js';

const logger = createLogger('queueAttachmentDownloads_test');

export function composeMessage(
  overrides?: Partial<MessageAttributesType>
): MessageAttributesType {
  return {
    ...generateMessageId(Date.now()),
    sent_at: Date.now(),
    timestamp: Date.now(),
    type: 'incoming',
    conversationId: 'conversationId',
    ...overrides,
  };
}
export function composeAttachment(
  overrides?: Partial<AttachmentType>
): AttachmentType {
  return {
    size: 100,
    contentType: IMAGE_JPEG,
    ...overrides,
  };
}

describe('ensureBodyAttachmentsAreSeparated', () => {
  it('separates first body attachment out, and drops any additional ones', () => {
    const msg = composeMessage({
      attachments: [
        composeAttachment({
          clientUuid: 'normal attachment',
          contentType: IMAGE_JPEG,
        }),
        composeAttachment({
          clientUuid: 'long message 1',
          contentType: LONG_MESSAGE,
        }),
        composeAttachment({
          clientUuid: 'long message 2',
          contentType: LONG_MESSAGE,
        }),
      ],
    });
    const result = ensureBodyAttachmentsAreSeparated(msg, {
      logId: 'test',
      logger,
    });
    assert.deepEqual(result.attachments, [msg.attachments?.[0]]);
    assert.deepEqual(result.bodyAttachment, msg.attachments?.[1]);
  });
  it('retains existing bodyAttachment', () => {
    const msg = composeMessage({
      bodyAttachment: composeAttachment({
        clientUuid: 'existing body attachment',
        contentType: LONG_MESSAGE,
      }),
      attachments: [
        composeAttachment({
          clientUuid: 'normal attachment',
          contentType: IMAGE_JPEG,
        }),
        composeAttachment({
          clientUuid: 'long message 1',
          contentType: LONG_MESSAGE,
        }),
      ],
    });
    const result = ensureBodyAttachmentsAreSeparated(msg, {
      logId: 'test',
      logger,
    });
    assert.deepEqual(result.attachments, [msg.attachments?.[0]]);
    assert.deepEqual(result.bodyAttachment, msg.bodyAttachment);
  });
  it('separates first body attachment out for all editHistory', () => {
    const normalAttachment = composeAttachment({
      clientUuid: 'normal attachment',
      contentType: IMAGE_JPEG,
    });

    const longMessageAttachment1 = composeAttachment({
      clientUuid: 'long message attachment 1',
      contentType: LONG_MESSAGE,
    });

    const longMessageAttachment2 = composeAttachment({
      clientUuid: 'long message attachment 2',
      contentType: LONG_MESSAGE,
    });

    const editAttachment1 = composeAttachment({
      clientUuid: 'edit attachment 1',
      contentType: IMAGE_JPEG,
    });

    const editAttachment2 = composeAttachment({
      clientUuid: 'edit attachment 2',
      contentType: IMAGE_JPEG,
    });

    const bodyAttachment = composeAttachment({
      clientUuid: 'long message attachment already as bodyattachment',
      contentType: LONG_MESSAGE,
    });

    const edit1: EditHistoryType = {
      timestamp: Date.now(),
      received_at: Date.now(),
      attachments: [
        editAttachment1,
        longMessageAttachment1,
        longMessageAttachment2,
      ],
    };

    const edit2: EditHistoryType = {
      timestamp: Date.now(),
      received_at: Date.now(),
      bodyAttachment,
      attachments: [editAttachment1, editAttachment2],
    };

    const msg = composeMessage({
      attachments: [
        normalAttachment,
        longMessageAttachment1,
        longMessageAttachment2,
      ],
      editHistory: [edit1, edit2],
    });
    const result = ensureBodyAttachmentsAreSeparated(msg, {
      logId: 'test',
      logger,
    });

    assert.deepEqual(result.attachments, [normalAttachment]);
    assert.deepEqual(result.bodyAttachment, longMessageAttachment1);
    assert.deepEqual(result.editHistory, [
      {
        ...edit1,
        attachments: [editAttachment1],
        bodyAttachment: longMessageAttachment1,
      },
      {
        ...edit2,
        attachments: [editAttachment1, editAttachment2],
        bodyAttachment,
      },
    ]);
  });
});
