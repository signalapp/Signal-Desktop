// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { groupBy, isEmpty, isNumber, isObject, map } from 'lodash';
import { createSelector } from 'reselect';
import getDirection from 'direction';
import emojiRegex from 'emoji-regex';
import LinkifyIt from 'linkify-it';
import type { ReadonlyDeep } from 'type-fest';

import type { StateType } from '../reducer';
import type {
  LastMessageStatus,
  ReadonlyMessageAttributesType,
  MessageReactionType,
  QuotedAttachmentType,
  ShallowChallengeError,
} from '../../model-types.d';

import type {
  Contact as SmartMessageDetailContact,
  OwnProps as SmartMessageDetailPropsType,
} from '../smart/MessageDetail';
import type { TimelineItemType } from '../../components/conversation/TimelineItem';
import type { PropsData } from '../../components/conversation/Message';
import type { PropsData as TimelineMessagePropsData } from '../../components/conversation/TimelineMessage';
import { TextDirection } from '../../components/conversation/Message';
import type { PropsData as TimerNotificationProps } from '../../components/conversation/TimerNotification';
import type { PropsData as ChangeNumberNotificationProps } from '../../components/conversation/ChangeNumberNotification';
import type { PropsData as JoinedSignalNotificationProps } from '../../components/conversation/JoinedSignalNotification';
import type { PropsData as SafetyNumberNotificationProps } from '../../components/conversation/SafetyNumberNotification';
import type { PropsData as VerificationNotificationProps } from '../../components/conversation/VerificationNotification';
import type { PropsData as TitleTransitionNotificationProps } from '../../components/conversation/TitleTransitionNotification';
import type { PropsDataType as GroupsV2Props } from '../../components/conversation/GroupV2Change';
import type { PropsDataType as GroupV1MigrationPropsType } from '../../components/conversation/GroupV1Migration';
import type { PropsDataType as DeliveryIssuePropsType } from '../../components/conversation/DeliveryIssueNotification';
import type { PropsType as PaymentEventNotificationPropsType } from '../../components/conversation/PaymentEventNotification';
import type { PropsDataType as ConversationMergePropsType } from '../../components/conversation/ConversationMergeNotification';
import type { PropsDataType as PhoneNumberDiscoveryPropsType } from '../../components/conversation/PhoneNumberDiscoveryNotification';
import type {
  PropsData as GroupNotificationProps,
  ChangeType,
} from '../../components/conversation/GroupNotification';
import type { PropsType as ProfileChangeNotificationPropsType } from '../../components/conversation/ProfileChangeNotification';

import {
  getSafeDomain,
  isCallLink,
  isStickerPack,
} from '../../types/LinkPreview';
import type {
  AciString,
  PniString,
  ServiceIdString,
} from '../../types/ServiceId';

import type { EmbeddedContactType } from '../../types/EmbeddedContact';
import { embeddedContactSelector } from '../../types/EmbeddedContact';
import type { HydratedBodyRangesType } from '../../types/BodyRange';
import { hydrateRanges } from '../../types/BodyRange';
import type { AssertProps } from '../../types/Util';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { getMentionsRegex } from '../../types/Message';
import { SignalService as Proto } from '../../protobuf';
import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment';
import { isVoiceMessage, defaultBlurHash } from '../../types/Attachment';
import { type DefaultConversationColorType } from '../../types/Colors';
import { ReadStatus } from '../../messages/MessageReadStatus';

import type { CallingNotificationType } from '../../util/callingNotification';
import { getRecipients } from '../../util/getRecipients';
import { getOwn } from '../../util/getOwn';
import { isNotNil } from '../../util/isNotNil';
import { isMoreRecentThan } from '../../util/timestamp';
import * as iterables from '../../util/iterables';
import { strictAssert } from '../../util/assert';
import { canEditMessage } from '../../util/canEditMessage';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl';

import { getAccountSelector } from './accounts';
import { getDefaultConversationColor } from './items';
import {
  getConversationSelector,
  getSelectedMessageIds,
  getTargetedMessage,
  isMissingRequiredProfileSharing,
  getMessages,
  getCachedConversationMemberColorsSelector,
  getContactNameColor,
} from './conversations';
import {
  getIntl,
  getRegionCode,
  getUserACI,
  getUserPNI,
  getUserConversationId,
  getUserNumber,
} from './user';

import type {
  ConversationType,
  MessageWithUIFieldsType,
} from '../ducks/conversations';

import type { AccountSelectorType } from './accounts';
import type { CallSelectorType, CallStateType } from './calling';
import type { GetConversationByIdType } from './conversations';
import {
  SendStatus,
  isDelivered,
  isFailed,
  isRead,
  isSent,
  isViewed,
  isMessageJustForMe,
  someRecipientSendStatus,
  getHighestSuccessfulRecipientStatus,
  someSendStatus,
} from '../../messages/MessageSendState';
import * as log from '../../logging/log';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes';
import { DAY, DurationInSeconds } from '../../util/durations';
import { getStoryReplyText } from '../../util/getStoryReplyText';
import type { MessageAttributesWithPaymentEvent } from '../../messages/helpers';
import {
  isIncoming,
  isOutgoing,
  messageHasPaymentEvent,
  isStory,
} from '../../messages/helpers';

import { calculateExpirationTimestamp } from '../../util/expirationTimer';
import { isSignalConversation } from '../../util/isSignalConversation';
import type { AnyPaymentEvent } from '../../types/Payment';
import { isPaymentNotificationEvent } from '../../types/Payment';
import {
  getTitleNoDefault,
  getTitle,
  getNumber,
  renderNumber,
} from '../../util/getTitle';
import { getMessageSentTimestamp } from '../../util/getMessageSentTimestamp';
import type { CallHistorySelectorType } from './callHistory';
import { CallMode, CallDirection } from '../../types/CallDisposition';
import { getCallIdFromEra } from '../../util/callDisposition';
import { LONG_MESSAGE } from '../../types/MIME';
import type { MessageRequestResponseNotificationData } from '../../components/conversation/MessageRequestResponseNotification';

export { isIncoming, isOutgoing, isStory };

const linkify = new LinkifyIt();

type FormattedContact = Partial<ConversationType> &
  Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'id'
    | 'isMe'
    | 'sharedGroupNames'
    | 'title'
    | 'type'
    | 'unblurredAvatarUrl'
  >;
export type PropsForMessage = Omit<TimelineMessagePropsData, 'interactionMode'>;
export type MessagePropsType = Omit<
  PropsForMessage,
  'renderingContext' | 'menu' | 'contextMenu'
>;
type PropsForUnsupportedMessage = {
  canProcessNow: boolean;
  contact: FormattedContact;
};

export type GetPropsForBubbleOptions = Readonly<{
  conversationSelector: GetConversationByIdType;
  ourConversationId?: string;
  ourNumber?: string;
  ourAci: AciString | undefined;
  ourPni: PniString | undefined;
  targetedMessageId?: string;
  targetedMessageCounter?: number;
  selectedMessageIds: ReadonlyArray<string> | undefined;
  regionCode?: string;
  callSelector: CallSelectorType;
  callHistorySelector: CallHistorySelectorType;
  activeCall?: CallStateType;
  accountSelector: AccountSelectorType;
  contactNameColors: Map<string, string>;
  defaultConversationColor: DefaultConversationColorType;
}>;

