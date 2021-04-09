// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  WhatIsThis,
  MessageAttributesType,
  CustomError,
} from '../model-types.d';
import { DataMessageClass } from '../textsecure.d';
import { ConversationModel } from './conversations';
import {
  LastMessageStatus,
  ConversationType,
} from '../state/ducks/conversations';
import { getActiveCall } from '../state/ducks/calling';
import { getCallSelector, isInCall } from '../state/selectors/calling';
import {
  MessageStatusType,
  PropsData,
} from '../components/conversation/Message';
import { OwnProps as SmartMessageDetailPropsType } from '../state/smart/MessageDetail';
import { CallbackResultType } from '../textsecure/SendMessage';
import { ExpirationTimerOptions } from '../util/ExpirationTimerOptions';
import { missingCaseError } from '../util/missingCaseError';
import { ColorType } from '../types/Colors';
import { CallMode } from '../types/Calling';
import { BodyRangesType } from '../types/Util';
import { PropsDataType as GroupsV2Props } from '../components/conversation/GroupV2Change';
import {
  PropsData as TimerNotificationProps,
  TimerNotificationType,
} from '../components/conversation/TimerNotification';
import { PropsData as SafetyNumberNotificationProps } from '../components/conversation/SafetyNumberNotification';
import { PropsData as VerificationNotificationProps } from '../components/conversation/VerificationNotification';
import { PropsDataType as GroupV1MigrationPropsType } from '../components/conversation/GroupV1Migration';
import {
  PropsData as GroupNotificationProps,
  ChangeType,
} from '../components/conversation/GroupNotification';
import { Props as ResetSessionNotificationProps } from '../components/conversation/ResetSessionNotification';
import {
  CallingNotificationType,
  getCallingNotificationText,
} from '../util/callingNotification';
import { PropsType as ProfileChangeNotificationPropsType } from '../components/conversation/ProfileChangeNotification';
import { AttachmentType, isImage, isVideo } from '../types/Attachment';

/* eslint-disable camelcase */
/* eslint-disable more/no-then */

declare const _: typeof window._;

window.Whisper = window.Whisper || {};

const {
  Message: TypedMessage,
  Attachment,
  MIME,
  Contact,
  PhoneNumber,
  Errors,
} = window.Signal.Types;
const {
  deleteExternalMessageFiles,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
  loadQuoteData,
  loadPreviewData,
  loadStickerData,
  upgradeMessageSchema,
} = window.Signal.Migrations;
const {
  copyStickerToAttachments,
  deletePackReference,
  savePackMetadata,
  getStickerPackStatus,
} = window.Signal.Stickers;
const { getTextWithMentions, GoogleChrome } = window.Signal.Util;

const { addStickerPackReference, getMessageBySender } = window.Signal.Data;
const { bytesFromString } = window.Signal.Crypto;
const PLACEHOLDER_CONTACT: Pick<ConversationType, 'title' | 'type' | 'id'> = {
  id: 'placeholder-contact',
  type: 'direct',
  title: window.i18n('unknownContact'),
};

const THREE_HOURS = 3 * 60 * 60 * 1000;

window.AccountCache = Object.create(null);
window.AccountJobs = Object.create(null);

window.doesAccountCheckJobExist = number => Boolean(window.AccountJobs[number]);
window.checkForSignalAccount = number => {
  if (window.AccountJobs[number]) {
    return window.AccountJobs[number];
  }

  let job;
  if (window.textsecure.messaging) {
    // eslint-disable-next-line more/no-then
    job = window.textsecure.messaging
      .getProfile(number)
      .then(() => {
        window.AccountCache[number] = true;
      })
      .catch(() => {
        window.AccountCache[number] = false;
      });
  } else {
    // We're offline!
    job = Promise.resolve().then(() => {
      window.AccountCache[number] = false;
    });
  }

  window.AccountJobs[number] = job;

  return job;
};

window.isSignalAccountCheckComplete = number =>
  window.AccountCache[number] !== undefined;
window.hasSignalAccount = number => window.AccountCache[number];

const includesAny = <T>(haystack: Array<T>, ...needles: Array<T>) =>
  needles.some(needle => haystack.includes(needle));

export class MessageModel extends window.Backbone.Model<MessageAttributesType> {
  static updateTimers: () => void;

  static getLongMessageAttachment: (
    attachment: typeof window.WhatIsThis
  ) => typeof window.WhatIsThis;

  CURRENT_PROTOCOL_VERSION?: number;

  // Set when sending some sync messages, so we get the functionality of
  //   send(), without zombie messages going into the database.
  doNotSave?: boolean;

  INITIAL_PROTOCOL_VERSION?: number;

  OUR_NUMBER?: string;

  OUR_UUID?: string;

  isSelected?: boolean;

  hasExpired?: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotedMessage: any;

  syncPromise?: Promise<unknown>;

  initialize(attributes: unknown): void {
    if (_.isObject(attributes)) {
      this.set(
        TypedMessage.initializeSchemaVersion({
          message: attributes,
          logger: window.log,
        })
      );
    }

    this.CURRENT_PROTOCOL_VERSION =
      window.textsecure.protobuf.DataMessage.ProtocolVersion.CURRENT;
    this.INITIAL_PROTOCOL_VERSION =
      window.textsecure.protobuf.DataMessage.ProtocolVersion.INITIAL;
    this.OUR_NUMBER = window.textsecure.storage.user.getNumber();
    this.OUR_UUID = window.textsecure.storage.user.getUuid();

    this.on('destroy', this.onDestroy);
    this.on('change:expirationStartTimestamp', this.setToExpire);
    this.on('change:expireTimer', this.setToExpire);
    this.on('unload', this.unload);
    this.on('expired', this.onExpired);
    this.setToExpire();

    this.on('change', this.notifyRedux);
  }

  notifyRedux(): void {
    const { messageChanged } = window.reduxActions.conversations;

    if (messageChanged) {
      const conversationId = this.get('conversationId');
      // Note: The clone is important for triggering a re-run of selectors
      messageChanged(this.id, conversationId, this.getReduxData());
    }
  }

  getReduxData(): WhatIsThis {
    const contact = this.getPropsForEmbeddedContact();

    return {
      ...this.attributes,
      // We need this in the reducer to detect if the message's height has changed
      hasSignalAccount: contact ? Boolean(contact.signalAccount) : null,
    };
  }

  getSenderIdentifier(): string {
    const sentAt = this.get('sent_at');
    const source = this.get('source');
    const sourceUuid = this.get('sourceUuid');
    const sourceDevice = this.get('sourceDevice');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sourceId = window.ConversationController.ensureContactIds({
      e164: source,
      uuid: sourceUuid,
    })!;

    return `${sourceId}.${sourceDevice}-${sentAt}`;
  }

  getReceivedAt(): number {
    // We would like to get the received_at_ms ideally since received_at is
    // now an incrementing counter for messages and not the actual time that
    // the message was received. If this field doesn't exist on the message
    // then we can trust received_at.
    return Number(this.get('received_at_ms') || this.get('received_at'));
  }

  isNormalBubble(): boolean {
    return (
      !this.isCallHistory() &&
      !this.isChatSessionRefreshed() &&
      !this.isEndSession() &&
      !this.isExpirationTimerUpdate() &&
      !this.isGroupUpdate() &&
      !this.isGroupV2Change() &&
      !this.isGroupV1Migration() &&
      !this.isKeyChange() &&
      !this.isMessageHistoryUnsynced() &&
      !this.isProfileChange() &&
      !this.isUnsupportedMessage() &&
      !this.isVerifiedChange()
    );
  }

  // Top-level prop generation for the message bubble
  getPropsForBubble(): WhatIsThis {
    if (this.isUnsupportedMessage()) {
      return {
        type: 'unsupportedMessage',
        data: this.getPropsForUnsupportedMessage(),
      };
    }
    if (this.isGroupV2Change()) {
      return {
        type: 'groupV2Change',
        data: this.getPropsForGroupV2Change(),
      };
    }
    if (this.isGroupV1Migration()) {
      return {
        type: 'groupV1Migration',
        data: this.getPropsForGroupV1Migration(),
      };
    }
    if (this.isMessageHistoryUnsynced()) {
      return {
        type: 'linkNotification',
        data: null,
      };
    }
    if (this.isExpirationTimerUpdate()) {
      return {
        type: 'timerNotification',
        data: this.getPropsForTimerNotification(),
      };
    }
    if (this.isKeyChange()) {
      return {
        type: 'safetyNumberNotification',
        data: this.getPropsForSafetyNumberNotification(),
      };
    }
    if (this.isVerifiedChange()) {
      return {
        type: 'verificationNotification',
        data: this.getPropsForVerificationNotification(),
      };
    }
    if (this.isGroupUpdate()) {
      return {
        type: 'groupNotification',
        data: this.getPropsForGroupNotification(),
      };
    }
    if (this.isEndSession()) {
      return {
        type: 'resetSessionNotification',
        data: this.getPropsForResetSessionNotification(),
      };
    }
    if (this.isCallHistory()) {
      return {
        type: 'callHistory',
        data: this.getPropsForCallHistory(),
      };
    }
    if (this.isProfileChange()) {
      return {
        type: 'profileChange',
        data: this.getPropsForProfileChange(),
      };
    }
    if (this.isChatSessionRefreshed()) {
      return {
        type: 'chatSessionRefreshed',
        data: null,
      };
    }

    return {
      type: 'message',
      data: this.getPropsForMessage(),
    };
  }

  getPropsForMessageDetail(): Pick<
    SmartMessageDetailPropsType,
    'sentAt' | 'receivedAt' | 'message' | 'errors' | 'contacts'
  > {
    const newIdentity = window.i18n('newIdentity');
    const OUTGOING_KEY_ERROR = 'OutgoingIdentityKeyError';

    const unidentifiedLookup = (
      this.get('unidentifiedDeliveries') || []
    ).reduce((accumulator: Record<string, boolean>, identifier: string) => {
      accumulator[
        window.ConversationController.getConversationId(identifier) as string
      ] = true;
      return accumulator;
    }, Object.create(null) as Record<string, boolean>);

    // We include numbers we didn't successfully send to so we can display errors.
    // Older messages don't have the recipients included on the message, so we fall
    //   back to the conversation's current recipients
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const conversationIds = this.isIncoming()
      ? [this.getContactId()!]
      : _.union(
          (this.get('sent_to') || []).map(
            (id: string) => window.ConversationController.getConversationId(id)!
          ),
          (
            this.get('recipients') || this.getConversation()!.getRecipients()
          ).map(
            (id: string) => window.ConversationController.getConversationId(id)!
          )
        );
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    // This will make the error message for outgoing key errors a bit nicer
    const allErrors = (this.get('errors') || []).map(error => {
      if (error.name === OUTGOING_KEY_ERROR) {
        // eslint-disable-next-line no-param-reassign
        error.message = newIdentity;
      }

      return error;
    });

    // If an error has a specific number it's associated with, we'll show it next to
    //   that contact. Otherwise, it will be a standalone entry.
    const errors = _.reject(allErrors, error =>
      Boolean(error.identifier || error.number)
    );
    const errorsGroupedById = _.groupBy(allErrors, error => {
      const identifier = error.identifier || error.number;
      if (!identifier) {
        return null;
      }

      return window.ConversationController.getConversationId(identifier);
    });
    const finalContacts = (conversationIds || []).map(id => {
      const errorsForContact = errorsGroupedById[id];
      const isOutgoingKeyError = Boolean(
        _.find(errorsForContact, error => error.name === OUTGOING_KEY_ERROR)
      );
      const isUnidentifiedDelivery =
        window.storage.get('unidentifiedDeliveryIndicators') &&
        this.isUnidentifiedDelivery(id, unidentifiedLookup);

      return {
        ...this.findAndFormatContact(id),

        status: this.getStatus(id),
        errors: errorsForContact,
        isOutgoingKeyError,
        isUnidentifiedDelivery,
        onSendAnyway: () =>
          this.trigger('force-send', { contactId: id, messageId: this.id }),
        onShowSafetyNumber: () => this.trigger('show-identity', id),
      };
    });

    // The prefix created here ensures that contacts with errors are listed
    //   first; otherwise it's alphabetical
    const sortedContacts = _.sortBy(
      finalContacts,
      contact => `${contact.errors ? '0' : '1'}${contact.title}`
    );

    return {
      sentAt: this.get('sent_at'),
      receivedAt: this.getReceivedAt(),
      message: this.getPropsForMessage(),
      errors,
      contacts: sortedContacts,
    };
  }

  // Bucketing messages
  isUnsupportedMessage(): boolean {
    const versionAtReceive = this.get('supportedVersionAtReceive');
    const requiredVersion = this.get('requiredProtocolVersion');

    return (
      _.isNumber(versionAtReceive) &&
      _.isNumber(requiredVersion) &&
      versionAtReceive < requiredVersion
    );
  }

