// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni } from '@signalapp/libsignal-client';
import { v4 as generateUuid } from 'uuid';
import pMap from 'p-map';
import { Writable } from 'stream';
import { isNumber } from 'lodash';

import { Backups, SignalService } from '../../protobuf';
import Data from '../../sql/Client';
import * as log from '../../logging/log';
import { StorySendMode } from '../../types/Stories';
import type { ServiceIdString } from '../../types/ServiceId';
import { fromAciObject, fromPniObject } from '../../types/ServiceId';
import { isStoryDistributionId } from '../../types/StoryDistributionId';
import * as Errors from '../../types/errors';
import type {
  ConversationAttributesType,
  MessageAttributesType,
} from '../../model-types.d';
import { assertDev, strictAssert } from '../../util/assert';
import { getTimestampFromLong } from '../../util/timestampLongUtils';
import { DurationInSeconds } from '../../util/durations';
import { dropNull } from '../../util/dropNull';
import {
  deriveGroupID,
  deriveGroupSecretParams,
  deriveGroupPublicParams,
} from '../../util/zkgroup';
import { incrementMessageCounter } from '../../util/incrementMessageCounter';
import { isAciString } from '../../util/isAciString';
import { createBatcher } from '../../util/batcher';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../../util/phoneNumberSharingMode';
import { bytesToUuid } from '../../util/uuidToBytes';
import { missingCaseError } from '../../util/missingCaseError';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import type { SendStateByConversationId } from '../../messages/MessageSendState';
import { SeenStatus } from '../../MessageSeenStatus';
import * as Bytes from '../../Bytes';
import { BACKUP_VERSION } from './constants';
import type { AboutMe } from './types';
import type { GroupV2ChangeDetailType } from '../../groups';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads';
import { drop } from '../../util/drop';
import { isNotNil } from '../../util/isNotNil';
import { convertFilePointerToAttachment } from './util/filePointers';

const MAX_CONCURRENCY = 10;

type ConversationOpType = Readonly<{
  isUpdate: boolean;
  attributes: ConversationAttributesType;
}>;

type ChatItemParseResult = {
  message: Partial<MessageAttributesType>;
  additionalMessages: Array<Partial<MessageAttributesType>>;
};

async function processConversationOpBatch(
  batch: ReadonlyArray<ConversationOpType>
): Promise<void> {
  // Note that we might have duplicates since we update attributes in-place
  const saves = [
    ...new Set(batch.filter(x => x.isUpdate === false).map(x => x.attributes)),
  ];
  const updates = [
    ...new Set(batch.filter(x => x.isUpdate === true).map(x => x.attributes)),
  ];

  log.info(
    `backups: running conversation op batch, saves=${saves.length} ` +
      `updates=${updates.length}`
  );

  await Data.saveConversations(saves);
  await Data.updateConversations(updates);
}

export class BackupImportStream extends Writable {
  private parsedBackupInfo = false;
  private logId = 'BackupImportStream(unknown)';
  private aboutMe: AboutMe | undefined;

  private readonly recipientIdToConvo = new Map<
    number,
    ConversationAttributesType
  >();
  private readonly chatIdToConvo = new Map<
    number,
    ConversationAttributesType
  >();
  private readonly conversationOpBatcher = createBatcher<{
    isUpdate: boolean;
    attributes: ConversationAttributesType;
  }>({
    name: 'BackupImport.conversationOpBatcher',
    wait: 0,
    maxSize: 1000,
    processBatch: processConversationOpBatch,
  });
  private readonly saveMessageBatcher = createBatcher<MessageAttributesType>({
    name: 'BackupImport.saveMessageBatcher',
    wait: 0,
    maxSize: 1000,
    processBatch: async batch => {
      const ourAci = this.ourConversation?.serviceId;
      assertDev(isAciString(ourAci), 'Our conversation must have ACI');
      await Data.saveMessages(batch, {
        forceSave: true,
        ourAci,
      });

      // TODO (DESKTOP-7402): consider re-saving after updating the pending state
      for (const messageAttributes of batch) {
        drop(queueAttachmentDownloads(messageAttributes));
      }
    },
  });
  private ourConversation?: ConversationAttributesType;
  private pinnedConversations = new Array<[number, string]>();

  constructor() {
    super({ objectMode: true });
  }

  override async _write(
    data: Buffer,
    _enc: BufferEncoding,
    done: (error?: Error) => void
  ): Promise<void> {
    try {
      if (!this.parsedBackupInfo) {
        const info = Backups.BackupInfo.decode(data);
        this.parsedBackupInfo = true;

        this.logId = `BackupImport.run(${info.backupTimeMs})`;

        log.info(`${this.logId}: got BackupInfo`);

        if (info.version?.toNumber() !== BACKUP_VERSION) {
          throw new Error(`Unsupported backup version: ${info.version}`);
        }
      } else {
        const frame = Backups.Frame.decode(data);

        await this.processFrame(frame, { aboutMe: this.aboutMe });

        if (!this.aboutMe && this.ourConversation) {
          const { serviceId, pni } = this.ourConversation;
          strictAssert(
            isAciString(serviceId),
            'ourConversation serviceId must be ACI'
          );
          this.aboutMe = {
            aci: serviceId,
            pni,
          };
        }
      }
      done();
    } catch (error) {
      const entryType = this.parsedBackupInfo ? 'frame' : 'info';
      log.error(`${this.logId}: failed to process ${entryType}`);
      done(error);
    }
  }

