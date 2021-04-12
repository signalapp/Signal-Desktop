// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable camelcase */
import { ThunkAction } from 'redux-thunk';
import {
  difference,
  fromPairs,
  intersection,
  omit,
  orderBy,
  pick,
  uniq,
  values,
  without,
} from 'lodash';

import { StateType as RootStateType } from '../reducer';
import * as groups from '../../groups';
import { calling } from '../../services/calling';
import { getOwn } from '../../util/getOwn';
import { assert } from '../../util/assert';
import { trigger } from '../../shims/events';
import { AttachmentType } from '../../types/Attachment';
import { ColorType } from '../../types/Colors';
import { BodyRangeType } from '../../types/Util';
import { CallMode, CallHistoryDetailsFromDiskType } from '../../types/Calling';
import {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
} from '../../components/conversation/conversation-details/PendingInvites';
import { GroupV2Membership } from '../../components/conversation/conversation-details/ConversationDetailsMembershipList';
import { MediaItemType } from '../../components/LightboxGallery';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';
import { toggleSelectedContactForGroupAddition } from '../../groups/toggleSelectedContactForGroupAddition';

// State

export type DBConversationType = {
  id: string;
  activeAt?: number;
  lastMessage: string;
  type: string;
};

export type LastMessageStatus =
  | 'error'
  | 'partial-sent'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read';

export type ConversationTypeType = 'direct' | 'group';

export type ConversationType = {
  id: string;
  uuid?: string;
  e164?: string;
  name?: string;
  firstName?: string;
  profileName?: string;
  about?: string;
  avatarPath?: string;
  areWeAdmin?: boolean;
  areWePending?: boolean;
  areWePendingApproval?: boolean;
  canChangeTimer?: boolean;
  canEditGroupInfo?: boolean;
  color?: ColorType;
  discoveredUnregisteredAt?: number;
  isAccepted?: boolean;
  isArchived?: boolean;
  isBlocked?: boolean;
  isGroupV1AndDisabled?: boolean;
  isGroupV2Capable?: boolean;
  isPinned?: boolean;
  isUntrusted?: boolean;
  isVerified?: boolean;
  activeAt?: number;
  timestamp?: number;
  inboxPosition?: number;
  left?: boolean;
  lastMessage?: {
    status: LastMessageStatus;
    text: string;
    deletedForEveryone?: boolean;
  };
  markedUnread?: boolean;
  phoneNumber?: string;
  membersCount?: number;
  messageCount?: number;
  accessControlAddFromInviteLink?: number;
  accessControlAttributes?: number;
  accessControlMembers?: number;
  expireTimer?: number;
  // This is used by the ConversationDetails set of components, it includes the
  // membersV2 data and also has some extra metadata attached to the object
  memberships?: Array<GroupV2Membership>;
  pendingMemberships?: Array<GroupV2PendingMembership>;
  pendingApprovalMemberships?: Array<GroupV2RequestingMembership>;
  muteExpiresAt?: number;
  type: ConversationTypeType;
  isMe?: boolean;
  lastUpdated?: number;
  // This is used by the CompositionInput for @mentions
  sortedGroupMembers?: Array<ConversationType>;
  title: string;
  unreadCount?: number;
  isSelected?: boolean;
  typingContact?: {
    avatarPath?: string;
    color?: ColorType;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
  } | null;
  recentMediaItems?: Array<MediaItemType>;
  profileSharing?: boolean;

  shouldShowDraft?: boolean;
  draftText?: string | null;
  draftBodyRanges?: Array<BodyRangeType>;
  draftPreview?: string;

  sharedGroupNames?: Array<string>;
  groupVersion?: 1 | 2;
  groupId?: string;
  groupLink?: string;
  messageRequestsEnabled?: boolean;
  acceptedMessageRequest?: boolean;
  secretParams?: string;
  publicParams?: string;
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};
export type MessageType = {
  id: string;
  conversationId: string;
  source?: string;
  sourceUuid?: string;
  type:
    | 'incoming'
    | 'outgoing'
    | 'group'
    | 'keychange'
    | 'verified-change'
    | 'message-history-unsynced'
    | 'call-history';
  quote?: { author?: string; authorUuid?: string };
  received_at: number;
  sent_at?: number;
  hasSignalAccount?: boolean;
  bodyPending?: boolean;
  attachments: Array<AttachmentType>;
  sticker: {
    data?: {
      pending?: boolean;
      blurHash?: string;
    };
  };
  unread: boolean;
  reactions?: Array<{
    emoji: string;
    timestamp: number;
    from: {
      id: string;
      color?: string;
      avatarPath?: string;
      name?: string;
      profileName?: string;
      isMe?: boolean;
      phoneNumber?: string;
    };
  }>;
  deletedForEveryone?: boolean;

  errors?: Array<Error>;
  group_update?: unknown;
  callHistoryDetails?: CallHistoryDetailsFromDiskType;

  // No need to go beyond this; unused at this stage, since this goes into
  //   a reducer still in plain JavaScript and comes out well-formed
};

type MessagePointerType = {
  id: string;
  received_at: number;
  sent_at?: number;
};
type MessageMetricsType = {
  newest?: MessagePointerType;
  oldest?: MessagePointerType;
  oldestUnread?: MessagePointerType;
  totalUnread: number;
};

export type MessageLookupType = {
  [key: string]: MessageType;
};
export type ConversationMessageType = {
  heightChangeMessageIds: Array<string>;
  isLoadingMessages: boolean;
  isNearBottom?: boolean;
  loadCountdownStart?: number;
  messageIds: Array<string>;
  metrics: MessageMetricsType;
  resetCounter: number;
  scrollToMessageId?: string;
  scrollToMessageCounter: number;
};

export type MessagesByConversationType = {
  [key: string]: ConversationMessageType | undefined;
};

export type PreJoinConversationType = {
  avatar?: {
    loading?: boolean;
    url?: string;
  };
  memberCount: number;
  title: string;
  approvalRequired: boolean;
};

export enum ComposerStep {
  StartDirectConversation,
  ChooseGroupMembers,
  SetGroupMetadata,
}

export enum OneTimeModalState {
  NeverShown,
  Showing,
  Shown,
}

type ComposerGroupCreationState = {
  groupAvatar: undefined | ArrayBuffer;
  groupName: string;
  maximumGroupSizeModalState: OneTimeModalState;
  recommendedGroupSizeModalState: OneTimeModalState;
  selectedConversationIds: Array<string>;
};

type ComposerStateType =
  | {
      step: ComposerStep.StartDirectConversation;
      contactSearchTerm: string;
    }
  | ({
      step: ComposerStep.ChooseGroupMembers;
      contactSearchTerm: string;
      cantAddContactIdForModal: undefined | string;
    } & ComposerGroupCreationState)
  | ({
      step: ComposerStep.SetGroupMetadata;
    } & ComposerGroupCreationState &
      (
        | { isCreating: false; hasError: boolean }
        | { isCreating: true; hasError: false }
      ));

