// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  OneTimeModalState,
  ComposerStep,
  ConversationLookupType,
  ConversationType,
  getEmptyState,
} from '../../../state/ducks/conversations';
import {
  _getConversationComparator,
  _getLeftPaneLists,
  getAllComposableConversations,
  getCandidateContactsForNewGroup,
  getCantAddContactForModal,
  getComposableContacts,
  getComposableGroups,
  getComposeGroupAvatar,
  getComposeGroupName,
  getComposerConversationSearchTerm,
  getComposerStep,
  getComposeSelectedContacts,
  getConversationByIdSelector,
  getConversationSelector,
  getFilteredCandidateContactsForNewGroup,
  getFilteredComposeContacts,
  getFilteredComposeGroups,
  getInvitedContactsForNewlyCreatedGroup,
  getMaximumGroupSizeModalState,
  getPlaceholderContact,
  getRecommendedGroupSizeModalState,
  getSelectedConversation,
  getSelectedConversationId,
  hasGroupCreationError,
  isCreatingGroup,
} from '../../../state/selectors/conversations';
import { noopAction } from '../../../state/ducks/noop';
import { StateType, reducer as rootReducer } from '../../../state/reducer';
import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../helpers/getDefaultConversation';

describe('both/state/selectors/conversations', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function makeConversation(id: string): ConversationType {
    return getDefaultConversation({
      id,
      searchableTitle: `${id} title`,
      title: `${id} title`,
    });
  }

  const i18n = setupI18n('en', enMessages);

  describe('#getConversationByIdSelector', () => {
    const state = {
      ...getEmptyRootState(),
      conversations: {
        ...getEmptyState(),
        conversationLookup: { abc123: makeConversation('abc123') },
      },
    };

    it('returns undefined if the conversation is not in the lookup', () => {
      const selector = getConversationByIdSelector(state);
      const actual = selector('xyz');
      assert.isUndefined(actual);
    });

    it('returns the conversation in the lookup if it exists', () => {
      const selector = getConversationByIdSelector(state);
      const actual = selector('abc123');
      assert.strictEqual(actual?.title, 'abc123 title');
    });
  });

  describe('#getConversationSelector', () => {
    it('returns empty placeholder if falsey id provided', () => {
      const state = getEmptyRootState();
      const selector = getConversationSelector(state);

      const actual = selector(undefined);

      assert.deepEqual(actual, getPlaceholderContact());
    });
    it('returns empty placeholder if no match', () => {
      const state = {
        ...getEmptyRootState(),
      };
      const selector = getConversationSelector(state);

      const actual = selector('random-id');

      assert.deepEqual(actual, getPlaceholderContact());
    });

    it('returns conversation by e164 first', () => {
      const id = 'id';

      const conversation = makeConversation(id);
      const wrongConversation = makeConversation('wrong');

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: wrongConversation,
          },
          conversationsByE164: {
            [id]: conversation,
          },
          conversationsByUuid: {
            [id]: wrongConversation,
          },
          conversationsByGroupId: {
            [id]: wrongConversation,
          },
        },
      };

      const selector = getConversationSelector(state);

      const actual = selector(id);

      assert.strictEqual(actual, conversation);
    });
    it('returns conversation by uuid', () => {
      const id = 'id';

      const conversation = makeConversation(id);
      const wrongConversation = makeConversation('wrong');

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: wrongConversation,
          },
          conversationsByUuid: {
            [id]: conversation,
          },
          conversationsByGroupId: {
            [id]: wrongConversation,
          },
        },
      };

      const selector = getConversationSelector(state);

      const actual = selector(id);

      assert.strictEqual(actual, conversation);
    });
    it('returns conversation by groupId', () => {
      const id = 'id';

      const conversation = makeConversation(id);
      const wrongConversation = makeConversation('wrong');

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: wrongConversation,
          },
          conversationsByGroupId: {
            [id]: conversation,
          },
        },
      };

      const selector = getConversationSelector(state);

      const actual = selector(id);

      assert.strictEqual(actual, conversation);
    });
    it('returns conversation by conversationId', () => {
      const id = 'id';

      const conversation = makeConversation(id);

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: conversation,
          },
        },
      };

      const selector = getConversationSelector(state);

      const actual = selector(id);

      assert.strictEqual(actual, conversation);
    });

    // Less important now, given that all prop-generation for conversations is in
    //   models/conversation.getProps() and not here.
    it('does proper caching of result', () => {
      const id = 'id';

      const conversation = makeConversation(id);

      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: conversation,
          },
        },
      };

      const selector = getConversationSelector(state);

      const actual = selector(id);

      const secondState = {
        ...state,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: conversation,
          },
        },
      };

      const secondSelector = getConversationSelector(secondState);
      const secondActual = secondSelector(id);

      assert.strictEqual(actual, secondActual);

      const thirdState = {
        ...state,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            [id]: makeConversation('third'),
          },
        },
      };

      const thirdSelector = getConversationSelector(thirdState);
      const thirdActual = thirdSelector(id);

      assert.notStrictEqual(actual, thirdActual);
    });
  });

  describe('#getInvitedContactsForNewlyCreatedGroup', () => {
    it('returns an empty array if there are no invited contacts', () => {
      const state = getEmptyRootState();

      assert.deepEqual(getInvitedContactsForNewlyCreatedGroup(state), []);
    });

    it('returns "hydrated" invited contacts', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc: makeConversation('abc'),
            def: makeConversation('def'),
          },
          invitedConversationIdsForNewlyCreatedGroup: ['def', 'abc'],
        },
      };
      const result = getInvitedContactsForNewlyCreatedGroup(state);
      const titles = result.map(conversation => conversation.title);

      assert.deepEqual(titles, ['def title', 'abc title']);
    });
  });

  describe('#getComposerStep', () => {
    it("returns undefined if the composer isn't open", () => {
      const state = getEmptyRootState();
      const result = getComposerStep(state);

      assert.isUndefined(result);
    });

    it('returns the first step of the composer', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            searchTerm: 'foo',
          },
        },
      };
      const result = getComposerStep(state);

      assert.strictEqual(result, ComposerStep.StartDirectConversation);
    });

    it('returns the second step of the composer', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            searchTerm: 'foo',
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        },
      };
      const result = getComposerStep(state);

      assert.strictEqual(result, ComposerStep.ChooseGroupMembers);
    });

    it('returns the third step of the composer', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
            isCreating: false,
            hasError: false as const,
          },
        },
      };
      const result = getComposerStep(state);

      assert.strictEqual(result, ComposerStep.SetGroupMetadata);
    });
  });

  describe('#hasGroupCreationError', () => {
    it('returns false if not in the "set group metadata" composer step', () => {
      assert.isFalse(hasGroupCreationError(getEmptyRootState()));

      assert.isFalse(
        hasGroupCreationError({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.StartDirectConversation,
              searchTerm: '',
            },
          },
        })
      );
    });

    it('returns false if there is no group creation error', () => {
      assert.isFalse(
        hasGroupCreationError({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.SetGroupMetadata as const,
              selectedConversationIds: [],
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
              isCreating: false as const,
              hasError: false as const,
            },
          },
        })
      );
    });

    it('returns true if there is a group creation error', () => {
      assert.isTrue(
        hasGroupCreationError({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.SetGroupMetadata as const,
              selectedConversationIds: [],
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
              isCreating: false as const,
              hasError: true as const,
            },
          },
        })
      );
    });
  });

  describe('#isCreatingGroup', () => {
    it('returns false if not in the "set group metadata" composer step', () => {
      assert.isFalse(hasGroupCreationError(getEmptyRootState()));

      assert.isFalse(
        isCreatingGroup({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.StartDirectConversation,
              searchTerm: '',
            },
          },
        })
      );
    });

    it('returns false if the group is not being created', () => {
      assert.isFalse(
        isCreatingGroup({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.SetGroupMetadata as const,
              selectedConversationIds: [],
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
              isCreating: false as const,
              hasError: true as const,
            },
          },
        })
      );
    });

    it('returns true if the group is being created', () => {
      assert.isTrue(
        isCreatingGroup({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.SetGroupMetadata as const,
              selectedConversationIds: [],
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
              isCreating: true as const,
              hasError: false as const,
            },
          },
        })
      );
    });
  });

  describe('#getAllComposableConversations', () => {
    const getRootState = (): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
              profileName: 'My own name',
            },
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    const getRootStateWithConversations = (): StateType => {
      const result = getRootState();
      Object.assign(result.conversations.conversationLookup, {
        'convo-1': {
          ...makeConversation('convo-1'),
          type: 'direct',
          profileName: 'A',
          title: 'A',
        },
        'convo-2': {
          ...makeConversation('convo-2'),
          type: 'group',
          isGroupV1AndDisabled: true,
          name: '2',
          title: 'Should Be Dropped (GV1)',
        },
        'convo-3': {
          ...makeConversation('convo-3'),
          type: 'group',
          name: 'B',
          title: 'B',
        },
        'convo-4': {
          ...makeConversation('convo-4'),
          isBlocked: true,
          name: '4',
          title: 'Should Be Dropped (blocked)',
        },
        'convo-5': {
          ...makeConversation('convo-5'),
          discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
          name: 'C',
          title: 'C',
        },
        'convo-6': {
          ...makeConversation('convo-6'),
          profileSharing: true,
          name: 'Should Be Droped (no title)',
          title: null,
        },
        'convo-7': {
          ...makeConversation('convo-7'),
          discoveredUnregisteredAt: Date.now(),
          name: '7',
          title: 'Should Be Dropped (unregistered)',
        },
      });
      return result;
    };

    it('returns no gv1, no blocked, no missing titles', () => {
      const state = getRootStateWithConversations();
      const result = getAllComposableConversations(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, [
        'our-conversation-id',
        'convo-1',
        'convo-3',
        'convo-5',
      ]);
    });
  });

  describe('#getComposableContacts', () => {
    const getRootState = (): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
            },
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    it('returns only direct contacts, including me', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              isMe: true,
              profileSharing: false,
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              type: 'group' as const,
              name: 'Friends!',
              sharedGroupNames: [],
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              name: 'Alice',
            },
          },
        },
      };

      const result = getComposableContacts(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-0', 'convo-2']);
    });
    it('excludes blocked, unregistered, and missing name/profileSharing', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              name: 'Ex',
              isBlocked: true,
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              name: 'Bob',
              discoveredUnregisteredAt: Date.now(),
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              name: 'Charlie',
            },
          },
        },
      };

      const result = getComposableContacts(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-2']);
    });
  });

  describe('#getCandidateContactsForNewGroup', () => {
    const getRootState = (): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
            },
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    it('returns only direct contacts, without me', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              isMe: true,
              name: 'Me!',
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              type: 'group' as const,
              name: 'Friends!',
              sharedGroupNames: [],
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              name: 'Alice',
            },
          },
        },
      };

      const result = getCandidateContactsForNewGroup(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-2']);
    });
    it('excludes blocked, unregistered, and missing name/profileSharing', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              name: 'Ex',
              isBlocked: true,
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              name: 'Bob',
              discoveredUnregisteredAt: Date.now(),
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              name: 'Charlie',
            },
          },
        },
      };

      const result = getCandidateContactsForNewGroup(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-2']);
    });
  });

  describe('#getComposableGroups', () => {
    const getRootState = (): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
            },
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    it('returns only groups with name', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              isMe: true,
              name: 'Me!',
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              type: 'group' as const,
              name: 'Friends!',
              sharedGroupNames: [],
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              type: 'group' as const,
              sharedGroupNames: [],
            },
          },
        },
      };

      const result = getComposableGroups(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-1']);
    });
    it('excludes blocked, and missing name/profileSharing', () => {
      const state = {
        ...getRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-0': {
              ...makeConversation('convo-0'),
              type: 'group' as const,
              name: 'Family!',
              isBlocked: true,
              sharedGroupNames: [],
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              type: 'group' as const,
              name: 'Friends!',
              sharedGroupNames: [],
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              type: 'group' as const,
              sharedGroupNames: [],
            },
          },
        },
      };

      const result = getComposableGroups(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-1']);
    });
  });

  describe('#getFilteredComposeContacts', () => {
    const getRootState = (searchTerm = ''): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              name: 'Me, Myself, and I',
              title: 'Me, Myself, and I',
              searchableTitle: 'Note to Self',
              isMe: true,
            },
          },
          composer: {
            step: ComposerStep.StartDirectConversation,
            searchTerm,
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    const getRootStateWithConversations = (searchTerm = ''): StateType => {
      const result = getRootState(searchTerm);
      Object.assign(result.conversations.conversationLookup, {
        'convo-1': {
          ...makeConversation('convo-1'),
          name: 'In System Contacts',
          title: 'A. Sorted First',
        },
        'convo-2': {
          ...makeConversation('convo-2'),
          title: 'Should Be Dropped (no name, no profile sharing)',
        },
        'convo-3': {
          ...makeConversation('convo-3'),
          type: 'group',
          title: 'Should Be Dropped (group)',
        },
        'convo-4': {
          ...makeConversation('convo-4'),
          isBlocked: true,
          title: 'Should Be Dropped (blocked)',
        },
        'convo-5': {
          ...makeConversation('convo-5'),
          discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
          name: 'In System Contacts (and unregistered too long ago)',
          title: 'B. Sorted Second',
        },
        'convo-6': {
          ...makeConversation('convo-6'),
          profileSharing: true,
          profileName: 'C. Has Profile Sharing',
          title: 'C. Has Profile Sharing',
        },
        'convo-7': {
          ...makeConversation('convo-7'),
          discoveredUnregisteredAt: Date.now(),
          title: 'Should Be Dropped (unregistered)',
        },
      });
      return result;
    };

    it('returns no results when there are no contacts', () => {
      const state = getRootState('foo bar baz');
      const result = getFilteredComposeContacts(state);

      assert.isEmpty(result);
    });

    it('includes Note to Self with no search term', () => {
      const state = getRootStateWithConversations();
      const result = getFilteredComposeContacts(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, [
        'convo-1',
        'convo-5',
        'convo-6',
        'our-conversation-id',
      ]);
    });

    it('can search for contacts', () => {
      const state = getRootStateWithConversations('in system');
      const result = getFilteredComposeContacts(state);

      const ids = result.map(contact => contact.id);
      // NOTE: convo-6 matches because you can't write "Sharing" without "in"
      assert.deepEqual(ids, ['convo-1', 'convo-5', 'convo-6']);
    });

    it('can search for note to self', () => {
      const state = getRootStateWithConversations('note');
      const result = getFilteredComposeContacts(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, ['our-conversation-id']);
    });

    it('returns note to self when searching for your own name', () => {
      const state = getRootStateWithConversations('Myself');
      const result = getFilteredComposeContacts(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, ['our-conversation-id']);
    });
  });

  describe('#getFilteredComposeGroups', () => {
    const getState = (searchTerm = ''): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              name: 'In System Contacts',
              title: 'Should be dropped (contact)',
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              title: 'Should be dropped (contact)',
            },
            'convo-3': {
              ...makeConversation('convo-3'),
              type: 'group',
              name: 'Hello World',
              title: 'Hello World',
              sharedGroupNames: [],
            },
            'convo-4': {
              ...makeConversation('convo-4'),
              type: 'group',
              isBlocked: true,
              title: 'Should be dropped (blocked)',
              sharedGroupNames: [],
            },
            'convo-5': {
              ...makeConversation('convo-5'),
              type: 'group',
              title: 'Unknown Group',
              sharedGroupNames: [],
            },
            'convo-6': {
              ...makeConversation('convo-6'),
              type: 'group',
              name: 'Signal',
              title: 'Signal',
              sharedGroupNames: [],
            },
            'convo-7': {
              ...makeConversation('convo-7'),
              profileSharing: false,
              type: 'group',
              name: 'Signal Fake',
              title: 'Signal Fake',
              sharedGroupNames: [],
            },
          },
          composer: {
            step: ComposerStep.StartDirectConversation,
            searchTerm,
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    it('can search for groups', () => {
      const state = getState('hello');
      const result = getFilteredComposeGroups(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-3']);
    });

    it('does not return unknown groups when getting all groups (no search term)', () => {
      const state = getState();
      const result = getFilteredComposeGroups(state);

      const ids = result.map(group => group.id);
      assert.deepEqual(ids, ['convo-3', 'convo-6', 'convo-7']);
    });
  });

  describe('#getFilteredCandidateContactsForNewGroup', () => {
    const getRootState = (searchTerm = ''): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...makeConversation('our-conversation-id'),
              isMe: true,
            },
            'convo-1': {
              ...makeConversation('convo-1'),
              name: 'In System Contacts',
              title: 'A. Sorted First',
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              title: 'Should be dropped (has no name)',
            },
            'convo-3': {
              ...makeConversation('convo-3'),
              type: 'group',
              title: 'Should Be Dropped (group)',
              sharedGroupNames: [],
            },
            'convo-4': {
              ...makeConversation('convo-4'),
              isBlocked: true,
              name: 'My Name',
              title: 'Should Be Dropped (blocked)',
            },
            'convo-5': {
              ...makeConversation('convo-5'),
              discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
              name: 'In System Contacts (and unregistered too long ago)',
              title: 'C. Sorted Third',
            },
            'convo-6': {
              ...makeConversation('convo-6'),
              discoveredUnregisteredAt: Date.now(),
              name: 'My Name',
              title: 'Should Be Dropped (unregistered)',
            },
          },
          composer: {
            step: ComposerStep.ChooseGroupMembers,
            searchTerm,
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    it('returns sorted contacts when there is no search term', () => {
      const state = getRootState();
      const result = getFilteredCandidateContactsForNewGroup(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, ['convo-1', 'convo-5']);
    });

    it('can search for contacts', () => {
      const state = getRootState('system contacts');
      const result = getFilteredCandidateContactsForNewGroup(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, ['convo-1', 'convo-5']);
    });
  });

  describe('#getCantAddContactForModal', () => {
    it('returns undefined if not in the "choose group members" composer step', () => {
      assert.isUndefined(getCantAddContactForModal(getEmptyRootState()));

      assert.isUndefined(
        getCantAddContactForModal({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.StartDirectConversation,
              searchTerm: '',
            },
          },
        })
      );
    });

    it("returns undefined if there's no contact marked", () => {
      assert.isUndefined(
        getCantAddContactForModal({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              cantAddContactIdForModal: undefined,
              searchTerm: '',
              groupAvatar: undefined,
              groupName: '',
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              selectedConversationIds: [],
              step: ComposerStep.ChooseGroupMembers as const,
            },
          },
        })
      );
    });

    it('returns the marked contact', () => {
      const conversation = makeConversation('abc123');

      assert.deepEqual(
        getCantAddContactForModal({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            conversationLookup: { abc123: conversation },
            composer: {
              cantAddContactIdForModal: 'abc123',
              searchTerm: '',
              groupAvatar: undefined,
              groupName: '',
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              selectedConversationIds: [],
              step: ComposerStep.ChooseGroupMembers as const,
            },
          },
        }),
        conversation
      );
    });
  });

  describe('#getComposerConversationSearchTerm', () => {
    it("returns the composer's contact search term", () => {
      assert.strictEqual(
        getComposerConversationSearchTerm({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.StartDirectConversation,
              searchTerm: 'foo bar',
            },
          },
        }),
        'foo bar'
      );
    });
  });

  describe('#_getLeftPaneLists', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const data: ConversationLookupType = {
        id1: getDefaultConversation({
          id: 'id1',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'No timestamp',
          timestamp: 0,
          inboxPosition: 0,
          phoneNumber: 'notused',
          isArchived: false,
          markedUnread: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'No timestamp',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        }),
        id2: getDefaultConversation({
          id: 'id2',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'B',
          timestamp: 20,
          inboxPosition: 21,
          phoneNumber: 'notused',
          isArchived: false,
          markedUnread: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'B',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        }),
        id3: getDefaultConversation({
          id: 'id3',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'C',
          timestamp: 20,
          inboxPosition: 22,
          phoneNumber: 'notused',
          isArchived: false,
          markedUnread: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'C',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        }),
        id4: getDefaultConversation({
          id: 'id4',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'Á',
          timestamp: 20,
          inboxPosition: 20,
          phoneNumber: 'notused',
          isArchived: false,
          markedUnread: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'A',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        }),
        id5: getDefaultConversation({
          id: 'id5',
          e164: '+18005551111',
          activeAt: Date.now(),
          name: 'First!',
          timestamp: 30,
          inboxPosition: 30,
          phoneNumber: 'notused',
          isArchived: false,
          markedUnread: false,

          type: 'direct',
          isMe: false,
          lastUpdated: Date.now(),
          title: 'First!',
          unreadCount: 1,
          isSelected: false,
          typingContact: {
            name: 'Someone There',
            color: 'blue',
            phoneNumber: '+18005551111',
          },

          acceptedMessageRequest: true,
        }),
      };
      const comparator = _getConversationComparator();
      const {
        archivedConversations,
        conversations,
        pinnedConversations,
      } = _getLeftPaneLists(data, comparator);

      assert.strictEqual(conversations[0].name, 'First!');
      assert.strictEqual(conversations[1].name, 'Á');
      assert.strictEqual(conversations[2].name, 'B');
      assert.strictEqual(conversations[3].name, 'C');
      assert.strictEqual(conversations[4].name, 'No timestamp');
      assert.strictEqual(conversations.length, 5);

      assert.strictEqual(archivedConversations.length, 0);

      assert.strictEqual(pinnedConversations.length, 0);
    });

    describe('given pinned conversations', () => {
      it('sorts pinned conversations based on order in storage', () => {
        const data: ConversationLookupType = {
          pin2: getDefaultConversation({
            id: 'pin2',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin Two',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Two',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin3: getDefaultConversation({
            id: 'pin3',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin Three',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Three',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin1: getDefaultConversation({
            id: 'pin1',
            e164: '+18005551111',
            activeAt: Date.now(),
            name: 'Pin One',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin One',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
        };

        const pinnedConversationIds = ['pin1', 'pin2', 'pin3'];
        const comparator = _getConversationComparator();
        const {
          archivedConversations,
          conversations,
          pinnedConversations,
        } = _getLeftPaneLists(
          data,
          comparator,
          undefined,
          pinnedConversationIds
        );

        assert.strictEqual(pinnedConversations[0].name, 'Pin One');
        assert.strictEqual(pinnedConversations[1].name, 'Pin Two');
        assert.strictEqual(pinnedConversations[2].name, 'Pin Three');

        assert.strictEqual(archivedConversations.length, 0);

        assert.strictEqual(conversations.length, 0);
      });

      it('includes archived and pinned conversations with no active_at', () => {
        const data: ConversationLookupType = {
          pin2: getDefaultConversation({
            id: 'pin2',
            e164: '+18005551111',
            name: 'Pin Two',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Two',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin3: getDefaultConversation({
            id: 'pin3',
            e164: '+18005551111',
            name: 'Pin Three',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin Three',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin1: getDefaultConversation({
            id: 'pin1',
            e164: '+18005551111',
            name: 'Pin One',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: true,
            isPinned: true,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin One',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin4: getDefaultConversation({
            id: 'pin1',
            e164: '+18005551111',
            name: 'Pin Four',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            activeAt: Date.now(),
            isArchived: true,
            isPinned: false,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin One',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
          pin5: getDefaultConversation({
            id: 'pin1',
            e164: '+18005551111',
            name: 'Pin Five',
            timestamp: 30,
            inboxPosition: 30,
            phoneNumber: 'notused',
            isArchived: false,
            isPinned: false,
            markedUnread: false,

            type: 'direct',
            isMe: false,
            lastUpdated: Date.now(),
            title: 'Pin One',
            unreadCount: 1,
            isSelected: false,
            typingContact: {
              name: 'Someone There',
              color: 'blue',
              phoneNumber: '+18005551111',
            },

            acceptedMessageRequest: true,
          }),
        };

        const pinnedConversationIds = ['pin1', 'pin2', 'pin3'];
        const comparator = _getConversationComparator();
        const {
          archivedConversations,
          conversations,
          pinnedConversations,
        } = _getLeftPaneLists(
          data,
          comparator,
          undefined,
          pinnedConversationIds
        );

        assert.strictEqual(pinnedConversations[0].name, 'Pin One');
        assert.strictEqual(pinnedConversations[1].name, 'Pin Two');
        assert.strictEqual(pinnedConversations[2].name, 'Pin Three');
        assert.strictEqual(pinnedConversations.length, 3);

        assert.strictEqual(archivedConversations[0].name, 'Pin Four');
        assert.strictEqual(archivedConversations.length, 1);

        assert.strictEqual(conversations.length, 0);
      });
    });
  });

  describe('#getMaximumGroupSizeModalState', () => {
    it('returns the modal state', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: undefined,
            searchTerm: 'to be cleared',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.Showing,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        },
      };
      assert.strictEqual(
        getMaximumGroupSizeModalState(state),
        OneTimeModalState.Showing
      );
    });
  });

  describe('#getRecommendedGroupSizeModalState', () => {
    it('returns the modal state', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: undefined,
            searchTerm: 'to be cleared',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            recommendedGroupSizeModalState: OneTimeModalState.Showing,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        },
      };
      assert.strictEqual(
        getRecommendedGroupSizeModalState(state),
        OneTimeModalState.Showing
      );
    });
  });

  describe('#getComposeGroupAvatar', () => {
    it('returns undefined if there is no group avatar', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
            isCreating: false,
            hasError: false as const,
          },
        },
      };
      assert.isUndefined(getComposeGroupAvatar(state));
    });

    it('returns the group avatar', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: new Uint8Array([1, 2, 3]).buffer,
            isCreating: false,
            hasError: false as const,
          },
        },
      };
      assert.deepEqual(
        getComposeGroupAvatar(state),
        new Uint8Array([1, 2, 3]).buffer
      );
    });
  });

  describe('#getComposeGroupName', () => {
    it('returns the group name', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: ['abc'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'foo bar',
            groupAvatar: undefined,
            isCreating: false,
            hasError: false as const,
          },
        },
      };
      assert.deepEqual(getComposeGroupName(state), 'foo bar');
    });
  });

  describe('#getComposeSelectedContacts', () => {
    it("returns the composer's selected contacts", () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'convo-1': {
              ...makeConversation('convo-1'),
              title: 'Person One',
            },
            'convo-2': {
              ...makeConversation('convo-2'),
              title: 'Person Two',
            },
          },
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: ['convo-2', 'convo-1'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'foo bar',
            groupAvatar: undefined,
            isCreating: false,
            hasError: false as const,
          },
        },
      };

      const titles = getComposeSelectedContacts(state).map(
        contact => contact.title
      );
      assert.deepEqual(titles, ['Person Two', 'Person One']);
    });
  });

  describe('#getSelectedConversationId', () => {
    it('returns undefined if no conversation is selected', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc123: makeConversation('abc123'),
          },
        },
      };
      assert.isUndefined(getSelectedConversationId(state));
    });

    it('returns the selected conversation ID', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc123: makeConversation('abc123'),
          },
          selectedConversationId: 'abc123',
        },
      };
      assert.strictEqual(getSelectedConversationId(state), 'abc123');
    });
  });

  describe('#getSelectedConversation', () => {
    it('returns undefined if no conversation is selected', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc123: makeConversation('abc123'),
          },
        },
      };
      assert.isUndefined(getSelectedConversation(state));
    });

    it('returns the selected conversation', () => {
      const conversation = makeConversation('abc123');
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc123: conversation,
          },
          selectedConversationId: 'abc123',
        },
      };
      assert.strictEqual(getSelectedConversation(state), conversation);
    });
  });
});
