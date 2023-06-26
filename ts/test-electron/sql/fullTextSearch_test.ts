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

describe('sql/searchMessages', () => {
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

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message2.id);

    message3.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages({ query: 'unique' });
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

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages({ query: 'unique' });
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

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourUuid });

    const searchResults2 = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults2, 1);
    assert.strictEqual(searchResults2[0].id, message1.id);
  });

  it('limits messages returned to a specific conversation if specified', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = getUuid();
    const otherConversationId = getUuid();
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
      conversationId: otherConversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
    };

    await saveMessages([message1, message2], {
      forceSave: true,
      ourUuid,
    });

    assert.lengthOf(await _getAllMessages(), 2);

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 2);

    const searchResultsWithConversationId = await searchMessages({
      query: 'unique',
      conversationId: otherConversationId,
    });
    assert.lengthOf(searchResultsWithConversationId, 1);
    assert.strictEqual(searchResultsWithConversationId[0].id, message2.id);
  });
});

describe('sql/searchMessages/withMentions', () => {
  beforeEach(async () => {
    await removeAll();
  });
  const ourUuid = getUuid();
  async function storeMessages(
    messageOverrides: Array<Partial<MessageAttributesType>>
  ) {
    const now = Date.now();
    const messages: Array<MessageAttributesType> = messageOverrides.map(
      (overrides, idx) => ({
        id: getUuid(),
        body: ' ',
        type: 'incoming',
        sent_at: now - idx,
        received_at: now - idx,
        timestamp: now - idx,
        conversationId: getUuid(),
        ...overrides,
      })
    );
    await saveMessages(messages, {
      forceSave: true,
      ourUuid,
    });
    return messages;
  }

  it('includes messages with mentions', async () => {
    const mentionedUuids = [getUuid(), getUuid()];
    const messages = await storeMessages([
      {
        bodyRanges: [{ start: 0, length: 1, mentionUuid: mentionedUuids[0] }],
      },
      {
        bodyRanges: [{ start: 0, length: 1, mentionUuid: mentionedUuids[1] }],
      },
      {
        bodyRanges: [
          { start: 0, length: 1, mentionUuid: mentionedUuids[0] },
          { start: 1, length: 1, mentionUuid: mentionedUuids[1] },
        ],
      },
      {},
    ]);

    const searchResults = await searchMessages({
      query: 'alice',
      contactUuidsMatchingQuery: [mentionedUuids[0], getUuid()],
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[2].id]
    );

    const searchResultsForMultipleMatchingUuids = await searchMessages({
      query: 'alice',
      contactUuidsMatchingQuery: [mentionedUuids[0], mentionedUuids[1]],
    });

    assert.sameOrderedMembers(
      searchResultsForMultipleMatchingUuids.map(res => res.id),
      // TODO: should only return unique messages
      [messages[0].id, messages[1].id, messages[2].id]
    );
  });

  it('includes messages with mentions and those that match the body text', async () => {
    const mentionedUuids = [getUuid(), getUuid()];
    const messages = await storeMessages([
      {
        body: 'cat',
      },
      {
        body: 'dog',
        bodyRanges: [
          { start: 0, length: 1, mentionUuid: mentionedUuids[0] },
          { start: 1, length: 1, mentionUuid: mentionedUuids[1] },
        ],
      },
      {
        body: 'dog',
      },
    ]);

    const searchResults = await searchMessages({
      query: 'cat',
      contactUuidsMatchingQuery: [mentionedUuids[0], getUuid()],
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[1].id]
    );

    // check that results get returned in the right order, independent of whether they
    // match the mention or the text
    const searchResultsForDog = await searchMessages({
      query: 'dog',
      contactUuidsMatchingQuery: [mentionedUuids[1], getUuid()],
    });
    assert.sameOrderedMembers(
      searchResultsForDog.map(res => res.id),
      [messages[1].id, messages[2].id]
    );
  });
  it('respects conversationId for mention matches', async () => {
    const mentionedUuids = [getUuid(), getUuid()];
    const conversationId = getUuid();
    const messages = await storeMessages([
      {
        body: 'cat',
        conversationId,
      },
      {
        body: 'dog',
        bodyRanges: [{ start: 0, length: 1, mentionUuid: mentionedUuids[0] }],
        conversationId,
      },
      {
        body: 'dog',
        bodyRanges: [{ start: 0, length: 1, mentionUuid: mentionedUuids[0] }],
      },
      {
        body: 'cat',
      },
    ]);

    const searchResults = await searchMessages({
      query: 'cat',
      contactUuidsMatchingQuery: [mentionedUuids[0]],
      conversationId,
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[1].id]
    );

    const searchResultsWithoutConversationid = await searchMessages({
      query: 'cat',
      contactUuidsMatchingQuery: [mentionedUuids[0]],
    });

    assert.sameOrderedMembers(
      searchResultsWithoutConversationid.map(res => res.id),
      [messages[0].id, messages[1].id, messages[2].id, messages[3].id]
    );
  });
});
