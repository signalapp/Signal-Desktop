// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import {
  BackupLevel,
  ReceiptCredentialPresentation,
} from '@signalapp/libsignal-client/zkgroup.js';
import { v7 as generateUuid } from 'uuid';
import pMap from 'p-map';
import { Writable } from 'node:stream';
import lodash from 'lodash';
import { CallLinkRootKey } from '@signalapp/ringrtc';

import { Backups, SignalService } from '../../protobuf/index.std.ts';
import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import {
  AttachmentDownloadSource,
  type StoryDistributionWithMembersType,
  type IdentityKeyType,
} from '../../sql/Interface.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { GiftBadgeStates } from '../../types/GiftBadgeStates.std.ts';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories.std.ts';
import type { AciString, ServiceIdString } from '../../types/ServiceId.std.ts';
import * as LinkPreview from '../../types/LinkPreview.std.ts';
import {
  fromAciObject,
  fromPniObject,
  fromServiceIdObject,
} from '../../types/ServiceId.std.ts';
import { isStoryDistributionId } from '../../types/StoryDistributionId.std.ts';
import * as Errors from '../../types/errors.std.ts';
import { PaymentEventKind } from '../../types/Payment.std.ts';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent.std.ts';
import {
  ContactFormType,
  AddressType as ContactAddressType,
} from '../../types/EmbeddedContact.std.ts';
import {
  STICKERPACK_ID_BYTE_LEN,
  STICKERPACK_KEY_BYTE_LEN,
  createPacksFromBackup,
  type StickerPackPointerType,
} from '../../types/Stickers.preload.ts';
import type {
  ConversationColorType,
  CustomColorsItemType,
  CustomColorType,
  CustomColorDataType,
} from '../../types/Colors.std.ts';
import { SEALED_SENDER } from '../../types/SealedSender.std.ts';
import type {
  ConversationAttributesType,
  CustomError,
  MessageAttributesType,
  MessageReactionType,
  EditHistoryType,
  QuotedMessageType,
} from '../../model-types.d.ts';
import { assertDev, strictAssert } from '../../util/assert.std.ts';
import { upgradeMessageSchema } from '../../util/migrations.preload.ts';
import {
  getCheckedTimestampFromLong,
  getCheckedTimestampOrUndefinedFromLong,
  getTimestampOrUndefinedFromLong,
} from '../../util/timestampLongUtils.std.ts';
import { MAX_SAFE_DATE } from '../../util/timestamp.std.ts';
import { DurationInSeconds, SECOND } from '../../util/durations/index.std.ts';
import { calculateExpirationTimestamp } from '../../util/expirationTimer.std.ts';
import { dropNull } from '../../util/dropNull.std.ts';
import {
  deriveGroupID,
  deriveGroupSecretParams,
  deriveGroupPublicParams,
  deriveAccessKeyFromProfileKey,
} from '../../util/zkgroup.node.ts';
import { incrementMessageCounter } from '../../util/incrementMessageCounter.preload.ts';
import { generateMessageId } from '../../util/generateMessageId.node.ts';
import { isAciString } from '../../util/isAciString.std.ts';
import { PhoneNumberDiscoverability } from '../../util/phoneNumberDiscoverability.std.ts';
import { PhoneNumberSharingMode } from '../../types/PhoneNumberSharingMode.std.ts';
import { bytesToUuid } from '../../util/uuidToBytes.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { SendStatus } from '../../messages/MessageSendState.std.ts';
import type { SendStateByConversationId } from '../../messages/MessageSendState.std.ts';
import { SeenStatus } from '../../MessageSeenStatus.std.ts';
import { constantTimeEqual } from '../../Crypto.node.ts';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.ts';
import * as Bytes from '../../Bytes.std.ts';
import { BACKUP_VERSION, WALLPAPER_TO_BUBBLE_COLOR } from './constants.std.ts';
import { UnsupportedBackupVersion } from './errors.std.ts';
import type {
  AboutMe,
  BackupImportOptions,
  LocalChatStyle,
} from './types.std.ts';
import { getBackupMediaRootKey } from './crypto.preload.ts';
import type { GroupV2ChangeDetailType } from '../../types/groups.std.ts';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads.preload.ts';
import { isNotNil } from '../../util/isNotNil.std.ts';
import { isGroup } from '../../util/whatTypeOfConversation.dom.ts';
import { rgbIntToHSL } from '../../util/rgbToHSL.std.ts';
import {
  convertBackupMessageAttachmentToAttachment,
  convertFilePointerToAttachment,
} from './util/filePointers.preload.ts';
import { trimMessageWhitespace } from '../../types/BodyRange.std.ts';
import { filterAndClean } from '../../util/BodyRange.node.ts';
import {
  APPLICATION_OCTET_STREAM,
  stringToMIMEType,
} from '../../types/MIME.std.ts';
import { groupAvatarJobQueue } from '../../jobs/groupAvatarJobQueue.preload.ts';
import { AttachmentDownloadManager } from '../../jobs/AttachmentDownloadManager.preload.ts';
import {
  AdhocCallStatus,
  CallDirection,
  CallMode,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../types/CallDisposition.std.ts';
import type { CallHistoryDetails } from '../../types/CallDisposition.std.ts';
import {
  CallLinkRestrictions,
  isCallLinkAdmin,
} from '../../types/CallLink.std.ts';
import type { CallLinkType } from '../../types/CallLink.std.ts';
import type { RawBodyRange } from '../../types/BodyRange.std.ts';
import {
  fromAdminKeyBytes,
  toCallHistoryFromUnusedCallLink,
} from '../../util/callLinks.std.ts';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc.node.ts';
import { loadAllAndReinitializeRedux } from '../allLoaders.preload.ts';
import {
  startBackupMediaDownload,
  resetBackupMediaDownloadStats,
} from '../../util/backupMediaDownload.preload.ts';
import {
  getEnvironment,
  isTestEnvironment,
  isTestOrMockEnvironment,
} from '../../environment.std.ts';
import { hasAttachmentDownloads } from '../../util/hasAttachmentDownloads.std.ts';
import { isAdhoc, isNightly } from '../../util/version.std.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import { isConversationAccepted } from '../../util/isConversationAccepted.preload.ts';
import { saveBackupsSubscriberData } from '../../util/backupSubscriptionData.preload.ts';
import { postSaveUpdates } from '../../util/cleanup.preload.ts';
import type { LinkPreviewType } from '../../types/message/LinkPreviews.std.ts';
import { MessageModel } from '../../models/messages.preload.ts';
import {
  DEFAULT_PROFILE_COLOR,
  fromDayOfWeekArray,
  type NotificationProfileType,
} from '../../types/NotificationProfile.std.ts';
import { normalizeNotificationProfileId } from '../../types/NotificationProfile-node.node.ts';
import { updateBackupMediaDownloadProgress } from '../../util/updateBackupMediaDownloadProgress.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { ChatFolderType } from '../../types/ChatFolder.std.ts';
import type { ChatFolderId, ChatFolder } from '../../types/ChatFolder.std.ts';
import { expiresTooSoonForBackup } from './util/expiration.std.ts';
import { getPinnedMessagesLimit } from '../../util/pinnedMessages.dom.ts';
import type { PinnedMessageParams } from '../../types/PinnedMessage.std.ts';
import type { ThemeType } from '../../util/preload.preload.ts';
import { toNumber } from '../../util/toNumber.std.ts';
import { isKnownProtoEnumMember } from '../../util/isKnownProtoEnumMember.std.ts';

const { isNumber } = lodash;

const log = createLogger('import');

const MAX_CONCURRENCY = 10;

const SAVE_MESSAGE_BATCH_SIZE = 10000;

type ChatItemParseResult = {
  message: Partial<MessageAttributesType>;
  additionalMessages: Array<Partial<MessageAttributesType>>;
};

function phoneToContactFormType(
  type?: Backups.ContactAttachment.Phone['type']
): ContactFormType {
  const { Type } = Backups.ContactAttachment.Phone;
  if (!isKnownProtoEnumMember(Type, type)) {
    return ContactFormType.HOME;
  }
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
  type?: Backups.ContactAttachment.Email['type']
): ContactFormType {
  const { Type } = Backups.ContactAttachment.Email;
  if (!isKnownProtoEnumMember(Type, type)) {
    return ContactFormType.HOME;
  }
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
  type?: Backups.ContactAttachment.PostalAddress['type']
): ContactAddressType {
  const { Type } = Backups.ContactAttachment.PostalAddress;
  if (!isKnownProtoEnumMember(Type, type)) {
    return ContactAddressType.HOME;
  }
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
  readonly #options: BackupImportOptions;
  readonly #now = Date.now();
  #parsedBackupInfo = false;
  #logId = 'BackupImportStream(unknown)';
  #aboutMe: AboutMe | undefined;

  readonly #recipientIdToConvo = new Map<bigint, ConversationAttributesType>();

  readonly #recipientIdToCallLink = new Map<bigint, CallLinkType>();
  readonly #adminCallLinksToHasCall = new Map<CallLinkType, boolean>();

  readonly #chatIdToConvo = new Map<bigint, ConversationAttributesType>();

  readonly #conversations = new Map<string, ConversationAttributesType>();

  readonly #identityKeys = new Map<ServiceIdString, IdentityKeyType>();

  readonly #saveMessageBatch = new Map<
    MessageAttributesType,
    Promise<MessageAttributesType>
  >();

  #flushMessagesPromise: Promise<void> | undefined;
  readonly #stickerPacks = new Array<StickerPackPointerType>();
  #ourConversation?: ConversationAttributesType;
  readonly #pinnedConversations = new Array<[number, string]>();
  readonly #customColorById = new Map<number, CustomColorDataType>();
  #releaseNotesRecipientId: bigint | undefined;
  #releaseNotesChatId: bigint | undefined;
  readonly #pinnedMessages: Array<PinnedMessageParams> = [];
  #frameErrorCount = 0;
  #backupTier: BackupLevel | undefined;

  private constructor(options: BackupImportOptions) {
    super({ objectMode: true });
    this.#options = options;
  }

  public static async create(
    options: BackupImportOptions
  ): Promise<BackupImportStream> {
    await AttachmentDownloadManager.stop();
    await DataWriter.removeAllBackupAttachmentDownloadJobs();
    await resetBackupMediaDownloadStats();

    return new BackupImportStream(options);
  }

  override async _write(
    data: Buffer<ArrayBuffer>,
    _enc: BufferEncoding,
    done: (error?: Error) => void
  ): Promise<void> {
    try {
      if (!this.#parsedBackupInfo) {
        const info = Backups.BackupInfo.decode(data);
        this.#parsedBackupInfo = true;

        this.#logId = `BackupImport.run(${info.backupTimeMs})`;

        log.info(`${this.#logId}: got BackupInfo`);

        if (info.version !== BACKUP_VERSION) {
          throw new UnsupportedBackupVersion(info.version);
        }

        if (Bytes.isEmpty(info.mediaRootBackupKey)) {
          throw new Error('Missing mediaRootBackupKey');
        }

        await itemStorage.put(
          'restoredBackupFirstAppVersion',
          info.firstAppVersion
        );

        const theirKey = info.mediaRootBackupKey;
        const ourKey = getBackupMediaRootKey().serialize();
        if (!constantTimeEqual(theirKey, ourKey)) {
          // Use root key from integration test
          if (isTestEnvironment(getEnvironment())) {
            await itemStorage.put(
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
        // oxlint-disable-next-line no-await-in-loop
        await this.#flushMessagesPromise;
      }
      await this.#flushMessages();
      await this.#flushConversations();
      log.info(`${this.#logId}: flushed messages and conversations`);

      // Save pinned messages after messages
      const pinnedMessageLimit = getPinnedMessagesLimit();
      const sortedPinnedMessages = this.#pinnedMessages.toSorted((a, b) => {
        return a.pinnedAt - b.pinnedAt;
      });
      for (const params of sortedPinnedMessages) {
        try {
          // oxlint-disable-next-line no-await-in-loop
          await DataWriter.appendPinnedMessage(pinnedMessageLimit, params);
        } catch (error) {
          log.error(
            `${this.#logId}: failed to append pinned message`,
            Errors.toLogFormat(error)
          );
        }
      }

      // Store sticker packs and schedule downloads
      await createPacksFromBackup(this.#stickerPacks);

      // Add placeholder call history for unused admin call links to show in calls tab
      for (const [callLink, hasCall] of this.#adminCallLinksToHasCall) {
        if (!hasCall) {
          const callHistory = toCallHistoryFromUnusedCallLink(callLink);
          // oxlint-disable-next-line no-await-in-loop
          await this.#saveCallHistory(callHistory);
        }
      }

      // Reset and reload conversations and storage again
      window.ConversationController.setReadOnly(false);
      window.ConversationController.reset();

      await window.ConversationController.load();
      await window.ConversationController.checkForConflicts();

      itemStorage.reset();
      await itemStorage.fetch();

      // Load identity keys we just saved.
      await signalProtocolStore.hydrateCaches();

      // Load all data into redux (need to do this before updating a
      // conversation's last message, which uses redux selectors)
      await loadAllAndReinitializeRedux();

      const allConversations = window.ConversationController.getAll().sort(
        (convoA, convoB) => {
          if (convoA.get('isPinned')) {
            return -1;
          }
          if (convoB.get('isPinned')) {
            return 1;
          }
          return (
            (convoB.get('active_at') ?? 0) - (convoA.get('active_at') ?? 0)
          );
        }
      );

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
              `${this.#logId}: failed to update conversation's last message ${Errors.toLogFormat(error)}`
            );
          }
        },
        { concurrency: MAX_CONCURRENCY }
      );

      // Schedule group avatar download.
      await pMap(
        allConversations,
        async conversation => {
          if (this.#options.type === 'cross-client-integration-test') {
            return;
          }
          if (
            !isGroup(conversation.attributes) ||
            !conversation.get('remoteAvatarUrl')
          ) {
            return;
          }
          await groupAvatarJobQueue.add({
            conversationId: conversation.get('id'),
            newAvatarUrl: conversation.get('remoteAvatarUrl'),
          });
        },
        { concurrency: MAX_CONCURRENCY }
      );

      await itemStorage.put(
        'pinnedConversationIds',
        this.#pinnedConversations
          .sort(([a], [b]) => {
            return a - b;
          })
          .map(([, id]) => id)
      );

      await updateBackupMediaDownloadProgress(
        DataReader.getBackupAttachmentDownloadProgress
      );

      if (
        this.#options.type !== 'cross-client-integration-test' &&
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
    const { item } = frame;
    strictAssert(item, `${this.#logId}: Missing Frame.item`);

    if (item.account) {
      await this.#fromAccount(item.account);

      // We run this outside of try catch below because failure to restore
      // the account data is fatal.
      return;
    }

    try {
      if (item.recipient) {
        const { recipient } = item;
        strictAssert(recipient.id != null, 'Recipient must have an id');

        const { destination } = recipient;
        strictAssert(destination, 'Missing Recipient.destination');

        let convo: ConversationAttributesType;
        if (destination.contact) {
          convo = await this.#fromContact(destination.contact);
        } else if (destination.releaseNotes) {
          strictAssert(
            this.#releaseNotesRecipientId == null,
            'Duplicate release notes recipient'
          );
          this.#releaseNotesRecipientId = recipient.id;

          // Not yet supported
          return;
        } else if (destination.self) {
          convo = this.#fromSelf(destination.self);
        } else if (destination.group) {
          convo = await this.#fromGroup(destination.group);
        } else if (destination.distributionList) {
          await this.#fromDistributionList(destination.distributionList);

          // Not a conversation
          return;
        } else if (destination.callLink) {
          await this.#fromCallLink(recipient.id, destination.callLink);

          // Not a conversation
          return;
        } else {
          log.warn(`${this.#logId}: unsupported recipient destination`);
          throw new Error('Unsupported recipient destination');
        }

        if (convo !== this.#ourConversation) {
          await this.#saveConversation(convo);
        }

        this.#recipientIdToConvo.set(recipient.id, convo);
      } else if (item.chat) {
        await this.#fromChat(item.chat);
      } else if (item.chatItem) {
        if (!aboutMe) {
          throw new Error(
            'processFrame: Processing a chatItem frame, but no aboutMe data!'
          );
        }

        await this.#fromChatItem(item.chatItem, { aboutMe });
      } else if (item.stickerPack) {
        await this.#fromStickerPack(item.stickerPack);
      } else if (item.adHocCall) {
        await this.#fromAdHocCall(item.adHocCall);
      } else if (item.notificationProfile) {
        await this.#fromNotificationProfile(item.notificationProfile);
      } else if (item.chatFolder) {
        await this.#fromChatFolder(item.chatFolder);
      } else {
        log.warn(
          // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions
          `${this.#logId}: unknown unsupported frame item ${frame.item}`
        );
        throw new Error('Unknown unsupported frame type');
      }
    } catch (error) {
      this.#frameErrorCount += 1;
      log.error(
        // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions
        `${this.#logId}: failed to process a frame ${frame.item}, ${Errors.toLogFormat(error)}`
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
        // oxlint-disable-next-line no-await-in-loop
        await this.#flushMessagesPromise;
      }
      this.#flushMessagesPromise = this.#flushMessages();
    }
  }

  async #safeUpgradeMessage(
    attributes: MessageAttributesType
  ): Promise<MessageAttributesType> {
    try {
      return await upgradeMessageSchema(attributes);
    } catch (error) {
      log.error(
        `${this.#logId}: failed to migrate a message ${attributes.sent_at}, ${Errors.toLogFormat(error)}`
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
        // oxlint-disable-next-line no-await-in-loop
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
          const attachmentsAreLikelyExpired = expiresTooSoonForBackup({
            messageExpiresAt: calculateExpirationTimestamp(attributes) ?? null,
          });

          attachmentDownloadJobPromises.push(
            queueAttachmentDownloads(model, {
              source:
                this.#isMediaEnabledBackup() && !attachmentsAreLikelyExpired
                  ? AttachmentDownloadSource.BACKUP_IMPORT_WITH_MEDIA
                  : AttachmentDownloadSource.BACKUP_IMPORT_NO_MEDIA,
              isManualDownload: false,
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
    svrPin,
    androidSpecificSettings,
    bioText,
    bioEmoji,
    keyTransparencyData,
  }: Backups.AccountData): Promise<void> {
    strictAssert(this.#ourConversation === undefined, 'Duplicate AccountData');
    const me = {
      ...window.ConversationController.getOurConversationOrThrow().attributes,
    };
    this.#ourConversation = me;

    strictAssert(Bytes.isNotEmpty(profileKey), 'Missing profile key');
    await itemStorage.put('profileKey', profileKey);
    this.#ourConversation.profileKey = Bytes.toBase64(profileKey);
    await this.#updateConversation(this.#ourConversation);

    if (username != null) {
      me.username = username;
    }

    if (usernameLink != null) {
      const { entropy, serverId, color } = usernameLink;
      if (Bytes.isNotEmpty(entropy) && Bytes.isNotEmpty(serverId)) {
        await itemStorage.put('usernameLink', {
          entropy,
          serverId,
        });
      }

      // Same numeric value, no conversion needed
      await itemStorage.put(
        'usernameLinkColor',
        isKnownProtoEnumMember(Backups.AccountData.UsernameLink.Color, color)
          ? color
          : 0
      );
    }

    if (givenName != null) {
      me.profileName = givenName;
    }
    if (familyName != null) {
      me.profileFamilyName = familyName;
    }
    if (bioText != null) {
      me.about = bioText;
    }
    if (bioEmoji != null) {
      me.aboutEmoji = bioEmoji;
    }
    if (Bytes.isNotEmpty(keyTransparencyData)) {
      const ourAci = this.#ourConversation?.serviceId;
      strictAssert(
        isAciString(ourAci),
        'Must have our aci for Key Transparency data'
      );

      await DataWriter.setKTAccountData(ourAci, keyTransparencyData);
    }
    if (avatarUrlPath != null) {
      await itemStorage.put('avatarUrl', avatarUrlPath);
    }
    if (donationSubscriberData != null) {
      const { subscriberId, currencyCode, manuallyCancelled } =
        donationSubscriberData;
      if (Bytes.isNotEmpty(subscriberId)) {
        await itemStorage.put('subscriberId', subscriberId);
      }
      if (currencyCode != null) {
        await itemStorage.put('subscriberCurrencyCode', currencyCode);
      }
      if (manuallyCancelled != null) {
        await itemStorage.put(
          'donorSubscriptionManuallyCancelled',
          manuallyCancelled
        );
      }
    }
    if (isTestOrMockEnvironment()) {
      // Only relevant for tests
      await itemStorage.put('androidSpecificSettings', androidSpecificSettings);
    }

    await saveBackupsSubscriberData(backupsSubscriberData);

    await itemStorage.put(
      'read-receipt-setting',
      accountSettings?.readReceipts === true
    );
    await itemStorage.put(
      'sealedSenderIndicators',
      accountSettings?.sealedSenderIndicators === true
    );
    await itemStorage.put(
      'typingIndicators',
      accountSettings?.typingIndicators === true
    );
    await itemStorage.put(
      'linkPreviews',
      accountSettings?.linkPreviews === true
    );
    await itemStorage.put(
      'preferContactAvatars',
      accountSettings?.preferContactAvatars === true
    );
    if (accountSettings?.universalExpireTimerSeconds) {
      await itemStorage.put(
        'universalExpireTimer',
        accountSettings.universalExpireTimerSeconds
      );
    }
    await itemStorage.put(
      'displayBadgesOnProfile',
      accountSettings?.displayBadgesOnProfile === true
    );
    await itemStorage.put(
      'keepMutedChatsArchived',
      accountSettings?.keepMutedChatsArchived === true
    );
    await itemStorage.put(
      'hasSetMyStoriesPrivacy',
      accountSettings?.hasSetMyStoriesPrivacy === true
    );
    await itemStorage.put(
      'hasViewedOnboardingStory',
      accountSettings?.hasViewedOnboardingStory === true
    );
    await itemStorage.put(
      'hasStoriesDisabled',
      accountSettings?.storiesDisabled === true
    );
    await itemStorage.put(
      'hasKeyTransparencyDisabled',
      accountSettings?.allowAutomaticKeyVerification !== true
    );

    // an undefined value for storyViewReceiptsEnabled is semantically different from
    // false: it causes us to fallback to `read-receipt-setting`
    await itemStorage.put(
      'storyViewReceiptsEnabled',
      accountSettings?.storyViewReceiptsEnabled ?? undefined
    );

    await itemStorage.put(
      'hasCompletedUsernameOnboarding',
      accountSettings?.hasCompletedUsernameOnboarding === true
    );
    await itemStorage.put(
      'hasSeenGroupStoryEducationSheet',
      accountSettings?.hasSeenGroupStoryEducationSheet === true
    );
    await itemStorage.put(
      'hasSeenAdminDeleteEducationDialog',
      accountSettings?.hasSeenAdminDeleteEducationDialog === true
    );
    await itemStorage.put(
      'preferredReactionEmoji',
      accountSettings?.preferredReactionEmoji || []
    );
    if (svrPin) {
      await itemStorage.put('svrPin', svrPin);
    }

    await window.Events.setThemeSetting(
      toThemeSetting(accountSettings?.appTheme)
    );

    if (isTestOrMockEnvironment()) {
      // Only relevant for tests
      await itemStorage.put(
        'optimizeOnDeviceStorage',
        accountSettings?.optimizeOnDeviceStorage === true
      );
      await itemStorage.put(
        'pinReminders',
        dropNull(accountSettings?.pinReminders)
      );
      await itemStorage.put(
        'screenLockTimeoutMinutes',
        dropNull(accountSettings?.screenLockTimeoutMinutes)
      );

      await itemStorage.put(
        'callsUseLessDataSetting',
        accountSettings?.callsUseLessDataSetting
      );
      await itemStorage.put(
        'allowSealedSenderFromAnyone',
        accountSettings?.allowSealedSenderFromAnyone
      );

      const autoDownload = accountSettings?.autoDownloadSettings;
      if (autoDownload) {
        await itemStorage.put('auto-download-attachment-primary', {
          photos: parseAutoDownloadOption(autoDownload?.images),
          audio: parseAutoDownloadOption(autoDownload?.audio),
          videos: parseAutoDownloadOption(autoDownload?.video),
          documents: parseAutoDownloadOption(autoDownload?.documents),
        });
      }
    }

    const backupTier = toBackupLevel(accountSettings?.backupTier);
    if (backupTier != null) {
      this.#backupTier = backupTier;
      await itemStorage.put('backupTier', backupTier);
    }

    await itemStorage.put(
      'sealedSenderIndicators',
      accountSettings?.sealedSenderIndicators === true
    );
    await itemStorage.put(
      'sent-media-quality',
      accountSettings?.defaultSentMediaQuality ===
        Backups.AccountData.SentMediaQuality.HIGH
        ? 'high'
        : 'standard'
    );

    const { PhoneNumberSharingMode: BackupMode } = Backups.AccountData;
    switch (accountSettings?.phoneNumberSharingMode) {
      case BackupMode.EVERYBODY:
        await itemStorage.put(
          'phoneNumberSharingMode',
          PhoneNumberSharingMode.Everybody
        );
        break;
      case BackupMode.UNKNOWN:
      case BackupMode.NOBODY:
      default:
        await itemStorage.put(
          'phoneNumberSharingMode',
          PhoneNumberSharingMode.Nobody
        );
        break;
    }

    if (accountSettings?.notDiscoverableByPhoneNumber) {
      await itemStorage.put(
        'phoneNumberDiscoverability',
        PhoneNumberDiscoverability.NotDiscoverable
      );
    } else {
      await itemStorage.put(
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
      await itemStorage.put('defaultConversationColor', {
        color: defaultChatStyle.color,
        customColorData: defaultChatStyle.customColorData,
      });
    }

    if (defaultChatStyle.wallpaperPhotoPointer != null) {
      await itemStorage.put(
        'defaultWallpaperPhotoPointer',
        defaultChatStyle.wallpaperPhotoPointer
      );
    }
    if (defaultChatStyle.wallpaperPreset != null) {
      await itemStorage.put(
        'defaultWallpaperPreset',
        defaultChatStyle.wallpaperPreset
      );
    }
    if (defaultChatStyle.dimWallpaperInDarkMode != null) {
      await itemStorage.put(
        'defaultDimWallpaperInDarkMode',
        defaultChatStyle.dimWallpaperInDarkMode
      );
    }
    if (defaultChatStyle.autoBubbleColor != null) {
      await itemStorage.put(
        'defaultAutoBubbleColor',
        defaultChatStyle.autoBubbleColor
      );
    }

    await this.#updateConversation(me);
  }

  #fromSelf(self: Backups.Self): ConversationAttributesType {
    strictAssert(this.#ourConversation != null, 'Missing account data');
    const convo = this.#ourConversation;

    if (self.avatarColor != null) {
      convo.color = fromAvatarColor(self.avatarColor);
      convo.colorFromPrimary = parseAvatarColorFromPrimary(self.avatarColor);
    }

    return convo;
  }

  async #fromContact(
    contact: Backups.Contact
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
      accessKey: contact.profileKey
        ? Bytes.toBase64(deriveAccessKeyFromProfileKey(contact.profileKey))
        : undefined,
      sealedSender: SEALED_SENDER.UNKNOWN,
      profileSharing: contact.profileSharing,
      profileName: dropNull(contact.profileGivenName),
      profileFamilyName: dropNull(contact.profileFamilyName),
      systemGivenName: dropNull(contact.systemGivenName),
      systemFamilyName: dropNull(contact.systemFamilyName),
      systemNickname: dropNull(contact.systemNickname),
      hideStory: contact.hideStory,
      username: dropNull(contact.username),
      expireTimerVersion: 1,
      nicknameGivenName: dropNull(contact.nickname?.given),
      nicknameFamilyName: dropNull(contact.nickname?.family),
      note: dropNull(contact.note),
      color: fromAvatarColor(contact.avatarColor),
      colorFromPrimary: parseAvatarColorFromPrimary(contact.avatarColor),
    };

    if (serviceId != null && Bytes.isNotEmpty(contact.identityKey)) {
      const verified = parseIdentityState(contact.identityState);
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

    const { registration } = contact;
    if (registration?.notRegistered) {
      const timestamp = getCheckedTimestampOrUndefinedFromLong(
        registration.notRegistered.unregisteredTimestamp
      );
      attrs.discoveredUnregisteredAt = timestamp || this.#now;
      attrs.firstUnregisteredAt = timestamp || undefined;
    } else if (!registration?.registered) {
      log.error(
        'contact is neither registered nor unregistered; treating as registered',
        registration
      );
      this.#frameErrorCount += 1;
    }

    if (contact.blocked) {
      if (serviceId) {
        await itemStorage.blocked.addBlockedServiceId(serviceId);
      }
      if (e164) {
        await itemStorage.blocked.addBlockedNumber(e164);
      }
    }

    if (Bytes.isNotEmpty(contact.keyTransparencyData)) {
      strictAssert(
        isAciString(serviceId),
        'Must have contact aci for Key Transparency data'
      );

      await DataWriter.setKTAccountData(serviceId, contact.keyTransparencyData);
    }

    return attrs;
  }

  async #fromGroup(group: Backups.Group): Promise<ConversationAttributesType> {
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
      terminated,
    } = snapshot;

    const expirationTimerS =
      disappearingMessagesTimer?.content?.disappearingMessagesDuration;

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
      profileSharing: group.whitelisted,
      messageRequestResponseType: group.whitelisted
        ? SignalService.SyncMessage.MessageRequestResponse.Type.ACCEPT
        : undefined,
      hideStory: group.hideStory,
      storySendMode,
      avatar: avatarUrl
        ? {
            url: avatarUrl,
          }
        : undefined,
      remoteAvatarUrl: dropNull(avatarUrl),
      color: fromAvatarColor(group.avatarColor),
      colorFromPrimary: parseAvatarColorFromPrimary(group.avatarColor),

      // Snapshot
      name: dropNull(title?.content?.title)?.trim(),
      description: dropNull(description?.content?.descriptionText)?.trim(),
      expireTimer: expirationTimerS
        ? DurationInSeconds.fromSeconds(expirationTimerS)
        : undefined,
      expireTimerVersion: 1,
      accessControl: accessControl
        ? {
            attributes: parseGroupAccessRequired(accessControl.attributes),
            members: parseGroupAccessRequired(accessControl.members),
            addFromInviteLink: parseGroupAccessRequired(
              accessControl.addFromInviteLink
            ),
            memberLabel: parseGroupAccessRequired(accessControl.memberLabel),
          }
        : undefined,
      membersV2: members?.map(
        ({ joinedAtVersion, labelEmoji, labelString, role, userId }) => {
          strictAssert(Bytes.isNotEmpty(userId), 'Empty gv2 member userId');

          // Note that we deliberately ignore profile key since it has to be
          // in the Contact frame

          return {
            aci: fromAciObject(Aci.fromUuidBytes(userId)),
            joinedAtVersion: dropNull(joinedAtVersion) ?? 0,
            labelEmoji: dropNull(labelEmoji),
            labelString: dropNull(labelString),
            role: parseGroupMemberRole(role),
          };
        }
      ),
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
            ServiceId.parseFromServiceIdBinary(userId)
          );

          return {
            serviceId,
            role: parseGroupMemberRole(role),
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
          ServiceId.parseFromServiceIdBinary(userId)
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
      terminated: dropNull(terminated),
    };

    if (group.blocked) {
      await itemStorage.blocked.addBlockedGroup(groupId);
    }

    return attrs;
  }

  async #fromDistributionList(
    listItem: Backups.DistributionListItem
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

    const { item } = listItem;
    strictAssert(item, 'Missing DistributionListItem.item');

    if (item.deletionTimestamp == null) {
      const { distributionList: list } = item;
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
      strictAssert(
        isKnownProtoEnumMember(PrivacyMode, list.privacyMode),
        `Unknown privacy mode for distribution list: ${list.privacyMode}`
      );
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
        allowsReplies: list.allowReplies,
        isBlockList,
        members: (list.memberRecipientIds || []).map(recipientId => {
          const convo = this.#recipientIdToConvo.get(recipientId);
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

        deletedAtTimestamp: getCheckedTimestampFromLong(item.deletionTimestamp),
      };
    }

    await DataWriter.createNewStoryDistribution(result);
  }

  async #fromCallLink(
    recipientId: bigint,
    callLinkProto: Backups.CallLink
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

  async #fromChat(chat: Backups.Chat): Promise<void> {
    strictAssert(chat.id != null, 'chat must have an id');
    strictAssert(chat.recipientId != null, 'chat must have a recipientId');

    // Drop release notes chat
    if (this.#releaseNotesRecipientId === chat.recipientId) {
      strictAssert(
        this.#releaseNotesChatId == null,
        'Duplicate release notes chat'
      );
      this.#releaseNotesChatId = chat.id;
      return;
    }

    const conversation = this.#recipientIdToConvo.get(chat.recipientId);
    strictAssert(conversation !== undefined, 'unknown conversation');

    this.#chatIdToConvo.set(chat.id, conversation);

    if (isTestEnvironment(getEnvironment())) {
      conversation.test_chatFrameImportedFromBackup = true;
    }

    conversation.isArchived = chat.archived;
    conversation.isPinned = (chat.pinnedOrder || 0) !== 0;

    conversation.expireTimer =
      chat.expirationTimerMs && chat.expirationTimerMs !== 0n
        ? DurationInSeconds.fromMillis(toNumber(chat.expirationTimerMs))
        : undefined;
    conversation.expireTimerVersion = chat.expireTimerVersion || 1;

    if (
      chat.muteUntilMs != null &&
      toNumber(chat.muteUntilMs) >= MAX_SAFE_DATE
    ) {
      // Muted forever
      conversation.muteExpiresAt = Number.MAX_SAFE_INTEGER;
    } else {
      conversation.muteExpiresAt = getCheckedTimestampOrUndefinedFromLong(
        chat.muteUntilMs
      );
    }
    conversation.markedUnread = chat.markedUnread;
    conversation.dontNotifyForMentionsIfMuted =
      chat.dontNotifyForMentionsIfMuted;

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
    chatItem: Backups.ChatItem,
    options: { aboutMe: AboutMe }
  ): Promise<void> {
    const { aboutMe } = options;

    const timestamp = getCheckedTimestampOrUndefinedFromLong(
      chatItem?.dateSent
    );
    const logId = `fromChatItem(${timestamp})`;

    strictAssert(
      this.#ourConversation != null,
      `${logId}: AccountData missing`
    );

    strictAssert(chatItem.chatId != null, `${logId}: must have a chatId`);
    strictAssert(chatItem.dateSent != null, `${logId}: must have a dateSent`);
    strictAssert(timestamp, `${logId}: must have a timestamp`);

    if (this.#releaseNotesChatId === chatItem.chatId) {
      // Drop release notes messages
      return;
    }

    const chatConvo = this.#chatIdToConvo.get(chatItem.chatId);
    strictAssert(
      chatConvo !== undefined,
      `${logId}: chat conversation not found`
    );

    const authorConvo =
      chatItem.authorId != null
        ? this.#recipientIdToConvo.get(chatItem.authorId)
        : undefined;

    const { directionalDetails } = chatItem;
    strictAssert(
      directionalDetails,
      `${logId}: message must have directionalDetails`
    );

    const {
      patch: directionDetails,
      newActiveAt,
      unread,
    } = this.#fromDirectionDetails(chatItem, directionalDetails, timestamp);

    if (
      newActiveAt != null &&
      this.#shouldChatItemAffectChatListPresence(chatItem)
    ) {
      chatConvo.active_at = newActiveAt;
    }

    if (unread != null) {
      chatConvo.unreadCount = (chatConvo.unreadCount ?? 0) + 1;
    }

    const expirationStartTimestamp = getCheckedTimestampOrUndefinedFromLong(
      chatItem.expireStartDate
    );
    const expireTimer =
      chatItem.expiresInMs && chatItem.expiresInMs !== 0n
        ? DurationInSeconds.fromMillis(toNumber(chatItem.expiresInMs))
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
      type: directionalDetails.outgoing != null ? 'outgoing' : 'incoming',
      expirationStartTimestamp,
      expireTimer,
      sms: chatItem.sms ? true : undefined,
      ...directionDetails,
    };
    const additionalMessages: Array<MessageAttributesType> = [];

    if (directionalDetails.incoming) {
      strictAssert(
        authorConvo && this.#ourConversation.id !== authorConvo?.id,
        `${logId}: message with incoming field must be incoming`
      );
    } else if (directionalDetails.outgoing) {
      strictAssert(
        authorConvo && this.#ourConversation.id === authorConvo?.id,
        `${logId}: outgoing message must have outgoing field`
      );
    }

    const { item } = chatItem;
    strictAssert(item, `${logId}: chatItem must have item`);

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
        ...(await this.#fromViewOnceMessage(chatItem, item.viewOnceMessage)),
      };
    } else if (item.directStoryReplyMessage) {
      strictAssert(
        directionalDetails.directionless == null,
        'reply cannot be directionless'
      );
      let storyAuthorAci: AciString | undefined;
      if (directionalDetails.incoming) {
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
    } else if (item.poll) {
      const { poll } = item;

      const votesByVoter = new Map<
        string,
        {
          fromConversationId: string;
          optionIndexes: Array<number>;
          voteCount: number;
          timestamp: number;
        }
      >();

      poll.options?.forEach((option, optionIndex) => {
        option.votes?.forEach(vote => {
          if (vote.voterId == null) {
            return;
          }

          const conversation = this.#recipientIdToConvo.get(vote.voterId);
          if (!conversation) {
            log.warn(`${logId}: Poll vote has unknown voterId ${vote.voterId}`);
            return;
          }

          const conversationId = conversation.id;

          let voterRecord = votesByVoter.get(conversationId);
          if (!voterRecord) {
            voterRecord = {
              fromConversationId: conversationId,
              optionIndexes: [],
              voteCount: vote.voteCount ?? 1,
              timestamp,
            };
            votesByVoter.set(conversationId, voterRecord);
          }

          voterRecord.optionIndexes.push(optionIndex);
        });
      });

      const votes = Array.from(votesByVoter.values());

      attributes = {
        ...attributes,
        poll: {
          question: poll.question ?? '',
          options: poll.options?.map(option => option.option ?? '') ?? [],
          allowMultiple: poll.allowMultiple ?? false,
          votes: votes.length > 0 ? votes : undefined,
          terminatedAt: poll.hasEnded ? toNumber(chatItem.dateSent) : undefined,
        },
        reactions: this.#fromReactions(poll.reactions),
      };
    } else {
      const result = await this.#fromNonBubbleChatItem(chatItem, {
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

    if (chatItem.revisions?.length) {
      strictAssert(
        item.standardMessage || item.directStoryReplyMessage,
        `${logId}: Only standard or story reply message can have revisions`
      );

      const history = await this.#fromRevisions({
        mainMessage: attributes,
        revisions: chatItem.revisions,
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

    if (directionalDetails.outgoing != null) {
      chatConvo.sentMessageCount = (chatConvo.sentMessageCount ?? 0) + 1;
    } else if (directionalDetails.incoming != null) {
      chatConvo.messageCount = (chatConvo.messageCount ?? 0) + 1;
    }

    if (chatItem.pinDetails != null) {
      const { pinExpiry, pinnedAtTimestamp } = chatItem.pinDetails;
      strictAssert(pinnedAtTimestamp, 'Missing PinDetails.pinnedAtTimestamp');
      strictAssert(pinExpiry, 'Missing PinDetails.pinExpiry');

      const pinnedAt = toNumber(pinnedAtTimestamp);

      let expiresAt: number | null;
      if (pinExpiry.pinExpiresAtTimestamp != null) {
        expiresAt = toNumber(pinExpiry.pinExpiresAtTimestamp);
      } else {
        strictAssert(
          pinExpiry.pinNeverExpires,
          'pinDetails: pinNeverExpires should be true if theres no pinExpiresAtTimestamp'
        );
        expiresAt = null;
      }

      this.#pinnedMessages.push({
        conversationId: chatConvo.id,
        messageId: attributes.id,
        pinnedAt,
        expiresAt,
      });
    }

    await this.#updateConversation(chatConvo);
  }

  #fromDirectionDetails(
    item: Backups.ChatItem,
    directionalDetails: NonNullable<Backups.ChatItem['directionalDetails']>,
    timestamp: number
  ): {
    patch: Partial<MessageAttributesType>;
    newActiveAt?: number;
    unread?: boolean;
  } {
    const { outgoing, incoming, directionless } = directionalDetails;
    if (outgoing) {
      const sendStateByConversationId: SendStateByConversationId = {};

      const unidentifiedDeliveries = new Array<ServiceIdString>();
      const errors = new Array<CustomError>();

      let sendStatuses: Array<Backups.SendStatus | Backups.SendStatus.Params> =
        outgoing.sendStatus;
      if (!sendStatuses?.length) {
        // TODO: DESKTOP-8089
        // If this outgoing message was not sent to anyone, we add ourselves to
        // sendStateByConversationId and mark read. This is to match existing desktop
        // behavior.
        sendStatuses = [
          {
            recipientId: item.authorId,
            deliveryStatus: { read: { sealedSender: null } },
            timestamp: item.dateSent,
          },
        ];
      }

      for (const status of sendStatuses) {
        strictAssert(
          status.recipientId != null,
          'sendStatus recipient must have an id'
        );
        const target = this.#recipientIdToConvo.get(status.recipientId);
        strictAssert(
          target !== undefined,
          'status target conversation not found'
        );

        const { serviceId } = target;
        const { deliveryStatus } = status;
        strictAssert(deliveryStatus, 'sendStatus must have a deliveryStatus');

        let sendStatus: SendStatus;
        if (deliveryStatus.pending) {
          sendStatus = SendStatus.Pending;
        } else if (deliveryStatus.sent) {
          sendStatus = SendStatus.Sent;
          if (serviceId && deliveryStatus.sent.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (deliveryStatus.delivered) {
          sendStatus = SendStatus.Delivered;
          if (serviceId && deliveryStatus.delivered.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (deliveryStatus.read) {
          sendStatus = SendStatus.Read;
          if (serviceId && deliveryStatus.read.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (deliveryStatus.viewed) {
          sendStatus = SendStatus.Viewed;
          if (serviceId && deliveryStatus.viewed.sealedSender) {
            unidentifiedDeliveries.push(serviceId);
          }
        } else if (deliveryStatus.failed) {
          sendStatus = SendStatus.Failed;
          strictAssert(
            deliveryStatus.failed.reason != null,
            'Failure reason must exist'
          );
          strictAssert(
            isKnownProtoEnumMember(
              Backups.SendStatus.Failed.FailureReason,
              deliveryStatus.failed.reason
            ),
            `Unknown failure reason: ${deliveryStatus.failed.reason}`
          );
          switch (deliveryStatus.failed.reason) {
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
              throw missingCaseError(deliveryStatus.failed.reason);
          }
          // Desktop does not keep track of users we did not attempt to send to
        } else if (deliveryStatus.skipped) {
          sendStatus = SendStatus.Skipped;
        } else {
          log.error(
            // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions
            `${timestamp}: Unknown sendStatus received: ${status}, falling back to Pending`
          );
          // We fallback to pending for unknown send statuses
          sendStatus = SendStatus.Pending;
          this.#frameErrorCount += 1;
        }

        sendStateByConversationId[target.id] = {
          status: sendStatus,
          updatedAt:
            status.timestamp != null && status.timestamp !== 0n
              ? getCheckedTimestampFromLong(status.timestamp)
              : undefined,
        };
      }

      return {
        patch: {
          sendStateByConversationId,
          received_at_ms:
            getCheckedTimestampOrUndefinedFromLong(outgoing.dateReceived) ??
            timestamp,
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

      const unidentifiedDeliveryReceived = incoming.sealedSender;

      if (incoming.read) {
        return {
          patch: {
            readStatus: ReadStatus.Read,
            seenStatus: SeenStatus.Seen,
            hasUnreadPollVotes: false,
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
          hasUnreadPollVotes: false,
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
        hasUnreadPollVotes: false,
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
  #shouldChatItemAffectChatListPresence(chatItem: Backups.ChatItem): boolean {
    const { item } = chatItem;
    strictAssert(item, 'Missing chatItem.item');

    if (!item.updateMessage) {
      return true;
    }

    const { update } = item.updateMessage;
    strictAssert(update, 'Missing updateMessage.update');

    if (
      update.profileChange ||
      update.learnedProfileChange ||
      update.sessionSwitchover ||
      update.threadMerge
    ) {
      return false;
    }

    if (
      update.groupChange?.updates?.every(
        groupUpdate =>
          Boolean(groupUpdate.update?.groupMemberLeftUpdate) ||
          Boolean(groupUpdate.update?.groupV2MigrationUpdate)
      )
    ) {
      return false;
    }

    if (update.simpleUpdate) {
      strictAssert(
        isKnownProtoEnumMember(
          Backups.SimpleChatUpdate.Type,
          update.simpleUpdate.type
        ),
        `Unknown SimpleChatUpdate.Type: ${update.simpleUpdate.type}`
      );

      switch (update.simpleUpdate.type) {
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
          throw missingCaseError(update.simpleUpdate.type);
      }
    }

    return true;
  }

  async #fromStandardMessage({
    logId,
    data,
  }: {
    logId: string;
    data: Backups.StandardMessage;
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
        ? convertFilePointerToAttachment(data.longText, this.#options)
        : undefined,
      attachments: data.attachments?.length
        ? data.attachments
            .map(attachment =>
              convertBackupMessageAttachmentToAttachment(
                attachment,
                this.#options
              )
            )
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
    previews: Array<Backups.LinkPreview>;
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
            ? convertFilePointerToAttachment(preview.image, this.#options)
            : undefined,
        };
      })
      .filter(isNotNil);
  }

  async #fromViewOnceMessage(
    item: Backups.ChatItem,
    viewOnceMessage: Backups.ViewOnceMessage
  ): Promise<Partial<MessageAttributesType>> {
    const incoming = item.directionalDetails?.incoming;

    const { attachment, reactions } = viewOnceMessage;
    const result: Partial<MessageAttributesType> = {
      attachments: attachment
        ? [
            convertBackupMessageAttachmentToAttachment(
              attachment,
              this.#options
            ),
          ].filter(isNotNil)
        : undefined,
      reactions: this.#fromReactions(reactions),
      isViewOnce: true,
    };

    if (!result.attachments?.length) {
      result.isErased = true;

      // Only mark it viewed if the message is read. Non-link-and-sync backups do not
      // roundtrip view-once attachments, even if unread.
      if (incoming?.read) {
        result.readStatus = ReadStatus.Viewed;
      }
    }

    return result;
  }

  #fromDirectStoryReplyMessage(
    directStoryReplyMessage: Backups.DirectStoryReplyMessage,
    storyAuthorAci: AciString
  ): Partial<MessageAttributesType> {
    strictAssert(
      directStoryReplyMessage.reply,
      'directStoryReplyMessage.reply is missing'
    );
    const { textReply, emoji } = directStoryReplyMessage.reply;
    const { reactions } = directStoryReplyMessage;

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
        ? convertFilePointerToAttachment(textReply.longText, this.#options)
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
    revision: Backups.DirectStoryReplyMessage
  ): Promise<Partial<EditHistoryType>> {
    const textReply = revision.reply?.textReply;

    if (!textReply) {
      return {};
    }

    return {
      body: textReply.text?.body ?? undefined,
      bodyRanges: this.#fromBodyRanges(textReply.text),
      bodyAttachment: textReply.longText
        ? convertFilePointerToAttachment(textReply.longText, this.#options)
        : undefined,
    };
  }

  async #fromRevisions({
    mainMessage,
    revisions,
    logId,
  }: {
    mainMessage: MessageAttributesType;
    revisions: ReadonlyArray<Backups.ChatItem>;
    logId: string;
  }): Promise<Array<EditHistoryType>> {
    const result = await Promise.all(
      revisions
        .map(async rev => {
          strictAssert(
            rev.item?.standardMessage || rev.item?.directStoryReplyMessage,
            'Edit history on a message that does not support revisions'
          );

          strictAssert(
            rev.directionalDetails,
            'Edit history on a message that does not have directional details'
          );

          const timestamp = getCheckedTimestampFromLong(rev.dateSent);

          const {
            patch: {
              sendStateByConversationId,
              received_at_ms,
              serverTimestamp,
              readStatus,
              unidentifiedDeliveryReceived,
            },
          } = this.#fromDirectionDetails(
            rev,
            rev.directionalDetails,
            timestamp
          );

          const commonFields = {
            timestamp,
            received_at: incrementMessageCounter(),
            sendStateByConversationId,
            received_at_ms,
            serverTimestamp,
            readStatus,
            unidentifiedDeliveryReceived,
          };

          if (rev.item?.standardMessage) {
            return {
              ...(await this.#fromStandardMessage({
                logId,
                data: rev.item?.standardMessage,
              })),
              ...commonFields,
            };
          }

          if (rev.item?.directStoryReplyMessage) {
            return {
              ...(await this.#fromDirectStoryReplyRevision(
                rev.item?.directStoryReplyMessage
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

  async #fromQuote(quote: Backups.Quote): Promise<QuotedMessageType> {
    strictAssert(quote.authorId != null, 'quote must have an authorId');

    const authorConvo = this.#recipientIdToConvo.get(quote.authorId);
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
      isPoll: quote.type === Backups.Quote.Type.POLL ? true : undefined,
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
              ? convertFilePointerToAttachment(thumbnail.pointer, this.#options)
              : undefined,
          };
        }) ?? [],
    };
  }

  #fromBodyRanges(
    text: Backups.Text | null | undefined
  ): ReadonlyArray<RawBodyRange> | undefined {
    if (text == null) {
      return undefined;
    }
    const { bodyRanges } = text;
    if (!bodyRanges?.length) {
      return undefined;
    }

    return filterAndClean(
      bodyRanges.map((range): RawBodyRange => {
        const { start, length, associatedValue } = range;
        strictAssert(associatedValue, 'Misisng BodyRange.associatedValue');
        if (associatedValue.mentionAci) {
          const mentionAci: AciString = fromAciObject(
            Aci.parseFromServiceIdBinary(associatedValue.mentionAci)
          );
          return { start, length, mentionAci };
        }
        if (associatedValue.style != null) {
          strictAssert(
            isKnownProtoEnumMember(
              Backups.BodyRange.Style,
              associatedValue.style
            ),
            'Unexpected non-enum value'
          );
          return {
            start,
            length,
            style: associatedValue.style,
          };
        }
        throw missingCaseError(associatedValue);
      })
    );
  }

  #fromReactions(
    reactions: ReadonlyArray<Backups.Reaction> | null | undefined
  ): Array<MessageReactionType> | undefined {
    if (!reactions?.length) {
      return undefined;
    }
    return reactions
      .slice()
      .sort((a, b) => {
        if (a.sortOrder < b.sortOrder) {
          return -1;
        }
        if (a.sortOrder > b.sortOrder) {
          return 1;
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

        const authorConvo = this.#recipientIdToConvo.get(authorId);
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
    chatItem: Backups.ChatItem,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { timestamp } = options;
    const logId = `fromChatItemToNonBubble(${timestamp})`;

    const { item } = chatItem;
    strictAssert(item, 'Missing ChatItem.item');

    if (item.standardMessage) {
      throw new Error(`${logId}: Got chat item with standardMessage set!`);
    }
    if (item.contactMessage) {
      const { contact: details } = item.contactMessage;
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
                    avatar: convertFilePointerToAttachment(
                      avatar,
                      this.#options
                    ),
                    isProfile: false,
                  }
                : undefined,
            },
          ],
          reactions: this.#fromReactions(item.contactMessage.reactions),
        },
        additionalMessages: [],
      };
    }
    if (item.adminDeletedMessage) {
      strictAssert(
        item.adminDeletedMessage.adminId != null,
        'adminDeletedMessage: Missing adminId'
      );
      const adminConversation = this.#recipientIdToConvo.get(
        item.adminDeletedMessage.adminId
      );
      strictAssert(
        adminConversation != null,
        'adminDeletedMessage: Missing admin conversation'
      );
      strictAssert(
        isAciString(adminConversation.serviceId),
        'adminConversation: Missing serviceId'
      );

      return {
        message: {
          isErased: true,
          deletedForEveryone: true,
          deletedForEveryoneByAdminAci: adminConversation.serviceId,
        },
        additionalMessages: [],
      };
    }
    if (item.remoteDeletedMessage) {
      return {
        message: {
          isErased: true,
          deletedForEveryone: true,
        },
        additionalMessages: [],
      };
    }
    if (item.stickerMessage) {
      strictAssert(
        item.stickerMessage.sticker != null,
        'stickerMessage must have a sticker'
      );
      const {
        stickerMessage: {
          sticker: { emoji, packId, packKey, stickerId, data },
        },
      } = item;
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
            data: data
              ? convertFilePointerToAttachment(data, this.#options)
              : undefined,
          },
          reactions: this.#fromReactions(item.stickerMessage.reactions),
        },
        additionalMessages: [],
      };
    }
    if (item.paymentNotification) {
      const { paymentNotification: notification } = item;
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
                  )
                )
              : undefined,
          },
        },
        additionalMessages: [],
      };
    }
    if (item.giftBadge) {
      const { giftBadge } = item;
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
        giftBadge.receiptCredentialPresentation
      );

      return {
        message: {
          giftBadge: {
            receiptCredentialPresentation: Bytes.toBase64(
              giftBadge.receiptCredentialPresentation
            ),
            expiration: receipt.getReceiptExpirationTime() * SECOND,
            id: undefined,
            level: Number(receipt.getReceiptLevel()),
            state,
          },
        },
        additionalMessages: [],
      };
    }
    if (item.updateMessage) {
      return this.#fromChatItemUpdateMessage(item.updateMessage, options);
    }

    throw new Error(`${logId}: Message was missing all five message types`);
  }

  async #fromChatItemUpdateMessage(
    updateMessage: Backups.ChatUpdateMessage,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
      conversation: ConversationAttributesType;
      timestamp: number;
    }
  ): Promise<ChatItemParseResult | undefined> {
    const { aboutMe, author, conversation } = options;

    const { update } = updateMessage;
    strictAssert(update, 'Missing ChatUpdateMessage.update');

    if (update.groupChange) {
      return this.#fromGroupUpdateMessage(update.groupChange, options);
    }

    if (update.expirationTimerChange) {
      const { expiresInMs } = update.expirationTimerChange;

      let sourceServiceId = author?.serviceId;
      let source = author?.e164;
      if (!sourceServiceId) {
        sourceServiceId = aboutMe.aci;
        source = aboutMe.e164;
      }
      const expireTimer = DurationInSeconds.fromMillis(
        toNumber(expiresInMs) ?? 0
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

    if (update.simpleUpdate) {
      const message = await this.#fromSimpleUpdateMessage(
        update.simpleUpdate,
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

    if (update.profileChange) {
      const { newName, previousName: oldName } = update.profileChange;
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

    if (update.learnedProfileChange) {
      const { e164, username } = update.learnedProfileChange.previousName ?? {};
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
              e164: e164 && e164 !== 0n ? `+${e164}` : undefined,
              username: dropNull(username),
            },
          },
        },
        additionalMessages: [],
      };
    }

    if (update.threadMerge) {
      const { previousE164 } = update.threadMerge;
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

    if (update.sessionSwitchover) {
      const { e164 } = update.sessionSwitchover;
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

    if (update.groupCall) {
      const { groupId } = conversation;

      if (!isGroup(conversation)) {
        throw new Error('groupCall: Conversation is not a group!');
      }
      if (!groupId) {
        throw new Error('groupCall: No groupId available on conversation');
      }

      const {
        callId: callIdInt,
        state,
        ringerRecipientId,
        startedCallRecipientId,
        startedCallTimestamp,
        endedCallTimestamp,
        read,
      } = update.groupCall;

      const ringer =
        ringerRecipientId != null
          ? this.#recipientIdToConvo.get(ringerRecipientId)
          : undefined;
      const startedBy =
        startedCallRecipientId != null
          ? this.#recipientIdToConvo.get(startedCallRecipientId)
          : undefined;

      let callId: string;
      if (callIdInt != null && callIdInt !== 0n) {
        callId = callIdInt.toString();
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

    if (update.individualCall) {
      const {
        callId: callIdInt,
        type,
        direction: protoDirection,
        state,
        startedCallTimestamp,
        read,
      } = update.individualCall;

      let callId: string;
      if (callIdInt != null && callIdInt !== 0n) {
        callId = callIdInt.toString();
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

    if (update.pinMessage) {
      strictAssert(
        update.pinMessage.authorId != null,
        'pinMessage: Missing authorId'
      );
      const targetAuthor = this.#recipientIdToConvo.get(
        update.pinMessage.authorId
      );
      strictAssert(targetAuthor != null, 'pinMessage: Missing target author');
      const targetAuthorAci = targetAuthor.serviceId;
      strictAssert(
        isAciString(targetAuthorAci),
        'pinMessage: Target author missing aci'
      );

      strictAssert(
        update.pinMessage.targetSentTimestamp != null,
        'pinMessage: Missing targetSentTimestamp'
      );
      const targetSentTimestamp = toNumber(
        update.pinMessage.targetSentTimestamp
      );

      return {
        message: {
          type: 'pinned-message-notification',
          pinMessage: {
            targetAuthorAci,
            targetSentTimestamp,
          },
        },
        additionalMessages: [],
      };
    }

    if (update.pollTerminate) {
      const { targetSentTimestamp, question } = update.pollTerminate;

      return {
        message: {
          type: 'poll-terminate',
          pollTerminateNotification: {
            question,
            pollTimestamp: toNumber(targetSentTimestamp),
          },
        },
        additionalMessages: [],
      };
    }

    return undefined;
  }

  async #fromGroupUpdateMessage(
    groupChange: Backups.GroupChangeChatUpdate,
    options: {
      aboutMe: AboutMe;
      author?: ConversationAttributesType;
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

    updates?.forEach(updateItem => {
      const { update } = updateItem;
      strictAssert(update, 'Missing GroupChangeChatUpdate.Update.update');

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
          newPrivilege: parseGroupV2AccessLevel(accessLevel),
        });
      }
      if (update.groupMemberLabelAccessLevelChangeUpdate) {
        const { updaterAci, accessLevel } =
          update.groupMemberLabelAccessLevelChangeUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'access-member-label',
          newPrivilege: parseGroupV2AccessLevel(accessLevel),
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
          newPrivilege: parseGroupV2AccessLevel(accessLevel),
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
      if (update.groupTerminateChangeUpdate) {
        const { updaterAci } = update.groupTerminateChangeUpdate;
        if (updaterAci) {
          from = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }
        details.push({
          type: 'terminated',
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
            ServiceId.parseFromServiceIdBinary(inviteeServiceId)
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
        from = Bytes.isNotEmpty(inviteeAci)
          ? fromAciObject(Aci.fromUuidBytes(inviteeAci))
          : undefined;
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
        if (!invitees || invitees[0] == null) {
          throw new Error(
            `${logId}: groupInvitationRevokedUpdate had missing invitees list!`
          );
        }
        const firstInviter = invitees[0].inviterAci;
        const inviterAci =
          firstInviter &&
          invitees.every(invitee => invitee.inviterAci === firstInviter)
            ? fromAciObject(Aci.fromUuidBytes(firstInviter))
            : undefined;

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
              inviter: inviterAci,
            });
          } else {
            details.push({
              type: 'pending-remove-many',
              count: 1,
              inviter: inviterAci,
            });
          }
        } else {
          details.push({
            type: 'pending-remove-many',
            count: invitees.length,
            inviter: inviterAci,
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

        if (Bytes.isNotEmpty(updaterAci)) {
          sourceServiceId = fromAciObject(Aci.fromUuidBytes(updaterAci));
        }

        const expireTimer = expiresInMs
          ? DurationInSeconds.fromMillis(toNumber(expiresInMs))
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

    if (finalDetails.length === 0 && additionalMessages[0] != null) {
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
    simpleUpdate: Backups.SimpleChatUpdate,
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
          key_changed: isGroup(conversation) ? author?.serviceId : undefined,
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
  }: Backups.StickerPack): Promise<void> {
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
    recipientId,
    state,
    callTimestamp,
  }: Backups.AdHocCall): Promise<void> {
    let callId: string;
    if (toNumber(callIdLong)) {
      callId = callIdLong.toString();
    } else {
      // Legacy calls may not have a callId, so we generate one locally
      callId = generateUuid();
    }

    const logId = `fromAdhocCall(${callId.slice(-2)})`;

    strictAssert(callTimestamp, `${logId}: must have a valid timestamp`);
    strictAssert(recipientId != null, 'AdHocCall must have a recipientIdLong');

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

  async #fromNotificationProfile(incomingProfile: Backups.NotificationProfile) {
    const {
      id,
      name,
      emoji,
      color,
      createdAtMs,
      allowAllCalls,
      allowAllMentions,
      allowedMembers,
      scheduleEnabled,
      scheduleStartTime,
      scheduleEndTime,
      scheduleDaysEnabled,
    } = incomingProfile;
    strictAssert(name, 'notification profile must have a valid name');
    if (!id || !id.length) {
      log.warn('Dropping notification profile; it was missing an id');
      return;
    }

    const allowedMemberConversationIds: ReadonlyArray<string> | undefined =
      allowedMembers
        ?.map(recipientId => {
          const attributes = this.#recipientIdToConvo.get(recipientId);
          if (!attributes) {
            return undefined;
          }

          return attributes.id;
        })
        .filter(isNotNil);

    const profile: NotificationProfileType = {
      id: normalizeNotificationProfileId(Bytes.toHex(id), 'import', log),
      name,
      emoji: dropNull(emoji),
      color: dropNull(color) ?? DEFAULT_PROFILE_COLOR,
      createdAtMs: getCheckedTimestampOrUndefinedFromLong(createdAtMs) ?? 0,
      allowAllCalls,
      allowAllMentions,
      allowedMembers: new Set(allowedMemberConversationIds ?? []),
      scheduleEnabled: scheduleEnabled,
      scheduleStartTime: dropNull(scheduleStartTime),
      scheduleEndTime: dropNull(scheduleEndTime),
      scheduleDaysEnabled: parseScheduleDaysEnabled(scheduleDaysEnabled),
      deletedAtTimestampMs: undefined,
      storageNeedsSync: false,
      storageID: undefined,
      storageUnknownFields: undefined,
      storageVersion: undefined,
    };

    await DataWriter.createNotificationProfile(profile);
  }

  #chatFolderPositionCursor = 0;

  async #fromChatFolder(proto: Backups.ChatFolder): Promise<void> {
    if (proto.id == null || proto.id.length === 0) {
      log.warn('Dropping chat folder; it was missing an id');
      return;
    }
    const id = bytesToUuid(proto.id) as ChatFolderId | undefined;
    if (id == null) {
      log.warn('Dropping chat folder; invalid uuid bytes');
      return;
    }

    let folderType: ChatFolderType;
    if (proto.folderType === Backups.ChatFolder.FolderType.ALL) {
      folderType = ChatFolderType.ALL;
    } else if (proto.folderType === Backups.ChatFolder.FolderType.CUSTOM) {
      folderType = ChatFolderType.CUSTOM;
    } else {
      log.warn('Dropping chat folder; unknown folder type');
      return;
    }

    const position = this.#chatFolderPositionCursor;
    this.#chatFolderPositionCursor += 1;

    const includedRecipientIds = proto.includedRecipientIds ?? [];
    const excludedRecipientIds = proto.excludedRecipientIds ?? [];

    const chatFolder: ChatFolder = {
      id,
      name: proto.name ?? '',
      folderType,
      showOnlyUnread: proto.showOnlyUnread ?? false,
      showMutedChats: proto.showMutedChats ?? false,
      includeAllIndividualChats: proto.includeAllIndividualChats ?? false,
      includeAllGroupChats: proto.includeAllGroupChats ?? false,
      includedConversationIds: includedRecipientIds.map(recipientId => {
        const convo = this.#recipientIdToConvo.get(recipientId);
        strictAssert(convo != null, 'Missing chat folder included recipient');
        return convo.id;
      }),
      excludedConversationIds: excludedRecipientIds.map(recipientId => {
        const convo = this.#recipientIdToConvo.get(recipientId);
        strictAssert(convo != null, 'Missing chat folder included recipient');
        return convo.id;
      }),
      position,
      deletedAtTimestampMs: 0,
      storageID: null,
      storageVersion: null,
      storageUnknownFields: null,
      storageNeedsSync: false,
    };

    if (folderType === ChatFolderType.ALL) {
      await DataWriter.upsertAllChatsChatFolderFromSync(chatFolder);
    } else {
      await DataWriter.createChatFolder(chatFolder);
    }
  }

  async #fromCustomChatColors(
    customChatColors:
      | ReadonlyArray<Backups.ChatStyle.CustomChatColor>
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

    for (const customChatColor of customChatColors) {
      const { color } = customChatColor;

      const uuid = generateUuid();
      let value: CustomColorType;

      order.push(uuid);

      if (color?.solid) {
        value = {
          start: rgbIntToDesktopHSL(color.solid),
        };
      } else if (color?.gradient) {
        strictAssert(color.gradient != null, 'Either solid or gradient');
        strictAssert(color.gradient.colors != null, 'Missing gradient colors');

        const start = color.gradient.colors.at(0);
        const end = color.gradient.colors.at(-1);
        const backupAngle = color.gradient.angle;

        strictAssert(start != null, 'Missing start color');
        strictAssert(end != null, 'Missing end color');
        strictAssert(backupAngle != null, 'Missing angle');

        // Desktop uses a different angle convention than the backup proto. Our degrees
        // rotate in the opposite direction (sadly!) and our start is shifted by 90
        // degrees
        const desktopAngle = 360 - backupAngle - 90;

        value = {
          start: rgbIntToDesktopHSL(start),
          end: rgbIntToDesktopHSL(end),
          deg: (desktopAngle + 360) % 360,
        };
      } else {
        log.error(
          'CustomChatColor missing both solid and gradient fields, dropping'
        );
        this.#frameErrorCount += 1;
        continue;
      }

      customColors.colors[uuid] = value;
      this.#customColorById.set(toNumber(customChatColor.id) || 0, {
        id: uuid,
        value,
      });
    }

    await itemStorage.put('customColors', customColors);
  }

  #fromChatStyle(chatStyle: Backups.ChatStyle | null | undefined): Omit<
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

    let wallpaperPhotoPointer: Uint8Array<ArrayBuffer> | undefined;
    let wallpaperPreset: number | undefined;
    const dimWallpaperInDarkMode = dropNull(chatStyle.dimWallpaperInDarkMode);

    if (chatStyle.wallpaper?.wallpaperPhoto) {
      wallpaperPhotoPointer = Backups.FilePointer.encode(
        chatStyle.wallpaper.wallpaperPhoto
      );
    } else if (
      chatStyle.wallpaper?.wallpaperPreset != null &&
      isKnownProtoEnumMember(
        Backups.ChatStyle.WallpaperPreset,
        chatStyle.wallpaper.wallpaperPreset
      )
    ) {
      wallpaperPreset = chatStyle.wallpaper.wallpaperPreset;
    }

    let color: ConversationColorType | undefined;
    let customColorData: CustomColorDataType | undefined;
    let autoBubbleColor = false;
    if (chatStyle.bubbleColor?.autoBubbleColor) {
      autoBubbleColor = true;
      if (wallpaperPreset != null) {
        color = WALLPAPER_TO_BUBBLE_COLOR.get(wallpaperPreset);
      } else {
        color = undefined;
      }
    } else if (chatStyle.bubbleColor?.bubbleColorPreset != null) {
      const { BubbleColorPreset } = Backups.ChatStyle;

      switch (chatStyle.bubbleColor.bubbleColorPreset) {
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
    } else if (chatStyle.bubbleColor?.customColorId != null) {
      const entry = this.#customColorById.get(
        toNumber(chatStyle.bubbleColor.customColorId)
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

    // We only roundtrip wallpaper info in tests since it is not synced in storage service
    const shouldImportWallpaper = isTestOrMockEnvironment();

    return {
      color,
      customColorData,
      ...(shouldImportWallpaper
        ? {
            autoBubbleColor,
            wallpaperPhotoPointer,
            wallpaperPreset,
            dimWallpaperInDarkMode,
          }
        : {
            autoBubbleColor: undefined,
            wallpaperPhotoPointer: undefined,
            wallpaperPreset: undefined,
            dimWallpaperInDarkMode: undefined,
          }),
    };
  }

  #isLocalBackup() {
    return this.#options.type === 'local-encrypted';
  }

  #isMediaEnabledBackup() {
    return this.#isLocalBackup() || this.#backupTier === BackupLevel.Paid;
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
  state?: Backups.GroupCall['state']
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
  direction?: Backups.IndividualCall['direction']
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
  type?: Backups.IndividualCall['type']
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
  status?: Backups.IndividualCall['state']
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
  status?: Backups.AdHocCall['state']
): AdhocCallStatus {
  const values = Backups.AdHocCall.State;

  if (
    status == null ||
    !isKnownProtoEnumMember(values, status) ||
    status === values.UNKNOWN_STATE
  ) {
    return AdhocCallStatus.Unknown;
  }
  if (status === values.GENERIC) {
    return AdhocCallStatus.Generic;
  }

  throw missingCaseError(status);
}

function fromCallLinkRestrictionsProto(
  restrictions?: Backups.CallLink['restrictions']
): CallLinkRestrictions {
  const values = Backups.CallLink.Restrictions;

  if (
    restrictions == null ||
    !isKnownProtoEnumMember(values, restrictions) ||
    restrictions === values.UNKNOWN
  ) {
    return CallLinkRestrictions.Unknown;
  }
  if (restrictions === values.NONE) {
    return CallLinkRestrictions.None;
  }
  if (restrictions === values.ADMIN_APPROVAL) {
    return CallLinkRestrictions.AdminApproval;
  }

  throw missingCaseError(restrictions);
}

function parseAvatarColorFromPrimary(
  color?: Backups.Contact['avatarColor']
): Backups.AvatarColor | undefined {
  if (isKnownProtoEnumMember(Backups.AvatarColor, color)) {
    return color;
  }
  return undefined;
}

function fromAvatarColor(
  color?: Backups.Contact['avatarColor']
): string | undefined {
  if (!isKnownProtoEnumMember(Backups.AvatarColor, color)) {
    return undefined;
  }
  switch (color) {
    case Backups.AvatarColor.A100:
      return 'A100';
    case Backups.AvatarColor.A110:
      return 'A110';
    case Backups.AvatarColor.A120:
      return 'A120';
    case Backups.AvatarColor.A130:
      return 'A130';
    case Backups.AvatarColor.A140:
      return 'A140';
    case Backups.AvatarColor.A150:
      return 'A150';
    case Backups.AvatarColor.A160:
      return 'A160';
    case Backups.AvatarColor.A170:
      return 'A170';
    case Backups.AvatarColor.A180:
      return 'A180';
    case Backups.AvatarColor.A190:
      return 'A190';
    case Backups.AvatarColor.A200:
      return 'A200';
    case Backups.AvatarColor.A210:
      return 'A210';
    case null:
    case undefined:
      return undefined;
    default:
      throw missingCaseError(color);
  }
}

function toThemeSetting(
  theme?: Backups.AccountData.AccountSettings['appTheme']
): ThemeType {
  const ENUM = Backups.AccountData.AppTheme;

  if (theme === ENUM.LIGHT) {
    return 'light';
  }
  if (theme === ENUM.DARK) {
    return 'dark';
  }

  return 'system';
}

function toBackupLevel(
  input?: Backups.AccountData.AccountSettings['backupTier']
): BackupLevel | null {
  if (input == null) {
    return null;
  }
  const number = toNumber(input);
  if (number === BackupLevel.Free) {
    return BackupLevel.Free;
  }
  if (number === BackupLevel.Paid) {
    return BackupLevel.Paid;
  }
  return null;
}

function parseAutoDownloadOption(
  input?: Backups.AccountData.AutoDownloadSettings['images'] // or others
): Exclude<
  Backups.AccountData.AutoDownloadSettings.AutoDownloadOption,
  Backups.AccountData.AutoDownloadSettings.AutoDownloadOption.UNKNOWN
> {
  const { AutoDownloadOption } = Backups.AccountData.AutoDownloadSettings;

  if (input == null || !isKnownProtoEnumMember(AutoDownloadOption, input)) {
    return AutoDownloadOption.NEVER;
  }

  if (
    input === AutoDownloadOption.WIFI ||
    input === AutoDownloadOption.WIFI_AND_CELLULAR ||
    input === AutoDownloadOption.NEVER
  ) {
    return input;
  }

  if (input === AutoDownloadOption.UNKNOWN) {
    return AutoDownloadOption.NEVER;
  }

  throw missingCaseError(input);
}

function parseGroupAccessRequired(
  input?: Backups.Group.AccessControl['attributes']
): Backups.Group.AccessControl.AccessRequired {
  const { AccessRequired } = Backups.Group.AccessControl;

  if (input == null || !isKnownProtoEnumMember(AccessRequired, input)) {
    return AccessRequired.UNKNOWN;
  }

  if (
    input === AccessRequired.ANY ||
    input === AccessRequired.ADMINISTRATOR ||
    input === AccessRequired.MEMBER ||
    input === AccessRequired.UNSATISFIABLE ||
    input === AccessRequired.UNKNOWN
  ) {
    return input;
  }

  throw missingCaseError(input);
}

function parseGroupV2AccessLevel(
  input?: Backups.GroupMembershipAccessLevelChangeUpdate['accessLevel']
): Backups.GroupV2AccessLevel {
  if (
    input == null ||
    !isKnownProtoEnumMember(Backups.GroupV2AccessLevel, input)
  ) {
    return Backups.GroupV2AccessLevel.UNKNOWN;
  }

  if (
    input === Backups.GroupV2AccessLevel.ANY ||
    input === Backups.GroupV2AccessLevel.ADMINISTRATOR ||
    input === Backups.GroupV2AccessLevel.MEMBER ||
    input === Backups.GroupV2AccessLevel.UNSATISFIABLE ||
    input === Backups.GroupV2AccessLevel.UNKNOWN
  ) {
    return input;
  }

  throw missingCaseError(input);
}

function parseGroupMemberRole(
  input?: Backups.Group.Member['role']
): Backups.Group.Member.Role {
  const { Role } = Backups.Group.Member;

  if (input == null || !isKnownProtoEnumMember(Role, input)) {
    return Role.UNKNOWN;
  }

  if (
    input === Role.ADMINISTRATOR ||
    input === Role.DEFAULT ||
    input === Role.UNKNOWN
  ) {
    return input;
  }

  throw missingCaseError(input);
}

function parseScheduleDaysEnabled(
  input?: Backups.NotificationProfile['scheduleDaysEnabled']
): NotificationProfileType['scheduleDaysEnabled'] {
  return fromDayOfWeekArray(
    input?.filter(item => {
      return isKnownProtoEnumMember(
        Backups.NotificationProfile.DayOfWeek,
        item
      );
    })
  );
}

function parseIdentityState(
  input?: Backups.Contact['identityState']
): Backups.Contact.IdentityState {
  if (
    input == null ||
    !isKnownProtoEnumMember(Backups.Contact.IdentityState, input)
  ) {
    return Backups.Contact.IdentityState.DEFAULT;
  }

  return input;
}
