// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { postSaveUpdates } from '../../util/cleanup.preload.js';

const { _getAllMessages } = DataReader;

const {
  _removeAllMessages,
  saveMessages,
  getUnreadPollVotesAndMarkRead,
  markPollVoteAsRead,
} = DataWriter;

describe('sql/pollVoteMarkRead', () => {
  beforeEach(async () => {
    await _removeAllMessages();
  });

  describe('getUnreadPollVotesAndMarkRead', () => {
    it('finds and marks unread poll votes in conversation', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage1: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 1',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 1?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage2: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 2',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 2,
        received_at: start + 2,
        timestamp: start + 2,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 2?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage3: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 3',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 3,
        received_at: start + 3,
        timestamp: start + 3,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 3?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage1, pollMessage2, pollMessage3], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      assert.lengthOf(await _getAllMessages(), 3);

      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: pollMessage2.received_at,
      });

      assert.lengthOf(markedRead, 2, 'two poll votes marked read');

      // Verify correct messages were marked
      const markedIds = markedRead.map(m => m.id);
      assert.include(markedIds, pollMessage1.id);
      assert.include(markedIds, pollMessage2.id);

      // Verify they were actually marked read
      const markedRead2 = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: pollMessage3.received_at,
      });

      assert.lengthOf(markedRead2, 1, 'only one poll vote remains unread');
      assert.strictEqual(markedRead2[0].id, pollMessage3.id);
    });

    it('respects received_at cutoff', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage1: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 1',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 1?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage2: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 2',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1000,
        received_at: start + 1000,
        timestamp: start + 1000,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 2?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage1, pollMessage2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      // Only mark messages received before start + 500
      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 500,
      });

      assert.lengthOf(markedRead, 1, 'only one poll vote within cutoff');
      assert.strictEqual(markedRead[0].id, pollMessage1.id);
    });

    it('filters by conversationId correctly', async () => {
      const start = Date.now();
      const conversationId1 = generateUuid();
      const conversationId2 = generateUuid();
      const ourAci = generateAci();

      const pollMessage1: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 1',
        type: 'outgoing',
        conversationId: conversationId1,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 1?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage2: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 2',
        type: 'outgoing',
        conversationId: conversationId2,
        sourceServiceId: ourAci,
        sent_at: start + 2,
        received_at: start + 2,
        timestamp: start + 2,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 2?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage1, pollMessage2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId: conversationId1,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead, 1, 'only polls from conversationId1');
      assert.strictEqual(markedRead[0].id, pollMessage1.id);
    });

    it('only returns messages with hasUnreadPollVotes = true', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage1: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 1',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 1?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage2: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 2',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 2,
        received_at: start + 2,
        timestamp: start + 2,
        hasUnreadPollVotes: false, // Already read
        poll: {
          question: 'Test 2?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage1, pollMessage2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead, 1, 'only unread poll votes');
      assert.strictEqual(markedRead[0].id, pollMessage1.id);
    });

    it('marks multiple poll votes as read in single call', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessages: Array<MessageAttributesType> = [];
      for (let i = 0; i < 10; i += 1) {
        pollMessages.push({
          id: generateUuid(),
          body: `poll ${i}`,
          type: 'outgoing',
          conversationId,
          sourceServiceId: ourAci,
          sent_at: start + i,
          received_at: start + i,
          timestamp: start + i,
          hasUnreadPollVotes: true,
          poll: {
            question: `Test ${i}?`,
            options: [],
            votes: [],
            allowMultiple: false,
          },
        });
      }

      await saveMessages(pollMessages, {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead, 10, 'all 10 polls marked read');

      // Verify all were actually marked
      const markedRead2 = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead2, 0, 'no unread polls remaining');
    });

    it('does not return already read poll votes on second call', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      // First call marks as read
      const markedRead1 = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead1, 1);

      // Second call should return empty
      const markedRead2 = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead2, 0, 'idempotent - no polls on second call');
    });

    it('handles empty result set gracefully', async () => {
      const conversationId = generateUuid();
      const start = Date.now();

      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start,
      });

      assert.isArray(markedRead);
      assert.lengthOf(markedRead, 0);
    });
  });

  describe('markPollVoteAsRead', () => {
    it('finds and marks specific poll by author and timestamp', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const result = await markPollVoteAsRead(pollMessage.sent_at);

      assert.isDefined(result);
      assert.strictEqual(result?.id, pollMessage.id);

      // Verify it was marked read
      const result2 = await markPollVoteAsRead(pollMessage.sent_at);
      assert.isUndefined(
        result2,
        'should return undefined after already marked read'
      );
    });

    it('returns undefined when no matching poll found', async () => {
      const start = Date.now();

      const result = await markPollVoteAsRead(start + 1);

      assert.isUndefined(result);
    });

    it('returns undefined when poll already read', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: false, // Already read
        poll: {
          question: 'Test?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const result = await markPollVoteAsRead(start + 1);

      assert.isUndefined(result, 'should return undefined when already read');
    });

    it('marks only the specific poll, not others', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage1: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 1',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 1?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      const pollMessage2: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll 2',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 2,
        received_at: start + 2,
        timestamp: start + 2,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test 2?',
          options: [],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage1, pollMessage2], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      // Mark only the first poll
      const result = await markPollVoteAsRead(start + 1);

      assert.isNotNull(result);
      assert.strictEqual(result?.id, pollMessage1.id);

      // Second poll should still be unread
      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead, 1, 'second poll still unread');
      assert.strictEqual(markedRead[0].id, pollMessage2.id);
    });

    it('returns full MessageAttributesType on success', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessage: MessageAttributesType = {
        id: generateUuid(),
        body: 'poll',
        type: 'outgoing',
        conversationId,
        sourceServiceId: ourAci,
        sent_at: start + 1,
        received_at: start + 1,
        timestamp: start + 1,
        hasUnreadPollVotes: true,
        poll: {
          question: 'Test?',
          options: ['Option 1'],
          votes: [],
          allowMultiple: false,
        },
      };

      await saveMessages([pollMessage], {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      const result = await markPollVoteAsRead(start + 1);

      assert.isNotNull(result, 'result should not be null');
      assert.strictEqual(result?.id, pollMessage.id, 'message id should match');
      assert.strictEqual(result?.body, 'poll', 'message body should be "poll"');
      assert.strictEqual(
        result?.type,
        'outgoing',
        'message type should be "outgoing"'
      );
      assert.ok(
        result?.hasUnreadPollVotes == null ||
          result?.hasUnreadPollVotes === false,
        'hasUnreadPollVotes should be false or null/undefined after marking as read'
      );
      assert.deepEqual(
        result?.poll?.options,
        ['Option 1'],
        'poll options should match'
      );
    });

    it('handles multiple polls from same author', async () => {
      const start = Date.now();
      const conversationId = generateUuid();
      const ourAci = generateAci();

      const pollMessages: Array<MessageAttributesType> = [];
      for (let i = 0; i < 5; i += 1) {
        pollMessages.push({
          id: generateUuid(),
          body: `poll ${i}`,
          type: 'outgoing',
          conversationId,
          sourceServiceId: ourAci,
          sent_at: start + i * 1000,
          received_at: start + i * 1000,
          timestamp: start + i * 1000,
          hasUnreadPollVotes: true,
          poll: {
            question: `Test ${i}?`,
            options: [],
            votes: [],
            allowMultiple: false,
          },
        });
      }

      await saveMessages(pollMessages, {
        forceSave: true,
        ourAci,
        postSaveUpdates,
      });

      // Mark specific poll by timestamp
      const result = await markPollVoteAsRead(start + 2000);

      assert.isNotNull(result);
      assert.strictEqual(result?.id, pollMessages[2].id);

      // Other polls should still be unread
      const markedRead = await getUnreadPollVotesAndMarkRead({
        conversationId,
        readMessageReceivedAt: start + 10000,
      });

      assert.lengthOf(markedRead, 4, 'four polls still unread');
    });
  });
});
