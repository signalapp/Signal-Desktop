// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  isEmpty,
  isNumber,
  isObject,
  mapValues,
  maxBy,
  noop,
  omit,
  partition,
  pick,
  union,
} from 'lodash';
import { v4 as generateUuid } from 'uuid';

import type {
  CustomError,
  MessageAttributesType,
  MessageReactionType,
  QuotedMessageType,
} from '../model-types.d';
import { filter, find, map, repeat, zipObject } from '../util/iterables';
import * as GoogleChrome from '../util/GoogleChrome';
import type { DeleteAttributesType } from '../messageModifiers/Deletes';
import type { SentEventData } from '../textsecure/messageReceiverEvents';
import { isNotNil } from '../util/isNotNil';
import { isNormalNumber } from '../util/isNormalNumber';
import { strictAssert } from '../util/assert';
import { hydrateStoryContext } from '../util/hydrateStoryContext';
import { drop } from '../util/drop';
import type { ConversationModel } from './conversations';
import type {
  ProcessedDataMessage,
  ProcessedQuote,
  ProcessedUnidentifiedDeliveryStatus,
  CallbackResultType,
} from '../textsecure/Types.d';
import { SendMessageProtoError } from '../textsecure/Errors';
import { getUserLanguages } from '../util/userLanguages';
import { copyCdnFields } from '../util/attachments';

import type { ReactionType } from '../types/Reactions';
import { ReactionReadStatus } from '../types/Reactions';
import type { ServiceIdString } from '../types/ServiceId';
import { normalizeServiceId } from '../types/ServiceId';
import { isAciString } from '../util/isAciString';
import * as reactionUtil from '../reactions/util';
import * as Errors from '../types/errors';
import type { AttachmentType } from '../types/Attachment';
import { isImage, isVideo } from '../types/Attachment';
import * as MIME from '../types/MIME';
import { ReadStatus } from '../messages/MessageReadStatus';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import {
  SendActionType,
  SendStatus,
  isSent,
  sendStateReducer,
  someSendStatus,
} from '../messages/MessageSendState';
import { migrateLegacyReadStatus } from '../messages/migrateLegacyReadStatus';
import { migrateLegacySendAttributes } from '../messages/migrateLegacySendAttributes';
import { getOwn } from '../util/getOwn';
import { markRead, markViewed } from '../services/MessageUpdater';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
  isMe,
} from '../util/whatTypeOfConversation';
import { handleMessageSend } from '../util/handleMessageSend';
import { getSendOptions } from '../util/getSendOptions';
import { modifyTargetMessage } from '../util/modifyTargetMessage';
import {
  getMessagePropStatus,
  hasErrors,
  isCallHistory,
  isChatSessionRefreshed,
  isContactRemovedNotification,
  isDeliveryIssue,
  isEndSession,
  isExpirationTimerUpdate,
  isGiftBadge,
  isGroupUpdate,
  isGroupV1Migration,
  isGroupV2Change,
  isIncoming,
  isKeyChange,
  isOutgoing,
  isStory,
  isProfileChange,
  isTapToView,
  isUniversalTimerNotification,
  isUnsupportedMessage,
  isVerifiedChange,
  isConversationMerge,
  isPhoneNumberDiscovery,
} from '../state/selectors/message';
import type { ReactionAttributesType } from '../messageModifiers/Reactions';
import { isInCall } from '../state/selectors/calling';
import { ReactionSource } from '../reactions/ReactionSource';
import * as LinkPreview from '../types/LinkPreview';
import { SignalService as Proto } from '../protobuf';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import {
  NotificationType,
  notificationService,
} from '../services/notifications';
import type {
  LinkPreviewType,
  LinkPreviewWithHydratedData,
} from '../types/message/LinkPreviews';
import * as log from '../logging/log';
import { cleanupMessage, deleteMessageData } from '../util/cleanup';
import {
  getContact,
  getSource,
  getSourceServiceId,
  isCustomError,
  messageHasPaymentEvent,
  isQuoteAMatch,
} from '../messages/helpers';
import { viewOnceOpenJobQueue } from '../jobs/viewOnceOpenJobQueue';
import { getMessageIdForLogging } from '../util/idForLogging';
import { hasAttachmentDownloads } from '../util/hasAttachmentDownloads';
import { queueAttachmentDownloads } from '../util/queueAttachmentDownloads';
import { findStoryMessages } from '../util/findStoryMessage';
import type { ConversationQueueJobData } from '../jobs/conversationJobQueue';
import { shouldDownloadStory } from '../util/shouldDownloadStory';
import type { EmbeddedContactWithHydratedAvatar } from '../types/EmbeddedContact';
import { SeenStatus } from '../MessageSeenStatus';
import { isNewReactionReplacingPrevious } from '../reactions/util';
import { parseBoostBadgeListFromServer } from '../badges/parseBadgesFromServer';
import type { StickerWithHydratedData } from '../types/Stickers';

import {
  addToAttachmentDownloadQueue,
  shouldUseAttachmentDownloadQueue,
} from '../util/attachmentDownloadQueue';
import dataInterface from '../sql/Client';
import { getQuoteBodyText } from '../util/getQuoteBodyText';
import { shouldReplyNotifyUser } from '../util/shouldReplyNotifyUser';
import type { RawBodyRange } from '../types/BodyRange';
import { BodyRange } from '../types/BodyRange';
import {
  queueUpdateMessage,
  saveNewMessageBatcher,
} from '../util/messageBatcher';
import { getSenderIdentifier } from '../util/getSenderIdentifier';
import { getNotificationDataForMessage } from '../util/getNotificationDataForMessage';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage';
import { getMessageAuthorText } from '../util/getMessageAuthorText';
import {
  getPropForTimestamp,
  getChangesForPropAtTimestamp,
} from '../util/editHelpers';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';

/* eslint-disable more/no-then */

window.Whisper = window.Whisper || {};

const { Message: TypedMessage } = window.Signal.Types;
const { upgradeMessageSchema } = window.Signal.Migrations;
const { getMessageBySender } = window.Signal.Data;

export class MessageModel extends window.Backbone.Model<MessageAttributesType> {
  CURRENT_PROTOCOL_VERSION?: number;

  // Set when sending some sync messages, so we get the functionality of
  //   send(), without zombie messages going into the database.
  doNotSave?: boolean;
  // Set when sending stories, so we get the functionality of send() but we are
  //   able to send the sync message elsewhere.
  doNotSendSyncMessage?: boolean;

  INITIAL_PROTOCOL_VERSION?: number;

  deletingForEveryone?: boolean;

  isSelected?: boolean;

  private pendingMarkRead?: number;

  syncPromise?: Promise<CallbackResultType | void>;

  cachedOutgoingContactData?: Array<EmbeddedContactWithHydratedAvatar>;

  cachedOutgoingPreviewData?: Array<LinkPreviewWithHydratedData>;

  cachedOutgoingQuoteData?: QuotedMessageType;

  cachedOutgoingStickerData?: StickerWithHydratedData;

  public registerLocations: Set<string>;

  constructor(attributes: MessageAttributesType) {
    super(attributes);

    if (!this.id && attributes.id) {
      this.id = attributes.id;
    }

    this.registerLocations = new Set();

    // Note that we intentionally don't use `initialize()` method because it
    // isn't compatible with esnext output of esbuild.
    if (isObject(attributes)) {
      this.set(
        TypedMessage.initializeSchemaVersion({
          message: attributes as MessageAttributesType,
          logger: log,
        })
      );
    }

    const readStatus = migrateLegacyReadStatus(this.attributes);
    if (readStatus !== undefined) {
      this.set(
        {
          readStatus,
          seenStatus:
            readStatus === ReadStatus.Unread
              ? SeenStatus.Unseen
              : SeenStatus.Seen,
        },
        { silent: true }
      );
    }

    const ourConversationId =
      window.ConversationController.getOurConversationId();
    if (ourConversationId) {
      const sendStateByConversationId = migrateLegacySendAttributes(
        this.attributes,
        window.ConversationController.get.bind(window.ConversationController),
        ourConversationId
      );
      if (sendStateByConversationId) {
        this.set('sendStateByConversationId', sendStateByConversationId, {
          silent: true,
        });
      }
    }

    this.CURRENT_PROTOCOL_VERSION = Proto.DataMessage.ProtocolVersion.CURRENT;
    this.INITIAL_PROTOCOL_VERSION = Proto.DataMessage.ProtocolVersion.INITIAL;

    this.on('change', this.updateMessageCache);
  }

  updateMessageCache(): void {
    window.MessageCache.setAttributes({
      messageId: this.id,
      messageAttributes: this.attributes,
      skipSaveToDatabase: true,
    });
  }

  getSenderIdentifier(): string {
    return getSenderIdentifier(this.attributes);
  }

  getReceivedAt(): number {
    // We would like to get the received_at_ms ideally since received_at is
    // now an incrementing counter for messages and not the actual time that
    // the message was received. If this field doesn't exist on the message
    // then we can trust received_at.
    return Number(this.get('received_at_ms') || this.get('received_at'));
  }

  isNormalBubble(): boolean {
    const { attributes } = this;

    return (
      !isCallHistory(attributes) &&
      !isChatSessionRefreshed(attributes) &&
      !isContactRemovedNotification(attributes) &&
      !isConversationMerge(attributes) &&
      !isEndSession(attributes) &&
      !isExpirationTimerUpdate(attributes) &&
      !isGroupUpdate(attributes) &&
      !isGroupV1Migration(attributes) &&
      !isGroupV2Change(attributes) &&
      !isKeyChange(attributes) &&
      !isPhoneNumberDiscovery(attributes) &&
      !isProfileChange(attributes) &&
      !isUniversalTimerNotification(attributes) &&
      !isUnsupportedMessage(attributes) &&
      !isVerifiedChange(attributes)
    );
  }

