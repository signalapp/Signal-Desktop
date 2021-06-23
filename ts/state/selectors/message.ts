// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber, isObject, map, reduce } from 'lodash';
import filesize from 'filesize';

import {
  LastMessageStatus,
  MessageAttributesType,
  ShallowChallengeError,
  WhatIsThis,
} from '../../model-types.d';

import { TimelineItemType } from '../../components/conversation/TimelineItem';
import { PropsData } from '../../components/conversation/Message';
import { PropsData as TimerNotificationProps } from '../../components/conversation/TimerNotification';
import { PropsData as SafetyNumberNotificationProps } from '../../components/conversation/SafetyNumberNotification';
import { PropsData as VerificationNotificationProps } from '../../components/conversation/VerificationNotification';
import { PropsDataType as GroupsV2Props } from '../../components/conversation/GroupV2Change';
import { PropsDataType as GroupV1MigrationPropsType } from '../../components/conversation/GroupV1Migration';
import { PropsDataType as DeliveryIssuePropsType } from '../../components/conversation/DeliveryIssueNotification';
import {
  PropsData as GroupNotificationProps,
  ChangeType,
} from '../../components/conversation/GroupNotification';
import { PropsType as ProfileChangeNotificationPropsType } from '../../components/conversation/ProfileChangeNotification';
import { QuotedAttachmentType } from '../../components/conversation/Quote';

import { getDomain, isStickerPack } from '../../../js/modules/link_previews';

import { ContactType, contactSelector } from '../../types/Contact';
import { BodyRangesType } from '../../types/Util';
import { LinkPreviewType } from '../../types/message/LinkPreviews';
import { ConversationColors } from '../../types/Colors';
import { CallMode } from '../../types/Calling';
import { AttachmentType, isVoiceMessage } from '../../types/Attachment';

import { CallingNotificationType } from '../../util/callingNotification';
import { missingCaseError } from '../../util/missingCaseError';
import { isNotNil } from '../../util/isNotNil';

import { ConversationType } from '../ducks/conversations';

import { CallSelectorType, CallStateType } from './calling';
import {
  GetConversationByIdType,
  isMissingRequiredProfileSharing,
} from './conversations';

const THREE_HOURS = 3 * 60 * 60 * 1000;

type FormattedContact = Partial<ConversationType> &
  Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'id'
    | 'isMe'
    | 'sharedGroupNames'
    | 'title'
    | 'type'
    | 'unblurredAvatarPath'
  >;
type PropsForMessage = Omit<PropsData, 'interactionMode'>;
type PropsForUnsupportedMessage = {
  canProcessNow: boolean;
  contact: FormattedContact;
};

// Top-level prop generation for the message bubble
export function getPropsForBubble(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined,
  regionCode: string,
  readReceiptSetting: boolean,
  selectedMessageId: string | undefined,
  selectedMessageCounter: number | undefined,
  callSelector: CallSelectorType,
  activeCall: CallStateType | undefined,
  accountSelector: (identifier?: string) => boolean
): TimelineItemType {
  if (isUnsupportedMessage(message)) {
    return {
      type: 'unsupportedMessage',
      data: getPropsForUnsupportedMessage(
        message,
        conversationSelector,
        ourConversationId,
        ourNumber,
        ourUuid
      ),
    };
  }
  if (isGroupV2Change(message)) {
    return {
      type: 'groupV2Change',
      data: getPropsForGroupV2Change(
        message,
        conversationSelector,
        ourConversationId
      ),
    };
  }
  if (isGroupV1Migration(message)) {
    return {
      type: 'groupV1Migration',
      data: getPropsForGroupV1Migration(message, conversationSelector),
    };
  }
  if (isMessageHistoryUnsynced(message)) {
    return {
      type: 'linkNotification',
      data: null,
    };
  }
  if (isExpirationTimerUpdate(message)) {
    return {
      type: 'timerNotification',
      data: getPropsForTimerNotification(
        message,
        conversationSelector,
        ourConversationId
      ),
    };
  }
  if (isKeyChange(message)) {
    return {
      type: 'safetyNumberNotification',
      data: getPropsForSafetyNumberNotification(message, conversationSelector),
    };
  }
  if (isVerifiedChange(message)) {
    return {
      type: 'verificationNotification',
      data: getPropsForVerificationNotification(message, conversationSelector),
    };
  }
  if (isGroupUpdate(message)) {
    return {
      type: 'groupNotification',
      data: getPropsForGroupNotification(
        message,
        conversationSelector,
        ourConversationId,
        ourNumber,
        ourUuid
      ),
    };
  }
  if (isEndSession(message)) {
    return {
      type: 'resetSessionNotification',
      data: null,
    };
  }
  if (isCallHistory(message)) {
    return {
      type: 'callHistory',
      data: getPropsForCallHistory(
        message,
        conversationSelector,
        callSelector,
        activeCall
      ),
    };
  }
  if (isProfileChange(message)) {
    return {
      type: 'profileChange',
      data: getPropsForProfileChange(message, conversationSelector),
    };
  }
  if (isUniversalTimerNotification(message)) {
    return {
      type: 'universalTimerNotification',
      data: null,
    };
  }
  if (isChatSessionRefreshed(message)) {
    return {
      type: 'chatSessionRefreshed',
      data: null,
    };
  }
  if (isDeliveryIssue(message)) {
    return {
      type: 'deliveryIssue',
      data: getPropsForDeliveryIssue(message, conversationSelector),
    };
  }

  return {
    type: 'message',
    data: getPropsForMessage(
      message,
      conversationSelector,
      ourConversationId,
      ourNumber,
      ourUuid,
      selectedMessageId,
      selectedMessageCounter,
      readReceiptSetting,
      regionCode,
      accountSelector
    ),
  };
}

