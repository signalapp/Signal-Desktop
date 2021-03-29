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
  getCandidateContactsForNewGroup,
  getCantAddContactForModal,
  getComposeContacts,
  getComposeGroupAvatar,
  getComposeGroupName,
  getComposeSelectedContacts,
  getComposerContactSearchTerm,
  getComposerStep,
  getConversationSelector,
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

describe('both/state/selectors/conversations', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  function getDefaultConversation(id: string): ConversationType {
    return {
      id,
      type: 'direct',
      title: `${id} title`,
    };
  }

  const i18n = setupI18n('en', enMessages);

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

      const conversation = getDefaultConversation(id);
      const wrongConversation = getDefaultConversation('wrong');

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

      const conversation = getDefaultConversation(id);
      const wrongConversation = getDefaultConversation('wrong');

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

      const conversation = getDefaultConversation(id);
      const wrongConversation = getDefaultConversation('wrong');

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

      const conversation = getDefaultConversation(id);

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

      const conversation = getDefaultConversation(id);

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
            [id]: getDefaultConversation('third'),
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
            abc: getDefaultConversation('abc'),
            def: getDefaultConversation('def'),
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
            contactSearchTerm: 'foo',
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
            contactSearchTerm: 'foo',
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
              contactSearchTerm: '',
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
              contactSearchTerm: '',
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

  describe('#getComposeContacts', () => {
    const getRootState = (contactSearchTerm = ''): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...getDefaultConversation('our-conversation-id'),
              isMe: true,
            },
          },
          composer: {
            step: ComposerStep.StartDirectConversation,
            contactSearchTerm,
          },
        },
        user: {
          ...rootState.user,
          ourConversationId: 'our-conversation-id',
          i18n,
        },
      };
    };

    const getRootStateWithConverastions = (
      contactSearchTerm = ''
    ): StateType => {
      const result = getRootState(contactSearchTerm);
      Object.assign(result.conversations.conversationLookup, {
        'convo-1': {
          ...getDefaultConversation('convo-1'),
          name: 'In System Contacts',
          title: 'A. Sorted First',
        },
        'convo-2': {
          ...getDefaultConversation('convo-2'),
          title: 'Should Be Dropped (no name, no profile sharing)',
        },
        'convo-3': {
          ...getDefaultConversation('convo-3'),
          type: 'group',
          title: 'Should Be Dropped (group)',
        },
        'convo-4': {
          ...getDefaultConversation('convo-4'),
          isBlocked: true,
          title: 'Should Be Dropped (blocked)',
        },
        'convo-5': {
          ...getDefaultConversation('convo-5'),
          discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
          name: 'In System Contacts (and unregistered too long ago)',
          title: 'B. Sorted Second',
        },
        'convo-6': {
          ...getDefaultConversation('convo-6'),
          profileSharing: true,
          title: 'C. Has Profile Sharing',
        },
        'convo-7': {
          ...getDefaultConversation('convo-7'),
          discoveredUnregisteredAt: Date.now(),
          title: 'Should Be Dropped (unregistered)',
        },
      });
      return result;
    };

    it('only returns Note to Self when there are no other contacts', () => {
      const state = getRootState();
      const result = getComposeContacts(state);

      assert.lengthOf(result, 1);
      assert.strictEqual(result[0]?.id, 'our-conversation-id');
    });

    it("returns no results when search doesn't match Note to Self and there are no other contacts", () => {
      const state = getRootState('foo bar baz');
      const result = getComposeContacts(state);

      assert.isEmpty(result);
    });

    it('returns contacts with Note to Self at the end when there is no search term', () => {
      const state = getRootStateWithConverastions();
      const result = getComposeContacts(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, [
        'convo-1',
        'convo-5',
        'convo-6',
        'our-conversation-id',
      ]);
    });

    it('can search for contacts', () => {
      const state = getRootStateWithConverastions('in system');
      const result = getComposeContacts(state);

      const ids = result.map(contact => contact.id);
      // NOTE: convo-6 matches because you can't write "Sharing" without "in"
      assert.deepEqual(ids, ['convo-1', 'convo-5', 'convo-6']);
    });
  });

  describe('#getCandidateContactsForNewGroup', () => {
    const getRootState = (contactSearchTerm = ''): StateType => {
      const rootState = getEmptyRootState();
      return {
        ...rootState,
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            'our-conversation-id': {
              ...getDefaultConversation('our-conversation-id'),
              isMe: true,
            },
            'convo-1': {
              ...getDefaultConversation('convo-1'),
              name: 'In System Contacts',
              title: 'A. Sorted First',
            },
            'convo-2': {
              ...getDefaultConversation('convo-2'),
              title: 'Should be dropped (has no name)',
            },
            'convo-3': {
              ...getDefaultConversation('convo-3'),
              type: 'group',
              title: 'Should Be Dropped (group)',
            },
            'convo-4': {
              ...getDefaultConversation('convo-4'),
              isBlocked: true,
              name: 'My Name',
              title: 'Should Be Dropped (blocked)',
            },
            'convo-5': {
              ...getDefaultConversation('convo-5'),
              discoveredUnregisteredAt: new Date(1999, 3, 20).getTime(),
              name: 'In System Contacts (and unregistered too long ago)',
              title: 'C. Sorted Third',
            },
            'convo-6': {
              ...getDefaultConversation('convo-6'),
              discoveredUnregisteredAt: Date.now(),
              name: 'My Name',
              title: 'Should Be Dropped (unregistered)',
            },
          },
          composer: {
            step: ComposerStep.ChooseGroupMembers,
            contactSearchTerm,
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
      const result = getCandidateContactsForNewGroup(state);

      const ids = result.map(contact => contact.id);
      assert.deepEqual(ids, ['convo-1', 'convo-5']);
    });

    it('can search for contacts', () => {
      const state = getRootState('system contacts');
      const result = getCandidateContactsForNewGroup(state);

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
              contactSearchTerm: '',
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
              contactSearchTerm: '',
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
      const conversation = getDefaultConversation('abc123');

      assert.deepEqual(
        getCantAddContactForModal({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            conversationLookup: { abc123: conversation },
            composer: {
              cantAddContactIdForModal: 'abc123',
              contactSearchTerm: '',
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

  describe('#getComposerContactSearchTerm', () => {
    it("returns the composer's contact search term", () => {
      assert.strictEqual(
        getComposerContactSearchTerm({
          ...getEmptyRootState(),
          conversations: {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.StartDirectConversation,
              contactSearchTerm: 'foo bar',
            },
          },
        }),
        'foo bar'
      );
    });
  });

  describe('#getLeftPaneList', () => {
    it('sorts conversations based on timestamp then by intl-friendly title', () => {
      const data: ConversationLookupType = {
        id1: {
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
        },
        id2: {
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
        },
        id3: {
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
        },
        id4: {
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
        },
        id5: {
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
        },
      };
      const comparator = _getConversationComparator();
      const { conversations } = _getLeftPaneLists(data, comparator);

      assert.strictEqual(conversations[0].name, 'First!');
      assert.strictEqual(conversations[1].name, 'Á');
      assert.strictEqual(conversations[2].name, 'B');
      assert.strictEqual(conversations[3].name, 'C');
      assert.strictEqual(conversations[4].name, 'No timestamp');
    });

    describe('given pinned conversations', () => {
      it('sorts pinned conversations based on order in storage', () => {
        const data: ConversationLookupType = {
          pin2: {
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
          },
          pin3: {
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
          },
          pin1: {
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
          },
        };

        const pinnedConversationIds = ['pin1', 'pin2', 'pin3'];
        const comparator = _getConversationComparator();
        const { pinnedConversations } = _getLeftPaneLists(
          data,
          comparator,
          undefined,
          pinnedConversationIds
        );

        assert.strictEqual(pinnedConversations[0].name, 'Pin One');
        assert.strictEqual(pinnedConversations[1].name, 'Pin Two');
        assert.strictEqual(pinnedConversations[2].name, 'Pin Three');
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
            contactSearchTerm: 'to be cleared',
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
            contactSearchTerm: 'to be cleared',
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
              ...getDefaultConversation('convo-1'),
              title: 'Person One',
            },
            'convo-2': {
              ...getDefaultConversation('convo-2'),
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
            abc123: getDefaultConversation('abc123'),
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
            abc123: getDefaultConversation('abc123'),
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
            abc123: getDefaultConversation('abc123'),
          },
        },
      };
      assert.isUndefined(getSelectedConversation(state));
    });

    it('returns the selected conversation ID', () => {
      const state = {
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc123: getDefaultConversation('abc123'),
          },
          selectedConversationId: 'abc123',
        },
      };
      assert.deepEqual(
        getSelectedConversation(state),
        getDefaultConversation('abc123')
      );
    });
  });
});