export type ConversationsStateType = {
  preJoinConversation?: PreJoinConversationType;
  invitedConversationIdsForNewlyCreatedGroup?: Array<string>;
  conversationLookup: ConversationLookupType;
  conversationsByE164: ConversationLookupType;
  conversationsByUuid: ConversationLookupType;
  conversationsByGroupId: ConversationLookupType;
  selectedConversationId?: string;
  selectedMessage?: string;
  selectedMessageCounter: number;
  selectedConversationTitle?: string;
  selectedConversationPanelDepth: number;
  showArchived: boolean;
  composer?: ComposerStateType;

  // Note: it's very important that both of these locations are always kept up to date
  messagesLookup: MessageLookupType;
  messagesByConversation: MessagesByConversationType;
};

// Helpers

export const getConversationCallMode = (
  conversation: ConversationType
): CallMode => {
  if (
    conversation.left ||
    conversation.isBlocked ||
    conversation.isMe ||
    !conversation.acceptedMessageRequest
  ) {
    return CallMode.None;
  }

  if (conversation.type === 'direct') {
    return CallMode.Direct;
  }

  if (conversation.type === 'group' && conversation.groupVersion === 2) {
    return CallMode.Group;
  }

  return CallMode.None;
};

// Actions

type CantAddContactToGroupActionType = {
  type: 'CANT_ADD_CONTACT_TO_GROUP';
  payload: {
    conversationId: string;
  };
};
type ClearGroupCreationErrorActionType = { type: 'CLEAR_GROUP_CREATION_ERROR' };
type ClearInvitedConversationsForNewlyCreatedGroupActionType = {
  type: 'CLEAR_INVITED_CONVERSATIONS_FOR_NEWLY_CREATED_GROUP';
};
type CloseCantAddContactToGroupModalActionType = {
  type: 'CLOSE_CANT_ADD_CONTACT_TO_GROUP_MODAL';
};
type CloseMaximumGroupSizeModalActionType = {
  type: 'CLOSE_MAXIMUM_GROUP_SIZE_MODAL';
};
type CloseRecommendedGroupSizeModalActionType = {
  type: 'CLOSE_RECOMMENDED_GROUP_SIZE_MODAL';
};
type SetPreJoinConversationActionType = {
  type: 'SET_PRE_JOIN_CONVERSATION';
  payload: {
    data: PreJoinConversationType | undefined;
  };
};

type ConversationAddedActionType = {
  type: 'CONVERSATION_ADDED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationChangedActionType = {
  type: 'CONVERSATION_CHANGED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationRemovedActionType = {
  type: 'CONVERSATION_REMOVED';
  payload: {
    id: string;
  };
};
export type ConversationUnloadedActionType = {
  type: 'CONVERSATION_UNLOADED';
  payload: {
    id: string;
  };
};
type CreateGroupPendingActionType = {
  type: 'CREATE_GROUP_PENDING';
};
type CreateGroupFulfilledActionType = {
  type: 'CREATE_GROUP_FULFILLED';
  payload: {
    invitedConversationIds: Array<string>;
  };
};
type CreateGroupRejectedActionType = {
  type: 'CREATE_GROUP_REJECTED';
};
export type RemoveAllConversationsActionType = {
  type: 'CONVERSATIONS_REMOVE_ALL';
  payload: null;
};
export type MessageSelectedActionType = {
  type: 'MESSAGE_SELECTED';
  payload: {
    messageId: string;
    conversationId: string;
  };
};
export type MessageChangedActionType = {
  type: 'MESSAGE_CHANGED';
  payload: {
    id: string;
    conversationId: string;
    data: MessageType;
  };
};
export type MessageDeletedActionType = {
  type: 'MESSAGE_DELETED';
  payload: {
    id: string;
    conversationId: string;
  };
};
type MessageSizeChangedActionType = {
  type: 'MESSAGE_SIZE_CHANGED';
  payload: {
    id: string;
    conversationId: string;
  };
};
export type MessagesAddedActionType = {
  type: 'MESSAGES_ADDED';
  payload: {
    conversationId: string;
    messages: Array<MessageType>;
    isNewMessage: boolean;
    isActive: boolean;
  };
};

export type RepairNewestMessageActionType = {
  type: 'REPAIR_NEWEST_MESSAGE';
  payload: {
    conversationId: string;
  };
};
export type RepairOldestMessageActionType = {
  type: 'REPAIR_OLDEST_MESSAGE';
  payload: {
    conversationId: string;
  };
};
export type MessagesResetActionType = {
  type: 'MESSAGES_RESET';
  payload: {
    conversationId: string;
    messages: Array<MessageType>;
    metrics: MessageMetricsType;
    scrollToMessageId?: string;
    // The set of provided messages should be trusted, even if it conflicts with metrics,
    //   because we weren't looking for a specific time window of messages with our query.
    unboundedFetch: boolean;
  };
};
export type SetMessagesLoadingActionType = {
  type: 'SET_MESSAGES_LOADING';
  payload: {
    conversationId: string;
    isLoadingMessages: boolean;
  };
};
export type SetLoadCountdownStartActionType = {
  type: 'SET_LOAD_COUNTDOWN_START';
  payload: {
    conversationId: string;
    loadCountdownStart?: number;
  };
};
export type SetIsNearBottomActionType = {
  type: 'SET_NEAR_BOTTOM';
  payload: {
    conversationId: string;
    isNearBottom: boolean;
  };
};
export type SetConversationHeaderTitleActionType = {
  type: 'SET_CONVERSATION_HEADER_TITLE';
  payload: { title?: string };
};
export type SetSelectedConversationPanelDepthActionType = {
  type: 'SET_SELECTED_CONVERSATION_PANEL_DEPTH';
  payload: { panelDepth: number };
};
export type ScrollToMessageActionType = {
  type: 'SCROLL_TO_MESSAGE';
  payload: {
    conversationId: string;
    messageId: string;
  };
};
export type ClearChangedMessagesActionType = {
  type: 'CLEAR_CHANGED_MESSAGES';
  payload: {
    conversationId: string;
  };
};
export type ClearSelectedMessageActionType = {
  type: 'CLEAR_SELECTED_MESSAGE';
  payload: null;
};
export type ClearUnreadMetricsActionType = {
  type: 'CLEAR_UNREAD_METRICS';
  payload: {
    conversationId: string;
  };
};
export type SelectedConversationChangedActionType = {
  type: 'SELECTED_CONVERSATION_CHANGED';
  payload: {
    id: string;
    messageId?: string;
  };
};
type ShowInboxActionType = {
  type: 'SHOW_INBOX';
  payload: null;
};
export type ShowArchivedConversationsActionType = {
  type: 'SHOW_ARCHIVED_CONVERSATIONS';
  payload: null;
};
type SetComposeGroupAvatarActionType = {
  type: 'SET_COMPOSE_GROUP_AVATAR';
  payload: { groupAvatar: undefined | ArrayBuffer };
};
type SetComposeGroupNameActionType = {
  type: 'SET_COMPOSE_GROUP_NAME';
  payload: { groupName: string };
};
type SetComposeSearchTermActionType = {
  type: 'SET_COMPOSE_SEARCH_TERM';
  payload: { contactSearchTerm: string };
};
type SetRecentMediaItemsActionType = {
  type: 'SET_RECENT_MEDIA_ITEMS';
  payload: {
    id: string;
    recentMediaItems: Array<MediaItemType>;
  };
};
type StartComposingActionType = {
  type: 'START_COMPOSING';
};
type ShowChooseGroupMembersActionType = {
  type: 'SHOW_CHOOSE_GROUP_MEMBERS';
};
type StartSettingGroupMetadataActionType = {
  type: 'START_SETTING_GROUP_METADATA';
};
export type SwitchToAssociatedViewActionType = {
  type: 'SWITCH_TO_ASSOCIATED_VIEW';
  payload: { conversationId: string };
};
export type ToggleConversationInChooseMembersActionType = {
  type: 'TOGGLE_CONVERSATION_IN_CHOOSE_MEMBERS';
  payload: {
    conversationId: string;
    maxRecommendedGroupSize: number;
    maxGroupSize: number;
  };
};

