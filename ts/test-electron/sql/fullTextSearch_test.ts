// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client';
import { generateAci } from '../../types/ServiceId';

import type { MessageAttributesType } from '../../model-types.d';
import { postSaveUpdates } from '../../util/cleanup';

const { _getAllMessages, searchMessages } = DataReader;
const { removeAll, saveMessages, saveMessage } = DataWriter;

describe('sql/searchMessages', () => {
  beforeEach(async () => {
    await removeAll();
  });

  it('returns messages matching query', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();
    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now,
      received_at: now,
      timestamp: now,
    };

    await saveMessages([message1, message2, message3], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message2.id);

    message3.body = 'message 3 - unique string';
    await saveMessage(message3, { ourAci, postSaveUpdates });

    const searchResults2 = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults2, 2);
    assert.strictEqual(searchResults2[0].id, message3.id);
    assert.strictEqual(searchResults2[1].id, message2.id);
  });

  it('excludes messages with isViewOnce = true', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();
    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      isViewOnce: true,
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
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
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourAci, postSaveUpdates });

    const searchResults2 = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults2, 1);
    assert.strictEqual(searchResults2[0].id, message1.id);
  });

  it('excludes messages with storyId !== null', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();
    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
      storyId: generateUuid(),
    };
    const message3: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 3 - generic string',
      type: 'outgoing',
      conversationId,
      sent_at: now,
      received_at: now,
      timestamp: now,
      storyId: generateUuid(),
    };

    await saveMessages([message1, message2, message3], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    assert.lengthOf(await _getAllMessages(), 3);

    const searchResults = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults, 1);
    assert.strictEqual(searchResults[0].id, message1.id);

    message1.body = 'message 3 - unique string';
    await saveMessage(message3, { ourAci, postSaveUpdates });

    const searchResults2 = await searchMessages({ query: 'unique' });
    assert.lengthOf(searchResults2, 1);
    assert.strictEqual(searchResults2[0].id, message1.id);
  });

  it('limits messages returned to a specific conversation if specified', async () => {
    assert.lengthOf(await _getAllMessages(), 0);

    const now = Date.now();
    const conversationId = generateUuid();
    const otherConversationId = generateUuid();
    const ourAci = generateAci();

    const message1: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 1 - unique string',
      type: 'outgoing',
      conversationId,
      sent_at: now - 20,
      received_at: now - 20,
      timestamp: now - 20,
    };
    const message2: MessageAttributesType = {
      id: generateUuid(),
      body: 'message 2 - unique string',
      type: 'outgoing',
      conversationId: otherConversationId,
      sent_at: now - 10,
      received_at: now - 10,
      timestamp: now - 10,
    };

    await saveMessages([message1, message2], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
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
  const ourAci = generateAci();
  async function storeMessages(
    messageOverrides: Array<Partial<MessageAttributesType>>
  ) {
    const now = Date.now();
    const messages: Array<MessageAttributesType> = messageOverrides.map(
      (overrides, idx) => ({
        id: generateUuid(),
        body: ' ',
        type: 'incoming',
        sent_at: now - idx,
        received_at: now - idx,
        timestamp: now - idx,
        conversationId: generateUuid(),
        ...overrides,
      })
    );
    await saveMessages(messages, {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });
    return messages;
  }

  it('includes messages with mentions', async () => {
    const mentionedAcis = [generateAci(), generateAci()];
    const messages = await storeMessages([
      {
        bodyRanges: [{ start: 0, length: 1, mentionAci: mentionedAcis[0] }],
      },
      {
        bodyRanges: [{ start: 0, length: 1, mentionAci: mentionedAcis[1] }],
      },
      {
        bodyRanges: [
          { start: 0, length: 1, mentionAci: mentionedAcis[0] },
          { start: 1, length: 1, mentionAci: mentionedAcis[1] },
        ],
      },
      {},
    ]);

    const searchResults = await searchMessages({
      query: 'alice',
      contactServiceIdsMatchingQuery: [mentionedAcis[0], generateAci()],
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[2].id]
    );

    const searchResultsForMultipleMatchingUuids = await searchMessages({
      query: 'alice',
      contactServiceIdsMatchingQuery: [mentionedAcis[0], mentionedAcis[1]],
    });

    assert.sameOrderedMembers(
      searchResultsForMultipleMatchingUuids.map(res => res.id),
      // TODO: should only return unique messages
      [messages[0].id, messages[1].id, messages[2].id]
    );
  });

  it('includes messages with mentions and those that match the body text', async () => {
    const mentionedAcis = [generateAci(), generateAci()];
    const messages = await storeMessages([
      {
        body: 'cat',
      },
      {
        body: 'dog',
        bodyRanges: [
          { start: 0, length: 1, mentionAci: mentionedAcis[0] },
          { start: 1, length: 1, mentionAci: mentionedAcis[1] },
        ],
      },
      {
        body: 'dog',
      },
    ]);

    const searchResults = await searchMessages({
      query: 'cat',
      contactServiceIdsMatchingQuery: [mentionedAcis[0], generateAci()],
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[1].id]
    );

    // check that results get returned in the right order, independent of whether they
    // match the mention or the text
    const searchResultsForDog = await searchMessages({
      query: 'dog',
      contactServiceIdsMatchingQuery: [mentionedAcis[1], generateAci()],
    });
    assert.sameOrderedMembers(
      searchResultsForDog.map(res => res.id),
      [messages[1].id, messages[2].id]
    );
  });
  it('respects conversationId for mention matches', async () => {
    const mentionedAcis = [generateAci(), generateAci()];
    const conversationId = generateUuid();
    const messages = await storeMessages([
      {
        body: 'cat',
        conversationId,
      },
      {
        body: 'dog',
        bodyRanges: [{ start: 0, length: 1, mentionAci: mentionedAcis[0] }],
        conversationId,
      },
      {
        body: 'dog',
        bodyRanges: [{ start: 0, length: 1, mentionAci: mentionedAcis[0] }],
      },
      {
        body: 'cat',
      },
    ]);

    const searchResults = await searchMessages({
      query: 'cat',
      contactServiceIdsMatchingQuery: [mentionedAcis[0]],
      conversationId,
    });

    assert.sameOrderedMembers(
      searchResults.map(res => res.id),
      [messages[0].id, messages[1].id]
    );

    const searchResultsWithoutConversationid = await searchMessages({
      query: 'cat',
      contactServiceIdsMatchingQuery: [mentionedAcis[0]],
    });

    assert.sameOrderedMembers(
      searchResultsWithoutConversationid.map(res => res.id),
      [messages[0].id, messages[1].id, messages[2].id, messages[3].id]
    );
  });
});
