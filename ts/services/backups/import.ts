// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import { ReceiptCredentialPresentation } from '@signalapp/libsignal-client/zkgroup';
import { v7 as generateUuid } from 'uuid';
import pMap from 'p-map';
import { Writable } from 'stream';
import { isNumber } from 'lodash';
import { CallLinkRootKey } from '@signalapp/ringrtc';
import type Long from 'long';

import { Backups, SignalService } from '../../protobuf';
import { DataReader, DataWriter } from '../../sql/Client';
import {
  AttachmentDownloadSource,
  type StoryDistributionWithMembersType,
  type IdentityKeyType,
} from '../../sql/Interface';
import * as log from '../../logging/log';
import { GiftBadgeStates } from '../../components/conversation/Message';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import * as LinkPreview from '../../types/LinkPreview';
import {
  fromAciObject,
  fromPniObject,
  fromServiceIdObject,
} from '../../types/ServiceId';
import { isStoryDistributionId } from '../../types/StoryDistributionId';
import * as Errors from '../../types/errors';
import { PaymentEventKind } from '../../types/Payment';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent';
import {
  ContactFormType,
  AddressType as ContactAddressType,
} from '../../types/EmbeddedContact';
import {
  STICKERPACK_ID_BYTE_LEN,
  STICKERPACK_KEY_BYTE_LEN,
  createPacksFromBackup,
  type StickerPackPointerType,
} from '../../types/Stickers';
import type {
  ConversationColorType,
  CustomColorsItemType,
  CustomColorType,
  CustomColorDataType,
} from '../../types/Colors';
import type {
  ConversationAttributesType,
  CustomError,
  MessageAttributesType,
  MessageReactionType,
  EditHistoryType,
  QuotedMessageType,
} from '../../model-types.d';
import { assertDev, strictAssert } from '../../util/assert';
import {
  getCheckedTimestampFromLong,
  getCheckedTimestampOrUndefinedFromLong,
  getTimestampOrUndefinedFromLong,
} from '../../util/timestampLongUtils';
import { MAX_SAFE_DATE } from '../../util/timestamp';
import { DurationInSeconds, SECOND } from '../../util/durations';
import { calculateExpirationTimestamp } from '../../util/expirationTimer';
import { dropNull } from '../../util/dropNull';
import {
  deriveGroupID,
  deriveGroupSecretParams,
  deriveGroupPublicParams,
} from '../../util/zkgroup';
import { incrementMessageCounter } from '../../util/incrementMessageCounter';
import { generateMessageId } from '../../util/generateMessageId';
import { isAciString } from '../../util/isAciString';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability';
import { PhoneNumberSharingMode } from '../../util/phoneNumberSharingMode';
import { bytesToUuid } from '../../util/uuidToBytes';
import { missingCaseError } from '../../util/missingCaseError';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SendStatus } from '../../messages/MessageSendState';
import type { SendStateByConversationId } from '../../messages/MessageSendState';
import { SeenStatus } from '../../MessageSeenStatus';
import { constantTimeEqual } from '../../Crypto';
import * as Bytes from '../../Bytes';
import { BACKUP_VERSION, WALLPAPER_TO_BUBBLE_COLOR } from './constants';
import { UnsupportedBackupVersion } from './errors';
import type { AboutMe, LocalChatStyle } from './types';
import { BackupType } from './types';
import { getBackupMediaRootKey } from './crypto';
import type { GroupV2ChangeDetailType } from '../../groups';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads';
import { isNotNil } from '../../util/isNotNil';
import { isGroup } from '../../util/whatTypeOfConversation';
import { rgbIntToHSL } from '../../util/rgbToHSL';
import {
  convertBackupMessageAttachmentToAttachment,
  convertFilePointerToAttachment,
} from './util/filePointers';
import { filterAndClean, trimMessageWhitespace } from '../../types/BodyRange';
import { APPLICATION_OCTET_STREAM, stringToMIMEType } from '../../types/MIME';
import { groupAvatarJobQueue } from '../../jobs/groupAvatarJobQueue';
import { AttachmentDownloadManager } from '../../jobs/AttachmentDownloadManager';
import {
  AdhocCallStatus,
  CallDirection,
  CallMode,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../types/CallDisposition';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import { CallLinkRestrictions, isCallLinkAdmin } from '../../types/CallLink';
import type { CallLinkType } from '../../types/CallLink';
import type { RawBodyRange } from '../../types/BodyRange';
import {
  fromAdminKeyBytes,
  toCallHistoryFromUnusedCallLink,
} from '../../util/callLinks';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc';
import { loadAllAndReinitializeRedux } from '../allLoaders';
import {
  resetBackupMediaDownloadProgress,
  startBackupMediaDownload,
} from '../../util/backupMediaDownload';
import { getEnvironment, isTestEnvironment } from '../../environment';
import { hasAttachmentDownloads } from '../../util/hasAttachmentDownloads';
import { isAdhoc, isNightly } from '../../util/version';
import { ToastType } from '../../types/Toast';
import { isConversationAccepted } from '../../util/isConversationAccepted';
import { saveBackupsSubscriberData } from '../../util/backupSubscriptionData';
import { postSaveUpdates } from '../../util/cleanup';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { MessageModel } from '../../models/messages';

const MAX_CONCURRENCY = 10;

const SAVE_MESSAGE_BATCH_SIZE = 10000;

type ChatItemParseResult = {
  message: Partial<MessageAttributesType>;
  additionalMessages: Array<Partial<MessageAttributesType>>;
};

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
  #now = Date.now();
  #parsedBackupInfo = false;
  #logId = 'BackupImportStream(unknown)';
  #aboutMe: AboutMe | undefined;

  readonly #recipientIdToConvo = new Map<number, ConversationAttributesType>();

  readonly #recipientIdToCallLink = new Map<number, CallLinkType>();
  readonly #adminCallLinksToHasCall = new Map<CallLinkType, boolean>();

  readonly #chatIdToConvo = new Map<number, ConversationAttributesType>();

  readonly #conversations = new Map<string, ConversationAttributesType>();

  readonly #identityKeys = new Map<ServiceIdString, IdentityKeyType>();

  readonly #saveMessageBatch = new Map<
    MessageAttributesType,
    Promise<MessageAttributesType>
  >();

  #flushMessagesPromise: Promise<void> | undefined;
  readonly #stickerPacks = new Array<StickerPackPointerType>();
  #ourConversation?: ConversationAttributesType;
  #pinnedConversations = new Array<[number, string]>();
  #customColorById = new Map<number, CustomColorDataType>();
  #releaseNotesRecipientId: Long | undefined;
  #releaseNotesChatId: Long | undefined;
  #pendingGroupAvatars = new Map<string, string>();
  #frameErrorCount: number = 0;

  private constructor(private readonly backupType: BackupType) {
    super({ objectMode: true });
  }

  public static async create(
    backupType = BackupType.Ciphertext
  ): Promise<BackupImportStream> {
    await AttachmentDownloadManager.stop();
    await DataWriter.removeAllBackupAttachmentDownloadJobs();
    await resetBackupMediaDownloadProgress();

    return new BackupImportStream(backupType);
  }

  override async _write(
    data: Buffer,
    _enc: BufferEncoding,
    done: (error?: Error) => void
  ): Promise<void> {
    try {
      if (!this.#parsedBackupInfo) {
        const info = Backups.BackupInfo.decode(data);
        this.#parsedBackupInfo = true;

        this.#logId = `BackupImport.run(${info.backupTimeMs})`;

        log.info(`${this.#logId}: got BackupInfo`);

        if (info.version?.toNumber() !== BACKUP_VERSION) {
          throw new UnsupportedBackupVersion(info.version);
        }

        if (Bytes.isEmpty(info.mediaRootBackupKey)) {
          throw new Error('Missing mediaRootBackupKey');
        }

        await window.storage.put(
          'restoredBackupFirstAppVersion',
          info.firstAppVersion
        );

        const theirKey = info.mediaRootBackupKey;
        const ourKey = getBackupMediaRootKey().serialize();
        if (!constantTimeEqual(theirKey, ourKey)) {
          // Use root key from integration test
          if (isTestEnvironment(getEnvironment())) {
            await window.storage.put(
              'backupMediaRootKey',
              info.mediaRootBackupKey
            );
          } else {
            throw new Error('Incorrect mediaRootBackupKey');
          }
        }
      } else {
        const frame = Backups.Frame.decode(data);

        await this.#processFrame(frame, { aboutMe: this.#aboutMe });

        if (!this.#aboutMe && this.#ourConversation) {
          const { serviceId, pni, e164 } = this.#ourConversation;
          strictAssert(
            isAciString(serviceId),
            'ourConversation serviceId must be ACI'
          );
          this.#aboutMe = {
            aci: serviceId,
            pni,
            e164,
          };
        }
      }
      done();
    } catch (error) {
      const entryType = this.#parsedBackupInfo ? 'frame' : 'info';
      log.error(`${this.#logId}: failed to process ${entryType}`);
      done(error);
    }
  }

  override async _final(done: (error?: Error) => void): Promise<void> {
    try {
      // Finish saving remaining conversations/messages
      // Save messages first since they depend on conversations in memory
      while (this.#flushMessagesPromise) {
        // eslint-disable-next-line no-await-in-loop
        await this.#flushMessagesPromise;
      }
      await this.#flushMessages();
      await this.#flushConversations();
      log.info(`${this.#logId}: flushed messages and conversations`);

      // Store sticker packs and schedule downloads
      await createPacksFromBackup(this.#stickerPacks);

      // Add placeholder call history for unused admin call links to show in calls tab
      for (const [callLink, hasCall] of this.#adminCallLinksToHasCall) {
        if (!hasCall) {
          const callHistory = toCallHistoryFromUnusedCallLink(callLink);
          // eslint-disable-next-line no-await-in-loop
          await this.#saveCallHistory(callHistory);
        }
      }

      // Reset and reload conversations and storage again
      window.ConversationController.setReadOnly(false);
      window.ConversationController.reset();

      await window.ConversationController.load();
      await window.ConversationController.checkForConflicts();

      window.storage.reset();
      await window.storage.fetch();

      // Load identity keys we just saved.
      await window.storage.protocol.hydrateCaches();

      // Load all data into redux (need to do this before updating a
      // conversation's last message, which uses redux selectors)
      await loadAllAndReinitializeRedux();

      const allConversations = window.ConversationController.getAll();

      // Update last message in every active conversation now that we have
      // them loaded into memory.
      await pMap(
        allConversations.filter(convo => {
          return convo.get('active_at') || convo.get('isPinned');
        }),
        async convo => {
          try {
            await convo.updateLastMessage();
          } catch (error) {
            log.error(
              `${this.#logId}: failed to update conversation's last message` +
                `${Errors.toLogFormat(error)}`
            );
          }
        },
        { concurrency: MAX_CONCURRENCY }
      );

      // Schedule group avatar download.
      await pMap(
        [...this.#pendingGroupAvatars.entries()],
        async ([conversationId, newAvatarUrl]) => {
          if (this.backupType === BackupType.TestOnlyPlaintext) {
            return;
          }
          await groupAvatarJobQueue.add({ conversationId, newAvatarUrl });
        },
        { concurrency: MAX_CONCURRENCY }
      );

      await window.storage.put(
        'pinnedConversationIds',
        this.#pinnedConversations
          .sort(([a], [b]) => {
            return a - b;
          })
          .map(([, id]) => id)
      );

      await window.storage.put(
        'backupMediaDownloadTotalBytes',
        await DataReader.getSizeOfPendingBackupAttachmentDownloadJobs()
      );

      if (
        this.backupType !== BackupType.TestOnlyPlaintext &&
        !isTestEnvironment(getEnvironment())
      ) {
        await startBackupMediaDownload();
      }

      if (this.#frameErrorCount > 0) {
        log.error(
          `${this.#logId}: errored while processing ${this.#frameErrorCount} frames.`
        );
        if (isNightly(window.getVersion()) || isAdhoc(window.getVersion())) {
          window.reduxActions.toast.showToast({
            toastType: ToastType.FailedToImportBackup,
          });
        }
      } else {
        log.info(`${this.#logId}: successfully processed all frames.`);
      }

      done();
    } catch (error) {
      done(error);
    }
  }

  async #processFrame(
    frame: Backups.Frame,
    options: { aboutMe?: AboutMe }
  ): Promise<void> {
    const { aboutMe } = options;

    if (frame.account) {
      await this.#fromAccount(frame.account);

      // We run this outside of try catch below because failure to restore
      // the account data is fatal.
      return;
    }

    try {
      if (frame.recipient) {
        const { recipient } = frame;
        strictAssert(recipient.id != null, 'Recipient must have an id');
        const recipientId = recipient.id.toNumber();

        let convo: ConversationAttributesType;
        if (recipient.contact) {
          convo = await this.#fromContact(recipient.contact);
        } else if (recipient.releaseNotes) {
          strictAssert(
            this.#releaseNotesRecipientId == null,
            'Duplicate release notes recipient'
          );
          this.#releaseNotesRecipientId = recipient.id;

          // Not yet supported
          return;
        } else if (recipient.self) {
          strictAssert(this.#ourConversation != null, 'Missing account data');
          convo = this.#ourConversation;
        } else if (recipient.group) {
          convo = await this.#fromGroup(recipient.group);
        } else if (recipient.distributionList) {
          await this.#fromDistributionList(recipient.distributionList);

          // Not a conversation
          return;
        } else if (recipient.callLink) {
          await this.#fromCallLink(recipientId, recipient.callLink);

          // Not a conversation
          return;
        } else {
          log.warn(`${this.#logId}: unsupported recipient destination`);
          throw new Error('Unsupported recipient destination');
        }

        if (convo !== this.#ourConversation) {
          await this.#saveConversation(convo);
        }

        this.#recipientIdToConvo.set(recipientId, convo);
      } else if (frame.chat) {
        await this.#fromChat(frame.chat);
      } else if (frame.chatItem) {
        if (!aboutMe) {
          throw new Error(
            'processFrame: Processing a chatItem frame, but no aboutMe data!'
          );
        }

        await this.#fromChatItem(frame.chatItem, { aboutMe });
      } else if (frame.stickerPack) {
        await this.#fromStickerPack(frame.stickerPack);
      } else if (frame.adHocCall) {
        await this.#fromAdHocCall(frame.adHocCall);
      } else if (frame.notificationProfile) {
        log.warn(
          `${this.#logId}: Received currently unsupported feature: notification profile. Dropping.`
        );
      } else if (frame.chatFolder) {
        log.warn(
          `${this.#logId}: Received currently unsupported feature: chat folder. Dropping.`
        );
      } else {
        log.warn(
          `${this.#logId}: unknown unsupported frame item ${frame.item}`
        );
        throw new Error('Unknown unsupported frame type');
      }
    } catch (error) {
      this.#frameErrorCount += 1;
      log.error(
        `${this.#logId}: failed to process a frame ${frame.item}, ` +
          `${Errors.toLogFormat(error)}`
      );
    }
  }

  async #saveConversation(
    attributes: ConversationAttributesType
  ): Promise<void> {
    this.#conversations.set(attributes.id, attributes);
  }

  async #updateConversation(
    attributes: ConversationAttributesType
  ): Promise<void> {
    this.#conversations.set(attributes.id, attributes);
  }

  async #saveMessage(attributes: MessageAttributesType): Promise<void> {
    this.#saveMessageBatch.set(
      attributes,
      this.#safeUpgradeMessage(attributes)
    );
    if (this.#saveMessageBatch.size >= SAVE_MESSAGE_BATCH_SIZE) {
      // Wait for previous flush to finish before scheduling a new one.
      // (Unlikely to happen, but needed to make sure we don't save too many
      // messages at once)
      while (this.#flushMessagesPromise) {
        // eslint-disable-next-line no-await-in-loop
        await this.#flushMessagesPromise;
      }
      this.#flushMessagesPromise = this.#flushMessages();
    }
  }

  async #safeUpgradeMessage(
    attributes: MessageAttributesType
  ): Promise<MessageAttributesType> {
    try {
      return await window.Signal.Migrations.upgradeMessageSchema(attributes);
    } catch (error) {
      log.error(
        `${this.#logId}: failed to migrate a message ${attributes.sent_at}, ` +
          `${Errors.toLogFormat(error)}`
      );
      return attributes;
    }
  }

  async #flushConversations(): Promise<void> {
    const updates = new Array<ConversationAttributesType>();

    if (this.#ourConversation) {
      const us = this.#conversations.get(this.#ourConversation.id);
      if (us) {
        updates.push(us);
        this.#conversations.delete(us.id);
      }
    }

    const saves = Array.from(this.#conversations.values());
    this.#conversations.clear();

    const identityKeys = Array.from(this.#identityKeys.values());
    this.#identityKeys.clear();

    // Queue writes at the same time to prevent races.
    await Promise.all([
      DataWriter.saveConversations(saves),
      DataWriter.updateConversations(updates),
      DataWriter.bulkAddIdentityKeys(identityKeys),
    ]);
  }

  async #flushMessages(): Promise<void> {
    const ourAci = this.#ourConversation?.serviceId;
    strictAssert(isAciString(ourAci), 'Must have our aci for messages');

    const batchPromises = Array.from(this.#saveMessageBatch.values());
    this.#saveMessageBatch.clear();

    const batch = await Promise.all(batchPromises);

    // There are a few indexes that start with message id, and many more that
    // start with conversationId. Sort messages by both to make sure that we
    // are not doing random insertions into the database file.
    // This improves bulk insert performance >2x.
    batch.sort((a, b) => {
      if (a.conversationId > b.conversationId) {
        return -1;
      }
      if (a.conversationId < b.conversationId) {
        return 1;
      }
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }
      return 0;
    });

    await DataWriter.saveMessages(batch, {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    const attachmentDownloadJobPromises: Array<Promise<unknown>> = [];

    // TODO (DESKTOP-7402): consider re-saving after updating the pending state
    for (const attributes of batch) {
      const { editHistory } = attributes;

      if (editHistory?.length) {
        // eslint-disable-next-line no-await-in-loop
        await DataWriter.saveEditedMessages(
          attributes,
          ourAci,
          editHistory.slice(0, -1).map(({ timestamp }) => ({
            conversationId: attributes.conversationId,
            messageId: attributes.id,

            // Main message will track this
            readStatus: ReadStatus.Read,
            sentAt: timestamp,
          }))
        );
      }

      if (hasAttachmentDownloads(attributes)) {
        const conversation = this.#conversations.get(attributes.conversationId);
        if (conversation && isConversationAccepted(conversation)) {
          const model = new MessageModel(attributes);
          attachmentDownloadJobPromises.push(
            queueAttachmentDownloads(model, {
              source: AttachmentDownloadSource.BACKUP_IMPORT,
            })
          );
        }
      }
    }
    await Promise.allSettled(attachmentDownloadJobPromises);
    await AttachmentDownloadManager.saveBatchedJobs();

    this.#flushMessagesPromise = undefined;
  }

  async #saveCallHistory(callHistory: CallHistoryDetails): Promise<void> {
    await DataWriter.saveCallHistory(callHistory);
  }

  async #fromAccount({
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
    strictAssert(this.#ourConversation === undefined, 'Duplicate AccountData');
    const me =
      window.ConversationController.getOurConversationOrThrow().attributes;
    this.#ourConversation = me;

    const { storage } = window;

    strictAssert(Bytes.isNotEmpty(profileKey), 'Missing profile key');
    await storage.put('profileKey', profileKey);
    this.#ourConversation.profileKey = Bytes.toBase64(profileKey);
    await this.#updateConversation(this.#ourConversation);

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

    await saveBackupsSubscriberData(backupsSubscriberData);

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
    if (accountSettings?.universalExpireTimerSeconds) {
      await storage.put(
        'universalExpireTimer',
        accountSettings.universalExpireTimerSeconds
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

    // an undefined value for storyViewReceiptsEnabled is semantically different from
    // false: it causes us to fallback to `read-receipt-setting`
    await storage.put(
      'storyViewReceiptsEnabled',
      accountSettings?.storyViewReceiptsEnabled ?? undefined
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

    // It is important to import custom chat colors before default styles
    // because we build the uuid => integer id map for the colors.
    await this.#fromCustomChatColors(accountSettings?.customChatColors);

    const defaultChatStyle = this.#fromChatStyle(
      accountSettings?.defaultChatStyle
    );

    if (defaultChatStyle.color != null) {
      await window.storage.put('defaultConversationColor', {
        color: defaultChatStyle.color,
        customColorData: defaultChatStyle.customColorData,
      });
    }

    if (defaultChatStyle.wallpaperPhotoPointer != null) {
      await window.storage.put(
        'defaultWallpaperPhotoPointer',
        defaultChatStyle.wallpaperPhotoPointer
      );
    }
    if (defaultChatStyle.wallpaperPreset != null) {
      await window.storage.put(
        'defaultWallpaperPreset',
        defaultChatStyle.wallpaperPreset
      );
    }
    if (defaultChatStyle.dimWallpaperInDarkMode != null) {
      await window.storage.put(
        'defaultDimWallpaperInDarkMode',
        defaultChatStyle.dimWallpaperInDarkMode
      );
    }
    if (defaultChatStyle.autoBubbleColor != null) {
      await window.storage.put(
        'defaultAutoBubbleColor',
        defaultChatStyle.autoBubbleColor
      );
    }

    await this.#updateConversation(me);
  }

  async #fromContact(
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

    const serviceId = aci ?? pni;

    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'private',
      version: 2,
      serviceId,
      pni,
      e164,
      removalStage,
      profileKey: contact.profileKey
        ? Bytes.toBase64(contact.profileKey)
        : undefined,
      profileSharing: contact.profileSharing === true,
      profileName: dropNull(contact.profileGivenName),
      profileFamilyName: dropNull(contact.profileFamilyName),
      systemGivenName: dropNull(contact.systemGivenName),
      systemFamilyName: dropNull(contact.systemFamilyName),
      systemNickname: dropNull(contact.systemNickname),
      hideStory: contact.hideStory === true,
      username: dropNull(contact.username),
      expireTimerVersion: 1,
      nicknameGivenName: dropNull(contact.nickname?.given),
      nicknameFamilyName: dropNull(contact.nickname?.family),
      note: dropNull(contact.note),
    };

    if (serviceId != null && Bytes.isNotEmpty(contact.identityKey)) {
      const verified = contact.identityState || 0;
      this.#identityKeys.set(serviceId, {
        id: serviceId,
        publicKey: contact.identityKey,
        verified,
        firstUse: true,
        timestamp: this.#now,
        nonblockingApproval: true,
      });
      attrs.verified = verified;
    }

    if (contact.notRegistered) {
      const timestamp = getCheckedTimestampOrUndefinedFromLong(
        contact.notRegistered.unregisteredTimestamp
      );
      attrs.discoveredUnregisteredAt = timestamp || this.#now;
      attrs.firstUnregisteredAt = timestamp || undefined;
    } else if (!contact.registered) {
      log.error(
        contact.registered,
        'contact is neither registered nor unregistered; treating as registered'
      );
      this.#frameErrorCount += 1;
    }

    if (contact.blocked) {
      if (serviceId) {
        await window.storage.blocked.addBlockedServiceId(serviceId);
      }
      if (e164) {
        await window.storage.blocked.addBlockedNumber(e164);
      }
    }

    return attrs;
  }

  async #fromGroup(group: Backups.IGroup): Promise<ConversationAttributesType> {
    const { masterKey, snapshot } = group;
    strictAssert(masterKey != null, 'fromGroup: missing masterKey');
    strictAssert(snapshot != null, 'fromGroup: missing snapshot');

    const secretParams = deriveGroupSecretParams(masterKey);
    const publicParams = deriveGroupPublicParams(secretParams);
    const groupId = Bytes.toBase64(deriveGroupID(secretParams));

    const {
      title,
      description,
      avatarUrl,
      disappearingMessagesTimer,
      accessControl,
      version,
      members,
      membersPendingProfileKey,
      membersPendingAdminApproval,
      membersBanned,
      inviteLinkPassword,
      announcementsOnly,
    } = snapshot;

    const expirationTimerS =
      disappearingMessagesTimer?.disappearingMessagesDuration;

    let storySendMode: StorySendMode | undefined;
    switch (group.storySendMode) {
      case Backups.Group.StorySendMode.ENABLED:
        storySendMode = StorySendMode.Always;
        break;
      case Backups.Group.StorySendMode.DISABLED:
        storySendMode = StorySendMode.Never;
        break;
      default:
        storySendMode = undefined;
        break;
    }
    const attrs: ConversationAttributesType = {
      id: generateUuid(),
      type: 'group',
      version: 2,
      groupVersion: 2,
      masterKey: Bytes.toBase64(masterKey),
      groupId,
      secretParams: Bytes.toBase64(secretParams),
      publicParams: Bytes.toBase64(publicParams),
      profileSharing: group.whitelisted === true,
      messageRequestResponseType:
        group.whitelisted === true
          ? SignalService.SyncMessage.MessageRequestResponse.Type.ACCEPT
          : undefined,
      hideStory: group.hideStory === true,
      storySendMode,
      avatar: avatarUrl
        ? {
            url: avatarUrl,
          }
        : undefined,

      // Snapshot
      name: dropNull(title?.title)?.trim(),
      description: dropNull(description?.descriptionText)?.trim(),
      expireTimer: expirationTimerS
        ? DurationInSeconds.fromSeconds(expirationTimerS)
        : undefined,
      expireTimerVersion: 1,
      accessControl: accessControl
        ? {
            attributes:
              dropNull(accessControl.attributes) ??
              SignalService.AccessControl.AccessRequired.UNKNOWN,
            members:
              dropNull(accessControl.members) ??
              SignalService.AccessControl.AccessRequired.UNKNOWN,
            addFromInviteLink:
              dropNull(accessControl.addFromInviteLink) ??
              SignalService.AccessControl.AccessRequired.UNKNOWN,
          }
        : undefined,
      membersV2: members?.map(({ userId, role, joinedAtVersion }) => {
        strictAssert(Bytes.isNotEmpty(userId), 'Empty gv2 member userId');

        // Note that we deliberately ignore profile key since it has to be
        // in the Contact frame

        return {
          aci: fromAciObject(Aci.fromUuidBytes(userId)),
          role: dropNull(role) ?? SignalService.Member.Role.UNKNOWN,
          joinedAtVersion: dropNull(joinedAtVersion) ?? 0,
        };
      }),
      pendingMembersV2: membersPendingProfileKey?.map(
        ({ member, addedByUserId, timestamp }) => {
          strictAssert(member != null, 'Missing gv2 pending member');
          strictAssert(
            Bytes.isNotEmpty(addedByUserId),
            'Empty gv2 pending member addedByUserId'
          );

          // profileKey is not available for pending members.
          const { userId, role } = member;

          strictAssert(Bytes.isNotEmpty(userId), 'Empty gv2 member userId');

          const serviceId = fromServiceIdObject(
            ServiceId.parseFromServiceIdBinary(Buffer.from(userId))
          );

          return {
            serviceId,
            role: dropNull(role) ?? SignalService.Member.Role.UNKNOWN,
            addedByUserId: fromAciObject(Aci.fromUuidBytes(addedByUserId)),
            timestamp:
              timestamp != null ? getCheckedTimestampFromLong(timestamp) : 0,
          };
        }
      ),
      pendingAdminApprovalV2: membersPendingAdminApproval?.map(
        ({ userId, timestamp }) => {
          strictAssert(Bytes.isNotEmpty(userId), 'Empty gv2 member userId');

          // Note that we deliberately ignore profile key since it has to be
          // in the Contact frame

          return {
            aci: fromAciObject(Aci.fromUuidBytes(userId)),
            timestamp:
              timestamp != null ? getCheckedTimestampFromLong(timestamp) : 0,
          };
        }
      ),
      bannedMembersV2: membersBanned?.map(({ userId, timestamp }) => {
        strictAssert(Bytes.isNotEmpty(userId), 'Empty gv2 member userId');

        // Note that we deliberately ignore profile key since it has to be
        // in the Contact frame

        const serviceId = fromServiceIdObject(
          ServiceId.parseFromServiceIdBinary(Buffer.from(userId))
        );

        return {
          serviceId,
          timestamp:
            timestamp != null ? getCheckedTimestampFromLong(timestamp) : 0,
        };
      }),
      revision: dropNull(version),
      groupInviteLinkPassword: Bytes.isNotEmpty(inviteLinkPassword)
        ? Bytes.toBase64(inviteLinkPassword)
        : undefined,
      announcementsOnly: dropNull(announcementsOnly),
    };
    if (avatarUrl) {
      this.#pendingGroupAvatars.set(attrs.id, avatarUrl);
    }
    if (group.blocked) {
      await window.storage.blocked.addBlockedGroup(groupId);
    }

    return attrs;
  }

  async #fromDistributionList(
    listItem: Backups.IDistributionListItem
  ): Promise<void> {
    strictAssert(
      Bytes.isNotEmpty(listItem.distributionId),
      'Missing distribution list id'
    );

    const id = bytesToUuid(listItem.distributionId) || MY_STORY_ID;
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

      strictAssert(
        !isBlockList || id === MY_STORY_ID,
        'Block list can be set only for my story'
      );

      result = {
        ...commonFields,
        name: list.name ?? '',
        allowsReplies: list.allowReplies === true,
        isBlockList,
        members: (list.memberRecipientIds || []).map(recipientId => {
          const convo = this.#recipientIdToConvo.get(recipientId.toNumber());
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

        deletedAtTimestamp: getCheckedTimestampFromLong(
          listItem.deletionTimestamp
        ),
      };
    }

    await DataWriter.createNewStoryDistribution(result);
  }

  async #fromCallLink(
    recipientId: number,
    callLinkProto: Backups.ICallLink
  ): Promise<void> {
    const {
      rootKey: rootKeyBytes,
      adminKey,
      name,
      restrictions,
      expirationMs,
    } = callLinkProto;

    strictAssert(rootKeyBytes?.length, 'fromCallLink: rootKey is required');
    strictAssert(name, 'fromCallLink: name is required');

    const rootKey = CallLinkRootKey.fromBytes(Buffer.from(rootKeyBytes));

    const callLink: CallLinkType = {
      roomId: getRoomIdFromRootKey(rootKey),
      rootKey: rootKey.toString(),
      adminKey: adminKey?.length ? fromAdminKeyBytes(adminKey) : null,
      name,
      restrictions: fromCallLinkRestrictionsProto(restrictions),
      revoked: false,
      expiration: getTimestampOrUndefinedFromLong(expirationMs) ?? null,
      storageNeedsSync: false,
    };

    this.#recipientIdToCallLink.set(recipientId, callLink);

    if (
      isCallLinkAdmin(callLink) &&
      !this.#adminCallLinksToHasCall.has(callLink)
    ) {
      this.#adminCallLinksToHasCall.set(callLink, false);
    }

    await DataWriter.insertCallLink(callLink);
  }

  async #fromChat(chat: Backups.IChat): Promise<void> {
    strictAssert(chat.id != null, 'chat must have an id');
    strictAssert(chat.recipientId != null, 'chat must have a recipientId');

    // Drop release notes chat
    if (this.#releaseNotesRecipientId?.eq(chat.recipientId)) {
      strictAssert(
        this.#releaseNotesChatId == null,
        'Duplicate release notes chat'
      );
      this.#releaseNotesChatId = chat.id;
      return;
    }

    const conversation = this.#recipientIdToConvo.get(
      chat.recipientId.toNumber()
    );
    strictAssert(conversation !== undefined, 'unknown conversation');

    this.#chatIdToConvo.set(chat.id.toNumber(), conversation);

    if (isTestEnvironment(getEnvironment())) {
      conversation.test_chatFrameImportedFromBackup = true;
    }

    conversation.isArchived = chat.archived === true;
    conversation.isPinned = (chat.pinnedOrder || 0) !== 0;

    conversation.expireTimer =
      chat.expirationTimerMs && !chat.expirationTimerMs.isZero()
        ? DurationInSeconds.fromMillis(chat.expirationTimerMs.toNumber())
        : undefined;
    conversation.expireTimerVersion = chat.expireTimerVersion || 1;

    if (
      chat.muteUntilMs != null &&
      chat.muteUntilMs.toNumber() >= MAX_SAFE_DATE
    ) {
      // Muted forever
      conversation.muteExpiresAt = Number.MAX_SAFE_INTEGER;
    } else {
      conversation.muteExpiresAt = getCheckedTimestampOrUndefinedFromLong(
        chat.muteUntilMs
      );
    }
    conversation.markedUnread = chat.markedUnread === true;
    conversation.dontNotifyForMentionsIfMuted =
      chat.dontNotifyForMentionsIfMuted === true;

    const chatStyle = this.#fromChatStyle(chat.style);

    if (chatStyle.wallpaperPhotoPointer != null) {
      conversation.wallpaperPhotoPointerBase64 = Bytes.toBase64(
        chatStyle.wallpaperPhotoPointer
      );
    }
    if (chatStyle.wallpaperPreset != null) {
      conversation.wallpaperPreset = chatStyle.wallpaperPreset;
    }
    if (chatStyle.color != null) {
      conversation.conversationColor = chatStyle.color;
    }
    if (chatStyle.customColorData != null) {
      conversation.customColor = chatStyle.customColorData.value;
      conversation.customColorId = chatStyle.customColorData.id;
    }
    if (chatStyle.dimWallpaperInDarkMode != null) {
      conversation.dimWallpaperInDarkMode = chatStyle.dimWallpaperInDarkMode;
    }
    if (chatStyle.autoBubbleColor) {
      conversation.autoBubbleColor = chatStyle.autoBubbleColor;
    }

    await this.#updateConversation(conversation);

    if (chat.pinnedOrder != null) {
      this.#pinnedConversations.push([chat.pinnedOrder, conversation.id]);
    }
  }

  async #fromChatItem(
    item: Backups.IChatItem,
    options: { aboutMe: AboutMe }
  ): Promise<void> {
    const { aboutMe } = options;

    const timestamp = getCheckedTimestampOrUndefinedFromLong(item?.dateSent);
    const logId = `fromChatItem(${timestamp})`;

    strictAssert(
      this.#ourConversation != null,
      `${logId}: AccountData missing`
    );

    strictAssert(item.chatId != null, `${logId}: must have a chatId`);
    strictAssert(item.dateSent != null, `${logId}: must have a dateSent`);
    strictAssert(timestamp, `${logId}: must have a timestamp`);

    if (this.#releaseNotesChatId?.eq(item.chatId)) {
      // Drop release notes messages
      return;
    }

    const chatConvo = this.#chatIdToConvo.get(item.chatId.toNumber());
    strictAssert(
      chatConvo !== undefined,
      `${logId}: chat conversation not found`
    );

    const authorConvo = item.authorId
      ? this.#recipientIdToConvo.get(item.authorId.toNumber())
      : undefined;

    const {
      patch: directionDetails,
      newActiveAt,
      unread,
    } = this.#fromDirectionDetails(item, timestamp);

    if (
      newActiveAt != null &&
      this.#shouldChatItemAffectChatListPresence(item)
    ) {
      chatConvo.active_at = newActiveAt;
    }

    if (unread != null) {
      chatConvo.unreadCount = (chatConvo.unreadCount ?? 0) + 1;
    }

    const expirationStartTimestamp = getCheckedTimestampOrUndefinedFromLong(
      item.expireStartDate
    );
    const expireTimer =
      item.expiresInMs && !item.expiresInMs.isZero()
        ? DurationInSeconds.fromMillis(item.expiresInMs.toNumber())
        : undefined;

    const expirationTimestamp = calculateExpirationTimestamp({
      expireTimer,
      expirationStartTimestamp,
    });

    if (expirationTimestamp != null && expirationTimestamp < this.#now) {
      // Drop expired messages
      return;
    }

    let attributes: MessageAttributesType = {
      ...generateMessageId(incrementMessageCounter()),
      conversationId: chatConvo.id,
      sent_at: timestamp,
      source: authorConvo?.e164,
      sourceServiceId: authorConvo?.serviceId,
      timestamp,
      type: item.outgoing != null ? 'outgoing' : 'incoming',
      expirationStartTimestamp,
      expireTimer,
      sms: item.sms === true ? true : undefined,
      ...directionDetails,
    };
    const additionalMessages: Array<MessageAttributesType> = [];

    if (item.incoming) {
      strictAssert(
        authorConvo && this.#ourConversation.id !== authorConvo?.id,
        `${logId}: message with incoming field must be incoming`
      );
    } else if (item.outgoing) {
      strictAssert(
        authorConvo && this.#ourConversation.id === authorConvo?.id,
        `${logId}: outgoing message must have outgoing field`
      );
    }

    if (item.standardMessage) {
      attributes = {
        ...attributes,
        ...(await this.#fromStandardMessage({
          logId,
          data: item.standardMessage,
        })),
      };
    } else if (item.viewOnceMessage) {
      attributes = {
        ...attributes,
        ...(await this.#fromViewOnceMessage(item.viewOnceMessage)),
      };
    } else if (item.directStoryReplyMessage) {
      strictAssert(item.directionless == null, 'reply cannot be directionless');
      let storyAuthorAci: AciString | undefined;
      if (item.incoming) {
        strictAssert(this.#aboutMe?.aci, 'about me must exist');
        storyAuthorAci = this.#aboutMe.aci;
      } else {
        strictAssert(
          isAciString(chatConvo.serviceId),
          'must have ACI for story author'
        );
        storyAuthorAci = chatConvo.serviceId;
      }
      attributes = {
        ...attributes,
        ...this.#fromDirectStoryReplyMessage(
          item.directStoryReplyMessage,
          storyAuthorAci
        ),
      };
    } else {
      const result = await this.#fromNonBubbleChatItem(item, {
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
          ...generateMessageId(incrementMessageCounter()),
          sent_at: sentAt,
          ...additional,
        });
      });
    }

    if (item.revisions?.length) {
      strictAssert(
        item.standardMessage || item.directStoryReplyMessage,
        `${logId}: Only standard or story reply message can have revisions`
      );

      const history = await this.#fromRevisions({
        mainMessage: attributes,
        revisions: item.revisions,
        logId,
      });
      attributes.editHistory = history;

      // Update timestamps on the parent message
      const oldest = history.at(-1);

      assertDev(oldest != null, `${logId}: History is non-empty`);

      attributes.editMessageReceivedAt = attributes.received_at;
      attributes.editMessageReceivedAtMs = attributes.received_at_ms;
      attributes.editMessageTimestamp = attributes.timestamp;

      attributes.received_at = oldest.received_at;
      attributes.received_at_ms = oldest.received_at_ms;
      attributes.timestamp = oldest.timestamp;
      attributes.sent_at = oldest.timestamp;
    }

    assertDev(
      isAciString(this.#ourConversation.serviceId),
      `${logId}: Our conversation must have ACI`
    );
    await Promise.all([
      this.#saveMessage(attributes),
      ...additionalMessages.map(additional => this.#saveMessage(additional)),
    ]);

    if (item.outgoing != null) {
      chatConvo.sentMessageCount = (chatConvo.sentMessageCount ?? 0) + 1;
    } else if (item.incoming != null) {
      chatConvo.messageCount = (chatConvo.messageCount ?? 0) + 1;
    }

    await this.#updateConversation(chatConvo);
  }

  #fromDirectionDetails(
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

      const unidentifiedDeliveries = new Array<ServiceIdString>();
      const errors = new Array<CustomError>();

      let sendStatuses = outgoing.sendStatus;
      if (!sendStatuses?.length) {
        // TODO: DESKTOP-8089
        // If this outgoing message was not sent to anyone, we add ourselves to
        // sendStateByConversationId and mark read. This is to match existing desktop
        // behavior.
        sendStatuses = [
          {
            recipientId: item.authorId,
            read: new Backups.SendStatus.Read(),
            timestamp: item.dateSent,
          },
        ];
      }

      for (const status of sendStatuses) {
        strictAssert(
          status.recipientId,
          'sendStatus recipient must have an id'
        );
        const target = this.#recipientIdToConvo.get(
          status.recipientId.toNumber()
        );
        strictAssert(
          target !== undefined,
          'status target conversation not found'
        );

        const { serviceId } = target;

        let sendStatus: SendStatus;
        if (status.pending) {
          sendStatus = SendStatus.Pending;
        } else if (status.sent) {
          sendStatus = SendStatus.Sent;
          if (serviceId && status.sent.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (status.delivered) {
          sendStatus = SendStatus.Delivered;
          if (serviceId && status.delivered.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (status.read) {
          sendStatus = SendStatus.Read;
          if (serviceId && status.read.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (status.viewed) {
          sendStatus = SendStatus.Viewed;
          if (serviceId && status.viewed.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (status.failed) {
          sendStatus = SendStatus.Failed;
          strictAssert(
            status.failed.reason != null,
            'Failure reason must exist'
          );
          switch (status.failed.reason) {
            case Backups.SendStatus.Failed.FailureReason.IDENTITY_KEY_MISMATCH:
              errors.push({
                serviceId,
                name: 'OutgoingIdentityKeyError',
                // See: ts/textsecure/Errors
                message: `The identity of ${serviceId} has changed.`,
              });
              break;
            case Backups.SendStatus.Failed.FailureReason.NETWORK:
              errors.push({
                serviceId,
                name: 'OutgoingMessageError',
                // See: ts/textsecure/Errors
                message: 'no http error',
              });
              break;
            case Backups.SendStatus.Failed.FailureReason.UNKNOWN:
              errors.push({
                serviceId,
                name: 'UnknownError',
                message: 'unknown error',
              });
              break;
            default:
              throw missingCaseError(status.failed.reason);
          }
          // Desktop does not keep track of users we did not attempt to send to
        } else if (status.skipped) {
          sendStatus = SendStatus.Skipped;
        } else {
          log.error(
            `${timestamp}: Unknown sendStatus received: ${status}, falling back to Pending`
          );
          // We fallback to pending for unknown send statuses
          sendStatus = SendStatus.Pending;
          this.#frameErrorCount += 1;
        }

        sendStateByConversationId[target.id] = {
          status: sendStatus,
          updatedAt:
            status.timestamp != null && !status.timestamp.isZero()
              ? getCheckedTimestampFromLong(status.timestamp)
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
      const receivedAtMs =
        getCheckedTimestampOrUndefinedFromLong(incoming.dateReceived) ??
        this.#now;
      const serverTimestamp = getCheckedTimestampOrUndefinedFromLong(
        incoming.dateServerSent
      );

      const unidentifiedDeliveryReceived = incoming.sealedSender === true;

      if (incoming.read) {
        return {
          patch: {
            readStatus: ReadStatus.Read,
            seenStatus: SeenStatus.Seen,
            received_at_ms: receivedAtMs,
            serverTimestamp,
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
          serverTimestamp,
          unidentifiedDeliveryReceived,
        },
        newActiveAt: receivedAtMs,
        unread: true,
      };
    }

    strictAssert(directionless, 'Absent direction state');
    return {
      patch: {
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Seen,
      },
      newActiveAt: timestamp,
    };
  }

  /**
   * Some update messages should not affect the chat's position in the left pane chat
   * list. For example, conversations with only an identity update (SN change) message
   * should not show in the left pane.
   *
   * iOS list: /main/SignalServiceKit/Messages/Interactions/TSInteraction.swift
   */
  #shouldChatItemAffectChatListPresence(item: Backups.IChatItem): boolean {
    if (!item.updateMessage) {
      return true;
    }

    if (
      item.updateMessage.profileChange ||
      item.updateMessage.learnedProfileChange ||
      item.updateMessage.sessionSwitchover ||
      item.updateMessage.threadMerge
    ) {
      return false;
    }

    if (
      item.updateMessage.groupChange?.updates?.every(
        update =>
          Boolean(update.groupMemberLeftUpdate) ||
          Boolean(update.groupV2MigrationUpdate)
      )
    ) {
      return false;
    }

    if (item.updateMessage.simpleUpdate) {
      switch (item.updateMessage.simpleUpdate.type) {
        case Backups.SimpleChatUpdate.Type.IDENTITY_UPDATE:
        case Backups.SimpleChatUpdate.Type.CHANGE_NUMBER:
        case Backups.SimpleChatUpdate.Type.MESSAGE_REQUEST_ACCEPTED:
        case Backups.SimpleChatUpdate.Type.REPORTED_SPAM:
        case Backups.SimpleChatUpdate.Type.IDENTITY_DEFAULT:
        case Backups.SimpleChatUpdate.Type.IDENTITY_VERIFIED:
        case Backups.SimpleChatUpdate.Type.UNKNOWN:
        case undefined:
        case null:
          return false;
        // Listing all of these out (rather than a default case) so that TS will force us
        // to update this list when a new type is introduced
        case Backups.SimpleChatUpdate.Type.BAD_DECRYPT:
        case Backups.SimpleChatUpdate.Type.BLOCKED:
        case Backups.SimpleChatUpdate.Type.CHAT_SESSION_REFRESH:
        case Backups.SimpleChatUpdate.Type.END_SESSION:
        case Backups.SimpleChatUpdate.Type.JOINED_SIGNAL:
        case Backups.SimpleChatUpdate.Type.PAYMENTS_ACTIVATED:
        case Backups.SimpleChatUpdate.Type.PAYMENT_ACTIVATION_REQUEST:
        case Backups.SimpleChatUpdate.Type.RELEASE_CHANNEL_DONATION_REQUEST:
        case Backups.SimpleChatUpdate.Type.UNBLOCKED:
        case Backups.SimpleChatUpdate.Type.UNSUPPORTED_PROTOCOL_MESSAGE:
          return true;
        default:
          throw missingCaseError(item.updateMessage.simpleUpdate.type);
      }
    }

    return true;
  }

  async #fromStandardMessage({
    logId,
    data,
  }: {
    logId: string;
    data: Backups.IStandardMessage;
  }): Promise<Partial<MessageAttributesType>> {
    return {
      // We don't want to trim if we'll be downloading a body attachment; we might
      // drop bodyRanges which apply to the longer text we'll get in that download.
      ...(data.longText
        ? {
            body: data.text?.body || undefined,
            bodyRanges: this.#fromBodyRanges(data.text),
          }
        : trimMessageWhitespace({
            body: data.text?.body || undefined,
            bodyRanges: this.#fromBodyRanges(data.text),
          })),
      bodyAttachment: data.longText
        ? convertFilePointerToAttachment(data.longText)
        : undefined,
      attachments: data.attachments?.length
        ? data.attachments
            .map(convertBackupMessageAttachmentToAttachment)
            .filter(isNotNil)
        : undefined,
      preview: data.linkPreview?.length
        ? this.#fromLinkPreview({
            logId,
            body: data.text?.body,
            previews: data.linkPreview,
          })
        : undefined,
      reactions: this.#fromReactions(data.reactions),
      quote: data.quote ? await this.#fromQuote(data.quote) : undefined,
    };
  }

  #fromLinkPreview({
    logId,
    body,
    previews,
  }: {
    logId: string;
    body: string | null | undefined;
    previews: Array<Backups.ILinkPreview>;
  }): Array<LinkPreviewType> {
    const urlsInBody = LinkPreview.findLinks(body ?? '');
    return previews
      .map(preview => {
        if (
          !LinkPreview.isValidLinkPreview(urlsInBody, preview, {
            isStory: false,
          })
        ) {
          log.warn(`${logId}: dropping invalid link preview`);
          return;
        }

        strictAssert(preview.url, 'url must exist in valid link preview');

        return {
          url: preview.url,
          title: dropNull(preview.title),
          description: dropNull(preview.description),
          date: getCheckedTimestampOrUndefinedFromLong(preview.date),
          image: preview.image
            ? convertFilePointerToAttachment(preview.image)
            : undefined,
        };
      })
      .filter(isNotNil);
  }

  async #fromViewOnceMessage({
    attachment,
    reactions,
  }: Backups.IViewOnceMessage): Promise<Partial<MessageAttributesType>> {
    return {
      ...(attachment
        ? {
            attachments: [
              convertBackupMessageAttachmentToAttachment(attachment),
            ].filter(isNotNil),
          }
        : {
            attachments: undefined,
            readStatus: ReadStatus.Viewed,
            isErased: true,
          }),
      reactions: this.#fromReactions(reactions),
      isViewOnce: true,
    };
  }

  #fromDirectStoryReplyMessage(
    directStoryReplyMessage: Backups.IDirectStoryReplyMessage,
    storyAuthorAci: AciString
  ): Partial<MessageAttributesType> {
    const { reactions, textReply, emoji } = directStoryReplyMessage;

    const result: Partial<MessageAttributesType> = {
      reactions: this.#fromReactions(reactions),
      storyReplyContext: {
        authorAci: storyAuthorAci,
        messageId: '', // stories are never imported
      },
    };

    if (textReply) {
      result.body = textReply.text?.body ?? undefined;
      result.bodyRanges = this.#fromBodyRanges(textReply.text);
      result.bodyAttachment = textReply.longText
        ? convertFilePointerToAttachment(textReply.longText)
        : undefined;
    } else if (emoji) {
      result.storyReaction = {
        emoji,
        targetAuthorAci: storyAuthorAci,
        targetTimestamp: 0, // stories are never imported
      };
    } else {
      throw new Error(
        'Direct story reply message missing both textReply and emoji'
      );
    }

    return result;
  }

  async #fromDirectStoryReplyRevision(
    revision: Backups.IDirectStoryReplyMessage
  ): Promise<Partial<EditHistoryType>> {
    const { textReply } = revision;

    if (!textReply) {
      return {};
    }

    return {
      body: textReply.text?.body ?? undefined,
      bodyRanges: this.#fromBodyRanges(textReply.text),
      bodyAttachment: textReply.longText
        ? convertFilePointerToAttachment(textReply.longText)
        : undefined,
    };
  }

  async #fromRevisions({
    mainMessage,
    revisions,
    logId,
  }: {
    mainMessage: MessageAttributesType;
    revisions: ReadonlyArray<Backups.IChatItem>;
    logId: string;
  }): Promise<Array<EditHistoryType>> {
    const result = await Promise.all(
      revisions
        .map(async rev => {
          strictAssert(
            rev.standardMessage || rev.directStoryReplyMessage,
            'Edit history on a message that does not support revisions'
          );

          const timestamp = getCheckedTimestampFromLong(rev.dateSent);

          const {
            patch: {
              sendStateByConversationId,
              // eslint-disable-next-line camelcase
              received_at_ms,
              serverTimestamp,
              readStatus,
              unidentifiedDeliveryReceived,
            },
          } = this.#fromDirectionDetails(rev, timestamp);

          const commonFields = {
            timestamp,
            received_at: incrementMessageCounter(),
            sendStateByConversationId,
            // eslint-disable-next-line camelcase
            received_at_ms,
            serverTimestamp,
            readStatus,
            unidentifiedDeliveryReceived,
          };

          if (rev.standardMessage) {
            return {
              ...(await this.#fromStandardMessage({
                logId,
                data: rev.standardMessage,
              })),
              ...commonFields,
            };
          }

          if (rev.directStoryReplyMessage) {
            return {
              ...(await this.#fromDirectStoryReplyRevision(
                rev.directStoryReplyMessage
              )),
              ...commonFields,
            };
          }
          throw new Error(
            'Edit history on a message that does not support revisions'
          );
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
      serverTimestamp: mainMessage.serverTimestamp,
      readStatus: mainMessage.readStatus,
      unidentifiedDeliveryReceived: mainMessage.unidentifiedDeliveryReceived,
    });

    return result;
  }

  async #fromQuote(quote: Backups.IQuote): Promise<QuotedMessageType> {
    strictAssert(quote.authorId != null, 'quote must have an authorId');

    const authorConvo = this.#recipientIdToConvo.get(quote.authorId.toNumber());
    strictAssert(authorConvo !== undefined, 'author conversation not found');

    return {
      id:
        getCheckedTimestampOrUndefinedFromLong(quote.targetSentTimestamp) ??
        null,
      referencedMessageNotFound: quote.targetSentTimestamp == null,
      authorAci: isAciString(authorConvo.serviceId)
        ? authorConvo.serviceId
        : undefined,
      author: isAciString(authorConvo.serviceId) ? undefined : authorConvo.e164,
      text: dropNull(quote.text?.body),
      bodyRanges: this.#fromBodyRanges(quote.text),
      isGiftBadge: quote.type === Backups.Quote.Type.GIFT_BADGE,
      isViewOnce: quote.type === Backups.Quote.Type.VIEW_ONCE,
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
    };
  }

  #fromBodyRanges(
    text: Backups.IText | null | undefined
  ): ReadonlyArray<RawBodyRange> | undefined {
    if (text == null) {
      return undefined;
    }
    const { bodyRanges } = text;
    if (!bodyRanges?.length) {
      return undefined;
    }

    return filterAndClean(
      bodyRanges.map(range => ({
        ...range,
        mentionAci: range.mentionAci
          ? Aci.parseFromServiceIdBinary(
              Buffer.from(range.mentionAci)
            ).getServiceIdString()
          : undefined,
      }))
    );
  }

  #fromReactions(
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
      .map(({ emoji, authorId, sentTimestamp }) => {
        strictAssert(emoji != null, 'reaction must have an emoji');
        strictAssert(authorId != null, 'reaction must have authorId');
        strictAssert(
          sentTimestamp != null,
          'reaction must have a sentTimestamp'
        );

        const authorConvo = this.#recipientIdToConvo.get(authorId.toNumber());
        strictAssert(
          authorConvo !== undefined,
          'author conversation not found'
        );

        return {
          emoji,
          fromId: authorConvo.id,
          targetTimestamp: getCheckedTimestampFromLong(sentTimestamp),
          timestamp: getCheckedTimestampFromLong(sentTimestamp),
        };
      });
  }

  async #fromNonBubbleChatItem(
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
      const { contact: details } = chatItem.contactMessage;
      strictAssert(details != null, 'contactMessage must have a contact');

      const { avatar, name, number, email, address, organization } = details;

      return {
        message: {
          contact: [
            {
              name: name
                ? {
                    givenName: name.givenName || undefined,
                    familyName: name.familyName || undefined,
                    prefix: name.prefix || undefined,
                    suffix: name.suffix || undefined,
                    middleName: name.middleName || undefined,
                    nickname: name.nickname || undefined,
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
                        label: label || undefined,
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
                        label: label || undefined,
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
                      label: label || undefined,
                      street: street || undefined,
                      pobox: pobox || undefined,
                      neighborhood: neighborhood || undefined,
                      city: city || undefined,
                      region: region || undefined,
                      postcode: postcode || undefined,
                      country: country || undefined,
                    };
                  })
                : undefined,
              organization: organization || undefined,
              avatar: avatar
                ? {
                    avatar: convertFilePointerToAttachment(avatar),
                    isProfile: false,
                  }
                : undefined,
            },
          ],
          reactions: this.#fromReactions(chatItem.contactMessage.reactions),
        },
        additionalMessages: [],
      };
    }
    if (chatItem.remoteDeletedMessage) {
      return {
        message: {
          isErased: true,
          deletedForEveryone: true,
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
            emoji: dropNull(emoji),
            packId: Bytes.toHex(packId),
            packKey: Bytes.toBase64(packKey),
            stickerId,
            data: data ? convertFilePointerToAttachment(data) : undefined,
          },
          reactions: this.#fromReactions(chatItem.stickerMessage.reactions),
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
      if (giftBadge.state === Backups.GiftBadge.State.FAILED) {
        return {
          message: {
            giftBadge: {
              state: GiftBadgeStates.Failed,
            },
          },
          additionalMessages: [],
        };
      }

      strictAssert(
        Bytes.isNotEmpty(giftBadge.receiptCredentialPresentation),
        'Gift badge must have a presentation'
      );

      let state: GiftBadgeStates;
      switch (giftBadge.state) {
        case Backups.GiftBadge.State.OPENED:
          state = GiftBadgeStates.Opened;
          break;

        case Backups.GiftBadge.State.REDEEMED:
          state = GiftBadgeStates.Redeemed;
          break;

        case Backups.GiftBadge.State.UNOPENED:
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
      return this.#fromChatItemUpdateMessage(chatItem.updateMessage, options);
    }

    throw new Error(`${logId}: Message was missing all five message types`);
  }

  async #fromChatItemUpdateMessage(
    updateMessage: Backups.IChatUpdateMessage,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { aboutMe, author, conversation } = options;

    if (updateMessage.groupChange) {
      return this.#fromGroupUpdateMessage(updateMessage.groupChange, options);
    }

    if (updateMessage.expirationTimerChange) {
      const { expiresInMs } = updateMessage.expirationTimerChange;

      let sourceServiceId = author?.serviceId;
      let source = author?.e164;
      if (!sourceServiceId) {
        sourceServiceId = aboutMe.aci;
        source = aboutMe.e164;
      }
      const expireTimer = DurationInSeconds.fromMillis(
        expiresInMs?.toNumber() ?? 0
      );

      return {
        message: {
          type: 'timer-notification',
          sourceServiceId,
          source,
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
      const message = await this.#fromSimpleUpdateMessage(
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
      if (e164 == null && username == null) {
        log.error(
          `${options.timestamp}: learnedProfileChange had no previous e164 or username`
        );
        this.#frameErrorCount += 1;
      }
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

    if (updateMessage.groupCall) {
      const { groupId } = conversation;

      if (!isGroup(conversation)) {
        throw new Error('groupCall: Conversation is not a group!');
      }
      if (!groupId) {
        throw new Error('groupCall: No groupId available on conversation');
      }

      const {
        callId: callIdLong,
        state,
        ringerRecipientId: ringerRecipientIdLong,
        startedCallRecipientId: startedCallRecipientIdLong,
        startedCallTimestamp,
        endedCallTimestamp,
        read,
      } = updateMessage.groupCall;

      const ringerRecipientId = ringerRecipientIdLong?.toNumber();
      const startedCallRecipientId = startedCallRecipientIdLong?.toNumber();
      const ringer = isNumber(ringerRecipientId)
        ? this.#recipientIdToConvo.get(ringerRecipientId)
        : undefined;
      const startedBy = isNumber(startedCallRecipientId)
        ? this.#recipientIdToConvo.get(startedCallRecipientId)
        : undefined;

      let callId: string;
      if (callIdLong?.toNumber()) {
        callId = callIdLong.toString();
      } else {
        // Legacy calls may not have a callId, so we generate one locally
        callId = generateUuid();
      }

      if (!startedCallTimestamp) {
        throw new Error('groupCall: startedCallTimestamp is required!');
      }
      const isRingerMe = ringer?.serviceId === aboutMe.aci;

      const callHistory: CallHistoryDetails = {
        callId,
        status: fromGroupCallStateProto(state),
        mode: CallMode.Group,
        type: CallType.Group,
        ringerId: ringer?.serviceId ?? null,
        startedById: isAciString(startedBy?.serviceId)
          ? startedBy.serviceId
          : null,
        peerId: groupId,
        direction: isRingerMe ? CallDirection.Outgoing : CallDirection.Incoming,
        timestamp: getCheckedTimestampFromLong(startedCallTimestamp),
        endedTimestamp:
          getCheckedTimestampOrUndefinedFromLong(endedCallTimestamp) ?? null,
      };

      await this.#saveCallHistory(callHistory);

      return {
        message: {
          type: 'call-history',
          callId,
          sourceServiceId: undefined,
          source: undefined,
          readStatus: ReadStatus.Read,
          seenStatus: read ? SeenStatus.Seen : SeenStatus.Unseen,
        },
        additionalMessages: [],
      };
    }

    if (updateMessage.individualCall) {
      const {
        callId: callIdLong,
        type,
        direction: protoDirection,
        state,
        startedCallTimestamp,
        read,
      } = updateMessage.individualCall;

      let callId: string;
      if (callIdLong?.toNumber()) {
        callId = callIdLong.toString();
      } else {
        // Legacy calls may not have a callId, so we generate one locally
        callId = generateUuid();
      }

      if (!startedCallTimestamp) {
        throw new Error('individualCall: startedCallTimestamp is required!');
      }

      const peerId = conversation.serviceId || conversation.e164;
      strictAssert(peerId, 'individualCall: no peerId found for call');

      const direction = fromIndividualCallDirectionProto(protoDirection);
      const ringerId =
        direction === CallDirection.Outgoing
          ? aboutMe.aci
          : conversation.serviceId;
      strictAssert(ringerId, 'individualCall: no ringerId found');

      const callHistory: CallHistoryDetails = {
        callId,
        status: fromIndividualCallStateProto(state),
        mode: CallMode.Direct,
        type: fromIndividualCallTypeProto(type),
        ringerId,
        startedById: null,
        peerId,
        direction,
        timestamp: getCheckedTimestampFromLong(startedCallTimestamp),
        endedTimestamp: null,
      };

      await this.#saveCallHistory(callHistory);

      return {
        message: {
          type: 'call-history',
          callId,
          sourceServiceId: undefined,
          source: undefined,
          readStatus: ReadStatus.Read,
          seenStatus: read ? SeenStatus.Seen : SeenStatus.Unseen,
        },
        additionalMessages: [],
      };
    }

    return undefined;
  }

  async #fromGroupUpdateMessage(
    groupChange: Backups.IGroupChangeChatUpdate,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { updates } = groupChange;
    const { aboutMe, timestamp, author } = options;
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
          serviceId: fromServiceIdObject(
            ServiceId.parseFromServiceIdBinary(Buffer.from(inviteeServiceId))
          ),
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
        let sourceServiceId: AciString | undefined;
        let source = author?.e164;

        if (Bytes.isNotEmpty(updaterAci)) {
          sourceServiceId = fromAciObject(Aci.fromUuidBytes(updaterAci));
          if (sourceServiceId !== author?.serviceId) {
            source = undefined;
          }
        }

        const expireTimer = expiresInMs
          ? DurationInSeconds.fromMillis(expiresInMs.toNumber())
          : undefined;
        additionalMessages.push({
          type: 'timer-notification',
          sourceServiceId,
          source,
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

  async #fromSimpleUpdateMessage(
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
    strictAssert(simpleUpdate.type != null, 'Simple update missing type');
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
      case Type.RELEASE_CHANNEL_DONATION_REQUEST:
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
      case Type.REPORTED_SPAM:
        return {
          type: 'message-request-response-event',
          messageRequestResponseEvent: MessageRequestResponseEvent.SPAM,
        };
      case Type.BLOCKED:
        return {
          type: 'message-request-response-event',
          messageRequestResponseEvent: MessageRequestResponseEvent.BLOCK,
        };
      case Type.UNBLOCKED:
        return {
          type: 'message-request-response-event',
          messageRequestResponseEvent: MessageRequestResponseEvent.UNBLOCK,
        };
      case Type.MESSAGE_REQUEST_ACCEPTED:
        return {
          type: 'message-request-response-event',
          messageRequestResponseEvent: MessageRequestResponseEvent.ACCEPT,
        };
      default:
        throw new Error(`Unsupported update type: ${simpleUpdate.type}`);
    }
  }

  async #fromStickerPack({
    packId: packIdBytes,
    packKey: packKeyBytes,
  }: Backups.IStickerPack): Promise<void> {
    strictAssert(
      packIdBytes?.length === STICKERPACK_ID_BYTE_LEN,
      'Sticker pack must have a valid pack id'
    );

    const id = Bytes.toHex(packIdBytes);
    const logId = `fromStickerPack(${id.slice(-2)})`;
    strictAssert(
      packKeyBytes?.length === STICKERPACK_KEY_BYTE_LEN,
      `${logId}: must have a valid pack key`
    );
    const key = Bytes.toBase64(packKeyBytes);

    this.#stickerPacks.push({ id, key });
  }

  async #fromAdHocCall({
    callId: callIdLong,
    recipientId: recipientIdLong,
    state,
    callTimestamp,
  }: Backups.IAdHocCall): Promise<void> {
    let callId: string;
    if (callIdLong?.toNumber()) {
      callId = callIdLong.toString();
    } else {
      // Legacy calls may not have a callId, so we generate one locally
      callId = generateUuid();
    }

    const logId = `fromAdhocCall(${callId.slice(-2)})`;

    strictAssert(callTimestamp, `${logId}: must have a valid timestamp`);
    strictAssert(recipientIdLong, 'AdHocCall must have a recipientIdLong');

    const recipientId = recipientIdLong.toNumber();
    const callLink = this.#recipientIdToCallLink.get(recipientId);

    if (!callLink) {
      log.warn(
        `${logId}: Dropping ad-hoc call, Call Link for recipientId ${recipientId} not found`
      );
      return;
    }

    const callHistory: CallHistoryDetails = {
      callId,
      peerId: callLink.roomId,
      ringerId: null,
      startedById: null,
      mode: CallMode.Adhoc,
      type: CallType.Adhoc,
      direction: CallDirection.Unknown,
      timestamp: getCheckedTimestampFromLong(callTimestamp),
      status: fromAdHocCallStateProto(state),
      endedTimestamp: null,
    };

    await this.#saveCallHistory(callHistory);

    if (isCallLinkAdmin(callLink)) {
      this.#adminCallLinksToHasCall.set(callLink, true);
    }
  }

  async #fromCustomChatColors(
    customChatColors:
      | ReadonlyArray<Backups.ChatStyle.ICustomChatColor>
      | undefined
      | null
  ): Promise<void> {
    if (!customChatColors?.length) {
      return;
    }

    const order = new Array<string>();
    const customColors: CustomColorsItemType = {
      version: 1,
      colors: {},
      order,
    };

    for (const color of customChatColors) {
      const uuid = generateUuid();
      let value: CustomColorType;

      order.push(uuid);

      if (color.solid) {
        value = {
          start: rgbIntToDesktopHSL(color.solid),
        };
      } else if (color.gradient) {
        strictAssert(color.gradient != null, 'Either solid or gradient');
        strictAssert(color.gradient.colors != null, 'Missing gradient colors');

        const start = color.gradient.colors.at(0);
        const end = color.gradient.colors.at(-1);
        const deg = color.gradient.angle;

        strictAssert(start != null, 'Missing start color');
        strictAssert(end != null, 'Missing end color');
        strictAssert(deg != null, 'Missing angle');

        value = {
          start: rgbIntToDesktopHSL(start),
          end: rgbIntToDesktopHSL(end),
          deg,
        };
      } else {
        log.error(
          'CustomChatColor missing both solid and gradient fields, dropping'
        );
        this.#frameErrorCount += 1;
        continue;
      }

      customColors.colors[uuid] = value;
      this.#customColorById.set(color.id?.toNumber() || 0, {
        id: uuid,
        value,
      });
    }

    await window.storage.put('customColors', customColors);
  }

  #fromChatStyle(chatStyle: Backups.IChatStyle | null | undefined): Omit<
    LocalChatStyle,
    'customColorId'
  > & {
    customColorData: CustomColorDataType | undefined;
  } {
    if (!chatStyle) {
      return {
        wallpaperPhotoPointer: undefined,
        wallpaperPreset: undefined,
        color: undefined,
        customColorData: undefined,
        dimWallpaperInDarkMode: undefined,
        autoBubbleColor: true,
      };
    }

    let wallpaperPhotoPointer: Uint8Array | undefined;
    let wallpaperPreset: number | undefined;
    const dimWallpaperInDarkMode = dropNull(chatStyle.dimWallpaperInDarkMode);

    if (chatStyle.wallpaperPhoto) {
      wallpaperPhotoPointer = Backups.FilePointer.encode(
        chatStyle.wallpaperPhoto
      ).finish();
    } else if (chatStyle.wallpaperPreset != null) {
      wallpaperPreset = chatStyle.wallpaperPreset;
    }

    let color: ConversationColorType | undefined;
    let customColorData: CustomColorDataType | undefined;
    let autoBubbleColor = false;
    if (chatStyle.autoBubbleColor) {
      autoBubbleColor = true;
      if (wallpaperPreset != null) {
        color = WALLPAPER_TO_BUBBLE_COLOR.get(wallpaperPreset);
      } else {
        color = undefined;
      }
    } else if (chatStyle.bubbleColorPreset != null) {
      const { BubbleColorPreset } = Backups.ChatStyle;

      switch (chatStyle.bubbleColorPreset) {
        case BubbleColorPreset.SOLID_CRIMSON:
          color = 'crimson';
          break;
        case BubbleColorPreset.SOLID_VERMILION:
          color = 'vermilion';
          break;
        case BubbleColorPreset.SOLID_BURLAP:
          color = 'burlap';
          break;
        case BubbleColorPreset.SOLID_FOREST:
          color = 'forest';
          break;
        case BubbleColorPreset.SOLID_WINTERGREEN:
          color = 'wintergreen';
          break;
        case BubbleColorPreset.SOLID_TEAL:
          color = 'teal';
          break;
        case BubbleColorPreset.SOLID_BLUE:
          color = 'blue';
          break;
        case BubbleColorPreset.SOLID_INDIGO:
          color = 'indigo';
          break;
        case BubbleColorPreset.SOLID_VIOLET:
          color = 'violet';
          break;
        case BubbleColorPreset.SOLID_PLUM:
          color = 'plum';
          break;
        case BubbleColorPreset.SOLID_TAUPE:
          color = 'taupe';
          break;
        case BubbleColorPreset.SOLID_STEEL:
          color = 'steel';
          break;
        case BubbleColorPreset.GRADIENT_EMBER:
          color = 'ember';
          break;
        case BubbleColorPreset.GRADIENT_MIDNIGHT:
          color = 'midnight';
          break;
        case BubbleColorPreset.GRADIENT_INFRARED:
          color = 'infrared';
          break;
        case BubbleColorPreset.GRADIENT_LAGOON:
          color = 'lagoon';
          break;
        case BubbleColorPreset.GRADIENT_FLUORESCENT:
          color = 'fluorescent';
          break;
        case BubbleColorPreset.GRADIENT_BASIL:
          color = 'basil';
          break;
        case BubbleColorPreset.GRADIENT_SUBLIME:
          color = 'sublime';
          break;
        case BubbleColorPreset.GRADIENT_SEA:
          color = 'sea';
          break;
        case BubbleColorPreset.GRADIENT_TANGERINE:
          color = 'tangerine';
          break;
        case BubbleColorPreset.SOLID_ULTRAMARINE:
        default:
          color = 'ultramarine';
          break;
      }
    } else if (chatStyle.customColorId != null) {
      const entry = this.#customColorById.get(
        chatStyle.customColorId.toNumber()
      );

      if (entry) {
        color = 'custom';
        customColorData = entry;
      } else {
        log.error('Chat style referenced missing custom color');
        this.#frameErrorCount += 1;
        autoBubbleColor = true;
      }
    } else {
      log.error('ChatStyle has no recognized field');
      this.#frameErrorCount += 1;
      autoBubbleColor = true;
    }

    return {
      wallpaperPhotoPointer,
      wallpaperPreset,
      color,
      customColorData,
      dimWallpaperInDarkMode,
      autoBubbleColor,
    };
  }
}

