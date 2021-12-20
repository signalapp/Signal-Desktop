// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import dataInterface from '../../sql/Client';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';

import type { MessageAttributesType } from '../../model-types.d';

const {
  removeAll,
  _getAllMessages,
  saveMessages,
  saveMessage,
  searchMessages,
} = dataInterface;

function getUuid(): UUIDStringType {
  return UUID.generate().toString();
}

describe('sql/fullTextSearch', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('returns messages matching query', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const ourUuid = getUuid();
    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now,
      received_at: now,
      timestamp: now,
    };

    await saveMessages([message1, message2, message3], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages('unique');
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message2.id);

    message3.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages('unique');
    assert.lengthOf(searchResults2, 2);
    assert.strictEqual(searchResults2[0].id, message3.id);
    assert.strictEqual(searchResults2[1].id, message2.id);
  });

  it('excludes messages with isViewOnce = true', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const ourUuid = getUuid();
    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      isViewOnce: true,
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now,
      received_at: now,
      timestamp: now,
      isViewOnce: true,
    };

    await saveMessages([message1, message2, message3], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages('unique');
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages('unique');
    assert.lengthOf(searchResults2, 1);
    assert.strictEqual(searchResults2[0].id, message1.id);
  });

  it('excludes messages with storyId !== null', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const ourUuid = getUuid();
    const message1: MessageAttributesType = {
      id: getUuid(),
      body: 'message 1 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: getUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      storyId: getUuid(),
    };
    const message3: MessageAttributesType = {
      id: getUuid(),
      body: 'message 3 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now,
      received_at: now,
      timestamp: now,
      storyId: getUuid(),
    };

    await saveMessages([message1, message2, message3], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages('unique');
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages('unique');
    assert.lengthOf(searchResults2, 1);
    assert.strictEqual(searchResults2[0].id, message1.id);
  });
});