  isGroupV2Change(): boolean {
    return Boolean(this.get('groupV2Change'));
  }

  isGroupV1Migration(): boolean {
    return this.get('type') === 'group-v1-migration';
  }

  isExpirationTimerUpdate(): boolean {
    const flag =
      window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
    // eslint-disable-next-line no-bitwise, @typescript-eslint/no-non-null-assertion
    return Boolean(this.get('flags')! & flag);
  }

  isKeyChange(): boolean {
    return this.get('type') === 'keychange';
  }

  isVerifiedChange(): boolean {
    return this.get('type') === 'verified-change';
  }

  isMessageHistoryUnsynced(): boolean {
    return this.get('type') === 'message-history-unsynced';
  }

  isGroupUpdate(): boolean {
    return !!this.get('group_update');
  }

  isEndSession(): boolean {
    const flag = window.textsecure.protobuf.DataMessage.Flags.END_SESSION;
    // eslint-disable-next-line no-bitwise, @typescript-eslint/no-non-null-assertion
    return !!(this.get('flags')! & flag);
  }

  isCallHistory(): boolean {
    return this.get('type') === 'call-history';
  }

  isChatSessionRefreshed(): boolean {
    return this.get('type') === 'chat-session-refreshed';
  }

  isProfileChange(): boolean {
    return this.get('type') === 'profile-change';
  }

  // Props for each message type
  getPropsForUnsupportedMessage(): WhatIsThis {
    const requiredVersion = this.get('requiredProtocolVersion');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const canProcessNow = this.CURRENT_PROTOCOL_VERSION! >= requiredVersion!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sourceId = this.getContactId()!;

    return {
      canProcessNow,
      contact: this.findAndFormatContact(sourceId),
    };
  }

  getPropsForGroupV2Change(): GroupsV2Props {
    const { protobuf } = window.textsecure;

    const ourConversationId = window.ConversationController.getOurConversationId();
    const change = this.get('groupV2Change');

    if (ourConversationId === undefined) {
      throw new Error('ourConversationId is undefined');
    }

    if (change === undefined) {
      throw new Error('change is undefined');
    }

    return {
      AccessControlEnum: protobuf.AccessControl.AccessRequired,
      RoleEnum: protobuf.Member.Role,
      ourConversationId,
      change,
    };
  }