export type ConversationActionType =
  | CantAddContactToGroupActionType
  | ClearChangedMessagesActionType
  | ClearGroupCreationErrorActionType
  | ClearInvitedConversationsForNewlyCreatedGroupActionType
  | ClearSelectedMessageActionType
  | ClearUnreadMetricsActionType
  | CloseCantAddContactToGroupModalActionType
  | CloseMaximumGroupSizeModalActionType
  | CloseRecommendedGroupSizeModalActionType
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | ConversationUnloadedActionType
  | CreateGroupFulfilledActionType
  | CreateGroupPendingActionType
  | CreateGroupRejectedActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessagesAddedActionType
  | MessageSelectedActionType
  | MessageSizeChangedActionType
  | MessagesResetActionType
  | RemoveAllConversationsActionType
  | RepairNewestMessageActionType
  | RepairOldestMessageActionType
  | ScrollToMessageActionType
  | SelectedConversationChangedActionType
  | SetComposeGroupAvatarActionType
  | SetComposeGroupNameActionType
  | SetComposeSearchTermActionType
  | SetConversationHeaderTitleActionType
  | SetIsNearBottomActionType
  | SetLoadCountdownStartActionType
  | SetMessagesLoadingActionType
  | SetPreJoinConversationActionType
  | SetRecentMediaItemsActionType
  | SetSelectedConversationPanelDepthActionType
  | ShowArchivedConversationsActionType
  | ShowInboxActionType
  | StartComposingActionType
  | ShowChooseGroupMembersActionType
  | StartSettingGroupMetadataActionType
  | SwitchToAssociatedViewActionType
  | ToggleConversationInChooseMembersActionType;

// Action Creators

export const actions = {
  cantAddContactToGroup,
  clearChangedMessages,
  clearInvitedConversationsForNewlyCreatedGroup,
  clearGroupCreationError,
  clearSelectedMessage,
  clearUnreadMetrics,
  closeCantAddContactToGroupModal,
  closeRecommendedGroupSizeModal,
  closeMaximumGroupSizeModal,
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  conversationUnloaded,
  createGroup,
  messageChanged,
  messageDeleted,
  messagesAdded,
  messageSizeChanged,
  messagesReset,
  openConversationExternal,
  openConversationInternal,
  removeAllConversations,
  repairNewestMessage,
  repairOldestMessage,
  scrollToMessage,
  selectMessage,
  setComposeGroupAvatar,
  setComposeGroupName,
  setComposeSearchTerm,
  setIsNearBottom,
  setLoadCountdownStart,
  setMessagesLoading,
  setPreJoinConversation,
  setRecentMediaItems,
  setSelectedConversationHeaderTitle,
  setSelectedConversationPanelDepth,
  showArchivedConversations,
  showInbox,
  startComposing,
  showChooseGroupMembers,
  startNewConversationFromPhoneNumber,
  startSettingGroupMetadata,
  toggleConversationInChooseMembers,
};

function cantAddContactToGroup(
  conversationId: string
): CantAddContactToGroupActionType {
  return {
    type: 'CANT_ADD_CONTACT_TO_GROUP',
    payload: { conversationId },
  };
}
function setPreJoinConversation(
  data: PreJoinConversationType | undefined
): SetPreJoinConversationActionType {
  return {
    type: 'SET_PRE_JOIN_CONVERSATION',
    payload: {
      data,
    },
  };
}
function conversationAdded(
  id: string,
  data: ConversationType
): ConversationAddedActionType {
  return {
    type: 'CONVERSATION_ADDED',
    payload: {
      id,
      data,
    },
  };
}
function conversationChanged(
  id: string,
  data: ConversationType
): ThunkAction<void, RootStateType, unknown, ConversationChangedActionType> {
  return dispatch => {
    calling.groupMembersChanged(id);

    dispatch({
      type: 'CONVERSATION_CHANGED',
      payload: {
        id,
        data,
      },
    });
  };
}
function conversationRemoved(id: string): ConversationRemovedActionType {
  return {
    type: 'CONVERSATION_REMOVED',
    payload: {
      id,
    },
  };
}
function conversationUnloaded(id: string): ConversationUnloadedActionType {
  return {
    type: 'CONVERSATION_UNLOADED',
    payload: {
      id,
    },
  };
}