export function isIncoming(message: MessageAttributesType): boolean {
  return message.type === 'incoming';
}

export function isOutgoing(message: MessageAttributesType): boolean {
  return message.type === 'outgoing';
}

export function hasErrors(message: MessageAttributesType): boolean {
  return message.errors ? message.errors.length > 0 : false;
}

export function getSource(
  message: MessageAttributesType,
  ourNumber: string | undefined
): string | undefined {
  if (isIncoming(message)) {
    return message.source;
  }

  return ourNumber;
}

export function getSourceDevice(
  message: MessageAttributesType,
  ourDeviceId: number
): string | number | undefined {
  const { sourceDevice } = message;

  if (isIncoming(message)) {
    return sourceDevice;
  }

  return sourceDevice || ourDeviceId;
}

export function getSourceUuid(
  message: MessageAttributesType,
  ourUuid: string | undefined
): string | undefined {
  if (isIncoming(message)) {
    return message.sourceUuid;
  }

  return ourUuid;
}

export function getContactId(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined
): string | undefined {
  const source = getSource(message, ourNumber);
  const sourceUuid = getSourceUuid(message, ourUuid);

  if (!source && !sourceUuid) {
    return ourConversationId;
  }

  const conversation = conversationSelector(sourceUuid || source);
  return conversation.id;
}

export function getContact(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined
): ConversationType {
  const source = getSource(message, ourNumber);
  const sourceUuid = getSourceUuid(message, ourUuid);

  if (!source && !sourceUuid) {
    return conversationSelector(ourConversationId);
  }

  return conversationSelector(sourceUuid || source);
}

export function getConversation(
  message: Pick<MessageAttributesType, 'conversationId'>,
  conversationSelector: GetConversationByIdType
): ConversationType {
  return conversationSelector(message.conversationId);
}

// Message

