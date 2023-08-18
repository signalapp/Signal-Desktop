/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';
import {
  addToMutationCache,
  ChangeType,
  getMutationCache,
  processMessagesUsingCache,
  SogsV3Mutation,
  updateMutationCache,
} from '../../../../session/apis/open_group_api/sogsv3/sogsV3MutationCache';
import { TestUtils } from '../../../test-utils';
import { Reactions } from '../../../../util/reactions';
import {
  OpenGroupMessageV4,
  OpenGroupReactionMessageV4,
} from '../../../../session/apis/open_group_api/opengroupV2/OpenGroupServerPoller';

describe('mutationCache', () => {
  TestUtils.stubWindowLog();

  const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();
  const originalMessage = TestUtils.generateOpenGroupMessageV2WithServerId(111);
  const originalMessage2 = TestUtils.generateOpenGroupMessageV2WithServerId(112);
  const reactor1 = TestUtils.generateFakePubKey().key;
  const reactor2 = TestUtils.generateFakePubKey().key;

  beforeEach(() => {
    // stubs
    Sinon.stub(Reactions, 'handleOpenGroupMessageReactions').resolves();
  });

  afterEach(Sinon.restore);

  describe('add entry to cache', () => {
    it('add entry to cache that is valid', () => {
      const entry: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: null,
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      addToMutationCache(entry);
      const cache = getMutationCache();
      expect(cache, 'should not empty').to.not.equal([]);
      expect(cache.length, 'should have one entry').to.be.equal(1);
      expect(cache[0], 'the entry should match the input').to.be.deep.equal(entry);
    });
    it('add entry to cache that is invalid and fail', () => {
      const entry: SogsV3Mutation = {
        server: '', // this is invalid
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 100,
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      addToMutationCache(entry);
      const cache = getMutationCache();
      expect(cache, 'should not empty').to.not.equal([]);
      expect(cache.length, 'should have one entry').to.be.equal(1);
    });
  });

  describe('update entry in cache', () => {
    it('update entry in cache with a valid source entry', () => {
      const entry: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: null, // mutation before we have received a response
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage.serverId,
        seqno: 200,
        reactions: {
          '😄': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor1],
          },
          '❤️': {
            index: 1,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor1],
          },
          '😈': {
            index: 2,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor2],
          },
        },
      }) as OpenGroupMessageV4;
      updateMutationCache(entry, (messageResponse as OpenGroupMessageV4).seqno);
      const cache = getMutationCache();
      expect(cache, 'should not empty').to.not.equal([]);
      expect(cache.length, 'should have one entry').to.be.equal(1);
      expect(
        cache[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
    it('update entry in cache with an invalid source entry', () => {
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage.serverId,
        seqno: 200,
        reactions: {
          '😄': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor1],
          },
          '❤️': {
            index: 1,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor1],
          },
          '😈': {
            index: 2,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor2],
          },
        },
      }) as OpenGroupMessageV4;
      const entry: SogsV3Mutation = {
        server: '',
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 100,
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      updateMutationCache(entry, (messageResponse as OpenGroupMessageV4).seqno);
      const cache = getMutationCache();
      expect(cache, 'should not empty').to.not.equal([]);
      expect(cache.length, 'should have one entry').to.be.equal(1);
      expect(
        cache[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
    it('update entry in cache with a valid source entry but its not stored in the cache', () => {
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage.serverId,
        seqno: 200,
        reactions: {
          '😄': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor1],
          },
          '❤️': {
            index: 1,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor1],
          },
          '😈': {
            index: 2,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor2],
          },
        },
      }) as OpenGroupMessageV4;
      const entry: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 400,
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      updateMutationCache(entry, (messageResponse as OpenGroupMessageV4).seqno);
      const cache = getMutationCache();
      expect(cache, 'should not empty').to.not.equal([]);
      expect(cache.length, 'should have one entry').to.be.equal(1);
      expect(
        cache[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
  });

  describe('process opengroup messages using the cache', () => {
    it('processing a message with valid serverUrl, roomId and message should return the same message response', async () => {
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage.serverId,
        seqno: 200,
        reactions: {
          '😄': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor1],
          },
          '❤️': {
            index: 1,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor1],
          },
          '😈': {
            index: 2,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor2],
          },
        },
      }) as OpenGroupMessageV4;
      const message = await processMessagesUsingCache(
        roomInfos.serverUrl,
        roomInfos.roomId,
        messageResponse
      );
      const cache = getMutationCache();
      expect(cache, 'cache should be empty').to.be.empty;
      expect(message, 'message response should match').to.be.deep.equal(messageResponse);
    });
    it('processing a message with valid serverUrl, roomId and message (from SOGS < 1.3.4) should return the same message response', async () => {
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage2.serverId,
        // in version less than 1.3.4 there is no a seqno set
        reactions: {
          '🤣': {
            index: 0,
            count: 3,
            you: true,
            reactors: [reactor1, reactor2, originalMessage2.sender],
          },
          '😈': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor2],
          },
        },
      }) as OpenGroupReactionMessageV4;
      const message = await processMessagesUsingCache(
        roomInfos.serverUrl,
        roomInfos.roomId,
        messageResponse
      );
      const cache = getMutationCache();
      expect(cache, 'cache should be empty').to.be.empty;
      expect(message, 'message response should match').to.be.deep.equal(messageResponse);
    });
    it('processing a message with valid entries in the cache should calculate the optimistic state if there is no message seqo or the cached entry seqno is larger than the message seqno', async () => {
      const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
        id: originalMessage.serverId,
        seqno: 200,
        reactions: {
          '😄': {
            index: 0,
            count: 1,
            you: false,
            reactors: [reactor1],
          },
          '❤️': {
            index: 1,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor1],
          },
          '😈': {
            index: 2,
            count: 2,
            you: true,
            reactors: [originalMessage.sender, reactor2],
          },
        },
      }) as OpenGroupMessageV4;
      const entry: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 100, // less than response messageResponse seqno should be ignored
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '❤️',
          action: 'ADD',
        },
      };
      const entry2: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 300, // greater than response messageResponse seqno should be processed
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😄',
          action: 'ADD',
        },
      };
      const entry3: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 301, // greater than response messageResponse seqno should be processed
        metadata: {
          messageId: originalMessage.serverId,
          emoji: '😈',
          action: 'REMOVE',
        },
      };
      addToMutationCache(entry);
      addToMutationCache(entry2);
      addToMutationCache(entry3);

      const message = await processMessagesUsingCache(
        roomInfos.serverUrl,
        roomInfos.roomId,
        messageResponse
      );
      const cache = getMutationCache();
      expect(cache, 'cache should be empty').to.be.empty;
      expect(
        message.reactions['❤️'].count,
        'message response reaction count for ❤️ should be unchanged with 2'
      ).to.equal(2);
      expect(
        message.reactions['😄'].count,
        'message response reaction count for 😄 should be 2'
      ).to.equal(2);
      expect(
        message.reactions['😄'].you,
        'message response reaction for 😄 should have you = true'
      ).to.equal(true);
      expect(
        message.reactions['😈'].count,
        'message response reaction count for 😈 should be 1'
      ).to.equal(1);
      expect(
        message.reactions['😈'].you,
        'message response reaction for 😈 should have you = false'
      ).to.equal(false);
    });
  });
});