  override async _final(done: (error?: Error) => void): Promise<void> {
    try {
      // Finish saving remaining conversations/messages
      await this.conversationOpBatcher.flushAndWait();
      await this.saveMessageBatcher.flushAndWait();

      // Reset and reload conversations and storage again
      window.ConversationController.reset();

      await window.ConversationController.load();
      await window.ConversationController.checkForConflicts();

      window.storage.reset();
      await window.storage.fetch();

      // Update last message in every active conversation now that we have
      // them loaded into memory.
      await pMap(
        window.ConversationController.getAll().filter(convo => {
          return convo.get('active_at') || convo.get('isPinned');
        }),
        convo => convo.updateLastMessage(),
        { concurrency: MAX_CONCURRENCY }
      );

      await window.storage.put(
        'pinnedConversationIds',
        this.pinnedConversations
          .sort(([a], [b]) => {
            return a - b;
          })
          .map(([, id]) => id)
      );

      done();
    } catch (error) {
      done(error);
    }
  }

  public cleanup(): void {
    this.conversationOpBatcher.unregister();
    this.saveMessageBatcher.unregister();
  }

  private async processFrame(
    frame: Backups.Frame,
    options: { aboutMe?: AboutMe }
  ): Promise<void> {
    const { aboutMe } = options;

    if (frame.account) {
      await this.fromAccount(frame.account);

      // We run this outside of try catch below because failure to restore
      // the account data is fatal.
      return;
    }

    try {
      if (frame.recipient) {
        const { recipient } = frame;
        strictAssert(recipient.id != null, 'Recipient must have an id');
        let convo: ConversationAttributesType;
        if (recipient.contact) {
          convo = await this.fromContact(recipient.contact);
        } else if (recipient.self) {
          strictAssert(this.ourConversation != null, 'Missing account data');
          convo = this.ourConversation;
        } else if (recipient.group) {
          convo = await this.fromGroup(recipient.group);
        } else if (recipient.distributionList) {
          await this.fromDistributionList(recipient.distributionList);

          // Not a conversation
          return;
        } else {
          log.warn(`${this.logId}: unsupported recipient item`);
          return;
        }

        if (convo !== this.ourConversation) {
          this.saveConversation(convo);
        }

        this.recipientIdToConvo.set(recipient.id.toNumber(), convo);
      } else if (frame.chat) {
        await this.fromChat(frame.chat);
      } else if (frame.chatItem) {
        if (!aboutMe) {
          throw new Error(
            'processFrame: Processing a chatItem frame, but no aboutMe data!'
          );
        }

        await this.fromChatItem(frame.chatItem, { aboutMe });
      } else {
        log.warn(`${this.logId}: unsupported frame item ${frame.item}`);
      }
    } catch (error) {
      log.error(
        `${this.logId}: failed to process a frame ${frame.item}, ` +
          `${Errors.toLogFormat(error)}`
      );
    }
  }

  private saveConversation(attributes: ConversationAttributesType): void {
    this.conversationOpBatcher.add({ isUpdate: false, attributes });
  }

  private updateConversation(attributes: ConversationAttributesType): void {
    this.conversationOpBatcher.add({ isUpdate: true, attributes });
  }

  private saveMessage(attributes: MessageAttributesType): void {
    this.saveMessageBatcher.add(attributes);
  }

  private async fromAccount({
    profileKey,
    username,
    usernameLink,
    givenName,
    familyName,
    avatarUrlPath,
    subscriberId,
    subscriberCurrencyCode,
    accountSettings,
  }: Backups.IAccountData): Promise<void> {
    strictAssert(this.ourConversation === undefined, 'Duplicate AccountData');
    const me =
      window.ConversationController.getOurConversationOrThrow().attributes;
    this.ourConversation = me;

    const { storage } = window;

    strictAssert(Bytes.isNotEmpty(profileKey), 'Missing profile key');
    await storage.put('profileKey', profileKey);

    if (username != null) {
      me.username = username;
    }

    if (usernameLink != null) {
      const { entropy, serverId, color } = usernameLink;
      if (Bytes.isNotEmpty(entropy) && Bytes.isNotEmpty(serverId)) {
        await storage.put('usernameLink', {
          entropy,
          serverId,
        });
      }

      // Same numeric value, no conversion needed
      await storage.put('usernameLinkColor', color ?? 0);
    }

    if (givenName != null) {
      me.profileName = givenName;
    }
    if (familyName != null) {
      me.profileFamilyName = familyName;
    }
    if (avatarUrlPath != null) {
      await storage.put('avatarUrl', avatarUrlPath);
    }
    if (subscriberId != null) {
      await storage.put('subscriberId', subscriberId);
    }
    if (subscriberCurrencyCode != null) {
      await storage.put('subscriberCurrencyCode', subscriberCurrencyCode);
    }

    await storage.put(
      'read-receipt-setting',
      accountSettings?.readReceipts === true
    );
    await storage.put(
      'sealedSenderIndicators',
      accountSettings?.sealedSenderIndicators === true
    );
    await storage.put(
      'typingIndicators',
      accountSettings?.typingIndicators === true
    );
    await storage.put('linkPreviews', accountSettings?.linkPreviews === true);
    await storage.put(
      'preferContactAvatars',
      accountSettings?.preferContactAvatars === true
    );
    await storage.put(
      'displayBadgesOnProfile',
      accountSettings?.displayBadgesOnProfile === true
    );
    await storage.put(
      'keepMutedChatsArchived',
      accountSettings?.keepMutedChatsArchived === true
    );
    await storage.put(
      'hasSetMyStoriesPrivacy',
      accountSettings?.hasSetMyStoriesPrivacy === true
    );
    await storage.put(
      'hasViewedOnboardingStory',
      accountSettings?.hasViewedOnboardingStory === true
    );
    await storage.put(
      'hasStoriesDisabled',
      accountSettings?.storiesDisabled === true
    );
    await storage.put(
      'storyViewReceiptsEnabled',
      accountSettings?.storyViewReceiptsEnabled === true
    );
    await storage.put(
      'hasCompletedUsernameOnboarding',
      accountSettings?.hasCompletedUsernameOnboarding === true
    );
    await storage.put(
      'preferredReactionEmoji',
      accountSettings?.preferredReactionEmoji || []
    );
    await storage.put(
      'preferredReactionEmoji',
      accountSettings?.preferredReactionEmoji || []
    );

    const { PhoneNumberSharingMode: BackupMode } = Backups.AccountData;
    switch (accountSettings?.phoneNumberSharingMode) {
      case BackupMode.EVERYBODY:
        await storage.put(
          'phoneNumberSharingMode',
          PhoneNumberSharingMode.Everybody
        );
        break;
      case BackupMode.UNKNOWN:
      case BackupMode.NOBODY:
      default:
        await storage.put(
          'phoneNumberSharingMode',
          PhoneNumberSharingMode.Nobody
        );
        break;
    }

    if (accountSettings?.notDiscoverableByPhoneNumber) {
      await window.storage.put(
        'phoneNumberDiscoverability',
        PhoneNumberDiscoverability.NotDiscoverable
      );
    } else {
      await window.storage.put(
        'phoneNumberDiscoverability',
        PhoneNumberDiscoverability.Discoverable
      );
    }

    this.updateConversation(me);
  }

