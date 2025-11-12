// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { emptyDir } from 'fs-extra';
import { randomBytes } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { v7 } from 'uuid';

import * as MIME from '../../types/MIME.std.js';
import { composeAttachment } from '../../test-node/util/queueAttachmentDownloads_test.preload.js';
import { addAttachmentToMessage } from '../../messageModifiers/AttachmentDownloads.preload.js';
import { getMessageById } from '../../messages/getMessageById.preload.js';
import { MessageCache } from '../../services/MessageCache.preload.js';
import { getPath } from '../../../app/attachments.node.js';
import { getAbsoluteAttachmentPath } from '../../util/migrations.preload.js';
import { DataWriter } from '../../sql/Client.preload.js';
import type { MessageAttributesType } from '../../model-types.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';

describe('addAttachmentToMessage', () => {
  beforeEach(async () => {
    await DataWriter.removeAll();
    await itemStorage.user.setAciAndDeviceId(generateAci(), 1);
    MessageCache.install();
  });

  afterEach(async () => {
    await emptyDir(getPath(window.SignalContext.config.userDataPath));
  });

  async function saveMessage(
    messageOverrides: Partial<MessageAttributesType>
  ): Promise<MessageAttributesType> {
    const message: MessageAttributesType = {
      id: v7(),
      type: 'incoming',
      sent_at: Date.now(),
      timestamp: Date.now(),
      received_at: Date.now(),
      conversationId: 'convoId',
      ...messageOverrides,
    };
    await window.MessageCache.saveMessage(message, {
      forceSave: true,
    });
    return message;
  }

  async function writeAttachmentToDisk(path: string, text: string) {
    await writeFile(getAbsoluteAttachmentPath(path), text);
  }

  async function listAttachmentsOnDisk(): Promise<Array<string>> {
    return readdir(getPath(window.SignalContext.config.userDataPath));
  }
  it('replaces attachment on message', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      attachments: [attachment],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'attachment',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(message?.attributes.attachments?.[0], {
      ...attachment,
      path: '/path/to/attachment',
    });
  });
  it('throws error if matching attachment not found', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      attachments: [attachment],
    });

    await assert.isRejected(
      addAttachmentToMessage(
        messageId,
        { ...attachment, digest: randomBytes(32).toString('base64') },
        'logid',
        {
          type: 'attachment',
        }
      ),
      'AttachmentNotNeededForMessageError'
    );
  });

  it('throws error if attachment found but already downloaded', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
      path: '/path/to/attachment',
    });

    const { id: messageId } = await saveMessage({
      attachments: [attachment],
    });

    await assert.isRejected(
      addAttachmentToMessage(messageId, attachment, 'logid', {
        type: 'attachment',
      }),
      'AttachmentNotNeededForMessageError'
    );
  });
  it('replaces preview', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      preview: [{ url: 'url', image: attachment }],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'preview',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(message?.attributes.preview?.[0].image, {
      ...attachment,
      path: '/path/to/attachment',
    });
  });
  it('replaces preview in edithistory', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      editHistory: [
        {
          timestamp: 1,
          received_at: 1,
          preview: [{ url: 'url', image: attachment }],
        },
      ],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'preview',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(
      message?.attributes.editHistory?.[0].preview?.[0].image,
      {
        ...attachment,
        path: '/path/to/attachment',
      }
    );
  });
  it('replaces quote thumbnail', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });
    const { id: messageId } = await saveMessage({
      quote: {
        id: null,
        isViewOnce: false,
        referencedMessageNotFound: false,
        attachments: [{ contentType: MIME.IMAGE_PNG, thumbnail: attachment }],
      },
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'quote',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(
      message?.attributes.quote?.attachments[0].thumbnail,
      {
        ...attachment,
        path: '/path/to/attachment',
      }
    );
  });
  it('replaces quote thumbnail in edit history', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      editHistory: [
        {
          timestamp: 1,
          received_at: 1,
          quote: {
            id: null,
            isViewOnce: false,
            referencedMessageNotFound: false,
            attachments: [
              { contentType: MIME.IMAGE_PNG, thumbnail: attachment },
            ],
          },
        },
      ],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'quote',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(
      message?.attributes.editHistory?.[0].quote?.attachments[0].thumbnail,
      {
        ...attachment,
        path: '/path/to/attachment',
      }
    );
  });

  it('replaces sticker', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      sticker: {
        packId: 'packId',
        stickerId: 1,
        packKey: 'packKey',
        data: attachment,
      },
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'sticker',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(message?.attributes.sticker?.data, {
      ...attachment,
      path: '/path/to/attachment',
    });
  });

  it('replaces contact avatar', async () => {
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });
    const { id: messageId } = await saveMessage({
      contact: [
        {
          avatar: {
            isProfile: false,
            avatar: attachment,
          },
        },
      ],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: '/path/to/attachment',
      },
      'logid',
      {
        type: 'contact',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(message?.attributes.contact?.[0]?.avatar?.avatar, {
      ...attachment,
      path: '/path/to/attachment',
    });
  });

  it('replaces body attachment and deletes file on disk', async () => {
    await writeAttachmentToDisk('bodyAttachmentPath', 'attachmenttext');
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      bodyAttachment: attachment,
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: 'bodyAttachmentPath',
      },
      'logid',
      {
        type: 'long-message',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(message?.attributes.body, 'attachmenttext');
    assert.deepStrictEqual(message?.attributes.bodyAttachment, {
      ...attachment,
      path: 'bodyAttachmentPath',
    });
    // attachment is deleted from disk after download
    assert.deepEqual(await listAttachmentsOnDisk(), []);
  });
  it('replaces body attachment in edit history and deletes file on disk', async () => {
    await writeAttachmentToDisk('bodyAttachmentPath', 'attachmenttext');
    const attachment = composeAttachment({
      digest: randomBytes(32).toString('base64'),
    });

    const { id: messageId } = await saveMessage({
      editHistory: [
        {
          timestamp: 1,
          received_at: 1,
          bodyAttachment: attachment,
        },
      ],
    });

    await addAttachmentToMessage(
      messageId,
      {
        ...attachment,
        path: 'bodyAttachmentPath',
      },
      'logid',
      {
        type: 'long-message',
      }
    );

    const message = await getMessageById(messageId);
    assert.deepStrictEqual(
      message?.attributes.editHistory?.[0].body,
      'attachmenttext'
    );
    assert.deepStrictEqual(
      message?.attributes.editHistory?.[0].bodyAttachment,
      {
        ...attachment,
        path: 'bodyAttachmentPath',
      }
    );
    // attachment is deleted from disk after download
    assert.deepEqual(await listAttachmentsOnDisk(), []);
  });
});