export function getPropsForMessage(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined,
  selectedMessageId: string | undefined,
  selectedMessageCounter: number | undefined,
  readReceiptSetting: boolean,
  regionCode: string,
  accountSelector: (identifier?: string) => boolean
): PropsForMessage {
  const contact = getContact(
    message,
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourUuid
  );

  const { expireTimer, expirationStartTimestamp } = message;
  const expirationLength = expireTimer ? expireTimer * 1000 : undefined;
  const expirationTimestamp =
    expirationStartTimestamp && expirationLength
      ? expirationStartTimestamp + expirationLength
      : undefined;

  const conversation = getConversation(message, conversationSelector);
  const isGroup = conversation.type === 'group';
  const { sticker } = message;

  const isMessageTapToView = isTapToView(message);

  const reactions = (message.reactions || []).map(re => {
    const c = conversationSelector(re.fromId);

    return {
      emoji: re.emoji,
      timestamp: re.timestamp,
      from: c,
    };
  });

  const selectedReaction = (
    (message.reactions || []).find(re => re.fromId === ourConversationId) || {}
  ).emoji;

  const isSelected = message.id === selectedMessageId;

  return {
    attachments: getAttachmentsForMessage(message),
    author: contact,
    bodyRanges: processBodyRanges(message.bodyRanges, conversationSelector),
    canDeleteForEveryone: canDeleteForEveryone(message),
    canDownload: canDownload(message, conversationSelector),
    canReply: canReply(message, conversationSelector),
    contact: getPropsForEmbeddedContact(message, regionCode, accountSelector),
    conversationColor: conversation?.conversationColor ?? ConversationColors[0],
    conversationId: message.conversationId,
    conversationType: isGroup ? 'group' : 'direct',
    customColor: conversation?.customColor,
    deletedForEveryone: message.deletedForEveryone || false,
    direction: isIncoming(message) ? 'incoming' : 'outgoing',
    expirationLength,
    expirationTimestamp,
    id: message.id,
    isBlocked: conversation.isBlocked || false,
    isMessageRequestAccepted: conversation?.acceptedMessageRequest ?? true,
    isSelected,
    isSelectedCounter: isSelected ? selectedMessageCounter : undefined,
    isSticker: Boolean(sticker),
    isTapToView: isMessageTapToView,
    isTapToViewError:
      isMessageTapToView && isIncoming(message) && message.isTapToViewInvalid,
    isTapToViewExpired: isMessageTapToView && message.isErased,
    previews: getPropsForPreview(message),
    quote: getPropsForQuote(message, conversationSelector, ourConversationId),
    reactions,
    selectedReaction,
    status: getMessagePropStatus(message, readReceiptSetting),
    text: createNonBreakingLastSeparator(message.body),
    textPending: message.bodyPending,
    timestamp: message.sent_at,
  };
}

export function processBodyRanges(
  bodyRanges: BodyRangesType | undefined,
  conversationSelector: GetConversationByIdType
): BodyRangesType | undefined {
  if (!bodyRanges) {
    return undefined;
  }

  return bodyRanges
    .filter(range => range.mentionUuid)
    .map(range => {
      const conversation = conversationSelector(range.mentionUuid);

      return {
        ...range,
        conversationID: conversation.id,
        replacementText: conversation.title,
      };
    })
    .sort((a, b) => b.start - a.start);
}

// Unsupported Message

export function isUnsupportedMessage(message: MessageAttributesType): boolean {
  const versionAtReceive = message.supportedVersionAtReceive;
  const requiredVersion = message.requiredProtocolVersion;

  return (
    isNumber(versionAtReceive) &&
    isNumber(requiredVersion) &&
    versionAtReceive < requiredVersion
  );
}

function getPropsForUnsupportedMessage(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined
): PropsForUnsupportedMessage {
  const CURRENT_PROTOCOL_VERSION =
    window.textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;

  const requiredVersion = message.requiredProtocolVersion;
  const canProcessNow = Boolean(
    CURRENT_PROTOCOL_VERSION &&
      requiredVersion &&
      CURRENT_PROTOCOL_VERSION >= requiredVersion
  );

  return {
    canProcessNow,
    contact: getContact(
      message,
      conversationSelector,
      ourConversationId,
      ourNumber,
      ourUuid
    ),
  };
}

// GroupV2 Change

export function isGroupV2Change(message: MessageAttributesType): boolean {
  return Boolean(message.groupV2Change);
}

function getPropsForGroupV2Change(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string
): GroupsV2Props {
  const AccessControlEnum =
    window.textsecure.protobuf.AccessControl.AccessRequired;
  const RoleEnum = window.textsecure.protobuf.Member.Role;
  const change = message.groupV2Change;

  if (!change) {
    throw new Error('getPropsForGroupV2Change: Change is missing!');
  }

  const conversation = getConversation(message, conversationSelector);

  return {
    groupName: conversation?.type === 'group' ? conversation?.name : undefined,
    AccessControlEnum,
    RoleEnum,
    ourConversationId,
    change,
  };
}

// GroupV1 Migration

export function isGroupV1Migration(message: MessageAttributesType): boolean {
  return message.type === 'group-v1-migration';
}