export function hasErrors(
  message: Pick<MessageWithUIFieldsType, 'errors'>
): boolean {
  return message.errors ? message.errors.length > 0 : false;
}

export function getSource(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'source'>,
  ourNumber: string | undefined
): string | undefined {
  if (isIncoming(message)) {
    return message.source;
  }
  if (!isOutgoing(message)) {
    log.warn('message.getSource: Called for non-incoming/non-outoing message');
  }

  return ourNumber;
}

export function getSourceDevice(
  message: MessageWithUIFieldsType,
  ourDeviceId: number
): string | number | undefined {
  const { sourceDevice } = message;

  if (isIncoming(message)) {
    return sourceDevice;
  }
  if (!isOutgoing(message)) {
    log.warn(
      'message.getSourceDevice: Called for non-incoming/non-outoing message'
    );
  }

  return sourceDevice || ourDeviceId;
}

export function getSourceServiceId(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceServiceId'>,
  ourAci: AciString | undefined
): ServiceIdString | undefined {
  if (isIncoming(message)) {
    return message.sourceServiceId;
  }
  if (!isOutgoing(message)) {
    log.warn(
      'message.getSourceServiceId: Called for non-incoming/non-outoing message'
    );
  }

  return ourAci;
}

export type GetContactOptions = Pick<
  GetPropsForBubbleOptions,
  'conversationSelector' | 'ourConversationId' | 'ourNumber' | 'ourAci'
>;

export function getAuthorId(
  message: MessageWithUIFieldsType,
  {
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourAci,
  }: GetContactOptions
): string | undefined {
  const source = getSource(message, ourNumber);
  const sourceServiceId = getSourceServiceId(message, ourAci);

  if (!source && !sourceServiceId) {
    return ourConversationId;
  }

  const conversation = conversationSelector(sourceServiceId || source);
  return conversation.id;
}

// TODO: DESKTOP-2145
export function getContact(
  message: MessageWithUIFieldsType,
  {
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourAci,
  }: GetContactOptions
): ConversationType {
  const source = getSource(message, ourNumber);
  const sourceServiceId = getSourceServiceId(message, ourAci);

  if (!source && !sourceServiceId) {
    return conversationSelector(ourConversationId);
  }

  return conversationSelector(sourceServiceId || source);
}

export function getConversation(
  message: Pick<MessageWithUIFieldsType, 'conversationId'>,
  conversationSelector: GetConversationByIdType
): ConversationType {
  return conversationSelector(message.conversationId);
}

// Message

export const getAttachmentsForMessage = ({
  sticker,
  attachments = [],
}: MessageWithUIFieldsType): Array<AttachmentType> => {
  if (sticker && sticker.data) {
    const { data } = sticker;

    return [
      {
        ...data,
        // We want to show the blurhash for stickers, not the spinner
        pending: false,
        // Stickers are not guaranteed to have a blurhash (e.g. if imported but
        // undownloaded from backup), so we want to make sure we have something to show
        blurHash: data.blurHash ?? defaultBlurHash(),
        url: data.path ? getLocalAttachmentUrl(data) : undefined,
      },
    ];
  }
  return (
    attachments
      // Long message attachments are removed from message.attachments quickly,
      // but in case they are still around, let's make sure not to show them
      .filter(attachment => attachment.contentType !== LONG_MESSAGE)
      .map(attachment => getPropsForAttachment(attachment))
      .filter(isNotNil)
  );
};

export const processBodyRanges = (
  { bodyRanges }: Pick<MessageWithUIFieldsType, 'bodyRanges'>,
  options: { conversationSelector: GetConversationByIdType }
): HydratedBodyRangesType | undefined => {
  if (!bodyRanges) {
    return undefined;
  }

  return hydrateRanges(bodyRanges, options.conversationSelector)?.sort(
    (a, b) => b.start - a.start
  );
};

const getAuthorForMessage = (
  message: MessageWithUIFieldsType,
  options: GetContactOptions
): PropsData['author'] => {
  const {
    acceptedMessageRequest,
    avatarUrl,
    badges,
    color,
    id,
    isMe,
    name,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
    unblurredAvatarUrl,
  } = getContact(message, options);

  const unsafe = {
    acceptedMessageRequest,
    avatarUrl,
    badges,
    color,
    id,
    isMe,
    name,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
    unblurredAvatarUrl,
  };

  const safe: AssertProps<PropsData['author'], typeof unsafe> = unsafe;

  return safe;
};

const getPreviewsForMessage = ({
  preview: previews = [],
}: MessageWithUIFieldsType): Array<LinkPreviewType> => {
  return previews.map(preview => ({
    ...preview,
    isStickerPack: isStickerPack(preview.url),
    isCallLink: isCallLink(preview.url),
    domain: getSafeDomain(preview.url),
    image: preview.image ? getPropsForAttachment(preview.image) : undefined,
  }));
};

const getReactionsForMessage = (
  { reactions = [] }: MessageWithUIFieldsType,
  { conversationSelector }: { conversationSelector: GetConversationByIdType }
) => {
  const reactionBySender = new Map<string, MessageReactionType>();
  for (const reaction of reactions) {
    const existingReaction = reactionBySender.get(reaction.fromId);
    if (!existingReaction || reaction.timestamp > existingReaction.timestamp) {
      reactionBySender.set(reaction.fromId, reaction);
    }
  }

  const reactionsWithEmpties = reactionBySender.values();
  const reactionsWithEmoji = iterables.filter(
    reactionsWithEmpties,
    re => re.emoji
  );
  const formattedReactions = iterables.map(reactionsWithEmoji, re => {
    const c = conversationSelector(re.fromId);

    type From = NonNullable<PropsData['reactions']>[0]['from'];

    const {
      acceptedMessageRequest,
      avatarUrl,
      badges,
      color,
      id,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
    } = c;

    const unsafe = {
      acceptedMessageRequest,
      avatarUrl,
      badges,
      color,
      id,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
    };

    const from: AssertProps<From, typeof unsafe> = unsafe;

    strictAssert(re.emoji, 'Expected all reactions to have an emoji');

    return {
      emoji: re.emoji,
      timestamp: re.timestamp,
      from,
    };
  });

  return [...formattedReactions];
};

const getPropsForStoryReplyContext = (
  message: Pick<
    MessageWithUIFieldsType,
    'body' | 'conversationId' | 'storyReaction' | 'storyReplyContext'
  >,
  {
    conversationSelector,
    ourConversationId,
    defaultConversationColor,
  }: {
    conversationSelector: GetConversationByIdType;
    ourConversationId?: string;
    defaultConversationColor: DefaultConversationColorType;
  }
): PropsData['storyReplyContext'] => {
  const { storyReaction, storyReplyContext } = message;
  if (!storyReplyContext) {
    return undefined;
  }

  const contact = conversationSelector(storyReplyContext.authorAci);

  const authorTitle = contact.firstName || contact.title;
  const isFromMe = contact.id === ourConversationId;

  const conversation = getConversation(message, conversationSelector);

  const { conversationColor, customColor } = getConversationColorAttributes(
    conversation,
    defaultConversationColor
  );

  return {
    authorTitle,
    conversationColor,
    customColor,
    emoji: storyReaction?.emoji,
    isFromMe,
    rawAttachment: storyReplyContext.attachment
      ? processQuoteAttachment(storyReplyContext.attachment)
      : undefined,
    storyId: storyReplyContext.messageId,
    text: getStoryReplyText(window.i18n, storyReplyContext.attachment),
  };
};