function rgbIntToDesktopHSL(intValue: number): {
  hue: number;
  saturation: number;
  lightness: number;
} {
  const { h: hue, s: saturation, l: lightness } = rgbIntToHSL(intValue);

  // Desktop stores saturation not as 0.123 (0 to 1.0) but 12.3 (percentage)
  return { hue, saturation: saturation * 100, lightness };
}

function fromGroupCallStateProto(
  state: Backups.GroupCall.State | undefined | null
): GroupCallStatus {
  const values = Backups.GroupCall.State;

  if (state == null) {
    return GroupCallStatus.GenericGroupCall;
  }

  if (state === values.GENERIC) {
    return GroupCallStatus.GenericGroupCall;
  }
  if (state === values.OUTGOING_RING) {
    return GroupCallStatus.OutgoingRing;
  }
  if (state === values.RINGING) {
    return GroupCallStatus.Ringing;
  }
  if (state === values.JOINED) {
    return GroupCallStatus.Joined;
  }
  if (state === values.ACCEPTED) {
    return GroupCallStatus.Accepted;
  }
  if (state === values.MISSED) {
    return GroupCallStatus.Missed;
  }
  if (state === values.MISSED_NOTIFICATION_PROFILE) {
    return GroupCallStatus.MissedNotificationProfile;
  }
  if (state === values.DECLINED) {
    return GroupCallStatus.Declined;
  }

  return GroupCallStatus.GenericGroupCall;
}

