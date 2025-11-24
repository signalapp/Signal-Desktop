// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import { BackupJsonExporter } from '@signalapp/libsignal-client/dist/MessageBackup.js';
import pMap from 'p-map';
import pTimeout from 'p-timeout';
import { Readable } from 'node:stream';
import lodash from 'lodash';
import { CallLinkRootKey } from '@signalapp/ringrtc';

import { Backups, SignalService } from '../../protobuf/index.std.js';
import {
  DataReader,
  DataWriter,
  pauseWriteAccess,
  resumeWriteAccess,
} from '../../sql/Client.preload.js';
import type {
  PageMessagesCursorType,
  IdentityKeyType,
} from '../../sql/Interface.std.js';
import { createLogger } from '../../logging/log.std.js';
import { GiftBadgeStates } from '../../types/GiftBadgeStates.std.js';
import { type CustomColorType } from '../../types/Colors.std.js';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories.std.js';
import { getStickerPacksForBackup } from '../../types/Stickers.preload.js';
import {
  isPniString,
  isServiceIdString,
  type AciString,
  type ServiceIdString,
} from '../../types/ServiceId.std.js';
import type { RawBodyRange } from '../../types/BodyRange.std.js';
import { PaymentEventKind } from '../../types/Payment.std.js';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent.std.js';
import type {
  ConversationAttributesType,
  MessageAttributesType,
  QuotedAttachmentType,
} from '../../model-types.d.ts';
import { drop } from '../../util/drop.std.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import { explodePromise } from '../../util/explodePromise.std.js';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation.dom.js';
import { uuidToBytes } from '../../util/uuidToBytes.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { getSafeLongFromTimestamp } from '../../util/timestampLongUtils.std.js';
import {
  DAY,
  MINUTE,
  SECOND,
  DurationInSeconds,
} from '../../util/durations/index.std.js';
import {
  PhoneNumberDiscoverability,
  parsePhoneNumberDiscoverability,
} from '../../util/phoneNumberDiscoverability.std.js';
import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from '../../types/PhoneNumberSharingMode.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
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
  isTapToView,
  isUniversalTimerNotification,
  isUnsupportedMessage,
  isVerifiedChange,
  isChangeNumberNotification,
  isJoinedSignalNotification,
  isTitleTransitionNotification,
  isMessageRequestResponse,
  isPinnedMessageNotification,
} from '../../state/selectors/message.preload.js';
import * as Bytes from '../../Bytes.std.js';
import { canBeSynced as canPreferredReactionEmojiBeSynced } from '../../reactions/preferredReactionEmoji.std.js';
import { SendStatus } from '../../messages/MessageSendState.std.js';
import { BACKUP_VERSION } from './constants.std.js';
import {
  getMessageIdForLogging,
  getConversationIdForLogging,
} from '../../util/idForLogging.preload.js';
import { makeLookup } from '../../util/makeLookup.std.js';
import type {
  CallHistoryDetails,
  CallStatus,
} from '../../types/CallDisposition.std.js';
import {
  CallMode,
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  AdhocCallStatus,
} from '../../types/CallDisposition.std.js';
import { isAciString } from '../../util/isAciString.std.js';
import { hslToRGBInt } from '../../util/hslToRGB.std.js';
import type {
  AboutMe,
  BackupExportOptions,
  LocalChatStyle,
  StatsType,
} from './types.std.js';
import { messageHasPaymentEvent } from '../../messages/payments.std.js';
import {
  numberToAddressType,
  numberToPhoneType,
} from '../../types/EmbeddedContact.std.js';
import { toLogFormat } from '../../types/errors.std.js';
import type { AttachmentType } from '../../types/Attachment.std.js';
import {
  isGIF,
  isDownloaded,
  hasRequiredInformationForLocalBackup,
  hasRequiredInformationForRemoteBackup,
} from '../../util/Attachment.std.js';
import { getFilePointerForAttachment } from './util/filePointers.preload.js';
import { getBackupMediaRootKey } from './crypto.preload.js';
import type {
  CoreAttachmentBackupJobType,
  CoreAttachmentLocalBackupJobType,
} from '../../types/AttachmentBackup.std.js';
import { AttachmentBackupManager } from '../../jobs/AttachmentBackupManager.preload.js';
import {
  getBackupCdnInfo,
  getLocalBackupFileNameForAttachment,
  getMediaNameForAttachment,
} from './util/mediaId.preload.js';
import { calculateExpirationTimestamp } from '../../util/expirationTimer.std.js';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { CallLinkRestrictions } from '../../types/CallLink.std.js';
import {
  isCallHistoryForUnusedCallLink,
  toAdminKeyBytes,
} from '../../util/callLinks.std.js';
import {
  getRoomIdFromRootKey,
  toEpochBytes,
} from '../../util/callLinksRingrtc.node.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';
import { migrateAllMessages } from '../../messages/migrateMessageData.preload.js';
import {
  isBodyTooLong,
  MAX_MESSAGE_BODY_BYTE_LENGTH,
  trimBody,
} from '../../util/longAttachment.std.js';
import { generateBackupsSubscriberData } from '../../util/backupSubscriptionData.preload.js';
import {
  getEnvironment,
  isTestEnvironment,
  isTestOrMockEnvironment,
} from '../../environment.std.js';
import { calculateLightness } from '../../util/getHSL.std.js';
import { isSignalServiceId } from '../../util/isSignalConversation.dom.js';
import { isValidE164 } from '../../util/isValidE164.std.js';
import { toDayOfWeekArray } from '../../types/NotificationProfile.std.js';
import {
  getLinkPreviewSetting,
  getTypingIndicatorSetting,
} from '../../util/Settings.preload.js';
import { KIBIBYTE } from '../../types/AttachmentSize.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { ChatFolderType } from '../../types/ChatFolder.std.js';
import { expiresTooSoonForBackup } from './util/expiration.std.js';

const { isNumber } = lodash;

const log = createLogger('backupExport');

// Temporarily limited to preserve the received_at order
const MAX_CONCURRENCY = 1;

// We want a very generous timeout to make sure that we always resume write
// access to the database.
const FLUSH_TIMEOUT = 30 * MINUTE;

// Threshold for reporting slow flushes
const REPORTING_THRESHOLD = SECOND;

const MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH = 128 * KIBIBYTE;
const BACKUP_QUOTE_BODY_LIMIT = 2048;

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

type ToChatItemOptionsType = Readonly<{
  aboutMe: AboutMe;
  callHistoryByCallId: Record<string, CallHistoryDetails>;
}>;

type NonBubbleOptionsType = Pick<
  ToChatItemOptionsType,
  'aboutMe' | 'callHistoryByCallId'
> &
  Readonly<{
    authorId: Long | undefined;
    message: MessageAttributesType;
  }>;

enum NonBubbleResultKind {
  Directed = 'Directed',
  Directionless = 'Directionless',
  Drop = 'Drop',
}

type NonBubbleResultType = Readonly<
  | {
      kind: NonBubbleResultKind.Drop;
      patch?: undefined;
    }
  | {
      kind: NonBubbleResultKind.Directed | NonBubbleResultKind.Directionless;
      patch: Backups.IChatItem;
    }
>;

export class BackupExportStream extends Readable {
  // Shared between all methods for consistency.
  #now = Date.now();

