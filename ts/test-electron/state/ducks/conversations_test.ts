// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as generateUuid } from 'uuid';
import { times } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import {
  ComposerStep,
  ConversationVerificationState,
  OneTimeModalState,
} from '../../../state/ducks/conversationsEnums';
import type {
  CancelVerificationDataByConversationActionType,
  ConversationMessageType,
  ConversationType,
  ConversationsStateType,
  MessageType,
  TargetedConversationChangedActionType,
  ToggleConversationInChooseMembersActionType,
  MessageChangedActionType,
  ConversationsUpdatedActionType,
} from '../../../state/ducks/conversations';
import {
  TARGETED_CONVERSATION_CHANGED,
  actions,
  cancelConversationVerification,
  clearCancelledConversationVerification,
  getConversationCallMode,
  getEmptyState,
  reducer,
  updateConversationLookups,
} from '../../../state/ducks/conversations';
import { ReadStatus } from '../../../messages/MessageReadStatus';
import type { SingleServePromiseIdString } from '../../../services/singleServePromise';
import { CallMode } from '../../../types/CallDisposition';
import {
  type AciString,
  type PniString,
  generateAci,
  getAciFromPrefix,
} from '../../../types/ServiceId';
import { generateStoryDistributionId } from '../../../types/StoryDistributionId';
import {
  getDefaultConversation,
  getDefaultConversationWithServiceId,
  getDefaultGroup,
} from '../../../test-both/helpers/getDefaultConversation';
import { getDefaultAvatars } from '../../../types/Avatar';
import {
  defaultStartDirectConversationComposerState,
  defaultChooseGroupMembersComposerState,
  defaultSetGroupMetadataComposerState,
} from '../../../test-both/helpers/defaultComposerStates';
import { updateRemoteConfig } from '../../../test-both/helpers/RemoteConfigStub';
import type { ShowSendAnywayDialogActionType } from '../../../state/ducks/globalModals';
import { SHOW_SEND_ANYWAY_DIALOG } from '../../../state/ducks/globalModals';
import type { StoryDistributionListsActionType } from '../../../state/ducks/storyDistributionLists';
import {
  DELETE_LIST,
  HIDE_MY_STORIES_FROM,
  MODIFY_LIST,
  VIEWERS_CHANGED,
} from '../../../state/ducks/storyDistributionLists';
import { MY_STORY_ID } from '../../../types/Stories';
import type { ReadonlyMessageAttributesType } from '../../../model-types.d';
import { strictAssert } from '../../../util/assert';

const {
  clearGroupCreationError,
  clearInvitedServiceIdsForNewlyCreatedGroup,
  closeContactSpoofingReview,
  closeMaximumGroupSizeModal,
  closeRecommendedGroupSizeModal,
  conversationStoppedByMissingVerification,
  createGroup,
  discardMessages,
  repairNewestMessage,
  repairOldestMessage,
  resetAllChatColors,
  reviewConversationNameCollision,
  setComposeGroupAvatar,
  setComposeGroupName,
  setComposeSearchTerm,
  setPreJoinConversation,
  showArchivedConversations,
  showChooseGroupMembers,
  showConversation,
  showInbox,
  startComposing,
  startSettingGroupMetadata,
  toggleConversationInChooseMembers,
} = actions;

// can't use messageChanged action creator because it's a ThunkAction
function messageChanged(
  messageId: string,
  conversationId: string,
  data: ReadonlyMessageAttributesType
): ReadonlyDeep<MessageChangedActionType> {
  return {
    type: 'MESSAGE_CHANGED',
    payload: {
      id: messageId,
      conversationId,
      data,
    },
  };
}

