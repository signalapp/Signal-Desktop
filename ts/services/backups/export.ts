// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import type { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import pMap from 'p-map';
import pTimeout from 'p-timeout';
import { Readable } from 'stream';

import { Backups, SignalService } from '../../protobuf';
import Data from '../../sql/Client';
import type { PageMessagesCursorType } from '../../sql/Interface';
import * as log from '../../logging/log';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories';
import {
  isPniString,
  type AciString,
  type ServiceIdString,
} from '../../types/ServiceId';
import type { RawBodyRange } from '../../types/BodyRange';
import { LONG_ATTACHMENT_LIMIT } from '../../types/Message';
import type {
  ConversationAttributesType,
  MessageAttributesType,
  QuotedAttachment,
  QuotedMessageType,
} from '../../model-types.d';
import { drop } from '../../util/drop';
import { explodePromise } from '../../util/explodePromise';
import {
  isDirectConversation,
  isGroup,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { uuidToBytes } from '../../util/uuidToBytes';
import { assertDev, strictAssert } from '../../util/assert';
import { getSafeLongFromTimestamp } from '../../util/timestampLongUtils';
import { MINUTE, SECOND, DurationInSeconds } from '../../util/durations';
import {
  PhoneNumberDiscoverability,
  parsePhoneNumberDiscoverability,
} from '../../util/phoneNumberDiscoverability';
import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from '../../util/phoneNumberSharingMode';
import { missingCaseError } from '../../util/missingCaseError';
import {
  isCallHistory,
  isChatSessionRefreshed,
  isContactRemovedNotification,
  isConversationMerge,
  isDeliveryIssue,
  isEndSession,
  isExpirationTimerUpdate,
  isGiftBadge,
  isGroupUpdate,
  isGroupV1Migration,
  isGroupV2Change,
  isKeyChange,
  isNormalBubble,
  isPhoneNumberDiscovery,
  isProfileChange,
  isUniversalTimerNotification,
  isUnsupportedMessage,
  isVerifiedChange,
} from '../../state/selectors/message';
import * as Bytes from '../../Bytes';
import { canBeSynced as canPreferredReactionEmojiBeSynced } from '../../reactions/preferredReactionEmoji';
import { SendStatus } from '../../messages/MessageSendState';
import { BACKUP_VERSION } from './constants';
import { getMessageIdForLogging } from '../../util/idForLogging';
import { getCallsHistoryForRedux } from '../callHistoryLoader';
import { makeLookup } from '../../util/makeLookup';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import { isAciString } from '../../util/isAciString';
import type { AboutMe } from './types';
import { messageHasPaymentEvent } from '../../messages/helpers';
import {
  numberToAddressType,
  numberToPhoneType,
} from '../../types/EmbeddedContact';
import {
  isVoiceMessage,
  type AttachmentType,
  isGIF,
  isDownloaded,
} from '../../types/Attachment';
import { convertAttachmentToFilePointer } from './util/filePointers';

const MAX_CONCURRENCY = 10;

// We want a very generous timeout to make sure that we always resume write
// access to the database.
const FLUSH_TIMEOUT = 30 * MINUTE;

// Threshold for reporting slow flushes
const REPORTING_THRESHOLD = SECOND;

type GetRecipientIdOptionsType =
  | Readonly<{
      serviceId: ServiceIdString;
      id?: string;
      e164?: string;
    }>
  | Readonly<{
      serviceId?: ServiceIdString;
      id: string;
      e164?: string;
    }>
  | Readonly<{
      serviceId?: ServiceIdString;
      id?: string;
      e164: string;
    }>;

export class BackupExportStream extends Readable {
  private readonly backupTimeMs = getSafeLongFromTimestamp(Date.now());
  private readonly convoIdToRecipientId = new Map<string, number>();
  private buffers = new Array<Uint8Array>();
  private nextRecipientId = 0;
  private flushResolve: (() => void) | undefined;

  public run(backupLevel: BackupLevel): void {
    drop(
      (async () => {
        log.info('BackupExportStream: starting...');
        await Data.pauseWriteAccess();
        try {
          await this.unsafeRun(backupLevel);
        } catch (error) {
          this.emit('error', error);
        } finally {
          await Data.resumeWriteAccess();
          log.info('BackupExportStream: finished');
        }
      })()
    );
  }

  private async unsafeRun(backupLevel: BackupLevel): Promise<void> {
    this.push(
      Backups.BackupInfo.encodeDelimited({
        version: Long.fromNumber(BACKUP_VERSION),
        backupTimeMs: this.backupTimeMs,
      }).finish()
    );

    this.pushFrame({
      account: await this.toAccountData(),
    });
    await this.flush();

    const stats = {
      conversations: 0,
      chats: 0,
      distributionLists: 0,
      messages: 0,
      skippedMessages: 0,
    };

    for (const { attributes } of window.ConversationController.getAll()) {
      const recipientId = this.getRecipientId({
        id: attributes.id,
        serviceId: attributes.serviceId,
        e164: attributes.e164,
      });

      const recipient = this.toRecipient(recipientId, attributes);
      if (recipient === undefined) {
        // Can't be backed up.
        continue;
      }

      this.pushFrame({
        recipient,
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.conversations += 1;
    }

    const distributionLists = await Data.getAllStoryDistributionsWithMembers();

    for (const list of distributionLists) {
      const { PrivacyMode } = Backups.DistributionList;

      let privacyMode: Backups.DistributionList.PrivacyMode;
      if (list.id === MY_STORY_ID) {
        if (list.isBlockList) {
          if (!list.members.length) {
            privacyMode = PrivacyMode.ALL;
          } else {
            privacyMode = PrivacyMode.ALL_EXCEPT;
          }
        } else {
          privacyMode = PrivacyMode.ONLY_WITH;
        }
      } else {
        privacyMode = PrivacyMode.ONLY_WITH;
      }

      this.pushFrame({
        recipient: {
          id: this.getDistributionListRecipientId(),
          distributionList: {
            name: list.name,
            distributionId: uuidToBytes(list.id),
            allowReplies: list.allowsReplies,
            deletionTimestamp: list.deletedAtTimestamp
              ? Long.fromNumber(list.deletedAtTimestamp)
              : null,
            privacyMode,
            memberRecipientIds: list.members.map(serviceId =>
              this.getOrPushPrivateRecipient({ serviceId })
            ),
          },
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.distributionLists += 1;
    }

    const pinnedConversationIds =
      window.storage.get('pinnedConversationIds') || [];

    for (const { attributes } of window.ConversationController.getAll()) {
      const recipientId = this.getRecipientId(attributes);

      let pinnedOrder: number | null = null;
      if (attributes.isPinned) {
        pinnedOrder = Math.max(0, pinnedConversationIds.indexOf(attributes.id));
      }

      this.pushFrame({
        chat: {
          // We don't have to use separate identifiers
          id: recipientId,
          recipientId,

          archived: attributes.isArchived === true,
          pinnedOrder,
          expirationTimerMs:
            attributes.expireTimer != null
              ? Long.fromNumber(
                  DurationInSeconds.toMillis(attributes.expireTimer)
                )
              : null,
          muteUntilMs: getSafeLongFromTimestamp(attributes.muteExpiresAt),
          markedUnread: attributes.markedUnread === true,
          dontNotifyForMentionsIfMuted:
            attributes.dontNotifyForMentionsIfMuted === true,
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.chats += 1;
    }

    let cursor: PageMessagesCursorType | undefined;

    const callHistory = getCallsHistoryForRedux();
    const callHistoryByCallId = makeLookup(callHistory, 'callId');

    const me = window.ConversationController.getOurConversationOrThrow();
    const serviceId = me.get('serviceId');
    const aci = isAciString(serviceId) ? serviceId : undefined;
    strictAssert(aci, 'We must have our own ACI');
    const aboutMe = {
      aci,
      pni: me.get('pni'),
    };

    try {
      while (!cursor?.done) {
        // eslint-disable-next-line no-await-in-loop
        const { messages, cursor: newCursor } = await Data.pageMessages(cursor);

        // eslint-disable-next-line no-await-in-loop
        const items = await pMap(
          messages,
          message =>
            this.toChatItem(message, {
              aboutMe,
              callHistoryByCallId,
              backupLevel,
            }),
          { concurrency: MAX_CONCURRENCY }
        );

        for (const chatItem of items) {
          if (chatItem === undefined) {
            stats.skippedMessages += 1;
            // Can't be backed up.
            continue;
          }

          this.pushFrame({
            chatItem,
          });

          // eslint-disable-next-line no-await-in-loop
          await this.flush();
          stats.messages += 1;
        }

        cursor = newCursor;
      }
    } finally {
      if (cursor !== undefined) {
        await Data.finishPageMessages(cursor);
      }
    }

    await this.flush();

    log.warn('backups: final stats', stats);

    this.push(null);
  }

  private pushBuffer(buffer: Uint8Array): void {
    this.buffers.push(buffer);
  }

  private pushFrame(frame: Backups.IFrame): void {
    this.pushBuffer(Backups.Frame.encodeDelimited(frame).finish());
  }

  private async flush(): Promise<void> {
    const chunk = Bytes.concatenate(this.buffers);
    this.buffers = [];

    // Below watermark, no pausing required
    if (this.push(chunk)) {
      return;
    }

    const { promise, resolve } = explodePromise<void>();
    strictAssert(this.flushResolve === undefined, 'flush already pending');
    this.flushResolve = resolve;

    const start = Date.now();
    log.info('backups: flush paused due to pushback');
    try {
      await pTimeout(promise, FLUSH_TIMEOUT);
    } finally {
      const duration = Date.now() - start;
      if (duration > REPORTING_THRESHOLD) {
        log.info(`backups: flush resumed after ${duration}ms`);
      }
      this.flushResolve = undefined;
    }
  }

  override _read(): void {
    this.flushResolve?.();
  }

  private async toAccountData(): Promise<Backups.IAccountData> {
    const { storage } = window;

    const me = window.ConversationController.getOurConversationOrThrow();

    const rawPreferredReactionEmoji = window.storage.get(
      'preferredReactionEmoji'
    );

    let preferredReactionEmoji: Array<string> | undefined;
    if (canPreferredReactionEmojiBeSynced(rawPreferredReactionEmoji)) {
      preferredReactionEmoji = rawPreferredReactionEmoji;
    }

    const PHONE_NUMBER_SHARING_MODE_ENUM =
      Backups.AccountData.PhoneNumberSharingMode;
    const rawPhoneNumberSharingMode = parsePhoneNumberSharingMode(
      storage.get('phoneNumberSharingMode')
    );
    let phoneNumberSharingMode: Backups.AccountData.PhoneNumberSharingMode;
    switch (rawPhoneNumberSharingMode) {
      case PhoneNumberSharingMode.Everybody:
        phoneNumberSharingMode = PHONE_NUMBER_SHARING_MODE_ENUM.EVERYBODY;
        break;
      case PhoneNumberSharingMode.ContactsOnly:
      case PhoneNumberSharingMode.Nobody:
        phoneNumberSharingMode = PHONE_NUMBER_SHARING_MODE_ENUM.NOBODY;
        break;
      default:
        throw missingCaseError(rawPhoneNumberSharingMode);
    }

    const usernameLink = storage.get('usernameLink');

    return {
      profileKey: storage.get('profileKey'),
      username: me.get('username') || null,
      usernameLink: usernameLink
        ? {
            ...usernameLink,

            // Same numeric value, no conversion needed
            color: storage.get('usernameLinkColor'),
          }
        : null,
      givenName: me.get('profileName'),
      familyName: me.get('profileFamilyName'),
      avatarUrlPath: storage.get('avatarUrl'),
      subscriberId: storage.get('subscriberId'),
      subscriberCurrencyCode: storage.get('subscriberCurrencyCode'),
      accountSettings: {
        readReceipts: storage.get('read-receipt-setting'),
        sealedSenderIndicators: storage.get('sealedSenderIndicators'),
        typingIndicators: window.Events.getTypingIndicatorSetting(),
        linkPreviews: window.Events.getLinkPreviewSetting(),
        notDiscoverableByPhoneNumber:
          parsePhoneNumberDiscoverability(
            storage.get('phoneNumberDiscoverability')
          ) === PhoneNumberDiscoverability.NotDiscoverable,
        preferContactAvatars: storage.get('preferContactAvatars'),
        universalExpireTimer: storage.get('universalExpireTimer'),
        preferredReactionEmoji,
        displayBadgesOnProfile: storage.get('displayBadgesOnProfile'),
        keepMutedChatsArchived: storage.get('keepMutedChatsArchived'),
        hasSetMyStoriesPrivacy: storage.get('hasSetMyStoriesPrivacy'),
        hasViewedOnboardingStory: storage.get('hasViewedOnboardingStory'),
        storiesDisabled: storage.get('hasStoriesDisabled'),
        storyViewReceiptsEnabled: storage.get('storyViewReceiptsEnabled'),
        hasCompletedUsernameOnboarding: storage.get(
          'hasCompletedUsernameOnboarding'
        ),
        phoneNumberSharingMode,
      },
    };
  }

  private getRecipientIdentifier({
    id,
    serviceId,
    e164,
  }: GetRecipientIdOptionsType): string {
    const identifier = serviceId ?? e164 ?? id;
    assertDev(identifier, 'Identifier cannot be blank');
    return identifier;
  }

  private getRecipientId(options: GetRecipientIdOptionsType): Long {
    const identifier = this.getRecipientIdentifier(options);

    const existing = this.convoIdToRecipientId.get(identifier);
    if (existing !== undefined) {
      return Long.fromNumber(existing);
    }

    const { id, serviceId, e164 } = options;

    const recipientId = this.nextRecipientId;
    this.nextRecipientId += 1;

    if (id !== undefined) {
      this.convoIdToRecipientId.set(id, recipientId);
    }
    if (serviceId !== undefined) {
      this.convoIdToRecipientId.set(serviceId, recipientId);
    }
    if (e164 !== undefined) {
      this.convoIdToRecipientId.set(e164, recipientId);
    }
    const result = Long.fromNumber(recipientId);

    return result;
  }

  private getOrPushPrivateRecipient(options: GetRecipientIdOptionsType): Long {
    const identifier = this.getRecipientIdentifier(options);
    const needsPush = !this.convoIdToRecipientId.has(identifier);
    const result = this.getRecipientId(options);

    if (needsPush) {
      const { serviceId, e164 } = options;
      this.pushFrame({
        recipient: this.toRecipient(result, {
          type: 'private',
          serviceId,
          e164,
        }),
      });
    }

    return result;
  }

  private getDistributionListRecipientId(): Long {
    const recipientId = this.nextRecipientId;
    this.nextRecipientId += 1;

    return Long.fromNumber(recipientId);
  }

  private toRecipient(
    recipientId: Long,
    convo: Omit<ConversationAttributesType, 'id' | 'version'>
  ): Backups.IRecipient | undefined {
    const res: Backups.IRecipient = {
      id: recipientId,
    };

    if (isMe(convo)) {
      res.self = {};
    } else if (isDirectConversation(convo)) {
      const { Registered } = Backups.Contact;
      res.contact = {
        aci:
          convo.serviceId && convo.serviceId !== convo.pni
            ? Aci.parseFromServiceIdString(convo.serviceId).getRawUuidBytes()
            : null,
        pni: convo.pni
          ? Pni.parseFromServiceIdString(convo.pni).getRawUuidBytes()
          : null,
        username: convo.username,
        e164: convo.e164 ? Long.fromString(convo.e164) : null,
        blocked: convo.serviceId
          ? window.storage.blocked.isServiceIdBlocked(convo.serviceId)
          : null,
        hidden: convo.removalStage !== undefined,
        registered: isConversationUnregistered(convo)
          ? Registered.NOT_REGISTERED
          : Registered.REGISTERED,
        unregisteredTimestamp: convo.firstUnregisteredAt
          ? Long.fromNumber(convo.firstUnregisteredAt)
          : null,
        profileKey: convo.profileKey
          ? Bytes.fromBase64(convo.profileKey)
          : null,
        profileSharing: convo.profileSharing,
        profileGivenName: convo.profileName,
        profileFamilyName: convo.profileFamilyName,
        hideStory: convo.hideStory === true,
      };
    } else if (isGroupV2(convo) && convo.masterKey) {
      let storySendMode: Backups.Group.StorySendMode;
      switch (convo.storySendMode) {
        case StorySendMode.Always:
          storySendMode = Backups.Group.StorySendMode.ENABLED;
          break;
        case StorySendMode.Never:
          storySendMode = Backups.Group.StorySendMode.DISABLED;
          break;
        default:
          storySendMode = Backups.Group.StorySendMode.DEFAULT;
          break;
      }

      res.group = {
        masterKey: Bytes.fromBase64(convo.masterKey),
        whitelisted: convo.profileSharing,
        hideStory: convo.hideStory === true,
        storySendMode,
      };
    } else {
      return undefined;
    }

    return res;
  }

  private async toChatItem(
    message: MessageAttributesType,
    options: {
      aboutMe: AboutMe;
      callHistoryByCallId: Record<string, CallHistoryDetails>;
      backupLevel: BackupLevel;
    }
  ): Promise<Backups.IChatItem | undefined> {
    const chatId = this.getRecipientId({ id: message.conversationId });
    if (chatId === undefined) {
      log.warn('backups: message chat not found');
      return undefined;
    }

    let authorId: Long | undefined;

    const isOutgoing = message.type === 'outgoing';
    const isIncoming = message.type === 'incoming';

    if (isOutgoing) {
      const ourAci = window.storage.user.getCheckedAci();

      authorId = this.getOrPushPrivateRecipient({
        serviceId: ourAci,
      });
      // Pacify typescript
    } else if (message.sourceServiceId) {
      authorId = this.getOrPushPrivateRecipient({
        serviceId: message.sourceServiceId,
        e164: message.source,
      });
    } else if (message.source) {
      authorId = this.getOrPushPrivateRecipient({
        serviceId: message.sourceServiceId,
        e164: message.source,
      });
    }
    if (isOutgoing || isIncoming) {
      strictAssert(authorId, 'Incoming/outgoing messages require an author');
    }

    let expireStartDate: Long | undefined;
    let expiresInMs: Long | undefined;
    if (
      message.expireTimer != null &&
      message.expirationStartTimestamp != null
    ) {
      expireStartDate = getSafeLongFromTimestamp(
        message.expirationStartTimestamp
      );
      expiresInMs = Long.fromNumber(
        DurationInSeconds.toMillis(message.expireTimer)
      );
    }

    const result: Backups.IChatItem = {
      chatId,
      authorId,
      dateSent: getSafeLongFromTimestamp(message.sent_at),
      expireStartDate,
      expiresInMs,
      revisions: [],
      sms: false,
    };

    if (!isNormalBubble(message)) {
      result.directionless = {};
      return this.toChatItemFromNonBubble(result, message, options);
    }

    // TODO (DESKTOP-6964): put incoming/outgoing fields below onto non-bubble messages
    result.standardMessage = {
      quote: await this.toQuote(message.quote),
      attachments: message.attachments
        ? await Promise.all(
            message.attachments.map(attachment => {
              return this.processMessageAttachment({
                attachment,
                backupLevel: options.backupLevel,
              });
            })
          )
        : undefined,
      text: {
        // Note that we store full text on the message model so we have to
        // trim it before serializing.
        body: message.body?.slice(0, LONG_ATTACHMENT_LIMIT),
        bodyRanges: message.bodyRanges?.map(range => this.toBodyRange(range)),
      },

      linkPreview: message.preview?.map(preview => {
        return {
          url: preview.url,
          title: preview.title,
          description: preview.description,
          date: getSafeLongFromTimestamp(preview.date),
        };
      }),
      reactions: message.reactions?.map(reaction => {
        return {
          emoji: reaction.emoji,
          authorId: this.getOrPushPrivateRecipient({
            id: reaction.fromId,
          }),
          sentTimestamp: getSafeLongFromTimestamp(reaction.timestamp),
          receivedTimestamp: getSafeLongFromTimestamp(
            reaction.receivedAtDate ?? reaction.timestamp
          ),
        };
      }),
    };

    if (isOutgoing) {
      const BackupSendStatus = Backups.SendStatus.Status;

      const sendStatus = new Array<Backups.ISendStatus>();
      const { sendStateByConversationId = {} } = message;
      for (const [id, entry] of Object.entries(sendStateByConversationId)) {
        const target = window.ConversationController.get(id);
        if (!target) {
          log.warn(`backups: no send target for a message ${message.sent_at}`);
          continue;
        }

        let deliveryStatus: Backups.SendStatus.Status;
        switch (entry.status) {
          case SendStatus.Pending:
            deliveryStatus = BackupSendStatus.PENDING;
            break;
          case SendStatus.Sent:
            deliveryStatus = BackupSendStatus.SENT;
            break;
          case SendStatus.Delivered:
            deliveryStatus = BackupSendStatus.DELIVERED;
            break;
          case SendStatus.Read:
            deliveryStatus = BackupSendStatus.READ;
            break;
          case SendStatus.Viewed:
            deliveryStatus = BackupSendStatus.VIEWED;
            break;
          case SendStatus.Failed:
            deliveryStatus = BackupSendStatus.FAILED;
            break;
          default:
            throw missingCaseError(entry.status);
        }

        sendStatus.push({
          recipientId: this.getOrPushPrivateRecipient(target.attributes),
          lastStatusUpdateTimestamp:
            entry.updatedAt != null
              ? getSafeLongFromTimestamp(entry.updatedAt)
              : null,
          deliveryStatus,
        });
      }
      result.outgoing = {
        sendStatus,
      };
    } else {
      result.incoming = {
        dateReceived:
          message.received_at_ms != null
            ? getSafeLongFromTimestamp(message.received_at_ms)
            : null,
        dateServerSent:
          message.serverTimestamp != null
            ? getSafeLongFromTimestamp(message.serverTimestamp)
            : null,
        read: Boolean(message.readAt),
      };
    }

    return result;
  }

  // TODO(indutny): convert to bytes
  private aciToBytes(aci: AciString | string): Uint8Array {
    return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
  }
  private serviceIdToBytes(serviceId: ServiceIdString): Uint8Array {
    return ServiceId.parseFromServiceIdString(serviceId).getRawUuidBytes();
  }

  private async toChatItemFromNonBubble(
    chatItem: Backups.IChatItem,
    message: MessageAttributesType,
    options: {
      aboutMe: AboutMe;
      callHistoryByCallId: Record<string, CallHistoryDetails>;
    }
  ): Promise<Backups.IChatItem | undefined> {
    const { contact, sticker } = message;

    if (contact && contact[0]) {
      const contactMessage = new Backups.ContactMessage();

      // TODO (DESKTOP-6845): properly handle avatarUrlPath

      contactMessage.contact = contact.map(contactDetails => ({
        ...contactDetails,
        number: contactDetails.number?.map(number => ({
          ...number,
          type: numberToPhoneType(number.type),
        })),
        email: contactDetails.email?.map(email => ({
          ...email,
          type: numberToPhoneType(email.type),
        })),
        address: contactDetails.address?.map(address => ({
          ...address,
          type: numberToAddressType(address.type),
        })),
      }));

      // TODO (DESKTOP-6964): add reactions

      // eslint-disable-next-line no-param-reassign
      chatItem.contactMessage = contactMessage;
      return chatItem;
    }

    if (message.isErased) {
      // eslint-disable-next-line no-param-reassign
      chatItem.remoteDeletedMessage = new Backups.RemoteDeletedMessage();
      return chatItem;
    }

    if (sticker) {
      const stickerMessage = new Backups.StickerMessage();

      const stickerProto = new Backups.Sticker();
      stickerProto.emoji = sticker.emoji;
      stickerProto.packId = Bytes.fromHex(sticker.packId);
      stickerProto.packKey = Bytes.fromBase64(sticker.packKey);
      stickerProto.stickerId = sticker.stickerId;
      // TODO (DESKTOP-6845): properly handle data FilePointer

      // TODO (DESKTOP-6964): add reactions

      stickerMessage.sticker = stickerProto;
      // eslint-disable-next-line no-param-reassign
      chatItem.stickerMessage = stickerMessage;

      return chatItem;
    }

    return this.toChatItemUpdate(chatItem, message, options);
  }

  async toChatItemUpdate(
    chatItem: Backups.IChatItem,
    message: MessageAttributesType,
    options: {
      aboutMe: AboutMe;
      callHistoryByCallId: Record<string, CallHistoryDetails>;
    }
  ): Promise<Backups.IChatItem | undefined> {
    const logId = `toChatItemUpdate(${getMessageIdForLogging(message)})`;

    const updateMessage = new Backups.ChatUpdateMessage();
    // eslint-disable-next-line no-param-reassign
    chatItem.updateMessage = updateMessage;

    if (isCallHistory(message)) {
      // TODO (DESKTOP-6964)
      // const callingMessage = new Backups.CallChatUpdate();
      // const { callId } = message;
      // if (!callId) {
      //   throw new Error(
      //     `${logId}: Message was callHistory, but missing callId!`
      //   );
      // }
      // const callHistory = callHistoryByCallId[callId];
      // if (!callHistory) {
      //   throw new Error(
      //     `${logId}: Message had callId, but no call history details were found!`
      //   );
      // }
      // callingMessage.callId = Long.fromString(callId);
      // if (callHistory.mode === CallMode.Group) {
      //   const groupCall = new Backups.GroupCallChatUpdate();
      //   const { ringerId } = callHistory;
      //   if (!ringerId) {
      //     throw new Error(
      //       `${logId}: Message had missing ringerId for a group call!`
      //     );
      //   }
      //   groupCall.startedCallAci = this.aciToBytes(ringerId);
      //   groupCall.startedCallTimestamp = Long.fromNumber(callHistory.timestamp);
      //   // Note: we don't store inCallACIs, instead relying on RingRTC in-memory state
      //   callingMessage.groupCall = groupCall;
      // } else {
      //   const callMessage = new Backups.IndividualCallChatUpdate();
      //   const { direction, type, status } = callHistory;
      //   if (
      //     status === DirectCallStatus.Accepted ||
      //     status === DirectCallStatus.Pending
      //   ) {
      //     if (type === CallType.Audio) {
      //       callMessage.type =
      //         direction === CallDirection.Incoming
      //           ? Backups.IndividualCallChatUpdate.Type.INCOMING_AUDIO_CALL
      //           : Backups.IndividualCallChatUpdate.Type.OUTGOING_AUDIO_CALL;
      //     } else if (type === CallType.Video) {
      //       callMessage.type =
      //         direction === CallDirection.Incoming
      //           ? Backups.IndividualCallChatUpdate.Type.INCOMING_VIDEO_CALL
      //           : Backups.IndividualCallChatUpdate.Type.OUTGOING_VIDEO_CALL;
      //     } else {
      //       throw new Error(
      //         `${logId}: Message direct status '${status}' call had type ${type}`
      //       );
      //     }
      //   } else if (status === DirectCallStatus.Declined) {
      //     if (direction === CallDirection.Incoming) {
      //       // question: do we really not call declined calls things that we decline?
      //       throw new Error(
      //         `${logId}: Message direct call was declined but incoming`
      //       );
      //     }
      //     if (type === CallType.Audio) {
      //       callMessage.type =
      //         Backups.IndividualCallChatUpdate.Type.UNANSWERED_OUTGOING_AUDIO_CALL;
      //     } else if (type === CallType.Video) {
      //       callMessage.type =
      //         Backups.IndividualCallChatUpdate.Type.UNANSWERED_OUTGOING_VIDEO_CALL;
      //     } else {
      //       throw new Error(
      //         `${logId}: Message direct status '${status}' call had type ${type}`
      //       );
      //     }
      //   } else if (status === DirectCallStatus.Missed) {
      //     if (direction === CallDirection.Outgoing) {
      //       throw new Error(
      //         `${logId}: Message direct call was missed but outgoing`
      //       );
      //     }
      //     if (type === CallType.Audio) {
      //       callMessage.type =
      //         Backups.IndividualCallChatUpdate.Type.MISSED_INCOMING_AUDIO_CALL;
      //     } else if (type === CallType.Video) {
      //       callMessage.type =
      //         Backups.IndividualCallChatUpdate.Type.MISSED_INCOMING_VIDEO_CALL;
      //     } else {
      //       throw new Error(
      //         `${logId}: Message direct status '${status}' call had type ${type}`
      //       );
      //     }
      //   } else {
      //     throw new Error(`${logId}: Message direct call had status ${status}`);
      //   }
      //   callingMessage.callMessage = callMessage;
      // }
      // updateMessage.callingMessage = callingMessage;
      // return chatItem;
    }

    if (isExpirationTimerUpdate(message)) {
      const expiresInSeconds = message.expirationTimerUpdate?.expireTimer;
      const expiresInMs = (expiresInSeconds ?? 0) * 1000;

      const conversation = window.ConversationController.get(
        message.conversationId
      );

      if (conversation && isGroup(conversation.attributes)) {
        const groupChatUpdate = new Backups.GroupChangeChatUpdate();

        const timerUpdate = new Backups.GroupExpirationTimerUpdate();
        timerUpdate.expiresInMs = expiresInMs;

        const sourceServiceId = message.expirationTimerUpdate?.sourceServiceId;
        if (sourceServiceId && Aci.parseFromServiceIdString(sourceServiceId)) {
          timerUpdate.updaterAci = uuidToBytes(sourceServiceId);
        }

        const innerUpdate = new Backups.GroupChangeChatUpdate.Update();

        innerUpdate.groupExpirationTimerUpdate = timerUpdate;

        groupChatUpdate.updates = [innerUpdate];

        updateMessage.groupChange = groupChatUpdate;

        return chatItem;
      }

      const source =
        message.expirationTimerUpdate?.sourceServiceId ||
        message.expirationTimerUpdate?.source;
      if (source && !chatItem.authorId) {
        // eslint-disable-next-line no-param-reassign
        chatItem.authorId = this.getOrPushPrivateRecipient({
          id: source,
        });
      }

      const expirationTimerChange = new Backups.ExpirationTimerChatUpdate();
      expirationTimerChange.expiresInMs = expiresInMs;

      updateMessage.expirationTimerChange = expirationTimerChange;

      return chatItem;
    }

    if (isGroupV2Change(message)) {
      updateMessage.groupChange = await this.toGroupV2Update(message, options);

      return chatItem;
    }

    if (isKeyChange(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.IDENTITY_UPDATE;

      updateMessage.simpleUpdate = simpleUpdate;

      return chatItem;
    }

    if (isProfileChange(message)) {
      const profileChange = new Backups.ProfileChangeChatUpdate();
      if (!message.profileChange) {
        return undefined;
      }

      const { newName, oldName } = message.profileChange;
      profileChange.newName = newName;
      profileChange.previousName = oldName;

      updateMessage.profileChange = profileChange;

      return chatItem;
    }

    if (isVerifiedChange(message)) {
      // TODO (DESKTOP-6964)): it can't be this simple if we show this in groups, right?

      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.IDENTITY_VERIFIED;

      updateMessage.simpleUpdate = simpleUpdate;

      return chatItem;
    }

    if (isConversationMerge(message)) {
      const threadMerge = new Backups.ThreadMergeChatUpdate();
      const e164 = message.conversationMerge?.renderInfo.e164;
      if (!e164) {
        return undefined;
      }
      threadMerge.previousE164 = Long.fromString(e164);

      updateMessage.threadMerge = threadMerge;

      return chatItem;
    }

    if (isPhoneNumberDiscovery(message)) {
      // TODO (DESKTOP-6964): need to add to protos
    }

    if (isUniversalTimerNotification(message)) {
      // TODO (DESKTOP-6964): need to add to protos
    }

    if (isContactRemovedNotification(message)) {
      // TODO (DESKTOP-6964): this doesn't appear to be in the protos at all
    }

    if (messageHasPaymentEvent(message)) {
      // TODO (DESKTOP-6964): are these enough?
      // SimpleChatUpdate
      // PAYMENTS_ACTIVATED
      // PAYMENT_ACTIVATION_REQUEST;
    }

    if (isGiftBadge(message)) {
      // TODO (DESKTOP-6964)
    }

    if (isGroupUpdate(message)) {
      // TODO (DESKTOP-6964)
      // these old-school message types are no longer generated but we probably
      //   still want to render them
    }

    if (isGroupV1Migration(message)) {
      const { groupMigration } = message;

      const groupChatUpdate = new Backups.GroupChangeChatUpdate();

      groupChatUpdate.updates = [];

      const areWeInvited = groupMigration?.areWeInvited ?? false;
      const droppedMemberCount =
        groupMigration?.droppedMemberCount ??
        groupMigration?.droppedMemberIds?.length ??
        message.droppedGV2MemberIds?.length ??
        0;
      const invitedMemberCount =
        groupMigration?.invitedMemberCount ??
        groupMigration?.invitedMembers?.length ??
        message.invitedGV2Members?.length ??
        0;

      let addedItem = false;
      if (areWeInvited) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        container.groupV2MigrationSelfInvitedUpdate =
          new Backups.GroupV2MigrationSelfInvitedUpdate();
        groupChatUpdate.updates.push(container);
        addedItem = true;
      }
      if (droppedMemberCount > 0) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        const update = new Backups.GroupV2MigrationDroppedMembersUpdate();
        update.droppedMembersCount = droppedMemberCount;
        container.groupV2MigrationDroppedMembersUpdate = update;
        groupChatUpdate.updates.push(container);
        addedItem = true;
      }
      if (invitedMemberCount > 0) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        const update = new Backups.GroupV2MigrationInvitedMembersUpdate();
        update.invitedMembersCount = invitedMemberCount;
        container.groupV2MigrationInvitedMembersUpdate = update;
        groupChatUpdate.updates.push(container);
        addedItem = true;
      }

      if (!addedItem) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        container.groupV2MigrationUpdate = new Backups.GroupV2MigrationUpdate();
        groupChatUpdate.updates.push(container);
      }

      updateMessage.groupChange = groupChatUpdate;

      return chatItem;
    }

    if (isDeliveryIssue(message)) {
      // TODO (DESKTOP-6964)
    }

    if (isEndSession(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.END_SESSION;

      updateMessage.simpleUpdate = simpleUpdate;

      return chatItem;
    }

    if (isChatSessionRefreshed(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.CHAT_SESSION_REFRESH;

      updateMessage.simpleUpdate = simpleUpdate;

      return chatItem;
    }

    if (isUnsupportedMessage(message)) {
      // TODO (DESKTOP-6964): need to add to protos
    }

    throw new Error(
      `${logId}: Message was not a bubble, but didn't understand type`
    );
  }

  async toGroupV2Update(
    message: MessageAttributesType,
    options: {
      aboutMe: AboutMe;
    }
  ): Promise<Backups.GroupChangeChatUpdate | undefined> {
    const logId = `toGroupV2Update(${getMessageIdForLogging(message)})`;

    const { groupV2Change } = message;
    const { aboutMe } = options;
    if (!isGroupV2Change(message) || !groupV2Change) {
      throw new Error(`${logId}: Message was not a groupv2 change`);
    }

    const { from, details } = groupV2Change;
    const updates: Array<Backups.GroupChangeChatUpdate.Update> = [];

    details.forEach(detail => {
      const update = new Backups.GroupChangeChatUpdate.Update();
      const { type } = detail;

      if (type === 'create') {
        const innerUpdate = new Backups.GroupCreationUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        update.groupCreationUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-attributes') {
        const innerUpdate =
          new Backups.GroupAttributesAccessLevelChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.accessLevel = detail.newPrivilege;

        update.groupAttributesAccessLevelChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-members') {
        const innerUpdate =
          new Backups.GroupMembershipAccessLevelChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.accessLevel = detail.newPrivilege;

        update.groupMembershipAccessLevelChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-invite-link') {
        const innerUpdate = new Backups.GroupInviteLinkAdminApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.linkRequiresAdminApproval =
          detail.newPrivilege ===
          SignalService.AccessControl.AccessRequired.ADMINISTRATOR;

        update.groupInviteLinkAdminApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'announcements-only') {
        const innerUpdate = new Backups.GroupAnnouncementOnlyChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.isAnnouncementOnly = detail.announcementsOnly;

        update.groupAnnouncementOnlyChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'avatar') {
        const innerUpdate = new Backups.GroupAvatarUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.wasRemoved = detail.removed;

        update.groupAvatarUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'title') {
        const innerUpdate = new Backups.GroupNameUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.newGroupName = detail.newTitle;

        update.groupNameUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-add') {
        const innerUpdate = new Backups.GroupInviteLinkEnabledUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.linkRequiresAdminApproval =
          detail.privilege ===
          SignalService.AccessControl.AccessRequired.ADMINISTRATOR;

        update.groupInviteLinkEnabledUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-reset') {
        const innerUpdate = new Backups.GroupInviteLinkResetUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        update.groupInviteLinkResetUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-remove') {
        const innerUpdate = new Backups.GroupInviteLinkDisabledUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        update.groupInviteLinkDisabledUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add') {
        if (from && from === detail.aci) {
          const innerUpdate = new Backups.GroupMemberJoinedUpdate();
          innerUpdate.newMemberAci = this.serviceIdToBytes(from);

          update.groupMemberJoinedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberAddedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.newMemberAci = this.aciToBytes(detail.aci);

        update.groupMemberAddedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add-from-invite') {
        const { aci, pni } = detail;
        if (
          from &&
          ((pni && from === pni) ||
            (aci && from === aci) ||
            checkServiceIdEquivalence(from, aci))
        ) {
          const innerUpdate = new Backups.GroupInvitationAcceptedUpdate();
          innerUpdate.newMemberAci = this.aciToBytes(detail.aci);
          if (detail.inviter) {
            innerUpdate.inviterAci = this.aciToBytes(detail.inviter);
          }
          update.groupInvitationAcceptedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberAddedUpdate();
        innerUpdate.newMemberAci = this.aciToBytes(detail.aci);
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        if (detail.inviter) {
          innerUpdate.inviterAci = this.aciToBytes(detail.inviter);
        }
        innerUpdate.hadOpenInvitation = true;

        update.groupMemberAddedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add-from-link') {
        const innerUpdate = new Backups.GroupMemberJoinedByLinkUpdate();
        innerUpdate.newMemberAci = this.aciToBytes(detail.aci);

        update.groupMemberJoinedByLinkUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add-from-admin-approval') {
        const innerUpdate = new Backups.GroupJoinRequestApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        innerUpdate.requestorAci = this.aciToBytes(detail.aci);
        innerUpdate.wasApproved = true;

        update.groupJoinRequestApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-privilege') {
        const innerUpdate = new Backups.GroupAdminStatusUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        innerUpdate.memberAci = this.aciToBytes(detail.aci);
        innerUpdate.wasAdminStatusGranted =
          detail.newPrivilege === SignalService.Member.Role.ADMINISTRATOR;

        update.groupAdminStatusUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-remove') {
        if (from && from === detail.aci) {
          const innerUpdate = new Backups.GroupMemberLeftUpdate();
          innerUpdate.aci = this.serviceIdToBytes(from);

          update.groupMemberLeftUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberRemovedUpdate();
        if (from) {
          innerUpdate.removerAci = this.serviceIdToBytes(from);
        }
        innerUpdate.removedAci = this.aciToBytes(detail.aci);

        update.groupMemberRemovedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-add-one') {
        if (
          (aboutMe.aci && detail.serviceId === aboutMe.aci) ||
          (aboutMe.pni && detail.serviceId === aboutMe.pni)
        ) {
          const innerUpdate = new Backups.SelfInvitedToGroupUpdate();
          if (from) {
            innerUpdate.inviterAci = this.serviceIdToBytes(from);
          }

          update.selfInvitedToGroupUpdate = innerUpdate;
          updates.push(update);
          return;
        }
        if (
          from &&
          ((aboutMe.aci && from === aboutMe.aci) ||
            (aboutMe.pni && from === aboutMe.pni))
        ) {
          const innerUpdate = new Backups.SelfInvitedOtherUserToGroupUpdate();
          innerUpdate.inviteeServiceId = this.serviceIdToBytes(
            detail.serviceId
          );

          update.selfInvitedOtherUserToGroupUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupUnknownInviteeUpdate();
        if (from) {
          innerUpdate.inviterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.inviteeCount = 1;

        update.groupUnknownInviteeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-add-many') {
        const innerUpdate = new Backups.GroupUnknownInviteeUpdate();
        if (from) {
          innerUpdate.inviterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.inviteeCount = detail.count;

        update.groupUnknownInviteeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-remove-one') {
        if (from && detail.serviceId && from === detail.serviceId) {
          const innerUpdate = new Backups.GroupInvitationDeclinedUpdate();
          if (detail.inviter) {
            innerUpdate.inviterAci = this.aciToBytes(detail.inviter);
          }
          if (isAciString(detail.serviceId)) {
            innerUpdate.inviteeAci = this.aciToBytes(detail.serviceId);
          }

          update.groupInvitationDeclinedUpdate = innerUpdate;
          updates.push(update);
          return;
        }
        if (
          (aboutMe.aci && detail.serviceId === aboutMe.aci) ||
          (aboutMe.pni && detail.serviceId === aboutMe.pni)
        ) {
          const innerUpdate = new Backups.GroupSelfInvitationRevokedUpdate();
          if (from) {
            innerUpdate.revokerAci = this.serviceIdToBytes(from);
          }

          update.groupSelfInvitationRevokedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupInvitationRevokedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }
        innerUpdate.invitees = [
          {
            inviteeAci: isAciString(detail.serviceId)
              ? this.aciToBytes(detail.serviceId)
              : undefined,
            inviteePni: isPniString(detail.serviceId)
              ? this.serviceIdToBytes(detail.serviceId)
              : undefined,
          },
        ];

        update.groupInvitationRevokedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-remove-many') {
        const innerUpdate = new Backups.GroupInvitationRevokedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        innerUpdate.invitees = [];
        for (let i = 0, max = detail.count; i < max; i += 1) {
          // Yes, we're adding totally empty invitees. This is okay.
          innerUpdate.invitees.push({});
        }

        update.groupInvitationRevokedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'admin-approval-add-one') {
        const innerUpdate = new Backups.GroupJoinRequestUpdate();
        innerUpdate.requestorAci = this.aciToBytes(detail.aci);

        update.groupJoinRequestUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'admin-approval-remove-one') {
        if (from && detail.aci && from === detail.aci) {
          const innerUpdate = new Backups.GroupJoinRequestCanceledUpdate();
          innerUpdate.requestorAci = this.aciToBytes(detail.aci);

          update.groupJoinRequestCanceledUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupJoinRequestApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        innerUpdate.requestorAci = this.aciToBytes(detail.aci);
        innerUpdate.wasApproved = false;

        update.groupJoinRequestApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'admin-approval-bounce') {
        // We can't express all we need in GroupSequenceOfRequestsAndCancelsUpdate, so we
        //   add an additional groupJoinRequestUpdate to express that there
        //   is an approval pending.
        if (detail.isApprovalPending) {
          const innerUpdate = new Backups.GroupJoinRequestUpdate();
          innerUpdate.requestorAci = this.aciToBytes(detail.aci);

          // We need to create another update since the items we put in Update are oneof
          const secondUpdate = new Backups.GroupChangeChatUpdate.Update();
          secondUpdate.groupJoinRequestUpdate = innerUpdate;
          updates.push(secondUpdate);

          // not returning because we really do want both of these
        }

        const innerUpdate =
          new Backups.GroupSequenceOfRequestsAndCancelsUpdate();
        innerUpdate.requestorAci = this.aciToBytes(detail.aci);
        innerUpdate.count = detail.times;

        update.groupSequenceOfRequestsAndCancelsUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'description') {
        const innerUpdate = new Backups.GroupDescriptionUpdate();
        innerUpdate.newDescription = detail.removed
          ? undefined
          : detail.description;
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        update.groupDescriptionUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'summary') {
        const innerUpdate = new Backups.GenericGroupUpdate();
        if (from) {
          innerUpdate.updaterAci = this.serviceIdToBytes(from);
        }

        update.genericGroupUpdate = innerUpdate;
        updates.push(update);
      } else {
        throw missingCaseError(type);
      }
    });

    if (updates.length === 0) {
      throw new Error(`${logId}: No updates generated from message`);
    }

    const groupUpdate = new Backups.GroupChangeChatUpdate();
    groupUpdate.updates = updates;

    return groupUpdate;
  }

  private async toQuote(
    quote?: QuotedMessageType
  ): Promise<Backups.IQuote | null> {
    if (!quote) {
      return null;
    }

    const quotedMessage = await Data.getMessageById(quote.messageId);

    let authorId: Long;
    if (quote.authorAci) {
      authorId = this.getOrPushPrivateRecipient({
        serviceId: quote.authorAci,
        e164: quote.author,
      });
    } else if (quote.author) {
      authorId = this.getOrPushPrivateRecipient({
        serviceId: quote.authorAci,
        e164: quote.author,
      });
    } else {
      log.warn('backups: quote has no author id');
      return null;
    }

    return {
      targetSentTimestamp:
        quotedMessage && !quote.referencedMessageNotFound
          ? Long.fromNumber(quotedMessage.sent_at)
          : null,
      authorId,
      text: quote.text,
      attachments: quote.attachments.map((attachment: QuotedAttachment) => {
        return {
          contentType: attachment.contentType,
          fileName: attachment.fileName,
          thumbnail: null,
        };
      }),
      bodyRanges: quote.bodyRanges?.map(range => this.toBodyRange(range)),
      type: quote.isGiftBadge
        ? Backups.Quote.Type.GIFTBADGE
        : Backups.Quote.Type.NORMAL,
    };
  }

  private toBodyRange(range: RawBodyRange): Backups.IBodyRange {
    return {
      start: range.start,
      length: range.length,

      ...('mentionAci' in range
        ? {
            mentionAci: this.aciToBytes(range.mentionAci),
          }
        : {
            // Numeric values are compatible between backup and message protos
            style: range.style,
          }),
    };
  }

  private getMessageAttachmentFlag(
    attachment: AttachmentType
  ): Backups.MessageAttachment.Flag {
    if (isVoiceMessage(attachment)) {
      return Backups.MessageAttachment.Flag.VOICE_MESSAGE;
    }
    if (isGIF([attachment])) {
      return Backups.MessageAttachment.Flag.GIF;
    }
    if (
      attachment.flags &&
      // eslint-disable-next-line no-bitwise
      attachment.flags & SignalService.AttachmentPointer.Flags.BORDERLESS
    ) {
      return Backups.MessageAttachment.Flag.BORDERLESS;
    }

    return Backups.MessageAttachment.Flag.NONE;
  }

  private async processMessageAttachment({
    attachment,
    backupLevel,
  }: {
    attachment: AttachmentType;
    backupLevel: BackupLevel;
  }): Promise<Backups.MessageAttachment> {
    const filePointer = await this.processAttachment({
      attachment,
      backupLevel,
    });

    return new Backups.MessageAttachment({
      pointer: filePointer,
      flag: this.getMessageAttachmentFlag(attachment),
      wasDownloaded: isDownloaded(attachment), // should always be true
    });
  }

  private async processAttachment({
    attachment,
    backupLevel,
  }: {
    attachment: AttachmentType;
    backupLevel: BackupLevel;
  }): Promise<Backups.FilePointer> {
    const filePointer = await convertAttachmentToFilePointer({
      attachment,
      backupLevel,
      // TODO (DESKTOP-6983) -- Retrieve & save backup tier media list
      getBackupTierInfo: () => ({
        isInBackupTier: false,
      }),
    });
    return filePointer;
  }
}

function checkServiceIdEquivalence(
  left: ServiceIdString | undefined,
  right: ServiceIdString | undefined
) {
  const leftConvo = window.ConversationController.get(left);
  const rightConvo = window.ConversationController.get(right);

  return leftConvo && rightConvo && leftConvo === rightConvo;
}
