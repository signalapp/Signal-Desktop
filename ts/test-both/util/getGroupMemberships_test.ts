// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { ConversationType } from '../../state/ducks/conversations';
import { getDefaultConversation } from '../helpers/getDefaultConversation';

import { getGroupMemberships } from '../../util/getGroupMemberships';

describe('getGroupMemberships', () => {
  const normalConversation1 = getDefaultConversation();
  const normalConversation2 = getDefaultConversation();
  const unregisteredConversation = getDefaultConversation({
    discoveredUnregisteredAt: Date.now(),
  });

  function getConversationById(id: string): undefined | ConversationType {
    return [
      normalConversation1,
      normalConversation2,
      unregisteredConversation,
    ].find(conversation => conversation.id === id);
  }

  describe('memberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(conversation, getConversationById)
        .memberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { memberships: [] };

      const result = getGroupMemberships(conversation, getConversationById)
        .memberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        memberships: [
          {
            conversationId: 'garbage',
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .memberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        memberships: [
          {
            conversationId: unregisteredConversation.id,
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .memberships;

      assert.isEmpty(result);
    });

    it('hydrates memberships', () => {
      const conversation = {
        memberships: [
          {
            conversationId: normalConversation2.id,
            isAdmin: false,
          },
          {
            conversationId: normalConversation1.id,
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .memberships;

      assert.lengthOf(result, 2);
      assert.deepEqual(result[0], {
        isAdmin: false,
        member: normalConversation2,
      });
      assert.deepEqual(result[1], {
        isAdmin: true,
        member: normalConversation1,
      });
    });
  });

  describe('pendingApprovalMemberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingApprovalMemberships: [] };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingApprovalMemberships: [{ conversationId: 'garbage' }],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingApprovalMemberships: [
          { conversationId: unregisteredConversation.id },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending-approval memberships', () => {
      const conversation = {
        pendingApprovalMemberships: [
          { conversationId: normalConversation2.id },
          { conversationId: normalConversation1.id },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingApprovalMemberships;

      assert.lengthOf(result, 2);
      assert.deepEqual(result[0], { member: normalConversation2 });
      assert.deepEqual(result[1], { member: normalConversation1 });
    });
  });

  describe('pendingMemberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingMemberships: [] };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingMemberships: [
          { conversationId: 'garbage', addedByUserId: normalConversation1.id },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingMemberships: [
          {
            conversationId: unregisteredConversation.id,
            addedByUserId: normalConversation1.id,
          },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending memberships', () => {
      const conversation = {
        pendingMemberships: [
          { conversationId: normalConversation2.id, addedByUserId: 'abc' },
          { conversationId: normalConversation1.id, addedByUserId: 'xyz' },
        ],
      };

      const result = getGroupMemberships(conversation, getConversationById)
        .pendingMemberships;

      assert.lengthOf(result, 2);
      assert.deepEqual(result[0], {
        member: normalConversation2,
        metadata: { addedByUserId: 'abc' },
      });
      assert.deepEqual(result[1], {
        member: normalConversation1,
        metadata: { addedByUserId: 'xyz' },
      });
    });
  });
});
