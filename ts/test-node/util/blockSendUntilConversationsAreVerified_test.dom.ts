// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { RecipientsByConversation } from '../../state/ducks/stories.preload.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';

import { generateAci } from '../../types/ServiceId.std.js';
import { generateStoryDistributionId } from '../../types/StoryDistributionId.std.js';
import {
  getAllServiceIds,
  filterServiceIds,
} from '../../util/blockSendUntilConversationsAreVerified.dom.js';

describe('both/util/blockSendUntilConversationsAreVerified', () => {
  const SERVICE_ID_1 = generateAci();
  const SERVICE_ID_2 = generateAci();
  const SERVICE_ID_3 = generateAci();
  const SERVICE_ID_4 = generateAci();

  const LIST_ID_1 = generateStoryDistributionId();
  const LIST_ID_2 = generateStoryDistributionId();
  const LIST_ID_3 = generateStoryDistributionId();

  describe('#getAllServiceIds', () => {
    it('should return empty set for empty object', () => {
      const starting: RecipientsByConversation = {};
      const expected: Array<ServiceIdString> = [];
      const actual = getAllServiceIds(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return serviceIds multiple conversations', () => {
      const starting: RecipientsByConversation = {
        [LIST_ID_1]: {
          serviceIds: [SERVICE_ID_1, SERVICE_ID_2],
        },
        [LIST_ID_2]: {
          serviceIds: [],
        },
        [LIST_ID_3]: {
          serviceIds: [SERVICE_ID_2, SERVICE_ID_3],
        },
      };
      const expected: Array<ServiceIdString> = [
        SERVICE_ID_1,
        SERVICE_ID_2,
        SERVICE_ID_3,
      ];
      const actual = getAllServiceIds(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return serviceIds from byDistributionId and its parent', () => {
      const starting: RecipientsByConversation = {
        [LIST_ID_1]: {
          serviceIds: [SERVICE_ID_1, SERVICE_ID_2],
          byDistributionId: {
            [LIST_ID_1]: {
              serviceIds: [SERVICE_ID_3],
            },
            [LIST_ID_2]: {
              serviceIds: [],
            },
            [LIST_ID_3]: {
              serviceIds: [SERVICE_ID_4],
            },
          },
        },
      };
      const expected: Array<ServiceIdString> = [
        SERVICE_ID_1,
        SERVICE_ID_2,
        SERVICE_ID_3,
        SERVICE_ID_4,
      ];
      const actual = getAllServiceIds(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
    it('should return serviceIds from byDistributionId with empty parent', () => {
      const starting: RecipientsByConversation = {
        [LIST_ID_1]: {
          serviceIds: [],
          byDistributionId: {
            [LIST_ID_1]: {
              serviceIds: [SERVICE_ID_3],
            },
          },
        },
      };
      const expected: Array<ServiceIdString> = [SERVICE_ID_3];
      const actual = getAllServiceIds(starting);

      assert.sameMembers(Array.from(actual), expected);
    });
  });

  describe('#filterServiceIds', () => {
    const starting: RecipientsByConversation = {
      [LIST_ID_1]: {
        serviceIds: [SERVICE_ID_1],
        byDistributionId: {
          [LIST_ID_1]: {
            serviceIds: [SERVICE_ID_2, SERVICE_ID_3],
          },
          [LIST_ID_2]: {
            serviceIds: [SERVICE_ID_1],
          },
        },
      },
      [LIST_ID_2]: {
        serviceIds: [SERVICE_ID_1, SERVICE_ID_4],
      },
      [LIST_ID_3]: {
        serviceIds: [SERVICE_ID_3],
        byDistributionId: {
          [LIST_ID_1]: {
            serviceIds: [SERVICE_ID_4],
          },
        },
      },
    };

    it('should return empty object if predicate always returns false', () => {
      const expected: RecipientsByConversation = {};
      const actual = filterServiceIds(starting, () => false);

      assert.deepEqual(actual, expected);
    });
    it('should return exact copy of object if predicate always returns true', () => {
      const expected = starting;
      const actual = filterServiceIds(starting, () => true);

      assert.notStrictEqual(actual, expected);
      assert.deepEqual(actual, expected);
    });
    it('should return just a few serviceIds for selective predicate', () => {
      const expected: RecipientsByConversation = {
        [LIST_ID_1]: {
          serviceIds: [],
          byDistributionId: {
            [LIST_ID_1]: {
              serviceIds: [SERVICE_ID_2, SERVICE_ID_3],
            },
          },
        },
        [LIST_ID_3]: {
          serviceIds: [SERVICE_ID_3],
        },
      };
      const actual = filterServiceIds(
        starting,
        (uuid: ServiceIdString) =>
          uuid === SERVICE_ID_2 || uuid === SERVICE_ID_3
      );

      assert.deepEqual(actual, expected);
    });
  });
});