export const getPropsForQuote = (
  message: ReadonlyDeep<
    Pick<MessageWithUIFieldsType, 'conversationId' | 'quote'>
  >,
  {
    conversationSelector,
    ourConversationId,
    defaultConversationColor,
  }: {
    conversationSelector: GetConversationByIdType;
    ourConversationId?: string;
    defaultConversationColor: DefaultConversationColorType;
  }
): PropsData['quote'] => {
  const { quote } = message;
  if (!quote) {
    return undefined;
  }

  const {
    author,
    authorAci,
    id: sentAt,
    isViewOnce,
    isGiftBadge: isTargetGiftBadge,
    referencedMessageNotFound,
    payment,
    text = '',
  } = quote;

  const contact = conversationSelector(authorAci || author);

  const authorId = contact.id;
  const authorName = contact.name;
  const authorPhoneNumber = contact.phoneNumber;
  const authorProfileName = contact.profileName;
  const authorTitle = contact.title;
  const isFromMe = authorId === ourConversationId;

  const firstAttachment = quote.attachments && quote.attachments[0];
  const conversation = getConversation(message, conversationSelector);

  const { conversationColor, customColor } = getConversationColorAttributes(
    conversation,
    defaultConversationColor
  );

  return {
    authorId,
    authorName,
    authorPhoneNumber,
    authorProfileName,
    authorTitle,
    bodyRanges: processBodyRanges(quote, { conversationSelector }),
    conversationColor,
    conversationTitle: conversation.title,
    customColor,
    isFromMe,
    rawAttachment: firstAttachment
      ? processQuoteAttachment(firstAttachment)
      : undefined,
    payment,
    isGiftBadge: Boolean(isTargetGiftBadge),
    isViewOnce,
    referencedMessageNotFound,
    sentAt: Number(sentAt),
    text,
  };
};

export type GetPropsForMessageOptions = Pick<
  GetPropsForBubbleOptions,
  | 'activeCall'
  | 'conversationSelector'
  | 'ourConversationId'
  | 'ourAci'
  | 'ourPni'
  | 'ourNumber'
  | 'targetedMessageId'
  | 'targetedMessageCounter'
  | 'selectedMessageIds'
  | 'regionCode'
  | 'accountSelector'
  | 'contactNameColors'
  | 'defaultConversationColor'
>;

function getTextAttachment(
  message: MessageWithUIFieldsType
): AttachmentType | undefined {
  return (
    message.bodyAttachment && getPropsForAttachment(message.bodyAttachment)
  );
}

function getPayment(
  message: MessageWithUIFieldsType
): AnyPaymentEvent | undefined {
  return message.payment;
}

export function cleanBodyForDirectionCheck(text: string): string {
  const MENTIONS_REGEX = getMentionsRegex();
  const EMOJI_REGEX = emojiRegex();
  const initial = text.replace(MENTIONS_REGEX, '').replace(EMOJI_REGEX, '');

  const linkMatches = linkify.match(initial);

  if (!linkMatches || linkMatches.length === 0) {
    return initial;
  }

  let result = '';
  let lastIndex = 0;

  linkMatches.forEach(match => {
    if (lastIndex < match.index) {
      result += initial.slice(lastIndex, match.index);
    }

    // drop the actual contents of the match

    lastIndex = match.lastIndex;
  });

  if (lastIndex < initial.length) {
    result += initial.slice(lastIndex);
  }

  return result;
}

function getTextDirection(body?: string): TextDirection {
  if (!body) {
    return TextDirection.None;
  }

  const cleaned = cleanBodyForDirectionCheck(body);
  const direction = getDirection(cleaned);
  switch (direction) {
    case 'ltr':
      return TextDirection.LeftToRight;
    case 'rtl':
      return TextDirection.RightToLeft;
    case 'neutral':
      return TextDirection.Default;
    default: {
      const unexpected: never = direction;
      log.warn(`getTextDirection: unexpected direction ${unexpected}`);
      return TextDirection.None;
    }
  }
}

export const getPropsForMessage = (
  message: MessageWithUIFieldsType,
  options: GetPropsForMessageOptions
): Omit<PropsForMessage, 'renderingContext' | 'menu' | 'contextMenu'> => {
  const attachmentDroppedDueToSize = message.attachments?.some(
    item => item.wasTooBig
  );
  const attachments = getAttachmentsForMessage(message);
  const bodyRanges = processBodyRanges(message, options);
  const author = getAuthorForMessage(message, options);
  const previews = getPreviewsForMessage(message);
  const reactions = getReactionsForMessage(message, options);
  const quote = getPropsForQuote(message, options);
  const storyReplyContext = getPropsForStoryReplyContext(message, options);
  const textAttachment = getTextAttachment(message);
  const payment = getPayment(message);

  const {
    activeCall,
    accountSelector,
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourAci,
    regionCode,
    targetedMessageId,
    targetedMessageCounter,
    selectedMessageIds,
    contactNameColors,
    defaultConversationColor,
  } = options;

  const { expireTimer, expirationStartTimestamp, conversationId } = message;
  const expirationLength = expireTimer
    ? DurationInSeconds.toMillis(expireTimer)
    : undefined;

  const conversation = getConversation(message, conversationSelector);
  const isGroup = conversation.type === 'group';
  const { sticker } = message;

  const isMessageTapToView = isTapToView(message);
  const activeCallConversationId = activeCall?.conversationId;

  const isTargeted = message.id === targetedMessageId;
  const isSelected = selectedMessageIds?.includes(message.id) ?? false;
  const isSelectMode = selectedMessageIds != null;

  const selectedReaction = (
    (message.reactions || []).find(re => re.fromId === ourConversationId) || {}
  ).emoji;

  const authorId = getAuthorId(message, {
    conversationSelector,
    ourConversationId,
    ourNumber,
    ourAci,
  });
  const contactNameColor = getContactNameColor(contactNameColors, authorId);

  const { conversationColor, customColor } = getConversationColorAttributes(
    conversation,
    defaultConversationColor
  );

  return {
    attachments,
    attachmentDroppedDueToSize,
    author,
    bodyRanges,
    activeCallConversationId,
    previews,
    quote,
    reactions,
    storyReplyContext,
    textAttachment,
    payment,
    canCopy: canCopy(message),
    canEditMessage: canEditMessage(message),
    canDeleteForEveryone: canDeleteForEveryone(message, conversation.isMe),
    canDownload: canDownload(message, conversationSelector),
    canReact: canReact(message, ourConversationId, conversationSelector),
    canReply: canReply(message, ourConversationId, conversationSelector),
    canRetry: hasErrors(message),
    canRetryDeleteForEveryone: canRetryDeleteForEveryone(message),
    contact: getPropsForEmbeddedContact(message, regionCode, accountSelector),
    contactNameColor,
    conversationColor,
    conversationId,
    conversationTitle: conversation.title,
    conversationType: isGroup ? 'group' : 'direct',
    customColor,
    deletedForEveryone: message.deletedForEveryone || false,
    direction: isIncoming(message) ? 'incoming' : 'outgoing',
    displayLimit: message.displayLimit,
    expirationLength,
    expirationTimestamp: calculateExpirationTimestamp({
      expireTimer,
      expirationStartTimestamp,
    }),
    giftBadge: message.giftBadge,
    id: message.id,
    isBlocked: conversation.isBlocked || false,
    isEditedMessage: Boolean(message.editHistory),
    isMessageRequestAccepted: conversation?.acceptedMessageRequest ?? true,
    isSelected,
    isSelectMode,
    isSMS: message.sms === true,
    isSpoilerExpanded: message.isSpoilerExpanded,
    isSticker: Boolean(sticker),
    isTargeted,
    isTargetedCounter: isTargeted ? targetedMessageCounter : undefined,
    isTapToView: isMessageTapToView,
    isTapToViewError:
      isMessageTapToView && isIncoming(message) && message.isTapToViewInvalid,
    isTapToViewExpired: isMessageTapToView && message.isErased,
    readStatus: message.readStatus ?? ReadStatus.Read,
    selectedReaction,
    status: getMessagePropStatus(message, ourConversationId),
    text: message.body,
    textDirection: getTextDirection(message.body),
    timestamp: getMessageSentTimestamp(message, { includeEdits: false, log }),
    receivedAtMS: message.received_at_ms,
  };
};

