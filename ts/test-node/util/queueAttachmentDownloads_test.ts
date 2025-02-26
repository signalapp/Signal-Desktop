// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { assert } from 'chai';
import type { MessageAttributesType } from '../../model-types';
import type { AttachmentType } from '../../types/Attachment';
import { IMAGE_JPEG, LONG_MESSAGE } from '../../types/MIME';
import { generateMessageId } from '../../util/generateMessageId';
import { ensureBodyAttachmentsAreSeparated } from '../../util/queueAttachmentDownloads';
import * as logger from '../../logging/log';

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
    const msg = composeMessage({
      attachments: [
        composeAttachment({
          clientUuid: 'normal attachment',
          contentType: IMAGE_JPEG,
        }),
        composeAttachment({
          clientUuid: 'long message attachment 1',
          contentType: LONG_MESSAGE,
        }),
        composeAttachment({
          clientUuid: 'long message attachment 2',
          contentType: LONG_MESSAGE,
        }),
      ],
      editHistory: [
        {
          timestamp: Date.now(),
          received_at: Date.now(),
          attachments: [
            composeAttachment({
              clientUuid: 'edit attachment',
              contentType: IMAGE_JPEG,
            }),
            composeAttachment({
              clientUuid: 'long message attachment 1',
              contentType: LONG_MESSAGE,
            }),
            composeAttachment({
              clientUuid: 'long message attachment 2',
              contentType: LONG_MESSAGE,
            }),
          ],
        },
        {
          timestamp: Date.now(),
          received_at: Date.now(),
          bodyAttachment: composeAttachment({
            clientUuid: 'long message attachment already as bodyattachment',
            contentType: LONG_MESSAGE,
          }),
          attachments: [
            composeAttachment({
              clientUuid: 'edit attachment 1',
              contentType: IMAGE_JPEG,
            }),
            composeAttachment({
              clientUuid: 'edit attachment 2',
              contentType: IMAGE_JPEG,
            }),
          ],
        },
      ],
    });
    const result = ensureBodyAttachmentsAreSeparated(msg, {
      logId: 'test',
      logger,
    });

    assert.deepEqual(result.attachments, [msg.attachments?.[0]]);
    assert.deepEqual(result.bodyAttachment, msg.attachments?.[1]);
    assert.deepEqual(result.editHistory, [
      {
        ...msg.editHistory![0],
        attachments: [msg.editHistory![0].attachments![0]],
        bodyAttachment: msg.editHistory![0].attachments![1],
      },
      {
        ...msg.editHistory![1],
        attachments: [
          msg.editHistory![1].attachments![0],
          msg.editHistory![1].attachments![1],
        ],
        bodyAttachment: msg.editHistory![1].bodyAttachment,
      },
    ]);
  });
});