  async hydrateStoryContext(
    inMemoryMessage?: MessageAttributesType,
    {
      shouldSave,
    }: {
      shouldSave?: boolean;
    } = {}
  ): Promise<void> {
    await hydrateStoryContext(this.id, inMemoryMessage, { shouldSave });
  }

  // Dependencies of prop-generation functions
  getConversation(): ConversationModel | undefined {
    return window.ConversationController.get(this.get('conversationId'));
  }

  getNotificationData(): {
    emoji?: string;
    text: string;
    bodyRanges?: ReadonlyArray<RawBodyRange>;
  } {
    return getNotificationDataForMessage(this.attributes);
  }

  getNotificationText(): string {
    return getNotificationTextForMessage(this.attributes);
  }

  // General
  idForLogging(): string {
    return getMessageIdForLogging(this.attributes);
  }

  override defaults(): Partial<MessageAttributesType> {
    return {
      timestamp: new Date().getTime(),
      attachments: [],
    };
  }

  override validate(attributes: Record<string, unknown>): void {
    const required = ['conversationId', 'received_at', 'sent_at'];
    const missing = required.filter(attr => !attributes[attr]);
    if (missing.length) {
      log.warn(`Message missing attributes: ${missing}`);
    }
  }

  merge(model: MessageModel): void {
    const attributes = model.attributes || model;
    this.set(attributes);
  }

  async cleanup(): Promise<void> {
    await cleanupMessage(this.attributes);
  }

  async deleteData(): Promise<void> {
    await deleteMessageData(this.attributes);
  }

  isValidTapToView(): boolean {
    const body = this.get('body');
    if (body) {
      return false;
    }

    const attachments = this.get('attachments');
    if (!attachments || attachments.length !== 1) {
      return false;
    }

    const firstAttachment = attachments[0];
    if (
      !GoogleChrome.isImageTypeSupported(firstAttachment.contentType) &&
      !GoogleChrome.isVideoTypeSupported(firstAttachment.contentType)
    ) {
      return false;
    }

    const quote = this.get('quote');
    const sticker = this.get('sticker');
    const contact = this.get('contact');
    const preview = this.get('preview');

    if (
      quote ||
      sticker ||
      (contact && contact.length > 0) ||
      (preview && preview.length > 0)
    ) {
      return false;
    }

    return true;
  }

  async markViewOnceMessageViewed(options?: {
    fromSync?: boolean;
  }): Promise<void> {
    const { fromSync } = options || {};

    if (!this.isValidTapToView()) {
      log.warn(
        `markViewOnceMessageViewed: Message ${this.idForLogging()} is not a valid tap to view message!`
      );
      return;
    }
    if (this.isErased()) {
      log.warn(
        `markViewOnceMessageViewed: Message ${this.idForLogging()} is already erased!`
      );
      return;
    }

    if (this.get('readStatus') !== ReadStatus.Viewed) {
      this.set(markViewed(this.attributes));
    }

    await this.eraseContents();

    if (!fromSync) {
      const senderE164 = getSource(this.attributes);
      const senderAci = getSourceServiceId(this.attributes);
      const timestamp = this.get('sent_at');

      if (senderAci === undefined || !isAciString(senderAci)) {
        throw new Error('markViewOnceMessageViewed: senderAci is undefined');
      }

      if (window.ConversationController.areWePrimaryDevice()) {
        log.warn(
          'markViewOnceMessageViewed: We are primary device; not sending view once open sync'
        );
        return;
      }

      try {
        await viewOnceOpenJobQueue.add({
          viewOnceOpens: [
            {
              senderE164,
              senderAci,
              timestamp,
            },
          ],
        });
      } catch (error) {
        log.error(
          'markViewOnceMessageViewed: Failed to queue view once open sync',
          Errors.toLogFormat(error)
        );
      }
    }
  }