// This is getPropsForMessage but wrapped in reselect's createSelector so that
// we can derive all of the selector dependencies that getPropsForMessage
// requires and you won't have to pass them in. For use within a smart/connected
// component that has access to selectors.
export const getMessagePropsSelector = createSelector(
  getConversationSelector,
  getUserConversationId,
  getUserACI,
  getUserPNI,
  getUserNumber,
  getRegionCode,
  getAccountSelector,
  getCachedConversationMemberColorsSelector,
  getTargetedMessage,
  getSelectedMessageIds,
  getDefaultConversationColor,
  (
    conversationSelector,
    ourConversationId,
    ourAci,
    ourPni,
    ourNumber,
    regionCode,
    accountSelector,
    cachedConversationMemberColorsSelector,
    targetedMessage,
    selectedMessageIds,
    defaultConversationColor
  ) =>
    (message: MessageWithUIFieldsType) => {
      const contactNameColors = cachedConversationMemberColorsSelector(
        message.conversationId
      );
      return getPropsForMessage(message, {
        accountSelector,
        contactNameColors,
        conversationSelector,
        ourConversationId,
        ourNumber,
        ourAci,
        ourPni,
        regionCode,
        targetedMessageCounter: targetedMessage?.counter,
        targetedMessageId: targetedMessage?.id,
        selectedMessageIds,
        defaultConversationColor,
      });
    }
);

// Top-level prop generation for the message bubble
export function getPropsForBubble(
  message: MessageWithUIFieldsType,
  options: GetPropsForBubbleOptions
): TimelineItemType {
  const { received_at_ms: receivedAt, timestamp: messageTimestamp } = message;
  const timestamp = receivedAt || messageTimestamp;

  if (isUnsupportedMessage(message)) {
    return {
      type: 'unsupportedMessage',
      data: getPropsForUnsupportedMessage(message, options),
      timestamp,
    };
  }
  if (isGroupV2Change(message)) {
    return {
      type: 'groupV2Change',
      data: getPropsForGroupV2Change(message, options),
      timestamp,
    };
  }
  if (isGroupV1Migration(message)) {
    return {
      type: 'groupV1Migration',
      data: getPropsForGroupV1Migration(message, options),
      timestamp,
    };
  }
  if (isExpirationTimerUpdate(message)) {
    return {
      type: 'timerNotification',
      data: getPropsForTimerNotification(message, options),
      timestamp,
    };
  }
  if (isKeyChange(message)) {
    return {
      type: 'safetyNumberNotification',
      data: getPropsForSafetyNumberNotification(message, options),
      timestamp,
    };
  }
  if (isVerifiedChange(message)) {
    return {
      type: 'verificationNotification',
      data: getPropsForVerificationNotification(message, options),
      timestamp,
    };
  }
  if (isGroupUpdate(message)) {
    return {
      type: 'groupNotification',
      data: getPropsForGroupNotification(message, options),
      timestamp,
    };
  }
  if (isEndSession(message)) {
    return {
      type: 'resetSessionNotification',
      data: null,
      timestamp,
    };
  }
  if (isCallHistory(message)) {
    return {
      type: 'callHistory',
      data: getPropsForCallHistory(message, options),
      timestamp,
    };
  }
  if (isProfileChange(message)) {
    return {
      type: 'profileChange',
      data: getPropsForProfileChange(message, options),
      timestamp,
    };
  }
  if (isUniversalTimerNotification(message)) {
    return {
      type: 'universalTimerNotification',
      data: null,
      timestamp,
    };
  }
  if (isContactRemovedNotification(message)) {
    return {
      type: 'contactRemovedNotification',
      data: null,
      timestamp,
    };
  }
  if (isChangeNumberNotification(message)) {
    return {
      type: 'changeNumberNotification',
      data: getPropsForChangeNumberNotification(message, options),
      timestamp,
    };
  }
  if (isJoinedSignalNotification(message)) {
    return {
      type: 'joinedSignalNotification',
      data: getPropsForJoinedSignalNotification(message),
      timestamp,
    };
  }
  if (isTitleTransitionNotification(message)) {
    return {
      type: 'titleTransitionNotification',
      data: getPropsForTitleTransitionNotification(message),
      timestamp,
    };
  }
  if (isChatSessionRefreshed(message)) {
    return {
      type: 'chatSessionRefreshed',
      data: null,
      timestamp,
    };
  }
  if (isDeliveryIssue(message)) {
    return {
      type: 'deliveryIssue',
      data: getPropsForDeliveryIssue(message, options),
      timestamp,
    };
  }
  if (isConversationMerge(message)) {
    return {
      type: 'conversationMerge',
      data: getPropsForConversationMerge(message, options),
      timestamp,
    };
  }
  if (isPhoneNumberDiscovery(message)) {
    return {
      type: 'phoneNumberDiscovery',
      data: getPropsForPhoneNumberDiscovery(message, options),
      timestamp,
    };
  }

  if (
    messageHasPaymentEvent(message) &&
    !isPaymentNotificationEvent(message.payment)
  ) {
    return {
      type: 'paymentEvent',
      data: getPropsForPaymentEvent(message, options),
      timestamp,
    };
  }

  if (isMessageRequestResponse(message)) {
    return {
      type: 'messageRequestResponse',
      data: getPropsForMessageRequestResponse(message),
      timestamp,
    };
  }

  const data = getPropsForMessage(message, options);

  return {
    type: 'message' as const,
    data,
    timestamp: data.timestamp,
  };
}

export function isNormalBubble(message: MessageWithUIFieldsType): boolean {
  return (
    !isCallHistory(message) &&
    !isChatSessionRefreshed(message) &&
    !isContactRemovedNotification(message) &&
    !isConversationMerge(message) &&
    !isEndSession(message) &&
    !isExpirationTimerUpdate(message) &&
    !isGroupUpdate(message) &&
    !isGroupV1Migration(message) &&
    !isGroupV2Change(message) &&
    !isKeyChange(message) &&
    !isPhoneNumberDiscovery(message) &&
    !isTitleTransitionNotification(message) &&
    !isProfileChange(message) &&
    !isUniversalTimerNotification(message) &&
    !isUnsupportedMessage(message) &&
    !isVerifiedChange(message) &&
    !isChangeNumberNotification(message) &&
    !isJoinedSignalNotification(message) &&
    !isDeliveryIssue(message) &&
    !isMessageRequestResponse(message)
  );
}