  getPropsForGroupV1Migration(): GroupV1MigrationPropsType {
    const migration = this.get('groupMigration');
    if (!migration) {
      // Backwards-compatibility with data schema in early betas
      const invitedGV2Members = this.get('invitedGV2Members') || [];
      const droppedGV2MemberIds = this.get('droppedGV2MemberIds') || [];

      const invitedMembers = invitedGV2Members.map(item =>
        this.findAndFormatContact(item.conversationId)
      );
      const droppedMembers = droppedGV2MemberIds.map(conversationId =>
        this.findAndFormatContact(conversationId)
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
      this.findAndFormatContact(item.conversationId)
    );
    const droppedMembers = droppedMemberIds.map(conversationId =>
      this.findAndFormatContact(conversationId)
    );

    return {
      areWeInvited,
      droppedMembers,
      invitedMembers,
    };
  }

  getPropsForTimerNotification(): TimerNotificationProps | undefined {
    const timerUpdate = this.get('expirationTimerUpdate');
    if (!timerUpdate) {
      return undefined;
    }

    const { expireTimer, fromSync, source, sourceUuid } = timerUpdate;
    const timespan = ExpirationTimerOptions.getName(
      window.i18n,
      expireTimer || 0
    );
    const disabled = !expireTimer;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sourceId = window.ConversationController.ensureContactIds({
      e164: source,
      uuid: sourceUuid,
    })!;
    const ourId = window.ConversationController.getOurConversationId();
    const formattedContact = this.findAndFormatContact(sourceId);

    const basicProps = {
      ...formattedContact,
      type: 'fromOther' as TimerNotificationType,
      timespan,
      disabled,
    };

    if (fromSync) {
      return {
        ...basicProps,
        type: 'fromSync' as TimerNotificationType,
      };
    }
    if (sourceId && sourceId === ourId) {
      return {
        ...basicProps,
        type: 'fromMe' as TimerNotificationType,
      };
    }
    if (!sourceId) {
      return {
        ...basicProps,
        type: 'fromMember' as TimerNotificationType,
      };
    }

    return basicProps;
  }

  getPropsForSafetyNumberNotification(): SafetyNumberNotificationProps {
    const conversation = this.getConversation();
    const isGroup = Boolean(conversation && !conversation.isPrivate());
    const identifier = this.get('key_changed');
    const contact = this.findAndFormatContact(identifier);

    if (contact.id === undefined) {
      throw new Error('contact id is undefined');
    }

    return {
      isGroup,
      contact,
    } as SafetyNumberNotificationProps;
  }

  getPropsForVerificationNotification(): VerificationNotificationProps {
    const type = this.get('verified') ? 'markVerified' : 'markNotVerified';
    const isLocal = this.get('local');
    const identifier = this.get('verifiedChanged');

    return {
      type,
      isLocal,
      contact: this.findAndFormatContact(identifier),
    };
  }

  getPropsForGroupNotification(): GroupNotificationProps {
    const groupUpdate = this.get('group_update');
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

    if (groupUpdate.joined) {
      changes.push({
        type: 'add' as ChangeType,
        contacts: _.map(
          Array.isArray(groupUpdate.joined)
            ? groupUpdate.joined
            : [groupUpdate.joined],
          identifier => this.findAndFormatContact(identifier)
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
        contacts: _.map(
          Array.isArray(groupUpdate.left)
            ? groupUpdate.left
            : [groupUpdate.left],
          identifier => this.findAndFormatContact(identifier)
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

    const sourceId = this.getContactId();
    const from = this.findAndFormatContact(sourceId);

    return {
      from,
      changes,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  getPropsForResetSessionNotification(): ResetSessionNotificationProps {
    return {
      i18n: window.i18n,
    };
  }

  getPropsForCallHistory(): CallingNotificationType | undefined {
    const callHistoryDetails = this.get('callHistoryDetails');
    if (!callHistoryDetails) {
      return undefined;
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
        const conversationId = this.get('conversationId');
        if (!conversationId) {
          window.log.error(
            'Message.prototype.getPropsForCallHistory: missing conversation ID; assuming there is no call'
          );
          return undefined;
        }

        const creatorConversation = this.findContact(
          window.ConversationController.ensureContactIds({
            uuid: callHistoryDetails.creatorUuid,
          })
        );
        if (!creatorConversation) {
          window.log.error(
            'Message.prototype.getPropsForCallHistory: could not find creator by UUID; bailing'
          );
          return undefined;
        }

        const reduxState = window.reduxStore.getState();

        let call = getCallSelector(reduxState)(conversationId);
        if (call && call.callMode !== CallMode.Group) {
          window.log.error(
            'Message.prototype.getPropsForCallHistory: there is an unexpected non-group call; pretending it does not exist'
          );
          call = undefined;
        }

        return {
          activeCallConversationId: getActiveCall(reduxState.calling)
            ?.conversationId,
          callMode: CallMode.Group,
          conversationId,
          creator: creatorConversation.format(),
          deviceCount: call?.peekInfo.deviceCount ?? 0,
          ended: callHistoryDetails.eraId !== call?.peekInfo.eraId,
          maxDevices: call?.peekInfo.maxDevices ?? Infinity,
          startedTime: callHistoryDetails.startedTime,
        };
      }
      default:
        window.log.error(missingCaseError(callHistoryDetails));
        return undefined;
    }
  }

  getPropsForProfileChange(): ProfileChangeNotificationPropsType {
    const change = this.get('profileChange');
    const changedId = this.get('changedId');
    const changedContact = this.findAndFormatContact(changedId);

    if (!changedContact.id) {
      throw new Error('changed contact id is undefined');
    }

    if (!change) {
      throw new Error('change is undefined');
    }

    return {
      changedContact,
      change,
    } as ProfileChangeNotificationPropsType;
  }

  getAttachmentsForMessage(): Array<WhatIsThis> {
    const sticker = this.get('sticker');
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
          url: data.path ? getAbsoluteAttachmentPath(data.path) : undefined,
        },
      ];
    }

    const attachments = this.get('attachments') || [];
    return attachments
      .filter(attachment => !attachment.error)
      .map(attachment => this.getPropsForAttachment(attachment));
  }

  // Note: interactionMode is mixed in via selectors/conversations._messageSelector
  getPropsForMessage(): Omit<PropsData, 'interactionMode'> {
    const sourceId = this.getContactId();
    const contact = this.findAndFormatContact(sourceId);
    const contactModel = this.findContact(sourceId);

    const authorColor = contactModel ? contactModel.getColor() : undefined;
    const authorAvatarPath = contactModel
      ? contactModel.getAvatarPath()
      : undefined;

    const expirationLength = this.get('expireTimer') * 1000;
    const expireTimerStart = this.get('expirationStartTimestamp');
    const expirationTimestamp =
      expirationLength && expireTimerStart
        ? expireTimerStart + expirationLength
        : undefined;

    const conversation = this.getConversation();
    const isGroup = conversation && !conversation.isPrivate();
    const sticker = this.get('sticker');

    const isTapToView = this.isTapToView();

    const reactions = (this.get('reactions') || []).map(re => {
      const c = this.findAndFormatContact(re.fromId);

      return {
        emoji: re.emoji,
        timestamp: re.timestamp,
        from: c,
      };
    });

    const selectedReaction = (
      (this.get('reactions') || []).find(
        re => re.fromId === window.ConversationController.getOurConversationId()
      ) || {}
    ).emoji;

    return {
      text: this.createNonBreakingLastSeparator(this.get('body')),
      textPending: this.get('bodyPending'),
      id: this.id,
      conversationId: this.get('conversationId'),
      isSticker: Boolean(sticker),
      direction: this.isIncoming() ? 'incoming' : 'outgoing',
      timestamp: this.get('sent_at'),
      status: this.getMessagePropStatus(),
      contact: this.getPropsForEmbeddedContact(),
      canReply: this.canReply(),
      canDeleteForEveryone: this.canDeleteForEveryone(),
      canDownload: this.canDownload(),
      authorId: contact.id,
      authorTitle: contact.title,
      authorColor,
      authorName: contact.name,
      authorProfileName: contact.profileName,
      authorPhoneNumber: contact.phoneNumber,
      conversationType: isGroup ? 'group' : 'direct',
      attachments: this.getAttachmentsForMessage(),
      previews: this.getPropsForPreview(),
      quote: this.getPropsForQuote(),
      authorAvatarPath,
      isExpired: this.hasExpired,
      expirationLength,
      expirationTimestamp,
      reactions,
      selectedReaction,

      isTapToView,
      isTapToViewExpired: isTapToView && this.get('isErased'),
      isTapToViewError:
        isTapToView && this.isIncoming() && this.get('isTapToViewInvalid'),

      deletedForEveryone: this.get('deletedForEveryone') || false,
      bodyRanges: this.processBodyRanges(),

      isMessageRequestAccepted: conversation
        ? conversation.getAccepted()
        : true,
      isBlocked: Boolean(conversation?.isBlocked()),
    };
  }

  processBodyRanges(
    bodyRanges = this.get('bodyRanges')
  ): BodyRangesType | undefined {
    if (!bodyRanges) {
      return undefined;
    }

    return bodyRanges
      .filter(range => range.mentionUuid)
      .map(range => {
        const contactID = window.ConversationController.ensureContactIds({
          uuid: range.mentionUuid,
        });
        const conversation = this.findContact(contactID);

        return {
          ...range,
          conversationID: contactID,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          replacementText: conversation!.getTitle(),
        };
      })
      .sort((a, b) => b.start - a.start);
  }

  // Dependencies of prop-generation functions
  findAndFormatContact(
    identifier?: string
  ): Partial<ConversationType> &
    Pick<ConversationType, 'title' | 'id' | 'type'> {
    if (!identifier) {
      return PLACEHOLDER_CONTACT;
    }

    const contactModel = this.findContact(identifier);
    if (contactModel) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return contactModel.format()!;
    }

    const { format, isValidNumber } = PhoneNumber;
    const regionCode = window.storage.get('regionCode');

    if (!isValidNumber(identifier, { regionCode })) {
      return PLACEHOLDER_CONTACT;
    }

    const phoneNumber = format(identifier, {
      ourRegionCode: regionCode,
    });

    return {
      id: 'phone-only',
      type: 'direct',
      title: phoneNumber,
      phoneNumber,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  findContact(identifier?: string): ConversationModel | undefined {
    return window.ConversationController.get(identifier);
  }

  getConversation(): ConversationModel | undefined {
    return window.ConversationController.get(this.get('conversationId'));
  }

  // eslint-disable-next-line class-methods-use-this
  private createNonBreakingLastSeparator(text: string): string {
    if (!text) {
      return '';
    }

    const nbsp = '\xa0';
    const regex = /(\S)( +)(\S+\s*)$/;
    return text.replace(regex, (_match, start, spaces, end) => {
      const newSpaces =
        end.length < 12
          ? _.reduce(spaces, accumulator => accumulator + nbsp, '')
          : spaces;
      return `${start}${newSpaces}${end}`;
    });
  }

  isIncoming(): boolean {
    return this.get('type') === 'incoming';
  }

  getMessagePropStatus(): LastMessageStatus | undefined {
    const sent = this.get('sent');
    const sentTo = this.get('sent_to') || [];

    if (this.hasErrors()) {
      if (sent || sentTo.length > 0) {
        return 'partial-sent';
      }
      return 'error';
    }
    if (!this.isOutgoing()) {
      return undefined;
    }

    const readBy = this.get('read_by') || [];
    if (window.storage.get('read-receipt-setting') && readBy.length > 0) {
      return 'read';
    }
    const delivered = this.get('delivered');
    const deliveredTo = this.get('delivered_to') || [];
    if (delivered || deliveredTo.length > 0) {
      return 'delivered';
    }
    if (sent || sentTo.length > 0) {
      return 'sent';
    }

    return 'sending';
  }

  getPropsForEmbeddedContact(): WhatIsThis {
    const contacts = this.get('contact');
    if (!contacts || !contacts.length) {
      return null;
    }

    const regionCode = window.storage.get('regionCode');
    const { contactSelector } = Contact;
    const contact = contacts[0];
    const firstNumber =
      contact.number && contact.number[0] && contact.number[0].value;

    // Would be nice to do this before render, on initial load of message
    if (!window.isSignalAccountCheckComplete(firstNumber)) {
      window.checkForSignalAccount(firstNumber).then(() => {
        this.trigger('change', this);
      });
    }

    return contactSelector(contact, {
      regionCode,
      getAbsoluteAttachmentPath,
      signalAccount: window.hasSignalAccount(firstNumber) ? firstNumber : null,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getPropsForAttachment(attachment: typeof Attachment): WhatIsThis {
    if (!attachment) {
      return null;
    }

    const { path, pending, flags, size, screenshot, thumbnail } = attachment;

    return {
      ...attachment,
      fileSize: size ? window.filesize(size) : null,
      isVoiceMessage:
        flags &&
        // eslint-disable-next-line no-bitwise
        flags &
          window.textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE,
      pending,
      url: path ? getAbsoluteAttachmentPath(path) : null,
      screenshot: screenshot
        ? {
            ...screenshot,
            url: getAbsoluteAttachmentPath(screenshot.path),
          }
        : null,
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            url: getAbsoluteAttachmentPath(thumbnail.path),
          }
        : null,
    };
  }

  getPropsForPreview(): WhatIsThis {
    const previews = this.get('preview') || [];

    return previews.map(preview => ({
      ...preview,
      isStickerPack: window.Signal.LinkPreviews.isStickerPack(preview.url),
      domain: window.Signal.LinkPreviews.getDomain(preview.url),
      image: preview.image ? this.getPropsForAttachment(preview.image) : null,
    }));
  }

  getPropsForQuote(): PropsData['quote'] {
    const quote = this.get('quote');
    if (!quote) {
      return undefined;
    }

    const { format } = PhoneNumber;
    const regionCode = window.storage.get('regionCode');

    const {
      author,
      authorUuid,
      bodyRanges,
      id: sentAt,
      referencedMessageNotFound,
      text,
    } = quote;

    const contact: ConversationModel | undefined =
      author || authorUuid
        ? window.ConversationController.get(
            window.ConversationController.ensureContactIds({
              e164: author,
              uuid: authorUuid,
            })
          )
        : undefined;

    let reallyNotFound = referencedMessageNotFound;
    // Is the quote really without a reference? Check with our in memory store
    // first to make sure it's not there.
    if (referencedMessageNotFound) {
      const messageId = this.get('sent_at');
      window.log.info(
        `getPropsForQuote: Verifying that ${messageId} referencing ${sentAt} is really not found`
      );
      const inMemoryMessage = window.MessageController.findBySentAt(
        Number(sentAt)
      );
      reallyNotFound = !inMemoryMessage;

      // We found the quote in memory so update the message in the database
      // so we don't have to do this check again
      if (!reallyNotFound) {
        window.log.info(
          `getPropsForQuote: Found ${sentAt}, scheduling an update to ${messageId}`
        );
        this.set({
          quote: {
            ...quote,
            referencedMessageNotFound: false,
          },
        });
        window.Signal.Util.queueUpdateMessage(this.attributes);
      }
    }

    let authorColor: ColorType;
    let authorId: string;
    let authorName: undefined | string;
    let authorPhoneNumber: undefined | string;
    let authorProfileName: undefined | string;
    let authorTitle: string;
    let isFromMe: boolean;

    if (contact && contact.isPrivate()) {
      const contactPhoneNumber = contact.get('e164');

      authorColor = contact.getColor();
      authorId = contact.id;
      authorName = contact.get('name');
      authorPhoneNumber = contactPhoneNumber
        ? format(contactPhoneNumber, {
            ourRegionCode: regionCode,
          })
        : undefined;
      authorProfileName = contact.getProfileName();
      authorTitle = contact.getTitle();
      isFromMe = contact.isMe();
    } else {
      window.log.warn(
        'getPropsForQuote: contact was missing. This may indicate a bookkeeping error or bad data from another client. Returning a placeholder contact.'
      );

      authorColor = 'grey';
      authorId = 'placeholder-contact';
      authorTitle = window.i18n('unknownContact');
      isFromMe = false;
    }

    const firstAttachment = quote.attachments && quote.attachments[0];

    return {
      authorColor,
      authorId,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      authorTitle,
      bodyRanges: this.processBodyRanges(bodyRanges),
      isFromMe,
      rawAttachment: firstAttachment
        ? this.processQuoteAttachment(firstAttachment)
        : undefined,
      referencedMessageNotFound: reallyNotFound,
      sentAt: Number(sentAt),
      text: this.createNonBreakingLastSeparator(text),
    };
  }

  private getStatus(identifier: string): MessageStatusType | null {
    const conversation = window.ConversationController.get(identifier);

    if (!conversation) {
      return null;
    }

    const e164 = conversation.get('e164');
    const uuid = conversation.get('uuid');
    const conversationId = conversation.get('id');

    const readBy = this.get('read_by') || [];
    if (includesAny(readBy, conversationId, e164, uuid)) {
      return 'read';
    }
    const deliveredTo = this.get('delivered_to') || [];
    if (includesAny(deliveredTo, conversationId, e164, uuid)) {
      return 'delivered';
    }
    const sentTo = this.get('sent_to') || [];
    if (includesAny(sentTo, conversationId, e164, uuid)) {
      return 'sent';
    }

    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  processQuoteAttachment(
    attachment: typeof window.Signal.Types.Attachment
  ): WhatIsThis {
    const { thumbnail } = attachment;
    const path =
      thumbnail && thumbnail.path && getAbsoluteAttachmentPath(thumbnail.path);
    const objectUrl = thumbnail && thumbnail.objectUrl;

    const thumbnailWithObjectUrl =
      !path && !objectUrl
        ? null
        : { ...(attachment.thumbnail || {}), objectUrl: path || objectUrl };

    return {
      ...attachment,
      isVoiceMessage: window.Signal.Types.Attachment.isVoiceMessage(attachment),
      thumbnail: thumbnailWithObjectUrl,
    };
  }

  getNotificationData(): { emoji?: string; text: string } {
    if (this.isChatSessionRefreshed()) {
      return {
        emoji: '🔁',
        text: window.i18n('ChatRefresh--notification'),
      };
    }

    if (this.isUnsupportedMessage()) {
      return {
        text: window.i18n('message--getDescription--unsupported-message'),
      };
    }

    if (this.isGroupV1Migration()) {
      return {
        text: window.i18n('GroupV1--Migration--was-upgraded'),
      };
    }

    if (this.isProfileChange()) {
      const change = this.get('profileChange');
      const changedId = this.get('changedId');
      const changedContact = this.findAndFormatContact(changedId);

      return {
        text: window.Signal.Util.getStringForProfileChange(
          change,
          changedContact,
          window.i18n
        ),
      };
    }

    if (this.isGroupV2Change()) {
      const { protobuf } = window.textsecure;
      const change = this.get('groupV2Change');

      const lines = window.Signal.GroupChange.renderChange(change, {
        AccessControlEnum: protobuf.AccessControl.AccessRequired,
        i18n: window.i18n,
        ourConversationId: window.ConversationController.getOurConversationId(),
        renderContact: (conversationId: string) => {
          const conversation = window.ConversationController.get(
            conversationId
          );
          return conversation
            ? conversation.getTitle()
            : window.i18n('unknownUser');
        },
        renderString: (
          key: string,
          _i18n: unknown,
          placeholders: Array<string>
        ) => window.i18n(key, placeholders),
        RoleEnum: protobuf.Member.Role,
      });

      return { text: lines.join(' ') };
    }

    const attachments = this.get('attachments') || [];

    if (this.isTapToView()) {
      if (this.isErased()) {
        return {
          text: window.i18n('message--getDescription--disappearing-media'),
        };
      }

      if (Attachment.isImage(attachments)) {
        return {
          text: window.i18n('message--getDescription--disappearing-photo'),
          emoji: '📷',
        };
      }
      if (Attachment.isVideo(attachments)) {
        return {
          text: window.i18n('message--getDescription--disappearing-video'),
          emoji: '🎥',
        };
      }
      // There should be an image or video attachment, but we have a fallback just in
      //   case.
      return { text: window.i18n('mediaMessage'), emoji: '📎' };
    }

    if (this.isGroupUpdate()) {
      const groupUpdate = this.get('group_update');
      const fromContact = this.getContact();
      const messages = [];

      if (groupUpdate.left === 'You') {
        return { text: window.i18n('youLeftTheGroup') };
      }
      if (groupUpdate.left) {
        return {
          text: window.i18n('leftTheGroup', [
            this.getNameForNumber(groupUpdate.left),
          ]),
        };
      }

      if (!fromContact) {
        return { text: '' };
      }

      if (fromContact.isMe()) {
        messages.push(window.i18n('youUpdatedTheGroup'));
      } else {
        messages.push(window.i18n('updatedTheGroup', [fromContact.getTitle()]));
      }

      if (groupUpdate.joined && groupUpdate.joined.length) {
        const joinedContacts = _.map(groupUpdate.joined, item =>
          window.ConversationController.getOrCreate(item, 'private')
        );
        const joinedWithoutMe = joinedContacts.filter(
          contact => !contact.isMe()
        );

        if (joinedContacts.length > 1) {
          messages.push(
            window.i18n('multipleJoinedTheGroup', [
              _.map(joinedWithoutMe, contact => contact.getTitle()).join(', '),
            ])
          );

          if (joinedWithoutMe.length < joinedContacts.length) {
            messages.push(window.i18n('youJoinedTheGroup'));
          }
        } else {
          const joinedContact = window.ConversationController.getOrCreate(
            groupUpdate.joined[0],
            'private'
          );
          if (joinedContact.isMe()) {
            messages.push(window.i18n('youJoinedTheGroup'));
          } else {
            messages.push(
              window.i18n('joinedTheGroup', [joinedContacts[0].getTitle()])
            );
          }
        }
      }

      if (groupUpdate.name) {
        messages.push(window.i18n('titleIsNow', [groupUpdate.name]));
      }
      if (groupUpdate.avatarUpdated) {
        messages.push(window.i18n('updatedGroupAvatar'));
      }

      return { text: messages.join(' ') };
    }
    if (this.isEndSession()) {
      return { text: window.i18n('sessionEnded') };
    }
    if (this.isIncoming() && this.hasErrors()) {
      return { text: window.i18n('incomingError') };
    }

    const body = (this.get('body') || '').trim();

    if (attachments.length) {
      // This should never happen but we want to be extra-careful.
      const attachment = attachments[0] || {};
      const { contentType } = attachment;

      if (contentType === MIME.IMAGE_GIF) {
        return {
          text: body || window.i18n('message--getNotificationText--gif'),
          emoji: '🎡',
        };
      }
      if (Attachment.isImage(attachments)) {
        return {
          text: body || window.i18n('message--getNotificationText--photo'),
          emoji: '📷',
        };
      }
      if (Attachment.isVideo(attachments)) {
        return {
          text: body || window.i18n('message--getNotificationText--video'),
          emoji: '🎥',
        };
      }
      if (Attachment.isVoiceMessage(attachment)) {
        return {
          text:
            body || window.i18n('message--getNotificationText--voice-message'),
          emoji: '🎤',
        };
      }
      if (Attachment.isAudio(attachments)) {
        return {
          text:
            body || window.i18n('message--getNotificationText--audio-message'),
          emoji: '🔈',
        };
      }
      return {
        text: body || window.i18n('message--getNotificationText--file'),
        emoji: '📎',
      };
    }

    const stickerData = this.get('sticker');
    if (stickerData) {
      const sticker = window.Signal.Stickers.getSticker(
        stickerData.packId,
        stickerData.stickerId
      );
      const { emoji } = sticker || {};
      if (!emoji) {
        window.log.warn('Unable to get emoji for sticker');
      }
      return {
        text: window.i18n('message--getNotificationText--stickers'),
        emoji,
      };
    }

    if (this.isCallHistory()) {
      const callingNotification = this.getPropsForCallHistory();
      if (callingNotification) {
        return {
          text: getCallingNotificationText(callingNotification, window.i18n),
        };
      }

      window.log.error(
        "This call history message doesn't have valid call history"
      );
    }
    if (this.isExpirationTimerUpdate()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { expireTimer } = this.get('expirationTimerUpdate')!;
      if (!expireTimer) {
        return { text: window.i18n('disappearingMessagesDisabled') };
      }

      return {
        text: window.i18n('timerSetTo', [
          ExpirationTimerOptions.getAbbreviated(window.i18n, expireTimer || 0),
        ]),
      };
    }

    if (this.isKeyChange()) {
      const identifier = this.get('key_changed');
      const conversation = this.findContact(identifier);
      return {
        text: window.i18n('safetyNumberChangedGroup', [
          conversation ? conversation.getTitle() : null,
        ]),
      };
    }
    const contacts = this.get('contact');
    if (contacts && contacts.length) {
      return {
        text: Contact.getName(contacts[0]) || window.i18n('unknownContact'),
        emoji: '👤',
      };
    }

    if (body) {
      return { text: body };
    }

    return { text: '' };
  }

  getNotificationText(): string {
    const { text, emoji } = this.getNotificationData();

    let modifiedText = text;

    const hasMentions = Boolean(this.get('bodyRanges'));

    if (hasMentions) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const bodyRanges = this.processBodyRanges()!;
      modifiedText = getTextWithMentions(bodyRanges, modifiedText);
    }

    // Linux emoji support is mixed, so we disable it. (Note that this doesn't touch
    //   the `text`, which can contain emoji.)
    const shouldIncludeEmoji = Boolean(emoji) && !window.Signal.OS.isLinux();
    if (shouldIncludeEmoji) {
      return window.i18n('message--getNotificationText--text-with-emoji', {
        text: modifiedText,
        emoji,
      });
    }
    return modifiedText;
  }

  // General
  idForLogging(): string {
    const account = this.getSourceUuid() || this.getSource();
    const device = this.getSourceDevice();
    const timestamp = this.get('sent_at');

    return `${account}.${device} ${timestamp}`;
  }

  // eslint-disable-next-line class-methods-use-this
  defaults(): Partial<MessageAttributesType> {
    return {
      timestamp: new Date().getTime(),
      attachments: [],
    };
  }

  // eslint-disable-next-line class-methods-use-this
  validate(attributes: Record<string, unknown>): void {
    const required = ['conversationId', 'received_at', 'sent_at'];
    const missing = _.filter(required, attr => !attributes[attr]);
    if (missing.length) {
      window.log.warn(`Message missing attributes: ${missing}`);
    }
  }

  isUnread(): boolean {
    return !!this.get('unread');
  }

  merge(model: MessageModel): void {
    const attributes = model.attributes || model;
    this.set(attributes);
  }

  // eslint-disable-next-line class-methods-use-this
  getNameForNumber(number: string): string {
    const conversation = window.ConversationController.get(number);
    if (!conversation) {
      return number;
    }
    return conversation.getTitle();
  }

  onDestroy(): void {
    this.cleanup();
  }

  async cleanup(): Promise<void> {
    const { messageDeleted } = window.reduxActions.conversations;
    messageDeleted(this.id, this.get('conversationId'));
    window.MessageController.unregister(this.id);
    this.unload();
    await this.deleteData();
  }

  async deleteData(): Promise<void> {
    await deleteExternalMessageFiles(this.attributes);

    const sticker = this.get('sticker');
    if (!sticker) {
      return;
    }

    const { packId } = sticker;
    if (packId) {
      await deletePackReference(this.id, packId);
    }
  }

  isTapToView(): boolean {
    // If a message is deleted for everyone, that overrides all other styling
    if (this.get('deletedForEveryone')) {
      return false;
    }

    return Boolean(this.get('isViewOnce') || this.get('messageTimer'));
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
      !window.Signal.Util.GoogleChrome.isImageTypeSupported(
        firstAttachment.contentType
      ) &&
      !window.Signal.Util.GoogleChrome.isVideoTypeSupported(
        firstAttachment.contentType
      )
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

  async markViewed(options?: { fromSync?: boolean }): Promise<void> {
    const { fromSync } = options || {};

    if (!this.isValidTapToView()) {
      window.log.warn(
        `markViewed: Message ${this.idForLogging()} is not a valid tap to view message!`
      );
      return;
    }
    if (this.isErased()) {
      window.log.warn(
        `markViewed: Message ${this.idForLogging()} is already erased!`
      );
      return;
    }

    if (this.get('unread')) {
      await this.markRead();
    }

    await this.eraseContents();

    if (!fromSync) {
      const sender = this.getSource();

      if (sender === undefined) {
        throw new Error('sender is undefined');
      }

      const senderUuid = this.getSourceUuid();

      if (senderUuid === undefined) {
        throw new Error('senderUuid is undefined');
      }

      const timestamp = this.get('sent_at');
      const ourNumber = window.textsecure.storage.user.getNumber();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ourUuid = window.textsecure.storage.user.getUuid()!;
      const {
        wrap,
        sendOptions,
      } = window.ConversationController.prepareForSend(ourNumber || ourUuid, {
        syncMessage: true,
      });

      await wrap(
        window.textsecure.messaging.syncViewOnceOpen(
          sender,
          senderUuid,
          timestamp,
          sendOptions
        )
      );
    }
  }

  isErased(): boolean {
    return Boolean(this.get('isErased'));
  }

  async eraseContents(
    additionalProperties = {},
    shouldPersist = true
  ): Promise<void> {
    window.log.info(`Erasing data for message ${this.idForLogging()}`);

    // Note: There are cases where we want to re-erase a given message. For example, when
    //   a viewed (or outgoing) View-Once message is deleted for everyone.

    try {
      await this.deleteData();
    } catch (error) {
      window.log.error(
        `Error erasing data for message ${this.idForLogging()}:`,
        error && error.stack ? error.stack : error
      );
    }

    this.set({
      isErased: true,
      body: '',
      bodyRanges: undefined,
      attachments: [],
      quote: null,
      contact: [],
      sticker: null,
      preview: [],
      ...additionalProperties,
    });
    this.trigger('content-changed');

    if (shouldPersist) {
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: window.Whisper.Message,
      });
    }
  }

  isEmpty(): boolean {
    // Core message types - we check for all four because they can each stand alone
    const hasBody = Boolean(this.get('body'));
    const hasAttachment = (this.get('attachments') || []).length > 0;
    const hasEmbeddedContact = (this.get('contact') || []).length > 0;
    const isSticker = Boolean(this.get('sticker'));

    // Rendered sync messages
    const isCallHistory = this.isCallHistory();
    const isChatSessionRefreshed = this.isChatSessionRefreshed();
    const isGroupUpdate = this.isGroupUpdate();
    const isGroupV2Change = this.isGroupV2Change();
    const isEndSession = this.isEndSession();
    const isExpirationTimerUpdate = this.isExpirationTimerUpdate();
    const isVerifiedChange = this.isVerifiedChange();

    // Placeholder messages
    const isUnsupportedMessage = this.isUnsupportedMessage();
    const isTapToView = this.isTapToView();

    // Errors
    const hasErrors = this.hasErrors();

    // Locally-generated notifications
    const isKeyChange = this.isKeyChange();
    const isMessageHistoryUnsynced = this.isMessageHistoryUnsynced();
    const isProfileChange = this.isProfileChange();

    // Note: not all of these message types go through message.handleDataMessage

    const hasSomethingToDisplay =
      // Core message types
      hasBody ||
      hasAttachment ||
      hasEmbeddedContact ||
      isSticker ||
      // Rendered sync messages
      isCallHistory ||
      isChatSessionRefreshed ||
      isGroupUpdate ||
      isGroupV2Change ||
      isEndSession ||
      isExpirationTimerUpdate ||
      isVerifiedChange ||
      // Placeholder messages
      isUnsupportedMessage ||
      isTapToView ||
      // Errors
      hasErrors ||
      // Locally-generated notifications
      isKeyChange ||
      isMessageHistoryUnsynced ||
      isProfileChange;

    return !hasSomethingToDisplay;
  }

  unload(): void {
    if (this.quotedMessage) {
      this.quotedMessage = null;
    }
  }

  onExpired(): void {
    this.hasExpired = true;
  }

  isUnidentifiedDelivery(
    contactId: string,
    lookup: Record<string, unknown>
  ): boolean {
    if (this.isIncoming()) {
      return this.get('unidentifiedDeliveryReceived');
    }

    return Boolean(lookup[contactId]);
  }

  getSource(): string | undefined {
    if (this.isIncoming()) {
      return this.get('source');
    }

    return this.OUR_NUMBER;
  }

  getSourceDevice(): string | number | undefined {
    const sourceDevice = this.get('sourceDevice');

    if (this.isIncoming()) {
      return sourceDevice;
    }

    return sourceDevice || window.textsecure.storage.user.getDeviceId();
  }

  getSourceUuid(): string | undefined {
    if (this.isIncoming()) {
      return this.get('sourceUuid');
    }

    return this.OUR_UUID;
  }

  getContactId(): string | undefined {
    const source = this.getSource();
    const sourceUuid = this.getSourceUuid();

    if (!source && !sourceUuid) {
      return window.ConversationController.getOurConversationId();
    }

    return window.ConversationController.ensureContactIds({
      e164: source,
      uuid: sourceUuid,
    });
  }

  getContact(): ConversationModel | undefined {
    const id = this.getContactId();
    return window.ConversationController.get(id);
  }

  isOutgoing(): boolean {
    return this.get('type') === 'outgoing';
  }

  hasErrors(): boolean {
    return _.size(this.get('errors')) > 0;
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
      window.log.error(
        'Message.saveErrors:',
        e && e.reason ? e.reason : null,
        e && e.stack ? e.stack : e
      );
    });
    errors = errors.map(e => {
      // Note: in our environment, instanceof can be scary, so we have a backup check
      //   (Node.js vs Browser context).
      // We check instanceof second because typescript believes that anything that comes
      //   through here must be an instance of Error, so e is 'never' after that check.
      if ((e.message && e.stack) || e instanceof Error) {
        return _.pick(
          e,
          'name',
          'message',
          'code',
          'number',
          'identifier',
          'reason'
        ) as Required<Error>;
      }
      return e;
    });
    errors = errors.concat(this.get('errors') || []);

    this.set({ errors });

    if (!skipSave && !this.doNotSave) {
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: window.Whisper.Message,
      });
    }
  }

  async markRead(
    readAt?: number,
    options: { skipSave?: boolean } = {}
  ): Promise<void> {
    const { skipSave } = options;

    this.unset('unread');

    if (this.get('expireTimer') && !this.get('expirationStartTimestamp')) {
      const expirationStartTimestamp = Math.min(
        Date.now(),
        readAt || Date.now()
      );
      this.set({ expirationStartTimestamp });
    }

    window.Whisper.Notifications.removeBy({ messageId: this.id });

    if (!skipSave) {
      window.Signal.Util.queueUpdateMessage(this.attributes);
    }
  }

  isExpiring(): number | null {
    return this.get('expireTimer') && this.get('expirationStartTimestamp');
  }

  isExpired(): boolean {
    return this.msTilExpire() <= 0;
  }

  msTilExpire(): number {
    if (!this.isExpiring()) {
      return Infinity;
    }
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const start = this.get('expirationStartTimestamp')!;
    const delta = this.get('expireTimer') * 1000;
    let msFromNow = start + delta - now;
    if (msFromNow < 0) {
      msFromNow = 0;
    }
    return msFromNow;
  }

  async setToExpire(
    force = false,
    options: { skipSave?: boolean } = {}
  ): Promise<void> {
    const { skipSave } = options || {};

    if (this.isExpiring() && (force || !this.get('expires_at'))) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const start = this.get('expirationStartTimestamp')!;
      const delta = this.get('expireTimer') * 1000;
      const expiresAt = start + delta;

      this.set({ expires_at: expiresAt });

      window.log.info('Set message expiration', {
        start,
        expiresAt,
        sentAt: this.get('sent_at'),
      });

      const id = this.get('id');
      if (id && !skipSave) {
        window.Signal.Util.queueUpdateMessage(this.attributes);
      }
    }
  }

  getIncomingContact(): ConversationModel | undefined | null {
    if (!this.isIncoming()) {
      return null;
    }
    const source = this.get('source');
    if (!source) {
      return null;
    }

    return window.ConversationController.getOrCreate(source, 'private');
  }

  getQuoteContact(): ConversationModel | undefined | null {
    const quote = this.get('quote');
    if (!quote) {
      return null;
    }
    const { author } = quote;
    if (!author) {
      return null;
    }

    return window.ConversationController.get(author);
  }

  // Send infrastructure
  // One caller today: event handler for the 'Retry Send' entry in triple-dot menu
  async retrySend(): Promise<string | null | void | Array<void>> {
    if (!window.textsecure.messaging) {
      window.log.error('retrySend: Cannot retry since we are offline!');
      return null;
    }

    this.set({ errors: null });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conversation = this.getConversation()!;
    const exists = (v: string | null): v is string => Boolean(v);
    const intendedRecipients = (this.get('recipients') || [])
      .map(identifier =>
        window.ConversationController.getConversationId(identifier)
      )
      .filter(exists);
    const successfulRecipients = (this.get('sent_to') || [])
      .map(identifier =>
        window.ConversationController.getConversationId(identifier)
      )
      .filter(exists);
    const currentRecipients = conversation
      .getRecipients()
      .map(identifier =>
        window.ConversationController.getConversationId(identifier)
      )
      .filter(exists);

    const profileKey = conversation.get('profileSharing')
      ? window.storage.get('profileKey')
      : null;

    // Determine retry recipients and get their most up-to-date addressing information
    let recipients = _.intersection(intendedRecipients, currentRecipients);
    recipients = _.without(recipients, ...successfulRecipients)
      .map(id => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const c = window.ConversationController.get(id)!;
        return c.getSendTarget();
      })
      .filter((recipient): recipient is string => recipient !== undefined);

    if (!recipients.length) {
      window.log.warn('retrySend: Nobody to send to!');

      return window.Signal.Data.saveMessage(this.attributes, {
        Message: window.Whisper.Message,
      });
    }

    const attachmentsWithData = await Promise.all(
      (this.get('attachments') || []).map(loadAttachmentData)
    );
    const {
      body,
      attachments,
    } = window.Whisper.Message.getLongMessageAttachment({
      body: this.get('body'),
      attachments: attachmentsWithData,
      now: this.get('sent_at'),
    });

    const quoteWithData = await loadQuoteData(this.get('quote'));
    const previewWithData = await loadPreviewData(this.get('preview'));
    const stickerWithData = await loadStickerData(this.get('sticker'));

    // Special-case the self-send case - we send only a sync message
    if (
      recipients.length === 1 &&
      (recipients[0] === this.OUR_NUMBER || recipients[0] === this.OUR_UUID)
    ) {
      const [identifier] = recipients;
      const dataMessage = await window.textsecure.messaging.getMessageProto(
        identifier,
        body,
        attachments,
        quoteWithData,
        previewWithData,
        stickerWithData,
        null,
        this.get('deletedForEveryoneTimestamp'),
        this.get('sent_at'),
        this.get('expireTimer'),
        profileKey,
        undefined, // flags
        this.get('bodyRanges')
      );
      return this.sendSyncMessageOnly(dataMessage);
    }

    let promise;
    const options = conversation.getSendOptions();

    if (conversation.isPrivate()) {
      const [identifier] = recipients;
      promise = window.textsecure.messaging.sendMessageToIdentifier(
        identifier,
        body,
        attachments,
        quoteWithData,
        previewWithData,
        stickerWithData,
        null,
        this.get('deletedForEveryoneTimestamp'),
        this.get('sent_at'),
        this.get('expireTimer'),
        profileKey,
        options
      );
    } else {
      // Because this is a partial group send, we manually construct the request like
      //   sendMessageToGroup does.

      const groupV2 = conversation.getGroupV2Info();

      promise = window.textsecure.messaging.sendMessage(
        {
          recipients,
          body,
          timestamp: this.get('sent_at'),
          attachments,
          quote: quoteWithData,
          preview: previewWithData,
          sticker: stickerWithData,
          expireTimer: this.get('expireTimer'),
          mentions: this.get('bodyRanges'),
          profileKey,
          groupV2,
          group: groupV2
            ? undefined
            : {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                id: this.getConversation()!.get('groupId')!,
                type: window.textsecure.protobuf.GroupContext.Type.DELIVER,
              },
        },
        options
      );
    }

    return this.send(conversation.wrapSend(promise));
  }