function createGroup(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | CreateGroupPendingActionType
  | CreateGroupFulfilledActionType
  | CreateGroupRejectedActionType
  | SwitchToAssociatedViewActionType
> {
  return async (dispatch, getState, ...args) => {
    const { composer } = getState().conversations;
    if (
      composer?.step !== ComposerStep.SetGroupMetadata ||
      composer.isCreating
    ) {
      assert(false, 'Cannot create group in this stage; doing nothing');
      return;
    }

    dispatch({ type: 'CREATE_GROUP_PENDING' });

    try {
      const conversation = await groups.createGroupV2({
        name: composer.groupName.trim(),
        avatar: composer.groupAvatar,
        conversationIds: composer.selectedConversationIds,
      });
      dispatch({
        type: 'CREATE_GROUP_FULFILLED',
        payload: {
          invitedConversationIds: (
            conversation.get('pendingMembersV2') || []
          ).map(member => member.conversationId),
        },
      });
      openConversationInternal({
        conversationId: conversation.id,
        switchToAssociatedView: true,
      })(dispatch, getState, ...args);
    } catch (err) {
      window.log.error(
        'Failed to create group',
        err && err.stack ? err.stack : err
      );
      dispatch({ type: 'CREATE_GROUP_REJECTED' });
    }
  };
}

function removeAllConversations(): RemoveAllConversationsActionType {
  return {
    type: 'CONVERSATIONS_REMOVE_ALL',
    payload: null,
  };
}

function selectMessage(
  messageId: string,
  conversationId: string
): MessageSelectedActionType {
  return {
    type: 'MESSAGE_SELECTED',
    payload: {
      messageId,
      conversationId,
    },
  };
}

function messageChanged(
  id: string,
  conversationId: string,
  data: MessageType
): MessageChangedActionType {
  return {
    type: 'MESSAGE_CHANGED',
    payload: {
      id,
      conversationId,
      data,
    },
  };
}
function messageDeleted(
  id: string,
  conversationId: string
): MessageDeletedActionType {
  return {
    type: 'MESSAGE_DELETED',
    payload: {
      id,
      conversationId,
    },
  };
}
function messageSizeChanged(
  id: string,
  conversationId: string
): MessageSizeChangedActionType {
  return {
    type: 'MESSAGE_SIZE_CHANGED',
    payload: {
      id,
      conversationId,
    },
  };
}
function messagesAdded(
  conversationId: string,
  messages: Array<MessageType>,
  isNewMessage: boolean,
  isActive: boolean
): MessagesAddedActionType {
  return {
    type: 'MESSAGES_ADDED',
    payload: {
      conversationId,
      messages,
      isNewMessage,
      isActive,
    },
  };
}

function repairNewestMessage(
  conversationId: string
): RepairNewestMessageActionType {
  return {
    type: 'REPAIR_NEWEST_MESSAGE',
    payload: {
      conversationId,
    },
  };
}
function repairOldestMessage(
  conversationId: string
): RepairOldestMessageActionType {
  return {
    type: 'REPAIR_OLDEST_MESSAGE',
    payload: {
      conversationId,
    },
  };
}

function messagesReset(
  conversationId: string,
  messages: Array<MessageType>,
  metrics: MessageMetricsType,
  scrollToMessageId?: string,
  unboundedFetch?: boolean
): MessagesResetActionType {
  return {
    type: 'MESSAGES_RESET',
    payload: {
      unboundedFetch: Boolean(unboundedFetch),
      conversationId,
      messages,
      metrics,
      scrollToMessageId,
    },
  };
}
function setMessagesLoading(
  conversationId: string,
  isLoadingMessages: boolean
): SetMessagesLoadingActionType {
  return {
    type: 'SET_MESSAGES_LOADING',
    payload: {
      conversationId,
      isLoadingMessages,
    },
  };
}
function setLoadCountdownStart(
  conversationId: string,
  loadCountdownStart?: number
): SetLoadCountdownStartActionType {
  return {
    type: 'SET_LOAD_COUNTDOWN_START',
    payload: {
      conversationId,
      loadCountdownStart,
    },
  };
}
function setIsNearBottom(
  conversationId: string,
  isNearBottom: boolean
): SetIsNearBottomActionType {
  return {
    type: 'SET_NEAR_BOTTOM',
    payload: {
      conversationId,
      isNearBottom,
    },
  };
}
function setSelectedConversationHeaderTitle(
  title?: string
): SetConversationHeaderTitleActionType {
  return {
    type: 'SET_CONVERSATION_HEADER_TITLE',
    payload: { title },
  };
}
function setSelectedConversationPanelDepth(
  panelDepth: number
): SetSelectedConversationPanelDepthActionType {
  return {
    type: 'SET_SELECTED_CONVERSATION_PANEL_DEPTH',
    payload: { panelDepth },
  };
}
function setRecentMediaItems(
  id: string,
  recentMediaItems: Array<MediaItemType>
): SetRecentMediaItemsActionType {
  return {
    type: 'SET_RECENT_MEDIA_ITEMS',
    payload: { id, recentMediaItems },
  };
}
function clearChangedMessages(
  conversationId: string
): ClearChangedMessagesActionType {
  return {
    type: 'CLEAR_CHANGED_MESSAGES',
    payload: {
      conversationId,
    },
  };
}
function clearInvitedConversationsForNewlyCreatedGroup(): ClearInvitedConversationsForNewlyCreatedGroupActionType {
  return { type: 'CLEAR_INVITED_CONVERSATIONS_FOR_NEWLY_CREATED_GROUP' };
}
function clearGroupCreationError(): ClearGroupCreationErrorActionType {
  return { type: 'CLEAR_GROUP_CREATION_ERROR' };
}
function clearSelectedMessage(): ClearSelectedMessageActionType {
  return {
    type: 'CLEAR_SELECTED_MESSAGE',
    payload: null,
  };
}
function clearUnreadMetrics(
  conversationId: string
): ClearUnreadMetricsActionType {
  return {
    type: 'CLEAR_UNREAD_METRICS',
    payload: {
      conversationId,
    },
  };
}
function closeCantAddContactToGroupModal(): CloseCantAddContactToGroupModalActionType {
  return { type: 'CLOSE_CANT_ADD_CONTACT_TO_GROUP_MODAL' };
}
function closeMaximumGroupSizeModal(): CloseMaximumGroupSizeModalActionType {
  return { type: 'CLOSE_MAXIMUM_GROUP_SIZE_MODAL' };
}
function closeRecommendedGroupSizeModal(): CloseRecommendedGroupSizeModalActionType {
  return { type: 'CLOSE_RECOMMENDED_GROUP_SIZE_MODAL' };
}
function scrollToMessage(
  conversationId: string,
  messageId: string
): ScrollToMessageActionType {
  return {
    type: 'SCROLL_TO_MESSAGE',
    payload: {
      conversationId,
      messageId,
    },
  };
}

function setComposeGroupAvatar(
  groupAvatar: undefined | ArrayBuffer
): SetComposeGroupAvatarActionType {
  return {
    type: 'SET_COMPOSE_GROUP_AVATAR',
    payload: { groupAvatar },
  };
}

function setComposeGroupName(groupName: string): SetComposeGroupNameActionType {
  return {
    type: 'SET_COMPOSE_GROUP_NAME',
    payload: { groupName },
  };
}

function setComposeSearchTerm(
  contactSearchTerm: string
): SetComposeSearchTermActionType {
  return {
    type: 'SET_COMPOSE_SEARCH_TERM',
    payload: { contactSearchTerm },
  };
}

function startComposing(): StartComposingActionType {
  return { type: 'START_COMPOSING' };
}

function showChooseGroupMembers(): ShowChooseGroupMembersActionType {
  return { type: 'SHOW_CHOOSE_GROUP_MEMBERS' };
}

function startNewConversationFromPhoneNumber(
  e164: string
): ThunkAction<void, RootStateType, unknown, ShowInboxActionType> {
  return dispatch => {
    trigger('showConversation', e164);

    dispatch(showInbox());
  };
}

function startSettingGroupMetadata(): StartSettingGroupMetadataActionType {
  return { type: 'START_SETTING_GROUP_METADATA' };
}

function toggleConversationInChooseMembers(
  conversationId: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ToggleConversationInChooseMembersActionType
> {
  return dispatch => {
    const maxRecommendedGroupSize = getGroupSizeRecommendedLimit(151);
    const maxGroupSize = Math.max(
      getGroupSizeHardLimit(1001),
      maxRecommendedGroupSize + 1
    );

    assert(
      maxGroupSize > maxRecommendedGroupSize,
      'Expected the hard max group size to be larger than the recommended maximum'
    );

    dispatch({
      type: 'TOGGLE_CONVERSATION_IN_CHOOSE_MEMBERS',
      payload: { conversationId, maxGroupSize, maxRecommendedGroupSize },
    });
  };
}

// Note: we need two actions here to simplify. Operations outside of the left pane can
//   trigger an 'openConversation' so we go through Whisper.events for all
//   conversation selection. Internal just triggers the Whisper.event, and External
//   makes the changes to the store.
function openConversationInternal({
  conversationId,
  messageId,
  switchToAssociatedView,
}: Readonly<{
  conversationId: string;
  messageId?: string;
  switchToAssociatedView?: boolean;
}>): ThunkAction<
  void,
  RootStateType,
  unknown,
  SwitchToAssociatedViewActionType
> {
  return dispatch => {
    trigger('showConversation', conversationId, messageId);

    if (switchToAssociatedView) {
      dispatch({
        type: 'SWITCH_TO_ASSOCIATED_VIEW',
        payload: { conversationId },
      });
    }
  };
}
function openConversationExternal(
  id: string,
  messageId?: string
): SelectedConversationChangedActionType {
  return {
    type: 'SELECTED_CONVERSATION_CHANGED',
    payload: {
      id,
      messageId,
    },
  };
}

function showInbox(): ShowInboxActionType {
  return {
    type: 'SHOW_INBOX',
    payload: null,
  };
}
function showArchivedConversations(): ShowArchivedConversationsActionType {
  return {
    type: 'SHOW_ARCHIVED_CONVERSATIONS',
    payload: null,
  };
}

// Reducer

export function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    conversationsByE164: {},
    conversationsByUuid: {},
    conversationsByGroupId: {},
    messagesByConversation: {},
    messagesLookup: {},
    selectedMessageCounter: 0,
    showArchived: false,
    selectedConversationTitle: '',
    selectedConversationPanelDepth: 0,
  };
}