function getPropsForPaymentEvent(
  message: MessageAttributesWithPaymentEvent,
  { conversationSelector }: GetPropsForBubbleOptions
): Omit<PaymentEventNotificationPropsType, 'i18n'> {
  return {
    sender: conversationSelector(message.sourceServiceId),
    conversation: getConversation(message, conversationSelector),
    event: message.payment,
  };
}

// Unsupported Message

export function isUnsupportedMessage(
  message: MessageWithUIFieldsType
): boolean {
  const versionAtReceive = message.supportedVersionAtReceive;
  const requiredVersion = message.requiredProtocolVersion;

  return (
    isNumber(versionAtReceive) &&
    isNumber(requiredVersion) &&
    versionAtReceive < requiredVersion
  );
}

function getPropsForUnsupportedMessage(
  message: MessageWithUIFieldsType,
  options: GetContactOptions
): PropsForUnsupportedMessage {
  const CURRENT_PROTOCOL_VERSION = Proto.DataMessage.ProtocolVersion.CURRENT;

  const requiredVersion = message.requiredProtocolVersion;
  const canProcessNow = Boolean(
    CURRENT_PROTOCOL_VERSION &&
      requiredVersion &&
      CURRENT_PROTOCOL_VERSION >= requiredVersion
  );

  return {
    canProcessNow,
    contact: getContact(message, options),
  };
}

// GroupV2 Change

export function isGroupV2Change(message: MessageWithUIFieldsType): boolean {
  return Boolean(message.groupV2Change);
}

function getPropsForGroupV2Change(
  message: MessageWithUIFieldsType,
  { conversationSelector, ourAci, ourPni }: GetPropsForBubbleOptions
): GroupsV2Props {
  const change = message.groupV2Change;

  if (!change) {
    throw new Error('getPropsForGroupV2Change: Change is missing!');
  }

  const conversation = getConversation(message, conversationSelector);

  return {
    areWeAdmin: Boolean(conversation.areWeAdmin),
    conversationId: conversation.id,
    groupName: conversation?.type === 'group' ? conversation?.name : undefined,
    groupMemberships: conversation.memberships,
    groupBannedMemberships: conversation.bannedMemberships,
    ourAci,
    ourPni,
    change,
  };
}

// GroupV1 Migration

export function isGroupV1Migration(message: MessageWithUIFieldsType): boolean {
  return message.type === 'group-v1-migration';
}

function getPropsForGroupV1Migration(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): GroupV1MigrationPropsType {
  const migration = message.groupMigration;
  if (!migration) {
    // Backwards-compatibility with data schema in early betas
    const invitedGV2Members = message.invitedGV2Members || [];
    const droppedGV2MemberIds = message.droppedGV2MemberIds || [];

    const invitedMembers = invitedGV2Members.map(item =>
      conversationSelector(item.uuid)
    );
    const droppedMembers = droppedGV2MemberIds.map(conversationId =>
      conversationSelector(conversationId)
    );

    return {
      areWeInvited: false,
      conversationId: message.conversationId,
      droppedMembers,
      invitedMembers,
      droppedMemberCount: droppedMembers.length,
      invitedMemberCount: invitedMembers.length,
    };
  }

  const {
    areWeInvited,
    droppedMemberIds,
    invitedMembers: rawInvitedMembers,
    droppedMemberCount: rawDroppedMemberCount,
    invitedMemberCount: rawInvitedMemberCount,
  } = migration;
  const droppedMembers = droppedMemberIds
    ? droppedMemberIds.map(conversationId =>
        conversationSelector(conversationId)
      )
    : undefined;
  const invitedMembers = rawInvitedMembers
    ? rawInvitedMembers.map(item => conversationSelector(item.uuid))
    : undefined;

  const droppedMemberCount =
    rawDroppedMemberCount ?? droppedMemberIds?.length ?? 0;
  const invitedMemberCount =
    rawInvitedMemberCount ?? invitedMembers?.length ?? 0;

  return {
    areWeInvited,
    conversationId: message.conversationId,
    droppedMembers,
    invitedMembers,
    droppedMemberCount,
    invitedMemberCount,
  };
}

// Note: props are null!

// Expiration Timer Update

export function isExpirationTimerUpdate(
  message: Pick<MessageWithUIFieldsType, 'flags'>
): boolean {
  const flag = Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
  // eslint-disable-next-line no-bitwise
  return Boolean(message.flags && message.flags & flag);
}

