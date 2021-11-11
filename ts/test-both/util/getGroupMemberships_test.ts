// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ConversationType } from '../../state/ducks/conversations';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';
import { getDefaultConversationWithUuid } from '../helpers/getDefaultConversation';

import { getGroupMemberships } from '../../util/getGroupMemberships';

describe('getGroupMemberships', () => {
  const normalConversation1 = getDefaultConversationWithUuid();
  const normalConversation2 = getDefaultConversationWithUuid();
  const unregisteredConversation = getDefaultConversationWithUuid({
    discoveredUnregisteredAt: Date.now(),
  });

  function getConversationByUuid(
    uuid: UUIDStringType
  ): undefined | ConversationType {
    return [
      normalConversation1,
      normalConversation2,
      unregisteredConversation,
    ].find(conversation => conversation.uuid === uuid);
  }

  describe('memberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).memberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { memberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).memberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        memberships: [
          {
            uuid: UUID.generate().toString(),
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).memberships;

      assert.isEmpty(result);
    });

    it('does not filter out unregistered conversations', () => {
      const conversation = {
        memberships: [
          {
            uuid: unregisteredConversation.uuid,
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).memberships;

      assert.lengthOf(result, 1);
      assert.deepEqual(result[0], {
        isAdmin: true,
        member: unregisteredConversation,
      });
    });

    it('hydrates memberships', () => {
      const conversation = {
        memberships: [
          {
            uuid: normalConversation2.uuid,
            isAdmin: false,
          },
          {
            uuid: normalConversation1.uuid,
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).memberships;

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

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingApprovalMemberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingApprovalMemberships: [{ uuid: UUID.generate().toString() }],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingApprovalMemberships: [{ uuid: unregisteredConversation.uuid }],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending-approval memberships', () => {
      const conversation = {
        pendingApprovalMemberships: [
          { uuid: normalConversation2.uuid },
          { uuid: normalConversation1.uuid },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingApprovalMemberships;

      assert.lengthOf(result, 2);
      assert.deepEqual(result[0], { member: normalConversation2 });
      assert.deepEqual(result[1], { member: normalConversation1 });
    });
  });

  describe('pendingMemberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingMemberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingMemberships: [
          {
            uuid: UUID.generate().toString(),
            addedByUserId: normalConversation1.uuid,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingMemberships: [
          {
            uuid: unregisteredConversation.uuid,
            addedByUserId: normalConversation1.uuid,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending memberships', () => {
      const abc = UUID.generate().toString();
      const xyz = UUID.generate().toString();

      const conversation = {
        pendingMemberships: [
          { uuid: normalConversation2.uuid, addedByUserId: abc },
          { uuid: normalConversation1.uuid, addedByUserId: xyz },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByUuid
      ).pendingMemberships;

      assert.lengthOf(result, 2);
      assert.deepEqual(result[0], {
        member: normalConversation2,
        metadata: { addedByUserId: abc },
      });
      assert.deepEqual(result[1], {
        member: normalConversation1,
        metadata: { addedByUserId: xyz },
      });
    });
  });
});