  async doubleCheckMissingQuoteReference(): Promise<void> {
    const logId = this.idForLogging();

    const storyId = this.get('storyId');
    if (storyId) {
      log.warn(
        `doubleCheckMissingQuoteReference/${logId}: missing story reference`
      );

      const message = window.MessageCache.__DEPRECATED$getById(storyId);
      if (!message) {
        return;
      }

      if (this.get('storyReplyContext')) {
        this.set('storyReplyContext', undefined);
      }
      await this.hydrateStoryContext(message.attributes, { shouldSave: true });
      return;
    }

    const quote = this.get('quote');
    if (!quote) {
      log.warn(`doubleCheckMissingQuoteReference/${logId}: Missing quote!`);
      return;
    }

    const { authorAci, author, id: sentAt, referencedMessageNotFound } = quote;
    const contact = window.ConversationController.get(authorAci || author);

    // Is the quote really without a reference? Check with our in memory store
    // first to make sure it's not there.
    if (referencedMessageNotFound && contact) {
      log.info(
        `doubleCheckMissingQuoteReference/${logId}: Verifying reference to ${sentAt}`
      );
      const inMemoryMessages = window.MessageCache.__DEPRECATED$filterBySentAt(
        Number(sentAt)
      );
      let matchingMessage = find(inMemoryMessages, message =>
        isQuoteAMatch(message.attributes, this.get('conversationId'), quote)
      );
      if (!matchingMessage) {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          Number(sentAt)
        );
        const found = messages.find(item =>
          isQuoteAMatch(item, this.get('conversationId'), quote)
        );
        if (found) {
          matchingMessage = window.MessageCache.__DEPRECATED$register(
            found.id,
            found,
            'doubleCheckMissingQuoteReference'
          );
        }
      }

      if (!matchingMessage) {
        log.info(
          `doubleCheckMissingQuoteReference/${logId}: No match for ${sentAt}.`
        );
        return;
      }

      this.set({
        quote: {
          ...quote,
          referencedMessageNotFound: false,
        },
      });

      log.info(
        `doubleCheckMissingQuoteReference/${logId}: Found match for ${sentAt}, updating.`
      );

      await this.copyQuoteContentFromOriginal(matchingMessage, quote);
      this.set({
        quote: {
          ...quote,
          referencedMessageNotFound: false,
        },
      });
      queueUpdateMessage(this.attributes);
    }
  }

  isErased(): boolean {
    return Boolean(this.get('isErased'));
  }

  async eraseContents(
    additionalProperties = {},
    shouldPersist = true
  ): Promise<void> {
    log.info(`Erasing data for message ${this.idForLogging()}`);

    // Note: There are cases where we want to re-erase a given message. For example, when
    //   a viewed (or outgoing) View-Once message is deleted for everyone.

    try {
      await this.deleteData();
    } catch (error) {
      log.error(
        `Error erasing data for message ${this.idForLogging()}:`,
        Errors.toLogFormat(error)
      );
    }

    this.set({
      attachments: [],
      body: '',
      bodyRanges: undefined,
      contact: [],
      editHistory: undefined,
      isErased: true,
      preview: [],
      quote: undefined,
      sticker: undefined,
      ...additionalProperties,
    });
    this.getConversation()?.debouncedUpdateLastMessage();

    if (shouldPersist) {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }

    await window.Signal.Data.deleteSentProtoByMessageId(this.id);
  }

  override isEmpty(): boolean {
    const { attributes } = this;

    // Core message types - we check for all four because they can each stand alone
    const hasBody = Boolean(this.get('body'));
    const hasAttachment = (this.get('attachments') || []).length > 0;
    const hasEmbeddedContact = (this.get('contact') || []).length > 0;
    const isSticker = Boolean(this.get('sticker'));

    // Rendered sync messages
    const isCallHistoryValue = isCallHistory(attributes);
    const isChatSessionRefreshedValue = isChatSessionRefreshed(attributes);
    const isDeliveryIssueValue = isDeliveryIssue(attributes);
    const isGiftBadgeValue = isGiftBadge(attributes);
    const isGroupUpdateValue = isGroupUpdate(attributes);
    const isGroupV2ChangeValue = isGroupV2Change(attributes);
    const isEndSessionValue = isEndSession(attributes);
    const isExpirationTimerUpdateValue = isExpirationTimerUpdate(attributes);
    const isVerifiedChangeValue = isVerifiedChange(attributes);

    // Placeholder messages
    const isUnsupportedMessageValue = isUnsupportedMessage(attributes);
    const isTapToViewValue = isTapToView(attributes);

    // Errors
    const hasErrorsValue = hasErrors(attributes);

    // Locally-generated notifications
    const isKeyChangeValue = isKeyChange(attributes);
    const isProfileChangeValue = isProfileChange(attributes);
    const isUniversalTimerNotificationValue =
      isUniversalTimerNotification(attributes);
    const isConversationMergeValue = isConversationMerge(attributes);
    const isPhoneNumberDiscoveryValue = isPhoneNumberDiscovery(attributes);

    const isPayment = messageHasPaymentEvent(attributes);

    // Note: not all of these message types go through message.handleDataMessage

    const hasSomethingToDisplay =
      // Core message types
      hasBody ||
      hasAttachment ||
      hasEmbeddedContact ||
      isSticker ||
      isPayment ||
      // Rendered sync messages
      isCallHistoryValue ||
      isChatSessionRefreshedValue ||
      isDeliveryIssueValue ||
      isGiftBadgeValue ||
      isGroupUpdateValue ||
      isGroupV2ChangeValue ||
      isEndSessionValue ||
      isExpirationTimerUpdateValue ||
      isVerifiedChangeValue ||
      // Placeholder messages
      isUnsupportedMessageValue ||
      isTapToViewValue ||
      // Errors
      hasErrorsValue ||
      // Locally-generated notifications
      isKeyChangeValue ||
      isProfileChangeValue ||
      isUniversalTimerNotificationValue ||
      isConversationMergeValue ||
      isPhoneNumberDiscoveryValue;

    return !hasSomethingToDisplay;
  }

  isUnidentifiedDelivery(
    contactId: string,
    unidentifiedDeliveriesSet: Readonly<Set<string>>
  ): boolean {
    if (isIncoming(this.attributes)) {
      return Boolean(this.get('unidentifiedDeliveryReceived'));
    }

    return unidentifiedDeliveriesSet.has(contactId);
  }

  async saveErrors(
    providedErrors: Error | Array<Error>,
    options: { skipSave?: boolean } = {}
  ): Promise<void> {
    const { skipSave } = options;

    let errors: Array<CustomError>;

    if (!(providedErrors instanceof Array)) {
      errors = [providedErrors];
    } else {
      errors = providedErrors;
    }

    errors.forEach(e => {
      log.error('Message.saveErrors:', Errors.toLogFormat(e));
    });
    errors = errors.map(e => {
      // Note: in our environment, instanceof can be scary, so we have a backup check
      //   (Node.js vs Browser context).
      // We check instanceof second because typescript believes that anything that comes
      //   through here must be an instance of Error, so e is 'never' after that check.
      if ((e.message && e.stack) || e instanceof Error) {
        return pick(
          e,
          'name',
          'message',
          'code',
          'number',
          'identifier',
          'retryAfter',
          'data',
          'reason'
        ) as Required<Error>;
      }
      return e;
    });
    errors = errors.concat(this.get('errors') || []);

    this.set({ errors });

    if (!skipSave && !this.doNotSave) {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }
  }

  markRead(readAt?: number, options = {}): void {
    this.set(markRead(this.attributes, readAt, options));
  }

  async retrySend(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conversation = this.getConversation()!;

    let currentConversationRecipients: Set<string> | undefined;

    const { storyDistributionListId } = this.attributes;

    if (storyDistributionListId) {
      const storyDistribution =
        await dataInterface.getStoryDistributionWithMembers(
          storyDistributionListId
        );

      if (!storyDistribution) {
        this.markFailed();
        return;
      }

      currentConversationRecipients = new Set(
        storyDistribution.members
          .map(serviceId => window.ConversationController.get(serviceId)?.id)
          .filter(isNotNil)
      );
    } else {
      currentConversationRecipients = conversation.getMemberConversationIds();
    }

    // Determine retry recipients and get their most up-to-date addressing information
    const oldSendStateByConversationId =
      this.get('sendStateByConversationId') || {};

    const newSendStateByConversationId = { ...oldSendStateByConversationId };
    for (const [conversationId, sendState] of Object.entries(
      oldSendStateByConversationId
    )) {
      if (isSent(sendState.status)) {
        continue;
      }

      const recipient = window.ConversationController.get(conversationId);
      if (
        !recipient ||
        (!currentConversationRecipients.has(conversationId) &&
          !isMe(recipient.attributes))
      ) {
        continue;
      }

      newSendStateByConversationId[conversationId] = sendStateReducer(
        sendState,
        {
          type: SendActionType.ManuallyRetried,
          updatedAt: Date.now(),
        }
      );
    }

    this.set('sendStateByConversationId', newSendStateByConversationId);

    if (isStory(this.attributes)) {
      await conversationJobQueue.add(
        {
          type: conversationQueueJobEnum.enum.Story,
          conversationId: conversation.id,
          messageIds: [this.id],
          // using the group timestamp, which will differ from the 1:1 timestamp
          timestamp: this.attributes.timestamp,
        },
        async jobToInsert => {
          await window.Signal.Data.saveMessage(this.attributes, {
            jobToInsert,
            ourAci: window.textsecure.storage.user.getCheckedAci(),
          });
        }
      );
    } else {
      await conversationJobQueue.add(
        {
          type: conversationQueueJobEnum.enum.NormalMessage,
          conversationId: conversation.id,
          messageId: this.id,
          revision: conversation.get('revision'),
        },
        async jobToInsert => {
          await window.Signal.Data.saveMessage(this.attributes, {
            jobToInsert,
            ourAci: window.textsecure.storage.user.getCheckedAci(),
          });
        }
      );
    }
  }

  isReplayableError(e: Error): boolean {
    return (
      e.name === 'MessageError' ||
      e.name === 'OutgoingMessageError' ||
      e.name === 'SendMessageNetworkError' ||
      e.name === 'SendMessageChallengeError' ||
      e.name === 'OutgoingIdentityKeyError'
    );
  }

  public hasSuccessfulDelivery(): boolean {
    const sendStateByConversationId = this.get('sendStateByConversationId');
    const withoutMe = omit(
      sendStateByConversationId,
      window.ConversationController.getOurConversationIdOrThrow()
    );
    return isEmpty(withoutMe) || someSendStatus(withoutMe, isSent);
  }

  /**
   * Change any Pending send state to Failed. Note that this will not mark successful
   * sends failed.
   */
  public markFailed(editMessageTimestamp?: number): void {
    const now = Date.now();

    const targetTimestamp = editMessageTimestamp || this.get('timestamp');
    const sendStateByConversationId = getPropForTimestamp({
      log,
      message: this.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
    });

    const newSendStateByConversationId = mapValues(
      sendStateByConversationId || {},
      sendState =>
        sendStateReducer(sendState, {
          type: SendActionType.Failed,
          updatedAt: now,
        })
    );

    const attributesToUpdate = getChangesForPropAtTimestamp({
      log,
      message: this.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
      value: newSendStateByConversationId,
    });
    if (attributesToUpdate) {
      this.set(attributesToUpdate);
    }

    // We aren't trying to send this message anymore, so we'll delete these caches
    delete this.cachedOutgoingContactData;
    delete this.cachedOutgoingPreviewData;
    delete this.cachedOutgoingQuoteData;
    delete this.cachedOutgoingStickerData;

    this.notifyStorySendFailed();
  }

  public notifyStorySendFailed(): void {
    if (!isStory(this.attributes)) {
      return;
    }

    notificationService.add({
      conversationId: this.get('conversationId'),
      storyId: this.id,
      messageId: this.id,
      senderTitle:
        this.getConversation()?.getTitle() ?? window.i18n('icu:Stories__mine'),
      message: this.hasSuccessfulDelivery()
        ? window.i18n('icu:Stories__failed-send--partial')
        : window.i18n('icu:Stories__failed-send--full'),
      isExpiringMessage: false,
      sentAt: this.get('timestamp'),
      type: NotificationType.Message,
    });
  }

  removeOutgoingErrors(incomingIdentifier: string): CustomError {
    const incomingConversationId =
      window.ConversationController.getConversationId(incomingIdentifier);
    const errors = partition(
      this.get('errors'),
      e =>
        window.ConversationController.getConversationId(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          e.serviceId || e.number!
        ) === incomingConversationId &&
        (e.name === 'MessageError' ||
          e.name === 'OutgoingMessageError' ||
          e.name === 'SendMessageNetworkError' ||
          e.name === 'SendMessageChallengeError' ||
          e.name === 'OutgoingIdentityKeyError')
    );
    this.set({ errors: errors[1] });
    return errors[0][0];
  }

  async send({
    promise,
    saveErrors,
    targetTimestamp,
  }: {
    promise: Promise<CallbackResultType | void | null>;
    saveErrors?: (errors: Array<Error>) => void;
    targetTimestamp: number;
  }): Promise<void> {
    const updateLeftPane =
      this.getConversation()?.debouncedUpdateLastMessage ?? noop;

    updateLeftPane();

    let result:
      | { success: true; value: CallbackResultType }
      | {
          success: false;
          value: CustomError | SendMessageProtoError;
        };
    try {
      const value = await (promise as Promise<CallbackResultType>);
      result = { success: true, value };
    } catch (err) {
      result = { success: false, value: err };
    }

    updateLeftPane();

    const attributesToUpdate: Partial<MessageAttributesType> = {};

    // This is used by sendSyncMessage, then set to null
    if ('dataMessage' in result.value && result.value.dataMessage) {
      attributesToUpdate.dataMessage = result.value.dataMessage;
    } else if ('editMessage' in result.value && result.value.editMessage) {
      attributesToUpdate.dataMessage = result.value.editMessage;
    }

    if (!this.doNotSave) {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }

    const sendStateByConversationId = {
      ...(getPropForTimestamp({
        log,
        message: this.attributes,
        prop: 'sendStateByConversationId',
        targetTimestamp,
      }) || {}),
    };

    const sendIsNotFinal =
      'sendIsNotFinal' in result.value && result.value.sendIsNotFinal;
    const sendIsFinal = !sendIsNotFinal;

    // Capture successful sends
    const successfulServiceIds: Array<ServiceIdString> =
      sendIsFinal &&
      'successfulServiceIds' in result.value &&
      Array.isArray(result.value.successfulServiceIds)
        ? result.value.successfulServiceIds
        : [];
    const sentToAtLeastOneRecipient =
      result.success || Boolean(successfulServiceIds.length);

    successfulServiceIds.forEach(serviceId => {
      const conversation = window.ConversationController.get(serviceId);
      if (!conversation) {
        return;
      }

      // If we successfully sent to a user, we can remove our unregistered flag.
      if (conversation.isEverUnregistered()) {
        conversation.setRegistered();
      }

      const previousSendState = getOwn(
        sendStateByConversationId,
        conversation.id
      );
      if (previousSendState) {
        sendStateByConversationId[conversation.id] = sendStateReducer(
          previousSendState,
          {
            type: SendActionType.Sent,
            updatedAt: Date.now(),
          }
        );
      }
    });

    // Integrate sends via sealed sender
    const latestEditTimestamp = this.get('editMessageTimestamp');
    const sendIsLatest =
      !latestEditTimestamp || targetTimestamp === latestEditTimestamp;
    const previousUnidentifiedDeliveries =
      this.get('unidentifiedDeliveries') || [];
    const newUnidentifiedDeliveries =
      sendIsLatest &&
      sendIsFinal &&
      'unidentifiedDeliveries' in result.value &&
      Array.isArray(result.value.unidentifiedDeliveries)
        ? result.value.unidentifiedDeliveries
        : [];

    const promises: Array<Promise<unknown>> = [];

    // Process errors
    let errors: Array<CustomError>;
    if (result.value instanceof SendMessageProtoError && result.value.errors) {
      ({ errors } = result.value);
    } else if (isCustomError(result.value)) {
      errors = [result.value];
    } else if (Array.isArray(result.value.errors)) {
      ({ errors } = result.value);
    } else {
      errors = [];
    }

    // In groups, we don't treat unregistered users as a user-visible
    //   error. The message will look successful, but the details
    //   screen will show that we didn't send to these unregistered users.
    const errorsToSave: Array<CustomError> = [];

    errors.forEach(error => {
      const conversation =
        window.ConversationController.get(error.serviceId) ||
        window.ConversationController.get(error.number);

      if (conversation && !saveErrors && sendIsFinal) {
        const previousSendState = getOwn(
          sendStateByConversationId,
          conversation.id
        );
        if (previousSendState) {
          sendStateByConversationId[conversation.id] = sendStateReducer(
            previousSendState,
            {
              type: SendActionType.Failed,
              updatedAt: Date.now(),
            }
          );
          this.notifyStorySendFailed();
        }
      }

      let shouldSaveError = true;
      switch (error.name) {
        case 'OutgoingIdentityKeyError': {
          if (conversation) {
            promises.push(conversation.getProfiles());
          }
          break;
        }
        case 'UnregisteredUserError':
          if (conversation && isGroup(conversation.attributes)) {
            shouldSaveError = false;
          }
          // If we just found out that we couldn't send to a user because they are no
          //   longer registered, we will update our unregistered flag. In groups we
          //   will not event try to send to them for 6 hours. And we will never try
          //   to fetch them on startup again.
          //
          // The way to discover registration once more is:
          //   1) any attempt to send to them in 1:1 conversation
          //   2) the six-hour time period has passed and we send in a group again
          conversation?.setUnregistered();
          break;
        default:
          break;
      }

      if (shouldSaveError) {
        errorsToSave.push(error);
      }
    });

    // Only update the expirationStartTimestamp if we don't already have one set
    if (!this.get('expirationStartTimestamp')) {
      attributesToUpdate.expirationStartTimestamp = sentToAtLeastOneRecipient
        ? Date.now()
        : undefined;
    }
    attributesToUpdate.unidentifiedDeliveries = union(
      previousUnidentifiedDeliveries,
      newUnidentifiedDeliveries
    );
    // We may overwrite this in the `saveErrors` call below.
    attributesToUpdate.errors = [];

    const additionalProps = getChangesForPropAtTimestamp({
      log,
      message: this.attributes,
      prop: 'sendStateByConversationId',
      targetTimestamp,
      value: sendStateByConversationId,
    });

    this.set({ ...attributesToUpdate, ...additionalProps });
    if (saveErrors) {
      saveErrors(errorsToSave);
    } else {
      // We skip save because we'll save in the next step.
      void this.saveErrors(errorsToSave, { skipSave: true });
    }

    if (!this.doNotSave) {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }

    updateLeftPane();

    if (sentToAtLeastOneRecipient && !this.doNotSendSyncMessage) {
      promises.push(this.sendSyncMessage(targetTimestamp));
    }

    await Promise.all(promises);

    const isTotalSuccess: boolean =
      result.success && !this.get('errors')?.length;

    if (isTotalSuccess) {
      delete this.cachedOutgoingContactData;
      delete this.cachedOutgoingPreviewData;
      delete this.cachedOutgoingQuoteData;
      delete this.cachedOutgoingStickerData;
    }

    updateLeftPane();
  }

  async sendSyncMessageOnly({
    targetTimestamp,
    dataMessage,
    saveErrors,
  }: {
    targetTimestamp: number;
    dataMessage: Uint8Array;
    saveErrors?: (errors: Array<Error>) => void;
  }): Promise<CallbackResultType | void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conv = this.getConversation()!;
    this.set({ dataMessage });

    const updateLeftPane = conv?.debouncedUpdateLastMessage;

    try {
      this.set({
        // This is the same as a normal send()
        expirationStartTimestamp: Date.now(),
        errors: [],
      });
      const result = await this.sendSyncMessage(targetTimestamp);
      this.set({
        // We have to do this afterward, since we didn't have a previous send!
        unidentifiedDeliveries:
          result && result.unidentifiedDeliveries
            ? result.unidentifiedDeliveries
            : undefined,
      });
      return result;
    } catch (error) {
      const resultErrors = error?.errors;
      const errors = Array.isArray(resultErrors)
        ? resultErrors
        : [new Error('Unknown error')];
      if (saveErrors) {
        saveErrors(errors);
      } else {
        // We don't save because we're about to save below.
        void this.saveErrors(errors, { skipSave: true });
      }
      throw error;
    } finally {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });

      if (updateLeftPane) {
        updateLeftPane();
      }
    }
  }

  async sendSyncMessage(
    targetTimestamp: number
  ): Promise<CallbackResultType | void> {
    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();
    const sendOptions = await getSendOptions(ourConversation.attributes, {
      syncMessage: true,
    });

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'sendSyncMessage: We are primary device; not sending sync message'
      );
      this.set({ dataMessage: undefined });
      return;
    }

    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('sendSyncMessage: messaging not available!');
    }

    this.syncPromise = this.syncPromise || Promise.resolve();
    const next = async () => {
      const dataMessage = this.get('dataMessage');
      if (!dataMessage) {
        return;
      }

      const originalTimestamp = getMessageSentTimestamp(this.attributes, {
        includeEdits: false,
        log,
      });
      const isSendingEdit = targetTimestamp !== originalTimestamp;

      const isUpdate = Boolean(this.get('synced')) && !isSendingEdit;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const conv = this.getConversation()!;

      const sendEntries = Object.entries(
        getPropForTimestamp({
          log,
          message: this.attributes,
          prop: 'sendStateByConversationId',
          targetTimestamp,
        }) || {}
      );
      const sentEntries = filter(sendEntries, ([_conversationId, { status }]) =>
        isSent(status)
      );
      const allConversationIdsSentTo = map(
        sentEntries,
        ([conversationId]) => conversationId
      );
      const conversationIdsSentTo = filter(
        allConversationIdsSentTo,
        conversationId => conversationId !== ourConversation.id
      );

      const unidentifiedDeliveries = this.get('unidentifiedDeliveries') || [];
      const maybeConversationsWithSealedSender = map(
        unidentifiedDeliveries,
        identifier => window.ConversationController.get(identifier)
      );
      const conversationsWithSealedSender = filter(
        maybeConversationsWithSealedSender,
        isNotNil
      );
      const conversationIdsWithSealedSender = new Set(
        map(conversationsWithSealedSender, c => c.id)
      );

      const encodedContent = isSendingEdit
        ? {
            encodedEditMessage: dataMessage,
          }
        : {
            encodedDataMessage: dataMessage,
          };

      return handleMessageSend(
        messaging.sendSyncMessage({
          ...encodedContent,
          timestamp: targetTimestamp,
          destination: conv.get('e164'),
          destinationServiceId: conv.getServiceId(),
          expirationStartTimestamp:
            this.get('expirationStartTimestamp') || null,
          conversationIdsSentTo,
          conversationIdsWithSealedSender,
          isUpdate,
          options: sendOptions,
          urgent: false,
        }),
        // Note: in some situations, for doNotSave messages, the message has no
        //   id, so we provide an empty array here.
        { messageIds: this.id ? [this.id] : [], sendType: 'sentSync' }
      ).then(async result => {
        let newSendStateByConversationId: undefined | SendStateByConversationId;
        const sendStateByConversationId =
          getPropForTimestamp({
            log,
            message: this.attributes,
            prop: 'sendStateByConversationId',
            targetTimestamp,
          }) || {};
        const ourOldSendState = getOwn(
          sendStateByConversationId,
          ourConversation.id
        );
        if (ourOldSendState) {
          const ourNewSendState = sendStateReducer(ourOldSendState, {
            type: SendActionType.Sent,
            updatedAt: Date.now(),
          });
          if (ourNewSendState !== ourOldSendState) {
            newSendStateByConversationId = {
              ...sendStateByConversationId,
              [ourConversation.id]: ourNewSendState,
            };
          }
        }

        const attributesForUpdate = newSendStateByConversationId
          ? getChangesForPropAtTimestamp({
              log,
              message: this.attributes,
              prop: 'sendStateByConversationId',
              value: newSendStateByConversationId,
              targetTimestamp,
            })
          : null;

        this.set({
          synced: true,
          dataMessage: null,
          ...attributesForUpdate,
        });

        // Return early, skip the save
        if (this.doNotSave) {
          return result;
        }

        await window.Signal.Data.saveMessage(this.attributes, {
          ourAci: window.textsecure.storage.user.getCheckedAci(),
        });
        return result;
      });
    };

    this.syncPromise = this.syncPromise.then(next, next);

    return this.syncPromise;
  }

  hasRequiredAttachmentDownloads(): boolean {
    const attachments: ReadonlyArray<AttachmentType> =
      this.get('attachments') || [];

    const hasLongMessageAttachments = attachments.some(attachment => {
      return MIME.isLongMessage(attachment.contentType);
    });

    if (hasLongMessageAttachments) {
      return true;
    }

    const sticker = this.get('sticker');
    if (sticker) {
      return !sticker.data || !sticker.data.path;
    }

    return false;
  }

  hasAttachmentDownloads(): boolean {
    return hasAttachmentDownloads(this.attributes);
  }

  async queueAttachmentDownloads(): Promise<boolean> {
    const value = await queueAttachmentDownloads(this.attributes);
    if (!value) {
      return false;
    }

    this.set(value);
    return true;
  }

  markAttachmentAsCorrupted(attachment: AttachmentType): void {
    if (!attachment.path) {
      throw new Error(
        "Attachment can't be marked as corrupted because it wasn't loaded"
      );
    }

    // We intentionally don't check in quotes/stickers/contacts/... here,
    // because this function should be called only for something that can
    // be displayed as a generic attachment.
    const attachments: ReadonlyArray<AttachmentType> =
      this.get('attachments') || [];

    let changed = false;
    const newAttachments = attachments.map(existing => {
      if (existing.path !== attachment.path) {
        return existing;
      }
      changed = true;

      return {
        ...existing,
        isCorrupted: true,
      };
    });

    if (!changed) {
      throw new Error(
        "Attachment can't be marked as corrupted because it wasn't found"
      );
    }

    log.info('markAttachmentAsCorrupted: marking an attachment as corrupted');

    this.set({
      attachments: newAttachments,
    });
  }

  async copyFromQuotedMessage(
    quote: ProcessedQuote | undefined,
    conversationId: string
  ): Promise<QuotedMessageType | undefined> {
    if (!quote) {
      return undefined;
    }

    const { id } = quote;
    strictAssert(id, 'Quote must have an id');

    const result: QuotedMessageType = {
      ...quote,

      id,

      attachments: quote.attachments.slice(),
      bodyRanges: quote.bodyRanges?.slice(),

      // Just placeholder values for the fields
      referencedMessageNotFound: false,
      isGiftBadge: quote.type === Proto.DataMessage.Quote.Type.GIFT_BADGE,
      isViewOnce: false,
      messageId: '',
    };

    const inMemoryMessages =
      window.MessageCache.__DEPRECATED$filterBySentAt(id);
    const matchingMessage = find(inMemoryMessages, item =>
      isQuoteAMatch(item.attributes, conversationId, result)
    );

    let queryMessage: undefined | MessageModel;

    if (matchingMessage) {
      queryMessage = matchingMessage;
    } else {
      log.info('copyFromQuotedMessage: db lookup needed', id);
      const messages = await window.Signal.Data.getMessagesBySentAt(id);
      const found = messages.find(item =>
        isQuoteAMatch(item, conversationId, result)
      );

      if (!found) {
        result.referencedMessageNotFound = true;
        return result;
      }

      queryMessage = window.MessageCache.__DEPRECATED$register(
        found.id,
        found,
        'copyFromQuotedMessage'
      );
    }

    if (queryMessage) {
      await this.copyQuoteContentFromOriginal(queryMessage, result);
    }

    return result;
  }

  async copyQuoteContentFromOriginal(
    originalMessage: MessageModel,
    quote: QuotedMessageType
  ): Promise<void> {
    const { attachments } = quote;
    const firstAttachment = attachments ? attachments[0] : undefined;
    const firstThumbnailCdnFields = copyCdnFields(firstAttachment?.thumbnail);

    if (messageHasPaymentEvent(originalMessage.attributes)) {
      // eslint-disable-next-line no-param-reassign
      quote.payment = originalMessage.get('payment');
    }

    if (isTapToView(originalMessage.attributes)) {
      // eslint-disable-next-line no-param-reassign
      quote.text = undefined;
      // eslint-disable-next-line no-param-reassign
      quote.attachments = [
        {
          contentType: MIME.IMAGE_JPEG,
        },
      ];
      // eslint-disable-next-line no-param-reassign
      quote.isViewOnce = true;

      return;
    }

    const isMessageAGiftBadge = isGiftBadge(originalMessage.attributes);
    if (isMessageAGiftBadge !== quote.isGiftBadge) {
      log.warn(
        `copyQuoteContentFromOriginal: Quote.isGiftBadge: ${quote.isGiftBadge}, isGiftBadge(message): ${isMessageAGiftBadge}`
      );
      // eslint-disable-next-line no-param-reassign
      quote.isGiftBadge = isMessageAGiftBadge;
    }
    if (isMessageAGiftBadge) {
      // eslint-disable-next-line no-param-reassign
      quote.text = undefined;
      // eslint-disable-next-line no-param-reassign
      quote.attachments = [];

      return;
    }

    // eslint-disable-next-line no-param-reassign
    quote.isViewOnce = false;

    // eslint-disable-next-line no-param-reassign
    quote.text = getQuoteBodyText(originalMessage.attributes, quote.id);

    // eslint-disable-next-line no-param-reassign
    quote.bodyRanges = originalMessage.attributes.bodyRanges;

    if (firstAttachment) {
      firstAttachment.thumbnail = null;
    }

    if (!firstAttachment || !firstAttachment.contentType) {
      return;
    }

    try {
      const schemaVersion = originalMessage.get('schemaVersion');
      if (
        schemaVersion &&
        schemaVersion < TypedMessage.VERSION_NEEDED_FOR_DISPLAY
      ) {
        const upgradedMessage = await upgradeMessageSchema(
          originalMessage.attributes
        );
        originalMessage.set(upgradedMessage);
        await window.Signal.Data.saveMessage(upgradedMessage, {
          ourAci: window.textsecure.storage.user.getCheckedAci(),
        });
      }
    } catch (error) {
      log.error(
        'Problem upgrading message quoted message from database',
        Errors.toLogFormat(error)
      );
      return;
    }

    const queryAttachments = originalMessage.get('attachments') || [];
    if (queryAttachments.length > 0) {
      const queryFirst = queryAttachments[0];
      const { thumbnail } = queryFirst;

      if (thumbnail && thumbnail.path) {
        firstAttachment.thumbnail = {
          ...firstThumbnailCdnFields,
          ...thumbnail,
          copied: true,
        };
      } else {
        firstAttachment.contentType = queryFirst.contentType;
        firstAttachment.fileName = queryFirst.fileName;
        firstAttachment.thumbnail = null;
      }
    }

    const queryPreview = originalMessage.get('preview') || [];
    if (queryPreview.length > 0) {
      const queryFirst = queryPreview[0];
      const { image } = queryFirst;

      if (image && image.path) {
        firstAttachment.thumbnail = {
          ...firstThumbnailCdnFields,
          ...image,
          copied: true,
        };
      }
    }

    const sticker = originalMessage.get('sticker');
    if (sticker && sticker.data && sticker.data.path) {
      firstAttachment.thumbnail = {
        ...firstThumbnailCdnFields,
        ...sticker.data,
        copied: true,
      };
    }
  }

  async handleDataMessage(
    initialMessage: ProcessedDataMessage,
    confirm: () => void,
    options: { data?: SentEventData } = {}
  ): Promise<void> {
    const { data } = options;

    // This function is called from the background script in a few scenarios:
    //   1. on an incoming message
    //   2. on a sent message sync'd from another device
    //   3. in rare cases, an incoming message can be retried, though it will
    //      still go through one of the previous two codepaths
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let message: MessageModel = this;
    const source = message.get('source');
    const sourceServiceId = message.get('sourceServiceId');
    const type = message.get('type');
    const conversationId = message.get('conversationId');

    const fromContact = getContact(this.attributes);
    if (fromContact) {
      fromContact.setRegistered();
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conversation = window.ConversationController.get(conversationId)!;
    const idLog = `handleDataMessage/${conversation.idForLogging()} ${message.idForLogging()}`;
    await conversation.queueJob(idLog, async () => {
      log.info(`${idLog}: starting processing in queue`);

      // First, check for duplicates. If we find one, stop processing here.
      const inMemoryMessage = window.MessageCache.findBySender(
        this.getSenderIdentifier()
      );
      if (inMemoryMessage) {
        log.info(`${idLog}: cache hit`, this.getSenderIdentifier());
      } else {
        log.info(
          `${idLog}: duplicate check db lookup needed`,
          this.getSenderIdentifier()
        );
      }
      const existingMessage =
        inMemoryMessage || (await getMessageBySender(this.attributes));
      const isUpdate = Boolean(data && data.isRecipientUpdate);

      const isDuplicateMessage =
        existingMessage &&
        (type === 'incoming' ||
          (type === 'story' &&
            existingMessage.storyDistributionListId ===
              this.attributes.storyDistributionListId));

      if (isDuplicateMessage) {
        log.warn(`${idLog}: Received duplicate message`, this.idForLogging());
        confirm();
        return;
      }
      if (type === 'outgoing') {
        if (isUpdate && existingMessage) {
          log.info(
            `${idLog}: Updating message ${message.idForLogging()} with received transcript`
          );

          const toUpdate = window.MessageCache.__DEPRECATED$register(
            existingMessage.id,
            existingMessage,
            'handleDataMessage/outgoing/toUpdate'
          );

          const unidentifiedDeliveriesSet = new Set<string>(
            toUpdate.get('unidentifiedDeliveries') ?? []
          );
          const sendStateByConversationId = {
            ...(toUpdate.get('sendStateByConversationId') || {}),
          };

          const unidentifiedStatus: Array<ProcessedUnidentifiedDeliveryStatus> =
            data && Array.isArray(data.unidentifiedStatus)
              ? data.unidentifiedStatus
              : [];

          unidentifiedStatus.forEach(
            ({ destinationServiceId, destination, unidentified }) => {
              const identifier = destinationServiceId || destination;
              if (!identifier) {
                return;
              }

              const destinationConversation =
                window.ConversationController.lookupOrCreate({
                  serviceId: destinationServiceId,
                  e164: destination || undefined,
                  reason: `handleDataMessage(${initialMessage.timestamp})`,
                });
              if (!destinationConversation) {
                return;
              }

              const updatedAt: number =
                data && isNormalNumber(data.timestamp)
                  ? data.timestamp
                  : Date.now();

              const previousSendState = getOwn(
                sendStateByConversationId,
                destinationConversation.id
              );
              sendStateByConversationId[destinationConversation.id] =
                previousSendState
                  ? sendStateReducer(previousSendState, {
                      type: SendActionType.Sent,
                      updatedAt,
                    })
                  : {
                      status: SendStatus.Sent,
                      updatedAt,
                    };

              if (unidentified) {
                unidentifiedDeliveriesSet.add(identifier);
              }
            }
          );

          toUpdate.set({
            sendStateByConversationId,
            unidentifiedDeliveries: [...unidentifiedDeliveriesSet],
          });
          await window.Signal.Data.saveMessage(toUpdate.attributes, {
            ourAci: window.textsecure.storage.user.getCheckedAci(),
          });

          confirm();
          return;
        }
        if (isUpdate) {
          log.warn(
            `${idLog}: Received update transcript, but no existing entry for message ${message.idForLogging()}. Dropping.`
          );

          confirm();
          return;
        }
        if (existingMessage) {
          log.warn(
            `${idLog}: Received duplicate transcript for message ${message.idForLogging()}, but it was not an update transcript. Dropping.`
          );

          confirm();
          return;
        }
      }

      // GroupV2

      if (initialMessage.groupV2) {
        if (isGroupV1(conversation.attributes)) {
          // If we received a GroupV2 message in a GroupV1 group, we migrate!

          const { revision, groupChange } = initialMessage.groupV2;
          await window.Signal.Groups.respondToGroupV2Migration({
            conversation,
            groupChange: groupChange
              ? {
                  base64: groupChange,
                  isTrusted: false,
                }
              : undefined,
            newRevision: revision,
            receivedAt: message.get('received_at'),
            sentAt: message.get('sent_at'),
          });
        } else if (
          initialMessage.groupV2.masterKey &&
          initialMessage.groupV2.secretParams &&
          initialMessage.groupV2.publicParams
        ) {
          // Repair core GroupV2 data if needed
          await conversation.maybeRepairGroupV2({
            masterKey: initialMessage.groupV2.masterKey,
            secretParams: initialMessage.groupV2.secretParams,
            publicParams: initialMessage.groupV2.publicParams,
          });

          const existingRevision = conversation.get('revision');
          const isFirstUpdate = !isNumber(existingRevision);

          // Standard GroupV2 modification codepath
          const isV2GroupUpdate =
            initialMessage.groupV2 &&
            isNumber(initialMessage.groupV2.revision) &&
            (isFirstUpdate ||
              initialMessage.groupV2.revision > existingRevision);

          if (isV2GroupUpdate && initialMessage.groupV2) {
            const { revision, groupChange } = initialMessage.groupV2;
            try {
              await window.Signal.Groups.maybeUpdateGroup({
                conversation,
                groupChange: groupChange
                  ? {
                      base64: groupChange,
                      isTrusted: false,
                    }
                  : undefined,
                newRevision: revision,
                receivedAt: message.get('received_at'),
                sentAt: message.get('sent_at'),
              });
            } catch (error) {
              const errorText = Errors.toLogFormat(error);
              log.error(
                `${idLog}: Failed to process group update as part of message ${message.idForLogging()}: ${errorText}`
              );
              throw error;
            }
          }
        }
      }

      const ourAci = window.textsecure.storage.user.getCheckedAci();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const sender = window.ConversationController.lookupOrCreate({
        e164: source,
        serviceId: sourceServiceId,
        reason: 'handleDataMessage',
      })!;
      const hasGroupV2Prop = Boolean(initialMessage.groupV2);

      // Drop if from blocked user. Only GroupV2 messages should need to be dropped here.
      const isBlocked =
        (source && window.storage.blocked.isBlocked(source)) ||
        (sourceServiceId &&
          window.storage.blocked.isServiceIdBlocked(sourceServiceId));
      if (isBlocked) {
        log.info(
          `${idLog}: Dropping message from blocked sender. hasGroupV2Prop: ${hasGroupV2Prop}`
        );

        confirm();
        return;
      }

      const areWeMember =
        !conversation.get('left') && conversation.hasMember(ourAci);

      // Drop an incoming GroupV2 message if we or the sender are not part of the group
      //   after applying the message's associated group changes.
      if (
        type === 'incoming' &&
        !isDirectConversation(conversation.attributes) &&
        hasGroupV2Prop &&
        (!areWeMember ||
          (sourceServiceId && !conversation.hasMember(sourceServiceId)))
      ) {
        log.warn(
          `${idLog}: Received message destined for group, which we or the sender are not a part of. Dropping.`
        );
        confirm();
        return;
      }

      // We drop incoming messages for v1 groups we already know about, which we're not
      //   a part of, except for group updates. Because group v1 updates haven't been
      //   applied by this point.
      // Note: if we have no information about a group at all, we will accept those
      //   messages. We detect that via a missing 'members' field.
      if (
        type === 'incoming' &&
        !isDirectConversation(conversation.attributes) &&
        !hasGroupV2Prop &&
        conversation.get('members') &&
        !areWeMember
      ) {
        log.warn(
          `Received message destined for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
        );
        confirm();
        return;
      }

      // Drop incoming messages to announcement only groups where sender is not admin
      if (conversation.get('announcementsOnly')) {
        const senderServiceId = sender.getServiceId();
        if (!senderServiceId || !conversation.isAdmin(senderServiceId)) {
          confirm();
          return;
        }
      }

      const messageId = message.get('id') || generateUuid();

      // Send delivery receipts, but only for non-story sealed sender messages
      //   and not for messages from unaccepted conversations
      if (
        type === 'incoming' &&
        this.get('unidentifiedDeliveryReceived') &&
        !hasErrors(this.attributes) &&
        conversation.getAccepted()
      ) {
        // Note: We both queue and batch because we want to wait until we are done
        //   processing incoming messages to start sending outgoing delivery receipts.
        //   The queue can be paused easily.
        drop(
          window.Whisper.deliveryReceiptQueue.add(() => {
            strictAssert(
              isAciString(sourceServiceId),
              'Incoming message must be from ACI'
            );
            window.Whisper.deliveryReceiptBatcher.add({
              messageId,
              conversationId,
              senderE164: source,
              senderAci: sourceServiceId,
              timestamp: this.get('sent_at'),
              isDirectConversation: isDirectConversation(
                conversation.attributes
              ),
            });
          })
        );
      }

      const { storyContext } = initialMessage;
      let storyContextLogId = 'no storyContext';
      if (storyContext) {
        storyContextLogId =
          `storyContext(${storyContext.sentTimestamp}, ` +
          `${storyContext.authorAci})`;
      }

      const [quote, storyQuotes] = await Promise.all([
        this.copyFromQuotedMessage(initialMessage.quote, conversation.id),
        findStoryMessages(conversation.id, storyContext),
      ]);

      const storyQuote = storyQuotes.find(candidateQuote => {
        const sendStateByConversationId =
          candidateQuote.get('sendStateByConversationId') || {};
        const sendState = sendStateByConversationId[sender.id];

        const storyQuoteIsFromSelf =
          candidateQuote.get('sourceServiceId') ===
          window.storage.user.getCheckedAci();

        if (!storyQuoteIsFromSelf) {
          return true;
        }

        // The sender is not a recipient for this story
        if (sendState === undefined) {
          return false;
        }

        // Group replies are always allowed
        if (!isDirectConversation(conversation.attributes)) {
          return true;
        }

        // For 1:1 stories, we need to check if they can be replied to
        return sendState.isAllowedToReplyToStory !== false;
      });

      if (storyContext && !storyQuote) {
        if (!isDirectConversation(conversation.attributes)) {
          log.warn(
            `${idLog}: Received ${storyContextLogId} message in group but no matching story. Dropping.`
          );

          confirm();
          return;
        }

        if (storyQuotes.length === 0) {
          log.warn(
            `${idLog}: Received ${storyContextLogId} message but no matching story. We'll try processing this message again later.`
          );
          return;
        }

        log.warn(
          `${idLog}: Received ${storyContextLogId} message in 1:1 conversation but no matching story. Dropping.`
        );
        confirm();
        return;
      }

      if (storyQuote) {
        const storyDistributionListId = storyQuote.get(
          'storyDistributionListId'
        );

        if (storyDistributionListId) {
          const storyDistribution =
            await dataInterface.getStoryDistributionWithMembers(
              storyDistributionListId
            );

          if (!storyDistribution) {
            log.warn(
              `${idLog}: Received ${storyContextLogId} message for story with no associated distribution list. Dropping.`
            );

            confirm();
            return;
          }

          if (!storyDistribution.allowsReplies) {
            log.warn(
              `${idLog}: Received ${storyContextLogId} message but distribution list does not allow replies. Dropping.`
            );

            confirm();
            return;
          }
        }
      }

      const withQuoteReference = {
        ...message.attributes,
        ...initialMessage,
        quote,
        storyId: storyQuote?.id,
      };

      // There are type conflicts between ModelAttributesType and protos passed in here
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataMessage = await upgradeMessageSchema(withQuoteReference as any);

      const isGroupStoryReply =
        isGroup(conversation.attributes) && dataMessage.storyId;

      try {
        const now = new Date().getTime();

        const urls = LinkPreview.findLinks(dataMessage.body || '');
        const incomingPreview = dataMessage.preview || [];
        const preview = incomingPreview.filter((item: LinkPreviewType) => {
          if (!item.image && !item.title) {
            return false;
          }
          // Story link previews don't have to correspond to links in the
          // message body.
          if (isStory(message.attributes)) {
            return true;
          }
          return (
            urls.includes(item.url) && LinkPreview.shouldPreviewHref(item.url)
          );
        });
        if (preview.length < incomingPreview.length) {
          log.info(
            `${message.idForLogging()}: Eliminated ${
              preview.length - incomingPreview.length
            } previews with invalid urls'`
          );
        }

        const ourPni = window.textsecure.storage.user.getCheckedPni();
        const ourServiceIds: Set<ServiceIdString> = new Set([ourAci, ourPni]);

        window.MessageCache.toMessageAttributes(this.attributes);
        message.set({
          id: messageId,
          attachments: dataMessage.attachments,
          body: dataMessage.body,
          bodyRanges: dataMessage.bodyRanges,
          contact: dataMessage.contact,
          conversationId: conversation.id,
          decrypted_at: now,
          errors: [],
          flags: dataMessage.flags,
          giftBadge: initialMessage.giftBadge,
          hasAttachments: dataMessage.hasAttachments,
          hasFileAttachments: dataMessage.hasFileAttachments,
          hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
          isViewOnce: Boolean(dataMessage.isViewOnce),
          mentionsMe: (dataMessage.bodyRanges ?? []).some(bodyRange => {
            if (!BodyRange.isMention(bodyRange)) {
              return false;
            }
            return ourServiceIds.has(
              normalizeServiceId(
                bodyRange.mentionAci,
                'handleDataMessage: mentionsMe check'
              )
            );
          }),
          preview,
          requiredProtocolVersion:
            dataMessage.requiredProtocolVersion ||
            this.INITIAL_PROTOCOL_VERSION,
          supportedVersionAtReceive: this.CURRENT_PROTOCOL_VERSION,
          payment: dataMessage.payment,
          quote: dataMessage.quote,
          schemaVersion: dataMessage.schemaVersion,
          sticker: dataMessage.sticker,
          storyId: dataMessage.storyId,
        });

        if (storyQuote) {
          await this.hydrateStoryContext(storyQuote.attributes, {
            shouldSave: true,
          });
        }

        const isSupported = !isUnsupportedMessage(message.attributes);
        if (!isSupported) {
          await message.eraseContents();
        }

        if (isSupported) {
          const attributes = {
            ...conversation.attributes,
          };

          // Drop empty messages after. This needs to happen after the initial
          // message.set call and after GroupV1 processing to make sure all possible
          // properties are set before we determine that a message is empty.
          if (message.isEmpty()) {
            log.info(`${idLog}: Dropping empty message`);
            confirm();
            return;
          }

          if (isStory(message.attributes)) {
            attributes.hasPostedStory = true;
          } else {
            attributes.active_at = now;
          }

          conversation.set(attributes);

          // Sync group story reply expiration timers with the parent story's
          // expiration timer
          if (isGroupStoryReply && storyQuote) {
            message.set({
              expireTimer: storyQuote.get('expireTimer'),
              expirationStartTimestamp: storyQuote.get(
                'expirationStartTimestamp'
              ),
            });
          }

          if (
            dataMessage.expireTimer &&
            !isExpirationTimerUpdate(dataMessage)
          ) {
            message.set({ expireTimer: dataMessage.expireTimer });
            if (isStory(message.attributes)) {
              log.info(`${idLog}: Starting story expiration`);
              message.set({
                expirationStartTimestamp: dataMessage.timestamp,
              });
            }
          }

          if (!hasGroupV2Prop && !isStory(message.attributes)) {
            if (isExpirationTimerUpdate(message.attributes)) {
              message.set({
                expirationTimerUpdate: {
                  source,
                  sourceServiceId,
                  expireTimer: initialMessage.expireTimer,
                },
              });

              if (conversation.get('expireTimer') !== dataMessage.expireTimer) {
                log.info('Incoming expirationTimerUpdate changed timer', {
                  id: conversation.idForLogging(),
                  expireTimer: dataMessage.expireTimer || 'disabled',
                  source: idLog,
                });
                conversation.set({
                  expireTimer: dataMessage.expireTimer,
                });
              }
            }

            // Note: For incoming expire timer updates (not normal messages that come
            //   along with an expireTimer), the conversation will be updated by this
            //   point and these calls will return early.
            if (dataMessage.expireTimer) {
              void conversation.updateExpirationTimer(dataMessage.expireTimer, {
                source: sourceServiceId || source,
                receivedAt: message.get('received_at'),
                receivedAtMS: message.get('received_at_ms'),
                sentAt: message.get('sent_at'),
                fromGroupUpdate: isGroupUpdate(message.attributes),
                reason: idLog,
              });
            } else if (
              // We won't turn off timers for these kinds of messages:
              !isGroupUpdate(message.attributes) &&
              !isEndSession(message.attributes)
            ) {
              void conversation.updateExpirationTimer(undefined, {
                source: sourceServiceId || source,
                receivedAt: message.get('received_at'),
                receivedAtMS: message.get('received_at_ms'),
                sentAt: message.get('sent_at'),
                reason: idLog,
              });
            }
          }

          if (initialMessage.profileKey) {
            const { profileKey } = initialMessage;
            if (
              source === window.textsecure.storage.user.getNumber() ||
              sourceServiceId === window.textsecure.storage.user.getAci()
            ) {
              conversation.set({ profileSharing: true });
            } else if (isDirectConversation(conversation.attributes)) {
              void conversation.setProfileKey(profileKey);
            } else {
              const local = window.ConversationController.lookupOrCreate({
                e164: source,
                serviceId: sourceServiceId,
                reason: 'handleDataMessage:setProfileKey',
              });
              void local?.setProfileKey(profileKey);
            }
          }

          if (isTapToView(message.attributes) && type === 'outgoing') {
            await message.eraseContents();
          }

          if (
            type === 'incoming' &&
            isTapToView(message.attributes) &&
            !message.isValidTapToView()
          ) {
            log.warn(
              `${idLog}: Received tap to view message with invalid data. Erasing contents.`
            );
            message.set({
              isTapToViewInvalid: true,
            });
            await message.eraseContents();
          }
        }

        const conversationTimestamp = conversation.get('timestamp');
        if (
          !isStory(message.attributes) &&
          !isGroupStoryReply &&
          (!conversationTimestamp ||
            message.get('sent_at') > conversationTimestamp) &&
          messageHasPaymentEvent(message.attributes)
        ) {
          conversation.set({
            lastMessage: message.getNotificationText(),
            lastMessageAuthor: getMessageAuthorText(message.attributes),
            timestamp: message.get('sent_at'),
          });
        }

        message = window.MessageCache.__DEPRECATED$register(
          message.id,
          message,
          'handleDataMessage/message'
        );
        conversation.incrementMessageCount();

        // If we sent a message in a given conversation, unarchive it!
        if (type === 'outgoing') {
          conversation.setArchived(false);
        }

        window.Signal.Data.updateConversation(conversation.attributes);

        const reduxState = window.reduxStore.getState();

        const giftBadge = message.get('giftBadge');
        if (giftBadge) {
          const { level } = giftBadge;
          const { updatesUrl } = window.SignalContext.config;
          strictAssert(
            typeof updatesUrl === 'string',
            'getProfile: expected updatesUrl to be a defined string'
          );
          const userLanguages = getUserLanguages(
            window.SignalContext.getPreferredSystemLocales(),
            window.SignalContext.getResolvedMessagesLocale()
          );
          const { messaging } = window.textsecure;
          if (!messaging) {
            throw new Error(`${idLog}: messaging is not available`);
          }
          const response = await messaging.server.getSubscriptionConfiguration(
            userLanguages
          );
          const boostBadgesByLevel = parseBoostBadgeListFromServer(
            response,
            updatesUrl
          );
          const badge = boostBadgesByLevel[level];
          if (!badge) {
            log.error(
              `${idLog}: gift badge with level ${level} not found on server`
            );
          } else {
            await window.reduxActions.badges.updateOrCreate([badge]);
            giftBadge.id = badge.id;
          }
        }

        // Only queue attachments for downloads if this is a story or
        // outgoing message or we've accepted the conversation
        const attachments = this.get('attachments') || [];

        let queueStoryForDownload = false;
        if (isStory(message.attributes)) {
          queueStoryForDownload = await shouldDownloadStory(
            conversation.attributes
          );
        }

        const shouldHoldOffDownload =
          (isStory(message.attributes) && !queueStoryForDownload) ||
          (!isStory(message.attributes) &&
            (isImage(attachments) || isVideo(attachments)) &&
            isInCall(reduxState));

        if (
          this.hasAttachmentDownloads() &&
          (conversation.getAccepted() || isOutgoing(message.attributes)) &&
          !shouldHoldOffDownload
        ) {
          if (shouldUseAttachmentDownloadQueue()) {
            addToAttachmentDownloadQueue(idLog, message);
          } else {
            await message.queueAttachmentDownloads();
          }
        }

        const isFirstRun = true;
        await this.modifyTargetMessage(conversation, isFirstRun);

        log.info(`${idLog}: Batching save`);
        void this.saveAndNotify(conversation, confirm);
      } catch (error) {
        const errorForLog = Errors.toLogFormat(error);
        log.error(`${idLog}: error:`, errorForLog);
        throw error;
      }
    });
  }

  async saveAndNotify(
    conversation: ConversationModel,
    confirm: () => void
  ): Promise<void> {
    await saveNewMessageBatcher.add(this.attributes);

    log.info('Message saved', this.get('sent_at'));

    conversation.trigger('newmessage', this);

    const isFirstRun = false;
    await this.modifyTargetMessage(conversation, isFirstRun);

    if (await shouldReplyNotifyUser(this.attributes, conversation)) {
      await conversation.notify(this);
    }

    // Increment the sent message count if this is an outgoing message
    if (this.get('type') === 'outgoing') {
      conversation.incrementSentMessageCount();
    }

    window.Whisper.events.trigger('incrementProgress');
    confirm();

    if (!isStory(this.attributes)) {
      drop(
        conversation.queueJob('updateUnread', () => conversation.updateUnread())
      );
    }
  }

  // This function is called twice - once from handleDataMessage, and then again from
  //    saveAndNotify, a function called at the end of handleDataMessage as a cleanup for
  //    any missed out-of-order events.
  async modifyTargetMessage(
    conversation: ConversationModel,
    isFirstRun: boolean
  ): Promise<void> {
    return modifyTargetMessage(this, conversation, {
      isFirstRun,
      skipEdits: false,
    });
  }

  async handleReaction(
    reaction: ReactionAttributesType,
    {
      storyMessage,
      shouldPersist = true,
    }: {
      storyMessage?: MessageAttributesType;
      shouldPersist?: boolean;
    } = {}
  ): Promise<void> {
    const { attributes } = this;

    if (this.get('deletedForEveryone')) {
      return;
    }

    // We allow you to react to messages with outgoing errors only if it has sent
    //   successfully to at least one person.
    if (
      hasErrors(attributes) &&
      (isIncoming(attributes) ||
        getMessagePropStatus(
          attributes,
          window.ConversationController.getOurConversationIdOrThrow()
        ) !== 'partial-sent')
    ) {
      return;
    }

    const conversation = this.getConversation();
    if (!conversation) {
      return;
    }

    const isFromThisDevice = reaction.source === ReactionSource.FromThisDevice;
    const isFromSync = reaction.source === ReactionSource.FromSync;
    const isFromSomeoneElse =
      reaction.source === ReactionSource.FromSomeoneElse;
    strictAssert(
      isFromThisDevice || isFromSync || isFromSomeoneElse,
      'Reaction can only be from this device, from sync, or from someone else'
    );

    const newReaction: MessageReactionType = {
      emoji: reaction.remove ? undefined : reaction.emoji,
      fromId: reaction.fromId,
      targetTimestamp: reaction.targetTimestamp,
      timestamp: reaction.timestamp,
      receivedAtDate: reaction.receivedAtDate,
      isSentByConversationId: isFromThisDevice
        ? zipObject(conversation.getMemberConversationIds(), repeat(false))
        : undefined,
    };

    // Reactions to stories are saved as separate messages, and so require a totally
    //   different codepath.
    if (storyMessage) {
      if (isFromThisDevice) {
        log.info(
          'handleReaction: sending story reaction to ' +
            `${getMessageIdForLogging(storyMessage)} from this device`
        );
      } else {
        if (isFromSomeoneElse) {
          log.info(
            'handleReaction: receiving story reaction to ' +
              `${getMessageIdForLogging(storyMessage)} from someone else`
          );
        } else if (isFromSync) {
          log.info(
            'handleReaction: receiving story reaction to ' +
              `${getMessageIdForLogging(storyMessage)} from another device`
          );
        }

        const generatedMessage = reaction.storyReactionMessage;
        strictAssert(
          generatedMessage,
          'Story reactions must provide storyReactionMessage'
        );
        const targetConversation = window.ConversationController.get(
          generatedMessage.get('conversationId')
        );
        strictAssert(
          targetConversation,
          'handleReaction: targetConversation not found'
        );

        generatedMessage.set({
          expireTimer: isDirectConversation(targetConversation.attributes)
            ? targetConversation.get('expireTimer')
            : undefined,
          storyId: storyMessage.id,
          storyReaction: {
            emoji: reaction.emoji,
            targetAuthorAci: reaction.targetAuthorAci,
            targetTimestamp: reaction.targetTimestamp,
          },
        });

        await generatedMessage.hydrateStoryContext(storyMessage, {
          shouldSave: false,
        });
        // Note: generatedMessage comes with an id, so we have to force this save
        await window.Signal.Data.saveMessage(generatedMessage.attributes, {
          ourAci: window.textsecure.storage.user.getCheckedAci(),
          forceSave: true,
        });

        log.info('Reactions.onReaction adding reaction to story', {
          reactionMessageId: getMessageIdForLogging(
            generatedMessage.attributes
          ),
          storyId: getMessageIdForLogging(storyMessage),
          targetTimestamp: reaction.targetTimestamp,
          timestamp: reaction.timestamp,
        });

        const messageToAdd = window.MessageCache.__DEPRECATED$register(
          generatedMessage.id,
          generatedMessage,
          'generatedMessage'
        );
        if (isDirectConversation(targetConversation.attributes)) {
          await targetConversation.addSingleMessage(messageToAdd);
          if (!targetConversation.get('active_at')) {
            targetConversation.set({
              active_at: messageToAdd.get('timestamp'),
            });
            window.Signal.Data.updateConversation(
              targetConversation.attributes
            );
          }
        }

        if (isFromSomeoneElse) {
          log.info(
            'handleReaction: notifying for story reaction to ' +
              `${getMessageIdForLogging(storyMessage)} from someone else`
          );
          if (
            await shouldReplyNotifyUser(
              messageToAdd.attributes,
              targetConversation
            )
          ) {
            drop(targetConversation.notify(messageToAdd));
          }
        }
      }
    } else {
      // Reactions to all messages other than stories will update the target message
      const previousLength = (this.get('reactions') || []).length;

      if (isFromThisDevice) {
        log.info(
          `handleReaction: sending reaction to ${this.idForLogging()} ` +
            'from this device'
        );

        const reactions = reactionUtil.addOutgoingReaction(
          this.get('reactions') || [],
          newReaction
        );
        this.set({ reactions });
      } else {
        const oldReactions = this.get('reactions') || [];
        let reactions: Array<MessageReactionType>;
        const oldReaction = oldReactions.find(re =>
          isNewReactionReplacingPrevious(re, newReaction)
        );
        if (oldReaction) {
          this.clearNotifications(oldReaction);
        }

        if (reaction.remove) {
          log.info(
            'handleReaction: removing reaction for message',
            this.idForLogging()
          );

          if (isFromSync) {
            reactions = oldReactions.filter(
              re =>
                !isNewReactionReplacingPrevious(re, newReaction) ||
                re.timestamp > reaction.timestamp
            );
          } else {
            reactions = oldReactions.filter(
              re => !isNewReactionReplacingPrevious(re, newReaction)
            );
          }
          this.set({ reactions });
        } else {
          log.info(
            'handleReaction: adding reaction for message',
            this.idForLogging()
          );

          let reactionToAdd: MessageReactionType;
          if (isFromSync) {
            const ourReactions = [
              newReaction,
              ...oldReactions.filter(re => re.fromId === reaction.fromId),
            ];
            reactionToAdd = maxBy(ourReactions, 'timestamp') || newReaction;
          } else {
            reactionToAdd = newReaction;
          }

          reactions = oldReactions.filter(
            re => !isNewReactionReplacingPrevious(re, reaction)
          );
          reactions.push(reactionToAdd);
          this.set({ reactions });

          if (isOutgoing(this.attributes) && isFromSomeoneElse) {
            void conversation.notify(this, reaction);
          }
        }
      }

      if (reaction.remove) {
        await window.Signal.Data.removeReactionFromConversation({
          emoji: reaction.emoji,
          fromId: reaction.fromId,
          targetAuthorServiceId: reaction.targetAuthorAci,
          targetTimestamp: reaction.targetTimestamp,
        });
      } else {
        await window.Signal.Data.addReaction(
          {
            conversationId: this.get('conversationId'),
            emoji: reaction.emoji,
            fromId: reaction.fromId,
            messageId: this.id,
            messageReceivedAt: this.get('received_at'),
            targetAuthorAci: reaction.targetAuthorAci,
            targetTimestamp: reaction.targetTimestamp,
            timestamp: reaction.timestamp,
          },
          {
            readStatus: isFromThisDevice
              ? ReactionReadStatus.Read
              : ReactionReadStatus.Unread,
          }
        );
      }

      const currentLength = (this.get('reactions') || []).length;
      log.info(
        'handleReaction:',
        `Done processing reaction for message ${this.idForLogging()}.`,
        `Went from ${previousLength} to ${currentLength} reactions.`
      );
    }

    if (isFromThisDevice) {
      let jobData: ConversationQueueJobData;
      if (storyMessage) {
        strictAssert(
          newReaction.emoji !== undefined,
          'New story reaction must have an emoji'
        );

        const generatedMessage = reaction.storyReactionMessage;
        strictAssert(
          generatedMessage,
          'Story reactions must provide storyReactionmessage'
        );

        await generatedMessage.hydrateStoryContext(this.attributes, {
          shouldSave: false,
        });
        await window.Signal.Data.saveMessage(generatedMessage.attributes, {
          ourAci: window.textsecure.storage.user.getCheckedAci(),
          forceSave: true,
        });

        void conversation.addSingleMessage(
          window.MessageCache.__DEPRECATED$register(
            generatedMessage.id,
            generatedMessage,
            'generatedMessage2'
          )
        );

        jobData = {
          type: conversationQueueJobEnum.enum.NormalMessage,
          conversationId: conversation.id,
          messageId: generatedMessage.id,
          revision: conversation.get('revision'),
        };
      } else {
        jobData = {
          type: conversationQueueJobEnum.enum.Reaction,
          conversationId: conversation.id,
          messageId: this.id,
          revision: conversation.get('revision'),
        };
      }
      if (shouldPersist) {
        await conversationJobQueue.add(jobData, async jobToInsert => {
          log.info(
            `enqueueReactionForSend: saving message ${this.idForLogging()} and job ${
              jobToInsert.id
            }`
          );
          await window.Signal.Data.saveMessage(this.attributes, {
            jobToInsert,
            ourAci: window.textsecure.storage.user.getCheckedAci(),
          });
        });
      } else {
        await conversationJobQueue.add(jobData);
      }
    } else if (shouldPersist && !isStory(this.attributes)) {
      await window.Signal.Data.saveMessage(this.attributes, {
        ourAci: window.textsecure.storage.user.getCheckedAci(),
      });
    }
  }

  async handleDeleteForEveryone(
    del: Pick<
      DeleteAttributesType,
      'fromId' | 'targetSentTimestamp' | 'serverTimestamp'
    >,
    shouldPersist = true
  ): Promise<void> {
    if (this.deletingForEveryone || this.get('deletedForEveryone')) {
      return;
    }

    log.info('Handling DOE.', {
      messageId: this.id,
      fromId: del.fromId,
      targetSentTimestamp: del.targetSentTimestamp,
      messageServerTimestamp: this.get('serverTimestamp'),
      deleteServerTimestamp: del.serverTimestamp,
    });

    try {
      this.deletingForEveryone = true;

      // Remove any notifications for this message
      notificationService.removeBy({ messageId: this.get('id') });

      // Erase the contents of this message
      await this.eraseContents(
        { deletedForEveryone: true, reactions: [] },
        shouldPersist
      );

      // Update the conversation's last message in case this was the last message
      void this.getConversation()?.updateLastMessage();
    } finally {
      this.deletingForEveryone = undefined;
    }
  }

  clearNotifications(reaction: Partial<ReactionType> = {}): void {
    notificationService.removeBy({
      ...reaction,
      messageId: this.id,
    });
  }

  getPendingMarkRead(): number | undefined {
    return this.pendingMarkRead;
  }

  setPendingMarkRead(value: number | undefined): void {
    this.pendingMarkRead = value;
  }
}

window.Whisper.Message = MessageModel;