function getPropsForGroupV1Migration(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): GroupV1MigrationPropsType {
  const migration = message.groupMigration;
  if (!migration) {
    // Backwards-compatibility with data schema in early betas
    const invitedGV2Members = message.invitedGV2Members || [];
    const droppedGV2MemberIds = message.droppedGV2MemberIds || [];

    const invitedMembers = invitedGV2Members.map(item =>
      conversationSelector(item.conversationId)
    );
    const droppedMembers = droppedGV2MemberIds.map(conversationId =>
      conversationSelector(conversationId)
    );

    return {
      areWeInvited: false,
      droppedMembers,
      invitedMembers,
    };
  }

  const {
    areWeInvited,
    droppedMemberIds,
    invitedMembers: rawInvitedMembers,
  } = migration;
  const invitedMembers = rawInvitedMembers.map(item =>
    conversationSelector(item.conversationId)
  );
  const droppedMembers = droppedMemberIds.map(conversationId =>
    conversationSelector(conversationId)
  );

  return {
    areWeInvited,
    droppedMembers,
    invitedMembers,
  };
}

// Message History Unsynced

export function isMessageHistoryUnsynced(
  message: MessageAttributesType
): boolean {
  return message.type === 'message-history-unsynced';
}

// Note: props are null!

// Expiration Timer Update

export function isExpirationTimerUpdate(
  message: MessageAttributesType
): boolean {
  const flag =
    window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
  // eslint-disable-next-line no-bitwise
  return Boolean(message.flags && message.flags & flag);
}

function getPropsForTimerNotification(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string
): TimerNotificationProps {
  const timerUpdate = message.expirationTimerUpdate;
  if (!timerUpdate) {
    throw new Error(
      'getPropsForTimerNotification: missing expirationTimerUpdate!'
    );
  }

  const { expireTimer, fromSync, source, sourceUuid } = timerUpdate;
  const disabled = !expireTimer;
  const sourceId = sourceUuid || source;
  const formattedContact = conversationSelector(sourceId);

  const basicProps = {
    ...formattedContact,
    disabled,
    expireTimer,
    type: 'fromOther' as const,
  };

  if (fromSync) {
    return {
      ...basicProps,
      type: 'fromSync' as const,
    };
  }
  if (formattedContact.id === ourConversationId) {
    return {
      ...basicProps,
      type: 'fromMe' as const,
    };
  }
  if (!sourceId) {
    return {
      ...basicProps,
      type: 'fromMember' as const,
    };
  }

  return basicProps;
}

// Key Change

export function isKeyChange(message: MessageAttributesType): boolean {
  return message.type === 'keychange';
}

function getPropsForSafetyNumberNotification(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): SafetyNumberNotificationProps {
  const conversation = getConversation(message, conversationSelector);
  const isGroup = conversation?.type === 'group';
  const identifier = message.key_changed;
  const contact = conversationSelector(identifier);

  return {
    isGroup,
    contact,
  };
}

// Verified Change

export function isVerifiedChange(message: MessageAttributesType): boolean {
  return message.type === 'verified-change';
}

function getPropsForVerificationNotification(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): VerificationNotificationProps {
  const type = message.verified ? 'markVerified' : 'markNotVerified';
  const isLocal = message.local || false;
  const identifier = message.verifiedChanged;

  return {
    type,
    isLocal,
    contact: conversationSelector(identifier),
  };
}

// Group Update (V1)

export function isGroupUpdate(message: MessageAttributesType): boolean {
  return Boolean(message.group_update);
}

function getPropsForGroupNotification(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string,
  ourNumber: string | undefined,
  ourUuid: string | undefined
): GroupNotificationProps {
  const groupUpdate = message.group_update;
  if (!groupUpdate) {
    throw new Error(
      'getPropsForGroupNotification: Message missing group_update'
    );
  }

  const changes = [];

  if (
    !groupUpdate.avatarUpdated &&
    !groupUpdate.left &&
    !groupUpdate.joined &&
    !groupUpdate.name
  ) {
    changes.push({
      type: 'general' as ChangeType,
    });
  }

  if (groupUpdate.joined?.length) {
    changes.push({
      type: 'add' as ChangeType,
      contacts: map(
        Array.isArray(groupUpdate.joined)
          ? groupUpdate.joined
          : [groupUpdate.joined],
        identifier => conversationSelector(identifier)
      ),
    });
  }

  if (groupUpdate.left === 'You') {
    changes.push({
      type: 'remove' as ChangeType,
    });
  } else if (groupUpdate.left) {
    changes.push({
      type: 'remove' as ChangeType,
      contacts: map(
        Array.isArray(groupUpdate.left) ? groupUpdate.left : [groupUpdate.left],
        identifier => conversationSelector(identifier)
      ),
    });
  }

  if (groupUpdate.name) {
    changes.push({
      type: 'name' as ChangeType,
      newName: groupUpdate.name,
    });
  }

  if (groupUpdate.avatarUpdated) {
    changes.push({
      type: 'avatar' as ChangeType,
    });
  }

  const from = getContact(
    message,
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourUuid
  );

  return {
    from,
    changes,
  };
}

