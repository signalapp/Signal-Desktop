// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { Aci, Pni } from '@signalapp/libsignal-client';
import pMap from 'p-map';
import pTimeout from 'p-timeout';
import { Readable } from 'stream';

import { Backups } from '../../protobuf';
import Data from '../../sql/Client';
import type { PageMessagesCursorType } from '../../sql/Interface';
import * as log from '../../logging/log';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories';
import type { ServiceIdString } from '../../types/ServiceId';
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
import { isNormalBubble } from '../../state/selectors/message';
import * as Bytes from '../../Bytes';
import { canBeSynced as canPreferredReactionEmojiBeSynced } from '../../reactions/preferredReactionEmoji';
import { SendStatus } from '../../messages/MessageSendState';
import { BACKUP_VERSION } from './constants';

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
  private readonly convoIdToRecipientId = new Map<string, number>();
  private buffers = new Array<Uint8Array>();
  private nextRecipientId = 0;
  private flushResolve: (() => void) | undefined;

  public run(): void {
    drop(
      (async () => {
        log.info('BackupExportStream: starting...');
        await Data.pauseWriteAccess();

        try {
          await this.unsafeRun();
        } catch (error) {
          this.emit('error', error);
        } finally {
          await Data.resumeWriteAccess();
          log.info('BackupExportStream: finished');
        }
      })()
    );
  }

  private async unsafeRun(): Promise<void> {
    this.push(
      Backups.BackupInfo.encodeDelimited({
        version: Long.fromNumber(BACKUP_VERSION),
        backupTimeMs: getSafeLongFromTimestamp(Date.now()),
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

    for (const { attributes } of window.ConversationController.getAll()) {
      const recipientId = this.getRecipientId(attributes);

      this.pushFrame({
        chat: {
          // We don't have to use separate identifiers
          id: recipientId,
          recipientId,

          archived: attributes.isArchived === true,
          pinnedOrder: attributes.isPinned === true ? 1 : null,
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

    try {
      while (!cursor?.done) {
        // eslint-disable-next-line no-await-in-loop
        const { messages, cursor: newCursor } = await Data.pageMessages(cursor);

        // eslint-disable-next-line no-await-in-loop
        const items = await pMap(
          messages,
          message => this.toChatItem(message),
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

    return {
      profileKey: storage.get('profileKey'),
      username: me.get('username'),
      usernameLink: {
        ...(storage.get('usernameLink') ?? {}),

        // Same numeric value, no conversion needed
        color: storage.get('usernameLinkColor'),
      },
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
    message: MessageAttributesType
  ): Promise<Backups.IChatItem | undefined> {
    if (!isNormalBubble(message)) {
      return undefined;
    }

    const chatId = this.getRecipientId({ id: message.conversationId });
    if (chatId === undefined) {
      log.warn('backups: message chat not found');
      return undefined;
    }

    let authorId: Long;

    const isOutgoing = message.type === 'outgoing';

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
    } else {
      return undefined;
    }

    const result: Backups.IChatItem = {
      chatId,
      authorId,
      dateSent: getSafeLongFromTimestamp(message.sent_at),
      expireStartDate:
        message.expirationStartTimestamp != null
          ? getSafeLongFromTimestamp(message.expirationStartTimestamp)
          : null,
      expiresInMs:
        message.expireTimer != null
          ? Long.fromNumber(DurationInSeconds.toMillis(message.expireTimer))
          : null,
      revisions: [],
      sms: false,
      standardMessage: {
        quote: await this.toQuote(message.quote),
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
      },
    };

    if (isOutgoing) {
      const BackupSendStatus = Backups.SendStatus.Status;

      const sendStatus = new Array<Backups.ISendStatus>();
      const { sendStateByConversationId = {} } = message;
      for (const [id, entry] of Object.entries(sendStateByConversationId)) {
        const target = window.ConversationController.get(id);
        strictAssert(target != null, 'Send target not found');

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
            mentionAci: Aci.parseFromServiceIdString(
              range.mentionAci
            ).getRawUuidBytes(),
          }
        : {
            // Numeric values are compatible between backup and message protos
            style: range.style,
          }),
    };
  }
}
