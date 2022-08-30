import { expect } from 'chai';
import Sinon from 'sinon';
import {
  addToMutationCache,
  ChangeType,
  SogsV3Mutation,
  updateMutationCache,
} from '../../../../session/apis/open_group_api/sogsv3/sogsV3MutationCache';
import { Action, Reaction } from '../../../../types/Reaction';
import { TestUtils } from '../../../test-utils';
import { Reactions } from '../../../../util/reactions';

describe('mutationCache', () => {
  TestUtils.stubWindowLog();

  const roomInfos = TestUtils.generateOpenGroupV2RoomInfos();
  const originalMessage = TestUtils.generateOpenGroupMessageV2({ serverId: 111 });
  const reactor1 = TestUtils.generateFakePubKey().key;
  const reactor2 = TestUtils.generateFakePubKey().key;

  const reaction: Reaction = {
    id: originalMessage.serverId!,
    author: originalMessage.sender!,
    emoji: '😄',
    action: Action.REACT,
  };
  const validEntry: SogsV3Mutation = {
    server: roomInfos.serverUrl,
    room: roomInfos.roomId,
    changeType: ChangeType.REACTIONS,
    seqno: null,
    metadata: {
      messageId: originalMessage.serverId!,
      emoji: reaction.emoji,
      action: 'ADD',
    },
  };
  const invalidEntry: SogsV3Mutation = {
    server: '',
    room: roomInfos.roomId,
    changeType: ChangeType.REACTIONS,
    seqno: 100,
    metadata: {
      messageId: originalMessage.serverId!,
      emoji: reaction.emoji,
      action: 'ADD',
    },
  };
  const messageResponse = TestUtils.generateFakeIncomingOpenGroupMessageV4({
    id: originalMessage.serverId!,
    seqno: 200,
    reactions: {
      '😄': {
        index: 0,
        count: 1,
        you: true,
        reactors: [originalMessage.sender!],
      },
      '❤️': {
        index: 1,
        count: 2,
        you: true,
        reactors: [originalMessage.sender!, reactor1],
      },
      '😈': {
        index: 0,
        count: 2,
        you: false,
        reactors: [reactor1, reactor2],
      },
    },
  });

  beforeEach(async () => {
    // stubs
    Sinon.stub(Reactions, 'handleOpenGroupMessageReactions').resolves();
  });

  afterEach(Sinon.restore);

  describe('add entry to cache', () => {
    it('add entry to cache that is valid', async () => {
      const cacheState = addToMutationCache(validEntry);
      expect(cacheState, 'should not empty').to.not.equal([]);
      expect(cacheState.length, 'should have one entry').to.be.equal(1);
      expect(cacheState[0], 'the entry should match the input').to.be.deep.equal(validEntry);
    });
    it('add entry to cache that is invalid and fail', async () => {
      const cacheState = addToMutationCache(invalidEntry);
      expect(cacheState, 'should not empty').to.not.equal([]);
      expect(cacheState.length, 'should have one entry').to.be.equal(1);
    });
  });

  describe('update entry in cache', () => {
    it('update entry in cache with a valid source entry', async () => {
      const cacheState = updateMutationCache(validEntry, messageResponse.seqno);
      expect(cacheState, 'should not empty').to.not.equal([]);
      expect(cacheState.length, 'should have one entry').to.be.equal(1);
      expect(
        cacheState[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
    it('update entry in cache with an invalid source entry', async () => {
      const cacheState = updateMutationCache(invalidEntry, messageResponse.seqno);
      expect(cacheState, 'should not empty').to.not.equal([]);
      expect(cacheState.length, 'should have one entry').to.be.equal(1);
      expect(
        cacheState[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
    it('update entry in cache with a valid source entry but its not stored in the cache', async () => {
      const notFoundEntry: SogsV3Mutation = {
        server: roomInfos.serverUrl,
        room: roomInfos.roomId,
        changeType: ChangeType.REACTIONS,
        seqno: 400,
        metadata: {
          messageId: originalMessage.serverId!,
          emoji: reaction.emoji,
          action: 'ADD',
        },
      };
      const cacheState = updateMutationCache(notFoundEntry, messageResponse.seqno);
      expect(cacheState, 'should not empty').to.not.equal([]);
      expect(cacheState.length, 'should have one entry').to.be.equal(1);
      expect(
        cacheState[0].seqno,
        'should have an entry with a matching seqno to the message response'
      ).to.be.equal(messageResponse.seqno);
    });
  });

  describe('process opengroup messages using the cache', () => {
    it('processing a message with valid serverUrl, roomId and message should return an updated message', async () => {});
    it('processing a message with valid serverUrl, roomId and invalid message should return undefined', async () => {});
    it('processing a message with valid entries in the cache should remove them if the cached entry seqno number is less than the message seqo', async () => {});
    it('processing a message with valid entries in the cache should calculate the optimistic state if there is no message seqo or the cached entry seqno is larger than the message seqno', async () => {});
  });
});