function fromIndividualCallDirectionProto(
  direction: Backups.IndividualCall.Direction | undefined | null
): CallDirection {
  const values = Backups.IndividualCall.Direction;

  if (direction == null) {
    return CallDirection.Unknown;
  }
  if (direction === values.INCOMING) {
    return CallDirection.Incoming;
  }
  if (direction === values.OUTGOING) {
    return CallDirection.Outgoing;
  }

  return CallDirection.Unknown;
}

function fromIndividualCallTypeProto(
  type: Backups.IndividualCall.Type | undefined | null
): CallType {
  const values = Backups.IndividualCall.Type;

  if (type == null) {
    return CallType.Unknown;
  }
  if (type === values.AUDIO_CALL) {
    return CallType.Audio;
  }
  if (type === values.VIDEO_CALL) {
    return CallType.Video;
  }

  return CallType.Unknown;
}

function fromIndividualCallStateProto(
  status: Backups.IndividualCall.State | undefined | null
): DirectCallStatus {
  const values = Backups.IndividualCall.State;

  if (status == null) {
    return DirectCallStatus.Unknown;
  }
  if (status === values.ACCEPTED) {
    return DirectCallStatus.Accepted;
  }
  if (status === values.NOT_ACCEPTED) {
    return DirectCallStatus.Declined;
  }
  if (status === values.MISSED) {
    return DirectCallStatus.Missed;
  }
  if (status === values.MISSED_NOTIFICATION_PROFILE) {
    return DirectCallStatus.MissedNotificationProfile;
  }

  return DirectCallStatus.Unknown;
}

function fromAdHocCallStateProto(
  status: Backups.AdHocCall.State | undefined | null
): AdhocCallStatus {
  const values = Backups.AdHocCall.State;

  if (status == null) {
    return AdhocCallStatus.Unknown;
  }
  if (status === values.GENERIC) {
    return AdhocCallStatus.Generic;
  }

  return AdhocCallStatus.Unknown;
}

function fromCallLinkRestrictionsProto(
  restrictions: Backups.CallLink.Restrictions | undefined | null
): CallLinkRestrictions {
  const values = Backups.CallLink.Restrictions;

  if (restrictions == null) {
    return CallLinkRestrictions.Unknown;
  }
  if (restrictions === values.NONE) {
    return CallLinkRestrictions.None;
  }
  if (restrictions === values.ADMIN_APPROVAL) {
    return CallLinkRestrictions.AdminApproval;
  }

  return CallLinkRestrictions.Unknown;
}
