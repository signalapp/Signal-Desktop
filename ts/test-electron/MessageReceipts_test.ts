// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import uuid from 'uuid';
import { assert } from 'chai';

import { type AciString, generateAci } from '../types/ServiceId';
import type { MessageAttributesType } from '../model-types';
import { SendStatus } from '../messages/MessageSendState';
import {
  type MessageReceiptAttributesType,
  MessageReceiptType,
  onReceipt,
} from '../messageModifiers/MessageReceipts';
import { ReadStatus } from '../messages/MessageReadStatus';

describe('MessageReceipts', () => {
  let ourAci: AciString;

  beforeEach(async () => {
    ourAci = generateAci();
    await window.textsecure.storage.put('uuid_id', `${ourAci}.1`);
    await window.textsecure.storage.put('read-receipt-setting', true);
    await window.ConversationController.load();
  });

  function generateReceipt(
    sourceConversationId: string,
    messageSentAt: number,
    type: MessageReceiptType
  ): MessageReceiptAttributesType {
    return {
      envelopeId: uuid(),
      messageSentAt,
      receiptTimestamp: 1,
      removeFromMessageReceiverCache: () => null,
      sourceConversationId,
      sourceDevice: 1,
      sourceServiceId: generateAci(),
      type,
      wasSentEncrypted: true,
    };
  }
  it('processes all receipts in a batch', async () => {
    const id = uuid();
    const sentAt = Date.now();

    const messageAttributes: MessageAttributesType = {
      conversationId: uuid(),
      id,
      received_at: 1,
      sent_at: sentAt,
      timestamp: sentAt,
      type: 'outgoing',
      sendStateByConversationId: {
        aaaa: {
          status: SendStatus.Sent,
          updatedAt: Date.now(),
        },
        bbbb: {
          status: SendStatus.Sent,
          updatedAt: Date.now(),
        },
        cccc: {
          status: SendStatus.Sent,
          updatedAt: Date.now(),
        },
        dddd: {
          status: SendStatus.Sent,
          updatedAt: Date.now(),
        },
      },
    };

    await window.Signal.Data.saveMessage(messageAttributes, {
      forceSave: true,
      ourAci,
    });

    await Promise.all([
      onReceipt(generateReceipt('aaaa', sentAt, MessageReceiptType.Delivery)),
      onReceipt(generateReceipt('bbbb', sentAt, MessageReceiptType.Delivery)),
      onReceipt(generateReceipt('cccc', sentAt, MessageReceiptType.Read)),
      onReceipt(generateReceipt('aaaa', sentAt, MessageReceiptType.Read)),
    ]);

    const messageFromDatabase = await window.Signal.Data.getMessageById(id);
    const savedSendState = messageFromDatabase?.sendStateByConversationId;

    assert.equal(savedSendState?.aaaa.status, SendStatus.Read, 'aaaa');
    assert.equal(savedSendState?.bbbb.status, SendStatus.Delivered, 'bbbb');
    assert.equal(savedSendState?.cccc.status, SendStatus.Read, 'cccc');
    assert.equal(savedSendState?.dddd.status, SendStatus.Sent, 'dddd');
  });

  it('updates sendStateByConversationId for edits', async () => {
    const id = uuid();
    const sentAt = Date.now();
    const editedSentAt = sentAt + 1000;
    const defaultSendState = {
      aaaa: {
        status: SendStatus.Sent,
        updatedAt: Date.now(),
      },
      bbbb: {
        status: SendStatus.Sent,
        updatedAt: Date.now(),
      },
      cccc: {
        status: SendStatus.Sent,
        updatedAt: Date.now(),
      },
      dddd: {
        status: SendStatus.Sent,
        updatedAt: Date.now(),
      },
    };

    const messageAttributes: MessageAttributesType = {
      conversationId: uuid(),
      id,
      received_at: 1,
      sent_at: sentAt,
      timestamp: sentAt,
      editMessageTimestamp: editedSentAt,
      type: 'outgoing',
      sendStateByConversationId: defaultSendState,
      editHistory: [
        {
          sendStateByConversationId: defaultSendState,
          timestamp: editedSentAt,
        },
        {
          sendStateByConversationId: defaultSendState,
          timestamp: sentAt,
        },
      ],
    };

    await window.Signal.Data.saveMessage(messageAttributes, {
      forceSave: true,
      ourAci,
    });
    await window.Signal.Data.saveEditedMessage(messageAttributes, ourAci, {
      conversationId: messageAttributes.conversationId,
      messageId: messageAttributes.id,
      readStatus: ReadStatus.Read,
      sentAt: editedSentAt,
    });

    await Promise.all([
      // send receipts for original message
      onReceipt(generateReceipt('aaaa', sentAt, MessageReceiptType.Delivery)),
      onReceipt(generateReceipt('bbbb', sentAt, MessageReceiptType.Delivery)),
      onReceipt(generateReceipt('cccc', sentAt, MessageReceiptType.Read)),
      onReceipt(generateReceipt('aaaa', sentAt, MessageReceiptType.Read)),

      // and send receipts for edited message
      onReceipt(
        generateReceipt('aaaa', editedSentAt, MessageReceiptType.Delivery)
      ),
      onReceipt(
        generateReceipt('bbbb', editedSentAt, MessageReceiptType.Delivery)
      ),
      onReceipt(generateReceipt('cccc', editedSentAt, MessageReceiptType.Read)),
      onReceipt(generateReceipt('bbbb', editedSentAt, MessageReceiptType.Read)),
    ]);

    const messageFromDatabase = await window.Signal.Data.getMessageById(id);
    const rootSendState = messageFromDatabase?.sendStateByConversationId;

    assert.deepEqual(
      rootSendState,
      messageFromDatabase?.editHistory?.[0].sendStateByConversationId,
      'edit history version should match root version'
    );
    assert.equal(rootSendState?.aaaa.status, SendStatus.Delivered, 'aaaa');
    assert.equal(rootSendState?.bbbb.status, SendStatus.Read, 'bbbb');
    assert.equal(rootSendState?.cccc.status, SendStatus.Read, 'cccc');
    assert.equal(rootSendState?.dddd.status, SendStatus.Sent, 'dddd');

    const originalMessageSendState =
      messageFromDatabase?.editHistory?.[1].sendStateByConversationId;

    assert.equal(
      originalMessageSendState?.aaaa.status,
      SendStatus.Read,
      'original-aaaa'
    );
    assert.equal(
      originalMessageSendState?.bbbb.status,
      SendStatus.Delivered,
      'original-bbbb'
    );
    assert.equal(
      originalMessageSendState?.cccc.status,
      SendStatus.Read,
      'original-cccc'
    );
    assert.equal(
      originalMessageSendState?.dddd.status,
      SendStatus.Sent,
      'original-dddd'
    );
  });
});