function hasMessageHeightChanged(
  message: MessageType,
  previous: MessageType
): boolean {
  const messageAttachments = message.attachments || [];
  const previousAttachments = previous.attachments || [];

  const errorStatusChanged =
    (!message.errors && previous.errors) ||
    (message.errors && !previous.errors) ||
    (message.errors &&
      previous.errors &&
      message.errors.length !== previous.errors.length);
  if (errorStatusChanged) {
    return true;
  }

  const groupUpdateChanged = message.group_update !== previous.group_update;
  if (groupUpdateChanged) {
    return true;
  }

  const stickerPendingChanged =
    message.sticker &&
    message.sticker.data &&
    previous.sticker &&
    previous.sticker.data &&
    !previous.sticker.data.blurHash &&
    previous.sticker.data.pending !== message.sticker.data.pending;
  if (stickerPendingChanged) {
    return true;
  }

  const longMessageAttachmentLoaded =
    previous.bodyPending && !message.bodyPending;
  if (longMessageAttachmentLoaded) {
    return true;
  }

  const firstAttachmentNoLongerPending =
    previousAttachments[0] &&
    previousAttachments[0].pending &&
    messageAttachments[0] &&
    !messageAttachments[0].pending;
  if (firstAttachmentNoLongerPending) {
    return true;
  }

  const signalAccountChanged =
    Boolean(message.hasSignalAccount || previous.hasSignalAccount) &&
    message.hasSignalAccount !== previous.hasSignalAccount;
  if (signalAccountChanged) {
    return true;
  }

  const currentReactions = message.reactions || [];
  const lastReactions = previous.reactions || [];
  const reactionsChanged =
    (currentReactions.length === 0) !== (lastReactions.length === 0);
  if (reactionsChanged) {
    return true;
  }

  const isDeletedForEveryone = message.deletedForEveryone;
  const wasDeletedForEveryone = previous.deletedForEveryone;
  if (isDeletedForEveryone !== wasDeletedForEveryone) {
    return true;
  }

  return false;
}

export function updateConversationLookups(
  added: ConversationType | undefined,
  removed: ConversationType | undefined,
  state: ConversationsStateType
): Pick<
  ConversationsStateType,
  'conversationsByE164' | 'conversationsByUuid' | 'conversationsByGroupId'
> {
  const result = {
    conversationsByE164: state.conversationsByE164,
    conversationsByUuid: state.conversationsByUuid,
    conversationsByGroupId: state.conversationsByGroupId,
  };

  if (removed && removed.e164) {
    result.conversationsByE164 = omit(result.conversationsByE164, removed.e164);
  }
  if (removed && removed.uuid) {
    result.conversationsByUuid = omit(result.conversationsByUuid, removed.uuid);
  }
  if (removed && removed.groupId) {
    result.conversationsByGroupId = omit(
      result.conversationsByGroupId,
      removed.groupId
    );
  }

  if (added && added.e164) {
    result.conversationsByE164 = {
      ...result.conversationsByE164,
      [added.e164]: added,
    };
  }
  if (added && added.uuid) {
    result.conversationsByUuid = {
      ...result.conversationsByUuid,
      [added.uuid]: added,
    };
  }
  if (added && added.groupId) {
    result.conversationsByGroupId = {
      ...result.conversationsByGroupId,
      [added.groupId]: added,
    };
  }

  return result;
}

function closeComposerModal(
  state: Readonly<ConversationsStateType>,
  modalToClose: 'maximumGroupSizeModalState' | 'recommendedGroupSizeModalState'
): ConversationsStateType {
  const { composer } = state;
  if (composer?.step !== ComposerStep.ChooseGroupMembers) {
    assert(false, "Can't close the modal in this composer step. Doing nothing");
    return state;
  }
  if (composer[modalToClose] !== OneTimeModalState.Showing) {
    return state;
  }
  return {
    ...state,
    composer: {
      ...composer,
      [modalToClose]: OneTimeModalState.Shown,
    },
  };
}