  // eslint-disable-next-line class-methods-use-this
  isReplayableError(e: Error): boolean {
    return (
      e.name === 'MessageError' ||
      e.name === 'OutgoingMessageError' ||
      e.name === 'SendMessageNetworkError' ||
      e.name === 'SignedPreKeyRotationError' ||
      e.name === 'OutgoingIdentityKeyError'
    );
  }

  canDeleteForEveryone(): boolean {
    // is someone else's message
    if (this.isIncoming()) {
      return false;
    }

    // has already been deleted for everyone
    if (this.get('deletedForEveryone')) {
      return false;
    }

    // is too old to delete
    if (Date.now() - this.get('sent_at') > THREE_HOURS) {
      return false;
    }

    return true;
  }

  canDownload(): boolean {
    if (this.isOutgoing()) {
      return true;
    }

    const conversation = this.getConversation();
    const isAccepted = Boolean(conversation && conversation.getAccepted());
    if (!isAccepted) {
      return false;
    }

    // Ensure that all attachments are downloadable
    const attachments = this.get('attachments');
    if (attachments && attachments.length) {
      return attachments.every(attachment => Boolean(attachment.path));
    }

    return true;
  }

  canReply(): boolean {
    const conversation = this.getConversation();
    const errors = this.get('errors');
    const isOutgoing = this.get('type') === 'outgoing';
    const numDelivered = this.get('delivered');

    if (!conversation) {
      return false;
    }

    // If GroupV1 groups have been disabled, we can't reply.
    if (conversation.isGroupV1AndDisabled()) {
      return false;
    }

    // If mandatory profile sharing is enabled, and we haven't shared yet, then
    //   we can't reply.
    if (conversation.isMissingRequiredProfileSharing()) {
      return false;
    }

    // We cannot reply if we haven't accepted the message request
    if (!conversation.getAccepted()) {
      return false;
    }

    // We cannot reply if this message is deleted for everyone
    if (this.get('deletedForEveryone')) {
      return false;
    }

    // We can reply if this is outgoing and delivered to at least one recipient
    if (isOutgoing && numDelivered > 0) {
      return true;
    }

    // We can reply if there are no errors
    if (!errors || (errors && errors.length === 0)) {
      return true;
    }

    // Fail safe.
    return false;
  }