// End Session

export function isEndSession(message: MessageAttributesType): boolean {
  const flag = window.textsecure.protobuf.DataMessage.Flags.END_SESSION;
  // eslint-disable-next-line no-bitwise
  return Boolean(message.flags && message.flags & flag);
}

// Call History

export function isCallHistory(message: MessageAttributesType): boolean {
  return message.type === 'call-history';
}

export function getPropsForCallHistory(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType,
  callSelector: CallSelectorType,
  activeCall: CallStateType | undefined
): CallingNotificationType {
  const { callHistoryDetails } = message;
  if (!callHistoryDetails) {
    throw new Error('getPropsForCallHistory: Missing callHistoryDetails');
  }

  switch (callHistoryDetails.callMode) {
    // Old messages weren't saved with a call mode.
    case undefined:
    case CallMode.Direct:
      return {
        ...callHistoryDetails,
        callMode: CallMode.Direct,
      };
    case CallMode.Group: {
      const { conversationId } = message;
      if (!conversationId) {
        throw new Error('getPropsForCallHistory: missing conversation ID');
      }

      const creator = conversationSelector(callHistoryDetails.creatorUuid);
      let call = callSelector(conversationId);
      if (call && call.callMode !== CallMode.Group) {
        window.log.error(
          'getPropsForCallHistory: there is an unexpected non-group call; pretending it does not exist'
        );
        call = undefined;
      }

      return {
        activeCallConversationId: activeCall?.conversationId,
        callMode: CallMode.Group,
        conversationId,
        creator,
        deviceCount: call?.peekInfo.deviceCount ?? 0,
        ended: callHistoryDetails.eraId !== call?.peekInfo.eraId,
        maxDevices: call?.peekInfo.maxDevices ?? Infinity,
        startedTime: callHistoryDetails.startedTime,
      };
    }
    default:
      throw new Error(
        `getPropsForCallHistory: missing case ${missingCaseError(
          callHistoryDetails
        )}`
      );
  }
}

// Profile Change

export function isProfileChange(message: MessageAttributesType): boolean {
  return message.type === 'profile-change';
}

function getPropsForProfileChange(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): ProfileChangeNotificationPropsType {
  const change = message.profileChange;
  const { changedId } = message;
  const changedContact = conversationSelector(changedId);

  if (!change) {
    throw new Error('getPropsForProfileChange: profileChange is undefined');
  }

  return {
    changedContact,
    change,
  } as ProfileChangeNotificationPropsType;
}

// Universal Timer Notification

// Note: smart, so props not generated here

export function isUniversalTimerNotification(
  message: MessageAttributesType
): boolean {
  return message.type === 'universal-timer-notification';
}

// Chat Session Refreshed

export function isChatSessionRefreshed(
  message: MessageAttributesType
): boolean {
  return message.type === 'chat-session-refreshed';
}

// Note: props are null

// Delivery Issue

export function isDeliveryIssue(message: MessageAttributesType): boolean {
  return message.type === 'delivery-issue';
}

function getPropsForDeliveryIssue(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): DeliveryIssuePropsType {
  const sender = conversationSelector(message.sourceUuid);

  return {
    sender,
  };
}

// Other utility functions

export function isTapToView(message: MessageAttributesType): boolean {
  // If a message is deleted for everyone, that overrides all other styling
  if (message.deletedForEveryone) {
    return false;
  }

  return Boolean(message.isViewOnce || message.messageTimer);
}

