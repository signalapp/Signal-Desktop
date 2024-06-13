// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni } from '@signalapp/libsignal-client';
import { ReceiptCredentialPresentation } from '@signalapp/libsignal-client/zkgroup';
import { v4 as generateUuid } from 'uuid';
import pMap from 'p-map';
import { Writable } from 'stream';
import { isNumber } from 'lodash';

import { Backups, SignalService } from '../../protobuf';
import Data from '../../sql/Client';
import type { StoryDistributionWithMembersType } from '../../sql/Interface';
import * as log from '../../logging/log';
import { GiftBadgeStates } from '../../components/conversation/Message';
import { StorySendMode } from '../../types/Stories';
import type { ServiceIdString, AciString } from '../../types/ServiceId';
import { fromAciObject, fromPniObject } from '../../types/ServiceId';
import { isStoryDistributionId } from '../../types/StoryDistributionId';
import * as Errors from '../../types/errors';
import { PaymentEventKind } from '../../types/Payment';
import {
  ContactFormType,
  AddressType as ContactAddressType,
} from '../../types/EmbeddedContact';
import {
  STICKERPACK_ID_BYTE_LEN,
  STICKERPACK_KEY_BYTE_LEN,
  downloadStickerPack,
} from '../../types/Stickers';
import type {
  ConversationAttributesType,
  CustomError,
  MessageAttributesType,
  MessageReactionType,
  EditHistoryType,
  QuotedMessageType,
} from '../../model-types.d';
import { assertDev, strictAssert } from '../../util/assert';
import { getTimestampFromLong } from '../../util/timestampLongUtils';
import { DurationInSeconds, SECOND } from '../../util/durations';
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
import { isGroup } from '../../util/whatTypeOfConversation';
import {
  convertBackupMessageAttachmentToAttachment,
  convertFilePointerToAttachment,
} from './util/filePointers';
import { filterAndClean } from '../../types/BodyRange';
import { APPLICATION_OCTET_STREAM, stringToMIMEType } from '../../types/MIME';
import { copyFromQuotedMessage } from '../../messages/copyQuote';

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
async function processMessagesBatch(
  ourAci: AciString,
  batch: ReadonlyArray<MessageAttributesType>
): Promise<void> {
  const ids = await Data.saveMessages(batch, {
    forceSave: true,
    ourAci,
  });
  strictAssert(ids.length === batch.length, 'Should get same number of ids');

  // TODO (DESKTOP-7402): consider re-saving after updating the pending state
  for (const [index, rawAttributes] of batch.entries()) {
    const attributes = {
      ...rawAttributes,
      id: ids[index],
    };

    window.MessageCache.__DEPRECATED$unregister(attributes.id);

    const { editHistory } = attributes;

    if (editHistory?.length) {
      drop(
        Data.saveEditedMessages(
          attributes,
          ourAci,
          editHistory.slice(0, -1).map(({ timestamp }) => ({
            conversationId: attributes.conversationId,
            messageId: attributes.id,

            // Main message will track this
            readStatus: ReadStatus.Read,
            sentAt: timestamp,
          }))
        )
      );
    }

    drop(queueAttachmentDownloads(attributes));
  }
}

function phoneToContactFormType(
  type: Backups.ContactAttachment.Phone.Type | null | undefined
): ContactFormType {
  const { Type } = Backups.ContactAttachment.Phone;
  switch (type) {
    case Type.HOME:
      return ContactFormType.HOME;
    case Type.MOBILE:
      return ContactFormType.MOBILE;
    case Type.WORK:
      return ContactFormType.WORK;
    case Type.CUSTOM:
      return ContactFormType.CUSTOM;
    case undefined:
    case null:
    case Type.UNKNOWN:
      return ContactFormType.HOME;
    default:
      throw missingCaseError(type);
  }
}