  // Called when the user ran into an error with a specific user, wants to send to them
  //   One caller today: ConversationView.forceSend()
  async resend(identifier: string): Promise<void | null | Array<void>> {
    const error = this.removeOutgoingErrors(identifier);
    if (!error) {
      window.log.warn('resend: requested number was not present in errors');
      return null;
    }

    const profileKey = undefined;
    const attachmentsWithData = await Promise.all(
      (this.get('attachments') || []).map(loadAttachmentData)
    );
    const {
      body,
      attachments,
    } = window.Whisper.Message.getLongMessageAttachment({
      body: this.get('body'),
      attachments: attachmentsWithData,
      now: this.get('sent_at'),
    });

    const quoteWithData = await loadQuoteData(this.get('quote'));
    const previewWithData = await loadPreviewData(this.get('preview'));
    const stickerWithData = await loadStickerData(this.get('sticker'));

    // Special-case the self-send case - we send only a sync message
    if (identifier === this.OUR_NUMBER || identifier === this.OUR_UUID) {
      const dataMessage = await window.textsecure.messaging.getMessageProto(
        identifier,
        body,
        attachments,
        quoteWithData,
        previewWithData,
        stickerWithData,
        null,
        this.get('deletedForEveryoneTimestamp'),
        this.get('sent_at'),
        this.get('expireTimer'),
        profileKey,
        undefined, // flags
        this.get('bodyRanges')
      );
      return this.sendSyncMessageOnly(dataMessage);
    }

    const { wrap, sendOptions } = window.ConversationController.prepareForSend(
      identifier
    );
    const promise = window.textsecure.messaging.sendMessageToIdentifier(
      identifier,
      body,
      attachments,
      quoteWithData,
      previewWithData,
      stickerWithData,
      null,
      this.get('deletedForEveryoneTimestamp'),
      this.get('sent_at'),
      this.get('expireTimer'),
      profileKey,
      sendOptions
    );

    return this.send(wrap(promise));
  }

  removeOutgoingErrors(incomingIdentifier: string): CustomError {
    const incomingConversationId = window.ConversationController.getConversationId(
      incomingIdentifier
    );
    const errors = _.partition(
      this.get('errors'),
      e =>
        window.ConversationController.getConversationId(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          e.identifier || e.number!
        ) === incomingConversationId &&
        (e.name === 'MessageError' ||
          e.name === 'OutgoingMessageError' ||
          e.name === 'SendMessageNetworkError' ||
          e.name === 'SignedPreKeyRotationError' ||
          e.name === 'OutgoingIdentityKeyError')
    );
    this.set({ errors: errors[1] });
    return errors[0][0];
  }