function createNonBreakingLastSeparator(text?: string): string {
  if (!text) {
    return '';
  }

  const nbsp = '\xa0';
  const regex = /(\S)( +)(\S+\s*)$/;
  return text.replace(regex, (_match, start, spaces, end) => {
    const newSpaces =
      end.length < 12
        ? reduce(spaces, accumulator => accumulator + nbsp, '')
        : spaces;
    return `${start}${newSpaces}${end}`;
  });
}

export function getMessagePropStatus(
  message: MessageAttributesType,
  readReceiptSetting: boolean
): LastMessageStatus | undefined {
  const { sent } = message;
  const sentTo = message.sent_to || [];

  if (hasErrors(message)) {
    if (getLastChallengeError(message)) {
      return 'paused';
    }
    if (sent || sentTo.length > 0) {
      return 'partial-sent';
    }
    return 'error';
  }
  if (!isOutgoing(message)) {
    return undefined;
  }

  const readBy = message.read_by || [];
  if (readReceiptSetting && readBy.length > 0) {
    return 'read';
  }
  const { delivered } = message;
  const deliveredTo = message.delivered_to || [];
  if (delivered || deliveredTo.length > 0) {
    return 'delivered';
  }
  if (sent || sentTo.length > 0) {
    return 'sent';
  }

  return 'sending';
}

export function getPropsForEmbeddedContact(
  message: MessageAttributesType,
  regionCode: string,
  accountSelector: (identifier?: string) => boolean
): ContactType | undefined {
  const contacts = message.contact;
  if (!contacts || !contacts.length) {
    return undefined;
  }

  const firstContact = contacts[0];
  const numbers = firstContact?.number;
  const firstNumber = numbers && numbers[0] ? numbers[0].value : undefined;

  return contactSelector(firstContact, {
    regionCode,
    getAbsoluteAttachmentPath:
      window.Signal.Migrations.getAbsoluteAttachmentPath,
    firstNumber,
    isNumberOnSignal: accountSelector(firstNumber),
  });
}

export function getPropsForAttachment(
  attachment: WhatIsThis
): AttachmentType | null {
  if (!attachment) {
    return null;
  }

  const { path, pending, size, screenshot, thumbnail } = attachment;

  return {
    ...attachment,
    fileSize: size ? filesize(size) : null,
    isVoiceMessage: isVoiceMessage(attachment),
    pending,
    url: path ? window.Signal.Migrations.getAbsoluteAttachmentPath(path) : null,
    screenshot: screenshot
      ? {
          ...screenshot,
          url: window.Signal.Migrations.getAbsoluteAttachmentPath(
            screenshot.path
          ),
        }
      : null,
    thumbnail: thumbnail
      ? {
          ...thumbnail,
          url: window.Signal.Migrations.getAbsoluteAttachmentPath(
            thumbnail.path
          ),
        }
      : null,
  };
}

function getPropsForPreview(
  message: MessageAttributesType
): Array<LinkPreviewType> {
  const previews = message.preview || [];

  return previews.map(preview => ({
    ...preview,
    isStickerPack: isStickerPack(preview.url),
    domain: getDomain(preview.url),
    image: preview.image ? getPropsForAttachment(preview.image) : null,
  }));
}

export function getPropsForQuote(
  message: Pick<MessageAttributesType, 'conversationId' | 'quote'>,
  conversationSelector: GetConversationByIdType,
  ourConversationId: string | undefined
): PropsData['quote'] {
  const { quote } = message;
  if (!quote) {
    return undefined;
  }

  const {
    author,
    authorUuid,
    bodyRanges,
    id: sentAt,
    isViewOnce,
    referencedMessageNotFound,
    text,
  } = quote;

  const contact = conversationSelector(authorUuid || author);

  const authorId = contact.id;
  const authorName = contact.name;
  const authorPhoneNumber = contact.phoneNumber;
  const authorProfileName = contact.profileName;
  const authorTitle = contact.title;
  const isFromMe = authorId === ourConversationId;

  const firstAttachment = quote.attachments && quote.attachments[0];
  const conversation = getConversation(message, conversationSelector);

  return {
    authorId,
    authorName,
    authorPhoneNumber,
    authorProfileName,
    authorTitle,
    bodyRanges: processBodyRanges(bodyRanges, conversationSelector),
    conversationColor: conversation.conversationColor ?? ConversationColors[0],
    customColor: conversation.customColor,
    isFromMe,
    rawAttachment: firstAttachment
      ? processQuoteAttachment(firstAttachment)
      : undefined,
    isViewOnce,
    referencedMessageNotFound,
    sentAt: Number(sentAt),
    text: createNonBreakingLastSeparator(text),
  };
}