  readonly #backupTimeMs = getSafeLongFromTimestamp(this.#now);
  readonly #convoIdToRecipientId = new Map<string, number>();
  readonly #serviceIdToRecipientId = new Map<string, number>();
  readonly #e164ToRecipientId = new Map<string, number>();
  readonly #roomIdToRecipientId = new Map<string, number>();
  readonly #mediaNamesToFilePointers = new Map<string, Backups.FilePointer>();
  readonly #stats: StatsType = {
    adHocCalls: 0,
    callLinks: 0,
    conversations: 0,
    chatFolders: 0,
    chats: 0,
    distributionLists: 0,
    messages: 0,
    notificationProfiles: 0,
    skippedMessages: 0,
    stickerPacks: 0,
    fixedDirectMessages: 0,
  };
  #ourConversation?: ConversationAttributesType;
  #attachmentBackupJobs: Array<
    CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType
  > = [];
  #buffers = new Array<Uint8Array>();
  #nextRecipientId = 1;
  #flushResolve: (() => void) | undefined;
  #jsonExporter: BackupJsonExporter | undefined;

  // Map from custom color uuid to an index in accountSettings.customColors
  // array.
  #customColorIdByUuid = new Map<string, Long>();

  constructor(private readonly options: Readonly<BackupExportOptions>) {
    super();
  }

  public run(): void {
    drop(
      (async () => {
        log.info('BackupExportStream: starting...');
        drop(AttachmentBackupManager.stop());
        log.info('BackupExportStream: message migration starting...');
        await migrateAllMessages();

        await pauseWriteAccess();
        try {
          await this.#unsafeRun();
          await resumeWriteAccess();
          // TODO (DESKTOP-7344): Clear & add backup jobs in a single transaction
          const { type } = this.options;
          switch (type) {
            case 'remote':
              log.info(
                `Enqueuing ${this.#attachmentBackupJobs.length} remote attachment backup jobs`
              );
              await DataWriter.clearAllAttachmentBackupJobs();
              await Promise.all(
                this.#attachmentBackupJobs.map(job => {
                  if (job.type === 'local') {
                    log.error(
                      "BackupExportStream: Can't enqueue local backup jobs during remote backup, skipping"
                    );
                    return Promise.resolve();
                  }

                  return AttachmentBackupManager.addJobAndMaybeThumbnailJob(
                    job
                  );
                })
              );
              this.#attachmentBackupJobs = [];
              break;
            case 'plaintext-export':
            case 'local-encrypted':
            case 'cross-client-integration-test':
              break;
            default:
              throw missingCaseError(type);
          }
          log.info('finished successfully');
        } catch (error) {
          await resumeWriteAccess();
          log.error('errored', toLogFormat(error));
          this.emit('error', error);
        } finally {
          drop(AttachmentBackupManager.start());
        }
      })()
    );
  }

  public getMediaNamesIterator(): MapIterator<string> {
    return this.#mediaNamesToFilePointers.keys();
  }

  public getStats(): Readonly<StatsType> {
    return this.#stats;
  }
  public getAttachmentBackupJobs(): ReadonlyArray<
    CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType
  > {
    return this.#attachmentBackupJobs;
  }

  async #unsafeRun(): Promise<void> {
    this.#ourConversation =
      window.ConversationController.getOurConversationOrThrow().attributes;
    const backupInfo: Backups.IBackupInfo = {
      version: Long.fromNumber(BACKUP_VERSION),
      backupTimeMs: this.#backupTimeMs,
      mediaRootBackupKey: getBackupMediaRootKey().serialize(),
      firstAppVersion: itemStorage.get('restoredBackupFirstAppVersion'),
      currentAppVersion: `Desktop ${window.getVersion()}`,
    };

    this.push(
      this.#getJsonIfNeeded(
        this.options.type === 'plaintext-export'
          ? Backups.BackupInfo.encode(backupInfo).finish()
          : Backups.BackupInfo.encodeDelimited(backupInfo).finish()
      )
    );

    this.#pushFrame({
      account: await this.#toAccountData(),
    });
    await this.#flush();

    const identityKeys = await DataReader.getAllIdentityKeys();
    const identityKeysById = new Map(
      identityKeys.map(key => {
        return [key.id, key];
      })
    );

    const skippedConversationIds = new Set<string>();
    for (const { attributes } of window.ConversationController.getAll()) {
      const recipientId = this.#getRecipientId(attributes);

      const recipient = this.#toRecipient(
        recipientId,
        attributes,
        identityKeysById
      );
      if (recipient === undefined) {
        skippedConversationIds.add(attributes.id);
        // Can't be backed up.
        continue;
      }

      this.#pushFrame({
        recipient,
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.conversations += 1;
    }

    this.#pushFrame({
      recipient: {
        id: Long.fromNumber(this.#getNextRecipientId()),
        releaseNotes: {},
      },
    });
    await this.#flush();

    const distributionLists =
      await DataReader.getAllStoryDistributionsWithMembers();

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

      this.#pushFrame({
        recipient: {
          id: Long.fromNumber(this.#getNextRecipientId()),
          distributionList: {
            distributionId: uuidToBytes(list.id),
            deletionTimestamp: list.deletedAtTimestamp
              ? Long.fromNumber(list.deletedAtTimestamp)
              : null,

            distributionList: list.deletedAtTimestamp
              ? null
              : {
                  name: list.name,
                  allowReplies: list.allowsReplies,
                  privacyMode,
                  memberRecipientIds: list.members.map(serviceId =>
                    this.#getOrPushPrivateRecipient({ serviceId })
                  ),
                },
          },
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.distributionLists += 1;
    }

    const callLinks = await DataReader.getAllCallLinks();

    for (const link of callLinks) {
      const {
        rootKey: rootKeyString,
        epoch,
        adminKey,
        name,
        restrictions,
        revoked,
        expiration,
      } = link;

      if (revoked) {
        continue;
      }

      const id = this.#getNextRecipientId();
      const rootKey = CallLinkRootKey.parse(rootKeyString);
      const roomId = getRoomIdFromRootKey(rootKey);

      this.#roomIdToRecipientId.set(roomId, id);

      this.#pushFrame({
        recipient: {
          id: Long.fromNumber(id),
          callLink: {
            rootKey: rootKey.bytes,
            epoch: epoch ? toEpochBytes(epoch) : null,
            adminKey: adminKey ? toAdminKeyBytes(adminKey) : null,
            name,
            restrictions: toCallLinkRestrictionsProto(restrictions),
            expirationMs: isNumber(expiration)
              ? getSafeLongFromTimestamp(expiration)
              : null,
          },
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.callLinks += 1;
    }

    const stickerPacks = await getStickerPacksForBackup();

    for (const { id, key } of stickerPacks) {
      this.#pushFrame({
        stickerPack: {
          packId: Bytes.fromHex(id),
          packKey: Bytes.fromBase64(key),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.stickerPacks += 1;
    }

    const pinnedConversationIds =
      itemStorage.get('pinnedConversationIds') || [];

    for (const { attributes } of window.ConversationController.getAll()) {
      if (isGroupV1(attributes)) {
        log.warn('skipping gv1 conversation');
        continue;
      }

      if (skippedConversationIds.has(attributes.id)) {
        continue;
      }

      const recipientId = this.#getRecipientId(attributes);

      let pinnedOrder: number | null = null;
      if (attributes.isPinned) {
        const index = pinnedConversationIds.indexOf(attributes.id);
        if (index === -1) {
          const convoId = getConversationIdForLogging(attributes);
          log.warn(`${convoId} is pinned, but is not on the list`);
        }
        pinnedOrder = Math.max(1, index + 1);
      }

      if (isTestEnvironment(getEnvironment())) {
        // In backup integration tests, we may import a Contact/Group without a Chat,
        // so we don't wan't to export the (empty) Chat to satisfy the tests.
        if (
          !attributes.test_chatFrameImportedFromBackup &&
          !attributes.isPinned &&
          !attributes.active_at &&
          !attributes.expireTimer &&
          !attributes.muteExpiresAt
        ) {
          continue;
        }
      }

      this.#pushFrame({
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
          expireTimerVersion: attributes.expireTimerVersion,
          muteUntilMs: attributes.muteExpiresAt
            ? getSafeLongFromTimestamp(attributes.muteExpiresAt, Long.MAX_VALUE)
            : null,
          markedUnread: attributes.markedUnread === true,
          dontNotifyForMentionsIfMuted:
            attributes.dontNotifyForMentionsIfMuted === true,

          style: this.#toChatStyle({
            wallpaperPhotoPointer: attributes.wallpaperPhotoPointerBase64
              ? Bytes.fromBase64(attributes.wallpaperPhotoPointerBase64)
              : undefined,
            wallpaperPreset: attributes.wallpaperPreset,
            color: attributes.conversationColor,
            customColorId: attributes.customColorId,
            dimWallpaperInDarkMode: attributes.dimWallpaperInDarkMode,
            autoBubbleColor: attributes.autoBubbleColor,
          }),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.chats += 1;
    }

    const allCallHistoryItems = await DataReader.getAllCallHistory();

    for (const item of allCallHistoryItems) {
      const {
        callId: callIdStr,
        type,
        peerId: roomId,
        status,
        timestamp,
      } = item;

      if (type !== CallType.Adhoc || isCallHistoryForUnusedCallLink(item)) {
        continue;
      }

      const recipientId = this.#roomIdToRecipientId.get(roomId);
      if (!recipientId) {
        log.warn(
          `Dropping ad-hoc call; recipientId for roomId ${roomId.slice(-2)} not found`
        );
        continue;
      }

      if (status === AdhocCallStatus.Deleted) {
        continue;
      }

      let callId: Long;
      try {
        callId = Long.fromString(callIdStr);
      } catch (error) {
        log.warn('Dropping ad-hoc call; invalid callId', toLogFormat(error));
        continue;
      }

      this.#pushFrame({
        adHocCall: {
          callId,
          recipientId: Long.fromNumber(recipientId),
          state: toAdHocCallStateProto(status),
          callTimestamp: Long.fromNumber(timestamp),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.adHocCalls += 1;
    }

    const allNotificationProfiles =
      await DataReader.getAllNotificationProfiles();

    for (const profile of allNotificationProfiles) {
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
      } = profile;

      const allowedRecipients = Array.from(allowedMembers)
        .map(conversationId => {
          const conversation =
            window.ConversationController.get(conversationId);
          if (!conversation) {
            return undefined;
          }

          const { attributes } = conversation;
          return this.#getRecipientId(attributes);
        })
        .filter(isNotNil);

      this.#pushFrame({
        notificationProfile: {
          id: Bytes.fromHex(id),
          name,
          emoji,
          color,
          createdAtMs: getSafeLongFromTimestamp(createdAtMs),
          allowAllCalls,
          allowAllMentions,
          allowedMembers: allowedRecipients,
          scheduleEnabled,
          scheduleStartTime,
          scheduleEndTime,
          scheduleDaysEnabled: toDayOfWeekArray(scheduleDaysEnabled),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.notificationProfiles += 1;
    }

    const currentChatFolders = await DataReader.getCurrentChatFolders();

    for (const chatFolder of currentChatFolders) {
      let folderType: Backups.ChatFolder.FolderType;
      if (chatFolder.folderType === ChatFolderType.ALL) {
        folderType = Backups.ChatFolder.FolderType.ALL;
      } else if (chatFolder.folderType === ChatFolderType.CUSTOM) {
        folderType = Backups.ChatFolder.FolderType.CUSTOM;
      } else {
        log.warn('Dropping chat folder; unknown folder type');
        continue;
      }

      this.#pushFrame({
        chatFolder: {
          id: uuidToBytes(chatFolder.id),
          name: chatFolder.name,
          folderType,
          showOnlyUnread: chatFolder.showOnlyUnread,
          showMutedChats: chatFolder.showMutedChats,
          includeAllIndividualChats: chatFolder.includeAllIndividualChats,
          includeAllGroupChats: chatFolder.includeAllGroupChats,
          includedRecipientIds: chatFolder.includedConversationIds.map(id => {
            return this.#getOrPushPrivateRecipient({ id });
          }),
          excludedRecipientIds: chatFolder.excludedConversationIds.map(id => {
            return this.#getOrPushPrivateRecipient({ id });
          }),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.chatFolders += 1;
    }

    let cursor: PageMessagesCursorType | undefined;

    const callHistory = await DataReader.getAllCallHistory();
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
        const { messages, cursor: newCursor } =
          // eslint-disable-next-line no-await-in-loop
          await DataReader.pageMessages(cursor);

        // eslint-disable-next-line no-await-in-loop
        await pMap(
          messages,
          async message => {
            if (skippedConversationIds.has(message.conversationId)) {
              this.#stats.skippedMessages += 1;
              return;
            }

            const chatItem = await this.#toChatItem(message, {
              aboutMe,
              callHistoryByCallId,
            });

            if (chatItem === undefined) {
              this.#stats.skippedMessages += 1;
              // Can't be backed up.
              return;
            }

            this.#pushFrame({
              chatItem,
            });

            this.#stats.messages += 1;
          },
          { concurrency: MAX_CONCURRENCY }
        );

        cursor = newCursor;

        // eslint-disable-next-line no-await-in-loop
        await this.#flush();
      }
    } finally {
      if (cursor !== undefined) {
        await DataReader.finishPageMessages(cursor);
      }
    }

    await this.#flush();

    log.warn('final stats', {
      ...this.#stats,
      attachmentBackupJobs: this.#attachmentBackupJobs.length,
    });

    if (this.#jsonExporter) {
      try {
        const result = this.#jsonExporter.finish();
        if (result?.errorMessage) {
          log.warn(
            'jsonExporter.finish() returned validation error:',
            result.errorMessage
          );
        }
      } catch (error) {
        // We only warn because this isn't that big of a deal - the export is complete.
        // All we need from the exporter at the end is any validation errors it found.
        log.warn('jsonExporter returned error', toLogFormat(error));
      }
    }

    this.push(null);
  }

  #pushBuffer(buffer: Uint8Array): void {
    this.#buffers.push(buffer);
  }

  #frameToJson(encodedFrame: Uint8Array): string {
    let lines = '';

    if (!this.#jsonExporter) {
      const { exporter, chunk: initialChunk } = BackupJsonExporter.start(
        encodedFrame,
        { validate: false }
      );

      lines = `${initialChunk}\n`;
      this.#jsonExporter = exporter;
    } else {
      const results = this.#jsonExporter.exportFrames(encodedFrame);
      for (const result of results) {
        if (result.errorMessage) {
          log.warn(
            'frameToJson: frame had a validation error:',
            result.errorMessage
          );
        }
        if (!result.line) {
          log.error('frameToJson: frame was filtered out by libsignal');
        } else {
          lines += `${result.line}\n`;
        }
      }
    }

    return lines;
  }

  #getJsonIfNeeded(encoded: Uint8Array): Uint8Array {
    if (this.options.type === 'plaintext-export') {
      const json = this.#frameToJson(encoded);
      return Buffer.from(json, 'utf-8');
    }

    return encoded;
  }

  #pushFrame(frame: Backups.IFrame): void {
    const encodedFrame = Backups.Frame.encodeDelimited(frame).finish();
    const toPush = this.#getJsonIfNeeded(encodedFrame);
    this.#pushBuffer(toPush);
  }

  async #flush(): Promise<void> {
    const chunk = Bytes.concatenate(this.#buffers);
    this.#buffers = [];

    // Below watermark, no pausing required
    if (this.push(chunk)) {
      return;
    }

    const { promise, resolve } = explodePromise<void>();
    strictAssert(this.#flushResolve === undefined, 'flush already pending');
    this.#flushResolve = resolve;

    const start = Date.now();
    log.info('flush paused due to pushback');
    try {
      await pTimeout(promise, FLUSH_TIMEOUT);
    } finally {
      const duration = Date.now() - start;
      if (duration > REPORTING_THRESHOLD) {
        log.info(`flush resumed after ${duration}ms`);
      }
      this.#flushResolve = undefined;
    }
  }

  override _read(): void {
    this.#flushResolve?.();
  }

  async #toAccountData(): Promise<Backups.IAccountData> {
    const me = window.ConversationController.getOurConversationOrThrow();

    const rawPreferredReactionEmoji = itemStorage.get('preferredReactionEmoji');

    let preferredReactionEmoji: Array<string> | undefined;
    if (canPreferredReactionEmojiBeSynced(rawPreferredReactionEmoji)) {
      preferredReactionEmoji = rawPreferredReactionEmoji;
    }

    const PHONE_NUMBER_SHARING_MODE_ENUM =
      Backups.AccountData.PhoneNumberSharingMode;
    const rawPhoneNumberSharingMode = parsePhoneNumberSharingMode(
      itemStorage.get('phoneNumberSharingMode')
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

    const usernameLink = itemStorage.get('usernameLink');

    const subscriberId = itemStorage.get('subscriberId');
    const currencyCode = itemStorage.get('subscriberCurrencyCode');

    const backupsSubscriberData = generateBackupsSubscriberData();
    const backupTier = itemStorage.get('backupTier');
    const autoDownloadPrimary = itemStorage.get(
      'auto-download-attachment-primary'
    );

    return {
      profileKey: itemStorage.get('profileKey'),
      username: me.get('username') || null,
      usernameLink: usernameLink
        ? {
            ...usernameLink,

            // Same numeric value, no conversion needed
            color: itemStorage.get('usernameLinkColor'),
          }
        : null,
      givenName: me.get('profileName'),
      familyName: me.get('profileFamilyName'),
      avatarUrlPath: itemStorage.get('avatarUrl'),
      backupsSubscriberData,
      donationSubscriberData:
        Bytes.isNotEmpty(subscriberId) && currencyCode
          ? {
              subscriberId,
              currencyCode,
              manuallyCancelled: itemStorage.get(
                'donorSubscriptionManuallyCancelled',
                false
              ),
            }
          : null,
      svrPin: itemStorage.get('svrPin'),
      bioText: me.get('about'),
      bioEmoji: me.get('aboutEmoji'),
      // Test only values
      ...(isTestOrMockEnvironment()
        ? {
            androidSpecificSettings: itemStorage.get('androidSpecificSettings'),
          }
        : {}),
      accountSettings: {
        readReceipts: itemStorage.get('read-receipt-setting'),
        sealedSenderIndicators: itemStorage.get('sealedSenderIndicators'),
        typingIndicators: getTypingIndicatorSetting(),
        linkPreviews: getLinkPreviewSetting(),
        notDiscoverableByPhoneNumber:
          parsePhoneNumberDiscoverability(
            itemStorage.get('phoneNumberDiscoverability')
          ) === PhoneNumberDiscoverability.NotDiscoverable,
        preferContactAvatars: itemStorage.get('preferContactAvatars'),
        universalExpireTimerSeconds: itemStorage.get('universalExpireTimer'),
        preferredReactionEmoji,
        displayBadgesOnProfile: itemStorage.get('displayBadgesOnProfile'),
        keepMutedChatsArchived: itemStorage.get('keepMutedChatsArchived'),
        hasSetMyStoriesPrivacy: itemStorage.get('hasSetMyStoriesPrivacy'),
        hasViewedOnboardingStory: itemStorage.get('hasViewedOnboardingStory'),
        storiesDisabled: itemStorage.get('hasStoriesDisabled'),
        storyViewReceiptsEnabled: itemStorage.get('storyViewReceiptsEnabled'),
        hasCompletedUsernameOnboarding: itemStorage.get(
          'hasCompletedUsernameOnboarding'
        ),
        hasSeenGroupStoryEducationSheet: itemStorage.get(
          'hasSeenGroupStoryEducationSheet'
        ),
        phoneNumberSharingMode,
        // Note that this should be called before `toDefaultChatStyle` because
        // it builds `customColorIdByUuid`
        customChatColors: this.#toCustomChatColors(),
        defaultChatStyle: this.#toDefaultChatStyle(),
        backupTier: backupTier != null ? Long.fromNumber(backupTier) : null,
        // Test only values
        ...(isTestOrMockEnvironment()
          ? {
              optimizeOnDeviceStorage: itemStorage.get(
                'optimizeOnDeviceStorage'
              ),
              pinReminders: itemStorage.get('pinReminders'),
              screenLockTimeoutMinutes: itemStorage.get(
                'screenLockTimeoutMinutes'
              ),
              autoDownloadSettings: autoDownloadPrimary
                ? {
                    images: autoDownloadPrimary.photos,
                    audio: autoDownloadPrimary.audio,
                    video: autoDownloadPrimary.videos,
                    documents: autoDownloadPrimary.documents,
                  }
                : undefined,
            }
          : {}),
        defaultSentMediaQuality:
          itemStorage.get('sent-media-quality') === 'high'
            ? Backups.AccountData.SentMediaQuality.HIGH
            : Backups.AccountData.SentMediaQuality.STANDARD,
      },
    };
  }

  #getExistingRecipientId(
    options: GetRecipientIdOptionsType
  ): Long | undefined {
    let existing: number | undefined;
    if (options.serviceId != null) {
      existing = this.#serviceIdToRecipientId.get(options.serviceId);
    }
    if (existing === undefined && options.e164 != null) {
      existing = this.#e164ToRecipientId.get(options.e164);
    }
    if (existing === undefined && options.id != null) {
      existing = this.#convoIdToRecipientId.get(options.id);
    }
    if (existing !== undefined) {
      return Long.fromNumber(existing);
    }
    return undefined;
  }

  #getRecipientId(options: GetRecipientIdOptionsType): Long {
    const existing = this.#getExistingRecipientId(options);
    if (existing !== undefined) {
      return existing;
    }

    const { id, serviceId, e164 } = options;

    const recipientId = this.#nextRecipientId;
    this.#nextRecipientId += 1;

    if (id !== undefined) {
      this.#convoIdToRecipientId.set(id, recipientId);
    }
    if (serviceId !== undefined) {
      this.#serviceIdToRecipientId.set(serviceId, recipientId);
    }
    if (e164 !== undefined) {
      this.#e164ToRecipientId.set(e164, recipientId);
    }
    const result = Long.fromNumber(recipientId);

    return result;
  }

  #getOrPushPrivateRecipient(options: GetRecipientIdOptionsType): Long {
    const existing = this.#getExistingRecipientId(options);
    const needsPush = existing == null;
    const result = this.#getRecipientId(options);

    if (needsPush) {
      const { serviceId, e164 } = options;
      this.#pushFrame({
        recipient: this.#toRecipient(result, {
          type: 'private',
          serviceId,
          pni: isPniString(serviceId) ? serviceId : undefined,
          e164,
        }),
      });
    }

    return result;
  }

  #getNextRecipientId(): number {
    const recipientId = this.#nextRecipientId;
    this.#nextRecipientId += 1;

    return recipientId;
  }

  #toRecipient(
    recipientId: Long,
    convo: Omit<
      ConversationAttributesType,
      'id' | 'version' | 'expireTimerVersion'
    >,
    identityKeysById?: ReadonlyMap<IdentityKeyType['id'], IdentityKeyType>
  ): Backups.IRecipient | undefined {
    const res: Backups.IRecipient = {
      id: recipientId,
    };

    if (isMe(convo)) {
      res.self = {
        avatarColor: toAvatarColor(convo.color),
      };
    } else if (isDirectConversation(convo)) {
      if (convo.serviceId != null && isSignalServiceId(convo.serviceId)) {
        return undefined;
      }

      if (convo.serviceId != null && !isServiceIdString(convo.serviceId)) {
        log.warn(
          'skipping conversation with invalid serviceId',
          convo.serviceId
        );
        return undefined;
      }

      if (convo.e164 != null && !isValidE164(convo.e164, true)) {
        log.warn('skipping conversation with invalid e164', convo.serviceId);
        return undefined;
      }

      if (convo.serviceId == null && convo.e164 == null) {
        log.warn('skipping conversation with neither serviceId nor e164');
        return undefined;
      }

      let visibility: Backups.Contact.Visibility;
      if (convo.removalStage == null) {
        visibility = Backups.Contact.Visibility.VISIBLE;
      } else if (convo.removalStage === 'justNotification') {
        visibility = Backups.Contact.Visibility.HIDDEN;
      } else if (convo.removalStage === 'messageRequest') {
        visibility = Backups.Contact.Visibility.HIDDEN_MESSAGE_REQUEST;
      } else {
        throw missingCaseError(convo.removalStage);
      }

      let identityKey: IdentityKeyType | undefined;
      if (identityKeysById != null && convo.serviceId != null) {
        identityKey = identityKeysById.get(convo.serviceId);
      }

      const { nicknameGivenName, nicknameFamilyName, note } = convo;

      const maybePni = convo.pni ?? convo.serviceId;

      const aci = isAciString(convo.serviceId)
        ? Aci.parseFromServiceIdString(convo.serviceId).getRawUuidBytes()
        : null;
      const pni = isPniString(maybePni)
        ? Pni.parseFromServiceIdString(maybePni).getRawUuidBytes()
        : null;
      const e164 = convo.e164 ? Long.fromString(convo.e164) : null;

      strictAssert(
        aci != null || pni != null || e164 != null,
        'Contact has no identifier'
      );

      res.contact = {
        aci,
        pni,
        e164,
        username: convo.username,
        blocked: convo.serviceId
          ? itemStorage.blocked.isServiceIdBlocked(convo.serviceId)
          : null,
        visibility,
        ...(convo.discoveredUnregisteredAt
          ? {
              notRegistered: {
                unregisteredTimestamp: convo.firstUnregisteredAt
                  ? getSafeLongFromTimestamp(convo.firstUnregisteredAt)
                  : null,
              },
            }
          : {
              registered: {},
            }),
        profileKey: convo.profileKey
          ? Bytes.fromBase64(convo.profileKey)
          : null,
        profileSharing: convo.profileSharing,
        profileGivenName: convo.profileName,
        profileFamilyName: convo.profileFamilyName,
        systemFamilyName: convo.systemFamilyName,
        systemGivenName: convo.systemGivenName,
        systemNickname: convo.systemNickname,
        hideStory: convo.hideStory === true,
        identityKey: identityKey?.publicKey || null,
        avatarColor: toAvatarColor(convo.color),

        // Integer values match so we can use it as is
        identityState: identityKey?.verified ?? 0,
        nickname:
          nicknameGivenName || nicknameFamilyName
            ? {
                given: nicknameGivenName,
                family: nicknameFamilyName,
              }
            : null,
        note,
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

      const masterKey = Bytes.fromBase64(convo.masterKey);

      res.group = {
        masterKey,
        whitelisted: convo.profileSharing,
        hideStory: convo.hideStory === true,
        storySendMode,
        blocked: convo.groupId
          ? itemStorage.blocked.isGroupBlocked(convo.groupId)
          : false,
        avatarColor: toAvatarColor(convo.color),
        snapshot: {
          title: {
            title: convo.name?.trim() ?? '',
          },
          description:
            convo.description != null
              ? {
                  descriptionText: convo.description.trim(),
                }
              : null,
          avatarUrl: convo.avatar?.url,
          disappearingMessagesTimer:
            convo.expireTimer != null
              ? {
                  disappearingMessagesDuration: DurationInSeconds.toSeconds(
                    convo.expireTimer
                  ),
                }
              : null,
          accessControl: convo.accessControl,
          version: convo.revision || 0,
          members: convo.membersV2?.map(member => {
            return {
              userId: this.#aciToBytes(member.aci),
              role: member.role,
              joinedAtVersion: member.joinedAtVersion,
            };
          }),
          membersPendingProfileKey: convo.pendingMembersV2?.map(member => {
            return {
              member: {
                userId: this.#serviceIdToBytes(member.serviceId),
                role: member.role,
                joinedAtVersion: 0,
              },
              addedByUserId: this.#aciToBytes(member.addedByUserId),
              timestamp: getSafeLongFromTimestamp(member.timestamp),
            };
          }),
          membersPendingAdminApproval: convo.pendingAdminApprovalV2?.map(
            member => {
              return {
                userId: this.#aciToBytes(member.aci),
                timestamp: getSafeLongFromTimestamp(member.timestamp),
              };
            }
          ),
          membersBanned: convo.bannedMembersV2?.map(member => {
            return {
              userId: this.#serviceIdToBytes(member.serviceId),
              timestamp: getSafeLongFromTimestamp(member.timestamp),
            };
          }),
          inviteLinkPassword: convo.groupInviteLinkPassword
            ? Bytes.fromBase64(convo.groupInviteLinkPassword)
            : null,
          announcementsOnly: convo.announcementsOnly === true,
        },
      };
    } else {
      return undefined;
    }

    return res;
  }

  async #toChatItem(
    message: MessageAttributesType,
    { aboutMe, callHistoryByCallId }: ToChatItemOptionsType
  ): Promise<Backups.IChatItem | undefined> {
    const conversation = window.ConversationController.get(
      message.conversationId
    );

    if (conversation && isGroupV1(conversation.attributes)) {
      log.warn('skipping gv1 message');
      return undefined;
    }

    const chatId = this.#getRecipientId({ id: message.conversationId });
    if (chatId === undefined) {
      log.warn('message chat not found');
      return undefined;
    }

    if (message.type === 'story') {
      return undefined;
    }

    if (
      conversation &&
      isGroupV2(conversation.attributes) &&
      (message.storyReplyContext || message.storyReaction)
    ) {
      // We drop group story replies
      return undefined;
    }

    const expirationTimestamp = calculateExpirationTimestamp(message);
    if (
      expiresTooSoonForBackup({ messageExpiresAt: expirationTimestamp ?? null })
    ) {
      return undefined;
    }

    if (message.expireTimer) {
      if (this.options.type === 'plaintext-export') {
        // All disappearing messages are excluded in plaintext export
        return undefined;
      }

      if (DurationInSeconds.toMillis(message.expireTimer) <= DAY) {
        // Message has an expire timer that's too short for export
        return undefined;
      }
    }

    let authorId: Long | undefined;

    const isOutgoing = message.type === 'outgoing';
    const isIncoming = message.type === 'incoming';

    // Pacify typescript
    if (message.sourceServiceId) {
      authorId = this.#getOrPushPrivateRecipient({
        serviceId: message.sourceServiceId,
        e164: message.source,
      });
    } else if (message.source) {
      authorId = this.#getOrPushPrivateRecipient({
        serviceId: message.sourceServiceId,
        e164: message.source,
      });

      if (
        isIncoming &&
        conversation &&
        isDirectConversation(conversation.attributes)
      ) {
        const convoAuthor = this.#getOrPushPrivateRecipient({
          id: conversation.attributes.id,
        });

        // Fix conversation id for misattributed e164-only incoming 1:1
        // messages.
        if (authorId.neq(convoAuthor)) {
          authorId = convoAuthor;
          this.#stats.fixedDirectMessages += 1;
        }
      }
    } else {
      strictAssert(!isIncoming, 'Incoming message must have source');

      // Author must be always present, even if we are directionless
      authorId = this.#getOrPushPrivateRecipient({
        serviceId: aboutMe.aci,
      });
    }

    if (isOutgoing || isIncoming) {
      strictAssert(authorId, 'Incoming/outgoing messages require an author');
    }

    let expireStartDate: Long | undefined;
    let expiresInMs: Long | undefined;

    if (message.expireTimer != null) {
      expiresInMs = Long.fromNumber(
        DurationInSeconds.toMillis(message.expireTimer)
      );

      if (message.expirationStartTimestamp != null) {
        expireStartDate = getSafeLongFromTimestamp(
          message.expirationStartTimestamp
        );
      }
    }

    const result: Backups.IChatItem = {
      chatId,
      authorId,
      dateSent: getSafeLongFromTimestamp(
        message.editMessageTimestamp || message.sent_at
      ),
      expireStartDate,
      expiresInMs,
      revisions: [],
      sms: message.sms === true,
    };

    if (!isNormalBubble(message)) {
      const { patch, kind } = await this.#toChatItemFromNonBubble({
        authorId,
        message,
        aboutMe,
        callHistoryByCallId,
      });

      if (kind === NonBubbleResultKind.Drop) {
        return undefined;
      }

      if (kind === NonBubbleResultKind.Directed) {
        strictAssert(
          authorId,
          'Incoming/outgoing non-bubble messages require an author'
        );
        const me = this.#getOrPushPrivateRecipient({
          serviceId: aboutMe.aci,
        });

        if (authorId === me) {
          result.outgoing = this.#getOutgoingMessageDetails(
            message.sent_at,
            message,
            { conversationId: message.conversationId }
          );
        } else {
          result.incoming = this.#getIncomingMessageDetails(message);
        }
      } else if (kind === NonBubbleResultKind.Directionless) {
        result.directionless = {};
      } else {
        throw missingCaseError(kind);
      }

      return { ...result, ...patch };
    }

    const { contact, sticker } = message;
    if (isTapToView(message)) {
      result.viewOnceMessage = await this.#toViewOnceMessage({
        message,
      });
    } else if (message.deletedForEveryone) {
      result.remoteDeletedMessage = {};
    } else if (messageHasPaymentEvent(message)) {
      const { payment } = message;
      switch (payment.kind) {
        case PaymentEventKind.ActivationRequest: {
          result.directionless = {};
          result.updateMessage = {
            simpleUpdate: {
              type: Backups.SimpleChatUpdate.Type.PAYMENT_ACTIVATION_REQUEST,
            },
          };
          break;
        }
        case PaymentEventKind.Activation: {
          result.directionless = {};
          result.updateMessage = {
            simpleUpdate: {
              type: Backups.SimpleChatUpdate.Type.PAYMENTS_ACTIVATED,
            },
          };
          break;
        }
        case PaymentEventKind.Notification:
          result.paymentNotification = {
            note: payment.note ?? null,
            amountMob: payment.amountMob,
            feeMob: payment.feeMob,
            transactionDetails: payment.transactionDetailsBase64
              ? Backups.PaymentNotification.TransactionDetails.decode(
                  Bytes.fromBase64(payment.transactionDetailsBase64)
                )
              : undefined,
          };
          break;
        default:
          throw missingCaseError(payment);
      }
    } else if (contact && contact[0]) {
      const [contactDetails] = contact;
      const contactMessage = new Backups.ContactMessage();

      contactMessage.contact = {
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
        avatar: contactDetails.avatar?.avatar
          ? await this.#processAttachment({
              attachment: contactDetails.avatar.avatar,
              messageReceivedAt: message.received_at,
            })
          : undefined,
      };

      const reactions = this.#getMessageReactions(message);
      if (reactions != null) {
        contactMessage.reactions = reactions;
      }

      result.contactMessage = contactMessage;
    } else if (sticker) {
      const stickerProto = new Backups.Sticker();
      stickerProto.emoji = sticker.emoji;
      stickerProto.packId = Bytes.fromHex(sticker.packId);
      stickerProto.packKey = Bytes.fromBase64(sticker.packKey);
      stickerProto.stickerId = sticker.stickerId;
      stickerProto.data = sticker.data
        ? await this.#processAttachment({
            attachment: sticker.data,
            messageReceivedAt: message.received_at,
          })
        : undefined;

      result.stickerMessage = {
        sticker: stickerProto,
        reactions: this.#getMessageReactions(message),
      };
    } else if (isGiftBadge(message)) {
      const { giftBadge } = message;
      strictAssert(giftBadge != null, 'Message must have gift badge');

      if (giftBadge.state === GiftBadgeStates.Failed) {
        result.giftBadge = {
          state: Backups.GiftBadge.State.FAILED,
        };
      } else {
        let state: Backups.GiftBadge.State;
        switch (giftBadge.state) {
          case GiftBadgeStates.Unopened:
            state = Backups.GiftBadge.State.UNOPENED;
            break;
          case GiftBadgeStates.Opened:
            state = Backups.GiftBadge.State.OPENED;
            break;
          case GiftBadgeStates.Redeemed:
            state = Backups.GiftBadge.State.REDEEMED;
            break;
          default:
            throw missingCaseError(giftBadge);
        }

        result.giftBadge = {
          receiptCredentialPresentation: Bytes.fromBase64(
            giftBadge.receiptCredentialPresentation
          ),
          state,
        };
      }
    } else if (message.storyReplyContext) {
      result.directStoryReplyMessage = await this.#toDirectStoryReplyMessage({
        message,
      });

      result.revisions = await this.#toChatItemRevisions(result, message);
    } else if (message.poll) {
      const { poll } = message;
      const pollMessage = new Backups.Poll();

      pollMessage.question = poll.question;
      pollMessage.allowMultiple = poll.allowMultiple;
      pollMessage.hasEnded = poll.terminatedAt != null;

      pollMessage.options = poll.options.map((optionText, optionIndex) => {
        const pollOption = new Backups.Poll.PollOption();
        pollOption.option = optionText;

        const votesForThisOption = new Map<string, number>();

        if (poll.votes) {
          for (const vote of poll.votes) {
            // Skip votes that have not been sent
            if (vote.sendStateByConversationId) {
              continue;
            }

            // If we somehow have multiple votes from the same person
            // (shouldn't happen, just in case) only keep the highest voteCount
            const maybeExistingVoteFromThisConversation =
              votesForThisOption.get(vote.fromConversationId);
            if (
              vote.optionIndexes.includes(optionIndex) &&
              (!maybeExistingVoteFromThisConversation ||
                vote.voteCount > maybeExistingVoteFromThisConversation)
            ) {
              votesForThisOption.set(vote.fromConversationId, vote.voteCount);
            }
          }
        }

        pollOption.votes = Array.from(votesForThisOption.entries()).map(
          ([conversationId, voteCount]) => {
            const pollVote = new Backups.Poll.PollOption.PollVote();

            const voterConvo =
              window.ConversationController.get(conversationId);
            if (voterConvo) {
              pollVote.voterId = this.#getOrPushPrivateRecipient(
                voterConvo.attributes
              );
            }

            pollVote.voteCount = voteCount;
            return pollVote;
          }
        );

        return pollOption;
      });

      const reactions = this.#getMessageReactions(message);
      if (reactions != null) {
        pollMessage.reactions = reactions;
      }

      result.poll = pollMessage;
    } else if (message.pollTerminateNotification) {
      // TODO (DESKTOP-9282)
      return undefined;
    } else {
      result.standardMessage = await this.#toStandardMessage({
        message,
      });

      result.revisions = await this.#toChatItemRevisions(result, message);
    }

    if (isOutgoing) {
      result.outgoing = this.#getOutgoingMessageDetails(
        message.sent_at,
        message,
        { conversationId: message.conversationId }
      );
    } else {
      result.incoming = this.#getIncomingMessageDetails(message);
    }

    return result;
  }

  #aciToBytes(aci: AciString | string): Uint8Array {
    return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
  }

  #aciToBytesOrUndefined(aci: AciString | string): Uint8Array | undefined {
    if (isAciString(aci)) {
      return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
    }
    return undefined;
  }

  #serviceIdToBytes(serviceId: ServiceIdString): Uint8Array {
    return ServiceId.parseFromServiceIdString(serviceId).getRawUuidBytes();
  }

  async #toChatItemFromNonBubble(
    options: NonBubbleOptionsType
  ): Promise<NonBubbleResultType> {
    return this.toChatItemUpdate(options);
  }

  async toChatItemUpdate(
    options: NonBubbleOptionsType
  ): Promise<NonBubbleResultType> {
    const { authorId, callHistoryByCallId, message } = options;
    const logId = `toChatItemUpdate(${getMessageIdForLogging(message)})`;

    const updateMessage = new Backups.ChatUpdateMessage();

    const patch: Backups.IChatItem = {
      updateMessage,
    };

    if (isCallHistory(message)) {
      const conversation = window.ConversationController.get(
        message.conversationId
      );

      if (!conversation) {
        throw new Error(
          `${logId}: callHistory message had unknown conversationId!`
        );
      }

      const { callId } = message;
      if (!callId) {
        throw new Error(`${logId}: callHistory message was missing callId!`);
      }

      const callHistory = callHistoryByCallId[callId];
      if (!callHistory) {
        throw new Error(
          `${logId}: callHistory message had callId, but no call history details were found!`
        );
      }

      if (isGroup(conversation.attributes)) {
        const groupCall = new Backups.GroupCall();

        strictAssert(
          callHistory.mode === CallMode.Group,
          'in group, should be group call'
        );

        if (callHistory.status === GroupCallStatus.Deleted) {
          return { kind: NonBubbleResultKind.Drop };
        }

        const { ringerId, startedById } = callHistory;
        if (ringerId) {
          const ringerConversation =
            window.ConversationController.get(ringerId);
          if (!ringerConversation) {
            throw new Error(
              'toChatItemUpdate/callHistory: ringerId conversation not found!'
            );
          }

          const recipientId = this.#getRecipientId(
            ringerConversation.attributes
          );
          groupCall.ringerRecipientId = recipientId;
        }

        if (startedById) {
          const startedByConvo = window.ConversationController.get(startedById);
          if (!startedByConvo) {
            throw new Error(
              'toChatItemUpdate/callHistory: startedById conversation not found!'
            );
          }

          const recipientId = this.#getRecipientId(startedByConvo.attributes);
          groupCall.startedCallRecipientId = recipientId;
        }

        try {
          groupCall.callId = Long.fromString(callId);
        } catch (e) {
          // Could not convert callId to long; likely a legacy backfilled callId with uuid
          // TODO (DESKTOP-8007)
          groupCall.callId = Long.fromNumber(0);
        }

        groupCall.state = toGroupCallStateProto(callHistory.status);
        groupCall.startedCallTimestamp = Long.fromNumber(callHistory.timestamp);
        if (callHistory.endedTimestamp != null) {
          groupCall.endedCallTimestamp = getSafeLongFromTimestamp(
            callHistory.endedTimestamp
          );
        }
        groupCall.read = message.seenStatus === SeenStatus.Seen;

        updateMessage.groupCall = groupCall;
        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      const individualCall = new Backups.IndividualCall();
      const { direction, type, status, timestamp } = callHistory;

      if (status === GroupCallStatus.Deleted) {
        return { kind: NonBubbleResultKind.Drop };
      }

      try {
        individualCall.callId = Long.fromString(callId);
      } catch (e) {
        // TODO (DESKTOP-8007)
        // Could not convert callId to long; likely a legacy backfilled callId with uuid
        individualCall.callId = Long.fromNumber(0);
      }

      individualCall.type = toIndividualCallTypeProto(type);
      individualCall.direction = toIndividualCallDirectionProto(direction);
      individualCall.state = toIndividualCallStateProto(status, direction);
      individualCall.startedCallTimestamp = Long.fromNumber(timestamp);
      individualCall.read = message.seenStatus === SeenStatus.Seen;

      updateMessage.individualCall = individualCall;
      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isExpirationTimerUpdate(message)) {
      const expiresInSeconds = message.expirationTimerUpdate?.expireTimer;
      const expiresInMs =
        expiresInSeconds == null
          ? 0
          : DurationInSeconds.toMillis(expiresInSeconds);

      const conversation = window.ConversationController.get(
        message.conversationId
      );

      const source = message.expirationTimerUpdate?.source;
      const sourceServiceId = message.expirationTimerUpdate?.sourceServiceId;

      if (conversation && isGroup(conversation.attributes)) {
        const groupChatUpdate = new Backups.GroupChangeChatUpdate();

        const timerUpdate = new Backups.GroupExpirationTimerUpdate();
        timerUpdate.expiresInMs = Long.fromNumber(expiresInMs);

        if (sourceServiceId && Aci.parseFromServiceIdString(sourceServiceId)) {
          timerUpdate.updaterAci = uuidToBytes(sourceServiceId);
        }

        const innerUpdate = new Backups.GroupChangeChatUpdate.Update();

        innerUpdate.groupExpirationTimerUpdate = timerUpdate;

        groupChatUpdate.updates = [innerUpdate];

        updateMessage.groupChange = groupChatUpdate;

        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      if (!authorId) {
        if (sourceServiceId) {
          patch.authorId = this.#getOrPushPrivateRecipient({
            id: source,
            serviceId: sourceServiceId,
          });
        } else if (source) {
          patch.authorId = this.#getOrPushPrivateRecipient({
            id: source,
          });
        }
      }

      const expirationTimerChange = new Backups.ExpirationTimerChatUpdate();
      expirationTimerChange.expiresInMs = Long.fromNumber(expiresInMs);

      updateMessage.expirationTimerChange = expirationTimerChange;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isGroupV2Change(message)) {
      updateMessage.groupChange = await this.toGroupV2Update(message, options);
      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isKeyChange(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.IDENTITY_UPDATE;

      const conversation = window.ConversationController.get(
        message.conversationId
      );
      if (
        conversation &&
        isGroup(conversation.attributes) &&
        message.key_changed
      ) {
        const target = window.ConversationController.get(message.key_changed);
        if (!target) {
          log.warn(
            'toChatItemUpdate/keyChange: key_changed conversation not found!',
            message.key_changed
          );
          return { kind: NonBubbleResultKind.Drop };
        }
        // This will override authorId on the original chatItem
        patch.authorId = this.#getOrPushPrivateRecipient(target.attributes);
      }

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isPinnedMessageNotification(message)) {
      throw new Error('unimplemented');
    }

    if (isProfileChange(message)) {
      const profileChange = new Backups.ProfileChangeChatUpdate();
      if (!message.profileChange?.newName || !message.profileChange?.oldName) {
        return { kind: NonBubbleResultKind.Drop };
      }

      if (message.changedId) {
        const changedConvo = window.ConversationController.get(
          message.changedId
        );
        if (changedConvo) {
          // This will override authorId on the original chatItem
          patch.authorId = this.#getOrPushPrivateRecipient(changedConvo);
        } else {
          log.warn(
            `${logId}: failed to resolve changedId ${message.changedId}`
          );
        }
      }

      const { newName, oldName } = message.profileChange;
      profileChange.newName = newName;
      profileChange.previousName = oldName;

      updateMessage.profileChange = profileChange;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isVerifiedChange(message)) {
      if (!message.verifiedChanged) {
        throw new Error(
          `${logId}: Message was verifiedChange, but missing verifiedChange!`
        );
      }

      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = message.verified
        ? Backups.SimpleChatUpdate.Type.IDENTITY_VERIFIED
        : Backups.SimpleChatUpdate.Type.IDENTITY_DEFAULT;

      updateMessage.simpleUpdate = simpleUpdate;

      if (message.verifiedChanged) {
        // This will override authorId on the original chatItem
        patch.authorId = this.#getOrPushPrivateRecipient({
          id: message.verifiedChanged,
        });
      }

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isChangeNumberNotification(message)) {
      updateMessage.simpleUpdate = {
        type: Backups.SimpleChatUpdate.Type.CHANGE_NUMBER,
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isJoinedSignalNotification(message)) {
      updateMessage.simpleUpdate = {
        type: Backups.SimpleChatUpdate.Type.JOINED_SIGNAL,
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isTitleTransitionNotification(message)) {
      strictAssert(
        message.titleTransition != null,
        'Missing title transition data'
      );
      const { renderInfo } = message.titleTransition;
      if (renderInfo.e164) {
        updateMessage.learnedProfileChange = {
          e164: Long.fromString(renderInfo.e164),
        };
      } else {
        strictAssert(
          renderInfo.username,
          'Title transition must have username or e164'
        );
        updateMessage.learnedProfileChange = { username: renderInfo.username };
      }

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isMessageRequestResponse(message)) {
      const { messageRequestResponseEvent: event } = message;
      if (event == null) {
        return { kind: NonBubbleResultKind.Drop };
      }

      let type: Backups.SimpleChatUpdate.Type;
      const { Type } = Backups.SimpleChatUpdate;
      switch (event) {
        case MessageRequestResponseEvent.SPAM:
          type = Type.REPORTED_SPAM;
          break;
        case MessageRequestResponseEvent.BLOCK:
          type = Type.BLOCKED;
          break;
        case MessageRequestResponseEvent.UNBLOCK:
          type = Type.UNBLOCKED;
          break;
        case MessageRequestResponseEvent.ACCEPT:
          type = Type.MESSAGE_REQUEST_ACCEPTED;
          break;
        default:
          throw missingCaseError(event);
      }

      updateMessage.simpleUpdate = { type };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isDeliveryIssue(message)) {
      updateMessage.simpleUpdate = {
        type: Backups.SimpleChatUpdate.Type.BAD_DECRYPT,
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isConversationMerge(message)) {
      const threadMerge = new Backups.ThreadMergeChatUpdate();
      const e164 = message.conversationMerge?.renderInfo.e164;
      if (!e164) {
        return { kind: NonBubbleResultKind.Drop };
      }
      threadMerge.previousE164 = Long.fromString(e164);

      // Conversation merges generated on Desktop side never has
      // `sourceServiceId` and thus are attributed to our conversation.
      // However, we need to include proper `authorId` for compatibility with
      // other clients.
      patch.authorId = this.#getOrPushPrivateRecipient({
        id: message.conversationId,
      });

      updateMessage.threadMerge = threadMerge;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isPhoneNumberDiscovery(message)) {
      const e164 = message.phoneNumberDiscovery?.e164;
      if (!e164) {
        return { kind: NonBubbleResultKind.Drop };
      }

      updateMessage.sessionSwitchover = {
        e164: Long.fromString(e164),
      };
      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isUniversalTimerNotification(message)) {
      // Transient, drop it
      return { kind: NonBubbleResultKind.Drop };
    }

    if (isContactRemovedNotification(message)) {
      // Transient, drop it
      return { kind: NonBubbleResultKind.Drop };
    }

    // Create a GV2 tombstone for a deprecated GV1 notification
    if (isGroupUpdate(message)) {
      updateMessage.groupChange = {
        updates: [
          {
            genericGroupUpdate: {
              updaterAci: message.sourceServiceId
                ? this.#aciToBytesOrUndefined(message.sourceServiceId)
                : undefined,
            },
          },
        ],
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isUnsupportedMessage(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type =
        Backups.SimpleChatUpdate.Type.UNSUPPORTED_PROTOCOL_MESSAGE;

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
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

      if (invitedMemberCount > 0) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        const update = new Backups.GroupV2MigrationInvitedMembersUpdate();
        update.invitedMembersCount = invitedMemberCount;
        container.groupV2MigrationInvitedMembersUpdate = update;
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

      if (!addedItem) {
        const container = new Backups.GroupChangeChatUpdate.Update();
        container.groupV2MigrationUpdate = new Backups.GroupV2MigrationUpdate();
        groupChatUpdate.updates.push(container);
      }

      updateMessage.groupChange = groupChatUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isEndSession(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.END_SESSION;

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isChatSessionRefreshed(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.CHAT_SESSION_REFRESH;

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
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
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        update.groupCreationUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-attributes') {
        const innerUpdate =
          new Backups.GroupAttributesAccessLevelChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.accessLevel = detail.newPrivilege;

        update.groupAttributesAccessLevelChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-members') {
        const innerUpdate =
          new Backups.GroupMembershipAccessLevelChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.accessLevel = detail.newPrivilege;

        update.groupMembershipAccessLevelChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'access-invite-link') {
        const innerUpdate = new Backups.GroupInviteLinkAdminApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.linkRequiresAdminApproval =
          detail.newPrivilege ===
          SignalService.AccessControl.AccessRequired.ADMINISTRATOR;

        update.groupInviteLinkAdminApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'announcements-only') {
        const innerUpdate = new Backups.GroupAnnouncementOnlyChangeUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.isAnnouncementOnly = detail.announcementsOnly;

        update.groupAnnouncementOnlyChangeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'avatar') {
        const innerUpdate = new Backups.GroupAvatarUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.wasRemoved = detail.removed;

        update.groupAvatarUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'title') {
        const innerUpdate = new Backups.GroupNameUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.newGroupName = detail.newTitle;

        update.groupNameUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-add') {
        const innerUpdate = new Backups.GroupInviteLinkEnabledUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.linkRequiresAdminApproval =
          detail.privilege ===
          SignalService.AccessControl.AccessRequired.ADMINISTRATOR;

        update.groupInviteLinkEnabledUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-reset') {
        const innerUpdate = new Backups.GroupInviteLinkResetUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        update.groupInviteLinkResetUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'group-link-remove') {
        const innerUpdate = new Backups.GroupInviteLinkDisabledUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        update.groupInviteLinkDisabledUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add') {
        if (from && from === detail.aci) {
          const innerUpdate = new Backups.GroupMemberJoinedUpdate();
          innerUpdate.newMemberAci = this.#aciToBytes(from);

          update.groupMemberJoinedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberAddedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.newMemberAci = this.#aciToBytes(detail.aci);

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
          innerUpdate.newMemberAci = this.#aciToBytes(detail.aci);
          if (detail.inviter) {
            innerUpdate.inviterAci = this.#aciToBytes(detail.inviter);
          }
          update.groupInvitationAcceptedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberAddedUpdate();
        innerUpdate.newMemberAci = this.#aciToBytes(detail.aci);
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        if (detail.inviter) {
          innerUpdate.inviterAci = this.#aciToBytes(detail.inviter);
        }
        innerUpdate.hadOpenInvitation = true;

        update.groupMemberAddedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add-from-link') {
        const innerUpdate = new Backups.GroupMemberJoinedByLinkUpdate();
        innerUpdate.newMemberAci = this.#aciToBytes(detail.aci);

        update.groupMemberJoinedByLinkUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-add-from-admin-approval') {
        const innerUpdate = new Backups.GroupJoinRequestApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        innerUpdate.requestorAci = this.#aciToBytes(detail.aci);
        innerUpdate.wasApproved = true;

        update.groupJoinRequestApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-privilege') {
        const innerUpdate = new Backups.GroupAdminStatusUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        innerUpdate.memberAci = this.#aciToBytes(detail.aci);
        innerUpdate.wasAdminStatusGranted =
          detail.newPrivilege === SignalService.Member.Role.ADMINISTRATOR;

        update.groupAdminStatusUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'member-remove') {
        if (from && from === detail.aci) {
          const innerUpdate = new Backups.GroupMemberLeftUpdate();
          innerUpdate.aci = this.#aciToBytes(from);

          update.groupMemberLeftUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupMemberRemovedUpdate();
        if (from) {
          innerUpdate.removerAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.removedAci = this.#aciToBytes(detail.aci);

        update.groupMemberRemovedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-add-one') {
        if (
          (aboutMe.aci && detail.serviceId === aboutMe.aci) ||
          (aboutMe.pni && detail.serviceId === aboutMe.pni)
        ) {
          const innerUpdate = new Backups.SelfInvitedToGroupUpdate();
          if (from) {
            innerUpdate.inviterAci = this.#aciToBytesOrUndefined(from);
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
          innerUpdate.inviteeServiceId = this.#serviceIdToBytes(
            detail.serviceId
          );

          update.selfInvitedOtherUserToGroupUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupUnknownInviteeUpdate();
        if (from) {
          innerUpdate.inviterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.inviteeCount = 1;

        update.groupUnknownInviteeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-add-many') {
        const innerUpdate = new Backups.GroupUnknownInviteeUpdate();
        if (from) {
          innerUpdate.inviterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.inviteeCount = detail.count;

        update.groupUnknownInviteeUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-remove-one') {
        if ((from && from === detail.serviceId) || detail.serviceId == null) {
          const innerUpdate = new Backups.GroupInvitationDeclinedUpdate();
          if (detail.inviter) {
            innerUpdate.inviterAci = this.#aciToBytes(detail.inviter);
          }
          if (isAciString(detail.serviceId)) {
            innerUpdate.inviteeAci = this.#aciToBytes(detail.serviceId);
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
            innerUpdate.revokerAci = this.#aciToBytesOrUndefined(from);
          }

          update.groupSelfInvitationRevokedUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupInvitationRevokedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }
        innerUpdate.invitees = [
          {
            inviterAci: isAciString(detail.inviter)
              ? this.#aciToBytes(detail.inviter)
              : undefined,
            inviteeAci: isAciString(detail.serviceId)
              ? this.#aciToBytes(detail.serviceId)
              : undefined,
            inviteePni: isPniString(detail.serviceId)
              ? this.#serviceIdToBytes(detail.serviceId)
              : undefined,
          },
        ];

        update.groupInvitationRevokedUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'pending-remove-many') {
        const innerUpdate = new Backups.GroupInvitationRevokedUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
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
        innerUpdate.requestorAci = this.#aciToBytes(detail.aci);

        update.groupJoinRequestUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'admin-approval-remove-one') {
        if (from && detail.aci && from === detail.aci) {
          const innerUpdate = new Backups.GroupJoinRequestCanceledUpdate();
          innerUpdate.requestorAci = this.#aciToBytes(detail.aci);

          update.groupJoinRequestCanceledUpdate = innerUpdate;
          updates.push(update);
          return;
        }

        const innerUpdate = new Backups.GroupJoinRequestApprovalUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        innerUpdate.requestorAci = this.#aciToBytes(detail.aci);
        innerUpdate.wasApproved = false;

        update.groupJoinRequestApprovalUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'admin-approval-bounce') {
        // We can't express all we need in GroupSequenceOfRequestsAndCancelsUpdate, so we
        //   add an additional groupJoinRequestUpdate to express that there
        //   is an approval pending.
        if (detail.isApprovalPending) {
          const innerUpdate = new Backups.GroupJoinRequestUpdate();
          innerUpdate.requestorAci = this.#aciToBytes(detail.aci);

          // We need to create another update since the items we put in Update are oneof
          const secondUpdate = new Backups.GroupChangeChatUpdate.Update();
          secondUpdate.groupJoinRequestUpdate = innerUpdate;
          updates.push(secondUpdate);

          // not returning because we really do want both of these
        }

        const innerUpdate =
          new Backups.GroupSequenceOfRequestsAndCancelsUpdate();
        innerUpdate.requestorAci = this.#aciToBytes(detail.aci);
        innerUpdate.count = detail.times;

        update.groupSequenceOfRequestsAndCancelsUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'description') {
        const innerUpdate = new Backups.GroupDescriptionUpdate();
        innerUpdate.newDescription = detail.removed
          ? undefined
          : detail.description;
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
        }

        update.groupDescriptionUpdate = innerUpdate;
        updates.push(update);
      } else if (type === 'summary') {
        const innerUpdate = new Backups.GenericGroupUpdate();
        if (from) {
          innerUpdate.updaterAci = this.#aciToBytesOrUndefined(from);
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

  async #toQuote({
    message,
  }: {
    message: Pick<MessageAttributesType, 'quote' | 'received_at' | 'body'>;
  }): Promise<Backups.IQuote | null> {
    const { quote } = message;
    if (!quote) {
      return null;
    }

    let authorId: Long;
    if (quote.authorAci) {
      authorId = this.#getOrPushPrivateRecipient({
        serviceId: quote.authorAci,
        e164: quote.author,
      });
    } else if (quote.author) {
      authorId = this.#getOrPushPrivateRecipient({
        serviceId: quote.authorAci,
        e164: quote.author,
      });
    } else {
      log.warn('quote has no author id');
      return null;
    }

    let quoteType: Backups.Quote.Type;
    if (quote.isGiftBadge) {
      quoteType = Backups.Quote.Type.GIFT_BADGE;
    } else if (quote.isViewOnce) {
      quoteType = Backups.Quote.Type.VIEW_ONCE;
    } else if (quote.isPoll) {
      quoteType = Backups.Quote.Type.POLL;
    } else {
      quoteType = Backups.Quote.Type.NORMAL;
      if (quote.text == null && quote.attachments.length === 0) {
        log.warn('normal quote has no text or attachments');
        return null;
      }
    }

    return {
      targetSentTimestamp:
        quote.referencedMessageNotFound || quote.id == null
          ? null
          : Long.fromNumber(quote.id),
      authorId,
      text:
        quote.text != null
          ? {
              body: trimBody(quote.text, BACKUP_QUOTE_BODY_LIMIT),
              bodyRanges: quote.bodyRanges?.map(range =>
                this.#toBodyRange(range)
              ),
            }
          : null,
      attachments: await Promise.all(
        quote.attachments.map(
          async (
            attachment: QuotedAttachmentType
          ): Promise<Backups.Quote.IQuotedAttachment> => {
            return {
              contentType: attachment.contentType,
              fileName: attachment.fileName,
              thumbnail: attachment.thumbnail
                ? await this.#processMessageAttachment({
                    attachment: attachment.thumbnail,
                    message,
                  })
                : undefined,
            };
          }
        )
      ),
      type: quoteType,
    };
  }

  #toBodyRange(range: RawBodyRange): Backups.IBodyRange {
    return {
      start: range.start,
      length: range.length,

      ...('mentionAci' in range
        ? {
            mentionAci: this.#aciToBytes(range.mentionAci),
          }
        : {
            // Numeric values are compatible between backup and message protos
            style: range.style,
          }),
    };
  }

  #getMessageAttachmentFlag(
    message: Pick<MessageAttributesType, 'body'>,
    attachment: AttachmentType
  ): Backups.MessageAttachment.Flag {
    const flag = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
    // eslint-disable-next-line no-bitwise
    if (((attachment.flags || 0) & flag) === flag) {
      // Legacy data support for iOS
      if (message.body) {
        return Backups.MessageAttachment.Flag.NONE;
      }

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

  async #processMessageAttachment({
    attachment,
    message,
  }: {
    attachment: AttachmentType;
    message: Pick<MessageAttributesType, 'quote' | 'received_at' | 'body'>;
  }): Promise<Backups.MessageAttachment> {
    const { clientUuid } = attachment;
    const filePointer = await this.#processAttachment({
      attachment,
      messageReceivedAt: message.received_at,
    });

    return new Backups.MessageAttachment({
      pointer: filePointer,
      flag: this.#getMessageAttachmentFlag(message, attachment),
      wasDownloaded: isDownloaded(attachment),
      clientUuid: clientUuid ? uuidToBytes(clientUuid) : undefined,
    });
  }

  async #processAttachment({
    attachment,
    messageReceivedAt,
  }: {
    attachment: AttachmentType;
    messageReceivedAt: number;
  }): Promise<Backups.FilePointer> {
    const { filePointer, backupJob } = await getFilePointerForAttachment({
      attachment,
      backupOptions: this.options,
      messageReceivedAt,
      getBackupCdnInfo,
    });

    let mediaName: string | undefined;
    if (
      this.options.type === 'local-encrypted' ||
      this.options.type === 'plaintext-export'
    ) {
      if (hasRequiredInformationForLocalBackup(attachment)) {
        mediaName = getLocalBackupFileNameForAttachment(attachment);
      }
    } else if (hasRequiredInformationForRemoteBackup(attachment)) {
      mediaName = getMediaNameForAttachment(attachment);
    }

    if (mediaName) {
      // Re-use existing locatorInfo and backup job if we've already seen this file
      const existingFilePointer = this.#mediaNamesToFilePointers.get(mediaName);

      if (existingFilePointer?.locatorInfo) {
        filePointer.locatorInfo = existingFilePointer.locatorInfo;
        // Also copy over incrementalMac, since that depends on the encryption key
        filePointer.incrementalMac = existingFilePointer.incrementalMac;
        filePointer.incrementalMacChunkSize =
          existingFilePointer.incrementalMacChunkSize;
      } else {
        if (filePointer.locatorInfo) {
          this.#mediaNamesToFilePointers.set(mediaName, filePointer);
        }
        if (backupJob) {
          this.#attachmentBackupJobs.push(backupJob);
        }
      }
    }

    return filePointer;
  }

  #getMessageReactions({
    reactions,
  }: Pick<MessageAttributesType, 'reactions'>):
    | Array<Backups.IReaction>
    | undefined {
    if (reactions == null) {
      return undefined;
    }

    return reactions?.map((reaction, sortOrder) => {
      return {
        emoji: reaction.emoji,
        authorId: this.#getOrPushPrivateRecipient({
          id: reaction.fromId,
        }),
        sentTimestamp: getSafeLongFromTimestamp(reaction.timestamp),
        sortOrder: Long.fromNumber(sortOrder),
      };
    });
  }

  #getIncomingMessageDetails({
    received_at_ms: receivedAtMs,
    editMessageReceivedAtMs,
    serverTimestamp,
    readStatus,
    unidentifiedDeliveryReceived,
  }: Pick<
    MessageAttributesType,
    | 'received_at_ms'
    | 'editMessageReceivedAtMs'
    | 'serverTimestamp'
    | 'readStatus'
    | 'unidentifiedDeliveryReceived'
  >): Backups.ChatItem.IIncomingMessageDetails {
    const dateReceived = editMessageReceivedAtMs || receivedAtMs;
    return {
      dateReceived:
        dateReceived != null ? getSafeLongFromTimestamp(dateReceived) : null,
      dateServerSent:
        serverTimestamp != null
          ? getSafeLongFromTimestamp(serverTimestamp)
          : null,
      read: readStatus === ReadStatus.Read || readStatus === ReadStatus.Viewed,
      sealedSender: unidentifiedDeliveryReceived === true,
    };
  }

  #getOutgoingMessageDetails(
    sentAt: number,
    {
      sendStateByConversationId = {},
      unidentifiedDeliveries = [],
      errors = [],
      received_at_ms: receivedAtMs,
      editMessageReceivedAtMs,
    }: Pick<
      MessageAttributesType,
      | 'sendStateByConversationId'
      | 'unidentifiedDeliveries'
      | 'errors'
      | 'received_at_ms'
      | 'editMessageReceivedAtMs'
    >,
    { conversationId }: { conversationId: string }
  ): Backups.ChatItem.IOutgoingMessageDetails {
    const sealedSenderServiceIds = new Set(unidentifiedDeliveries);
    const errorMap = new Map(
      errors.map(({ serviceId, name }) => {
        return [serviceId, name];
      })
    );

    const sendStatuses = new Array<Backups.ISendStatus>();
    for (const [id, entry] of Object.entries(sendStateByConversationId)) {
      const target = window.ConversationController.get(id);
      if (!target) {
        log.warn(`no send target for a message ${sentAt}`);
        continue;
      }

      // Filter out our conversationId from non-"Note-to-Self" messages
      // TODO: DESKTOP-8089
      strictAssert(this.#ourConversation?.id, 'our conversation must exist');
      if (
        id === this.#ourConversation.id &&
        conversationId !== this.#ourConversation.id
      ) {
        continue;
      }

      const { serviceId } = target.attributes;
      const recipientId = this.#getOrPushPrivateRecipient(target.attributes);
      const timestamp =
        entry.updatedAt != null
          ? getSafeLongFromTimestamp(entry.updatedAt)
          : null;

      const sendStatus = new Backups.SendStatus({ recipientId, timestamp });

      const sealedSender = serviceId
        ? sealedSenderServiceIds.has(serviceId)
        : false;

      switch (entry.status) {
        case SendStatus.Pending:
          sendStatus.pending = new Backups.SendStatus.Pending();
          break;
        case SendStatus.Sent:
          sendStatus.sent = new Backups.SendStatus.Sent({
            sealedSender,
          });
          break;
        case SendStatus.Delivered:
          sendStatus.delivered = new Backups.SendStatus.Delivered({
            sealedSender,
          });
          break;
        case SendStatus.Read:
          sendStatus.read = new Backups.SendStatus.Read({
            sealedSender,
          });
          break;
        case SendStatus.Viewed:
          sendStatus.viewed = new Backups.SendStatus.Viewed({
            sealedSender,
          });
          break;
        case SendStatus.Skipped:
          sendStatus.skipped = {};
          break;
        case SendStatus.Failed: {
          sendStatus.failed = new Backups.SendStatus.Failed();
          if (!serviceId) {
            break;
          }
          const errorName = errorMap.get(serviceId);
          if (!errorName) {
            break;
          }

          const identityKeyMismatch = errorName === 'OutgoingIdentityKeyError';
          if (identityKeyMismatch) {
            sendStatus.failed.reason =
              Backups.SendStatus.Failed.FailureReason.IDENTITY_KEY_MISMATCH;
          } else if (errorName === 'UnknownError') {
            // See ts/backups/import.ts
            sendStatus.failed.reason =
              Backups.SendStatus.Failed.FailureReason.UNKNOWN;
          } else {
            sendStatus.failed.reason =
              Backups.SendStatus.Failed.FailureReason.NETWORK;
          }
          break;
        }
        default:
          throw missingCaseError(entry.status);
      }

      sendStatuses.push(sendStatus);
    }

    const dateReceived = editMessageReceivedAtMs || receivedAtMs;
    return {
      sendStatus: sendStatuses,
      dateReceived:
        dateReceived != null ? getSafeLongFromTimestamp(dateReceived) : null,
    };
  }

  async #toStandardMessage({
    message,
  }: {
    message: Pick<
      MessageAttributesType,
      | 'quote'
      | 'attachments'
      | 'body'
      | 'bodyAttachment'
      | 'bodyRanges'
      | 'preview'
      | 'reactions'
      | 'received_at'
      | 'timestamp'
    >;
  }): Promise<Backups.IStandardMessage> {
    if (
      message.body &&
      isBodyTooLong(message.body, MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH)
    ) {
      log.warn(`${message.timestamp}: Message body is too long; will truncate`);
    }

    return {
      quote: await this.#toQuote({
        message,
      }),
      attachments: message.attachments?.length
        ? await Promise.all(
            message.attachments.map(attachment => {
              return this.#processMessageAttachment({
                attachment,
                message,
              });
            })
          )
        : undefined,
      ...(await this.#toTextAndLongTextFields(message)),
      linkPreview: message.preview
        ? await Promise.all(
            message.preview.map(async preview => {
              return {
                url: preview.url,
                title: preview.title,
                description: preview.description,
                date: getSafeLongFromTimestamp(preview.date),
                image: preview.image
                  ? await this.#processAttachment({
                      attachment: preview.image,
                      messageReceivedAt: message.received_at,
                    })
                  : undefined,
              };
            })
          )
        : undefined,
      reactions: this.#getMessageReactions(message),
    };
  }

  async #toDirectStoryReplyMessage({
    message,
  }: {
    message: Pick<
      MessageAttributesType,
      | 'body'
      | 'bodyAttachment'
      | 'bodyRanges'
      | 'storyReaction'
      | 'received_at'
      | 'reactions'
    >;
  }): Promise<Backups.IDirectStoryReplyMessage> {
    const result = new Backups.DirectStoryReplyMessage({
      reactions: this.#getMessageReactions(message),
    });

    if (message.storyReaction) {
      result.emoji = message.storyReaction.emoji;
    } else {
      result.textReply = await this.#toTextAndLongTextFields(message);
    }
    return result;
  }

  async #toTextAndLongTextFields(
    message: Pick<
      MessageAttributesType,
      'bodyAttachment' | 'body' | 'bodyRanges' | 'received_at'
    >
  ): Promise<{
    longText: Backups.IFilePointer | undefined;
    text: Backups.IText | undefined;
  }> {
    const includeLongTextAttachment =
      message.bodyAttachment && !isDownloaded(message.bodyAttachment);
    const includeText =
      Boolean(message.body) || Boolean(message.bodyRanges?.length);

    return {
      longText:
        // We only include the bodyAttachment if it's not downloaded; otherwise all text
        // is inlined
        includeLongTextAttachment && message.bodyAttachment
          ? await this.#processAttachment({
              attachment: message.bodyAttachment,
              messageReceivedAt: message.received_at,
            })
          : undefined,
      text: includeText
        ? {
            body: message.body
              ? trimBody(
                  message.body,
                  includeLongTextAttachment
                    ? MAX_MESSAGE_BODY_BYTE_LENGTH
                    : MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH
                )
              : undefined,
            bodyRanges: message.bodyRanges?.map(range =>
              this.#toBodyRange(range)
            ),
          }
        : undefined,
    };
  }

  async #toViewOnceMessage({
    message,
  }: {
    message: Pick<
      MessageAttributesType,
      'attachments' | 'received_at' | 'reactions'
    >;
  }): Promise<Backups.IViewOnceMessage> {
    const attachment = message.attachments?.at(0);
    // Integration tests use the 'link-and-sync' version of export, which will include
    // view-once attachments
    const shouldIncludeAttachments =
      this.options.type !== 'plaintext-export' && isTestOrMockEnvironment();
    return {
      attachment:
        !shouldIncludeAttachments || attachment == null
          ? null
          : await this.#processMessageAttachment({
              attachment,
              message,
            }),
      reactions: this.#getMessageReactions(message),
    };
  }

  async #toChatItemRevisions(
    parent: Backups.IChatItem,
    message: MessageAttributesType
  ): Promise<Array<Backups.IChatItem> | undefined> {
    const { editHistory } = message;
    if (editHistory == null) {
      return undefined;
    }

    const isOutgoing = message.type === 'outgoing';

    return Promise.all(
      editHistory
        // The first history is the copy of the current message
        .slice(1)
        .map(async history => {
          const result: Backups.IChatItem = {
            // Required fields
            chatId: parent.chatId,
            authorId: parent.authorId,
            dateSent: getSafeLongFromTimestamp(history.timestamp),
            expireStartDate: parent.expireStartDate,
            expiresInMs: parent.expiresInMs,
            sms: parent.sms,

            // Directional details
            outgoing: isOutgoing
              ? this.#getOutgoingMessageDetails(history.timestamp, history, {
                  conversationId: message.conversationId,
                })
              : undefined,
            incoming: isOutgoing
              ? undefined
              : this.#getIncomingMessageDetails(history),
          };

          if (parent.directStoryReplyMessage) {
            result.directStoryReplyMessage =
              await this.#toDirectStoryReplyMessage({
                message: history,
              });
          } else {
            result.standardMessage = await this.#toStandardMessage({
              message: history,
            });
          }
          return result;
        })
        // Backups use oldest to newest order
        .reverse()
    );
  }

  #toCustomChatColors(): Array<Backups.ChatStyle.ICustomChatColor> {
    const customColors = itemStorage.get('customColors');
    if (!customColors) {
      return [];
    }

    const { order = [] } = customColors;
    const map = new Map(
      order
        .map((id: string): [string, CustomColorType] | undefined => {
          const color = customColors.colors[id];
          if (color == null) {
            return undefined;
          }
          return [id, color];
        })
        .filter(isNotNil)
    );

    // Add colors not present in the order list
    for (const [uuid, color] of Object.entries(customColors.colors)) {
      if (map.has(uuid)) {
        continue;
      }
      map.set(uuid, color);
    }

    const result = new Array<Backups.ChatStyle.ICustomChatColor>();
    for (const [uuid, color] of map.entries()) {
      const id = Long.fromNumber(result.length + 1);
      this.#customColorIdByUuid.set(uuid, id);

      const start = desktopHslToRgbInt(
        color.start.hue,
        color.start.saturation,
        color.start.lightness
      );

      if (color.end == null) {
        result.push({
          id,
          solid: start,
        });
      } else {
        const end = desktopHslToRgbInt(
          color.end.hue,
          color.end.saturation,
          color.end.lightness
        );

        result.push({
          id,
          gradient: {
            colors: [start, end],
            positions: [0, 1],
            angle: color.deg,
          },
        });
      }
    }

    return result;
  }

  #toDefaultChatStyle(): Backups.IChatStyle | null {
    const defaultColor = itemStorage.get('defaultConversationColor');
    const wallpaperPhotoPointer = itemStorage.get(
      'defaultWallpaperPhotoPointer'
    );
    const wallpaperPreset = itemStorage.get('defaultWallpaperPreset');
    const dimWallpaperInDarkMode = itemStorage.get(
      'defaultDimWallpaperInDarkMode',
      false
    );
    const autoBubbleColor = itemStorage.get('defaultAutoBubbleColor');

    return this.#toChatStyle({
      wallpaperPhotoPointer,
      wallpaperPreset,
      color: defaultColor?.color,
      customColorId: defaultColor?.customColorData?.id,
      dimWallpaperInDarkMode,
      autoBubbleColor,
    });
  }

  #toChatStyle({
    wallpaperPhotoPointer,
    wallpaperPreset,
    color,
    customColorId,
    dimWallpaperInDarkMode,
    autoBubbleColor,
  }: LocalChatStyle): Backups.IChatStyle | null {
    const result: Backups.IChatStyle = {
      dimWallpaperInDarkMode,
    };

    // The defaults
    if (
      (color == null || color === 'ultramarine') &&
      wallpaperPhotoPointer == null &&
      wallpaperPreset == null &&
      !dimWallpaperInDarkMode &&
      (autoBubbleColor === true || autoBubbleColor == null)
    ) {
      return null;
    }

    if (Bytes.isNotEmpty(wallpaperPhotoPointer)) {
      result.wallpaperPhoto = Backups.FilePointer.decode(wallpaperPhotoPointer);
    } else if (wallpaperPreset) {
      result.wallpaperPreset = wallpaperPreset;
    }

    if (color == null || autoBubbleColor) {
      result.autoBubbleColor = {};
      return result;
    }

    if (color === 'custom') {
      strictAssert(
        customColorId != null,
        'No custom color id for custom color'
      );

      const index = this.#customColorIdByUuid.get(customColorId);
      strictAssert(index != null, 'Missing custom color');

      result.customColorId = index;
      return result;
    }

    const { BubbleColorPreset } = Backups.ChatStyle;

    switch (color) {
      case 'ultramarine':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_ULTRAMARINE;
        break;
      case 'crimson':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_CRIMSON;
        break;
      case 'vermilion':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_VERMILION;
        break;
      case 'burlap':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_BURLAP;
        break;
      case 'forest':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_FOREST;
        break;
      case 'wintergreen':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_WINTERGREEN;
        break;
      case 'teal':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_TEAL;
        break;
      case 'blue':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_BLUE;
        break;
      case 'indigo':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_INDIGO;
        break;
      case 'violet':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_VIOLET;
        break;
      case 'plum':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_PLUM;
        break;
      case 'taupe':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_TAUPE;
        break;
      case 'steel':
        result.bubbleColorPreset = BubbleColorPreset.SOLID_STEEL;
        break;
      case 'ember':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_EMBER;
        break;
      case 'midnight':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_MIDNIGHT;
        break;
      case 'infrared':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_INFRARED;
        break;
      case 'lagoon':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_LAGOON;
        break;
      case 'fluorescent':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_FLUORESCENT;
        break;
      case 'basil':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_BASIL;
        break;
      case 'sublime':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_SUBLIME;
        break;
      case 'sea':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_SEA;
        break;
      case 'tangerine':
        result.bubbleColorPreset = BubbleColorPreset.GRADIENT_TANGERINE;
        break;
      default:
        throw missingCaseError(color);
    }

    return result;
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

function desktopHslToRgbInt(
  hue: number,
  saturation: number,
  lightness?: number
): number {
  // Desktop stores saturation not as 0.123 (0 to 1.0) but 12.3 (percentage)
  return hslToRGBInt(
    hue,
    saturation / 100,
    lightness ?? calculateLightness(hue)
  );
}

function toGroupCallStateProto(state: CallStatus): Backups.GroupCall.State {
  const values = Backups.GroupCall.State;

  if (state === GroupCallStatus.GenericGroupCall) {
    return values.GENERIC;
  }
  if (state === GroupCallStatus.OutgoingRing) {
    return values.OUTGOING_RING;
  }
  if (state === GroupCallStatus.Ringing) {
    return values.RINGING;
  }
  if (state === GroupCallStatus.Joined) {
    return values.JOINED;
  }
  if (state === GroupCallStatus.Accepted) {
    return values.ACCEPTED;
  }
  if (state === GroupCallStatus.Missed) {
    return values.MISSED;
  }
  if (state === GroupCallStatus.MissedNotificationProfile) {
    return values.MISSED_NOTIFICATION_PROFILE;
  }
  if (state === GroupCallStatus.Declined) {
    return values.DECLINED;
  }
  if (state === GroupCallStatus.Deleted) {
    throw new Error(
      'groupCallStatusToGroupCallState: Never back up deleted items!'
    );
  }

  return values.UNKNOWN_STATE;
}

function toIndividualCallDirectionProto(
  direction: CallDirection
): Backups.IndividualCall.Direction {
  const values = Backups.IndividualCall.Direction;

  if (direction === CallDirection.Incoming) {
    return values.INCOMING;
  }
  if (direction === CallDirection.Outgoing) {
    return values.OUTGOING;
  }

  return values.UNKNOWN_DIRECTION;
}

function toIndividualCallTypeProto(
  type: CallType
): Backups.IndividualCall.Type {
  const values = Backups.IndividualCall.Type;

  if (type === CallType.Audio) {
    return values.AUDIO_CALL;
  }
  if (type === CallType.Video) {
    return values.VIDEO_CALL;
  }

  return values.UNKNOWN_TYPE;
}

function toIndividualCallStateProto(
  status: CallStatus,
  direction: CallDirection
): Backups.IndividualCall.State {
  const values = Backups.IndividualCall.State;

  if (status === DirectCallStatus.Accepted) {
    return values.ACCEPTED;
  }
  if (status === DirectCallStatus.Declined) {
    return values.NOT_ACCEPTED;
  }
  if (status === DirectCallStatus.Missed) {
    return values.MISSED;
  }
  if (status === DirectCallStatus.MissedNotificationProfile) {
    return values.MISSED_NOTIFICATION_PROFILE;
  }

  if (status === DirectCallStatus.Pending) {
    if (direction === CallDirection.Incoming) {
      return values.MISSED;
    }
    if (direction === CallDirection.Outgoing) {
      return values.NOT_ACCEPTED;
    }
  }

  if (status === DirectCallStatus.Deleted) {
    throw new Error(
      'statusToIndividualCallProtoEnum: Never back up deleted items!'
    );
  }

  return values.UNKNOWN_STATE;
}

function toAdHocCallStateProto(status: CallStatus): Backups.AdHocCall.State {
  const values = Backups.AdHocCall.State;

  if (status === AdhocCallStatus.Generic) {
    return values.GENERIC;
  }
  if (status === AdhocCallStatus.Joined) {
    return values.GENERIC;
  }
  if (status === AdhocCallStatus.Pending) {
    return values.GENERIC;
  }

  return values.UNKNOWN_STATE;
}

function toCallLinkRestrictionsProto(
  restrictions: CallLinkRestrictions
): Backups.CallLink.Restrictions {
  const values = Backups.CallLink.Restrictions;

  if (restrictions === CallLinkRestrictions.None) {
    return values.NONE;
  }
  if (restrictions === CallLinkRestrictions.AdminApproval) {
    return values.ADMIN_APPROVAL;
  }

  return values.UNKNOWN;
}

function toAvatarColor(
  color: string | undefined
): Backups.AvatarColor | undefined {
  switch (color) {
    case 'A100':
      return Backups.AvatarColor.A100;
    case 'A110':
      return Backups.AvatarColor.A110;
    case 'A120':
      return Backups.AvatarColor.A120;
    case 'A130':
      return Backups.AvatarColor.A130;
    case 'A140':
      return Backups.AvatarColor.A140;
    case 'A150':
      return Backups.AvatarColor.A150;
    case 'A160':
      return Backups.AvatarColor.A160;
    case 'A170':
      return Backups.AvatarColor.A170;
    case 'A180':
      return Backups.AvatarColor.A180;
    case 'A190':
      return Backups.AvatarColor.A190;
    case 'A200':
      return Backups.AvatarColor.A200;
    case 'A210':
      return Backups.AvatarColor.A210;
    default:
      return undefined;
  }
}
