// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { generateAci } from '../../types/ServiceId.std.js';
import { normalizeAci } from '../../util/normalizeAci.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';
import { getDefaultConversationWithServiceId } from '../../test-helpers/getDefaultConversation.std.js';

import { getGroupMemberships } from '../../util/getGroupMemberships.dom.js';

describe('getGroupMemberships', () => {
  const normalConversation1 = getDefaultConversationWithServiceId();
  const normalConversation2 = getDefaultConversationWithServiceId();
  const unregisteredConversation = getDefaultConversationWithServiceId({
    discoveredUnregisteredAt: Date.now(),
  });

  function getConversationByServiceId(
    serviceId: ServiceIdString
  ): undefined | ConversationType {
    return [
      normalConversation1,
      normalConversation2,
      unregisteredConversation,
    ].find(conversation => conversation.serviceId === serviceId);
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
            aci: generateAci(),
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
            aci: normalizeAci(unregisteredConversation.serviceId, 'test'),
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
            aci: normalizeAci(normalConversation2.serviceId, 'test'),
            isAdmin: false,
          },
          {
            aci: normalizeAci(normalConversation1.serviceId, 'test'),
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
        pendingApprovalMemberships: [{ aci: generateAci() }],
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
          { aci: normalizeAci(unregisteredConversation.serviceId, 'test') },
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
          { aci: normalizeAci(normalConversation2.serviceId, 'test') },
          { aci: normalizeAci(normalConversation1.serviceId, 'test') },
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
            serviceId: generateAci(),
            addedByUserId: normalizeAci(normalConversation1.serviceId, 'test'),
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
            serviceId: unregisteredConversation.serviceId,
            addedByUserId: normalizeAci(normalConversation1.serviceId, 'test'),
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
          { serviceId: normalConversation2.serviceId, addedByUserId: abc },
          { serviceId: normalConversation1.serviceId, addedByUserId: xyz },
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
