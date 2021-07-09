// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { omit } from 'lodash';
import { v4 as uuid } from 'uuid';
import { MessageModel } from '../../models/messages';
import { SendStatus } from '../../messages/MessageSendState';
import type { StorageAccessType } from '../../types/Storage.d';
import type { MessageAttributesType } from '../../model-types.d';
import type { WhatIsThis } from '../../window.d';
import dataInterface from '../../sql/Client';

const {
  getMessageById,
  saveMessage,
  saveConversation,
  _getSendStates,
} = dataInterface;

describe('saveMessage', () => {
  const STORAGE_KEYS_TO_RESTORE: Array<keyof StorageAccessType> = [
    'number_id',
    'uuid_id',
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldStorageValues = new Map<keyof StorageAccessType, any>();

  before(async () => {
    window.ConversationController.reset();
    await window.ConversationController.load();

    STORAGE_KEYS_TO_RESTORE.forEach(key => {
      oldStorageValues.set(key, window.textsecure.storage.get(key));
    });
    window.textsecure.storage.put('number_id', '+14155555556.2');
    window.textsecure.storage.put('uuid_id', `${uuid()}.2`);
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

  // NOTE: These tests are incomplete, and were only added to test new functionality.
  it('inserts a new message if passed an object with no ID', async () => {
    const messageId = await saveMessage(
      ({
        type: 'incoming',
        sent_at: Date.now(),
        conversationId: uuid(),
        received_at: Date.now(),
        timestamp: Date.now(),
        // TODO: DESKTOP-722
      } as Partial<MessageAttributesType>) as WhatIsThis,
      { Message: MessageModel }
    );

    assert.exists(await getMessageById(messageId, { Message: MessageModel }));
  });

  it('when inserting a message, saves send states', async () => {
    const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
    const conversation1Id = uuid();
    const conversation2Id = uuid();

    await Promise.all(
      [conversation1Id, conversation2Id].map(id =>
        saveConversation({
          id,
          inbox_position: 0,
          isPinned: false,
          lastMessageDeletedForEveryone: false,
          markedUnread: false,
          messageCount: 0,
          sentMessageCount: 0,
          type: 'private',
          profileSharing: true,
          version: 1,
        })
      )
    );

    const messageId = await saveMessage(
      {
        id: uuid(),
        type: 'outgoing',
        sent_at: Date.now(),
        conversationId: uuid(),
        received_at: Date.now(),
        timestamp: Date.now(),
        sendStateByConversationId: {
          [ourConversationId]: {
            status: SendStatus.Sent,
            updatedAt: 1,
          },
          [conversation1Id]: {
            status: SendStatus.Pending,
            updatedAt: 2,
          },
          [conversation2Id]: {
            status: SendStatus.Delivered,
            updatedAt: 3,
          },
        },
      },
      { forceSave: true, Message: MessageModel }
    );

    const assertSendState = async (
      destinationConversationId: string,
      expectedStatusString: string,
      expectedUpdatedAt: number
    ): Promise<void> => {
      assert.deepEqual(
        await _getSendStates({ messageId, destinationConversationId }),
        [{ status: expectedStatusString, updatedAt: expectedUpdatedAt }]
      );
    };

    await Promise.all([
      assertSendState(ourConversationId, 'Sent', 1),
      assertSendState(conversation1Id, 'Pending', 2),
      assertSendState(conversation2Id, 'Delivered', 3),
    ]);
  });

  it('when updating a message, updates and inserts send states', async () => {
    const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
    const conversation1Id = uuid();
    const conversation2Id = uuid();
    const conversation3Id = uuid();

    await Promise.all(
      [conversation1Id, conversation2Id, conversation3Id].map(id =>
        saveConversation({
          id,
          inbox_position: 0,
          isPinned: false,
          lastMessageDeletedForEveryone: false,
          markedUnread: false,
          messageCount: 0,
          sentMessageCount: 0,
          type: 'private',
          profileSharing: true,
          version: 1,
        })
      )
    );

    const messageAttributes: MessageAttributesType = {
      id: 'to be replaced',
      type: 'outgoing',
      sent_at: Date.now(),
      conversationId: uuid(),
      received_at: Date.now(),
      timestamp: Date.now(),
      sendStateByConversationId: {
        [ourConversationId]: {
          status: SendStatus.Sent,
          updatedAt: 1,
        },
        [conversation1Id]: {
          status: SendStatus.Pending,
          updatedAt: 2,
        },
        [conversation2Id]: {
          status: SendStatus.Delivered,
          updatedAt: 3,
        },
      },
    };

    const messageId = await saveMessage(
      // TODO: DESKTOP-722
      (omit(
        messageAttributes,
        'id'
      ) as Partial<MessageAttributesType>) as WhatIsThis,
      { Message: MessageModel }
    );

    messageAttributes.id = messageId;
    messageAttributes.sendStateByConversationId = {
      [ourConversationId]: {
        status: SendStatus.Delivered,
        updatedAt: 4,
      },
      [conversation1Id]: {
        status: SendStatus.Sent,
        updatedAt: 5,
      },
      [conversation2Id]: {
        status: SendStatus.Read,
        updatedAt: 6,
      },
      [conversation3Id]: {
        status: SendStatus.Pending,
        updatedAt: 7,
      },
    };

    await saveMessage(messageAttributes, { Message: MessageModel });

    const assertSendState = async (
      destinationConversationId: string,
      expectedStatusString: string,
      expectedUpdatedAt: number
    ): Promise<void> => {
      assert.deepEqual(
        await _getSendStates({ messageId, destinationConversationId }),
        [{ status: expectedStatusString, updatedAt: expectedUpdatedAt }]
      );
    };

    await Promise.all([
      assertSendState(ourConversationId, 'Delivered', 4),
      assertSendState(conversation1Id, 'Sent', 5),
      assertSendState(conversation2Id, 'Read', 6),
      assertSendState(conversation3Id, 'Pending', 7),
    ]);
  });
});
