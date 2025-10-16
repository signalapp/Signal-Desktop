// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { StateType } from '../../../state/reducer.preload.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { StoryDistributionListDataType } from '../../../state/ducks/storyDistributionLists.preload.js';
import type { StoryDistributionIdString } from '../../../types/StoryDistributionId.std.js';
import type { ServiceIdString } from '../../../types/ServiceId.std.js';
import type { ContactsByStory } from '../../../components/SafetyNumberChangeDialog.dom.js';

import * as Bytes from '../../../Bytes.std.js';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { getEmptyState } from '../../../state/ducks/conversations.preload.js';
import { getByDistributionListConversationsStoppingSend } from '../../../state/selectors/conversations-extra.preload.js';
import { generateAci } from '../../../types/ServiceId.std.js';
import { generateStoryDistributionId } from '../../../types/StoryDistributionId.std.js';
import { noopAction } from '../../../state/ducks/noop.std.js';
import { ID_LENGTH } from '../../../types/groups.std.js';
import { ConversationVerificationState } from '../../../state/ducks/conversationsEnums.std.js';

describe('both/state/selectors/conversations-extra', () => {
  const SERVICE_ID_1 = generateAci();
  const SERVICE_ID_2 = generateAci();
  const LIST_1 = generateStoryDistributionId();
  const LIST_2 = generateStoryDistributionId();
  const GROUP_ID = Bytes.toBase64(new Uint8Array(ID_LENGTH));

  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function makeConversation(
    id: string,
    serviceId?: ServiceIdString
  ): ConversationType {
    const title = `${id} title`;
    return getDefaultConversation({
      id,
      serviceId,
      searchableTitle: title,
      title,
      titleNoDefault: title,
    });
  }

  function makeDistributionList(
    name: string,
    id: StoryDistributionIdString
  ): StoryDistributionListDataType {
    return {
      id,
      name: `distribution ${name}`,
      allowsReplies: true,
      isBlockList: false,
      memberServiceIds: [],
    };
  }

  describe('#getByDistributionListConversationsStoppingSend', () => {
    const direct1 = makeConversation('direct1', SERVICE_ID_1);
    const direct2 = makeConversation('direct2', SERVICE_ID_2);
    const group1 = {
      ...makeConversation('group1'),
      groupVersion: 2 as const,
      groupId: GROUP_ID,
    };
    const state: StateType = {
      ...getEmptyRootState(),
      conversations: {
        ...getEmptyState(),
        conversationLookup: {
          direct1,
          direct2,
          group1,
        },
        conversationsByServiceId: {
          [SERVICE_ID_1]: direct1,
          [SERVICE_ID_2]: direct2,
        },
        verificationDataByConversation: {},
      },
      storyDistributionLists: {
        distributionLists: [
          makeDistributionList('list1', LIST_1),
          makeDistributionList('list2', LIST_2),
        ],
      },
    };

    it('returns empty array for no untrusted recipients', () => {
      const actual = getByDistributionListConversationsStoppingSend(state);
      assert.isEmpty(actual);
    });

    it('returns empty story field for 1:1 conversations', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            direct1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            },
          },
        },
      };
      const expected: ContactsByStory = [
        {
          story: undefined,
          contacts: [direct1, direct2],
        },
      ];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });

    it('returns groups with name set', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            group1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            },
          },
        },
      };
      const expected: ContactsByStory = [
        {
          story: {
            name: 'group1 title',
            conversationId: 'group1',
          },
          contacts: [direct1, direct2],
        },
      ];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });

    it('returns distribution lists with distributionId set', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            direct1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1],
              byDistributionId: {
                [LIST_1]: {
                  serviceIdsNeedingVerification: [SERVICE_ID_2],
                },
              },
            },
          },
        },
      };
      const expected: ContactsByStory = [
        {
          story: undefined,
          contacts: [direct1],
        },
        {
          story: {
            name: 'distribution list1',
            conversationId: 'direct1',
            distributionId: LIST_1,
          },
          contacts: [direct2],
        },
      ];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });

    it('returns distribution lists even if parent is empty', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            direct1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [],
              byDistributionId: {
                [LIST_1]: {
                  serviceIdsNeedingVerification: [SERVICE_ID_1],
                },
                [LIST_2]: {
                  serviceIdsNeedingVerification: [SERVICE_ID_2],
                },
              },
            },
          },
        },
      };
      const expected: ContactsByStory = [
        {
          story: {
            name: 'distribution list1',
            conversationId: 'direct1',
            distributionId: LIST_1,
          },
          contacts: [direct1],
        },
        {
          story: {
            name: 'distribution list2',
            conversationId: 'direct1',
            distributionId: LIST_2,
          },
          contacts: [direct2],
        },
      ];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });

    it('drops items that are not pending verification', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            direct1: {
              type: ConversationVerificationState.VerificationCanceled,
              canceledAt: Date.now(),
            },
            direct2: {
              type: ConversationVerificationState.VerificationCanceled,
              canceledAt: Date.now(),
            },
          },
        },
      };
      const expected: ContactsByStory = [];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });

    it('puts UUIDs from unknown distribution lists into their parent', () => {
      const starting: StateType = {
        ...state,
        conversations: {
          ...state.conversations,
          verificationDataByConversation: {
            direct1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1],
              byDistributionId: {
                // Not a list id!
                [SERVICE_ID_1]: {
                  serviceIdsNeedingVerification: [SERVICE_ID_2],
                },
              },
            },
          },
        },
      };
      const expected: ContactsByStory = [
        {
          story: undefined,
          contacts: [direct1, direct2],
        },
      ];

      const actual = getByDistributionListConversationsStoppingSend(starting);
      assert.sameDeepMembers(actual, expected);
    });
  });
});