function processQuoteAttachment(
  attachment: AttachmentType
): QuotedAttachmentType {
  const { thumbnail } = attachment;
  const path =
    thumbnail &&
    thumbnail.path &&
    window.Signal.Migrations.getAbsoluteAttachmentPath(thumbnail.path);
  const objectUrl = thumbnail && thumbnail.objectUrl;

  const thumbnailWithObjectUrl =
    (!path && !objectUrl) || !thumbnail
      ? undefined
      : { ...thumbnail, objectUrl: path || objectUrl };

  return {
    ...attachment,
    isVoiceMessage: isVoiceMessage(attachment),
    thumbnail: thumbnailWithObjectUrl,
  };
}

export function canReply(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): boolean {
  const conversation = getConversation(message, conversationSelector);
  const { delivered, errors } = message;

  if (!conversation) {
    return false;
  }

  // If GroupV1 groups have been disabled, we can't reply.
  if (conversation.isGroupV1AndDisabled) {
    return false;
  }

  // If mandatory profile sharing is enabled, and we haven't shared yet, then
  //   we can't reply.
  if (isMissingRequiredProfileSharing(conversation)) {
    return false;
  }

  // We cannot reply if we haven't accepted the message request
  if (!conversation.acceptedMessageRequest) {
    return false;
  }

  // We cannot reply if this message is deleted for everyone
  if (message.deletedForEveryone) {
    return false;
  }

  // We can reply if this is outgoing and delivered to at least one recipient
  if (isOutgoing(message) && delivered && delivered > 0) {
    return true;
  }

  // We can reply if there are no errors
  if (!errors || (errors && errors.length === 0)) {
    return true;
  }

  // Fail safe.
  return false;
}

export function canDeleteForEveryone(message: MessageAttributesType): boolean {
  // is someone else's message
  if (isIncoming(message)) {
    return false;
  }

  // has already been deleted for everyone
  if (message.deletedForEveryone) {
    return false;
  }

  // is too old to delete
  if (Date.now() - message.sent_at > THREE_HOURS) {
    return false;
  }

  return true;
}

export function canDownload(
  message: MessageAttributesType,
  conversationSelector: GetConversationByIdType
): boolean {
  if (isOutgoing(message)) {
    return true;
  }

  const conversation = getConversation(message, conversationSelector);
  const isAccepted = Boolean(
    conversation && conversation.acceptedMessageRequest
  );
  if (!isAccepted) {
    return false;
  }

  // Ensure that all attachments are downloadable
  const { attachments } = message;
  if (attachments && attachments.length) {
    return attachments.every(attachment => Boolean(attachment.path));
  }

  return true;
}

export function getAttachmentsForMessage(
  message: MessageAttributesType
): Array<AttachmentType> {
  const { sticker } = message;
  if (sticker && sticker.data) {
    const { data } = sticker;

    // We don't show anything if we don't have the sticker or the blurhash...
    if (!data.blurHash && (data.pending || !data.path)) {
      return [];
    }

    return [
      {
        ...data,
        // We want to show the blurhash for stickers, not the spinner
        pending: false,
        url: data.path
          ? window.Signal.Migrations.getAbsoluteAttachmentPath(data.path)
          : undefined,
      },
    ];
  }

  const attachments = message.attachments || [];
  return attachments
    .filter(attachment => !attachment.error)
    .map(attachment => getPropsForAttachment(attachment))
    .filter(isNotNil);
}

export function getLastChallengeError(
  message: MessageAttributesType
): ShallowChallengeError | undefined {
  const { errors } = message;
  if (!errors) {
    return undefined;
  }

  const challengeErrors = errors
    .filter((error): error is ShallowChallengeError => {
      return (
        error.name === 'SendMessageChallengeError' &&
        isNumber(error.retryAfter) &&
        isObject(error.data)
      );
    })
    .sort((a, b) => a.retryAfter - b.retryAfter);

  return challengeErrors.pop();
}