describe('both/state/ducks/conversations', () => {
  const LIST_ID_1 = generateStoryDistributionId();
  const LIST_ID_2 = generateStoryDistributionId();
  const SERVICE_ID_1 = generateAci();
  const SERVICE_ID_2 = generateAci();
  const SERVICE_ID_3 = generateAci();
  const SERVICE_ID_4 = generateAci();

  const getEmptyRootState = () => rootReducer(undefined, noopAction());

  let sinonSandbox: sinon.SinonSandbox;
  let createGroupStub: sinon.SinonStub;

  beforeEach(async () => {
    await window.ConversationController.load();

    sinonSandbox = sinon.createSandbox();

    sinonSandbox.stub(window.Whisper.events, 'trigger');

    createGroupStub = sinon.stub();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('helpers', () => {
    describe('getConversationCallMode', () => {
      const fakeConversation: ConversationType = getDefaultConversation();
      const fakeGroup: ConversationType = getDefaultGroup();

      it("returns null if you've left the conversation", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            left: true,
          }),
          null
        );
      });

      it("returns null if you've blocked the other person", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isBlocked: true,
          }),
          null
        );
      });

      it("returns null if you haven't accepted message requests", () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            acceptedMessageRequest: false,
          }),
          null
        );
      });

      it('returns null if the conversation is Note to Self', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeConversation,
            isMe: true,
          }),
          null
        );
      });

      it('returns null for v1 groups', () => {
        assert.strictEqual(
          getConversationCallMode({
            ...fakeGroup,
            groupVersion: 1,
          }),
          null
        );

        assert.strictEqual(
          getConversationCallMode({
            ...fakeGroup,
            groupVersion: undefined,
          }),
          null
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
            ...fakeGroup,
            groupVersion: 2,
          }),
          CallMode.Group
        );
      });
    });

    describe('updateConversationLookups', () => {
      it('does not change lookups if no conversations provided', () => {
        const state = getEmptyState();
        const result = updateConversationLookups(undefined, undefined, state);

        assert.strictEqual(
          state.conversationsByE164,
          result.conversationsByE164
        );
        assert.strictEqual(
          state.conversationsByServiceId,
          result.conversationsByServiceId
        );
        assert.strictEqual(
          state.conversationsByGroupId,
          result.conversationsByGroupId
        );
      });

      it('adds and removes e164-only contact', () => {
        const removed = getDefaultConversation({
          id: 'id-removed',
          e164: 'e164-removed',
          serviceId: undefined,
        });

        const state = {
          ...getEmptyState(),
          conversationsByE164: {
            'e164-removed': removed,
          },
        };
        const added = getDefaultConversation({
          id: 'id-added',
          e164: 'e164-added',
          serviceId: undefined,
        });

        const expected = {
          'e164-added': added,
        };

        const actual = updateConversationLookups([added], [removed], state);

        assert.deepEqual(actual.conversationsByE164, expected);
        assert.strictEqual(
          state.conversationsByServiceId,
          actual.conversationsByServiceId
        );
        assert.strictEqual(
          state.conversationsByGroupId,
          actual.conversationsByGroupId
        );
      });

      it('adds and removes uuid-only contact', () => {
        const removed = getDefaultConversationWithServiceId({
          id: 'id-removed',
          e164: undefined,
        });

        const state = {
          ...getEmptyState(),
          conversationsByServiceId: {
            [removed.serviceId]: removed,
          },
        };
        const added = getDefaultConversationWithServiceId({
          id: 'id-added',
          e164: undefined,
        });

        const expected = {
          [added.serviceId]: added,
        };

        const actual = updateConversationLookups([added], [removed], state);

        assert.strictEqual(
          state.conversationsByE164,
          actual.conversationsByE164
        );
        assert.deepEqual(actual.conversationsByServiceId, expected);
        assert.strictEqual(
          state.conversationsByGroupId,
          actual.conversationsByGroupId
        );
      });

      it('adds and removes groupId-only contact', () => {
        const removed = getDefaultConversation({
          id: 'id-removed',
          groupId: 'groupId-removed',
          e164: undefined,
          serviceId: undefined,
        });

        const state: ConversationsStateType = {
          ...getEmptyState(),
          conversationsByGroupId: {
            'groupId-removed': removed,
          },
        };
        const added = getDefaultConversation({
          id: 'id-added',
          groupId: 'groupId-added',
          e164: undefined,
          serviceId: undefined,
        });

        const expected = {
          'groupId-added': added,
        };

        const actual = updateConversationLookups([added], [removed], state);

        assert.strictEqual(
          state.conversationsByE164,
          actual.conversationsByE164
        );
        assert.strictEqual(
          state.conversationsByServiceId,
          actual.conversationsByServiceId
        );
        assert.deepEqual(actual.conversationsByGroupId, expected);
      });
      it('adds and removes multiple conversations', () => {
        const removed = getDefaultConversation({
          id: 'id-removed',
          groupId: 'groupId-removed',
          e164: 'e164-removed',
          serviceId: 'serviceId-removed' as unknown as AciString,
          pni: 'pni-removed' as unknown as PniString,
          username: 'username-removed',
        });
        const stable = getDefaultConversation({
          id: 'id-stable',
          groupId: 'groupId-stable',
          e164: 'e164-stable',
          serviceId: 'serviceId-stable' as unknown as AciString,
          pni: 'pni-stable' as unknown as PniString,
          username: 'username-stable',
        });

        const state: ConversationsStateType = {
          ...getEmptyState(),
          conversationsByServiceId: {
            'serviceId-removed': removed,
            'serviceId-stable': stable,
            'pni-removed': removed,
            'pni-stable': stable,
          },
          conversationsByE164: {
            'e164-removed': removed,
            'e164-stable': stable,
          },
          conversationsByGroupId: {
            'groupId-removed': removed,
            'groupId-stable': stable,
          },
          conversationsByUsername: {
            'username-removed': removed,
            'username-stable': stable,
          },
        };

        const added1 = getDefaultConversation({
          id: 'id-added1',
          groupId: 'groupId-added1',
          e164: 'e164-added1',
          serviceId: 'serviceId-added1' as unknown as AciString,
          pni: 'pni-added1' as unknown as PniString,
          username: 'username-added1',
        });
        const added2 = getDefaultConversation({
          id: 'id-added2',
          groupId: 'groupId-added2',
          e164: undefined,
          serviceId: undefined,
          pni: undefined,
          username: undefined,
        });

        const actual = {
          ...state,
          ...updateConversationLookups([added1, added2], [removed], state),
        };

        const expected = {
          ...getEmptyState(),
          conversationsByServiceId: {
            'serviceId-added1': added1,
            'pni-added1': added1,
            'serviceId-stable': stable,
            'pni-stable': stable,
          },
          conversationsByE164: {
            'e164-added1': added1,
            'e164-stable': stable,
          },
          conversationsByGroupId: {
            'groupId-added1': added1,
            'groupId-stable': stable,
            'groupId-added2': added2,
          },
          conversationsByUsername: {
            'username-added1': added1,
            'username-stable': stable,
          },
        };

        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('reducer', () => {
    const time = Date.now();
    const previousTime = time - 1;
    const conversationId = 'conversation-guid-1';
    const messageId = 'message-guid-1';
    const messageIdTwo = 'message-guid-2';
    const messageIdThree = 'message-guid-3';
    const sourceServiceId = generateAci();

    function getDefaultMessage(id: string): MessageType {
      return {
        attachments: [],
        conversationId,
        id,
        received_at: previousTime,
        sent_at: previousTime,
        source: 'source',
        sourceServiceId,
        timestamp: previousTime,
        type: 'incoming' as const,
        readStatus: ReadStatus.Read,
      };
    }

    function getDefaultConversationMessage(): ConversationMessageType {
      return {
        messageChangeCounter: 0,
        messageIds: [],
        metrics: {
          totalUnseen: 0,
        },
        scrollToMessageCounter: 0,
      };
    }

    describe('showConversation', () => {
      it('does not select a conversation if it does not exist', () => {
        const state = {
          ...getEmptyState(),
        };
        const dispatch = sinon.spy();
        showConversation({ conversationId: 'abc123' })(
          dispatch,
          getEmptyRootState,
          null
        );
        const action = dispatch.getCall(0).args[0];
        const nextState = reducer(state, action);

        assert.isUndefined(nextState.selectedConversationId);
        assert.isUndefined(nextState.targetedMessage);
      });

      it('selects a conversation id', () => {
        const conversation = getDefaultConversation({
          id: 'abc123',
        });
        const state = {
          ...getEmptyState(),
          conversationLookup: {
            [conversation.id]: conversation,
          },
        };
        const dispatch = sinon.spy();
        showConversation({ conversationId: 'abc123' })(
          dispatch,
          getEmptyRootState,
          null
        );
        const action = dispatch.getCall(0).args[0];
        const nextState = reducer(state, action);

        assert.equal(nextState.selectedConversationId, 'abc123');
        assert.isUndefined(nextState.targetedMessage);
      });

      it('selects a conversation and a message', () => {
        const conversation = getDefaultConversation({
          id: 'abc123',
        });
        const state = {
          ...getEmptyState(),
          conversationLookup: {
            [conversation.id]: conversation,
          },
        };

        const dispatch = sinon.spy();
        showConversation({
          conversationId: 'abc123',
          messageId: 'xyz987',
        })(dispatch, getEmptyRootState, null);
        const action = dispatch.getCall(0).args[0];
        const nextState = reducer(state, action);

        assert.equal(nextState.selectedConversationId, 'abc123');
        assert.equal(nextState.targetedMessage, 'xyz987');
      });

      describe('showConversation switchToAssociatedView=true', () => {
        let action: TargetedConversationChangedActionType;

        beforeEach(() => {
          const dispatch = sinon.spy();
          showConversation({
            conversationId: 'fake-conversation-id',
            switchToAssociatedView: true,
          })(dispatch, getEmptyRootState, null);
          [action] = dispatch.getCall(0).args;
        });

        it('shows the inbox if the conversation is not archived', () => {
          const conversation = getDefaultConversation({
            id: 'fake-conversation-id',
          });
          const state = {
            ...getEmptyState(),
            conversationLookup: {
              [conversation.id]: conversation,
            },
          };
          const result = reducer(state, action);

          assert.isUndefined(result.composer);
          assert.isFalse(result.showArchived);
        });

        it('shows the archive if the conversation is archived', () => {
          const conversation = getDefaultConversation({
            id: 'fake-conversation-id',
            isArchived: true,
          });
          const state = {
            ...getEmptyState(),
            conversationLookup: {
              [conversation.id]: conversation,
            },
          };
          const result = reducer(state, action);

          assert.isUndefined(result.composer);
          assert.isTrue(result.showArchived);
        });
      });
    });

    describe('CLEAR_GROUP_CREATION_ERROR', () => {
      it('clears the group creation error', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultSetGroupMetadataComposerState,
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

    describe('CLEAR_INVITED_UUIDS_FOR_NEWLY_CREATED_GROUP', () => {
      it('clears the list of invited conversation UUIDs', () => {
        const state = {
          ...getEmptyState(),
          invitedServiceIdsForNewlyCreatedGroup: [generateAci(), generateAci()],
        };
        const action = clearInvitedServiceIdsForNewlyCreatedGroup();
        const result = reducer(state, action);

        assert.isUndefined(result.invitedServiceIdsForNewlyCreatedGroup);
      });
    });

    describe('CLOSE_CONTACT_SPOOFING_REVIEW', () => {
      it('closes the contact spoofing review modal if it was open', () => {
        const state = {
          ...getEmptyState(),
          hasContactSpoofingReview: true,
        };
        const action = closeContactSpoofingReview();
        const actual = reducer(state, action);

        assert.isFalse(actual.hasContactSpoofingReview);
      });

      it("does nothing if the modal wasn't already open", () => {
        const state = getEmptyState();
        const action = closeContactSpoofingReview();
        const actual = reducer(state, action);

        assert.deepEqual(actual, state);
      });
    });

    describe('CLOSE_MAXIMUM_GROUP_SIZE_MODAL', () => {
      it('closes the maximum group size modal if it was open', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            maximumGroupSizeModalState: OneTimeModalState.Showing,
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
          composer: defaultChooseGroupMembersComposerState,
        };
        const action = closeMaximumGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('does nothing if the maximum group size modal already closed', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            maximumGroupSizeModalState: OneTimeModalState.Shown,
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
            ...defaultChooseGroupMembersComposerState,
            recommendedGroupSizeModalState: OneTimeModalState.Showing,
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
          composer: defaultChooseGroupMembersComposerState,
        };
        const action = closeRecommendedGroupSizeModal();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('does nothing if the recommended group size modal already closed', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
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
          ...defaultSetGroupMetadataComposerState,
          selectedConversationIds: ['abc123'],
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([1, 2, 3]),
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
        await createGroup(createGroupStub)(
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
          avatar: new Uint8Array([1, 2, 3]),
          avatars: [],
          expireTimer: 0,
          conversationIds: ['abc123'],
        });
      });

      it("trims the group's title before calling groups.createGroupV2", async () => {
        await createGroup(createGroupStub)(
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

        const createGroupPromise = createGroup(createGroupStub)(
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

        const createGroupPromise = createGroup(createGroupStub)(
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
        const abc = getAciFromPrefix('abc');
        createGroupStub.resolves({
          id: '9876',
          get: (key: string) => {
            if (key !== 'pendingMembersV2') {
              throw new Error('This getter is not set up for this test');
            }
            return [{ serviceId: abc }];
          },
        });

        const dispatch = sinon.spy();

        await createGroup(createGroupStub)(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        sinon.assert.calledWith(dispatch, {
          type: 'CREATE_GROUP_FULFILLED',
          payload: { invitedServiceIds: [abc] },
        });

        sinon.assert.calledWith(dispatch, {
          type: TARGETED_CONVERSATION_CHANGED,
          payload: {
            conversationId: '9876',
            messageId: undefined,
            switchToAssociatedView: true,
          },
        });

        const fulfilledAction = dispatch.getCall(1).args[0];
        const result = reducer(conversationsState, fulfilledAction);
        assert.deepEqual(result.invitedServiceIdsForNewlyCreatedGroup, [abc]);
      });
    });

    describe('CONVERSATION_STOPPED_BY_MISSING_VERIFICATION', () => {
      it('adds to state, removing duplicates', () => {
        const first = reducer(
          getEmptyState(),
          conversationStoppedByMissingVerification({
            conversationId: 'convo A',
            untrustedServiceIds: [SERVICE_ID_1],
          })
        );
        const second = reducer(
          first,
          conversationStoppedByMissingVerification({
            conversationId: 'convo A',
            untrustedServiceIds: [SERVICE_ID_2],
          })
        );
        const third = reducer(
          second,
          conversationStoppedByMissingVerification({
            conversationId: 'convo A',
            untrustedServiceIds: [SERVICE_ID_1, SERVICE_ID_3],
          })
        );

        assert.deepStrictEqual(third.verificationDataByConversation, {
          'convo A': {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [
              SERVICE_ID_1,
              SERVICE_ID_2,
              SERVICE_ID_3,
            ],
          },
        });
      });

      it('stomps on VerificationCancelled state', () => {
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.VerificationCancelled,
              canceledAt: Date.now(),
            },
          },
        };
        const actual = reducer(
          state,
          conversationStoppedByMissingVerification({
            conversationId: 'convo A',
            untrustedServiceIds: [SERVICE_ID_1, SERVICE_ID_2],
          })
        );

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          'convo A': {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
          },
        });
      });
    });
    describe('SHOW_SEND_ANYWAY_DIALOG', () => {
      it('adds nothing to existing empty state', () => {
        const state = getEmptyState();
        const action: ShowSendAnywayDialogActionType = {
          type: SHOW_SEND_ANYWAY_DIALOG,
          payload: {
            untrustedByConversation: {},
            promiseUuid: generateUuid() as SingleServePromiseIdString,
            source: undefined,
          },
        };
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {});
      });

      it('adds multiple conversations and distribution lists to empty list', () => {
        const state = getEmptyState();
        const action: ShowSendAnywayDialogActionType = {
          type: SHOW_SEND_ANYWAY_DIALOG,
          payload: {
            untrustedByConversation: {
              [LIST_ID_1]: {
                serviceIds: [SERVICE_ID_1, SERVICE_ID_2],
                byDistributionId: {
                  [LIST_ID_1]: {
                    serviceIds: [SERVICE_ID_1, SERVICE_ID_3],
                  },
                  [LIST_ID_2]: {
                    serviceIds: [SERVICE_ID_2, SERVICE_ID_4],
                  },
                },
              },
            },
            promiseUuid: generateUuid() as SingleServePromiseIdString,
            source: undefined,
          },
        };
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          [LIST_ID_1]: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_3],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_2, SERVICE_ID_4],
              },
            },
          },
        });
      });

      it('adds and de-dupes in multiple conversations and distribution lists', () => {
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            [LIST_ID_1]: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1],
              byDistributionId: {
                [LIST_ID_1]: {
                  serviceIdsNeedingVerification: [SERVICE_ID_1],
                },
              },
            },
          },
        };
        const action: ShowSendAnywayDialogActionType = {
          type: SHOW_SEND_ANYWAY_DIALOG,
          payload: {
            untrustedByConversation: {
              [LIST_ID_1]: {
                serviceIds: [SERVICE_ID_1, SERVICE_ID_2],
                byDistributionId: {
                  [LIST_ID_1]: {
                    serviceIds: [SERVICE_ID_1, SERVICE_ID_3],
                  },
                  [LIST_ID_2]: {
                    serviceIds: [SERVICE_ID_2, SERVICE_ID_4],
                  },
                },
              },
            },
            promiseUuid: generateUuid() as SingleServePromiseIdString,
            source: undefined,
          },
        };
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          [LIST_ID_1]: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_3],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_2, SERVICE_ID_4],
              },
            },
          },
        });
      });
    });

    describe('CANCEL_CONVERSATION_PENDING_VERIFICATION', () => {
      function getAction(
        timestamp: number,
        conversationsState: ConversationsStateType
      ): CancelVerificationDataByConversationActionType {
        const dispatch = sinon.spy();

        cancelConversationVerification(timestamp)(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            conversations: conversationsState,
          }),
          null
        );

        return dispatch.getCall(0).args[0];
      }

      it('replaces existing PendingVerification state', () => {
        const now = Date.now();
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            },
          },
        };
        const action = getAction(now, state);
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          'convo A': {
            type: ConversationVerificationState.VerificationCancelled,
            canceledAt: now,
          },
        });
      });

      it('updates timestamp for existing VerificationCancelled state', () => {
        const now = Date.now();
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.VerificationCancelled,
              canceledAt: now - 1,
            },
          },
        };
        const action = getAction(now, state);
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          'convo A': {
            type: ConversationVerificationState.VerificationCancelled,
            canceledAt: now,
          },
        });
      });

      it('uses newest timestamp when updating existing VerificationCancelled state', () => {
        const now = Date.now();
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.VerificationCancelled,
              canceledAt: now,
            },
          },
        };
        const action = getAction(now, state);
        const actual = reducer(state, action);

        assert.deepStrictEqual(actual.verificationDataByConversation, {
          'convo A': {
            type: ConversationVerificationState.VerificationCancelled,
            canceledAt: now,
          },
        });
      });

      it('does nothing if no existing state', () => {
        const state: ConversationsStateType = getEmptyState();
        const action = getAction(Date.now(), state);
        const actual = reducer(state, action);

        assert.strictEqual(actual, state);
      });
    });

    describe('CANCEL_CONVERSATION_PENDING_VERIFICATION', () => {
      it('removes existing VerificationCancelled state', () => {
        const now = Date.now();
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.VerificationCancelled,
              canceledAt: now,
            },
          },
        };
        const actual = reducer(
          state,
          clearCancelledConversationVerification('convo A')
        );

        assert.deepStrictEqual(actual.verificationDataByConversation, {});
      });

      it('leaves existing PendingVerification state', () => {
        const state: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            'convo A': {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
            },
          },
        };
        const actual = reducer(
          state,
          clearCancelledConversationVerification('convo A')
        );

        assert.deepStrictEqual(actual, state);
      });

      it('does nothing with empty state', () => {
        const state: ConversationsStateType = getEmptyState();
        const actual = reducer(
          state,
          clearCancelledConversationVerification('convo A')
        );

        assert.deepStrictEqual(actual, state);
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
              sent_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnseen: 0,
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
              sent_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageIdThree, messageIdTwo, messageId],
              metrics: {
                totalUnseen: 0,
                newest: {
                  id: messageId,
                  received_at: time,
                  sent_at: time,
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
                totalUnseen: 0,
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
                totalUnseen: 0,
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
              sent_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnseen: 0,
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
              sent_at: time,
            },
          },
          messagesByConversation: {
            [conversationId]: {
              ...getDefaultConversationMessage(),
              messageIds: [messageId, messageIdTwo, messageIdThree],
              metrics: {
                totalUnseen: 0,
                oldest: {
                  id: messageId,
                  received_at: time,
                  sent_at: time,
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
                totalUnseen: 0,
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
                totalUnseen: 0,
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

    describe('REVIEW_CONVERSATION_NAME_COLLISION', () => {
      it('starts reviewing a name collision', () => {
        const state = getEmptyState();
        const action = reviewConversationNameCollision();
        const actual = reducer(state, action);

        assert.isTrue(actual.hasContactSpoofingReview);
      });
    });

    describe('SET_COMPOSE_GROUP_AVATAR', () => {
      it("can clear the composer's group avatar", () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultSetGroupMetadataComposerState,
            groupAvatar: new Uint8Array(2),
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
        const avatar = new Uint8Array([1, 2, 3]);

        const state = {
          ...getEmptyState(),
          composer: defaultSetGroupMetadataComposerState,
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
          composer: defaultSetGroupMetadataComposerState,
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
          composer: defaultStartDirectConversationComposerState,
        };

        const result = reducer(state, setComposeSearchTerm('foo bar'));

        assert.deepEqual(result.composer, {
          ...defaultStartDirectConversationComposerState,
          searchTerm: 'foo bar',
        });
      });
    });

    describe('DISCARD_MESSAGES', () => {
      const startState: ConversationsStateType = {
        ...getEmptyState(),
        messagesLookup: {
          [messageId]: getDefaultMessage(messageId),
          [messageIdTwo]: getDefaultMessage(messageIdTwo),
          [messageIdThree]: getDefaultMessage(messageIdThree),
        },
        messagesByConversation: {
          [conversationId]: {
            messageChangeCounter: 0,
            metrics: {
              totalUnseen: 0,
            },
            scrollToMessageCounter: 0,
            messageIds: [messageId, messageIdTwo, messageIdThree],
          },
        },
      };

      it('eliminates older messages', () => {
        const toDiscard = {
          conversationId,
          numberToKeepAtBottom: 2,
        };
        const state = reducer(startState, discardMessages(toDiscard));

        assert.deepEqual(
          state.messagesByConversation[conversationId]?.messageIds,
          [messageIdTwo, messageIdThree]
        );
      });

      it('eliminates newer messages', () => {
        const toDiscard = {
          conversationId,
          numberToKeepAtTop: 2,
        };
        const state = reducer(startState, discardMessages(toDiscard));

        assert.deepEqual(
          state.messagesByConversation[conversationId]?.messageIds,
          [messageId, messageIdTwo]
        );
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

    describe('MESSAGE_CHANGED', () => {
      const startState: ConversationsStateType = {
        ...getEmptyState(),
        conversationLookup: {
          [conversationId]: {
            ...getDefaultConversation(),
            id: conversationId,
            groupVersion: 2,
            groupId: 'dGhpc2lzYWdyb3VwaWR0aGlzaXNhZ3JvdXBpZHRoaXM=',
          },
        },
        messagesByConversation: {
          [conversationId]: {
            messageChangeCounter: 0,
            messageIds: [messageId, messageIdTwo, messageIdThree],
            metrics: {
              totalUnseen: 0,
            },
            scrollToMessageCounter: 0,
          },
        },
        messagesLookup: {
          [messageId]: {
            ...getDefaultMessage(messageId),
            displayLimit: undefined,
          },
          [messageIdTwo]: {
            ...getDefaultMessage(messageIdTwo),
            displayLimit: undefined,
          },
          [messageIdThree]: {
            ...getDefaultMessage(messageIdThree),
            displayLimit: undefined,
          },
        },
      };
      const changedMessage = {
        ...getDefaultMessage(messageId),
        body: 'changed',
        displayLimit: undefined,
        isSpoilerExpanded: undefined,
      };

      it('updates message data', () => {
        const state = reducer(
          startState,
          messageChanged(messageId, conversationId, changedMessage)
        );

        assert.deepEqual(state.messagesLookup[messageId], changedMessage);
        assert.strictEqual(
          state.messagesByConversation[conversationId]?.messageChangeCounter,
          0
        );
      });

      it('does not update lookup if it is a story reply', () => {
        const state = reducer(
          startState,
          messageChanged(messageId, conversationId, {
            ...changedMessage,
            storyId: 'story-id',
          })
        );

        assert.deepEqual(
          state.messagesLookup[messageId],
          startState.messagesLookup[messageId]
        );
        assert.strictEqual(
          state.messagesByConversation[conversationId]?.messageChangeCounter,
          0
        );
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
          composer: defaultStartDirectConversationComposerState,
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
          composer: defaultStartDirectConversationComposerState,
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
          composer: defaultStartDirectConversationComposerState,
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(
          result.composer,
          defaultStartDirectConversationComposerState
        );
      });

      it('if on the second step of the composer, goes back to the first step, clearing the search term', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            searchTerm: 'to be cleared',
          },
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(
          result.composer,
          defaultStartDirectConversationComposerState
        );
      });

      it('if on the third step of the composer, goes back to the first step, clearing everything', () => {
        const state = {
          ...getEmptyState(),
          composer: defaultSetGroupMetadataComposerState,
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(
          result.composer,
          defaultStartDirectConversationComposerState
        );
      });

      it('switches from the inbox to the composer', () => {
        const state = getEmptyState();
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(
          result.composer,
          defaultStartDirectConversationComposerState
        );
      });

      it('switches from the archive to the inbox', () => {
        const state = {
          ...getEmptyState(),
          showArchived: true,
        };
        const action = startComposing();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(
          result.composer,
          defaultStartDirectConversationComposerState
        );
      });
    });

    describe('SHOW_CHOOSE_GROUP_MEMBERS', () => {
      it('switches to the second step of the composer if on the first step', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultStartDirectConversationComposerState,
            searchTerm: 'to be cleared',
          },
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          userAvatarData: getDefaultAvatars(true),
        });
      });

      it('does nothing if already on the second step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: defaultChooseGroupMembersComposerState,
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('returns to the second step if on the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultSetGroupMetadataComposerState,
            groupName: 'Foo Bar Group',
            groupAvatar: new Uint8Array([4, 2]),
          },
        };
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([4, 2]),
        });
      });

      it('switches from the inbox to the second step of the composer', () => {
        const state = getEmptyState();
        const action = showChooseGroupMembers();
        const result = reducer(state, action);

        assert.isFalse(result.showArchived);
        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          userAvatarData: getDefaultAvatars(true),
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
          ...defaultChooseGroupMembersComposerState,
          userAvatarData: getDefaultAvatars(true),
        });
      });
    });

    describe('START_SETTING_GROUP_METADATA', () => {
      it('moves from the second to the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: ['abc', 'def'],
          },
        };
        const action = startSettingGroupMetadata();
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultSetGroupMetadataComposerState,
          selectedConversationIds: ['abc', 'def'],
        });
      });

      it('maintains state when going from the second to third steps of the composer, if the second step already had some data (likely from a previous visit)', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            searchTerm: 'foo bar',
            selectedConversationIds: ['abc', 'def'],
            groupName: 'Foo Bar Group',
            groupAvatar: new Uint8Array([6, 9]),
          },
        };
        const action = startSettingGroupMetadata();
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultSetGroupMetadataComposerState,
          selectedConversationIds: ['abc', 'def'],
          groupName: 'Foo Bar Group',
          groupAvatar: new Uint8Array([6, 9]),
        });
      });

      it('does nothing if already on the third step of the composer', () => {
        const state = {
          ...getEmptyState(),
          composer: defaultSetGroupMetadataComposerState,
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

      beforeEach(async () => {
        await updateRemoteConfig([
          { name: 'global.groupsv2.maxGroupSize', value: '22', enabled: true },
          {
            name: 'global.groupsv2.groupSizeHardLimit',
            value: '33',
            enabled: true,
          },
        ]);
      });

      it('adds conversation IDs to the list', () => {
        const zero = {
          ...getEmptyState(),
          composer: defaultChooseGroupMembersComposerState,
        };
        const one = reducer(zero, getAction('abc', zero));
        const two = reducer(one, getAction('def', one));

        assert.deepEqual(two.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: ['abc', 'def'],
        });
      });

      it('removes conversation IDs from the list', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: ['abc', 'def'],
          },
        };
        const action = getAction('abc', state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: ['def'],
        });
      });

      it('shows the recommended group size modal when first crossing the maximum recommended group size', () => {
        const oldSelectedConversationIds = times(21, () => generateUuid());
        const newUuid = generateUuid();

        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: oldSelectedConversationIds,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          recommendedGroupSizeModalState: OneTimeModalState.Showing,
        });
      });

      it("doesn't show the recommended group size modal twice", () => {
        const oldSelectedConversationIds = times(21, () => generateUuid());
        const newUuid = generateUuid();

        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: oldSelectedConversationIds,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
        });
      });

      it('defaults the maximum recommended size to 151', async () => {
        for (const value of [null, 'xyz']) {
          // eslint-disable-next-line no-await-in-loop
          await updateRemoteConfig([
            {
              name: 'global.groupsv2.maxGroupSize',
              value,
              enabled: true,
            },
            {
              name: 'global.groupsv2.groupSizeHardLimit',
              value: '33',
              enabled: true,
            },
          ]);

          const state = {
            ...getEmptyState(),
            composer: defaultChooseGroupMembersComposerState,
          };
          const action = getAction(generateUuid(), state);

          assert.strictEqual(action.payload.maxRecommendedGroupSize, 151);
        }
      });

      it('shows the maximum group size modal when first reaching the maximum group size', () => {
        const oldSelectedConversationIds = times(31, () => generateUuid());
        const newUuid = generateUuid();

        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: oldSelectedConversationIds,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            maximumGroupSizeModalState: OneTimeModalState.NeverShown,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
          maximumGroupSizeModalState: OneTimeModalState.Showing,
        });
      });

      it("doesn't show the maximum group size modal twice", () => {
        const oldSelectedConversationIds = times(31, () => generateUuid());
        const newUuid = generateUuid();

        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: oldSelectedConversationIds,
            recommendedGroupSizeModalState: OneTimeModalState.Shown,
            maximumGroupSizeModalState: OneTimeModalState.Shown,
          },
        };
        const action = getAction(newUuid, state);
        const result = reducer(state, action);

        assert.deepEqual(result.composer, {
          ...defaultChooseGroupMembersComposerState,
          selectedConversationIds: [...oldSelectedConversationIds, newUuid],
          recommendedGroupSizeModalState: OneTimeModalState.Shown,
          maximumGroupSizeModalState: OneTimeModalState.Shown,
        });
      });

      it('cannot select more than the maximum number of conversations', () => {
        const state = {
          ...getEmptyState(),
          composer: {
            ...defaultChooseGroupMembersComposerState,
            selectedConversationIds: times(1000, () => generateUuid()),
          },
        };
        const action = getAction(generateUuid(), state);
        const result = reducer(state, action);

        assert.deepEqual(result, state);
      });

      it('defaults the maximum group size to 1001 if the recommended maximum is smaller', async () => {
        for (const value of [null, 'xyz']) {
          // eslint-disable-next-line no-await-in-loop
          await updateRemoteConfig([
            { name: 'global.groupsv2.maxGroupSize', value: '2', enabled: true },
            {
              name: 'global.groupsv2.groupSizeHardLimit',
              value,
              enabled: true,
            },
          ]);

          const state = {
            ...getEmptyState(),
            composer: defaultChooseGroupMembersComposerState,
          };
          const action = getAction(generateUuid(), state);

          assert.strictEqual(action.payload.maxGroupSize, 1001);
        }
      });

      it('defaults the maximum group size to (recommended maximum + 1) if the recommended maximum is more than 1001', async () => {
        await updateRemoteConfig([
          {
            name: 'global.groupsv2.maxGroupSize',
            value: '1234',
            enabled: true,
          },
          {
            name: 'global.groupsv2.groupSizeHardLimit',
            value: '2',
            enabled: true,
          },
        ]);

        const state = {
          ...getEmptyState(),
          composer: defaultChooseGroupMembersComposerState,
        };
        const action = getAction(generateUuid(), state);

        assert.strictEqual(action.payload.maxGroupSize, 1235);
      });
    });

    describe('COLORS_CHANGED', () => {
      const abc = getDefaultConversationWithServiceId({
        id: 'abc',
        conversationColor: 'wintergreen',
      });
      const def = getDefaultConversationWithServiceId({
        id: 'def',
        conversationColor: 'infrared',
      });
      const ghi = getDefaultConversation({
        id: 'ghi',
        e164: 'ghi',
        conversationColor: 'ember',
      });
      const jkl = getDefaultConversation({
        id: 'jkl',
        groupId: 'jkl',
        conversationColor: 'plum',
      });
      const getState = () => ({
        ...getEmptyRootState(),
        conversations: {
          ...getEmptyState(),
          conversationLookup: {
            abc,
            def,
            ghi,
            jkl,
          },
          conversationsByServiceId: {
            abc,
            def,
          },
          conversationsByE164: {
            ghi,
          },
          conversationsByGroupId: {
            jkl,
          },
        },
      });

      it('resetAllChatColors', async () => {
        const dispatch = sinon.spy();
        await resetAllChatColors()(dispatch, getState, null);

        const [action] = dispatch.getCall(0).args;
        const nextState = reducer(getState().conversations, action);

        sinon.assert.calledOnce(dispatch);
        assert.isUndefined(nextState.conversationLookup.abc.conversationColor);
        assert.isUndefined(nextState.conversationLookup.def.conversationColor);
        assert.isUndefined(nextState.conversationLookup.ghi.conversationColor);
        assert.isUndefined(nextState.conversationLookup.jkl.conversationColor);
        assert.isUndefined(
          nextState.conversationsByServiceId[abc.serviceId].conversationColor
        );
        assert.isUndefined(
          nextState.conversationsByServiceId[def.serviceId].conversationColor
        );
        assert.isUndefined(nextState.conversationsByE164.ghi.conversationColor);
        assert.isUndefined(
          nextState.conversationsByGroupId.jkl.conversationColor
        );
        await window.storage.remove('defaultConversationColor');
      });
    });

    // When distribution lists change

    describe('VIEWERS_CHANGED', () => {
      const state: ConversationsStateType = {
        ...getEmptyState(),
        verificationDataByConversation: {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [
                  SERVICE_ID_1,
                  SERVICE_ID_2,
                  SERVICE_ID_3,
                ],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        },
      };

      it('removes uuids now missing from the list', async () => {
        const action: StoryDistributionListsActionType = {
          type: VIEWERS_CHANGED,
          payload: {
            listId: LIST_ID_1,
            memberServiceIds: [SERVICE_ID_1, SERVICE_ID_2],
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });
      it('removes now-empty list', async () => {
        const action: StoryDistributionListsActionType = {
          type: VIEWERS_CHANGED,
          payload: {
            listId: LIST_ID_1,
            memberServiceIds: [],
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });
    });
    describe('HIDE_MY_STORIES_FROM', () => {
      const state: ConversationsStateType = {
        ...getEmptyState(),
        verificationDataByConversation: {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [MY_STORY_ID]: {
                serviceIdsNeedingVerification: [
                  SERVICE_ID_1,
                  SERVICE_ID_2,
                  SERVICE_ID_3,
                ],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        },
      };

      it('removes now hidden uuids', async () => {
        const action: StoryDistributionListsActionType = {
          type: HIDE_MY_STORIES_FROM,
          payload: [SERVICE_ID_1, SERVICE_ID_2],
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [MY_STORY_ID]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });
      it('eliminates list if all items removed', async () => {
        const action: StoryDistributionListsActionType = {
          type: HIDE_MY_STORIES_FROM,
          payload: [SERVICE_ID_1, SERVICE_ID_2, SERVICE_ID_3],
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });
    });
    describe('DELETE_LIST', () => {
      const state: ConversationsStateType = {
        ...getEmptyState(),
        verificationDataByConversation: {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [
                  SERVICE_ID_1,
                  SERVICE_ID_2,
                  SERVICE_ID_3,
                ],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        },
      };

      it('eliminates deleted list entirely', async () => {
        const action: StoryDistributionListsActionType = {
          type: DELETE_LIST,
          payload: {
            deletedAtTimestamp: Date.now(),
            listId: LIST_ID_1,
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });

      it('deletes parent conversation if no other lists, no top-level uuids', async () => {
        const starting: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            convo1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [],
              byDistributionId: {
                [LIST_ID_1]: {
                  serviceIdsNeedingVerification: [
                    SERVICE_ID_1,
                    SERVICE_ID_2,
                    SERVICE_ID_3,
                  ],
                },
              },
            },
          },
        };

        const action: StoryDistributionListsActionType = {
          type: DELETE_LIST,
          payload: {
            deletedAtTimestamp: Date.now(),
            listId: LIST_ID_1,
          },
        };

        const actual = reducer(starting, action);
        assert.deepEqual(actual.verificationDataByConversation, {});
      });

      it('deletes byDistributionId if top-level list does have uuids', async () => {
        const starting: ConversationsStateType = {
          ...getEmptyState(),
          verificationDataByConversation: {
            convo1: {
              type: ConversationVerificationState.PendingVerification,
              serviceIdsNeedingVerification: [SERVICE_ID_1],
              byDistributionId: {
                [LIST_ID_1]: {
                  serviceIdsNeedingVerification: [
                    SERVICE_ID_1,
                    SERVICE_ID_2,
                    SERVICE_ID_3,
                  ],
                },
              },
            },
          },
        };

        const action: StoryDistributionListsActionType = {
          type: DELETE_LIST,
          payload: {
            deletedAtTimestamp: Date.now(),
            listId: LIST_ID_1,
          },
        };

        const actual = reducer(starting, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [SERVICE_ID_1],
          },
        });
      });
    });
    describe('MODIFY_LIST', () => {
      const state: ConversationsStateType = {
        ...getEmptyState(),
        verificationDataByConversation: {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [
                  SERVICE_ID_1,
                  SERVICE_ID_2,
                  SERVICE_ID_3,
                ],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        },
      };

      it('removes toRemove uuids for isBlockList = false', async () => {
        const action: StoryDistributionListsActionType = {
          type: MODIFY_LIST,
          payload: {
            id: LIST_ID_1,
            name: 'list1',
            allowsReplies: true,
            isBlockList: false,
            membersToAdd: [SERVICE_ID_2, SERVICE_ID_4],
            membersToRemove: [SERVICE_ID_3],
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [SERVICE_ID_1, SERVICE_ID_2],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });

      it('removes toAdd uuids for isBlocklist = true', async () => {
        const action: StoryDistributionListsActionType = {
          type: MODIFY_LIST,
          payload: {
            id: LIST_ID_1,
            name: 'list1',
            allowsReplies: true,
            isBlockList: true,
            membersToAdd: [SERVICE_ID_2, SERVICE_ID_1],
            membersToRemove: [SERVICE_ID_3],
          },
        };

        const actual = reducer(state, action);
        assert.deepEqual(actual.verificationDataByConversation, {
          convo1: {
            type: ConversationVerificationState.PendingVerification,
            serviceIdsNeedingVerification: [],
            byDistributionId: {
              [LIST_ID_1]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
              [LIST_ID_2]: {
                serviceIdsNeedingVerification: [SERVICE_ID_3],
              },
            },
          },
        });
      });
    });

    describe('CONVERSATIONS_UPDATED', () => {
      it('adds and updates multiple conversations', () => {
        const conversation1 = getDefaultConversation();
        const conversation2 = getDefaultConversation();
        const newConversation = getDefaultConversation();
        strictAssert(conversation1.serviceId, 'must exist');
        strictAssert(conversation1.e164, 'must exist');
        strictAssert(conversation2.serviceId, 'must exist');
        strictAssert(conversation2.e164, 'must exist');
        strictAssert(newConversation.serviceId, 'must exist');
        strictAssert(newConversation.e164, 'must exist');

        const state = {
          ...getEmptyState(),
          conversationLookup: {
            [conversation1.id]: conversation1,
            [conversation2.id]: conversation2,
          },
          conversationsByE164: {
            [conversation1.e164]: conversation1,
            [conversation2.e164]: conversation2,
          },
          conversationsByServiceId: {
            [conversation1.serviceId]: conversation1,
            [conversation2.serviceId]: conversation2,
          },
        };

        const updatedConversation1 = {
          ...conversation1,
          e164: undefined,
          title: 'new title',
        };
        const updatedConversation2 = {
          ...conversation2,
          active_at: 12345,
        };
        const updatedConversation2Again = {
          ...conversation2,
          active_at: 98765,
        };

        const action: ConversationsUpdatedActionType = {
          type: 'CONVERSATIONS_UPDATED',
          payload: {
            data: [
              updatedConversation1,
              updatedConversation2,
              newConversation,
              updatedConversation2Again,
            ],
          },
        };

        const actual = reducer(state, action);
        const expected: ConversationsStateType = {
          ...state,
          conversationLookup: {
            [conversation1.id]: updatedConversation1,
            [conversation2.id]: updatedConversation2Again,
            [newConversation.id]: newConversation,
          },
          conversationsByE164: {
            [conversation2.e164]: updatedConversation2Again,
            [newConversation.e164]: newConversation,
          },
          conversationsByServiceId: {
            [conversation1.serviceId]: updatedConversation1,
            [conversation2.serviceId]: updatedConversation2Again,
            [newConversation.serviceId]: newConversation,
          },
        };
        assert.deepEqual(actual, expected);
      });

      it('updates root state if conversation is selected', () => {
        const conversation1 = getDefaultConversation({ isArchived: true });
        const conversation2 = getDefaultConversation();
        strictAssert(conversation1.serviceId, 'must exist');
        strictAssert(conversation1.e164, 'must exist');
        strictAssert(conversation2.serviceId, 'must exist');
        strictAssert(conversation2.e164, 'must exist');

        const state: ConversationsStateType = {
          ...getEmptyState(),
          selectedConversationId: conversation1.id,
          showArchived: true,
          conversationLookup: {
            [conversation1.id]: conversation1,
            [conversation2.id]: conversation2,
          },
          conversationsByE164: {
            [conversation1.e164]: conversation1,
            [conversation2.e164]: conversation2,
          },
          conversationsByServiceId: {
            [conversation1.serviceId]: conversation1,
            [conversation2.serviceId]: conversation2,
          },
        };

        const updatedConversation1 = {
          ...conversation1,
          isArchived: false,
        };
        const updatedConversation2 = {
          ...conversation2,
          active_at: 12345,
        };

        const action: ConversationsUpdatedActionType = {
          type: 'CONVERSATIONS_UPDATED',
          payload: {
            data: [updatedConversation1, updatedConversation2],
          },
        };

        const actual = reducer(state, action);
        const expected: ConversationsStateType = {
          ...state,
          showArchived: false,
          conversationLookup: {
            [conversation1.id]: updatedConversation1,
            [conversation2.id]: updatedConversation2,
          },
          conversationsByE164: {
            [conversation1.e164]: updatedConversation1,
            [conversation2.e164]: updatedConversation2,
          },
          conversationsByServiceId: {
            [conversation1.serviceId]: updatedConversation1,
            [conversation2.serviceId]: updatedConversation2,
          },
        };
        assert.deepEqual(actual, expected);
      });
    });
  });
});
