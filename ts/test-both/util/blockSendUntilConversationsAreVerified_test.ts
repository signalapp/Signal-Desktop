// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { RecipientsByConversation } from '../../state/ducks/stories';
import type { UUIDStringType } from '../../types/UUID';

import { UUID } from '../../types/UUID';
import {
  getAllUuids,
  filterUuids,
} from '../../util/blockSendUntilConversationsAreVerified';

describe('both/util/blockSendUntilConversationsAreVerified', () => {
  const UUID_1 = UUID.generate().toString();
  const UUID_2 = UUID.generate().toString();
  const UUID_3 = UUID.generate().toString();
  const UUID_4 = UUID.generate().toString();

  describe('#getAllUuids', () => {
    it('should return empty set for empty object', () => {
      const starting: RecipientsByConversation = {};
      const expected: Array<UUIDStringType> = [];
      const actual = getAllUuids(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return uuids multiple conversations', () => {
      const starting: RecipientsByConversation = {
        abc: {
          uuids: [UUID_1, UUID_2],
        },
        def: {
          uuids: [],
        },
        ghi: {
          uuids: [UUID_2, UUID_3],
        },
      };
      const expected: Array<UUIDStringType> = [UUID_1, UUID_2, UUID_3];
      const actual = getAllUuids(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return uuids from byDistributionId and its parent', () => {
      const starting: RecipientsByConversation = {
        abc: {
          uuids: [UUID_1, UUID_2],
          byDistributionId: {
            abc: {
              uuids: [UUID_3],
            },
            def: {
              uuids: [],
            },
            ghi: {
              uuids: [UUID_4],
            },
          },
        },
      };
      const expected: Array<UUIDStringType> = [UUID_1, UUID_2, UUID_3, UUID_4];
      const actual = getAllUuids(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return uuids from byDistributionId with empty parent', () => {
      const starting: RecipientsByConversation = {
        abc: {
          uuids: [],
          byDistributionId: {
            abc: {
              uuids: [UUID_3],
            },
          },
        },
      };
      const expected: Array<UUIDStringType> = [UUID_3];
      const actual = getAllUuids(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
  });

  describe('#filterUuids', () => {
    const starting: RecipientsByConversation = {
      abc: {
        uuids: [UUID_1],
        byDistributionId: {
          abc: {
            uuids: [UUID_2, UUID_3],
          },
          def: {
            uuids: [UUID_1],
          },
        },
      },
      def: {
        uuids: [UUID_1, UUID_4],
      },
      ghi: {
        uuids: [UUID_3],
        byDistributionId: {
          abc: {
            uuids: [UUID_4],
          },
        },
      },
    };

    it('should return empty object if predicate always returns false', () => {
      const expected: RecipientsByConversation = {};
      const actual = filterUuids(starting, () => false);

      assert.deepEqual(actual, expected);
    });
    it('should return exact copy of object if predicate always returns true', () => {
      const expected = starting;
      const actual = filterUuids(starting, () => true);

      assert.notStrictEqual(actual, expected);
      assert.deepEqual(actual, expected);
    });
    it('should return just a few uuids for selective predicate', () => {
      const expected: RecipientsByConversation = {
        abc: {
          uuids: [],
          byDistributionId: {
            abc: {
              uuids: [UUID_2, UUID_3],
            },
          },
        },
        ghi: {
          uuids: [UUID_3],
        },
      };
      const actual = filterUuids(
        starting,
        (uuid: UUIDStringType) => uuid === UUID_2 || uuid === UUID_3
      );

      assert.deepEqual(actual, expected);
    });
  });
});
