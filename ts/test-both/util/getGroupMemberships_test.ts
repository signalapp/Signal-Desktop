// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ConversationType } from '../../state/ducks/conversations';
import { generateAci, normalizeAci } from '../../types/ServiceId';
import type { ServiceIdString } from '../../types/ServiceId';
import { getDefaultConversationWithUuid } from '../helpers/getDefaultConversation';

import { getGroupMemberships } from '../../util/getGroupMemberships';

describe('getGroupMemberships', () => {
  const normalConversation1 = getDefaultConversationWithUuid();
  const normalConversation2 = getDefaultConversationWithUuid();
  const unregisteredConversation = getDefaultConversationWithUuid({
    discoveredUnregisteredAt: Date.now(),
  });

  function getConversationByServiceId(
    serviceId: ServiceIdString
  ): undefined | ConversationType {
    return [
      normalConversation1,
      normalConversation2,
      unregisteredConversation,
    ].find(conversation => conversation.uuid === serviceId);
  }

  describe('memberships', () => {
    it('returns an empty array if passed undefined', () => {
      const conversation = {};

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).memberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { memberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).memberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        memberships: [
          {
            uuid: generateAci(),
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).memberships;

      assert.isEmpty(result);
    });

    it('does not filter out unregistered conversations', () => {
      const conversation = {
        memberships: [
          {
            uuid: normalizeAci(unregisteredConversation.uuid, 'test'),
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
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
            uuid: normalizeAci(normalConversation2.uuid, 'test'),
            isAdmin: false,
          },
          {
            uuid: normalizeAci(normalConversation1.uuid, 'test'),
            isAdmin: true,
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
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
        getConversationByServiceId
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingApprovalMemberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingApprovalMemberships: [{ uuid: generateAci() }],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingApprovalMemberships: [
          { uuid: normalizeAci(unregisteredConversation.uuid, 'test') },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingApprovalMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending-approval memberships', () => {
      const conversation = {
        pendingApprovalMemberships: [
          { uuid: normalizeAci(normalConversation2.uuid, 'test') },
          { uuid: normalizeAci(normalConversation1.uuid, 'test') },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
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
        getConversationByServiceId
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('returns an empty array if passed an empty array', () => {
      const conversation = { pendingMemberships: [] };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it("filters out conversation IDs that don't exist", () => {
      const conversation = {
        pendingMemberships: [
          {
            uuid: generateAci(),
            addedByUserId: normalizeAci(normalConversation1.uuid, 'test'),
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('filters out unregistered conversations', () => {
      const conversation = {
        pendingMemberships: [
          {
            uuid: unregisteredConversation.uuid,
            addedByUserId: normalizeAci(normalConversation1.uuid, 'test'),
          },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
      ).pendingMemberships;

      assert.isEmpty(result);
    });

    it('hydrates pending memberships', () => {
      const abc = generateAci();
      const xyz = generateAci();

      const conversation = {
        pendingMemberships: [
          { uuid: normalConversation2.uuid, addedByUserId: abc },
          { uuid: normalConversation1.uuid, addedByUserId: xyz },
        ],
      };

      const result = getGroupMemberships(
        conversation,
        getConversationByServiceId
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