  async send(
    promise: Promise<CallbackResultType | void | null>
  ): Promise<void | Array<void>> {
    this.trigger('pending');
    return (promise as Promise<CallbackResultType>)
      .then(async result => {
        this.trigger('done');

        // This is used by sendSyncMessage, then set to null
        if (result.dataMessage) {
          this.set({ dataMessage: result.dataMessage });
        }

        const sentTo = this.get('sent_to') || [];
        this.set({
          sent_to: _.union(sentTo, result.successfulIdentifiers),
          sent: true,
          expirationStartTimestamp: Date.now(),
          unidentifiedDeliveries: result.unidentifiedDeliveries,
        });

        if (!this.doNotSave) {
          await window.Signal.Data.saveMessage(this.attributes, {
            Message: window.Whisper.Message,
          });
        }

        this.trigger('sent', this);
        this.sendSyncMessage();
      })
      .catch((result: CustomError | CallbackResultType) => {
        this.trigger('done');

        if ('dataMessage' in result && result.dataMessage) {
          this.set({ dataMessage: result.dataMessage });
        }

        let promises = [];

        // If we successfully sent to a user, we can remove our unregistered flag.
        let successfulIdentifiers: Array<string>;
        if ('successfulIdentifiers' in result) {
          ({ successfulIdentifiers = [] } = result);
        } else {
          successfulIdentifiers = [];
        }
        successfulIdentifiers.forEach((identifier: string) => {
          const c = window.ConversationController.get(identifier);
          if (c && c.isEverUnregistered()) {
            c.setRegistered();
          }
        });

        const isError = (e: unknown): e is CustomError => e instanceof Error;

        if (isError(result)) {
          this.saveErrors(result);
          if (result.name === 'SignedPreKeyRotationError') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            promises.push(window.getAccountManager()!.rotateSignedPreKey());
          } else if (result.name === 'OutgoingIdentityKeyError') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const c = window.ConversationController.get(result.number)!;
            promises.push(c.getProfiles());
          }
        } else {
          if (successfulIdentifiers.length > 0) {
            const sentTo = this.get('sent_to') || [];

            // If we just found out that we couldn't send to a user because they are no
            //   longer registered, we will update our unregistered flag. In groups we
            //   will not event try to send to them for 6 hours. And we will never try
            //   to fetch them on startup again.
            // The way to discover registration once more is:
            //   1) any attempt to send to them in 1:1 conversation
            //   2) the six-hour time period has passed and we send in a group again
            const unregisteredUserErrors = _.filter(
              result.errors,
              error => error.name === 'UnregisteredUserError'
            );
            unregisteredUserErrors.forEach(error => {
              const c = window.ConversationController.get(error.identifier);
              if (c) {
                c.setUnregistered();
              }
            });

            // In groups, we don't treat unregistered users as a user-visible
            //   error. The message will look successful, but the details
            //   screen will show that we didn't send to these unregistered users.
            const filteredErrors = _.reject(
              result.errors,
              error => error.name === 'UnregisteredUserError'
            );

            // We don't start the expiration timer if there are real errors
            //   left after filtering out all of the unregistered user errors.
            const expirationStartTimestamp = filteredErrors.length
              ? null
              : Date.now();

            this.saveErrors(filteredErrors);

            this.set({
              sent_to: _.union(sentTo, result.successfulIdentifiers),
              sent: true,
              expirationStartTimestamp,
              unidentifiedDeliveries: result.unidentifiedDeliveries,
            });
            promises.push(this.sendSyncMessage());
          } else if (result.errors) {
            this.saveErrors(result.errors);
          }
          promises = promises.concat(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            _.map(result.errors, error => {
              if (error.name === 'OutgoingIdentityKeyError') {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const c = window.ConversationController.get(
                  error.identifier || error.number
                )!;
                promises.push(c.getProfiles());
              }
            })
          );
        }

        this.trigger('send-error', this.get('errors'));

        return Promise.all(promises);
      });
  }

  async sendSyncMessageOnly(dataMessage: ArrayBuffer): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conv = this.getConversation()!;
    this.set({ dataMessage });

    try {
      this.set({
        // These are the same as a normal send()
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sent_to: [conv.getSendTarget()!],
        sent: true,
        expirationStartTimestamp: Date.now(),
      });
      const result: typeof window.WhatIsThis = await this.sendSyncMessage();
      this.set({
        // We have to do this afterward, since we didn't have a previous send!
        unidentifiedDeliveries: result ? result.unidentifiedDeliveries : null,

        // These are unique to a Note to Self message - immediately read/delivered
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        delivered_to: [window.ConversationController.getOurConversationId()!],
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        read_by: [window.ConversationController.getOurConversationId()!],
      });
    } catch (result) {
      const errors = (result && result.errors) || [new Error('Unknown error')];
      this.set({ errors });
    } finally {
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: window.Whisper.Message,
      });
      this.trigger('done');

      const errors = this.get('errors');
      if (errors) {
        this.trigger('send-error', errors);
      } else {
        this.trigger('sent');
      }
    }
  }

  async sendSyncMessage(): Promise<WhatIsThis> {
    const ourNumber = window.textsecure.storage.user.getNumber();
    const ourUuid = window.textsecure.storage.user.getUuid();
    const { wrap, sendOptions } = window.ConversationController.prepareForSend(
      ourUuid || ourNumber,
      {
        syncMessage: true,
      }
    );

    this.syncPromise = this.syncPromise || Promise.resolve();
    const next = async () => {
      const dataMessage = this.get('dataMessage');
      if (!dataMessage) {
        return Promise.resolve();
      }
      const isUpdate = Boolean(this.get('synced'));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const conv = this.getConversation()!;

      return wrap(
        window.textsecure.messaging.sendSyncMessage(
          dataMessage,
          this.get('sent_at'),
          conv.get('e164'),
          conv.get('uuid'),
          this.get('expirationStartTimestamp'),
          this.get('sent_to'),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.get('unidentifiedDeliveries')!,
          isUpdate,
          sendOptions
        )
      ).then(async (result: unknown) => {
        this.set({
          synced: true,
          dataMessage: null,
        });

        // Return early, skip the save
        if (this.doNotSave) {
          return result;
        }

        await window.Signal.Data.saveMessage(this.attributes, {
          Message: window.Whisper.Message,
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

  // NOTE: If you're modifying this function then you'll likely also need
  // to modify queueAttachmentDownloads since it contains the logic below
  hasAttachmentDownloads(): boolean {
    const attachments = this.get('attachments') || [];

    const [longMessageAttachments, normalAttachments] = _.partition(
      attachments,
      attachment => MIME.isLongMessage(attachment.contentType)
    );

    if (longMessageAttachments.length > 0) {
      return true;
    }

    const hasNormalAttachments = normalAttachments.some(attachment => {
      if (!attachment) {
        return false;
      }
      // We've already downloaded this!
      if (attachment.path) {
        return false;
      }
      return true;
    });
    if (hasNormalAttachments) {
      return true;
    }

    const previews = this.get('preview') || [];
    const hasPreviews = previews.some(item => {
      if (!item.image) {
        return false;
      }
      // We've already downloaded this!
      if (item.image.path) {
        return false;
      }
      return true;
    });
    if (hasPreviews) {
      return true;
    }

    const contacts = this.get('contact') || [];
    const hasContacts = contacts.some(item => {
      if (!item.avatar || !item.avatar.avatar) {
        return false;
      }
      if (item.avatar.avatar.path) {
        return false;
      }
      return true;
    });
    if (hasContacts) {
      return true;
    }

    const quote = this.get('quote');
    const quoteAttachments =
      quote && quote.attachments ? quote.attachments : [];
    const hasQuoteAttachments = quoteAttachments.some(item => {
      if (!item.thumbnail) {
        return false;
      }
      // We've already downloaded this!
      if (item.thumbnail.path) {
        return false;
      }
      return true;
    });
    if (hasQuoteAttachments) {
      return true;
    }

    const sticker = this.get('sticker');
    if (sticker) {
      return !sticker.data || (sticker.data && !sticker.data.path);
    }

    return false;
  }

  // Receive logic
  // NOTE: If you're changing any logic in this function that deals with the
  // count then you'll also have to modify the above function
  // hasAttachmentDownloads
  async queueAttachmentDownloads(): Promise<boolean> {
    const attachmentsToQueue = this.get('attachments') || [];
    const messageId = this.id;
    let count = 0;
    let bodyPending;

    window.log.info(
      `Queueing ${
        attachmentsToQueue.length
      } attachment downloads for message ${this.idForLogging()}`
    );

    const [
      longMessageAttachments,
      normalAttachments,
    ] = _.partition(attachmentsToQueue, attachment =>
      MIME.isLongMessage(attachment.contentType)
    );

    if (longMessageAttachments.length > 1) {
      window.log.error(
        `Received more than one long message attachment in message ${this.idForLogging()}`
      );
    }

    window.log.info(
      `Queueing ${
        longMessageAttachments.length
      } long message attachment downloads for message ${this.idForLogging()}`
    );

    if (longMessageAttachments.length > 0) {
      count += 1;
      bodyPending = true;
      await window.Signal.AttachmentDownloads.addJob(
        longMessageAttachments[0],
        {
          messageId,
          type: 'long-message',
          index: 0,
        }
      );
    }

    window.log.info(
      `Queueing ${
        normalAttachments.length
      } normal attachment downloads for message ${this.idForLogging()}`
    );
    const attachments = await Promise.all(
      normalAttachments.map((attachment, index) => {
        if (!attachment) {
          return attachment;
        }
        // We've already downloaded this!
        if (attachment.path) {
          window.log.info(
            `Normal attachment already downloaded for message ${this.idForLogging()}`
          );
          return attachment;
        }

        count += 1;

        return window.Signal.AttachmentDownloads.addJob<
          typeof window.WhatIsThis
        >(attachment, {
          messageId,
          type: 'attachment',
          index,
        });
      })
    );

    const previewsToQueue = this.get('preview') || [];
    window.log.info(
      `Queueing ${
        previewsToQueue.length
      } preview attachment downloads for message ${this.idForLogging()}`
    );
    const preview = await Promise.all(
      previewsToQueue.map(async (item, index) => {
        if (!item.image) {
          return item;
        }
        // We've already downloaded this!
        if (item.image.path) {
          window.log.info(
            `Preview attachment already downloaded for message ${this.idForLogging()}`
          );
          return item;
        }

        count += 1;
        return {
          ...item,
          image: await window.Signal.AttachmentDownloads.addJob(item.image, {
            messageId,
            type: 'preview',
            index,
          }),
        };
      })
    );

    const contactsToQueue = this.get('contact') || [];
    window.log.info(
      `Queueing ${
        contactsToQueue.length
      } contact attachment downloads for message ${this.idForLogging()}`
    );
    const contact = await Promise.all(
      contactsToQueue.map(async (item, index) => {
        if (!item.avatar || !item.avatar.avatar) {
          return item;
        }
        // We've already downloaded this!
        if (item.avatar.avatar.path) {
          window.log.info(
            `Contact attachment already downloaded for message ${this.idForLogging()}`
          );
          return item;
        }

        count += 1;
        return {
          ...item,
          avatar: {
            ...item.avatar,
            avatar: await window.Signal.AttachmentDownloads.addJob(
              item.avatar.avatar,
              {
                messageId,
                type: 'contact',
                index,
              }
            ),
          },
        };
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let quote = this.get('quote')!;
    const quoteAttachmentsToQueue =
      quote && quote.attachments ? quote.attachments : [];
    window.log.info(
      `Queueing ${
        quoteAttachmentsToQueue.length
      } quote attachment downloads for message ${this.idForLogging()}`
    );
    if (quoteAttachmentsToQueue.length > 0) {
      quote = {
        ...quote,
        attachments: await Promise.all(
          (quote.attachments || []).map(async (item, index) => {
            if (!item.thumbnail) {
              return item;
            }
            // We've already downloaded this!
            if (item.thumbnail.path) {
              window.log.info(
                `Quote attachment already downloaded for message ${this.idForLogging()}`
              );
              return item;
            }

            count += 1;
            return {
              ...item,
              thumbnail: await window.Signal.AttachmentDownloads.addJob(
                item.thumbnail,
                {
                  messageId,
                  type: 'quote',
                  index,
                }
              ),
            };
          })
        ),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let sticker = this.get('sticker')!;
    if (sticker && sticker.data && sticker.data.path) {
      window.log.info(
        `Sticker attachment already downloaded for message ${this.idForLogging()}`
      );
    } else if (sticker) {
      window.log.info(
        `Queueing sticker download for message ${this.idForLogging()}`
      );
      count += 1;
      const { packId, stickerId, packKey } = sticker;

      const status = getStickerPackStatus(packId);
      let data;

      if (status && (status === 'downloaded' || status === 'installed')) {
        try {
          const copiedSticker = await copyStickerToAttachments(
            packId,
            stickerId
          );
          data = {
            ...copiedSticker,
            contentType: 'image/webp',
          };
        } catch (error) {
          window.log.error(
            `Problem copying sticker (${packId}, ${stickerId}) to attachments:`,
            error && error.stack ? error.stack : error
          );
        }
      }
      if (!data) {
        data = await window.Signal.AttachmentDownloads.addJob(sticker.data, {
          messageId,
          type: 'sticker',
          index: 0,
        });
      }
      if (!status) {
        // Save the packId/packKey for future download/install
        savePackMetadata(packId, packKey, { messageId });
      } else {
        await addStickerPackReference(messageId, packId);
      }

      sticker = {
        ...sticker,
        packId,
        data,
      };
    }

    window.log.info(
      `Queued ${count} total attachment downloads for message ${this.idForLogging()}`
    );

    if (count > 0) {
      this.set({
        bodyPending,
        attachments,
        preview,
        contact,
        quote,
        sticker,
      });

      return true;
    }

    return false;
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

    window.log.info(
      'markAttachmentAsCorrupted: marking an attachment as corrupted'
    );

    this.set({
      attachments: newAttachments,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async copyFromQuotedMessage(message: WhatIsThis): Promise<boolean> {
    const { quote } = message;
    if (!quote) {
      return message;
    }

    const { attachments, id, author, authorUuid } = quote;
    const firstAttachment = attachments[0];
    const authorConversationId = window.ConversationController.ensureContactIds(
      {
        e164: author,
        uuid: authorUuid,
      }
    );

    const inMemoryMessage = window.MessageController.findBySentAt(id);

    let queryMessage;

    if (inMemoryMessage) {
      queryMessage = inMemoryMessage;
    } else {
      window.log.info('copyFromQuotedMessage: db lookup needed', id);
      const collection = await window.Signal.Data.getMessagesBySentAt(id, {
        MessageCollection: window.Whisper.MessageCollection,
      });
      const found = collection.find(item => {
        const messageAuthorId = item.getContactId();

        return authorConversationId === messageAuthorId;
      });

      if (!found) {
        quote.referencedMessageNotFound = true;
        return message;
      }

      queryMessage = window.MessageController.register(found.id, found);
    }

    if (queryMessage.isTapToView()) {
      quote.text = null;
      quote.attachments = [
        {
          contentType: 'image/jpeg',
        },
      ];

      return message;
    }

    quote.text = queryMessage.get('body');
    if (firstAttachment) {
      firstAttachment.thumbnail = null;
    }

    if (
      !firstAttachment ||
      (!GoogleChrome.isImageTypeSupported(firstAttachment.contentType) &&
        !GoogleChrome.isVideoTypeSupported(firstAttachment.contentType))
    ) {
      return message;
    }

    try {
      if (
        queryMessage.get('schemaVersion') <
        TypedMessage.VERSION_NEEDED_FOR_DISPLAY
      ) {
        const upgradedMessage = await upgradeMessageSchema(
          queryMessage.attributes
        );
        queryMessage.set(upgradedMessage);
        await window.Signal.Data.saveMessage(upgradedMessage, {
          Message: window.Whisper.Message,
        });
      }
    } catch (error) {
      window.log.error(
        'Problem upgrading message quoted message from database',
        Errors.toLogFormat(error)
      );
      return message;
    }

    const queryAttachments = queryMessage.get('attachments') || [];
    if (queryAttachments.length > 0) {
      const queryFirst = queryAttachments[0];
      const { thumbnail } = queryFirst;

      if (thumbnail && thumbnail.path) {
        firstAttachment.thumbnail = {
          ...thumbnail,
          copied: true,
        };
      }
    }

    const queryPreview = queryMessage.get('preview') || [];
    if (queryPreview.length > 0) {
      const queryFirst = queryPreview[0];
      const { image } = queryFirst;

      if (image && image.path) {
        firstAttachment.thumbnail = {
          ...image,
          copied: true,
        };
      }
    }

    const sticker = queryMessage.get('sticker');
    if (sticker && sticker.data && sticker.data.path) {
      firstAttachment.thumbnail = {
        ...sticker.data,
        copied: true,
      };
    }

    return message;
  }

  handleDataMessage(
    initialMessage: DataMessageClass,
    confirm: () => void,
    options: { data?: typeof window.WhatIsThis } = {}
  ): WhatIsThis {
    const { data } = options;

    // This function is called from the background script in a few scenarios:
    //   1. on an incoming message
    //   2. on a sent message sync'd from another device
    //   3. in rare cases, an incoming message can be retried, though it will
    //      still go through one of the previous two codepaths
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const message = this;
    const source = message.get('source');
    const sourceUuid = message.get('sourceUuid');
    const type = message.get('type');
    const conversationId = message.get('conversationId');
    const GROUP_TYPES = window.textsecure.protobuf.GroupContext.Type;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const conversation = window.ConversationController.get(conversationId)!;
    return conversation.queueJob(async () => {
      window.log.info(
        `Starting handleDataMessage for message ${message.idForLogging()} in conversation ${conversation.idForLogging()}`
      );

      // First, check for duplicates. If we find one, stop processing here.
      const inMemoryMessage = window.MessageController.findBySender(
        this.getSenderIdentifier()
      );
      if (inMemoryMessage) {
        window.log.info(
          'handleDataMessage: cache hit',
          this.getSenderIdentifier()
        );
      } else {
        window.log.info(
          'handleDataMessage: duplicate check db lookup needed',
          this.getSenderIdentifier()
        );
      }
      const existingMessage =
        inMemoryMessage ||
        (await getMessageBySender(this.attributes, {
          Message: window.Whisper.Message,
        }));
      const isUpdate = Boolean(data && data.isRecipientUpdate);

      if (existingMessage && type === 'incoming') {
        window.log.warn('Received duplicate message', this.idForLogging());
        confirm();
        return;
      }
      if (type === 'outgoing') {
        if (isUpdate && existingMessage) {
          window.log.info(
            `handleDataMessage: Updating message ${message.idForLogging()} with received transcript`
          );

          let sentTo = [];
          let unidentifiedDeliveries = [];
          if (Array.isArray(data.unidentifiedStatus)) {
            sentTo = data.unidentifiedStatus.map(
              (item: typeof window.WhatIsThis) => item.destination
            );

            const unidentified = _.filter(data.unidentifiedStatus, item =>
              Boolean(item.unidentified)
            );
            unidentifiedDeliveries = unidentified.map(item => item.destination);
          }

          const toUpdate = window.MessageController.register(
            existingMessage.id,
            existingMessage
          );
          toUpdate.set({
            sent_to: _.union(toUpdate.get('sent_to'), sentTo),
            unidentifiedDeliveries: _.union(
              toUpdate.get('unidentifiedDeliveries'),
              unidentifiedDeliveries
            ),
          });
          await window.Signal.Data.saveMessage(toUpdate.attributes, {
            Message: window.Whisper.Message,
          });

          confirm();
          return;
        }
        if (isUpdate) {
          window.log.warn(
            `handleDataMessage: Received update transcript, but no existing entry for message ${message.idForLogging()}. Dropping.`
          );

          confirm();
          return;
        }
        if (existingMessage) {
          window.log.warn(
            `handleDataMessage: Received duplicate transcript for message ${message.idForLogging()}, but it was not an update transcript. Dropping.`
          );

          confirm();
          return;
        }
      }

      // GroupV2

      if (initialMessage.groupV2) {
        if (conversation.isGroupV1()) {
          // If we received a GroupV2 message in a GroupV1 group, we migrate!

          const { revision, groupChange } = initialMessage.groupV2;
          await window.Signal.Groups.respondToGroupV2Migration({
            conversation,
            groupChangeBase64: groupChange,
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

          // Standard GroupV2 modification codepath
          const existingRevision = conversation.get('revision');
          const isV2GroupUpdate =
            initialMessage.groupV2 &&
            _.isNumber(initialMessage.groupV2.revision) &&
            (!existingRevision ||
              initialMessage.groupV2.revision > existingRevision);

          if (isV2GroupUpdate && initialMessage.groupV2) {
            const { revision, groupChange } = initialMessage.groupV2;
            try {
              await window.Signal.Groups.maybeUpdateGroup({
                conversation,
                groupChangeBase64: groupChange,
                newRevision: revision,
                receivedAt: message.get('received_at'),
                sentAt: message.get('sent_at'),
              });
            } catch (error) {
              const errorText = error && error.stack ? error.stack : error;
              window.log.error(
                `handleDataMessage: Failed to process group update for ${conversation.idForLogging()} as part of message ${message.idForLogging()}: ${errorText}`
              );
              throw error;
            }
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ourConversationId = window.ConversationController.getOurConversationId()!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const senderId = window.ConversationController.ensureContactIds({
        e164: source,
        uuid: sourceUuid,
      })!;
      const isGroupV2 = Boolean(initialMessage.groupV2);
      const isV1GroupUpdate =
        initialMessage.group &&
        initialMessage.group.type !==
          window.textsecure.protobuf.GroupContext.Type.DELIVER;

      // Drop an incoming GroupV2 message if we or the sender are not part of the group
      //   after applying the message's associated group changes.
      if (
        type === 'incoming' &&
        !conversation.isPrivate() &&
        isGroupV2 &&
        (conversation.get('left') ||
          !conversation.hasMember(ourConversationId) ||
          !conversation.hasMember(senderId))
      ) {
        window.log.warn(
          `Received message destined for group ${conversation.idForLogging()}, which we or the sender are not a part of. Dropping.`
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
        !conversation.isPrivate() &&
        !isGroupV2 &&
        !isV1GroupUpdate &&
        conversation.get('members') &&
        (conversation.get('left') || !conversation.hasMember(ourConversationId))
      ) {
        window.log.warn(
          `Received message destined for group ${conversation.idForLogging()}, which we're not a part of. Dropping.`
        );
        confirm();
        return;
      }

      // Because GroupV1 messages can now be multiplexed into GroupV2 conversations, we
      //   drop GroupV1 updates in GroupV2 groups.
      if (isV1GroupUpdate && conversation.isGroupV2()) {
        window.log.warn(
          `Received GroupV1 update in GroupV2 conversation ${conversation.idForLogging()}. Dropping.`
        );
        confirm();
        return;
      }

      // Send delivery receipts, but only for incoming sealed sender messages
      // and not for messages from unaccepted conversations
      if (
        type === 'incoming' &&
        this.get('unidentifiedDeliveryReceived') &&
        !this.hasErrors() &&
        conversation.getAccepted()
      ) {
        // Note: We both queue and batch because we want to wait until we are done
        //   processing incoming messages to start sending outgoing delivery receipts.
        //   The queue can be paused easily.
        window.Whisper.deliveryReceiptQueue.add(() => {
          window.Whisper.deliveryReceiptBatcher.add({
            source,
            sourceUuid,
            timestamp: this.get('sent_at'),
          });
        });
      }

      const withQuoteReference = await this.copyFromQuotedMessage(
        initialMessage
      );
      const dataMessage = await upgradeMessageSchema(withQuoteReference);

      try {
        const now = new Date().getTime();

        const urls = window.Signal.LinkPreviews.findLinks(dataMessage.body);
        const incomingPreview = dataMessage.preview || [];
        const preview = incomingPreview.filter(
          (item: typeof window.WhatIsThis) =>
            (item.image || item.title) &&
            urls.includes(item.url) &&
            window.Signal.LinkPreviews.isLinkSafeToPreview(item.url)
        );
        if (preview.length < incomingPreview.length) {
          window.log.info(
            `${message.idForLogging()}: Eliminated ${
              preview.length - incomingPreview.length
            } previews with invalid urls'`
          );
        }

        message.set({
          id: window.getGuid(),
          attachments: dataMessage.attachments,
          body: dataMessage.body,
          bodyRanges: dataMessage.bodyRanges,
          contact: dataMessage.contact,
          conversationId: conversation.id,
          decrypted_at: now,
          errors: [],
          flags: dataMessage.flags,
          hasAttachments: dataMessage.hasAttachments,
          hasFileAttachments: dataMessage.hasFileAttachments,
          hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
          isViewOnce: Boolean(dataMessage.isViewOnce),
          preview,
          requiredProtocolVersion:
            dataMessage.requiredProtocolVersion ||
            this.INITIAL_PROTOCOL_VERSION,
          supportedVersionAtReceive: this.CURRENT_PROTOCOL_VERSION,
          quote: dataMessage.quote,
          schemaVersion: dataMessage.schemaVersion,
          sticker: dataMessage.sticker,
        });

        const isSupported = !message.isUnsupportedMessage();
        if (!isSupported) {
          await message.eraseContents();
        }

        if (isSupported) {
          let attributes = {
            ...conversation.attributes,
          };

          // GroupV1
          if (!isGroupV2 && dataMessage.group) {
            const pendingGroupUpdate = [];
            const memberConversations: Array<typeof window.WhatIsThis> = await Promise.all(
              dataMessage.group.membersE164.map((e164: string) =>
                window.ConversationController.getOrCreateAndWait(
                  e164,
                  'private'
                )
              )
            );
            const members = memberConversations.map(c => c.get('id'));
            attributes = {
              ...attributes,
              type: 'group',
              groupId: dataMessage.group.id,
            };
            if (dataMessage.group.type === GROUP_TYPES.UPDATE) {
              attributes = {
                ...attributes,
                name: dataMessage.group.name,
                members: _.union(members, conversation.get('members')),
              };

              if (dataMessage.group.name !== conversation.get('name')) {
                pendingGroupUpdate.push(['name', dataMessage.group.name]);
              }

              const avatarAttachment = dataMessage.group.avatar;

              let downloadedAvatar;
              let hash;
              if (avatarAttachment) {
                try {
                  downloadedAvatar = await window.Signal.Util.downloadAttachment(
                    avatarAttachment
                  );

                  if (downloadedAvatar) {
                    const loadedAttachment = await window.Signal.Migrations.loadAttachmentData(
                      downloadedAvatar
                    );

                    hash = await window.Signal.Types.Conversation.computeHash(
                      loadedAttachment.data
                    );
                  }
                } catch (err) {
                  window.log.info(
                    'handleDataMessage: group avatar download failed'
                  );
                }
              }

              const existingAvatar = conversation.get('avatar');

              if (
                // Avatar added
                (!existingAvatar && avatarAttachment) ||
                // Avatar changed
                (existingAvatar && existingAvatar.hash !== hash) ||
                // Avatar removed
                (existingAvatar && !avatarAttachment)
              ) {
                // Removes existing avatar from disk
                if (existingAvatar && existingAvatar.path) {
                  await window.Signal.Migrations.deleteAttachmentData(
                    existingAvatar.path
                  );
                }

                let avatar = null;
                if (downloadedAvatar && avatarAttachment !== null) {
                  const onDiskAttachment = await window.Signal.Types.Attachment.migrateDataToFileSystem(
                    downloadedAvatar,
                    {
                      writeNewAttachmentData:
                        window.Signal.Migrations.writeNewAttachmentData,
                    }
                  );
                  avatar = {
                    ...onDiskAttachment,
                    hash,
                  };
                }

                attributes.avatar = avatar;

                pendingGroupUpdate.push(['avatarUpdated', true]);
              } else {
                window.log.info(
                  'handleDataMessage: Group avatar hash matched; not replacing group avatar'
                );
              }

              const difference = _.difference(
                members,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                conversation.get('members')!
              );
              if (difference.length > 0) {
                // Because GroupV1 groups are based on e164 only
                const e164s = difference.map(id => {
                  const c = window.ConversationController.get(id);
                  return c ? c.get('e164') : null;
                });
                pendingGroupUpdate.push(['joined', e164s]);
              }
              if (conversation.get('left')) {
                window.log.warn('re-added to a left group');
                attributes.left = false;
                conversation.set({ addedBy: message.getContactId() });
              }
            } else if (dataMessage.group.type === GROUP_TYPES.QUIT) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const sender = window.ConversationController.get(senderId)!;
              const inGroup = Boolean(
                sender &&
                  (conversation.get('members') || []).includes(sender.id)
              );
              if (!inGroup) {
                const senderString = sender ? sender.idForLogging() : null;
                window.log.info(
                  `Got 'left' message from someone not in group: ${senderString}. Dropping.`
                );
                return;
              }

              if (sender.isMe()) {
                attributes.left = true;
                pendingGroupUpdate.push(['left', 'You']);
              } else {
                pendingGroupUpdate.push(['left', sender.get('id')]);
              }
              attributes.members = _.without(
                conversation.get('members'),
                sender.get('id')
              );
            }

            if (pendingGroupUpdate.length) {
              const groupUpdate = pendingGroupUpdate.reduce(
                (acc, [key, value]) => {
                  acc[key] = value;
                  return acc;
                },
                {} as typeof window.WhatIsThis
              );
              message.set({ group_update: groupUpdate });
            }
          }

          // Drop empty messages after. This needs to happen after the initial
          // message.set call and after GroupV1 processing to make sure all possible
          // properties are set before we determine that a message is empty.
          if (message.isEmpty()) {
            window.log.info(
              `handleDataMessage: Dropping empty message ${message.idForLogging()} in conversation ${conversation.idForLogging()}`
            );
            confirm();
            return;
          }

          attributes.active_at = now;
          conversation.set(attributes);

          if (dataMessage.expireTimer) {
            message.set({ expireTimer: dataMessage.expireTimer });
          }

          if (!isGroupV2) {
            if (message.isExpirationTimerUpdate()) {
              message.set({
                expirationTimerUpdate: {
                  source,
                  sourceUuid,
                  expireTimer: dataMessage.expireTimer,
                },
              });
              conversation.set({ expireTimer: dataMessage.expireTimer });
            }

            // NOTE: Remove once the above calls this.model.updateExpirationTimer()
            const { expireTimer } = dataMessage;
            const shouldLogExpireTimerChange =
              message.isExpirationTimerUpdate() || expireTimer;
            if (shouldLogExpireTimerChange) {
              window.log.info("Update conversation 'expireTimer'", {
                id: conversation.idForLogging(),
                expireTimer,
                source: 'handleDataMessage',
              });
            }

            if (!message.isEndSession()) {
              if (dataMessage.expireTimer) {
                if (
                  dataMessage.expireTimer !== conversation.get('expireTimer')
                ) {
                  conversation.updateExpirationTimer(
                    dataMessage.expireTimer,
                    source,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    message.getReceivedAt()!,
                    {
                      fromGroupUpdate: message.isGroupUpdate(),
                    }
                  );
                }
              } else if (
                conversation.get('expireTimer') &&
                // We only turn off timers if it's not a group update
                !message.isGroupUpdate()
              ) {
                conversation.updateExpirationTimer(
                  undefined,
                  source,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  message.getReceivedAt()!
                );
              }
            }
          }

          if (dataMessage.profileKey) {
            const profileKey = dataMessage.profileKey.toString('base64');
            if (
              source === window.textsecure.storage.user.getNumber() ||
              sourceUuid === window.textsecure.storage.user.getUuid()
            ) {
              conversation.set({ profileSharing: true });
            } else if (conversation.isPrivate()) {
              conversation.setProfileKey(profileKey);
            } else {
              const localId = window.ConversationController.ensureContactIds({
                e164: source,
                uuid: sourceUuid,
              });
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              window.ConversationController.get(localId)!.setProfileKey(
                profileKey
              );
            }
          }

          if (message.isTapToView() && type === 'outgoing') {
            await message.eraseContents();
          }

          if (
            type === 'incoming' &&
            message.isTapToView() &&
            !message.isValidTapToView()
          ) {
            window.log.warn(
              `Received tap to view message ${message.idForLogging()} with invalid data. Erasing contents.`
            );
            message.set({
              isTapToViewInvalid: true,
            });
            await message.eraseContents();
          }
        }

        const conversationTimestamp = conversation.get('timestamp');
        if (
          !conversationTimestamp ||
          message.get('sent_at') > conversationTimestamp
        ) {
          conversation.set({
            lastMessage: message.getNotificationText(),
            timestamp: message.get('sent_at'),
          });
        }

        window.MessageController.register(
          message.id,
          message as typeof window.WhatIsThis
        );
        conversation.incrementMessageCount();
        window.Signal.Data.updateConversation(conversation.attributes);

        // Only queue attachments for downloads if this is an outgoing message
        // or we've accepted the conversation
        const reduxState = window.reduxStore.getState();
        const attachments = this.get('attachments') || [];
        const shouldHoldOffDownload =
          (isImage(attachments) || isVideo(attachments)) &&
          isInCall(reduxState);
        if (
          this.hasAttachmentDownloads() &&
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (this.getConversation()!.getAccepted() || message.isOutgoing()) &&
          !shouldHoldOffDownload
        ) {
          if (window.attachmentDownloadQueue) {
            window.attachmentDownloadQueue.unshift(message);
            window.log.info(
              'Adding to attachmentDownloadQueue',
              message.get('sent_at')
            );
          } else {
            await message.queueAttachmentDownloads();
          }
        }

        const isFirstRun = true;
        await this.modifyTargetMessage(conversation, isFirstRun);

        window.log.info(
          'handleDataMessage: Batching save for',
          message.get('sent_at')
        );
        this.saveAndNotify(conversation, confirm);
      } catch (error) {
        const errorForLog = error && error.stack ? error.stack : error;
        window.log.error(
          'handleDataMessage',
          message.idForLogging(),
          'error:',
          errorForLog
        );
        throw error;
      }
    });
  }

  async saveAndNotify(
    conversation: ConversationModel,
    confirm: () => void
  ): Promise<void> {
    await window.Signal.Util.saveNewMessageBatcher.add(this.attributes);

    window.log.info('Message saved', this.get('sent_at'));

    conversation.trigger('newmessage', this);

    const isFirstRun = false;
    await this.modifyTargetMessage(conversation, isFirstRun);

    if (this.get('unread')) {
      await conversation.notify(this);
    }

    // Increment the sent message count if this is an outgoing message
    if (this.get('type') === 'outgoing') {
      conversation.incrementSentMessageCount();
    }

    window.Whisper.events.trigger('incrementProgress');
    confirm();
  }

  // This function is called twice - once from handleDataMessage, and then again from
  //    saveAndNotify, a function called at the end of handleDataMessage as a cleanup for
  //    any missed out-of-order events.
  async modifyTargetMessage(
    conversation: ConversationModel,
    isFirstRun: boolean
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const message = this;
    const type = message.get('type');

    if (type === 'outgoing') {
      const receipts = window.Whisper.DeliveryReceipts.forMessage(
        conversation,
        message
      );
      receipts.forEach(receipt =>
        message.set({
          delivered: (message.get('delivered') || 0) + 1,
          delivered_to: _.union(message.get('delivered_to') || [], [
            receipt.get('deliveredTo'),
          ]),
        })
      );
    }

    if (type === 'incoming') {
      const readSync = window.Whisper.ReadSyncs.forMessage(message);
      if (readSync) {
        if (
          message.get('expireTimer') &&
          !message.get('expirationStartTimestamp')
        ) {
          message.set(
            'expirationStartTimestamp',
            Math.min(readSync.get('read_at'), Date.now())
          );
        }

        message.unset('unread');
        // This is primarily to allow the conversation to mark all older
        // messages as read, as is done when we receive a read sync for
        // a message we already know about.
        const c = message.getConversation();
        if (c) {
          c.onReadMessage(message);
        }
      } else if (isFirstRun) {
        conversation.set({
          unreadCount: (conversation.get('unreadCount') || 0) + 1,
          isArchived: false,
        });
      }
    }

    if (type === 'outgoing') {
      const reads = window.Whisper.ReadReceipts.forMessage(
        conversation,
        message
      );
      if (reads.length) {
        const readBy = reads.map(receipt => receipt.get('reader'));
        message.set({
          read_by: _.union(message.get('read_by'), readBy),
        });
      }

      // A sync'd message to ourself is automatically considered read/delivered
      if (conversation.isMe()) {
        message.set({
          read_by: conversation.getRecipients(),
          delivered_to: conversation.getRecipients(),
        });
      }

      message.set({ recipients: conversation.getRecipients() });
    }

    // Check for out-of-order view syncs
    if (type === 'incoming' && message.isTapToView()) {
      const viewSync = window.Whisper.ViewSyncs.forMessage(message);
      if (viewSync) {
        await message.markViewed({ fromSync: true });
      }
    }

    // Does this message have any pending, previously-received associated reactions?
    const reactions = window.Whisper.Reactions.forMessage(message);
    await Promise.all(
      reactions.map(reaction => message.handleReaction(reaction, false))
    );

    // Does this message have any pending, previously-received associated
    // delete for everyone messages?
    const deletes = window.Whisper.Deletes.forMessage(message);
    await Promise.all(
      deletes.map(del =>
        window.Signal.Util.deleteForEveryone(message, del, false)
      )
    );
  }

  async handleReaction(
    reaction: typeof window.WhatIsThis,
    shouldPersist = true
  ): Promise<void> {
    if (this.get('deletedForEveryone')) {
      return;
    }

    // We allow you to react to messages with outgoing errors only if it has sent
    //   successfully to at least one person.
    if (
      this.hasErrors() &&
      (this.isIncoming() || this.getMessagePropStatus() !== 'partial-sent')
    ) {
      return;
    }

    const reactions = this.get('reactions') || [];
    const messageId = this.idForLogging();
    const count = reactions.length;

    const conversation = window.ConversationController.get(
      this.get('conversationId')
    );

    let staleReactionFromId: string | undefined;

    if (reaction.get('remove')) {
      window.log.info('Removing reaction for message', messageId);
      const newReactions = reactions.filter(
        re =>
          re.emoji !== reaction.get('emoji') ||
          re.fromId !== reaction.get('fromId')
      );
      this.set({ reactions: newReactions });

      staleReactionFromId = reaction.get('fromId');
    } else {
      window.log.info('Adding reaction for message', messageId);
      const newReactions = reactions.filter(
        re => re.fromId !== reaction.get('fromId')
      );
      newReactions.push(reaction.toJSON());
      this.set({ reactions: newReactions });

      const oldReaction = reactions.find(
        re => re.fromId === reaction.get('fromId')
      );
      if (oldReaction) {
        staleReactionFromId = oldReaction.fromId;
      }

      // Only notify for reactions to our own messages
      if (conversation && this.isOutgoing() && !reaction.get('fromSync')) {
        conversation.notify(this, reaction);
      }
    }

    if (staleReactionFromId) {
      this.clearNotifications(reaction.get('fromId'));
    }

    const newCount = this.get('reactions').length;
    window.log.info(
      `Done processing reaction for message ${messageId}. Went from ${count} to ${newCount} reactions.`
    );

    if (shouldPersist) {
      await window.Signal.Data.saveMessage(this.attributes, {
        Message: window.Whisper.Message,
      });
    }
  }

  async handleDeleteForEveryone(
    del: typeof window.WhatIsThis,
    shouldPersist = true
  ): Promise<void> {
    window.log.info('Handling DOE.', {
      fromId: del.get('fromId'),
      targetSentTimestamp: del.get('targetSentTimestamp'),
      messageServerTimestamp: this.get('serverTimestamp'),
      deleteServerTimestamp: del.get('serverTimestamp'),
    });

    // Remove any notifications for this message
    window.Whisper.Notifications.removeBy({ messageId: this.get('id') });

    // Erase the contents of this message
    await this.eraseContents(
      { deletedForEveryone: true, reactions: [] },
      shouldPersist
    );

    // Update the conversation's last message in case this was the last message
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.getConversation()!.updateLastMessage();
  }

  clearNotifications(reactionFromId?: string): void {
    window.Whisper.Notifications.removeBy({
      messageId: this.id,
      reactionFromId,
    });
  }
}

window.Whisper.Message = MessageModel as typeof window.WhatIsThis;

window.Whisper.Message.getLongMessageAttachment = ({
  body,
  attachments,
  now,
}) => {
  if (!body || body.length <= 2048) {
    return {
      body,
      attachments,
    };
  }

  const data = bytesFromString(body);
  const attachment = {
    contentType: MIME.LONG_MESSAGE,
    fileName: `long-message-${now}.txt`,
    data,
    size: data.byteLength,
  };

  return {
    body: body.slice(0, 2048),
    attachments: [attachment, ...attachments],
  };
};

window.Whisper.Message.updateTimers = () => {
  window.Whisper.ExpiringMessagesListener.update();
  window.Whisper.TapToViewMessagesListener.update();
};

window.Whisper.MessageCollection = window.Backbone.Collection.extend({
  model: window.Whisper.Message,
  comparator(left: typeof window.WhatIsThis, right: typeof window.WhatIsThis) {
    if (left.get('received_at') === right.get('received_at')) {
      return (left.get('sent_at') || 0) - (right.get('sent_at') || 0);
    }

    return (left.get('received_at') || 0) - (right.get('received_at') || 0);
  },
});