  private async fromContact(
    contact: Backups.IContact
  ): Promise<ConversationAttributesType> {
    strictAssert(
      contact.aci != null || contact.pni != null || contact.e164 != null,
      'fromContact: either aci, pni, or e164 must be present'
    );

    const aci = contact.aci
      ? fromAciObject(Aci.fromUuidBytes(contact.aci))
      : undefined;
    const pni = contact.pni
      ? fromPniObject(Pni.fromUuidBytes(contact.pni))
      : undefined;
    const e164 = contact.e164 ? `+${contact.e164}` : undefined;

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'private',
      version: 2,
      serviceId: aci ?? pni,
      pni,
      e164,
      removalStage: contact.hidden ? 'messageRequest' : undefined,
      profileKey: contact.profileKey
        ? Bytes.toBase64(contact.profileKey)
        : undefined,
      profileSharing: contact.profileSharing === true,
      profileName: dropNull(contact.profileGivenName),
      profileFamilyName: dropNull(contact.profileFamilyName),
      hideStory: contact.hideStory === true,
    };

    if (contact.registered === Backups.Contact.Registered.NOT_REGISTERED) {
      const timestamp = contact.unregisteredTimestamp?.toNumber() ?? Date.now();
      attrs.discoveredUnregisteredAt = timestamp;
      attrs.firstUnregisteredAt = timestamp;
    }

    if (contact.blocked) {
      const serviceId = aci || pni;
      if (serviceId) {
        await window.storage.blocked.addBlockedServiceId(serviceId);
      }
      if (e164) {
        await window.storage.blocked.addBlockedNumber(e164);
      }
    }

