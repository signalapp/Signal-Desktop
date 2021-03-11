// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { times } from 'lodash';
import { set } from 'lodash/fp';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import {
  actions,
  OneTimeModalState,
  ComposerStep,
  ConversationMessageType,
  ConversationType,
  ConversationsStateType,
  MessageType,
  SwitchToAssociatedViewActionType,
  ToggleConversationInChooseMembersActionType,
  getConversationCallMode,
  getEmptyState,
  reducer,
  updateConversationLookups,
} from '../../../state/ducks/conversations';
import { CallMode } from '../../../types/Calling';
import * as groups from '../../../groups';

const {
  cantAddContactToGroup,
  clearGroupCreationError,
  clearInvitedConversationsForNewlyCreatedGroup,
  closeCantAddContactToGroupModal,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  createGroup,
  messageSizeChanged,
  openConversationInternal,
  repairNewestMessage,
  repairOldestMessage,
  setComposeGroupAvatar,
  setComposeGroupName,
  setComposeSearchTerm,
  setPreJoinConversation,
  showArchivedConversations,
  showInbox,
  startComposing,
  showChooseGroupMembers,
  startSettingGroupMetadata,
  toggleConversationInChooseMembers,
} = actions;

describe('both/state/ducks/conversations', () => {
  const getEmptyRootState = () => rootReducer(undefined, noopAction());

  let sinonSandbox: sinon.SinonSandbox;
  let createGroupStub: sinon.SinonStub;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();

    sinonSandbox.stub(window.Whisper.events, 'trigger');

    createGroupStub = sinonSandbox.stub(groups, 'createGroupV2');
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('helpers', () => {
    describe('getConversationCallMode', () => {
      const fakeConversation: ConversationType = {
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
      };

      it("returns CallMode.None if you've left the conversation", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            left: true,
          }),
          CallMode.None
        );
      });

      it("returns CallMode.None if you've blocked the other person", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isBlocked: true,
          }),
          CallMode.None
        );
      });

      it("returns CallMode.None if you haven't accepted message requests", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            acceptedMessageRequest: false,
          }),
          CallMode.None
        );
      });

      it('returns CallMode.None if the conversation is Note to Self', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isMe: true,
          }),
          CallMode.None
        );
      });

      it('returns CallMode.None for v1 groups', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
            groupVersion: 1,
          }),
          CallMode.None
        );

        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
          }),
          CallMode.None
        );
      });

      it('returns CallMode.Direct if the conversation is a normal direct conversation', () => {
        assert.strictEqual(
          getConversationCallMode(fakeConversation),
          CallMode.Direct
        );
      });

      it('returns CallMode.Group if the conversation is a v2 group', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            type: 'group',
            groupVersion: 2,
          }),
          CallMode.Group
        );
      });
    });

    describe('updateConversationLookups', () => {
      function getDefaultConversation(id: string): ConversationType {
        return {
          id,
          type: 'direct',
          title: `${id} title`,
        };
      }

      it('does not change lookups if no conversations provided', () => {
        const state = getEmptyState();
        const result = updateConversationLookups(undefined, undefined, state);

        assert.strictEqual(
          state.conversationsByE164,
          result.conversationsByE164
        );
        assert.strictEqual(
          state.conversationsByUuid,
          result.conversationsByUuid
        );
        assert.strictEqual(
          state.conversationsByGroupId,
          result.conversationsByGroupId
        );
      });

      it('adds and removes e164-only contact', () => {
        const removed = {
          ...getDefaultConversation('id-removed'),
          e164: 'e164-removed',
        };

        const state = {
          ...getEmptyState(),
          conversationsByE164: {
            [removed.e164]: removed,
          },
        };
        const added = {
          ...getDefaultConversation('id-added'),
          e164: 'e164-added',
        };

        const expected = {
          [added.e164]: added,
        };

        const actual = updateConversationLookups(added, removed, state);

        assert.deepEqual(actual.conversationsByE164, expected);
        assert.strictEqual(
          state.conversationsByUuid,
          actual.conversationsByUuid
        );
        assert.strictEqual(
          state.conversationsByGroupId,
          actual.conversationsByGroupId
        );
      });

      it('adds and removes uuid-only contact', () => {
        const removed = {
          ...getDefaultConversation('id-removed'),
          uuid: 'uuid-removed',
        };

        const state = {
          ...getEmptyState(),
          conversationsByuuid: {
            [removed.uuid]: removed,
          },
        };
        const added = {
          ...getDefaultConversation('id-added'),
          uuid: 'uuid-added',
        };

        const expected = {
          [added.uuid]: added,
        };

        const actual = updateConversationLookups(added, removed, state);

        assert.strictEqual(
          state.conversationsByE164,
          actual.conversationsByE164
        );
        assert.deepEqual(actual.conversationsByUuid, expected);
        assert.strictEqual(
          state.conversationsByGroupId,
          actual.conversationsByGroupId
        );
      });

      it('adds and removes groupId-only contact', () => {
        const removed = {
          ...getDefaultConversation('id-removed'),
          groupId: 'groupId-removed',
        };

        const state = {
          ...getEmptyState(),
          conversationsBygroupId: {
            [removed.groupId]: removed,
          },
        };
        const added = {
          ...getDefaultConversation('id-added'),
          groupId: 'groupId-added',
        };

        const expected = {
          [added.groupId]: added,
        };

        const actual = updateConversationLookups(added, removed, state);

        assert.strictEqual(
          state.conversationsByE164,
          actual.conversationsByE164
        );
        assert.strictEqual(
          state.conversationsByUuid,
          actual.conversationsByUuid
        );
        assert.deepEqual(actual.conversationsByGroupId, expected);
      });
    });
  });

  describe('reducer', () => {
    const time = Date.now();
    const conversationId = 'conversation-guid-1';
    const messageId = 'message-guid-1';
    const messageIdTwo = 'message-guid-2';
    const messageIdThree = 'message-guid-3';

    function getDefaultMessage(id: string): MessageType {
      return {
        id,
        conversationId: 'conversationId',
        source: 'source',
        sourceUuid: 'sourceUuid',
        type: 'incoming' as const,
        received_at: Date.now(),
        attachments: [],
        sticker: {},
        unread: false,
      };
    }

    function getDefaultConversationMessage(): ConversationMessageType {
      return {
        heightChangeMessageIds: [],
        isLoadingMessages: false,
        messageIds: [],
        metrics: {
          totalUnread: 0,
        },
        resetCounter: 0,
        scrollToMessageCounter: 0,
      };
    }

    describe('openConversationInternal', () => {
      it("returns a thunk that triggers a 'showConversation' event when passed a conversation ID", () => {
        const dispatch = sinon.spy();

        openConversationInternal({ conversationId: 'abc123' })(
          dispatch,
          getEmptyRootState,
          null
        );

        sinon.assert.calledOnce(
          window.Whisper.events.trigger as sinon.SinonSpy
        );
        sinon.assert.calledWith(
          window.Whisper.events.trigger as sinon.SinonSpy,
          'showConversation',
          'abc123',
          undefined
        );
      });

      it("returns a thunk that triggers a 'showConversation' event when passed a conversation ID and message ID", () => {
        const dispatch = sinon.spy();

        openConversationInternal({
          conversationId: 'abc123',
          messageId: 'xyz987',
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(
          window.Whisper.events.trigger as sinon.SinonSpy
        );
        sinon.assert.calledWith(
          window.Whisper.events.trigger as sinon.SinonSpy,
          'showConversation',
          'abc123',
          'xyz987'
        );
      });

      it("returns a thunk that doesn't dispatch any actions by default", () => {
        const dispatch = sinon.spy();

        openConversationInternal({ conversationId: 'abc123' })(
          dispatch,
          getEmptyRootState,
          null
        );

        sinon.assert.notCalled(dispatch);
      });

      it('dispatches a SWITCH_TO_ASSOCIATED_VIEW action if called with a flag', () => {
        const dispatch = sinon.spy();

        openConversationInternal({
          conversationId: 'abc123',
          switchToAssociatedView: true,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'SWITCH_TO_ASSOCIATED_VIEW',
          payload: { conversationId: 'abc123' },
        });
      });

      describe('SWITCH_TO_ASSOCIATED_VIEW', () => {
        let action: SwitchToAssociatedViewActionType;

        beforeEach(() => {
          const dispatch = sinon.spy();
          openConversationInternal({
            conversationId: 'fake-conversation-id',
            switchToAssociatedView: true,
          })(dispatch, getEmptyRootState, null);
          [action] = dispatch.getCall(0).args;
        });

        it('shows the inbox if the conversation is not archived', () => {
          const state = {
            ...getEmptyState(),
            conversationLookup: {
              'fake-conversation-id': {
                id: 'fake-conversation-id',
                type: 'direct' as const,
                title: 'Foo Bar',
              },
            },
          };
          const result = reducer(state, action);

          assert.isUndefined(result.composer);
          assert.isFalse(result.showArchived);
        });

        it('shows the archive if the conversation is archived', () => {
          const state = {
            ...getEmptyState(),
            conversationLookup: {
              'fake-conversation-id': {
                id: 'fake-conversation-id',
                type: 'group' as const,
                title: 'Baz Qux',
                isArchived: true,
              },
            },
          };
          const result = reducer(state, action);

          assert.isUndefined(result.composer);
          assert.isTrue(result.showArchived);
        });

        it('does nothing if the conversation is not found', () => {
          const state = getEmptyState();
          const result = reducer(state, action);

          assert.strictEqual(result, state);
        });
      });
    });

    describe('CANT_ADD_CONTACT_TO_GROUP', () => {
      it('marks the conversation ID as "cannot add"', () => {
        const state = {
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
        };
        const action = cantAddContactToGroup('abc123');
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.ChooseGroupMembers &&
            result.composer.cantAddContactIdForModal === 'abc123'
        );
      });
    });

    describe('CLEAR_GROUP_CREATION_ERROR', () => {
      it('clears the group creation error', () => {
        const state = {
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
        };
        const action = clearGroupCreationError();
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            result.composer.hasError === false
        );
      });
    });

    describe('CLEAR_INVITED_CONVERSATIONS_FOR_NEWLY_CREATED_GROUP', () => {
      it('clears the list of invited conversation IDs', () => {
        const state = {
          ...getEmptyState(),
          invitedConversationIdsForNewlyCreatedGroup: ['abc123', 'def456'],
        };
        const action = clearInvitedConversationsForNewlyCreatedGroup();
        const result = reducer(state, action);

        assert.isUndefined(result.invitedConversationIdsForNewlyCreatedGroup);
      });
    });

    describe('CLOSE_CANT_ADD_CONTACT_TO_GROUP_MODAL', () => {
      it('closes the "cannot add contact" modal"', () => {
        const state = {
          ...getEmptyState(),
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
        };
        const action = closeCantAddContactToGroupModal();
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.ChooseGroupMembers &&
            result.composer.cantAddContactIdForModal === undefined,
          'Expected the contact ID to be cleared'
        );
      });
    });

    describe('CLOSE_MAXIMUM_GROUP_SIZE_MODAL', () => {
      it('closes the maximum group size modal if it was open', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: 'abc123',
            contactSearchTerm: '',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.Showing,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        };
        const action = closeMaximumGroupSizeModal();
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.ChooseGroupMembers &&
            result.composer.maximumGroupSizeModalState ===
              OneTimeModalState.Shown,
          'Expected the modal to be closed'
        );
      });

      it('does nothing if the maximum group size modal was never shown', () => {
        const state = {
          ...getEmptyState(),
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
        };
        const action = closeMaximumGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('does nothing if the maximum group size modal already closed', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: 'abc123',
            contactSearchTerm: '',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.Shown,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        };
        const action = closeMaximumGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });
    });

    describe('CLOSE_RECOMMENDED_GROUP_SIZE_MODAL', () => {
      it('closes the recommended group size modal if it was open', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: 'abc123',
            contactSearchTerm: '',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            recommendedGroupSizeModalState: OneTimeModalState.Showing,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        };
        const action = closeRecommendedGroupSizeModal();
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.ChooseGroupMembers &&
            result.composer.recommendedGroupSizeModalState ===
              OneTimeModalState.Shown,
          'Expected the modal to be closed'
        );
      });

      it('does nothing if the recommended group size modal was never shown', () => {
        const state = {
          ...getEmptyState(),
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
        };
        const action = closeRecommendedGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('does nothing if the recommended group size modal already closed', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: 'abc123',
            contactSearchTerm: '',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        };
        const action = closeRecommendedGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });
    });

    describe('createGroup', () => {
      const conversationsState = {
        ...getEmptyState(),
        composer: {
          step: ComposerStep.SetGroupMetadata as const,
          selectedConversationIds: ['abc123'],
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([1, 2, 3]).buffer,
          isCreating: false as const,
          hasError: true as const,
        },
      };

      it('immediately dispatches a CREATE_GROUP_PENDING action, which puts the composer in a loading state', () => {
        const dispatch = sinon.spy();

        createGroup()(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, { type: 'CREATE_GROUP_PENDING' });

        const action = dispatch.getCall(0).args[0];

        const result = reducer(conversationsState, action);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            result.composer.isCreating &&
            !result.composer.hasError
        );
      });

      it('calls groups.createGroupV2', async () => {
        await createGroup()(
          sinon.spy(),
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        sinon.assert.calledOnce(createGroupStub);
        sinon.assert.calledWith(createGroupStub, {
          name: 'Foo Bar Group',
          avatar: new Uint8Array([1, 2, 3]).buffer,
          conversationIds: ['abc123'],
        });
      });

      it("trims the group's title before calling groups.createGroupV2", async () => {
        await createGroup()(
          sinon.spy(),
          () => ({
            ...getEmptyRootState(),
            conversations: {
              ...conversationsState,
              composer: {
                ...conversationsState.composer,
                groupName: '  To  Trim \t',
              },
            },
          }),
          null
        );

        sinon.assert.calledWith(
          createGroupStub,
          sinon.match({ name: 'To  Trim' })
        );
      });

      it('dispatches a CREATE_GROUP_REJECTED action if group creation fails, which marks the state with an error', async () => {
        createGroupStub.rejects(new Error('uh oh'));

        const dispatch = sinon.spy();

        const createGroupPromise = createGroup()(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        const pendingAction = dispatch.getCall(0).args[0];
        const stateAfterPending = reducer(conversationsState, pendingAction);

        await createGroupPromise;

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, { type: 'CREATE_GROUP_REJECTED' });

        const rejectedAction = dispatch.getCall(1).args[0];
        const result = reducer(stateAfterPending, rejectedAction);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            !result.composer.isCreating &&
            result.composer.hasError
        );
      });

      it("when rejecting, does nothing to the left pane if it's no longer in this composer state", async () => {
        createGroupStub.rejects(new Error('uh oh'));

        const dispatch = sinon.spy();

        const createGroupPromise = createGroup()(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        await createGroupPromise;

        const state = getEmptyState();
        const rejectedAction = dispatch.getCall(1).args[0];
        const result = reducer(state, rejectedAction);

        assert.strictEqual(result, state);
      });

      it('dispatches a CREATE_GROUP_FULFILLED event (which updates the newly-created conversation IDs), triggers a showConversation event and switches to the associated conversation on success', async () => {
        createGroupStub.resolves({
          id: '9876',
          get: (key: string) => {
            if (key !== 'pendingMembersV2') {
              throw new Error('This getter is not set up for this test');
            }
            return [{ conversationId: 'xyz999' }];
          },
        });

        const dispatch = sinon.spy();

        await createGroup()(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        sinon.assert.calledWith(
          window.Whisper.events.trigger as sinon.SinonSpy,
          'showConversation',
          '9876',
          undefined
        );

        sinon.assert.calledWith(dispatch, {
          type: 'CREATE_GROUP_FULFILLED',
          payload: { invitedConversationIds: ['xyz999'] },
        });

        const fulfilledAction = dispatch.getCall(1).args[0];
        const result = reducer(conversationsState, fulfilledAction);
        assert.deepEqual(result.invitedConversationIdsForNewlyCreatedGroup, [
          'xyz999',
        ]);

        sinon.assert.calledWith(dispatch, {
          type: 'SWITCH_TO_ASSOCIATED_VIEW',
          payload: { conversationId: '9876' },
        });
      });
    });

    describe('MESSAGE_SIZE_CHANGED', () => {
      const stateWithActiveConversation = {
        ...getEmptyState(),
        messagesByConversation: {
          [conversationId]: {
            heightChangeMessageIds: [],
            isLoadingMessages: false,
            isNearBottom: true,
            messageIds: [messageId],
            metrics: { totalUnread: 0 },
            resetCounter: 0,
            scrollToMessageCounter: 0,
          },
        },
        messagesLookup: {
          [messageId]: getDefaultMessage(messageId),
        },
      };

      it('does nothing if no conversation is active', () => {
        const state = getEmptyState();

        assert.strictEqual(
          reducer(state, messageSizeChanged('messageId', 'convoId')),
          state
        );
      });

      it('does nothing if a different conversation is active', () => {
        assert.deepEqual(
          reducer(
            stateWithActiveConversation,
            messageSizeChanged(messageId, 'another-conversation-guid')
          ),
          stateWithActiveConversation
        );
      });

      it('adds the message ID to the list of messages with changed heights', () => {
        const result = reducer(
          stateWithActiveConversation,
          messageSizeChanged(messageId, conversationId)
        );

        assert.sameMembers(
          result.messagesByConversation[conversationId]
            ?.heightChangeMessageIds || [],
          [messageId]
        );
      });

      it("doesn't add duplicates to the list of changed-heights messages", () => {
        const state = set(
          ['messagesByConversation', conversationId, 'heightChangeMessageIds'],
          [messageId],
          stateWithActiveConversation
        );
        const result = reducer(
          state,
          messageSizeChanged(messageId, conversationId)
        );

        assert.sameMembers(
          result.messagesByConversation[conversationId]
            ?.heightChangeMessageIds || [],
          [messageId]
        );
      });
    });

    describe('REPAIR_NEWEST_MESSAGE', () => {
      it('updates newest', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnread: 0,
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnread: 0,
                newest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('clears newest', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                totalUnread: 0,
                newest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                newest: undefined,
                totalUnread: 0,
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('returns state if conversation not present', () => {
        const action = repairNewestMessage(conversationId);
        const state: ConversationsStateType = getEmptyState();
        const actual = reducer(state, action);

        assert.equal(actual, state);
      });
    });

    describe('REPAIR_OLDEST_MESSAGE', () => {
      it('updates oldest', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnread: 0,
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnread: 0,
                oldest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('clears oldest', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                totalUnread: 0,
                oldest: {
                  id: messageId,
                  received_at: time,
                },
              },
            },
          },
        };

        const expected: ConversationsStateType = {
          ...getEmptyState(),
          messagesLookup: {
            [messageId]: {
              ...getDefaultMessage(messageId),
              received_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [],
              metrics: {
                oldest: undefined,
                totalUnread: 0,
              },
            },
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual, expected);
      });

      it('returns state if conversation not present', () => {
        const action = repairOldestMessage(conversationId);
        const state: ConversationsStateType = getEmptyState();
        const actual = reducer(state, action);

        assert.equal(actual, state);
      });
    });

    describe('SET_COMPOSE_GROUP_AVATAR', () => {
      it("can clear the composer's group avatar", () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: [],
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'foo',
            groupAvatar: new ArrayBuffer(2),
            isCreating: false as const,
            hasError: false as const,
          },
        };
        const action = setComposeGroupAvatar(undefined);
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            result.composer.groupAvatar === undefined
        );
      });

      it("can set the composer's group avatar", () => {
        const avatar = new Uint8Array([1, 2, 3]).buffer;

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: [],
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'foo',
            groupAvatar: undefined,
            isCreating: false as const,
            hasError: false as const,
          },
        };
        const action = setComposeGroupAvatar(avatar);
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            result.composer.groupAvatar === avatar
        );
      });
    });

    describe('SET_COMPOSE_GROUP_NAME', () => {
      it("can set the composer's group name", () => {
        const state = {
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
        };
        const action = setComposeGroupName('bing bong');
        const result = reducer(state, action);

        assert(
          result.composer?.step === ComposerStep.SetGroupMetadata &&
            result.composer.groupName === 'bing bong'
        );
      });
    });

    describe('SET_COMPOSE_SEARCH_TERM', () => {
      it('updates the contact search term', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            contactSearchTerm: '',
          },
        };
        const action = setComposeSearchTerm('foo bar');
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: 'foo bar',
        });
      });
    });

    describe('SET_PRE_JOIN_CONVERSATION', () => {
      const startState = {
        ...getEmptyState(),
      };

      it('starts with empty value', () => {
        assert.isUndefined(startState.preJoinConversation);
      });

      it('sets value as provided', () => {
        const preJoinConversation = {
          title: 'Pre-join group!',
          memberCount: 4,
          approvalRequired: false,
        };
        const stateWithData = reducer(
          startState,
          setPreJoinConversation(preJoinConversation)
        );

        assert.deepEqual(
          stateWithData.preJoinConversation,
          preJoinConversation
        );

        const resetState = reducer(
          stateWithData,
          setPreJoinConversation(undefined)
        );

        assert.isUndefined(resetState.preJoinConversation);
      });
    });

    describe('SHOW_ARCHIVED_CONVERSATIONS', () => {
      it('is a no-op when already at the archive', () => {
        const state = {
          ...getEmptyState(),
          showArchived: true,
        };
        const action = showArchivedConversations();
        const result = reducer(state, action);

        assert.isTrue(result.showArchived);
        assert.isUndefined(result.composer);
      });

      it('switches from the inbox to the archive', () => {
        const state = getEmptyState();
        const action = showArchivedConversations();
        const result = reducer(state, action);

        assert.isTrue(result.showArchived);
        assert.isUndefined(result.composer);
      });

      it('switches from the composer to the archive', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            contactSearchTerm: '',
          },
        };
        const action = showArchivedConversations();
        const result = reducer(state, action);

        assert.isTrue(result.showArchived);
        assert.isUndefined(result.composer);
      });
    });

    describe('SHOW_INBOX', () => {
      it('is a no-op when already at the inbox', () => {
        const state = getEmptyState();
        const action = showInbox();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.isUndefined(result.composer);
      });

      it('switches from the archive to the inbox', () => {
        const state = {
          ...getEmptyState(),
          showArchived: true,
        };
        const action = showInbox();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.isUndefined(result.composer);
      });

      it('switches from the composer to the inbox', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            contactSearchTerm: '',
          },
        };
        const action = showInbox();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.isUndefined(result.composer);
      });
    });

    describe('START_COMPOSING', () => {
      it('does nothing if on the first step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            contactSearchTerm: 'foo bar',
          },
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: 'foo bar',
        });
      });

      it('if on the second step of the composer, goes back to the first step, clearing the search term', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            cantAddContactIdForModal: undefined,
            contactSearchTerm: 'to be cleared',
            groupAvatar: undefined,
            groupName: '',
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            selectedConversationIds: [],
            step: ComposerStep.ChooseGroupMembers as const,
          },
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: '',
        });
      });

      it('if on the third step of the composer, goes back to the first step, clearing everything', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: [],
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
            isCreating: false,
            hasError: false as const,
          },
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: '',
        });
      });

      it('switches from the inbox to the composer', () => {
        const state = getEmptyState();
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: '',
        });
      });

      it('switches from the archive to the inbox', () => {
        const state = {
          ...getEmptyState(),
          showArchived: true,
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.StartDirectConversation,
          contactSearchTerm: '',
        });
      });
    });

    describe('SHOW_CHOOSE_GROUP_MEMBERS', () => {
      it('switches to the second step of the composer if on the first step', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.StartDirectConversation as const,
            contactSearchTerm: 'to be cleared',
          },
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('does nothing if already on the second step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: 'foo bar',
            selectedConversationIds: [],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('returns to the second step if on the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: [],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'Foo Bar Group',
            groupAvatar: new Uint8Array([4, 2]).buffer,
            isCreating: false,
            hasError: false as const,
          },
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([4, 2]).buffer,
        });
      });

      it('switches from the inbox to the second step of the composer', () => {
        const state = getEmptyState();
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('switches from the archive to the second step of the composer', () => {
        const state = {
          ...getEmptyState(),
          showArchived: true,
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });
    });

    describe('START_SETTING_GROUP_METADATA', () => {
      it('moves from the second to the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: 'foo bar',
            selectedConversationIds: ['abc', 'def'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = startSettingGroupMetadata();
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.SetGroupMetadata,
          selectedConversationIds: ['abc', 'def'],
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
          isCreating: false,
          hasError: false,
        });
      });

      it('maintains state when going from the second to third steps of the composer, if the second step already had some data (likely from a previous visit)', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: 'foo bar',
            selectedConversationIds: ['abc', 'def'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'Foo Bar Group',
            groupAvatar: new Uint8Array([6, 9]).buffer,
          },
        };
        const action = startSettingGroupMetadata();
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.SetGroupMetadata,
          selectedConversationIds: ['abc', 'def'],
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([6, 9]).buffer,
          isCreating: false,
          hasError: false as const,
        });
      });

      it('does nothing if already on the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.SetGroupMetadata as const,
            selectedConversationIds: [],
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: 'Foo Bar Group',
            groupAvatar: new Uint8Array([4, 2]).buffer,
            isCreating: false,
            hasError: false as const,
          },
        };
        const action = startSettingGroupMetadata();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });
    });

    describe('TOGGLE_CONVERSATION_IN_CHOOSE_MEMBERS', () => {
      function getAction(
        id: string,
        conversationsState: ConversationsStateType
      ): ToggleConversationInChooseMembersActionType {
        const dispatch = sinon.spy();

        toggleConversationInChooseMembers(id)(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        return dispatch.getCall(0).args[0];
      }

      let remoteConfigGetValueStub: sinon.SinonStub;

      beforeEach(() => {
        remoteConfigGetValueStub = sinonSandbox
          .stub(window.Signal.RemoteConfig, 'getValue')
          .withArgs('global.groupsv2.maxGroupSize')
          .returns('22')
          .withArgs('global.groupsv2.groupSizeHardLimit')
          .returns('33');
      });

      it('adds conversation IDs to the list', () => {
        const zero = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: [],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const one = reducer(zero, getAction('abc', zero));
        const two = reducer(one, getAction('def', one));

        assert.deepEqual(two.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: ['abc', 'def'],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('removes conversation IDs from the list', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: ['abc', 'def'],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction('abc', state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: ['def'],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('shows the recommended group size modal when first crossing the maximum recommended group size', () => {
        const oldSelectedConversationIds = times(21, () => uuid());
        const newUuid = uuid();

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: oldSelectedConversationIds,
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.Showing,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it("doesn't show the recommended group size modal twice", () => {
        const oldSelectedConversationIds = times(21, () => uuid());
        const newUuid = uuid();

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: oldSelectedConversationIds,
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
          maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('defaults the maximum recommended size to 151', () => {
        [undefined, 'xyz'].forEach(value => {
          remoteConfigGetValueStub
            .withArgs('global.groupsv2.maxGroupSize')
            .returns(value);

          const state = {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.ChooseGroupMembers as const,
              contactSearchTerm: '',
              selectedConversationIds: [],
              cantAddContactIdForModal: undefined,
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
            },
          };
          const action = getAction(uuid(), state);

          assert.strictEqual(action.payload.maxRecommendedGroupSize, 151);
        });
      });

      it('shows the maximum group size modal when first reaching the maximum group size', () => {
        const oldSelectedConversationIds = times(31, () => uuid());
        const newUuid = uuid();

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: oldSelectedConversationIds,
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
          maximumGroupSizeModalState: OneTimeModalState.Showing,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it("doesn't show the maximum group size modal twice", () => {
        const oldSelectedConversationIds = times(31, () => uuid());
        const newUuid = uuid();

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: oldSelectedConversationIds,
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            maximumGroupSizeModalState: OneTimeModalState.Shown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          step: ComposerStep.ChooseGroupMembers,
          contactSearchTerm: '',
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          cantAddContactIdForModal: undefined,
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
          maximumGroupSizeModalState: OneTimeModalState.Shown,
          groupName: '',
          groupAvatar: undefined,
        });
      });

      it('cannot select more than the maximum number of conversations', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: times(1000, () => uuid()),
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(uuid(), state);
        const result = reducer(state, action);

        assert.deepEqual(result, state);
      });

      it('defaults the maximum group size to 1001 if the recommended maximum is smaller', () => {
        [undefined, 'xyz'].forEach(value => {
          remoteConfigGetValueStub
            .withArgs('global.groupsv2.maxGroupSize')
            .returns('2')
            .withArgs('global.groupsv2.groupSizeHardLimit')
            .returns(value);

          const state = {
            ...getEmptyState(),
            composer: {
              step: ComposerStep.ChooseGroupMembers as const,
              contactSearchTerm: '',
              selectedConversationIds: [],
              cantAddContactIdForModal: undefined,
              recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
              maximumGroupSizeModalState: OneTimeModalState.NeverShown,
              groupName: '',
              groupAvatar: undefined,
            },
          };
          const action = getAction(uuid(), state);

          assert.strictEqual(action.payload.maxGroupSize, 1001);
        });
      });

      it('defaults the maximum group size to (recommended maximum + 1) if the recommended maximum is more than 1001', () => {
        remoteConfigGetValueStub
          .withArgs('global.groupsv2.maxGroupSize')
          .returns('1234')
          .withArgs('global.groupsv2.groupSizeHardLimit')
          .returns('2');

        const state = {
          ...getEmptyState(),
          composer: {
            step: ComposerStep.ChooseGroupMembers as const,
            contactSearchTerm: '',
            selectedConversationIds: [],
            cantAddContactIdForModal: undefined,
            recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
            groupName: '',
            groupAvatar: undefined,
          },
        };
        const action = getAction(uuid(), state);

        assert.strictEqual(action.payload.maxGroupSize, 1235);
      });
    });
  });
});
