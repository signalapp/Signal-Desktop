// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { UUID } from '../../types/UUID';
import {
  _isGroupChangeMessageBounceable,
  _mergeGroupChangeMessages,
} from '../../groups';

describe('group message merging', () => {
  const defaultMessage = {
    id: UUID.generate().toString(),
    conversationId: UUID.generate().toString(),
    timestamp: Date.now(),
    sent_at: Date.now(),
    received_at: Date.now(),
  };
  const uuid = UUID.generate().toString();

  describe('_isGroupChangeMessageBounceable', () => {
    it('should return true for admin approval add', () => {
      assert.isTrue(
        _isGroupChangeMessageBounceable({
          ...defaultMessage,
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              {
                type: 'admin-approval-add-one',
                uuid,
              },
            ],
          },
        })
      );
    });

    it('should return true for bounce message', () => {
      assert.isTrue(
        _isGroupChangeMessageBounceable({
          ...defaultMessage,
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              {
                type: 'admin-approval-bounce',
                times: 1,
                isApprovalPending: true,
                uuid,
              },
            ],
          },
        })
      );
    });

    it('should return false otherwise', () => {
      assert.isFalse(
        _isGroupChangeMessageBounceable({
          ...defaultMessage,
          type: 'group-v2-change',
          groupV2Change: {
            details: [
              {
                type: 'admin-approval-remove-one',
                uuid,
              },
            ],
          },
        })
      );
    });
  });

  describe('_mergeGroupChangeMessages', () => {
    const add = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-add-one' as const,
            uuid,
          },
        ],
      },
    };
    const remove = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-remove-one' as const,
            uuid,
          },
        ],
      },
    };
    const addOther = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-add-one' as const,
            uuid: UUID.generate().toString(),
          },
        ],
      },
    };
    const removeOther = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-remove-one' as const,
            uuid: UUID.generate().toString(),
          },
        ],
      },
    };
    const bounce = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-bounce' as const,
            times: 1,
            isApprovalPending: false,
            uuid,
          },
        ],
      },
    };
    const bounceAndAdd = {
      ...defaultMessage,
      type: 'group-v2-change' as const,
      groupV2Change: {
        details: [
          {
            type: 'admin-approval-bounce' as const,
            times: 1,
            isApprovalPending: true,
            uuid,
          },
        ],
      },
    };

    it('should merge add with remove if uuid matches', () => {
      assert.deepStrictEqual(
        _mergeGroupChangeMessages(add, remove)?.groupV2Change?.details,
        [
          {
            isApprovalPending: false,
            times: 1,
            type: 'admin-approval-bounce',
            uuid,
          },
        ]
      );
    });

    it('should not merge add with remove if uuid does not match', () => {
      assert.isUndefined(_mergeGroupChangeMessages(add, removeOther));
    });

    it('should merge bounce with add if uuid matches', () => {
      assert.deepStrictEqual(
        _mergeGroupChangeMessages(bounce, add)?.groupV2Change?.details,
        [
          {
            isApprovalPending: true,
            times: 1,
            type: 'admin-approval-bounce',
            uuid,
          },
        ]
      );
    });

    it('should merge bounce and add with remove if uuid matches', () => {
      assert.deepStrictEqual(
        _mergeGroupChangeMessages(bounceAndAdd, remove)?.groupV2Change?.details,
        [
          {
            isApprovalPending: false,
            times: 2,
            type: 'admin-approval-bounce',
            uuid,
          },
        ]
      );
    });

    it('should not merge bounce with add if uuid does not match', () => {
      assert.isUndefined(_mergeGroupChangeMessages(bounce, addOther));
    });

    it('should not merge bounce and add with add', () => {
      assert.isUndefined(_mergeGroupChangeMessages(bounceAndAdd, add));
    });

    it('should not merge bounce and add with remove if uuid does not match', () => {
      assert.isUndefined(_mergeGroupChangeMessages(bounceAndAdd, removeOther));
    });

    it('should not merge bounce with remove', () => {
      assert.isUndefined(_mergeGroupChangeMessages(bounce, remove));
    });
  });
});