export function reducer(
  state: Readonly<ConversationsStateType> = getEmptyState(),
  action: Readonly<ConversationActionType>
): ConversationsStateType {
  if (action.type === 'CANT_ADD_CONTACT_TO_GROUP') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.ChooseGroupMembers) {
      assert(false, "Can't update modal in this composer step. Doing nothing");
      return state;
    }
    return {
      ...state,
      composer: {
        ...composer,
        cantAddContactIdForModal: action.payload.conversationId,
      },
    };
  }

  if (action.type === 'CLEAR_INVITED_CONVERSATIONS_FOR_NEWLY_CREATED_GROUP') {
    return omit(state, 'invitedConversationIdsForNewlyCreatedGroup');
  }

  if (action.type === 'CLEAR_GROUP_CREATION_ERROR') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.SetGroupMetadata) {
      assert(
        false,
        "Can't clear group creation error in this composer state. Doing nothing"
      );
      return state;
    }
    return {
      ...state,
      composer: {
        ...composer,
        hasError: false,
      },
    };
  }

  if (action.type === 'CLOSE_CANT_ADD_CONTACT_TO_GROUP_MODAL') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.ChooseGroupMembers) {
      assert(
        false,
        "Can't close the modal in this composer step. Doing nothing"
      );
      return state;
    }
    return {
      ...state,
      composer: {
        ...composer,
        cantAddContactIdForModal: undefined,
      },
    };
  }

  if (action.type === 'CLOSE_MAXIMUM_GROUP_SIZE_MODAL') {
    return closeComposerModal(state, 'maximumGroupSizeModalState' as const);
  }

  if (action.type === 'CLOSE_RECOMMENDED_GROUP_SIZE_MODAL') {
    return closeComposerModal(state, 'recommendedGroupSizeModalState' as const);
  }

  if (action.type === 'SET_PRE_JOIN_CONVERSATION') {
    const { payload } = action;
    const { data } = payload;

    return {
      ...state,
      preJoinConversation: data,
    };
  }
  if (action.type === 'CONVERSATION_ADDED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      ...updateConversationLookups(data, undefined, state),
    };
  }
  if (action.type === 'CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;

    let { showArchived, selectedConversationId } = state;

    const existing = conversationLookup[id];
    // In the change case we only modify the lookup if we already had that conversation
    if (!existing) {
      return state;
    }

    if (selectedConversationId === id) {
      // Archived -> Inbox: we go back to the normal inbox view
      if (existing.isArchived && !data.isArchived) {
        showArchived = false;
      }
      // Inbox -> Archived: no conversation is selected
      // Note: With today's stacked converastions architecture, this can result in weird
      //   behavior - no selected conversation in the left pane, but a conversation show
      //   in the right pane.
      if (!existing.isArchived && data.isArchived) {
        selectedConversationId = undefined;
      }
    }

    return {
      ...state,
      selectedConversationId,
      showArchived,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      ...updateConversationLookups(data, existing, state),
    };
  }
  if (action.type === 'CONVERSATION_REMOVED') {
    const { payload } = action;
    const { id } = payload;
    const { conversationLookup } = state;
    const existing = getOwn(conversationLookup, id);

    // No need to make a change if we didn't have a record of this conversation!
    if (!existing) {
      return state;
    }

    return {
      ...state,
      conversationLookup: omit(conversationLookup, [id]),
      ...updateConversationLookups(undefined, existing, state),
    };
  }
  if (action.type === 'CONVERSATION_UNLOADED') {
    const { payload } = action;
    const { id } = payload;
    const existingConversation = state.messagesByConversation[id];
    if (!existingConversation) {
      return state;
    }

    const { messageIds } = existingConversation;
    const selectedConversationId =
      state.selectedConversationId !== id
        ? state.selectedConversationId
        : undefined;

    return {
      ...state,
      selectedConversationId,
      selectedConversationPanelDepth: 0,
      messagesLookup: omit(state.messagesLookup, messageIds),
      messagesByConversation: omit(state.messagesByConversation, [id]),
    };
  }
  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }
  if (action.type === 'CREATE_GROUP_PENDING') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.SetGroupMetadata) {
      // This should be unlikely, but it can happen if someone closes the composer while
      //   a group is being created.
      return state;
    }
    return {
      ...state,
      composer: {
        ...composer,
        hasError: false,
        isCreating: true,
      },
    };
  }
  if (action.type === 'CREATE_GROUP_FULFILLED') {
    // We don't do much here and instead rely on `openConversationInternal` to do most of
    //   the work.
    return {
      ...state,
      invitedConversationIdsForNewlyCreatedGroup:
        action.payload.invitedConversationIds,
    };
  }
  if (action.type === 'CREATE_GROUP_REJECTED') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.SetGroupMetadata) {
      // This should be unlikely, but it can happen if someone closes the composer while
      //   a group is being created.
      return state;
    }
    return {
      ...state,
      composer: {
        ...composer,
        hasError: true,
        isCreating: false,
      },
    };
  }
  if (action.type === 'SET_SELECTED_CONVERSATION_PANEL_DEPTH') {
    return {
      ...state,
      selectedConversationPanelDepth: action.payload.panelDepth,
    };
  }
  if (action.type === 'MESSAGE_SELECTED') {
    const { messageId, conversationId } = action.payload;

    if (state.selectedConversationId !== conversationId) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
    };
  }
  if (action.type === 'MESSAGE_CHANGED') {
    const { id, conversationId, data } = action.payload;
    const existingConversation = state.messagesByConversation[conversationId];

    // We don't keep track of messages unless their conversation is loaded...
    if (!existingConversation) {
      return state;
    }
    // ...and we've already loaded that message once
    const existingMessage = state.messagesLookup[id];
    if (!existingMessage) {
      return state;
    }

    // Check for changes which could affect height - that's why we need this
    //   heightChangeMessageIds field. It tells Timeline to recalculate all of its heights
    const hasHeightChanged = hasMessageHeightChanged(data, existingMessage);

    const { heightChangeMessageIds } = existingConversation;
    const updatedChanges = hasHeightChanged
      ? uniq([...heightChangeMessageIds, id])
      : heightChangeMessageIds;

    return {
      ...state,
      messagesLookup: {
        ...state.messagesLookup,
        [id]: data,
      },
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          heightChangeMessageIds: updatedChanges,
        },
      },
    };
  }
  if (action.type === 'MESSAGE_SIZE_CHANGED') {
    const { id, conversationId } = action.payload;

    const existingConversation = getOwn(
      state.messagesByConversation,
      conversationId
    );
    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          heightChangeMessageIds: uniq([
            ...existingConversation.heightChangeMessageIds,
            id,
          ]),
        },
      },
    };
  }
  if (action.type === 'MESSAGES_RESET') {
    const {
      conversationId,
      messages,
      metrics,
      scrollToMessageId,
      unboundedFetch,
    } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    const resetCounter = existingConversation
      ? existingConversation.resetCounter + 1
      : 0;

    const sorted = orderBy(
      messages,
      ['received_at', 'sent_at'],
      ['ASC', 'ASC']
    );
    const messageIds = sorted.map(message => message.id);

    const lookup = fromPairs(messages.map(message => [message.id, message]));

    let { newest, oldest } = metrics;

    // If our metrics are a little out of date, we'll fix them up
    if (messages.length > 0) {
      const first = messages[0];
      if (first && (!oldest || first.received_at <= oldest.received_at)) {
        oldest = pick(first, ['id', 'received_at', 'sent_at']);
      }

      const last = messages[messages.length - 1];
      if (
        last &&
        (!newest || unboundedFetch || last.received_at >= newest.received_at)
      ) {
        newest = pick(last, ['id', 'received_at', 'sent_at']);
      }
    }

    return {
      ...state,
      selectedMessage: scrollToMessageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
      messagesLookup: {
        ...messagesLookup,
        ...lookup,
      },
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          isLoadingMessages: false,
          scrollToMessageId,
          scrollToMessageCounter: existingConversation
            ? existingConversation.scrollToMessageCounter + 1
            : 0,
          messageIds,
          metrics: {
            ...metrics,
            newest,
            oldest,
          },
          resetCounter,
          heightChangeMessageIds: [],
        },
      },
    };
  }
  if (action.type === 'SET_MESSAGES_LOADING') {
    const { payload } = action;
    const { conversationId, isLoadingMessages } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          loadCountdownStart: undefined,
          isLoadingMessages,
        },
      },
    };
  }
  if (action.type === 'SET_LOAD_COUNTDOWN_START') {
    const { payload } = action;
    const { conversationId, loadCountdownStart } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          loadCountdownStart,
        },
      },
    };
  }
  if (action.type === 'SET_NEAR_BOTTOM') {
    const { payload } = action;
    const { conversationId, isNearBottom } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isNearBottom,
        },
      },
    };
  }
  if (action.type === 'SCROLL_TO_MESSAGE') {
    const { payload } = action;
    const { conversationId, messageId } = payload;

    const { messagesByConversation, messagesLookup } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }
    if (!messagesLookup[messageId]) {
      return state;
    }
    if (!existingConversation.messageIds.includes(messageId)) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isLoadingMessages: false,
          scrollToMessageId: messageId,
          scrollToMessageCounter:
            existingConversation.scrollToMessageCounter + 1,
        },
      },
    };
  }
  if (action.type === 'MESSAGE_DELETED') {
    const { id, conversationId } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    if (!existingConversation) {
      return state;
    }

    // Assuming that we always have contiguous groups of messages in memory, the removal
    //   of one message at one end of our message set be replaced with the message right
    //   next to it.
    const oldIds = existingConversation.messageIds;
    let { newest, oldest } = existingConversation.metrics;

    if (oldIds.length > 1) {
      const firstId = oldIds[0];
      const lastId = oldIds[oldIds.length - 1];

      if (oldest && oldest.id === firstId && firstId === id) {
        const second = messagesLookup[oldIds[1]];
        oldest = second
          ? pick(second, ['id', 'received_at', 'sent_at'])
          : undefined;
      }
      if (newest && newest.id === lastId && lastId === id) {
        const penultimate = messagesLookup[oldIds[oldIds.length - 2]];
        newest = penultimate
          ? pick(penultimate, ['id', 'received_at', 'sent_at'])
          : undefined;
      }
    }

    // Removing it from our caches
    const messageIds = without(existingConversation.messageIds, id);
    const heightChangeMessageIds = without(
      existingConversation.heightChangeMessageIds,
      id
    );

    let metrics;
    if (messageIds.length === 0) {
      metrics = {
        totalUnread: 0,
      };
    } else {
      metrics = {
        ...existingConversation.metrics,
        oldest,
        newest,
      };
    }

    return {
      ...state,
      messagesLookup: omit(messagesLookup, id),
      messagesByConversation: {
        [conversationId]: {
          ...existingConversation,
          messageIds,
          heightChangeMessageIds,
          metrics,
        },
      },
    };
  }

  if (action.type === 'REPAIR_NEWEST_MESSAGE') {
    const { conversationId } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = getOwn(messagesByConversation, conversationId);
    if (!existingConversation) {
      return state;
    }

    const { messageIds } = existingConversation;
    const lastId =
      messageIds && messageIds.length
        ? messageIds[messageIds.length - 1]
        : undefined;
    const last = lastId ? getOwn(messagesLookup, lastId) : undefined;
    const newest = last
      ? pick(last, ['id', 'received_at', 'sent_at'])
      : undefined;

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          metrics: {
            ...existingConversation.metrics,
            newest,
          },
        },
      },
    };
  }

  if (action.type === 'REPAIR_OLDEST_MESSAGE') {
    const { conversationId } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = getOwn(messagesByConversation, conversationId);
    if (!existingConversation) {
      return state;
    }

    const { messageIds } = existingConversation;
    const firstId = messageIds && messageIds.length ? messageIds[0] : undefined;
    const first = firstId ? getOwn(messagesLookup, firstId) : undefined;
    const oldest = first
      ? pick(first, ['id', 'received_at', 'sent_at'])
      : undefined;

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          metrics: {
            ...existingConversation.metrics,
            oldest,
          },
        },
      },
    };
  }

  if (action.type === 'MESSAGES_ADDED') {
    const { conversationId, isActive, isNewMessage, messages } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    if (!existingConversation) {
      return state;
    }

    let {
      newest,
      oldest,
      oldestUnread,
      totalUnread,
    } = existingConversation.metrics;

    if (messages.length < 1) {
      return state;
    }

    const lookup = fromPairs(
      existingConversation.messageIds.map(id => [id, messagesLookup[id]])
    );
    messages.forEach(message => {
      lookup[message.id] = message;
    });

    const sorted = orderBy(
      values(lookup),
      ['received_at', 'sent_at'],
      ['ASC', 'ASC']
    );
    const messageIds = sorted.map(message => message.id);

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!newest) {
      newest = pick(first, ['id', 'received_at', 'sent_at']);
    }
    if (!oldest) {
      oldest = pick(last, ['id', 'received_at', 'sent_at']);
    }

    const existingTotal = existingConversation.messageIds.length;
    if (isNewMessage && existingTotal > 0) {
      const lastMessageId = existingConversation.messageIds[existingTotal - 1];

      // If our messages in memory don't include the most recent messages, then we
      //   won't add new messages to our message list.
      const haveLatest = newest && newest.id === lastMessageId;
      if (!haveLatest) {
        return state;
      }
    }

    // Update oldest and newest if we receive older/newer
    // messages (or duplicated timestamps!)
    if (first && oldest && first.received_at <= oldest.received_at) {
      oldest = pick(first, ['id', 'received_at', 'sent_at']);
    }
    if (last && newest && last.received_at >= newest.received_at) {
      newest = pick(last, ['id', 'received_at', 'sent_at']);
    }

    const newIds = messages.map(message => message.id);
    const newMessageIds = difference(newIds, existingConversation.messageIds);
    const { isNearBottom } = existingConversation;

    if ((!isNearBottom || !isActive) && !oldestUnread) {
      const oldestId = newMessageIds.find(messageId => {
        const message = lookup[messageId];

        return Boolean(message.unread);
      });

      if (oldestId) {
        oldestUnread = pick(lookup[oldestId], [
          'id',
          'received_at',
          'sent_at',
        ]) as MessagePointerType;
      }
    }

    if (oldestUnread) {
      const newUnread: number = newMessageIds.reduce((sum, messageId) => {
        const message = lookup[messageId];

        return sum + (message && message.unread ? 1 : 0);
      }, 0);
      totalUnread = (totalUnread || 0) + newUnread;
    }

    const changedIds = intersection(newIds, existingConversation.messageIds);
    const heightChangeMessageIds = uniq([
      ...changedIds,
      ...existingConversation.heightChangeMessageIds,
    ]);

    return {
      ...state,
      messagesLookup: {
        ...messagesLookup,
        ...lookup,
      },
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isLoadingMessages: false,
          messageIds,
          heightChangeMessageIds,
          scrollToMessageId: undefined,
          metrics: {
            ...existingConversation.metrics,
            newest,
            oldest,
            totalUnread,
            oldestUnread,
          },
        },
      },
    };
  }
  if (action.type === 'CLEAR_SELECTED_MESSAGE') {
    return {
      ...state,
      selectedMessage: undefined,
    };
  }
  if (action.type === 'CLEAR_CHANGED_MESSAGES') {
    const { payload } = action;
    const { conversationId } = payload;
    const existingConversation = state.messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          heightChangeMessageIds: [],
        },
      },
    };
  }
  if (action.type === 'CLEAR_UNREAD_METRICS') {
    const { payload } = action;
    const { conversationId } = payload;
    const existingConversation = state.messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          metrics: {
            ...existingConversation.metrics,
            oldestUnread: undefined,
            totalUnread: 0,
          },
        },
      },
    };
  }
  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      selectedConversationId: id,
    };
  }
  if (action.type === 'SHOW_INBOX') {
    return {
      ...omit(state, 'composer'),
      showArchived: false,
    };
  }
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    return {
      ...omit(state, 'composer'),
      showArchived: true,
    };
  }

  if (action.type === 'SET_CONVERSATION_HEADER_TITLE') {
    return {
      ...state,
      selectedConversationTitle: action.payload.title,
    };
  }

  if (action.type === 'SET_RECENT_MEDIA_ITEMS') {
    const { id, recentMediaItems } = action.payload;
    const { conversationLookup } = state;

    const conversationData = conversationLookup[id];

    if (!conversationData) {
      return state;
    }

    const data = {
      ...conversationData,
      recentMediaItems,
    };

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      ...updateConversationLookups(data, undefined, state),
    };
  }

  if (action.type === 'START_COMPOSING') {
    if (state.composer?.step === ComposerStep.StartDirectConversation) {
      return state;
    }

    return {
      ...state,
      showArchived: false,
      composer: {
        step: ComposerStep.StartDirectConversation,
        contactSearchTerm: '',
      },
    };
  }

  if (action.type === 'SHOW_CHOOSE_GROUP_MEMBERS') {
    let selectedConversationIds: Array<string>;
    let recommendedGroupSizeModalState: OneTimeModalState;
    let maximumGroupSizeModalState: OneTimeModalState;
    let groupName: string;
    let groupAvatar: undefined | ArrayBuffer;

    switch (state.composer?.step) {
      case ComposerStep.ChooseGroupMembers:
        return state;
      case ComposerStep.SetGroupMetadata:
        ({
          selectedConversationIds,
          recommendedGroupSizeModalState,
          maximumGroupSizeModalState,
          groupName,
          groupAvatar,
        } = state.composer);
        break;
      default:
        selectedConversationIds = [];
        recommendedGroupSizeModalState = OneTimeModalState.NeverShown;
        maximumGroupSizeModalState = OneTimeModalState.NeverShown;
        groupName = '';
        break;
    }

    return {
      ...state,
      showArchived: false,
      composer: {
        step: ComposerStep.ChooseGroupMembers,
        contactSearchTerm: '',
        selectedConversationIds,
        cantAddContactIdForModal: undefined,
        recommendedGroupSizeModalState,
        maximumGroupSizeModalState,
        groupName,
        groupAvatar,
      },
    };
  }

  if (action.type === 'START_SETTING_GROUP_METADATA') {
    const { composer } = state;

    switch (composer?.step) {
      case ComposerStep.ChooseGroupMembers:
        return {
          ...state,
          showArchived: false,
          composer: {
            step: ComposerStep.SetGroupMetadata,
            isCreating: false,
            hasError: false,
            ...pick(composer, [
              'groupAvatar',
              'groupName',
              'maximumGroupSizeModalState',
              'recommendedGroupSizeModalState',
              'selectedConversationIds',
            ]),
          },
        };
      case ComposerStep.SetGroupMetadata:
        return state;
      default:
        assert(
          false,
          'Cannot transition to setting group metadata from this state'
        );
        return state;
    }
  }

  if (action.type === 'SET_COMPOSE_GROUP_AVATAR') {
    const { composer } = state;

    switch (composer?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return {
          ...state,
          composer: {
            ...composer,
            groupAvatar: action.payload.groupAvatar,
          },
        };
      default:
        assert(false, 'Setting compose group avatar at this step is a no-op');
        return state;
    }
  }

  if (action.type === 'SET_COMPOSE_GROUP_NAME') {
    const { composer } = state;

    switch (composer?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return {
          ...state,
          composer: {
            ...composer,
            groupName: action.payload.groupName,
          },
        };
      default:
        assert(false, 'Setting compose group name at this step is a no-op');
        return state;
    }
  }

  if (action.type === 'SET_COMPOSE_SEARCH_TERM') {
    const { composer } = state;
    if (!composer) {
      assert(
        false,
        'Setting compose search term with the composer closed is a no-op'
      );
      return state;
    }
    if (composer?.step === ComposerStep.SetGroupMetadata) {
      assert(false, 'Setting compose search term at this step is a no-op');
      return state;
    }

    return {
      ...state,
      composer: {
        ...composer,
        contactSearchTerm: action.payload.contactSearchTerm,
      },
    };
  }

  if (action.type === 'SWITCH_TO_ASSOCIATED_VIEW') {
    const conversation = getOwn(
      state.conversationLookup,
      action.payload.conversationId
    );
    if (!conversation) {
      return state;
    }
    return {
      ...omit(state, 'composer'),
      showArchived: Boolean(conversation.isArchived),
    };
  }

  if (action.type === 'TOGGLE_CONVERSATION_IN_CHOOSE_MEMBERS') {
    const { composer } = state;
    if (composer?.step !== ComposerStep.ChooseGroupMembers) {
      assert(
        false,
        'Toggling conversation members is a no-op in this composer step'
      );
      return state;
    }

    return {
      ...state,
      composer: {
        ...composer,
        ...toggleSelectedContactForGroupAddition(
          action.payload.conversationId,
          {
            maxGroupSize: action.payload.maxGroupSize,
            maxRecommendedGroupSize: action.payload.maxRecommendedGroupSize,
            maximumGroupSizeModalState: composer.maximumGroupSizeModalState,
            // We say you're already in the group, even though it hasn't been created yet.
            numberOfContactsAlreadyInGroup: 1,
            recommendedGroupSizeModalState:
              composer.recommendedGroupSizeModalState,
            selectedConversationIds: composer.selectedConversationIds,
          }
        ),
      },
    };
  }

  return state;
}