function emailToContactFormType(
  type: Backups.ContactAttachment.Email.Type | null | undefined
): ContactFormType {
  const { Type } = Backups.ContactAttachment.Email;
  switch (type) {
    case Type.HOME:
      return ContactFormType.HOME;
    case Type.MOBILE:
      return ContactFormType.MOBILE;
    case Type.WORK:
      return ContactFormType.WORK;
    case Type.CUSTOM:
      return ContactFormType.CUSTOM;
    case undefined:
    case null:
    case Type.UNKNOWN:
      return ContactFormType.HOME;
    default:
      throw missingCaseError(type);
  }
}

function addressToContactAddressType(
  type: Backups.ContactAttachment.PostalAddress.Type | null | undefined
): ContactAddressType {
  const { Type } = Backups.ContactAttachment.PostalAddress;
  switch (type) {
    case Type.HOME:
      return ContactAddressType.HOME;
    case Type.WORK:
      return ContactAddressType.WORK;
    case Type.CUSTOM:
      return ContactAddressType.CUSTOM;
    case undefined:
    case null:
    case Type.UNKNOWN:
      return ContactAddressType.HOME;
    default:
      throw missingCaseError(type);
  }
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
    processBatch: batch => {
      const ourAci = this.ourConversation?.serviceId;
      assertDev(isAciString(ourAci), 'Our conversation must have ACI');

      return processMessagesBatch(ourAci, batch);
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
      } else if (frame.stickerPack) {
        await this.fromStickerPack(frame.stickerPack);
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
    // add the conversation into memory without saving it to DB (that will happen in
    // batcher); if we didn't do this, when we register messages to MessageCache, it would
    // automatically create (and save to DB) a duplicate conversation which would have to
    // be later merged
    window.ConversationController.dangerouslyCreateAndAdd(attributes);
    this.conversationOpBatcher.add({ isUpdate: false, attributes });
  }

  private updateConversation(attributes: ConversationAttributesType): void {
    const existing = window.ConversationController.get(attributes.id);
    if (existing) {
      existing.set(attributes);
    }
    this.conversationOpBatcher.add({ isUpdate: true, attributes });
  }

  private saveMessage(attributes: MessageAttributesType): void {
    window.MessageCache.__DEPRECATED$register(
      attributes.id,
      attributes,
      'import.saveMessage'
    );
    this.saveMessageBatcher.add(attributes);
  }

  private async fromAccount({
    profileKey,
    username,
    usernameLink,
    givenName,
    familyName,
    avatarUrlPath,
    backupsSubscriberData,
    donationSubscriberData,
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
    if (donationSubscriberData != null) {
      const { subscriberId, currencyCode, manuallyCancelled } =
        donationSubscriberData;
      if (Bytes.isNotEmpty(subscriberId)) {
        await storage.put('subscriberId', subscriberId);
      }
      if (currencyCode != null) {
        await storage.put('subscriberCurrencyCode', currencyCode);
      }
      if (manuallyCancelled != null) {
        await storage.put(
          'donorSubscriptionManuallyCancelled',
          manuallyCancelled
        );
      }
    }
    if (backupsSubscriberData != null) {
      const { subscriberId, currencyCode, manuallyCancelled } =
        backupsSubscriberData;
      if (Bytes.isNotEmpty(subscriberId)) {
        await storage.put('backupsSubscriberId', subscriberId);
      }
      if (currencyCode != null) {
        await storage.put('backupsSubscriberCurrencyCode', currencyCode);
      }
      if (manuallyCancelled != null) {
        await storage.put(
          'backupsSubscriptionManuallyCancelled',
          manuallyCancelled
        );
      }
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
    if (accountSettings?.universalExpireTimer) {
      await storage.put(
        'universalExpireTimer',
        accountSettings.universalExpireTimer
      );
    }
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
      'hasSeenGroupStoryEducationSheet',
      accountSettings?.hasSeenGroupStoryEducationSheet === true
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

    let removalStage: 'justNotification' | 'messageRequest' | undefined;
    switch (contact.visibility) {
      case Backups.Contact.Visibility.HIDDEN:
        removalStage = 'justNotification';
        break;
      case Backups.Contact.Visibility.HIDDEN_MESSAGE_REQUEST:
        removalStage = 'messageRequest';
        break;
      case Backups.Contact.Visibility.VISIBLE:
      default:
        removalStage = undefined;
        break;
    }

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'private',
      version: 2,
      serviceId: aci ?? pni,
      pni,
      e164,
      removalStage,
      profileKey: contact.profileKey
        ? Bytes.toBase64(contact.profileKey)
        : undefined,
      profileSharing: contact.profileSharing === true,
      profileName: dropNull(contact.profileGivenName),
      profileFamilyName: dropNull(contact.profileFamilyName),
      hideStory: contact.hideStory === true,
      username: dropNull(contact.username),
    };

    if (contact.notRegistered) {
      const timestamp =
        contact.notRegistered.unregisteredTimestamp?.toNumber() ?? Date.now();
      attrs.discoveredUnregisteredAt = timestamp;
      attrs.firstUnregisteredAt = timestamp;
    } else {
      strictAssert(
        contact.registered,
        'contact is either registered or unregistered'
      );
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
    listItem: Backups.IDistributionListItem
  ): Promise<void> {
    strictAssert(
      Bytes.isNotEmpty(listItem.distributionId),
      'Missing distribution list id'
    );

    const id = bytesToUuid(listItem.distributionId);
    strictAssert(isStoryDistributionId(id), 'Invalid distribution list id');

    const commonFields = {
      id,

      // Default values
      senderKeyInfo: undefined,
      storageNeedsSync: false,
    };

    let result: StoryDistributionWithMembersType;
    if (listItem.deletionTimestamp == null) {
      const { distributionList: list } = listItem;
      strictAssert(
        list != null,
        'Distribution list is either present or deleted'
      );

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

      result = {
        ...commonFields,
        name: list.name ?? '',
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
      };
    } else {
      result = {
        ...commonFields,

        name: '',
        allowsReplies: false,
        isBlockList: false,
        members: [],

        deletedAtTimestamp: getTimestampFromLong(listItem.deletionTimestamp),
      };
    }

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

    conversation.expireTimer =
      chat.expirationTimerMs && !chat.expirationTimerMs.isZero()
        ? DurationInSeconds.fromMillis(chat.expirationTimerMs.toNumber())
        : undefined;
    conversation.muteExpiresAt =
      chat.muteUntilMs && !chat.muteUntilMs.isZero()
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

    const {
      patch: directionDetails,
      newActiveAt,
      unread,
    } = this.fromDirectionDetails(item, timestamp);

    if (newActiveAt != null) {
      chatConvo.active_at = newActiveAt;
    }
    if (unread != null) {
      chatConvo.unreadCount = (chatConvo.unreadCount ?? 0) + 1;
    }

    let attributes: MessageAttributesType = {
      id: generateUuid(),
      conversationId: chatConvo.id,
      received_at: incrementMessageCounter(),
      sent_at: timestamp,
      source: authorConvo?.e164,
      sourceServiceId: authorConvo?.serviceId,
      timestamp,
      type: item.outgoing != null ? 'outgoing' : 'incoming',
      expirationStartTimestamp:
        item.expireStartDate && !item.expireStartDate.isZero()
          ? getTimestampFromLong(item.expireStartDate)
          : undefined,
      expireTimer:
        item.expiresInMs && !item.expiresInMs.isZero()
          ? DurationInSeconds.fromMillis(item.expiresInMs.toNumber())
          : undefined,
      sms: item.sms === true ? true : undefined,
      ...directionDetails,
    };
    const additionalMessages: Array<MessageAttributesType> = [];

    if (item.incoming) {
      strictAssert(
        authorConvo && this.ourConversation.id !== authorConvo?.id,
        `${logId}: message with incoming field must be incoming`
      );
    } else if (item.outgoing) {
      strictAssert(
        authorConvo && this.ourConversation.id === authorConvo?.id,
        `${logId}: outgoing message must have outgoing field`
      );
    }

    if (item.standardMessage) {
      attributes = {
        ...attributes,
        ...(await this.fromStandardMessage(item.standardMessage, chatConvo.id)),
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

    if (item.revisions?.length) {
      strictAssert(
        item.standardMessage,
        'Only standard message can have revisions'
      );

      const history = await this.fromRevisions(attributes, item.revisions);
      attributes.editHistory = history;

      // Update timestamps on the parent message
      const oldest = history.at(-1);

      assertDev(oldest != null, 'History is non-empty');

      attributes.editMessageReceivedAt = attributes.received_at;
      attributes.editMessageReceivedAtMs = attributes.received_at_ms;
      attributes.editMessageTimestamp = attributes.timestamp;

      attributes.received_at = oldest.received_at;
      attributes.received_at_ms = oldest.received_at_ms;
      attributes.timestamp = oldest.timestamp;
      attributes.sent_at = oldest.timestamp;
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

  private fromDirectionDetails(
    item: Backups.IChatItem,
    timestamp: number
  ): {
    patch: Partial<MessageAttributesType>;
    newActiveAt?: number;
    unread?: boolean;
  } {
    const { outgoing, incoming, directionless } = item;
    if (outgoing) {
      const sendStateByConversationId: SendStateByConversationId = {};

      const BackupSendStatus = Backups.SendStatus.Status;

      const unidentifiedDeliveries = new Array<ServiceIdString>();
      const errors = new Array<CustomError>();
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

        if (target.serviceId) {
          if (status.sealedSender) {
            unidentifiedDeliveries.push(target.serviceId);
          }

          if (status.identityKeyMismatch) {
            errors.push({
              serviceId: target.serviceId,
              name: 'OutgoingIdentityKeyError',
              // See: ts/textsecure/Errors
              message: `The identity of ${target.serviceId} has changed.`,
            });
          } else if (status.networkFailure) {
            errors.push({
              serviceId: target.serviceId,
              name: 'OutgoingMessageError',
              // See: ts/textsecure/Errors
              message: 'no http error',
            });
          }
        }

        sendStateByConversationId[target.id] = {
          status: sendStatus,
          updatedAt:
            status.lastStatusUpdateTimestamp != null &&
            !status.lastStatusUpdateTimestamp.isZero()
              ? getTimestampFromLong(status.lastStatusUpdateTimestamp)
              : undefined,
        };
      }

      return {
        patch: {
          sendStateByConversationId,
          received_at_ms: timestamp,
          unidentifiedDeliveries: unidentifiedDeliveries.length
            ? unidentifiedDeliveries
            : undefined,
          errors: errors.length ? errors : undefined,
        },
        newActiveAt: timestamp,
      };
    }
    if (incoming) {
      const receivedAtMs = incoming.dateReceived?.toNumber() ?? Date.now();

      const unidentifiedDeliveryReceived = incoming.sealedSender === true;

      if (incoming.read) {
        return {
          patch: {
            readStatus: ReadStatus.Read,
            seenStatus: SeenStatus.Seen,
            received_at_ms: receivedAtMs,
            unidentifiedDeliveryReceived,
          },
          newActiveAt: receivedAtMs,
        };
      }

      return {
        patch: {
          readStatus: ReadStatus.Unread,
          seenStatus: SeenStatus.Unseen,
          received_at_ms: receivedAtMs,
          unidentifiedDeliveryReceived,
        },
        newActiveAt: receivedAtMs,
        unread: true,
      };
    }

    strictAssert(directionless, 'Absent direction state');
    return { patch: {} };
  }

  private async fromStandardMessage(
    data: Backups.IStandardMessage,
    conversationId: string
  ): Promise<Partial<MessageAttributesType>> {
    return {
      body: data.text?.body || undefined,
      attachments: data.attachments?.length
        ? data.attachments
            .map(convertBackupMessageAttachmentToAttachment)
            .filter(isNotNil)
        : undefined,
      preview: data.linkPreview?.length
        ? data.linkPreview.map(preview => {
            const { url } = preview;
            strictAssert(url, 'preview must have a URL');
            return {
              url,
              title: dropNull(preview.title),
              description: dropNull(preview.description),
              date: getTimestampFromLong(preview.date),
              image: preview.image
                ? convertFilePointerToAttachment(preview.image)
                : undefined,
            };
          })
        : undefined,
      reactions: this.fromReactions(data.reactions),
      quote: data.quote
        ? await this.fromQuote(data.quote, conversationId)
        : undefined,
    };
  }

  private async fromRevisions(
    mainMessage: MessageAttributesType,
    revisions: ReadonlyArray<Backups.IChatItem>
  ): Promise<Array<EditHistoryType>> {
    const result = await Promise.all(
      revisions
        .map(async rev => {
          strictAssert(
            rev.standardMessage,
            'Edit history has non-standard messages'
          );

          const timestamp = getTimestampFromLong(rev.dateSent);

          const {
            // eslint-disable-next-line camelcase
            patch: { sendStateByConversationId, received_at_ms },
          } = this.fromDirectionDetails(rev, timestamp);

          return {
            ...(await this.fromStandardMessage(
              rev.standardMessage,
              mainMessage.conversationId
            )),
            timestamp,
            received_at: incrementMessageCounter(),
            sendStateByConversationId,
            // eslint-disable-next-line camelcase
            received_at_ms,
          };
        })
        // Fix order: from newest to oldest
        .reverse()
    );

    // See `ts/util/handleEditMessage.ts`, the first history entry is always
    // the current message.
    result.unshift({
      attachments: mainMessage.attachments,
      body: mainMessage.body,
      bodyAttachment: mainMessage.bodyAttachment,
      bodyRanges: mainMessage.bodyRanges,
      preview: mainMessage.preview,
      quote: mainMessage.quote,
      sendStateByConversationId: mainMessage.sendStateByConversationId
        ? { ...mainMessage.sendStateByConversationId }
        : undefined,
      timestamp: mainMessage.timestamp,
      received_at: mainMessage.received_at,
      received_at_ms: mainMessage.received_at_ms,
    });

    return result;
  }

  private convertQuoteType(
    type: Backups.Quote.Type | null | undefined
  ): SignalService.DataMessage.Quote.Type {
    switch (type) {
      case Backups.Quote.Type.GIFTBADGE:
        return SignalService.DataMessage.Quote.Type.GIFT_BADGE;
      case Backups.Quote.Type.NORMAL:
      case Backups.Quote.Type.UNKNOWN:
      case null:
      case undefined:
        return SignalService.DataMessage.Quote.Type.NORMAL;
      default:
        throw missingCaseError(type);
    }
  }

  private async fromQuote(
    quote: Backups.IQuote,
    conversationId: string
  ): Promise<QuotedMessageType> {
    strictAssert(quote.authorId != null, 'quote must have an authorId');

    const authorConvo = this.recipientIdToConvo.get(quote.authorId.toNumber());
    strictAssert(authorConvo !== undefined, 'author conversation not found');
    strictAssert(
      isAciString(authorConvo.serviceId),
      'must have ACI for authorId in quote'
    );

    return copyFromQuotedMessage(
      {
        id: getTimestampFromLong(quote.targetSentTimestamp),
        authorAci: authorConvo.serviceId,
        text: dropNull(quote.text),
        bodyRanges: quote.bodyRanges?.length
          ? filterAndClean(
              quote.bodyRanges.map(range => ({
                ...range,
                mentionAci: range.mentionAci
                  ? Aci.parseFromServiceIdBinary(
                      Buffer.from(range.mentionAci)
                    ).getServiceIdString()
                  : undefined,
              }))
            )
          : undefined,
        attachments:
          quote.attachments?.map(quotedAttachment => {
            const { fileName, contentType, thumbnail } = quotedAttachment;
            return {
              fileName: dropNull(fileName),
              contentType: contentType
                ? stringToMIMEType(contentType)
                : APPLICATION_OCTET_STREAM,
              thumbnail: thumbnail?.pointer
                ? convertFilePointerToAttachment(thumbnail.pointer)
                : undefined,
            };
          }) ?? [],
        type: this.convertQuoteType(quote.type),
      },
      conversationId
    );
  }

  private fromReactions(
    reactions: ReadonlyArray<Backups.IReaction> | null | undefined
  ): Array<MessageReactionType> | undefined {
    if (!reactions?.length) {
      return undefined;
    }
    return reactions
      .slice()
      .sort((a, b) => {
        if (a.sortOrder && b.sortOrder) {
          return a.sortOrder.comp(b.sortOrder);
        }
        return 0;
      })
      .map(({ emoji, authorId, sentTimestamp, receivedTimestamp }) => {
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
      });
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
      return {
        message: {
          contact: (chatItem.contactMessage.contact ?? []).map(details => {
            const { avatar, name, number, email, address, organization } =
              details;

            return {
              name: name
                ? {
                    givenName: dropNull(name.givenName),
                    familyName: dropNull(name.familyName),
                    prefix: dropNull(name.prefix),
                    suffix: dropNull(name.suffix),
                    middleName: dropNull(name.middleName),
                    displayName: dropNull(name.displayName),
                  }
                : undefined,
              number: number?.length
                ? number
                    .map(({ value, type, label }) => {
                      if (!value) {
                        return undefined;
                      }

                      return {
                        value,
                        type: phoneToContactFormType(type),
                        label: dropNull(label),
                      };
                    })
                    .filter(isNotNil)
                : undefined,
              email: email?.length
                ? email
                    .map(({ value, type, label }) => {
                      if (!value) {
                        return undefined;
                      }

                      return {
                        value,
                        type: emailToContactFormType(type),
                        label: dropNull(label),
                      };
                    })
                    .filter(isNotNil)
                : undefined,
              address: address?.length
                ? address.map(addr => {
                    const {
                      type,
                      label,
                      street,
                      pobox,
                      neighborhood,
                      city,
                      region,
                      postcode,
                      country,
                    } = addr;

                    return {
                      type: addressToContactAddressType(type),
                      label: dropNull(label),
                      street: dropNull(street),
                      pobox: dropNull(pobox),
                      neighborhood: dropNull(neighborhood),
                      city: dropNull(city),
                      region: dropNull(region),
                      postcode: dropNull(postcode),
                      country: dropNull(country),
                    };
                  })
                : undefined,
              organization: dropNull(organization),
              avatar: avatar
                ? {
                    avatar: convertFilePointerToAttachment(avatar),
                    isProfile: false,
                  }
                : undefined,
            };
          }),
          reactions: this.fromReactions(chatItem.contactMessage.reactions),
        },
        additionalMessages: [],
      };
    }
    if (chatItem.remoteDeletedMessage) {
      return {
        message: {
          isErased: true,
        },
        additionalMessages: [],
      };
    }
    if (chatItem.stickerMessage) {
      strictAssert(
        chatItem.stickerMessage.sticker != null,
        'stickerMessage must have a sticker'
      );
      const {
        stickerMessage: {
          sticker: { emoji, packId, packKey, stickerId, data },
        },
      } = chatItem;
      strictAssert(emoji != null, 'stickerMessage must have an emoji');
      strictAssert(
        packId?.length === STICKERPACK_ID_BYTE_LEN,
        'stickerMessage must have a valid pack id'
      );
      strictAssert(
        packKey?.length === STICKERPACK_KEY_BYTE_LEN,
        'stickerMessage must have a valid pack key'
      );
      strictAssert(stickerId != null, 'stickerMessage must have a sticker id');

      return {
        message: {
          sticker: {
            emoji,
            packId: Bytes.toHex(packId),
            packKey: Bytes.toBase64(packKey),
            stickerId,
            data: data ? convertFilePointerToAttachment(data) : undefined,
          },
          reactions: this.fromReactions(chatItem.stickerMessage.reactions),
        },
        additionalMessages: [],
      };
    }
    if (chatItem.paymentNotification) {
      const { paymentNotification: notification } = chatItem;
      return {
        message: {
          payment: {
            kind: PaymentEventKind.Notification,
            amountMob: dropNull(notification.amountMob),
            feeMob: dropNull(notification.feeMob),
            note: notification.note ?? null,
            transactionDetailsBase64: notification.transactionDetails
              ? Bytes.toBase64(
                  Backups.PaymentNotification.TransactionDetails.encode(
                    notification.transactionDetails
                  ).finish()
                )
              : undefined,
          },
        },
        additionalMessages: [],
      };
    }
    if (chatItem.giftBadge) {
      const { giftBadge } = chatItem;
      strictAssert(
        Bytes.isNotEmpty(giftBadge.receiptCredentialPresentation),
        'Gift badge must have a presentation'
      );

      let state: GiftBadgeStates;
      switch (giftBadge.state) {
        case Backups.GiftBadge.State.OPENED:
          state = GiftBadgeStates.Opened;
          break;

        case Backups.GiftBadge.State.FAILED:
        case Backups.GiftBadge.State.REDEEMED:
          state = GiftBadgeStates.Redeemed;
          break;

        case Backups.GiftBadge.State.UNOPENED:
          state = GiftBadgeStates.Unopened;
          break;

        default:
          state = GiftBadgeStates.Unopened;
          break;
      }

      const receipt = new ReceiptCredentialPresentation(
        Buffer.from(giftBadge.receiptCredentialPresentation)
      );

      return {
        message: {
          giftBadge: {
            receiptCredentialPresentation: Bytes.toBase64(
              giftBadge.receiptCredentialPresentation
            ),
            expiration: Number(receipt.getReceiptExpirationTime()) * SECOND,
            id: undefined,
            level: Number(receipt.getReceiptLevel()),
            state,
          },
        },
        additionalMessages: [],
      };
    }
    if (chatItem.updateMessage) {
      return this.fromChatItemUpdateMessage(chatItem.updateMessage, options);
    }

    throw new Error(`${logId}: Message was missing all five message types`);
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
      const expireTimer =
        isNumber(expiresInMs) && expiresInMs
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

    if (updateMessage.simpleUpdate) {
      const message = await this.fromSimpleUpdateMessage(
        updateMessage.simpleUpdate,
        options
      );
      if (!message) {
        return undefined;
      }

      return {
        message,
        additionalMessages: [],
      };
    }

    if (updateMessage.profileChange) {
      const { newName, previousName: oldName } = updateMessage.profileChange;
      strictAssert(newName != null, 'profileChange must have a new name');
      strictAssert(oldName != null, 'profileChange must have an old name');
      return {
        message: {
          type: 'profile-change',
          changedId: author?.id,
          profileChange: {
            type: 'name',
            oldName,
            newName,
          },
        },
        additionalMessages: [],
      };
    }

    if (updateMessage.learnedProfileChange) {
      const { e164, username } = updateMessage.learnedProfileChange;
      strictAssert(
        e164 != null || username != null,
        'learnedProfileChange must have an old name'
      );
      return {
        message: {
          type: 'title-transition-notification',
          titleTransition: {
            renderInfo: {
              type: 'private',
              e164: e164 && !e164.isZero() ? `+${e164}` : undefined,
              username: dropNull(username),
            },
          },
        },
        additionalMessages: [],
      };
    }

    if (updateMessage.threadMerge) {
      const { previousE164 } = updateMessage.threadMerge;
      strictAssert(previousE164 != null, 'threadMerge must have an old e164');
      return {
        message: {
          type: 'conversation-merge',
          conversationMerge: {
            renderInfo: {
              type: 'private',
              e164: `+${previousE164}`,
            },
          },
        },
        additionalMessages: [],
      };
    }

    if (updateMessage.sessionSwitchover) {
      const { e164 } = updateMessage.sessionSwitchover;
      strictAssert(e164 != null, 'sessionSwitchover must have an old e164');
      return {
        message: {
          type: 'phone-number-discovery',
          phoneNumberDiscovery: {
            e164: `+${e164}`,
          },
        },
        additionalMessages: [],
      };
    }

    // TODO (DESKTOP-6964): check these fields
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
        const expireTimer =
          isNumber(expiresInMs) && expiresInMs
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

  private async fromSimpleUpdateMessage(
    simpleUpdate: Backups.ISimpleChatUpdate,
    {
      author,
      conversation,
    }: {
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
    }
  ): Promise<Partial<MessageAttributesType> | undefined> {
    const { Type } = Backups.SimpleChatUpdate;
    switch (simpleUpdate.type) {
      case Type.END_SESSION:
        return {
          flags: SignalService.DataMessage.Flags.END_SESSION,
        };
      case Type.CHAT_SESSION_REFRESH:
        return {
          type: 'chat-session-refreshed',
        };
      case Type.IDENTITY_UPDATE:
        return {
          type: 'keychange',
          key_changed: isGroup(conversation) ? author?.id : undefined,
        };
      case Type.IDENTITY_VERIFIED:
        strictAssert(author != null, 'IDENTITY_VERIFIED must have an author');
        return {
          type: 'verified-change',
          verifiedChanged: author.id,
          verified: true,
        };
      case Type.IDENTITY_DEFAULT:
        strictAssert(author != null, 'IDENTITY_UNVERIFIED must have an author');
        return {
          type: 'verified-change',
          verifiedChanged: author.id,
          verified: false,
        };
      case Type.CHANGE_NUMBER:
        return {
          type: 'change-number-notification',
        };
      case Type.JOINED_SIGNAL:
        return {
          type: 'joined-signal-notification',
        };
      case Type.BAD_DECRYPT:
        return {
          type: 'delivery-issue',
        };
      case Type.BOOST_REQUEST:
        log.warn('backups: dropping boost request from release notes');
        return undefined;
      case Type.PAYMENTS_ACTIVATED:
        return {
          payment: {
            kind: PaymentEventKind.Activation,
          },
        };
      case Type.PAYMENT_ACTIVATION_REQUEST:
        return {
          payment: {
            kind: PaymentEventKind.ActivationRequest,
          },
        };
      case Type.UNSUPPORTED_PROTOCOL_MESSAGE:
        return {
          supportedVersionAtReceive:
            SignalService.DataMessage.ProtocolVersion.CURRENT - 2,
          requiredProtocolVersion:
            SignalService.DataMessage.ProtocolVersion.CURRENT - 1,
        };
      default:
        throw new Error('Not implemented');
    }
  }

  private async fromStickerPack({
    packId: id,
    packKey: key,
  }: Backups.IStickerPack): Promise<void> {
    strictAssert(
      id?.length === STICKERPACK_ID_BYTE_LEN,
      'Sticker pack must have a valid pack id'
    );

    const logId = `fromStickerPack(${Bytes.toHex(id).slice(-2)})`;
    strictAssert(
      key?.length === STICKERPACK_KEY_BYTE_LEN,
      `${logId}: must have a valid pack key`
    );

    drop(
      downloadStickerPack(Bytes.toHex(id), Bytes.toBase64(key), {
        fromBackup: true,
      })
    );
  }
}