function getPropsForTimerNotification(
  message: MessageWithUIFieldsType,
  { ourConversationId, conversationSelector }: GetPropsForBubbleOptions
): TimerNotificationProps {
  const timerUpdate = message.expirationTimerUpdate;
  if (!timerUpdate) {
    throw new Error(
      'getPropsForTimerNotification: missing expirationTimerUpdate!'
    );
  }

  const { expireTimer, fromSync, source, sourceServiceId } = timerUpdate;
  const disabled = !expireTimer;
  const sourceId = sourceServiceId || source;
  const { id: formattedContactId, title } = conversationSelector(sourceId);

  // Pacify typescript
  type MaybeExpireTimerType =
    | { disabled: true }
    | {
        disabled: false;
        expireTimer: DurationInSeconds;
      };

  const maybeExpireTimer: MaybeExpireTimerType = disabled
    ? {
        disabled: true,
      }
    : {
        disabled: false,
        expireTimer,
      };

  const basicProps = {
    title,
    ...maybeExpireTimer,
    type: 'fromOther' as const,
  };

  if (fromSync) {
    return {
      ...basicProps,
      type: 'fromSync' as const,
    };
  }
  if (formattedContactId === ourConversationId) {
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

export function isKeyChange(message: MessageWithUIFieldsType): boolean {
  return message.type === 'keychange';
}

function getPropsForSafetyNumberNotification(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): SafetyNumberNotificationProps {
  const conversation = getConversation(message, conversationSelector);
  const isGroup = conversation?.type === 'group';
  const identifier = message.key_changed;

  if (isGroup && !identifier) {
    throw new Error(
      'getPropsForSafetyNumberNotification: isGroup = true, but no identifier!'
    );
  }

  const contact = identifier ? conversationSelector(identifier) : conversation;

  return {
    isGroup,
    contact,
  };
}

// Verified Change

export function isVerifiedChange(message: MessageWithUIFieldsType): boolean {
  return message.type === 'verified-change';
}

function getPropsForVerificationNotification(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
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

// Gift Badge

export function isGiftBadge(
  message: Pick<MessageWithUIFieldsType, 'giftBadge'>
): boolean {
  return Boolean(message.giftBadge);
}

// Group Update (V1)

export function isGroupUpdate(
  message: Pick<MessageWithUIFieldsType, 'group_update'>
): boolean {
  return Boolean(message.group_update);
}

function getPropsForGroupNotification(
  message: MessageWithUIFieldsType,
  options: GetContactOptions
): GroupNotificationProps {
  const groupUpdate = message.group_update;
  if (!groupUpdate) {
    throw new Error(
      'getPropsForGroupNotification: Message missing group_update'
    );
  }

  const { conversationSelector } = options;

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

  const from = getContact(message, options);

  return {
    from,
    changes,
  };
}

// End Session

export function isEndSession(
  message: Pick<MessageWithUIFieldsType, 'flags'>
): boolean {
  const flag = Proto.DataMessage.Flags.END_SESSION;
  // eslint-disable-next-line no-bitwise
  return Boolean(message.flags && message.flags & flag);
}

// Call History

export function isCallHistory(message: MessageWithUIFieldsType): boolean {
  return message.type === 'call-history';
}

export type GetPropsForCallHistoryOptions = Pick<
  GetPropsForBubbleOptions,
  | 'callSelector'
  | 'activeCall'
  | 'callHistorySelector'
  | 'conversationSelector'
  | 'ourConversationId'
  | 'selectedMessageIds'
  | 'targetedMessageId'
>;

const emptyCallNotification: CallingNotificationType = {
  callHistory: null,
  callCreator: null,
  activeConversationId: null,
  groupCallEnded: null,
  maxDevices: Infinity,
  deviceCount: 0,
  isSelectMode: false,
  isTargeted: false,
};

export function getPropsForCallHistory(
  message: MessageWithUIFieldsType,
  {
    callSelector,
    callHistorySelector,
    activeCall,
    conversationSelector,
    ourConversationId,
    selectedMessageIds,
    targetedMessageId,
  }: GetPropsForCallHistoryOptions
): CallingNotificationType {
  const { callId } = message;
  if (callId == null) {
    log.error('getPropsForCallHistory: Missing callId');
    return emptyCallNotification;
  }
  const callHistory = callHistorySelector(callId);
  if (callHistory == null) {
    log.error('getPropsForCallHistory: Missing callHistory');
    return emptyCallNotification;
  }

  const activeConversationId = activeCall?.conversationId ?? null;

  const conversation = conversationSelector(callHistory.peerId);
  strictAssert(
    conversation != null,
    'getPropsForCallHistory: Missing conversation'
  );

  const isSelectMode = selectedMessageIds != null;

  let callCreator: ConversationType | null = null;
  if (callHistory.direction === CallDirection.Outgoing) {
    callCreator = conversationSelector(ourConversationId);
  } else if (callHistory.ringerId) {
    callCreator = conversationSelector(callHistory.ringerId);
  }

  if (callHistory.mode === CallMode.Direct) {
    return {
      callHistory,
      callCreator,
      activeConversationId,
      groupCallEnded: false,
      deviceCount: 0,
      maxDevices: Infinity,
      isSelectMode,
      isTargeted: message.id === targetedMessageId,
    };
  }

  // This could be a later call in the conversation
  const conversationCall = callSelector(conversation.id);

  if (conversationCall != null) {
    strictAssert(
      conversationCall?.callMode === CallMode.Group,
      'getPropsForCallHistory: Call was expected to be a group call'
    );
  }

  const conversationCallId =
    conversationCall?.peekInfo?.eraId != null &&
    getCallIdFromEra(conversationCall.peekInfo.eraId);

  const deviceCount = conversationCall?.peekInfo?.deviceCount ?? 0;
  const maxDevices = conversationCall?.peekInfo?.maxDevices ?? Infinity;

  return {
    callHistory,
    callCreator,
    activeConversationId,
    groupCallEnded: callId !== conversationCallId || deviceCount === 0,
    deviceCount,
    maxDevices,
    isSelectMode,
    isTargeted: message.id === targetedMessageId,
  };
}

// Profile Change

export function isProfileChange(message: MessageWithUIFieldsType): boolean {
  return message.type === 'profile-change';
}

function getPropsForProfileChange(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
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

// Message Request Response Event

export function isMessageRequestResponse(
  message: ReadonlyMessageAttributesType
): boolean {
  return message.type === 'message-request-response-event';
}

function getPropsForMessageRequestResponse(
  message: ReadonlyMessageAttributesType
): MessageRequestResponseNotificationData {
  const { messageRequestResponseEvent } = message;
  if (!messageRequestResponseEvent) {
    throw new Error('getPropsForMessageRequestResponse: event is missing!');
  }
  return { messageRequestResponseEvent };
}

// Universal Timer Notification

// Note: smart, so props not generated here

export function isUniversalTimerNotification(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'universal-timer-notification';
}

// Contact Removed Notification

// Note: smart, so props not generated here

export function isContactRemovedNotification(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'contact-removed-notification';
}

// Change Number Notification

export function isChangeNumberNotification(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'change-number-notification';
}

function getPropsForChangeNumberNotification(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): ChangeNumberNotificationProps {
  return {
    sender: conversationSelector(message.sourceServiceId),
    timestamp: message.sent_at,
  };
}

// Joined Signal Notification

export function isJoinedSignalNotification(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'joined-signal-notification';
}

function getPropsForJoinedSignalNotification(
  message: MessageWithUIFieldsType
): JoinedSignalNotificationProps {
  return {
    timestamp: message.sent_at,
  };
}

// Title Transition Notification

export function isTitleTransitionNotification(
  message: MessageWithUIFieldsType
): boolean {
  return (
    message.type === 'title-transition-notification' &&
    message.titleTransition != null
  );
}

function getPropsForTitleTransitionNotification(
  message: MessageWithUIFieldsType
): TitleTransitionNotificationProps {
  strictAssert(
    message.titleTransition != null,
    'Invalid attributes for title-transition-notification'
  );
  const { renderInfo } = message.titleTransition;
  const oldTitle = getTitle(renderInfo);
  return {
    oldTitle,
  };
}

// Chat Session Refreshed

export function isChatSessionRefreshed(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'chat-session-refreshed';
}

// Note: props are null

export function isConversationMerge(message: MessageWithUIFieldsType): boolean {
  return message.type === 'conversation-merge';
}
export function getPropsForConversationMerge(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): ConversationMergePropsType {
  const { conversationMerge } = message;
  if (!conversationMerge) {
    throw new Error(
      'getPropsForConversationMerge: message is missing conversationMerge!'
    );
  }

  const conversation = getConversation(message, conversationSelector);
  const conversationTitle = conversation.title;

  const { renderInfo } = conversationMerge;
  const obsoleteConversationTitle = getTitleNoDefault(renderInfo);
  const obsoleteConversationNumber = getNumber(renderInfo);

  return {
    conversationTitle,
    obsoleteConversationTitle,
    obsoleteConversationNumber,
  };
}

export function isPhoneNumberDiscovery(
  message: MessageWithUIFieldsType
): boolean {
  return message.type === 'phone-number-discovery';
}
export function getPropsForPhoneNumberDiscovery(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): PhoneNumberDiscoveryPropsType {
  const { phoneNumberDiscovery } = message;
  if (!phoneNumberDiscovery) {
    throw new Error(
      'getPropsForPhoneNumberDiscovery: message is missing phoneNumberDiscovery!'
    );
  }

  const conversation = getConversation(message, conversationSelector);
  const conversationTitle = conversation.title;
  const sharedGroup = conversation.sharedGroupNames[0];
  const { e164 } = phoneNumberDiscovery;

  return {
    conversationTitle,
    phoneNumber: renderNumber(e164) ?? e164,
    sharedGroup,
  };
}

// Delivery Issue

export function isDeliveryIssue(message: MessageWithUIFieldsType): boolean {
  return message.type === 'delivery-issue';
}

function getPropsForDeliveryIssue(
  message: MessageWithUIFieldsType,
  { conversationSelector }: GetPropsForBubbleOptions
): DeliveryIssuePropsType {
  const sender = conversationSelector(message.sourceServiceId);
  const conversation = getConversation(message, conversationSelector);

  return {
    sender,
    inGroup: conversation.type === 'group',
  };
}

// Other utility functions

export function isTapToView(message: MessageWithUIFieldsType): boolean {
  // If a message is deleted for everyone, that overrides all other styling
  if (message.deletedForEveryone) {
    return false;
  }

  return Boolean(message.isViewOnce || message.messageTimer);
}

export function getMessagePropStatus(
  message: Pick<
    MessageWithUIFieldsType,
    | 'deletedForEveryone'
    | 'deletedForEveryoneFailed'
    | 'deletedForEveryoneSendStatus'
    | 'errors'
    | 'sendStateByConversationId'
    | 'type'
  >,
  ourConversationId: string | undefined
): LastMessageStatus | undefined {
  if (!isOutgoing(message)) {
    return hasErrors(message) ? 'error' : undefined;
  }

  if (getLastChallengeError(message)) {
    return 'paused';
  }

  const {
    deletedForEveryone,
    deletedForEveryoneFailed,
    deletedForEveryoneSendStatus,
    sendStateByConversationId = {},
  } = message;

  // Note: we only do anything here if deletedForEveryoneSendStatus exists, because old
  //   messages deleted for everyone won't have send status.
  if (deletedForEveryone && deletedForEveryoneSendStatus) {
    if (deletedForEveryoneFailed) {
      const anySuccessfulSends = Object.values(
        deletedForEveryoneSendStatus
      ).some(item => item);

      return anySuccessfulSends ? 'partial-sent' : 'error';
    }
    const missingSends = Object.values(deletedForEveryoneSendStatus).some(
      item => !item
    );
    if (missingSends) {
      return 'sending';
    }
  }

  if (
    ourConversationId &&
    isMessageJustForMe(sendStateByConversationId, ourConversationId)
  ) {
    const status =
      sendStateByConversationId[ourConversationId]?.status ??
      SendStatus.Pending;
    const sent = isSent(status);
    if (
      hasErrors(message) ||
      someSendStatus(sendStateByConversationId, isFailed)
    ) {
      return sent ? 'partial-sent' : 'error';
    }
    return sent ? 'viewed' : 'sending';
  }

  const highestSuccessfulStatus = getHighestSuccessfulRecipientStatus(
    sendStateByConversationId,
    ourConversationId
  );

  if (
    hasErrors(message) ||
    someSendStatus(sendStateByConversationId, isFailed)
  ) {
    return isSent(highestSuccessfulStatus) ? 'partial-sent' : 'error';
  }
  if (isViewed(highestSuccessfulStatus)) {
    return 'viewed';
  }
  if (isRead(highestSuccessfulStatus)) {
    return 'read';
  }
  if (isDelivered(highestSuccessfulStatus)) {
    return 'delivered';
  }
  if (isSent(highestSuccessfulStatus)) {
    return 'sent';
  }
  return 'sending';
}

export function getPropsForEmbeddedContact(
  message: MessageWithUIFieldsType,
  regionCode: string | undefined,
  accountSelector: (identifier?: string) => ServiceIdString | undefined
): ReadonlyDeep<EmbeddedContactType> | undefined {
  const contacts = message.contact;
  if (!contacts || !contacts.length) {
    return undefined;
  }

  const firstContact = contacts[0];
  const numbers = firstContact?.number;
  const firstNumber = numbers && numbers[0] ? numbers[0].value : undefined;

  return embeddedContactSelector(firstContact, {
    regionCode,
    firstNumber,
    serviceId: accountSelector(firstNumber),
  });
}

export function getPropsForAttachment(
  attachment: AttachmentType
): AttachmentForUIType | undefined {
  if (!attachment) {
    return undefined;
  }

  const { path, pending, screenshot, thumbnail, thumbnailFromBackup } =
    attachment;

  return {
    ...attachment,
    isVoiceMessage: isVoiceMessage(attachment),
    pending,
    url: path ? getLocalAttachmentUrl(attachment) : undefined,
    thumbnailFromBackup: thumbnailFromBackup?.path
      ? {
          ...thumbnailFromBackup,
          url: getLocalAttachmentUrl(thumbnailFromBackup),
        }
      : undefined,
    screenshot: screenshot?.path
      ? {
          ...screenshot,
          url: getLocalAttachmentUrl({
            // Legacy v1 screenshots
            size: 0,

            ...screenshot,
          }),
        }
      : undefined,
    thumbnail: thumbnail?.path
      ? {
          ...thumbnail,
          url: getLocalAttachmentUrl(thumbnail),
        }
      : undefined,
  };
}

function processQuoteAttachment(attachment: QuotedAttachmentType) {
  const { thumbnail } = attachment;
  const path = thumbnail && thumbnail.path && getLocalAttachmentUrl(thumbnail);
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

function canReplyOrReact(
  message: Pick<
    MessageWithUIFieldsType,
    | 'canReplyToStory'
    | 'deletedForEveryone'
    | 'payment'
    | 'sendStateByConversationId'
    | 'sms'
    | 'type'
  >,
  ourConversationId: string | undefined,
  conversation: undefined | Readonly<ConversationType>
): boolean {
  const { deletedForEveryone, sendStateByConversationId } = message;

  if (!conversation) {
    return false;
  }

  if (conversation.isGroupV1AndDisabled) {
    return false;
  }

  if (isMissingRequiredProfileSharing(conversation)) {
    return false;
  }

  if (
    !conversation.acceptedMessageRequest &&
    conversation.removalStage !== 'justNotification'
  ) {
    return false;
  }

  if (conversation.isBlocked) {
    return false;
  }

  if (deletedForEveryone) {
    return false;
  }

  if (isSignalConversation(conversation)) {
    return false;
  }

  if (message.sms) {
    return false;
  }

  if (isOutgoing(message)) {
    return (
      isMessageJustForMe(sendStateByConversationId ?? {}, ourConversationId) ||
      someRecipientSendStatus(
        sendStateByConversationId ?? {},
        ourConversationId,
        isSent
      )
    );
  }

  // If we get past all the other checks above then we can always reply or
  // react if the message type is "incoming" | "story"
  if (isIncoming(message)) {
    return true;
  }

  if (isStory(message)) {
    return (
      Boolean(message.canReplyToStory) && conversation.id !== ourConversationId
    );
  }

  // Fail safe.
  return false;
}

export function canReply(
  message: Pick<
    MessageWithUIFieldsType,
    | 'canReplyToStory'
    | 'conversationId'
    | 'deletedForEveryone'
    | 'sendStateByConversationId'
    | 'sms'
    | 'type'
  >,
  ourConversationId: string | undefined,
  conversationSelector: GetConversationByIdType
): boolean {
  const conversation = getConversation(message, conversationSelector);
  if (
    !conversation ||
    (conversation.announcementsOnly && !conversation.areWeAdmin)
  ) {
    return false;
  }
  return canReplyOrReact(message, ourConversationId, conversation);
}

export function canReact(
  message: Pick<
    MessageWithUIFieldsType,
    | 'conversationId'
    | 'deletedForEveryone'
    | 'sendStateByConversationId'
    | 'sms'
    | 'type'
  >,
  ourConversationId: string | undefined,
  conversationSelector: GetConversationByIdType
): boolean {
  const conversation = getConversation(message, conversationSelector);
  return canReplyOrReact(message, ourConversationId, conversation);
}

export function canCopy(
  message: Pick<MessageWithUIFieldsType, 'body' | 'deletedForEveryone'>
): boolean {
  return !message.deletedForEveryone && Boolean(message.body);
}

export function canDeleteForEveryone(
  message: Pick<
    MessageWithUIFieldsType,
    | 'type'
    | 'deletedForEveryone'
    | 'sent_at'
    | 'sendStateByConversationId'
    | 'sms'
  >,
  isMe: boolean
): boolean {
  return (
    // Is this an SMS restored from backup?
    !message.sms &&
    // Is this a message I sent?
    isOutgoing(message) &&
    // Has the message already been deleted?
    !message.deletedForEveryone &&
    // Is it too old to delete? (we relax that requirement in Note to Self)
    (isMoreRecentThan(message.sent_at, DAY) || isMe) &&
    // Is it sent to anyone?
    someSendStatus(message.sendStateByConversationId ?? {}, isSent)
  );
}

export const canDeleteMessagesForEveryone = createSelector(
  [
    getMessages,
    (_state, options: { messageIds: ReadonlyArray<string>; isMe: boolean }) =>
      options,
  ],
  (messagesLookup, options) => {
    return options.messageIds.every(messageId => {
      const message = getOwn(messagesLookup, messageId);
      return message != null && canDeleteForEveryone(message, options.isMe);
    });
  }
);

export function canRetryDeleteForEveryone(
  message: Pick<
    MessageWithUIFieldsType,
    'deletedForEveryone' | 'deletedForEveryoneFailed' | 'sent_at'
  >
): boolean {
  return Boolean(
    message.deletedForEveryone &&
      message.deletedForEveryoneFailed &&
      // Is it too old to delete?
      isMoreRecentThan(message.sent_at, DAY)
  );
}

export function canDownload(
  message: MessageWithUIFieldsType,
  conversationSelector: GetConversationByIdType
): boolean {
  const conversation = getConversation(message, conversationSelector);
  const isAccepted = Boolean(
    conversation && conversation.acceptedMessageRequest
  );
  if (isIncoming(message) && !isAccepted) {
    return false;
  }

  if (message.sticker) {
    return false;
  }

  if (isTapToView(message)) {
    return false;
  }

  // Ensure that all attachments are downloadable
  const { attachments } = message;
  if (attachments && attachments.length) {
    return attachments.every(attachment => Boolean(attachment.path));
  }

  return false;
}

export function getLastChallengeError(
  message: Pick<MessageWithUIFieldsType, 'errors'>
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

const getTargetedMessageForDetails = (
  state: StateType
): ReadonlyMessageAttributesType | undefined =>
  state.conversations.targetedMessageForDetails;

const OUTGOING_KEY_ERROR = 'OutgoingIdentityKeyError';

export const getMessageDetails = createSelector(
  getAccountSelector,
  getCachedConversationMemberColorsSelector,
  getConversationSelector,
  getIntl,
  getRegionCode,
  getTargetedMessageForDetails,
  getUserACI,
  getUserPNI,
  getUserConversationId,
  getUserNumber,
  getSelectedMessageIds,
  getDefaultConversationColor,
  (
    accountSelector,
    cachedConversationMemberColorsSelector,
    conversationSelector,
    i18n,
    regionCode,
    message,
    ourAci,
    ourPni,
    ourConversationId,
    ourNumber,
    selectedMessageIds,
    defaultConversationColor
  ): SmartMessageDetailPropsType | undefined => {
    if (!message || !ourConversationId) {
      return;
    }

    const {
      errors: messageErrors = [],
      sendStateByConversationId = {},
      unidentifiedDeliveries = [],
      unidentifiedDeliveryReceived,
    } = message;

    const unidentifiedDeliveriesSet = new Set(
      map(
        unidentifiedDeliveries,
        identifier =>
          window.ConversationController.getConversationId(identifier) as string
      )
    );

    let conversationIds: Array<string>;
    if (isIncoming(message)) {
      conversationIds = [
        getAuthorId(message, {
          conversationSelector,
          ourConversationId,
          ourNumber,
          ourAci,
        }),
      ].filter(isNotNil);
    } else if (!isEmpty(sendStateByConversationId)) {
      if (isMessageJustForMe(sendStateByConversationId, ourConversationId)) {
        conversationIds = [ourConversationId];
      } else {
        conversationIds = Object.keys(sendStateByConversationId).filter(
          id => id !== ourConversationId
        );
      }
    } else {
      const messageConversation = window.ConversationController.get(
        message.conversationId
      );
      const conversationRecipients = messageConversation
        ? getRecipients(messageConversation.attributes) || []
        : [];
      // Older messages don't have the recipients included on the message, so we fall back
      //   to the conversation's current recipients
      conversationIds = conversationRecipients
        .map((id: string) =>
          window.ConversationController.getConversationId(id)
        )
        .filter(isNotNil);
    }

    // This will make the error message for outgoing key errors a bit nicer
    const allErrors = messageErrors.map(error => {
      if (error.name === OUTGOING_KEY_ERROR) {
        return {
          ...error,
          message: i18n('icu:newIdentity'),
        };
      }

      return error;
    });

    // If an error has a specific number it's associated with, we'll show it next to
    //   that contact. Otherwise, it will be a standalone entry.
    const errors = allErrors.filter(error =>
      Boolean(error.serviceId || error.number)
    );
    const errorsGroupedById = groupBy(allErrors, error => {
      const serviceId = error.serviceId || error.number;
      if (!serviceId) {
        return null;
      }

      return window.ConversationController.getConversationId(serviceId);
    });

    const hasUnidentifiedDeliveryIndicators = window.storage.get(
      'unidentifiedDeliveryIndicators',
      false
    );

    const contacts: ReadonlyArray<SmartMessageDetailContact> =
      conversationIds.map(id => {
        const errorsForContact = getOwn(errorsGroupedById, id);
        const isOutgoingKeyError = Boolean(
          errorsForContact?.some(error => error.name === OUTGOING_KEY_ERROR)
        );

        let isUnidentifiedDelivery = false;
        if (hasUnidentifiedDeliveryIndicators) {
          isUnidentifiedDelivery = isIncoming(message)
            ? Boolean(unidentifiedDeliveryReceived)
            : unidentifiedDeliveriesSet.has(id);
        }

        const sendState = getOwn(sendStateByConversationId, id);

        let status = sendState?.status;

        // If a message was only sent to yourself (Note to Self or a lonely group), it
        //   is shown read.
        if (id === ourConversationId && status && isSent(status)) {
          status = SendStatus.Read;
        }

        const statusTimestamp = sendState?.updatedAt;

        return {
          ...conversationSelector(id),
          errors: errorsForContact,
          isOutgoingKeyError,
          isUnidentifiedDelivery,
          status,
          statusTimestamp:
            statusTimestamp === message.timestamp ? undefined : statusTimestamp,
        };
      });

    return {
      contacts,
      errors,
      message: getPropsForMessage(message, {
        accountSelector,
        contactNameColors: cachedConversationMemberColorsSelector(
          message.conversationId
        ),
        conversationSelector,
        ourAci,
        ourPni,
        ourConversationId,
        ourNumber,
        regionCode,
        selectedMessageIds,
        defaultConversationColor,
      }),
      receivedAt: Number(message.received_at_ms || message.received_at),
    };
  }
);