    return attrs;
  }

  private async fromGroup(
    group: Backups.IGroup
  ): Promise<ConversationAttributesType> {
    strictAssert(group.masterKey != null, 'fromGroup: missing masterKey');

    const secretParams = deriveGroupSecretParams(group.masterKey);
    const publicParams = deriveGroupPublicParams(secretParams);
    const groupId = Bytes.toBase64(deriveGroupID(secretParams));

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'group',
      version: 2,
      groupVersion: 2,
      masterKey: Bytes.toBase64(group.masterKey),
      groupId,
      secretParams: Bytes.toBase64(secretParams),
      publicParams: Bytes.toBase64(publicParams),
      profileSharing: group.whitelisted === true,
      hideStory: group.hideStory === true,
    };

    if (group.storySendMode === Backups.Group.StorySendMode.ENABLED) {
      attrs.storySendMode = StorySendMode.Always;
    } else if (group.storySendMode === Backups.Group.StorySendMode.DISABLED) {
      attrs.storySendMode = StorySendMode.Never;
    }

    return attrs;
  }

  private async fromDistributionList(
    list: Backups.IDistributionList
  ): Promise<void> {
    strictAssert(
      Bytes.isNotEmpty(list.distributionId),
      'Missing distribution list id'
    );

    const id = bytesToUuid(list.distributionId);
    strictAssert(isStoryDistributionId(id), 'Invalid distribution list id');

    strictAssert(
      list.privacyMode != null,
      'Missing distribution list privacy mode'
    );

    let isBlockList: boolean;
    const { PrivacyMode } = Backups.DistributionList;
    switch (list.privacyMode) {
      case PrivacyMode.ALL:
        strictAssert(
          !list.memberRecipientIds?.length,
          'Distribution list with ALL privacy mode has members'
        );
        isBlockList = true;
        break;
      case PrivacyMode.ALL_EXCEPT:
        strictAssert(
          list.memberRecipientIds?.length,
          'Distribution list with ALL_EXCEPT privacy mode has no members'
        );
        isBlockList = true;
        break;
      case PrivacyMode.ONLY_WITH:
        isBlockList = false;
        break;
      case PrivacyMode.UNKNOWN:
        throw new Error('Invalid privacy mode for distribution list');
      default:
        throw missingCaseError(list.privacyMode);
    }

    const result = {
      id,
      name: list.name ?? '',
      deletedAtTimestamp:
        list.deletionTimestamp == null
          ? undefined
          : getTimestampFromLong(list.deletionTimestamp),
      allowsReplies: list.allowReplies === true,
      isBlockList,
      members: (list.memberRecipientIds || []).map(recipientId => {
        const convo = this.recipientIdToConvo.get(recipientId.toNumber());
        strictAssert(convo != null, 'Missing story distribution list member');
        strictAssert(
          convo.serviceId,
          'Story distribution list member has no serviceId'
        );

        return convo.serviceId;
      }),

      // Default values
      senderKeyInfo: undefined,
      storageNeedsSync: false,
    };

    await Data.createNewStoryDistribution(result);
  }

  private async fromChat(chat: Backups.IChat): Promise<void> {
    strictAssert(chat.id != null, 'chat must have an id');
    strictAssert(chat.recipientId != null, 'chat must have a recipientId');

    const conversation = this.recipientIdToConvo.get(
      chat.recipientId.toNumber()
    );
    strictAssert(conversation !== undefined, 'unknown conversation');

    this.chatIdToConvo.set(chat.id.toNumber(), conversation);

    conversation.isArchived = chat.archived === true;
    conversation.isPinned = chat.pinnedOrder != null;

    conversation.expireTimer = chat.expirationTimerMs
      ? DurationInSeconds.fromMillis(chat.expirationTimerMs.toNumber())
      : undefined;
    conversation.muteExpiresAt = chat.muteUntilMs
      ? getTimestampFromLong(chat.muteUntilMs)
      : undefined;
    conversation.markedUnread = chat.markedUnread === true;
    conversation.dontNotifyForMentionsIfMuted =
      chat.dontNotifyForMentionsIfMuted === true;

    this.updateConversation(conversation);

    if (chat.pinnedOrder != null) {
      this.pinnedConversations.push([chat.pinnedOrder, conversation.id]);
    }
  }

  private async fromChatItem(
    item: Backups.IChatItem,
    options: { aboutMe: AboutMe }
  ): Promise<void> {
    const { aboutMe } = options;

    const timestamp = item?.dateSent?.toNumber();
    const logId = `fromChatItem(${timestamp})`;

    strictAssert(this.ourConversation != null, `${logId}: AccountData missing`);

    strictAssert(item.chatId != null, `${logId}: must have a chatId`);
    strictAssert(item.dateSent != null, `${logId}: must have a dateSent`);
    strictAssert(timestamp, `${logId}: must have a timestamp`);

    const chatConvo = this.chatIdToConvo.get(item.chatId.toNumber());
    strictAssert(
      chatConvo !== undefined,
      `${logId}: chat conversation not found`
    );

    const authorConvo = item.authorId
      ? this.recipientIdToConvo.get(item.authorId.toNumber())
      : undefined;

    let attributes: MessageAttributesType = {
      id: generateUuid(),
      canReplyToStory: false,
      conversationId: chatConvo.id,
      received_at: incrementMessageCounter(),
      sent_at: timestamp,
      source: authorConvo?.e164,
      sourceServiceId: authorConvo?.serviceId,
      timestamp,
      type: item.outgoing != null ? 'outgoing' : 'incoming',
      unidentifiedDeliveryReceived: false,
      expirationStartTimestamp: item.expireStartDate
        ? getTimestampFromLong(item.expireStartDate)
        : undefined,
      expireTimer: item.expiresInMs
        ? DurationInSeconds.fromMillis(item.expiresInMs.toNumber())
        : undefined,
    };
    const additionalMessages: Array<MessageAttributesType> = [];

    const { outgoing, incoming, directionless } = item;
    if (outgoing) {
      strictAssert(
        authorConvo && this.ourConversation.id === authorConvo?.id,
        `${logId}: outgoing message must have outgoing field`
      );

      const sendStateByConversationId: SendStateByConversationId = {};

      const BackupSendStatus = Backups.SendStatus.Status;

      for (const status of outgoing.sendStatus ?? []) {
        strictAssert(
          status.recipientId,
          'sendStatus recipient must have an id'
        );
        const target = this.recipientIdToConvo.get(
          status.recipientId.toNumber()
        );
        strictAssert(
          target !== undefined,
          'status target conversation not found'
        );

        let sendStatus: SendStatus;
        switch (status.deliveryStatus) {
          case BackupSendStatus.PENDING:
            sendStatus = SendStatus.Pending;
            break;
          case BackupSendStatus.SENT:
            sendStatus = SendStatus.Sent;
            break;
          case BackupSendStatus.DELIVERED:
            sendStatus = SendStatus.Delivered;
            break;
          case BackupSendStatus.READ:
            sendStatus = SendStatus.Read;
            break;
          case BackupSendStatus.VIEWED:
            sendStatus = SendStatus.Viewed;
            break;
          case BackupSendStatus.FAILED:
          default:
            sendStatus = SendStatus.Failed;
            break;
        }

        sendStateByConversationId[target.id] = {
          status: sendStatus,
          updatedAt:
            status.lastStatusUpdateTimestamp != null
              ? getTimestampFromLong(status.lastStatusUpdateTimestamp)
              : undefined,
        };
      }

      attributes.sendStateByConversationId = sendStateByConversationId;
      chatConvo.active_at = attributes.sent_at;
    } else if (incoming) {
      strictAssert(
        authorConvo && this.ourConversation.id !== authorConvo?.id,
        `${logId}: message with incoming field must be incoming`
      );
      attributes.received_at_ms =
        incoming.dateReceived?.toNumber() ?? Date.now();

      if (incoming.read) {
        attributes.readStatus = ReadStatus.Read;
        attributes.seenStatus = SeenStatus.Seen;
      } else {
        attributes.readStatus = ReadStatus.Unread;
        attributes.seenStatus = SeenStatus.Unseen;
        chatConvo.unreadCount = (chatConvo.unreadCount ?? 0) + 1;
      }

      chatConvo.active_at = attributes.received_at_ms;
    } else if (directionless) {
      // Nothing to do
    }

    if (item.standardMessage) {
      // TODO (DESKTOP-6964): add revisions to editHistory

      attributes = {
        ...attributes,
        ...this.fromStandardMessage(item.standardMessage),
      };
    } else {
      const result = await this.fromNonBubbleChatItem(item, {
        aboutMe,
        author: authorConvo,
        conversation: chatConvo,
        timestamp,
      });

      if (!result) {
        throw new Error(`${logId}: fromNonBubbleChat item returned nothing!`);
      }

      attributes = {
        ...attributes,
        ...result.message,
      };

      let sentAt = attributes.sent_at;
      (result.additionalMessages || []).forEach(additional => {
        sentAt -= 1;
        additionalMessages.push({
          ...attributes,
          sent_at: sentAt,
          ...additional,
        });
      });
    }

    assertDev(
      isAciString(this.ourConversation.serviceId),
      `${logId}: Our conversation must have ACI`
    );
    this.saveMessage(attributes);
    additionalMessages.forEach(additional => this.saveMessage(additional));

    // TODO (DESKTOP-6964): We'll want to increment for more types here - stickers, etc.
    if (item.standardMessage) {
      if (item.outgoing != null) {
        chatConvo.sentMessageCount = (chatConvo.sentMessageCount ?? 0) + 1;
      } else {
        chatConvo.messageCount = (chatConvo.messageCount ?? 0) + 1;
      }
    }
    this.updateConversation(chatConvo);
  }

  private fromStandardMessage(
    data: Backups.IStandardMessage
  ): Partial<MessageAttributesType> {
    return {
      body: data.text?.body ?? '',
      attachments: data.attachments
        ?.map(attachment => {
          if (!attachment.pointer) {
            return null;
          }
          return convertFilePointerToAttachment(attachment.pointer);
        })
        .filter(isNotNil),
      reactions: data.reactions?.map(
        ({ emoji, authorId, sentTimestamp, receivedTimestamp }) => {
          strictAssert(emoji != null, 'reaction must have an emoji');
          strictAssert(authorId != null, 'reaction must have authorId');
          strictAssert(
            sentTimestamp != null,
            'reaction must have a sentTimestamp'
          );
          strictAssert(
            receivedTimestamp != null,
            'reaction must have a receivedTimestamp'
          );

          const authorConvo = this.recipientIdToConvo.get(authorId.toNumber());
          strictAssert(
            authorConvo !== undefined,
            'author conversation not found'
          );

          return {
            emoji,
            fromId: authorConvo.id,
            targetTimestamp: getTimestampFromLong(sentTimestamp),
            receivedAtDate: getTimestampFromLong(receivedTimestamp),
            timestamp: getTimestampFromLong(sentTimestamp),
          };
        }
      ),
    };
  }

  private async fromNonBubbleChatItem(
    chatItem: Backups.IChatItem,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { timestamp } = options;
    const logId = `fromChatItemToNonBubble(${timestamp})`;

    if (chatItem.standardMessage) {
      throw new Error(`${logId}: Got chat item with standardMessage set!`);
    }
    if (chatItem.contactMessage) {
      // TODO (DESKTOP-6964)
    } else if (chatItem.remoteDeletedMessage) {
      return {
        message: {
          isErased: true,
        },
        additionalMessages: [],
      };
    } else if (chatItem.stickerMessage) {
      // TODO (DESKTOP-6964)
    } else if (chatItem.updateMessage) {
      return this.fromChatItemUpdateMessage(chatItem.updateMessage, options);
    } else {
      throw new Error(`${logId}: Message was missing all five message types`);
    }

    return undefined;
  }

  private async fromChatItemUpdateMessage(
    updateMessage: Backups.IChatUpdateMessage,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { aboutMe, author } = options;

    if (updateMessage.groupChange) {
      return this.fromGroupUpdateMessage(updateMessage.groupChange, options);
    }

    if (updateMessage.expirationTimerChange) {
      const { expiresInMs } = updateMessage.expirationTimerChange;

      const sourceServiceId = author?.serviceId ?? aboutMe.aci;
      const expireTimer = isNumber(expiresInMs)
        ? DurationInSeconds.fromMillis(expiresInMs)
        : DurationInSeconds.fromSeconds(0);

      return {
        message: {
          type: 'timer-notification',
          sourceServiceId,
          flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
          expirationTimerUpdate: {
            expireTimer,
            sourceServiceId,
          },
        },
        additionalMessages: [],
      };
    }

    // TODO (DESKTOP-6964): check these fields
    //   updateMessage.simpleUpdate
    //   updateMessage.profileChange
    //   updateMessage.threadMerge
    //   updateMessage.sessionSwitchover
    //   updateMessage.callingMessage

    return undefined;
  }

  private async fromGroupUpdateMessage(
    groupChange: Backups.IGroupChangeChatUpdate,
    options: {
      aboutMe: AboutMe;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { updates } = groupChange;
    const { aboutMe, timestamp } = options;
    const logId = `fromGroupUpdateMessage${timestamp}`;

    const details: Array<GroupV2ChangeDetailType> = [];
    let from: ServiceIdString | undefined;
    const additionalMessages: Array<Partial<MessageAttributesType>> = [];
    let migrationMessage: Partial<MessageAttributesType> | undefined;
    function getDefaultMigrationMessage() {
      return {
        type: 'group-v1-migration' as const,
        groupMigration: {
          areWeInvited: false,
          droppedMemberCount: 0,
          invitedMemberCount: 0,
        },
      };
    }

    let openApprovalServiceId: ServiceIdString | undefined;
    let openBounceServiceId: ServiceIdString | undefined;

    updates?.forEach(update => {
      if (update.genericGroupUpdate) {
        const { updaterAci } = update.genericGroupUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'summary',
        });
      }
      if (update.groupCreationUpdate) {
        const { updaterAci } = update.groupCreationUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'create',
        });
      }
      if (update.groupNameUpdate) {
        const { updaterAci, newGroupName } = update.groupNameUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'title',
          newTitle: dropNull(newGroupName),
        });
      }
      if (update.groupAvatarUpdate) {
        const { updaterAci, wasRemoved } = update.groupAvatarUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'avatar',
          removed: Boolean(dropNull(wasRemoved)),
        });
      }
      if (update.groupDescriptionUpdate) {
        const { updaterAci, newDescription } = update.groupDescriptionUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        const description = dropNull(newDescription);
        details.push({
          type: 'description',
          description,
          removed:
            description === undefined || description.length === 0
              ? true
              : undefined,
        });
      }
      if (update.groupMembershipAccessLevelChangeUpdate) {
        const { updaterAci, accessLevel } =
          update.groupMembershipAccessLevelChangeUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'access-members',
          newPrivilege:
            dropNull(accessLevel) ??
            SignalService.AccessControl.AccessRequired.UNKNOWN,
        });
      }
      if (update.groupAttributesAccessLevelChangeUpdate) {
        const { updaterAci, accessLevel } =
          update.groupAttributesAccessLevelChangeUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'access-attributes',
          newPrivilege:
            dropNull(accessLevel) ??
            SignalService.AccessControl.AccessRequired.UNKNOWN,
        });
      }
      if (update.groupAnnouncementOnlyChangeUpdate) {
        const { updaterAci, isAnnouncementOnly } =
          update.groupAnnouncementOnlyChangeUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'announcements-only',
          announcementsOnly: Boolean(dropNull(isAnnouncementOnly)),
        });
      }
      if (update.groupAdminStatusUpdate) {
        const { updaterAci, memberAci, wasAdminStatusGranted } =
          update.groupAdminStatusUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        if (!memberAci) {
          throw new Error(
            `${logId}: We can't render this without a target member!`
          );
        }
        details.push({
          type: 'member-privilege',
          aci: fromAciObject(Aci.fromUuidBytes(memberAci)),
          newPrivilege: wasAdminStatusGranted
            ? SignalService.Member.Role.ADMINISTRATOR
            : SignalService.Member.Role.DEFAULT,
        });
      }
      if (update.groupMemberLeftUpdate) {
        const { aci } = update.groupMemberLeftUpdate;
        if (!aci || Bytes.isEmpty(aci)) {
          throw new Error(`${logId}: groupMemberLeftUpdate had missing aci!`);
        }
        from = fromAciObject(Aci.fromUuidBytes(aci));
        details.push({
          type: 'member-remove',
          aci: fromAciObject(Aci.fromUuidBytes(aci)),
        });
      }
      if (update.groupMemberRemovedUpdate) {
        const { removerAci, removedAci } = update.groupMemberRemovedUpdate;
        if (removerAci) {
          from = fromAciObject(Aci.fromUuidBytes(removerAci));
        }
        if (!removedAci || Bytes.isEmpty(removedAci)) {
          throw new Error(
            `${logId}: groupMemberRemovedUpdate had missing removedAci!`
          );
        }
        details.push({
          type: 'member-remove',
          aci: fromAciObject(Aci.fromUuidBytes(removedAci)),
        });
      }
      if (update.selfInvitedToGroupUpdate) {
        const { inviterAci } = update.selfInvitedToGroupUpdate;
        if (inviterAci) {
          from = fromAciObject(Aci.fromUuidBytes(inviterAci));
        }
        details.push({
          type: 'pending-add-one',
          serviceId: aboutMe.aci,
        });
      }
      if (update.selfInvitedOtherUserToGroupUpdate) {
        const { inviteeServiceId } = update.selfInvitedOtherUserToGroupUpdate;
        from = aboutMe.aci;
        if (!inviteeServiceId || Bytes.isEmpty(inviteeServiceId)) {
          throw new Error(
            `${logId}: selfInvitedOtherUserToGroupUpdate had missing inviteeServiceId!`
          );
        }
        details.push({
          type: 'pending-add-one',
          serviceId: fromAciObject(Aci.fromUuidBytes(inviteeServiceId)),
        });
      }
      if (update.groupUnknownInviteeUpdate) {
        const { inviterAci, inviteeCount } = update.groupUnknownInviteeUpdate;
        if (inviterAci) {
          from = fromAciObject(Aci.fromUuidBytes(inviterAci));
        }
        if (!isNumber(inviteeCount)) {
          throw new Error(
            `${logId}: groupUnknownInviteeUpdate had non-number inviteeCount`
          );
        }
        details.push({
          type: 'pending-add-many',
          count: inviteeCount,
        });
      }
      if (update.groupInvitationAcceptedUpdate) {
        const { inviterAci, newMemberAci } =
          update.groupInvitationAcceptedUpdate;
        if (!newMemberAci || Bytes.isEmpty(newMemberAci)) {
          throw new Error(
            `${logId}: groupInvitationAcceptedUpdate had missing newMemberAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(newMemberAci));
        const inviter =
          inviterAci && Bytes.isNotEmpty(inviterAci)
            ? fromAciObject(Aci.fromUuidBytes(inviterAci))
            : undefined;
        details.push({
          type: 'member-add-from-invite',
          aci: fromAciObject(Aci.fromUuidBytes(newMemberAci)),
          inviter,
        });
      }
      if (update.groupInvitationDeclinedUpdate) {
        const { inviterAci, inviteeAci } = update.groupInvitationDeclinedUpdate;
        if (!inviteeAci || Bytes.isEmpty(inviteeAci)) {
          throw new Error(
            `${logId}: groupInvitationDeclinedUpdate had missing inviteeAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(inviteeAci));
        details.push({
          type: 'pending-remove-one',
          inviter: Bytes.isNotEmpty(inviterAci)
            ? fromAciObject(Aci.fromUuidBytes(inviterAci))
            : undefined,
          serviceId: from,
        });
      }
      if (update.groupMemberJoinedUpdate) {
        const { newMemberAci } = update.groupMemberJoinedUpdate;
        if (!newMemberAci || Bytes.isEmpty(newMemberAci)) {
          throw new Error(
            `${logId}: groupMemberJoinedUpdate had missing newMemberAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(newMemberAci));
        details.push({
          type: 'member-add',
          aci: fromAciObject(Aci.fromUuidBytes(newMemberAci)),
        });
      }
      if (update.groupMemberAddedUpdate) {
        const { hadOpenInvitation, inviterAci, newMemberAci, updaterAci } =
          update.groupMemberAddedUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        if (!newMemberAci || Bytes.isEmpty(newMemberAci)) {
          throw new Error(
            `${logId}: groupMemberAddedUpdate had missing newMemberAci!`
          );
        }
        if (hadOpenInvitation || Bytes.isNotEmpty(inviterAci)) {
          const inviter =
            inviterAci && Bytes.isNotEmpty(inviterAci)
              ? fromAciObject(Aci.fromUuidBytes(inviterAci))
              : undefined;
          details.push({
            type: 'member-add-from-invite',
            aci: fromAciObject(Aci.fromUuidBytes(newMemberAci)),
            inviter,
          });
        } else {
          details.push({
            type: 'member-add',
            aci: fromAciObject(Aci.fromUuidBytes(newMemberAci)),
          });
        }
      }
      if (update.groupSelfInvitationRevokedUpdate) {
        const { revokerAci } = update.groupSelfInvitationRevokedUpdate;
        if (Bytes.isNotEmpty(revokerAci)) {
          from = fromAciObject(Aci.fromUuidBytes(revokerAci));
        }
        details.push({
          type: 'pending-remove-one',
          serviceId: aboutMe.aci,
        });
      }
      if (update.groupInvitationRevokedUpdate) {
        const { updaterAci, invitees } = update.groupInvitationRevokedUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        if (!invitees || invitees.length === 0) {
          throw new Error(
            `${logId}: groupInvitationRevokedUpdate had missing invitees list!`
          );
        }

        if (invitees.length === 1) {
          const { inviteeAci, inviteePni } = invitees[0];
          let serviceId: ServiceIdString | undefined = Bytes.isNotEmpty(
            inviteeAci
          )
            ? fromAciObject(Aci.fromUuidBytes(inviteeAci))
            : undefined;
          if (!serviceId) {
            serviceId = Bytes.isNotEmpty(inviteePni)
              ? fromPniObject(Pni.fromUuidBytes(inviteePni))
              : undefined;
          }
          if (serviceId) {
            details.push({
              type: 'pending-remove-one',
              serviceId,
            });
          } else {
            details.push({
              type: 'pending-remove-many',
              count: 1,
            });
          }
        } else {
          details.push({
            type: 'pending-remove-many',
            count: invitees.length,
          });
        }
      }
      if (update.groupJoinRequestUpdate) {
        const { requestorAci } = update.groupJoinRequestUpdate;
        if (!requestorAci || Bytes.isEmpty(requestorAci)) {
          throw new Error(
            `${logId}: groupInvitationRevokedUpdate was missing requestorAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(requestorAci));
        openApprovalServiceId = from;
        details.push({
          type: 'admin-approval-add-one',
          aci: from,
        });
      }
      if (update.groupJoinRequestApprovalUpdate) {
        const { updaterAci, requestorAci, wasApproved } =
          update.groupJoinRequestApprovalUpdate;
        if (!requestorAci || Bytes.isEmpty(requestorAci)) {
          throw new Error(
            `${logId}: groupJoinRequestApprovalUpdate was missing requestorAci!`
          );
        }
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }

        const aci = fromAciObject(Aci.fromUuidBytes(requestorAci));
        if (wasApproved) {
          details.push({
            type: 'member-add-from-admin-approval',
            aci,
          });
        } else {
          details.push({
            type: 'admin-approval-remove-one',
            aci,
          });
        }
      }
      if (update.groupJoinRequestCanceledUpdate) {
        const { requestorAci } = update.groupJoinRequestCanceledUpdate;
        if (!requestorAci || Bytes.isEmpty(requestorAci)) {
          throw new Error(
            `${logId}: groupJoinRequestCanceledUpdate was missing requestorAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(requestorAci));
        details.push({
          type: 'admin-approval-remove-one',
          aci: from,
        });
      }
      if (update.groupInviteLinkResetUpdate) {
        const { updaterAci } = update.groupInviteLinkResetUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'group-link-reset',
        });
      }
      if (update.groupInviteLinkEnabledUpdate) {
        const { updaterAci, linkRequiresAdminApproval } =
          update.groupInviteLinkEnabledUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'group-link-add',
          privilege: linkRequiresAdminApproval
            ? SignalService.AccessControl.AccessRequired.ADMINISTRATOR
            : SignalService.AccessControl.AccessRequired.ANY,
        });
      }
      if (update.groupInviteLinkAdminApprovalUpdate) {
        const { updaterAci, linkRequiresAdminApproval } =
          update.groupInviteLinkAdminApprovalUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'access-invite-link',
          newPrivilege: linkRequiresAdminApproval
            ? SignalService.AccessControl.AccessRequired.ADMINISTRATOR
            : SignalService.AccessControl.AccessRequired.ANY,
        });
      }
      if (update.groupInviteLinkDisabledUpdate) {
        const { updaterAci } = update.groupInviteLinkDisabledUpdate;
        if (Bytes.isNotEmpty(updaterAci)) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'group-link-remove',
        });
      }
      if (update.groupMemberJoinedByLinkUpdate) {
        const { newMemberAci } = update.groupMemberJoinedByLinkUpdate;
        if (!newMemberAci || Bytes.isEmpty(newMemberAci)) {
          throw new Error(
            `${logId}: groupMemberJoinedByLinkUpdate was missing newMemberAci!`
          );
        }
        from = fromAciObject(Aci.fromUuidBytes(newMemberAci));
        details.push({
          type: 'member-add-from-link',
          aci: from,
        });
      }
      if (update.groupV2MigrationUpdate) {
        migrationMessage = migrationMessage || getDefaultMigrationMessage();
      }
      if (update.groupV2MigrationSelfInvitedUpdate) {
        migrationMessage = migrationMessage || getDefaultMigrationMessage();
        const { groupMigration } = migrationMessage;
        if (!groupMigration) {
          throw new Error(
            `${logId}: migrationMessage had no groupMigration processing groupV2MigrationSelfInvitedUpdate!`
          );
        }
        groupMigration.areWeInvited = true;
      }
      if (update.groupV2MigrationInvitedMembersUpdate) {
        migrationMessage = migrationMessage || getDefaultMigrationMessage();
        const { groupMigration } = migrationMessage;
        if (!groupMigration) {
          throw new Error(
            `${logId}: migrationMessage had no groupMigration processing groupV2MigrationInvitedMembersUpdate!`
          );
        }
        const { invitedMembersCount } =
          update.groupV2MigrationInvitedMembersUpdate;
        if (!isNumber(invitedMembersCount)) {
          throw new Error(
            `${logId}: groupV2MigrationInvitedMembersUpdate had a non-number invitedMembersCount!`
          );
        }
        groupMigration.invitedMemberCount = invitedMembersCount;
      }
      if (update.groupV2MigrationDroppedMembersUpdate) {
        migrationMessage = migrationMessage || getDefaultMigrationMessage();
        const { groupMigration } = migrationMessage;
        if (!groupMigration) {
          throw new Error(
            `${logId}: migrationMessage had no groupMigration processing groupV2MigrationDroppedMembersUpdate!`
          );
        }
        const { droppedMembersCount } =
          update.groupV2MigrationDroppedMembersUpdate;
        if (!isNumber(droppedMembersCount)) {
          throw new Error(
            `${logId}: groupV2MigrationDroppedMembersUpdate had a non-number droppedMembersCount!`
          );
        }
        groupMigration.droppedMemberCount = droppedMembersCount;
      }
      if (update.groupSequenceOfRequestsAndCancelsUpdate) {
        const { count, requestorAci } =
          update.groupSequenceOfRequestsAndCancelsUpdate;
        if (!requestorAci || Bytes.isEmpty(requestorAci)) {
          throw new Error(
            `${logId}: groupSequenceOfRequestsAndCancelsUpdate was missing requestorAci!`
          );
        }
        if (!isNumber(count)) {
          throw new Error(
            `${logId}: groupSequenceOfRequestsAndCancelsUpdate had a non-number count!`
          );
        }
        const aci = fromAciObject(Aci.fromUuidBytes(requestorAci));
        openBounceServiceId = aci;
        from = aci;
        details.push({
          type: 'admin-approval-bounce',
          aci,
          times: count,
          // This will be set later if we find an open approval request for this aci
          isApprovalPending: false,
        });
      }
      if (update.groupExpirationTimerUpdate) {
        const { updaterAci, expiresInMs } = update.groupExpirationTimerUpdate;
        if (!updaterAci || Bytes.isEmpty(updaterAci)) {
          throw new Error(
            `${logId}: groupExpirationTimerUpdate was missing updaterAci!`
          );
        }
        const sourceServiceId = fromAciObject(Aci.fromUuidBytes(updaterAci));
        const expireTimer = isNumber(expiresInMs)
          ? DurationInSeconds.fromMillis(expiresInMs)
          : undefined;
        additionalMessages.push({
          type: 'timer-notification',
          sourceServiceId,
          flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
          expirationTimerUpdate: {
            expireTimer,
            sourceServiceId,
          },
        });
      }
    });

    let finalDetails = details;
    if (
      openApprovalServiceId &&
      openBounceServiceId &&
      openApprovalServiceId === openBounceServiceId
    ) {
      finalDetails = details
        .map(item => {
          const approvalMatch =
            item.type === 'admin-approval-add-one' &&
            item.aci === openApprovalServiceId;
          if (approvalMatch) {
            return undefined;
          }

          const bounceMatch =
            item.type === 'admin-approval-bounce' &&
            item.aci === openApprovalServiceId;
          if (bounceMatch) {
            return {
              ...item,
              isApprovalPending: true,
            };
          }

          return item;
        })
        .filter(isNotNil);
    }

    if (migrationMessage) {
      additionalMessages.push(migrationMessage);
    }

    if (finalDetails.length === 0 && additionalMessages.length > 0) {
      return {
        message: additionalMessages[0],
        additionalMessages: additionalMessages.slice(1),
      };
    }

    if (finalDetails.length === 0) {
      return undefined;
    }

    return {
      message: {
        type: 'group-v2-change',
        groupV2Change: {
          from,
          details: finalDetails,
        },
      },
      additionalMessages,
    };
  }
}
