// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { StateType } from '../../../state/reducer';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { StoryDistributionListDataType } from '../../../state/ducks/storyDistributionLists';
import type { UUIDStringType } from '../../../types/UUID';
import type { ContactsByStory } from '../../../components/SafetyNumberChangeDialog';

import * as Bytes from '../../../Bytes';
import { reducer as rootReducer } from '../../../state/reducer';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { getEmptyState } from '../../../state/ducks/conversations';
import { getByDistributionListConversationsStoppingSend } from '../../../state/selectors/conversations-extra';
import { UUID } from '../../../types/UUID';
import { noopAction } from '../../../state/ducks/noop';
import { ID_LENGTH } from '../../../groups';
import { ConversationVerificationState } from '../../../state/ducks/conversationsEnums';

describe('both/state/selectors/conversations-extra', () => {
  const UUID_1 = UUID.generate().toString();
  const UUID_2 = UUID.generate().toString();
  const LIST_1 = UUID.generate().toString();
  const LIST_2 = UUID.generate().toString();
  const GROUP_ID = Bytes.toBase64(new Uint8Array(ID_LENGTH));

  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function makeConversation(
    id: string,
    uuid?: UUIDStringType
  ): ConversationType {
    const title = `${id} title`;
    return getDefaultConversation({
      id,
      uuid,
      searchableTitle: title,
      title,
      titleNoDefault: title,
    });
  }

  function makeDistributionList(
    name: string,
    id: UUIDStringType
  ): StoryDistributionListDataType {
    return {
      id,
      name: `distribution ${name}`,
      allowsReplies: true,
      isBlockList: false,
      memberUuids: [],
    };
  }

  describe('#getByDistributionListConversationsStoppingSend', () => {
    const direct1 = makeConversation('direct1', UUID_1);
    const direct2 = makeConversation('direct2', UUID_2);
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
        conversationsByUuid: {
          [UUID_1]: direct1,
          [UUID_2]: direct2,
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
              uuidsNeedingVerification: [UUID_1, UUID_2],
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
              uuidsNeedingVerification: [UUID_1, UUID_2],
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
              uuidsNeedingVerification: [UUID_1],
              byDistributionId: {
                [LIST_1]: {
                  uuidsNeedingVerification: [UUID_2],
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
              uuidsNeedingVerification: [],
              byDistributionId: {
                [LIST_1]: {
                  uuidsNeedingVerification: [UUID_1],
                },
                [LIST_2]: {
                  uuidsNeedingVerification: [UUID_2],
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
              type: ConversationVerificationState.VerificationCancelled,
              canceledAt: Date.now(),
            },
            direct2: {
              type: ConversationVerificationState.VerificationCancelled,
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
              uuidsNeedingVerification: [UUID_1],
              byDistributionId: {
                // Not a list id!
                [UUID_1]: {
                  uuidsNeedingVerification: [UUID_2],
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
