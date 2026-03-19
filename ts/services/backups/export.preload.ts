// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import { BackupJsonExporter } from '@signalapp/libsignal-client/dist/MessageBackup.js';
import { pMapIterable } from 'p-map';
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
  PageBackupMessagesCursorType,
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
  type PniString,
  type AciString,
  type ServiceIdString,
} from '../../types/ServiceId.std.js';
import {
  bodyRangeSchema,
  type RawBodyRange,
} from '../../types/BodyRange.std.js';
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
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc.node.js';
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
import type { PinnedMessage } from '../../types/PinnedMessage.std.js';
import type { ThemeType } from '../../util/preload.preload.js';
import { MAX_VALUE as LONG_MAX_VALUE } from '../../util/long.std.js';
import { encodeDelimited } from '../../util/encodeDelimited.std.js';
import { safeParseStrict } from '../../util/schemas.std.js';
import type { WithRequiredProperties } from '../../types/Util.std.js';

const { isNumber } = lodash;

const log = createLogger('backupExport');

// We only run 4 sql workers so going much higher doesn't help
const MAX_CONCURRENCY = 8;

// We want a very generous timeout to make sure that we always resume write
// access to the database.
const FLUSH_TIMEOUT = 30 * MINUTE;

// Threshold for reporting slow flushes
const REPORTING_THRESHOLD = SECOND;

const MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH = 128 * KIBIBYTE;
const BACKUP_QUOTE_BODY_LIMIT = 2048;

type ToRecipientOptionsType = Readonly<{
  identityKeysById: ReadonlyMap<IdentityKeyType['id'], IdentityKeyType>;
  keyTransparencyData: Uint8Array<ArrayBuffer> | undefined;
}>;

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
  pinnedMessagesByMessageId: Record<string, PinnedMessage>;
}>;

type NonBubbleOptionsType = Pick<
  ToChatItemOptionsType,
  'aboutMe' | 'callHistoryByCallId'
> &
  Readonly<{
    authorId: bigint | undefined;
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
      patch: {
        item: Backups.ChatItem.Params['item'];
        authorId?: bigint;
      };
    }
>;

export class BackupExportStream extends Readable {
  // Shared between all methods for consistency.
  #now = Date.now();

  readonly #backupTimeMs = getSafeLongFromTimestamp(this.#now);
  readonly #convoIdToRecipientId = new Map<string, bigint>();
  readonly #serviceIdToRecipientId = new Map<string, bigint>();
  readonly #e164ToRecipientId = new Map<string, bigint>();
  readonly #roomIdToRecipientId = new Map<string, bigint>();
  readonly #mediaNamesToFilePointers = new Map<
    string,
    Backups.FilePointer.Params
  >();
  readonly #stats: Omit<StatsType, 'unknownConversationReferences'> & {
    unknownConversationReferences: Map<string, number>;
  } = {
    adHocCalls: 0,
    callLinks: 0,
    conversations: 0,
    chatFolders: 0,
    chats: 0,
    distributionLists: 0,
    fixedDirectMessages: 0,
    messages: 0,
    notificationProfiles: 0,
    skippedConversations: 0,
    skippedMessages: 0,
    stickerPacks: 0,
    unknownConversationReferences: new Map<string, number>(),
  };
  #ourConversation?: ConversationAttributesType;
  #attachmentBackupJobs: Array<
    CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType
  > = [];
  #buffers = new Array<Uint8Array<ArrayBuffer>>();
  #nextRecipientId = 1n;
  #flushResolve: (() => void) | undefined;
  #jsonExporter: BackupJsonExporter | undefined;

  // Map from custom color uuid to an index in accountSettings.customColors
  // array.
  #customColorIdByUuid = new Map<string, bigint>();

  constructor(
    private readonly options: Readonly<BackupExportOptions> & {
      validationRun?: boolean;
    }
  ) {
    super();
  }

  async #cleanupAfterError() {
    log.warn('Cleaning up after error...');
    await resumeWriteAccess();
  }

  override _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void
  ): void {
    if (error) {
      drop(this.#cleanupAfterError());
    }
    callback(error);
  }

  public run(): void {
    drop(
      (async () => {
        log.info('starting...');
        drop(AttachmentBackupManager.stop());
        log.info('message migration starting...');
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
                      "Can't enqueue local backup jobs during remote backup, skipping"
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
          await this.#cleanupAfterError();
          log.error('errored', toLogFormat(error));
          this.emit('error', error);
        } finally {
          drop(AttachmentBackupManager.start());
        }
      })()
    );
  }

  public getMediaNames(): Array<string> {
    return [...this.#mediaNamesToFilePointers.keys()];
  }

  public getStats(): Readonly<StatsType> {
    return {
      ...this.#stats,
      unknownConversationReferences: Object.fromEntries(
        this.#stats.unknownConversationReferences
      ),
    };
  }
  public getAttachmentBackupJobs(): ReadonlyArray<
    CoreAttachmentBackupJobType | CoreAttachmentLocalBackupJobType
  > {
    return this.#attachmentBackupJobs;
  }

  async #unsafeRun(): Promise<void> {
    this.#ourConversation =
      window.ConversationController.getOurConversationOrThrow().attributes;
    const backupInfo: Backups.BackupInfo.Params = {
      version: BACKUP_VERSION,
      backupTimeMs: this.#backupTimeMs,
      mediaRootBackupKey: getBackupMediaRootKey().serialize(),
      firstAppVersion: itemStorage.get('restoredBackupFirstAppVersion') ?? null,
      currentAppVersion: `Desktop ${window.getVersion()}`,
      debugInfo: null,
    };

    if (this.options.type === 'plaintext-export') {
      const { exporter, chunk: initialChunk } = BackupJsonExporter.start(
        Backups.BackupInfo.encode(backupInfo),
        { validate: false }
      );

      this.#jsonExporter = exporter;
      this.push(`${initialChunk}\n`);
    } else {
      for (const chunk of encodeDelimited(
        Backups.BackupInfo.encode(backupInfo)
      )) {
        this.push(chunk);
      }
    }

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

    const ktAcis = new Set(await DataReader.getAllKTAcis());

    const skippedConversationIds = new Set<string>();
    for (const { attributes } of window.ConversationController.getAll()) {
      let keyTransparencyData: Uint8Array<ArrayBuffer> | undefined;
      if (
        isDirectConversation(attributes) &&
        isAciString(attributes.serviceId) &&
        ktAcis.has(attributes.serviceId)
      ) {
        // eslint-disable-next-line no-await-in-loop
        keyTransparencyData = await DataReader.getKTAccountData(
          attributes.serviceId
        );
      }

      const recipient = this.#toRecipient(attributes, {
        identityKeysById,
        keyTransparencyData,
      });
      if (recipient == null) {
        skippedConversationIds.add(attributes.id);
        this.#stats.skippedConversations += 1;
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
        id: this.#getNextRecipientId(),
        destination: { releaseNotes: {} },
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
          id: this.#getNextRecipientId(),
          destination: {
            distributionList: {
              distributionId: uuidToBytes(list.id),
              item: list.deletedAtTimestamp
                ? {
                    deletionTimestamp: BigInt(list.deletedAtTimestamp),
                  }
                : {
                    distributionList: {
                      name: list.name,
                      allowReplies: list.allowsReplies,
                      privacyMode,
                      memberRecipientIds: list.members
                        .map(serviceId =>
                          this.#getRecipientByServiceId(
                            serviceId,
                            'distributionList.memberRecipientIds'
                          )
                        )
                        .filter(isNotNil),
                    },
                  },
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
      // @ts-expect-error needs ringrtc update
      const rootKeyBytes: Uint8Array<ArrayBuffer> = rootKey.bytes;
      const roomId = getRoomIdFromRootKey(rootKey);

      this.#roomIdToRecipientId.set(roomId, id);

      this.#pushFrame({
        recipient: {
          id,
          destination: {
            callLink: {
              rootKey: rootKeyBytes,
              adminKey: adminKey ? toAdminKeyBytes(adminKey) : null,
              name,
              restrictions: toCallLinkRestrictionsProto(restrictions),
              expirationMs: isNumber(expiration)
                ? getSafeLongFromTimestamp(expiration)
                : null,
            },
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
      if (skippedConversationIds.has(attributes.id)) {
        continue;
      }
      const recipientId = this.#getRecipientByConversationId(
        attributes.id,
        'adding chat frames'
      );
      strictAssert(
        recipientId,
        'recipient conversation must exist if not skipped'
      );

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
              ? BigInt(DurationInSeconds.toMillis(attributes.expireTimer))
              : null,
          expireTimerVersion: attributes.expireTimerVersion,
          muteUntilMs: attributes.muteExpiresAt
            ? getSafeLongFromTimestamp(attributes.muteExpiresAt, LONG_MAX_VALUE)
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
      if (recipientId == null) {
        log.warn(
          `Dropping ad-hoc call; recipientId for roomId ${roomId.slice(-2)} not found`
        );
        continue;
      }

      if (status === AdhocCallStatus.Deleted) {
        continue;
      }

      let callId: bigint;
      try {
        callId = BigInt(callIdStr);
      } catch (error) {
        log.warn('Dropping ad-hoc call; invalid callId', toLogFormat(error));
        continue;
      }

      this.#pushFrame({
        adHocCall: {
          callId,
          recipientId,
          state: toAdHocCallStateProto(status),
          callTimestamp: BigInt(timestamp),
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
        emoji = null,
        color,
        createdAtMs,
        allowAllCalls,
        allowAllMentions,
        allowedMembers,
        scheduleEnabled,
        scheduleStartTime = null,
        scheduleEndTime = null,
        scheduleDaysEnabled,
      } = profile;

      const allowedRecipients = Array.from(allowedMembers)
        .map(conversationId =>
          this.#getRecipientByConversationId(
            conversationId,
            'notificationProfile.allowedMembers'
          )
        )
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
          scheduleDaysEnabled: toDayOfWeekArray(scheduleDaysEnabled) ?? null,
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
          includedRecipientIds: chatFolder.includedConversationIds
            .map(id => {
              return this.#getRecipientByConversationId(
                id,
                'chatFolder.includedRecipientIds'
              );
            })
            .filter(isNotNil),
          excludedRecipientIds: chatFolder.excludedConversationIds
            .map(id => {
              return this.#getRecipientByConversationId(
                id,
                'chatFolder.excludedRecipientIds'
              );
            })
            .filter(isNotNil),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.#flush();
      this.#stats.chatFolders += 1;
    }

    const callHistory = await DataReader.getAllCallHistory();
    const callHistoryByCallId = makeLookup(callHistory, 'callId');

    const pinnedMessages = await DataReader.getAllPinnedMessages();
    const pinnedMessagesByMessageId = makeLookup(pinnedMessages, 'messageId');

    const me = window.ConversationController.getOurConversationOrThrow();
    const serviceId = me.get('serviceId');
    const aci = isAciString(serviceId) ? serviceId : undefined;
    strictAssert(aci, 'We must have our own ACI');
    const aboutMe = {
      aci,
      pni: me.get('pni'),
    };

    const FLUSH_EVERY = 10000;

    const iter = pMapIterable(
      Readable.from(getAllMessages(), {
        objectMode: true,
        highWaterMark: FLUSH_EVERY,
      }),
      message =>
        this.#toChatItem(message, {
          aboutMe,
          callHistoryByCallId,
          pinnedMessagesByMessageId,
        }),
      {
        concurrency: MAX_CONCURRENCY,
        backpressure: FLUSH_EVERY,
      }
    );

    for await (const chatItem of iter) {
      if (chatItem === undefined) {
        this.#stats.skippedMessages += 1;
        // Can't be backed up.
        continue;
      }

      this.#pushFrame({
        chatItem,
      });
      this.#stats.messages += 1;

      if (
        this.options.validationRun ||
        this.#stats.messages % FLUSH_EVERY === 0
      ) {
        // flush every chatItem to expose all validation errors
        await this.#flush();
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

  #pushFrame(frame: Backups.Frame.Params['item']): void {
    const encodedFrame = Backups.Frame.encode({ item: frame });
    if (this.options.type === 'plaintext-export') {
      const delimitedFrame = Buffer.concat(encodeDelimited(encodedFrame));
      strictAssert(
        this.#jsonExporter != null,
        'jsonExported must be initialized'
      );

      const results = this.#jsonExporter.exportFrames(delimitedFrame);
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
          this.#buffers.push(Buffer.from(`${result.line}\n`));
        }
      }
    } else {
      this.#buffers.push(...encodeDelimited(encodedFrame));
    }
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

  async #toAccountData(): Promise<Backups.AccountData.Params> {
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

    const themeSetting = await window.Events.getThemeSetting();
    const appTheme = toAppTheme(themeSetting);

    const keyTransparencyData = await DataReader.getKTAccountData(
      me.getCheckedAci('Backup export: key transparency data')
    );

    return {
      profileKey: itemStorage.get('profileKey') ?? null,
      username: me.get('username') || null,
      usernameLink: usernameLink
        ? {
            ...usernameLink,

            // Same numeric value, no conversion needed
            color: itemStorage.get('usernameLinkColor') ?? null,
          }
        : null,
      givenName: me.get('profileName') ?? null,
      familyName: me.get('profileFamilyName') ?? null,
      avatarUrlPath: itemStorage.get('avatarUrl') ?? null,
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
      svrPin: itemStorage.get('svrPin') ?? null,
      bioText: me.get('about') ?? null,
      bioEmoji: me.get('aboutEmoji') ?? null,
      keyTransparencyData: keyTransparencyData ?? null,
      // Test only values
      androidSpecificSettings: isTestOrMockEnvironment()
        ? (itemStorage.get('androidSpecificSettings') ?? null)
        : null,
      accountSettings: {
        readReceipts: itemStorage.get('read-receipt-setting') ?? null,
        sealedSenderIndicators:
          itemStorage.get('sealedSenderIndicators') ?? null,
        typingIndicators: getTypingIndicatorSetting(),
        linkPreviews: getLinkPreviewSetting(),
        notDiscoverableByPhoneNumber:
          parsePhoneNumberDiscoverability(
            itemStorage.get('phoneNumberDiscoverability')
          ) === PhoneNumberDiscoverability.NotDiscoverable,
        preferContactAvatars: itemStorage.get('preferContactAvatars') ?? null,
        universalExpireTimerSeconds:
          itemStorage.get('universalExpireTimer') ?? null,
        preferredReactionEmoji: preferredReactionEmoji ?? null,
        displayBadgesOnProfile:
          itemStorage.get('displayBadgesOnProfile') ?? null,
        keepMutedChatsArchived:
          itemStorage.get('keepMutedChatsArchived') ?? null,
        hasSetMyStoriesPrivacy:
          itemStorage.get('hasSetMyStoriesPrivacy') ?? null,
        hasViewedOnboardingStory:
          itemStorage.get('hasViewedOnboardingStory') ?? null,
        storiesDisabled: itemStorage.get('hasStoriesDisabled') ?? null,
        allowAutomaticKeyVerification: !itemStorage.get(
          'hasKeyTransparencyDisabled'
        ),
        storyViewReceiptsEnabled:
          itemStorage.get('storyViewReceiptsEnabled') ?? null,
        hasCompletedUsernameOnboarding:
          itemStorage.get('hasCompletedUsernameOnboarding') ?? null,
        hasSeenGroupStoryEducationSheet:
          itemStorage.get('hasSeenGroupStoryEducationSheet') ?? null,
        hasSeenAdminDeleteEducationDialog:
          itemStorage.get('hasSeenAdminDeleteEducationDialog') ?? null,
        phoneNumberSharingMode,
        // Note that this should be called before `toDefaultChatStyle` because
        // it builds `customColorIdByUuid`
        customChatColors: this.#toCustomChatColors(),
        defaultChatStyle: this.#toDefaultChatStyle(),
        backupTier: backupTier != null ? BigInt(backupTier) : null,
        appTheme,
        callsUseLessDataSetting:
          itemStorage.get('callsUseLessDataSetting') ||
          Backups.AccountData.CallsUseLessDataSetting.MOBILE_DATA_ONLY,

        // Test only values
        ...(isTestOrMockEnvironment()
          ? {
              optimizeOnDeviceStorage:
                itemStorage.get('optimizeOnDeviceStorage') ?? null,
              allowSealedSenderFromAnyone:
                itemStorage.get('allowSealedSenderFromAnyone') ?? null,
              pinReminders: itemStorage.get('pinReminders') ?? null,
              screenLockTimeoutMinutes:
                itemStorage.get('screenLockTimeoutMinutes') ?? null,
              autoDownloadSettings: autoDownloadPrimary
                ? {
                    images: autoDownloadPrimary.photos,
                    audio: autoDownloadPrimary.audio,
                    video: autoDownloadPrimary.videos,
                    documents: autoDownloadPrimary.documents,
                  }
                : null,
            }
          : {
              optimizeOnDeviceStorage: null,
              allowSealedSenderFromAnyone: null,
              pinReminders: null,
              screenLockTimeoutMinutes: null,
              autoDownloadSettings: null,
            }),
        defaultSentMediaQuality:
          itemStorage.get('sent-media-quality') === 'high'
            ? Backups.AccountData.SentMediaQuality.HIGH
            : Backups.AccountData.SentMediaQuality.STANDARD,
      },
    };
  }

  #incrementUnknownConversationReference(reason: string) {
    this.#stats.unknownConversationReferences.set(
      reason,
      (this.#stats.unknownConversationReferences.get(reason) ?? 0) + 1
    );
  }

  #getRecipientByConversationId(
    convoId: string,
    reason: string
  ): bigint | undefined {
    const fnLog = log.child(`getRecipientByConversationId(${reason})`);
    const recipientId = this.#convoIdToRecipientId.get(convoId);
    if (recipientId == null) {
      fnLog.warn('recipient convoId missing', reason);
      this.#incrementUnknownConversationReference(reason);
    }
    return recipientId;
  }

  #getRecipientByServiceId(
    serviceId: ServiceIdString,
    reason: string
  ): bigint | undefined {
    const fnLog = log.child(`getRecipientByServiceId(${reason})`);
    if (!isServiceIdString(serviceId)) {
      fnLog.warn('invalid serviceId');
      return undefined;
    }

    const recipientId = this.#serviceIdToRecipientId.get(serviceId);
    if (recipientId != null) {
      return recipientId;
    }

    fnLog.warn('recipient serviceId missing', reason);
    this.#incrementUnknownConversationReference(reason);

    const recipient = this.#toRecipient({ serviceId, type: 'private' });
    if (recipient == null) {
      return undefined;
    }

    this.#pushFrame({ recipient });
    strictAssert(recipient.id != null, 'recipient.id must exist');
    return recipient.id;
  }

  #getRecipientByE164(e164: string, reason: string): bigint | undefined {
    const fnLog = log.child(`getRecipientByE164(${reason})`);

    const recipientId = this.#e164ToRecipientId.get(e164);
    if (recipientId != null) {
      return recipientId;
    }

    fnLog.warn('recipient e164 missing', reason);
    this.#incrementUnknownConversationReference(reason);

    const recipient = this.#toRecipient({ e164, type: 'private' });
    if (recipient == null) {
      return undefined;
    }

    this.#pushFrame({ recipient });
    strictAssert(recipient.id != null, 'recipient.id must exist');
    return recipient.id;
  }

  #getNewRecipientId(options: GetRecipientIdOptionsType): bigint {
    const { id, serviceId, e164 } = options;

    const recipientId = this.#nextRecipientId;
    this.#nextRecipientId += 1n;

    if (id !== undefined) {
      this.#convoIdToRecipientId.set(id, recipientId);
    }
    if (serviceId !== undefined) {
      this.#serviceIdToRecipientId.set(serviceId, recipientId);
    }
    if (e164 !== undefined) {
      this.#e164ToRecipientId.set(e164, recipientId);
    }

    return recipientId;
  }

  #getNextRecipientId(): bigint {
    const recipientId = this.#nextRecipientId;
    this.#nextRecipientId += 1n;

    return recipientId;
  }

  #toRecipient(
    convo: WithRequiredProperties<Partial<ConversationAttributesType>, 'type'>,
    options?: ToRecipientOptionsType
  ): Backups.Recipient.Params | null {
    if (isMe(convo)) {
      strictAssert(convo.id, 'id must exist');
      const recipientId = this.#getNewRecipientId({
        id: convo.id,
        serviceId: convo.serviceId,
        e164: convo.e164,
      });
      return {
        id: recipientId,
        destination: {
          self: {
            avatarColor: toAvatarColor(convo.color) ?? null,
          },
        },
      };
    }

    if (isDirectConversation(convo)) {
      if (convo.serviceId != null && isSignalServiceId(convo.serviceId)) {
        return null;
      }

      if (convo.serviceId != null && !isServiceIdString(convo.serviceId)) {
        log.warn(
          'skipping conversation with invalid serviceId',
          convo.serviceId
        );
        return null;
      }

      if (convo.e164 != null && !isValidE164(convo.e164, true)) {
        log.warn('skipping conversation with invalid e164', convo.serviceId);
        return null;
      }

      if (convo.serviceId == null && convo.e164 == null) {
        log.warn('skipping conversation with neither serviceId nor e164');
        return null;
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
      if (options != null && convo.serviceId != null) {
        identityKey = options.identityKeysById.get(convo.serviceId);
      }

      const { nicknameGivenName, nicknameFamilyName, note } = convo;

      const maybePni = convo.pni ?? convo.serviceId;

      const aci = isAciString(convo.serviceId)
        ? this.#aciToBytes(convo.serviceId)
        : null;
      const pni = isPniString(maybePni) ? this.#pniToRawBytes(maybePni) : null;
      const e164 = convo.e164 ? BigInt(convo.e164) : null;

      strictAssert(
        aci != null || pni != null || e164 != null,
        'Contact has no identifier'
      );

      let recipientId: bigint | null = null;
      if (convo.serviceId) {
        recipientId = this.#getNewRecipientId({
          id: convo.id,
          serviceId: convo.serviceId,
          e164: convo.e164,
        });
      } else if (convo.e164) {
        recipientId = this.#getNewRecipientId({
          id: convo.id,
          e164: convo.e164,
        });
      }

      strictAssert(recipientId != null, 'recipientId must exist');

      return {
        id: recipientId,
        destination: {
          contact: {
            aci,
            pni,
            e164,
            username: convo.username || null,
            blocked: convo.serviceId
              ? itemStorage.blocked.isServiceIdBlocked(convo.serviceId)
              : null,
            visibility,
            registration: convo.discoveredUnregisteredAt
              ? {
                  notRegistered: {
                    unregisteredTimestamp: convo.firstUnregisteredAt
                      ? getSafeLongFromTimestamp(convo.firstUnregisteredAt)
                      : null,
                  },
                }
              : {
                  registered: {},
                },
            profileKey: convo.profileKey
              ? Bytes.fromBase64(convo.profileKey)
              : null,
            profileSharing: convo.profileSharing ?? null,
            profileGivenName: convo.profileName ?? null,
            profileFamilyName: convo.profileFamilyName ?? null,
            systemFamilyName: convo.systemFamilyName ?? null,
            systemGivenName: convo.systemGivenName ?? null,
            systemNickname: convo.systemNickname ?? null,
            hideStory: convo.hideStory === true,
            identityKey: identityKey?.publicKey || null,
            avatarColor: toAvatarColor(convo.color) ?? null,
            keyTransparencyData: options?.keyTransparencyData ?? null,

            // Integer values match so we can use it as is
            identityState: identityKey?.verified ?? 0,
            nickname:
              nicknameGivenName || nicknameFamilyName
                ? {
                    given: nicknameGivenName ?? null,
                    family: nicknameFamilyName ?? null,
                  }
                : null,
            note: note ?? null,
          },
        },
      };
    }
    if (isGroupV2(convo)) {
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

      if (!convo.masterKey) {
        log.warn('groupV2 convo missing master key, skipping');
        return null;
      }

      const masterKey = Bytes.fromBase64(convo.masterKey);
      strictAssert(convo.id, 'group conversationId must exist');
      const recipientId = this.#getNewRecipientId({
        id: convo.id,
      });
      return {
        id: recipientId,
        destination: {
          group: {
            masterKey,
            whitelisted: convo.profileSharing ?? null,
            hideStory: convo.hideStory === true,
            storySendMode,
            blocked: convo.groupId
              ? itemStorage.blocked.isGroupBlocked(convo.groupId)
              : false,
            avatarColor: toAvatarColor(convo.color) ?? null,
            snapshot: {
              title: {
                content: {
                  title: convo.name?.trim() ?? '',
                },
              },
              description:
                convo.description != null
                  ? {
                      content: {
                        descriptionText: convo.description.trim(),
                      },
                    }
                  : null,
              avatarUrl: convo.avatar?.url ?? null,
              disappearingMessagesTimer:
                convo.expireTimer != null
                  ? {
                      content: {
                        disappearingMessagesDuration:
                          DurationInSeconds.toSeconds(convo.expireTimer),
                      },
                    }
                  : null,
              accessControl: convo.accessControl
                ? {
                    ...convo.accessControl,
                    memberLabel: convo.accessControl.memberLabel ?? null,
                  }
                : null,
              version: convo.revision || 0,
              members:
                convo.membersV2?.map(member => {
                  return {
                    joinedAtVersion: member.joinedAtVersion,
                    ...(member.labelString
                      ? {
                          labelEmoji: member.labelEmoji ?? null,
                          labelString: member.labelString,
                        }
                      : {
                          labelEmoji: null,
                          labelString: null,
                        }),
                    role: member.role || SignalService.Member.Role.DEFAULT,
                    userId: this.#aciToBytes(member.aci),
                  };
                }) ?? null,
              membersPendingProfileKey:
                convo.pendingMembersV2?.map(member => {
                  return {
                    member: {
                      userId: this.#serviceIdToBytes(member.serviceId),
                      role: member.role || SignalService.Member.Role.DEFAULT,
                      joinedAtVersion: 0,
                      labelEmoji: null,
                      labelString: null,
                    },
                    addedByUserId: this.#aciToBytes(member.addedByUserId),
                    timestamp: getSafeLongFromTimestamp(member.timestamp),
                  };
                }) ?? null,
              membersPendingAdminApproval:
                convo.pendingAdminApprovalV2?.map(member => {
                  return {
                    userId: this.#aciToBytes(member.aci),
                    timestamp: getSafeLongFromTimestamp(member.timestamp),
                  };
                }) ?? null,
              membersBanned:
                convo.bannedMembersV2?.map(member => {
                  return {
                    userId: this.#serviceIdToBytes(member.serviceId),
                    timestamp: getSafeLongFromTimestamp(member.timestamp),
                  };
                }) ?? null,
              inviteLinkPassword: convo.groupInviteLinkPassword
                ? Bytes.fromBase64(convo.groupInviteLinkPassword)
                : null,
              announcementsOnly: convo.announcementsOnly === true,
            },
          },
        },
      };
    }

    if (isGroupV1(convo)) {
      log.warn('skipping gv1 conversation');
      return null;
    }

    return null;
  }

  async #toChatItem(
    message: MessageAttributesType,
    {
      aboutMe,
      callHistoryByCallId,
      pinnedMessagesByMessageId,
    }: ToChatItemOptionsType
  ): Promise<Backups.ChatItem.Params | undefined> {
    const chatItem = await this.#toChatItemInner(message, {
      aboutMe,
      callHistoryByCallId,
      pinnedMessagesByMessageId,
    });

    // Drop messages in the wrong 1:1 chat
    const conversation = window.ConversationController.get(
      message.conversationId
    );
    const me = this.#getRecipientByServiceId(aboutMe.aci, 'getting self');
    strictAssert(me, 'self recipient must exist');

    if (
      chatItem &&
      conversation &&
      isDirectConversation(conversation.attributes)
    ) {
      const convoAuthor = this.#getRecipientByConversationId(
        conversation.attributes.id,
        'message.conversationId'
      );

      if (chatItem.authorId !== me && chatItem.authorId !== convoAuthor) {
        log.warn(
          `${message.sent_at}: Dropping direct message with mismatched author`
        );
        return undefined;
      }
    }
    return chatItem;
  }

  async #toChatItemInner(
    message: MessageAttributesType,
    {
      aboutMe,
      callHistoryByCallId,
      pinnedMessagesByMessageId,
    }: ToChatItemOptionsType
  ): Promise<Backups.ChatItem.Params | undefined> {
    const conversation = window.ConversationController.get(
      message.conversationId
    );

    const chatId = this.#getRecipientByConversationId(
      message.conversationId,
      'message.conversationId'
    );

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

    let authorId: bigint | undefined;

    const me = this.#getRecipientByServiceId(aboutMe.aci, 'getting self');
    strictAssert(me, 'self recipient must exist');

    let isOutgoing = message.type === 'outgoing';
    let isIncoming = message.type === 'incoming';

    if (message.sourceServiceId && isAciString(message.sourceServiceId)) {
      authorId = this.#getRecipientByServiceId(
        message.sourceServiceId,
        'message.sourceServiceId'
      );
    } else if (message.source) {
      authorId = this.#getRecipientByE164(message.source, 'message.source');
    } else {
      strictAssert(!isIncoming, 'Incoming message must have source');

      // Author must be always present, even if we are directionless
      authorId = me;
    }

    // Mark incoming messages from self as outgoing
    if (isIncoming && authorId === me) {
      log.warn(
        `${message.sent_at}: Found incoming message with author self, updating to outgoing`
      );
      isOutgoing = true;
      isIncoming = false;

      // eslint-disable-next-line no-param-reassign
      message.type = 'outgoing';

      this.#stats.fixedDirectMessages += 1;
    }

    // Fix authorId for misattributed e164-only incoming 1:1
    // messages.
    if (
      isIncoming &&
      !message.sourceServiceId &&
      message.source &&
      conversation &&
      isDirectConversation(conversation.attributes)
    ) {
      const convoAuthor = this.#getRecipientByConversationId(
        conversation.attributes.id,
        'message.conversationId'
      );

      if (authorId !== convoAuthor) {
        authorId = convoAuthor;
        log.warn(
          `${message.sent_at}: Fixing misattributed e164-only 1:1 message`
        );
        this.#stats.fixedDirectMessages += 1;
      }
    }

    if (isOutgoing || isIncoming) {
      strictAssert(authorId, 'Incoming/outgoing messages require an author');
    }

    let expireStartDate: bigint | null = null;
    let expiresInMs: bigint | null = null;

    if (message.expireTimer != null) {
      expiresInMs = BigInt(DurationInSeconds.toMillis(message.expireTimer));

      if (message.expirationStartTimestamp != null) {
        expireStartDate = getSafeLongFromTimestamp(
          message.expirationStartTimestamp
        );
      }
    }

    const base: Omit<
      Backups.ChatItem.Params,
      'directionalDetails' | 'item' | 'pinDetails' | 'revisions'
    > = {
      chatId,
      authorId: authorId ?? null,
      dateSent: getSafeLongFromTimestamp(
        message.editMessageTimestamp || message.sent_at
      ),
      expireStartDate,
      expiresInMs,
      sms: message.sms === true,
    };

    let directionalDetails: Backups.ChatItem.Params['directionalDetails'] =
      null;
    let item: Backups.ChatItem.Params['item'];
    let revisions: Backups.ChatItem.Params['revisions'] = null;

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

        if (authorId === me) {
          directionalDetails = {
            outgoing: this.#getOutgoingMessageDetails(
              message.sent_at,
              message,
              { conversationId: message.conversationId }
            ),
          };
        } else {
          directionalDetails = {
            incoming: this.#getIncomingMessageDetails(message),
          };
        }
      } else if (kind === NonBubbleResultKind.Directionless) {
        directionalDetails = {
          directionless: {},
        };
      } else {
        throw missingCaseError(kind);
      }

      return {
        ...base,
        directionalDetails,
        ...patch,
        revisions: null,
        pinDetails: null,
      };
    }

    const { contact, sticker } = message;
    if (isTapToView(message)) {
      item = {
        viewOnceMessage: await this.#toViewOnceMessage({
          message,
        }),
      };
    } else if (message.deletedForEveryone) {
      if (message.deletedForEveryoneByAdminAci) {
        item = {
          adminDeletedMessage: {
            adminId:
              this.#getRecipientByServiceId(
                message.deletedForEveryoneByAdminAci,
                'adminDeletedMessage.adminId'
              ) ?? null,
          },
        };
      } else {
        item = { remoteDeletedMessage: {} };
      }
    } else if (messageHasPaymentEvent(message)) {
      const { payment } = message;
      switch (payment.kind) {
        case PaymentEventKind.ActivationRequest: {
          directionalDetails = { directionless: {} };
          item = {
            updateMessage: {
              update: {
                simpleUpdate: {
                  type: Backups.SimpleChatUpdate.Type
                    .PAYMENT_ACTIVATION_REQUEST,
                },
              },
            },
          };
          break;
        }
        case PaymentEventKind.Activation: {
          directionalDetails = { directionless: {} };
          item = {
            updateMessage: {
              update: {
                simpleUpdate: {
                  type: Backups.SimpleChatUpdate.Type.PAYMENTS_ACTIVATED,
                },
              },
            },
          };
          break;
        }
        case PaymentEventKind.Notification:
          item = {
            paymentNotification: {
              note: payment.note ?? null,
              amountMob: payment.amountMob ?? null,
              feeMob: payment.feeMob ?? null,
              transactionDetails: payment.transactionDetailsBase64
                ? Backups.PaymentNotification.TransactionDetails.decode(
                    Bytes.fromBase64(payment.transactionDetailsBase64)
                  )
                : null,
            },
          };
          break;
        default:
          throw missingCaseError(payment);
      }
    } else if (contact && contact[0]) {
      const [contactDetails] = contact;

      item = {
        contactMessage: {
          contact: {
            name: contactDetails.name
              ? {
                  givenName: contactDetails.name.givenName ?? null,
                  familyName: contactDetails.name.familyName ?? null,
                  prefix: contactDetails.name.prefix ?? null,
                  suffix: contactDetails.name.suffix ?? null,
                  middleName: contactDetails.name.middleName ?? null,
                  nickname: contactDetails.name.nickname ?? null,
                }
              : null,
            number:
              contactDetails.number?.map(number => ({
                value: number.value,
                type: numberToPhoneType(number.type),
                label: number.label ?? null,
              })) ?? null,
            email:
              contactDetails.email?.map(email => ({
                value: email.value,
                type: numberToPhoneType(email.type),
                label: email.label ?? null,
              })) ?? null,
            address:
              contactDetails.address?.map(address => ({
                type: numberToAddressType(address.type),
                label: address.label ?? null,
                street: address.street ?? null,
                pobox: address.pobox ?? null,
                neighborhood: address.neighborhood ?? null,
                city: address.city ?? null,
                region: address.region ?? null,
                postcode: address.postcode ?? null,
                country: address.country ?? null,
              })) ?? null,
            avatar: contactDetails.avatar?.avatar
              ? await this.#processAttachment({
                  attachment: contactDetails.avatar.avatar,
                  messageReceivedAt: message.received_at,
                })
              : null,
            organization: contactDetails.organization ?? null,
          },
          reactions: this.#getMessageReactions(message),
        },
      };
    } else if (sticker) {
      item = {
        stickerMessage: {
          sticker: {
            emoji: sticker.emoji ?? null,
            packId: Bytes.fromHex(sticker.packId),
            packKey: Bytes.fromBase64(sticker.packKey),
            stickerId: sticker.stickerId,
            data: sticker.data
              ? await this.#processAttachment({
                  attachment: sticker.data,
                  messageReceivedAt: message.received_at,
                })
              : null,
          },
          reactions: this.#getMessageReactions(message),
        },
      };
    } else if (isGiftBadge(message)) {
      const { giftBadge } = message;
      strictAssert(giftBadge != null, 'Message must have gift badge');

      if (giftBadge.state === GiftBadgeStates.Failed) {
        item = {
          giftBadge: {
            state: Backups.GiftBadge.State.FAILED,
            receiptCredentialPresentation: null,
          },
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

        item = {
          giftBadge: {
            receiptCredentialPresentation: Bytes.fromBase64(
              giftBadge.receiptCredentialPresentation
            ),
            state,
          },
        };
      }
    } else if (message.storyReplyContext || message.storyReaction) {
      const directStoryReplyMessage = await this.#toDirectStoryReplyMessage({
        message,
      });
      if (!directStoryReplyMessage) {
        return undefined;
      }

      item = {
        directStoryReplyMessage,
      };

      revisions = await this.#toChatItemRevisions(base, item, message);
    } else if (message.poll) {
      const { poll } = message;
      item = {
        poll: {
          question: poll.question,
          allowMultiple: poll.allowMultiple,
          hasEnded: poll.terminatedAt != null,
          options: poll.options.map((optionText, optionIndex) => {
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
                  votesForThisOption.set(
                    vote.fromConversationId,
                    vote.voteCount
                  );
                }
              }
            }

            const votes = Array.from(votesForThisOption.entries())
              .map(([conversationId, voteCount]) => {
                const voterId = this.#getRecipientByConversationId(
                  conversationId,
                  'poll.votes.voterId'
                );

                if (!voterId) {
                  return null;
                }

                return {
                  voterId,
                  voteCount,
                };
              })
              .filter(isNotNil);

            return {
              option: optionText,
              votes,
            };
          }),
          reactions: this.#getMessageReactions(message),
        },
      };
    } else if (message.isErased) {
      return undefined;
    } else {
      const standardMessage = await this.#toStandardMessage({
        message,
      });

      if (!standardMessage) {
        return undefined;
      }

      item = {
        standardMessage,
      };

      revisions = await this.#toChatItemRevisions(base, item, message);
    }

    if (directionalDetails == null) {
      if (isOutgoing) {
        directionalDetails = {
          outgoing: this.#getOutgoingMessageDetails(message.sent_at, message, {
            conversationId: message.conversationId,
          }),
        };
      } else {
        directionalDetails = {
          incoming: this.#getIncomingMessageDetails(message),
        };
      }
    }

    const pinnedMessage = pinnedMessagesByMessageId[message.id];

    let pinDetails: Backups.ChatItem.PinDetails.Params | null;
    if (pinnedMessage != null) {
      const pinnedAtTimestamp = BigInt(pinnedMessage.pinnedAt);

      let pinExpiry: Backups.ChatItem.PinDetails.Params['pinExpiry'];
      if (pinnedMessage.expiresAt != null) {
        pinExpiry = {
          pinExpiresAtTimestamp: BigInt(pinnedMessage.expiresAt),
        };
      } else {
        pinExpiry = {
          pinNeverExpires: true,
        };
      }
      pinDetails = { pinnedAtTimestamp, pinExpiry };
    } else {
      pinDetails = null;
    }

    return {
      ...base,
      directionalDetails,
      item,
      revisions,
      pinDetails,
    };
  }

  #aciToBytes(aci: AciString | string): Uint8Array<ArrayBuffer> {
    return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
  }

  #aciToBytesOrNull(aci: AciString | string): Uint8Array<ArrayBuffer> | null {
    if (isAciString(aci)) {
      return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
    }
    return null;
  }

  /** For fields explicitly marked as PNI (validator will expect 16 bytes) */
  #pniToRawBytes(pni: PniString | string): Uint8Array<ArrayBuffer> {
    return Pni.parseFromServiceIdString(pni).getRawUuidBytes();
  }

  /** For fields that can accept either ACI or PNI bytes */
  #serviceIdToBytes(serviceId: ServiceIdString): Uint8Array<ArrayBuffer> {
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

    const updateMessage: Backups.ChatUpdateMessage.Params = {
      update: null,
    };

    const patch: NonBubbleResultType['patch'] = {
      item: {
        updateMessage,
      },
    };

    if (isCallHistory(message)) {
      const conversation = window.ConversationController.get(
        message.conversationId
      );

      if (!conversation) {
        log.error(`${logId}: callHistory message had unknown conversationId!`);
        return { kind: NonBubbleResultKind.Drop };
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
        strictAssert(
          callHistory.mode === CallMode.Group,
          'in group, should be group call'
        );

        if (callHistory.status === GroupCallStatus.Deleted) {
          return { kind: NonBubbleResultKind.Drop };
        }

        const { ringerId, startedById } = callHistory;
        let ringerRecipientId: bigint | null = null;
        if (ringerId) {
          const ringerConversation =
            window.ConversationController.get(ringerId);
          if (!ringerConversation) {
            throw new Error(
              'toChatItemUpdate/callHistory: ringerId conversation not found!'
            );
          }

          ringerRecipientId =
            this.#getRecipientByConversationId(
              ringerConversation.id,
              'callHistory.ringerId'
            ) ?? null;
        }

        let startedCallRecipientId: bigint | null = null;
        if (startedById) {
          const startedByConvo = window.ConversationController.get(startedById);
          if (!startedByConvo) {
            throw new Error(
              'toChatItemUpdate/callHistory: startedById conversation not found!'
            );
          }

          startedCallRecipientId =
            this.#getRecipientByConversationId(
              startedByConvo.id,
              'callHistory.startedById'
            ) ?? null;
        }

        let groupCallId: bigint;
        try {
          groupCallId = BigInt(callId);
        } catch (e) {
          // Could not convert callId to bigint
          // likely a legacy backfilled callId with uuid
          // TODO (DESKTOP-8007)
          groupCallId = 0n;
        }

        const state = toGroupCallStateProto(callHistory.status);
        const startedCallTimestamp = BigInt(callHistory.timestamp);
        let endedCallTimestamp: bigint | null = null;
        if (callHistory.endedTimestamp != null) {
          endedCallTimestamp = getSafeLongFromTimestamp(
            callHistory.endedTimestamp
          );
        }
        const read = message.seenStatus === SeenStatus.Seen;

        updateMessage.update = {
          groupCall: {
            startedCallRecipientId,
            ringerRecipientId,
            callId: groupCallId,
            state,
            startedCallTimestamp,
            endedCallTimestamp,
            read,
          },
        };
        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      const { direction, type, status, timestamp } = callHistory;

      if (status === GroupCallStatus.Deleted) {
        return { kind: NonBubbleResultKind.Drop };
      }

      let individualCallId: bigint;
      try {
        individualCallId = BigInt(callId);
      } catch (e) {
        // TODO (DESKTOP-8007)
        // Could not convert callId to bigint; likely a legacy backfilled callId with uuid
        individualCallId = 0n;
      }

      updateMessage.update = {
        individualCall: {
          callId: individualCallId,
          type: toIndividualCallTypeProto(type),
          direction: toIndividualCallDirectionProto(direction),
          state: toIndividualCallStateProto(status, direction),
          startedCallTimestamp: BigInt(timestamp),
          read: message.seenStatus === SeenStatus.Seen,
        },
      };
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
        const selfId = this.#getRecipientByServiceId(
          options.aboutMe.aci,
          'getting self'
        );

        strictAssert(selfId, 'self must exist');
        patch.authorId = selfId;

        let updaterAci: Uint8Array<ArrayBuffer> | null = null;
        if (sourceServiceId && Aci.parseFromServiceIdString(sourceServiceId)) {
          updaterAci = uuidToBytes(sourceServiceId);
        }

        updateMessage.update = {
          groupChange: {
            updates: [
              {
                update: {
                  groupExpirationTimerUpdate: {
                    expiresInMs: BigInt(expiresInMs),
                    updaterAci,
                  },
                },
              },
            ],
          },
        };

        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      if (!authorId) {
        if (sourceServiceId) {
          patch.authorId =
            this.#getRecipientByServiceId(
              sourceServiceId,
              'expirationTimerUpdate.sourceServiceId'
            ) ?? undefined;
        } else if (source) {
          patch.authorId =
            this.#getRecipientByE164(source, 'expirationTimerUpdate.source') ??
            undefined;
        }
        patch.authorId = authorId;
      }

      updateMessage.update = {
        expirationTimerChange: {
          expiresInMs: BigInt(expiresInMs),
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isGroupV2Change(message)) {
      updateMessage.update = {
        groupChange: await this.toGroupV2Update(message, options),
      };
      strictAssert(this.#ourConversation?.id, 'our conversation must exist');
      const selfId = this.#getRecipientByConversationId(
        this.#ourConversation.id,
        'getting self'
      );
      strictAssert(selfId != null, 'self must exist');
      patch.authorId = selfId;
      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isKeyChange(message)) {
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
        const keyChangeAuthorId = this.#getRecipientByConversationId(
          target.id,
          'keyChange.key_changed'
        );
        if (!keyChangeAuthorId) {
          return { kind: NonBubbleResultKind.Drop };
        }
        // This will override authorId on the original chatItem
        patch.authorId = keyChangeAuthorId;
      }

      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.IDENTITY_UPDATE,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isPinnedMessageNotification(message)) {
      let targetAuthorId: bigint | null = null;
      let targetSentTimestamp: bigint | null = null;

      if (message.pinMessage == null) {
        log.warn(
          'toChatItemUpdate/pinnedMessageNotification: pinMessage details not found',
          message.id
        );
        return { kind: NonBubbleResultKind.Drop };
      }

      targetSentTimestamp = BigInt(message.pinMessage.targetSentTimestamp);
      targetAuthorId =
        this.#getRecipientByServiceId(
          message.pinMessage.targetAuthorAci,
          'pinnedMessageNotification.targetAuthorAci'
        ) ?? null;

      updateMessage.update = {
        pinMessage: {
          targetSentTimestamp,
          authorId: targetAuthorId,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isProfileChange(message)) {
      if (!message.profileChange?.newName || !message.profileChange?.oldName) {
        return { kind: NonBubbleResultKind.Drop };
      }

      if (message.changedId) {
        const changedConvo = window.ConversationController.get(
          message.changedId
        );
        if (changedConvo) {
          // This will override authorId on the original chatItem
          patch.authorId =
            this.#getRecipientByConversationId(
              changedConvo.id,
              'profileChange.changedId'
            ) ?? undefined;
        } else {
          log.warn(
            `${logId}: failed to resolve changedId ${message.changedId}`
          );
        }
      }

      const { newName, oldName } = message.profileChange;

      updateMessage.update = {
        profileChange: {
          newName,
          previousName: oldName,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isVerifiedChange(message)) {
      if (!message.verifiedChanged) {
        throw new Error(
          `${logId}: Message was verifiedChange, but missing verifiedChange!`
        );
      }

      updateMessage.update = {
        simpleUpdate: {
          type: message.verified
            ? Backups.SimpleChatUpdate.Type.IDENTITY_VERIFIED
            : Backups.SimpleChatUpdate.Type.IDENTITY_DEFAULT,
        },
      };

      if (message.verifiedChanged) {
        // This will override authorId on the original chatItem
        patch.authorId =
          this.#getRecipientByConversationId(
            message.verifiedChanged,
            'message.verifiedChange'
          ) ?? undefined;
      }

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isChangeNumberNotification(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.CHANGE_NUMBER,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isJoinedSignalNotification(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.JOINED_SIGNAL,
        },
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
        updateMessage.update = {
          learnedProfileChange: {
            previousName: { e164: BigInt(renderInfo.e164) },
          },
        };
      } else {
        strictAssert(
          renderInfo.username,
          'Title transition must have username or e164'
        );
        updateMessage.update = {
          learnedProfileChange: {
            previousName: { username: renderInfo.username },
          },
        };
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

      updateMessage.update = { simpleUpdate: { type } };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isDeliveryIssue(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.BAD_DECRYPT,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isConversationMerge(message)) {
      const e164 = message.conversationMerge?.renderInfo.e164;
      if (!e164) {
        return { kind: NonBubbleResultKind.Drop };
      }

      // Conversation merges generated on Desktop side never has
      // `sourceServiceId` and thus are attributed to our conversation.
      // However, we need to include proper `authorId` for compatibility with
      // other clients.
      patch.authorId =
        this.#getRecipientByConversationId(
          message.conversationId,
          'conversationMerge.conversationId'
        ) ?? undefined;

      updateMessage.update = {
        threadMerge: {
          previousE164: BigInt(e164),
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isPhoneNumberDiscovery(message)) {
      const e164 = message.phoneNumberDiscovery?.e164;
      if (!e164) {
        return { kind: NonBubbleResultKind.Drop };
      }

      updateMessage.update = {
        sessionSwitchover: {
          e164: BigInt(e164),
        },
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
      updateMessage.update = {
        groupChange: {
          updates: [
            {
              update: {
                genericGroupUpdate: {
                  updaterAci: message.sourceServiceId
                    ? this.#aciToBytesOrNull(message.sourceServiceId)
                    : null,
                },
              },
            },
          ],
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isUnsupportedMessage(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.UNSUPPORTED_PROTOCOL_MESSAGE,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isGroupV1Migration(message)) {
      const { groupMigration } = message;

      const updates: Array<Backups.GroupChangeChatUpdate.Update.Params> = [];

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
        updates.push({
          update: {
            groupV2MigrationSelfInvitedUpdate: {},
          },
        });
        addedItem = true;
      }

      if (invitedMemberCount > 0) {
        updates.push({
          update: {
            groupV2MigrationInvitedMembersUpdate: {
              invitedMembersCount: invitedMemberCount,
            },
          },
        });
        addedItem = true;
      }

      if (droppedMemberCount > 0) {
        updates.push({
          update: {
            groupV2MigrationDroppedMembersUpdate: {
              droppedMembersCount: droppedMemberCount,
            },
          },
        });
        addedItem = true;
      }

      if (!addedItem) {
        updates.push({
          update: {
            groupV2MigrationUpdate: {},
          },
        });
      }

      updateMessage.update = {
        groupChange: {
          updates,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isEndSession(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.END_SESSION,
        },
      };

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isChatSessionRefreshed(message)) {
      updateMessage.update = {
        simpleUpdate: {
          type: Backups.SimpleChatUpdate.Type.CHAT_SESSION_REFRESH,
        },
      };

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
  ): Promise<Backups.GroupChangeChatUpdate.Params> {
    const logId = `toGroupV2Update(${getMessageIdForLogging(message)})`;

    const { groupV2Change } = message;
    const { aboutMe } = options;
    if (!isGroupV2Change(message) || !groupV2Change) {
      throw new Error(`${logId}: Message was not a groupv2 change`);
    }

    const { from, details } = groupV2Change;
    const updates: Array<Backups.GroupChangeChatUpdate.Update.Params> = [];

    details.forEach(detail => {
      const { type } = detail;

      if (type === 'create') {
        updates.push({
          update: {
            groupCreationUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
            },
          },
        });
      } else if (type === 'access-attributes') {
        updates.push({
          update: {
            groupAttributesAccessLevelChangeUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              accessLevel: detail.newPrivilege,
            },
          },
        });
      } else if (type === 'access-members') {
        updates.push({
          update: {
            groupMembershipAccessLevelChangeUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              accessLevel: detail.newPrivilege,
            },
          },
        });
      } else if (type === 'access-invite-link') {
        updates.push({
          update: {
            groupInviteLinkAdminApprovalUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              linkRequiresAdminApproval:
                detail.newPrivilege ===
                SignalService.AccessControl.AccessRequired.ADMINISTRATOR,
            },
          },
        });
      } else if (type === 'access-member-label') {
        updates.push({
          update: {
            groupMemberLabelAccessLevelChangeUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              accessLevel: detail.newPrivilege,
            },
          },
        });
      } else if (type === 'announcements-only') {
        updates.push({
          update: {
            groupAnnouncementOnlyChangeUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              isAnnouncementOnly: detail.announcementsOnly,
            },
          },
        });
      } else if (type === 'avatar') {
        updates.push({
          update: {
            groupAvatarUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              wasRemoved: detail.removed,
            },
          },
        });
      } else if (type === 'title') {
        updates.push({
          update: {
            groupNameUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              newGroupName: detail.newTitle ?? null,
            },
          },
        });
      } else if (type === 'group-link-add') {
        updates.push({
          update: {
            groupInviteLinkEnabledUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              linkRequiresAdminApproval:
                detail.privilege ===
                SignalService.AccessControl.AccessRequired.ADMINISTRATOR,
            },
          },
        });
      } else if (type === 'group-link-reset') {
        updates.push({
          update: {
            groupInviteLinkResetUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
            },
          },
        });
      } else if (type === 'group-link-remove') {
        updates.push({
          update: {
            groupInviteLinkDisabledUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
            },
          },
        });
      } else if (type === 'member-add') {
        if (from && from === detail.aci) {
          updates.push({
            update: {
              groupMemberJoinedUpdate: {
                newMemberAci: this.#aciToBytes(from),
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupMemberAddedUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              newMemberAci: this.#aciToBytes(detail.aci),
              hadOpenInvitation: null,
              inviterAci: null,
            },
          },
        });
      } else if (type === 'member-add-from-invite') {
        const { aci, pni } = detail;
        if (
          from &&
          ((pni && from === pni) ||
            (aci && from === aci) ||
            checkServiceIdEquivalence(from, aci))
        ) {
          updates.push({
            update: {
              groupInvitationAcceptedUpdate: {
                newMemberAci: this.#aciToBytes(detail.aci),
                inviterAci: detail.inviter
                  ? this.#aciToBytes(detail.inviter)
                  : null,
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupMemberAddedUpdate: {
              newMemberAci: this.#aciToBytes(detail.aci),
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              inviterAci: detail.inviter
                ? this.#aciToBytes(detail.inviter)
                : null,
              hadOpenInvitation: true,
            },
          },
        });
      } else if (type === 'member-add-from-link') {
        updates.push({
          update: {
            groupMemberJoinedByLinkUpdate: {
              newMemberAci: this.#aciToBytes(detail.aci),
            },
          },
        });
      } else if (type === 'member-add-from-admin-approval') {
        updates.push({
          update: {
            groupJoinRequestApprovalUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              requestorAci: this.#aciToBytes(detail.aci),
              wasApproved: true,
            },
          },
        });
      } else if (type === 'member-privilege') {
        updates.push({
          update: {
            groupAdminStatusUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              memberAci: this.#aciToBytes(detail.aci),
              wasAdminStatusGranted:
                detail.newPrivilege === SignalService.Member.Role.ADMINISTRATOR,
            },
          },
        });
      } else if (type === 'member-remove') {
        if (from && from === detail.aci) {
          updates.push({
            update: {
              groupMemberLeftUpdate: {
                aci: this.#aciToBytes(from),
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupMemberRemovedUpdate: {
              removerAci: from ? this.#aciToBytesOrNull(from) : null,
              removedAci: this.#aciToBytes(detail.aci),
            },
          },
        });
      } else if (type === 'pending-add-one') {
        if (
          (aboutMe.aci && detail.serviceId === aboutMe.aci) ||
          (aboutMe.pni && detail.serviceId === aboutMe.pni)
        ) {
          updates.push({
            update: {
              selfInvitedToGroupUpdate: {
                inviterAci: from ? this.#aciToBytesOrNull(from) : null,
              },
            },
          });
          return;
        }
        if (
          from &&
          ((aboutMe.aci && from === aboutMe.aci) ||
            (aboutMe.pni && from === aboutMe.pni))
        ) {
          updates.push({
            update: {
              selfInvitedOtherUserToGroupUpdate: {
                inviteeServiceId: this.#serviceIdToBytes(detail.serviceId),
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupUnknownInviteeUpdate: {
              inviterAci: from ? this.#aciToBytesOrNull(from) : null,
              inviteeCount: 1,
            },
          },
        });
      } else if (type === 'pending-add-many') {
        updates.push({
          update: {
            groupUnknownInviteeUpdate: {
              inviterAci: from ? this.#aciToBytesOrNull(from) : null,
              inviteeCount: detail.count,
            },
          },
        });
      } else if (type === 'pending-remove-one') {
        if ((from && from === detail.serviceId) || detail.serviceId == null) {
          updates.push({
            update: {
              groupInvitationDeclinedUpdate: {
                inviterAci: detail.inviter
                  ? this.#aciToBytes(detail.inviter)
                  : null,
                inviteeAci: isAciString(detail.serviceId)
                  ? this.#aciToBytes(detail.serviceId)
                  : null,
              },
            },
          });
          return;
        }
        if (
          (aboutMe.aci && detail.serviceId === aboutMe.aci) ||
          (aboutMe.pni && detail.serviceId === aboutMe.pni)
        ) {
          updates.push({
            update: {
              groupSelfInvitationRevokedUpdate: {
                revokerAci: from ? this.#aciToBytesOrNull(from) : null,
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupInvitationRevokedUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              invitees: [
                {
                  inviterAci: isAciString(detail.inviter)
                    ? this.#aciToBytes(detail.inviter)
                    : null,
                  inviteeAci: isAciString(detail.serviceId)
                    ? this.#aciToBytes(detail.serviceId)
                    : null,
                  inviteePni: isPniString(detail.serviceId)
                    ? this.#pniToRawBytes(detail.serviceId)
                    : null,
                },
              ],
            },
          },
        });
      } else if (type === 'pending-remove-many') {
        updates.push({
          update: {
            groupInvitationRevokedUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              invitees: Array.from({ length: detail.count }, () => {
                return {
                  // Yes, we're adding totally empty invitees. This is okay.
                  inviterAci: null,
                  inviteeAci: null,
                  inviteePni: null,
                };
              }),
            },
          },
        });
      } else if (type === 'admin-approval-add-one') {
        updates.push({
          update: {
            groupJoinRequestUpdate: {
              requestorAci: this.#aciToBytes(detail.aci),
            },
          },
        });
      } else if (type === 'admin-approval-remove-one') {
        if (from && detail.aci && from === detail.aci) {
          updates.push({
            update: {
              groupJoinRequestCanceledUpdate: {
                requestorAci: this.#aciToBytes(detail.aci),
              },
            },
          });
          return;
        }

        updates.push({
          update: {
            groupJoinRequestApprovalUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
              requestorAci: this.#aciToBytes(detail.aci),
              wasApproved: false,
            },
          },
        });
      } else if (type === 'admin-approval-bounce') {
        // We can't express all we need in GroupSequenceOfRequestsAndCancelsUpdate, so we
        //   add an additional groupJoinRequestUpdate to express that there
        //   is an approval pending.
        if (detail.isApprovalPending) {
          // We need to create another update since the items we put in Update are oneof
          updates.push({
            update: {
              groupJoinRequestUpdate: {
                requestorAci: this.#aciToBytes(detail.aci),
              },
            },
          });

          // not returning because we really do want both of these
        }

        updates.push({
          update: {
            groupSequenceOfRequestsAndCancelsUpdate: {
              requestorAci: this.#aciToBytes(detail.aci),
              count: detail.times,
            },
          },
        });
      } else if (type === 'description') {
        updates.push({
          update: {
            groupDescriptionUpdate: {
              newDescription: detail.removed
                ? null
                : (detail.description ?? null),
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
            },
          },
        });
      } else if (type === 'summary') {
        updates.push({
          update: {
            genericGroupUpdate: {
              updaterAci: from ? this.#aciToBytesOrNull(from) : null,
            },
          },
        });
      } else {
        throw missingCaseError(type);
      }
    });

    if (updates.length === 0) {
      throw new Error(`${logId}: No updates generated from message`);
    }

    return { updates };
  }

  async #toQuote({
    message,
  }: {
    message: Pick<MessageAttributesType, 'quote' | 'received_at' | 'body'>;
  }): Promise<Backups.Quote.Params | null> {
    const { quote } = message;
    if (!quote) {
      return null;
    }

    let authorId: bigint | undefined;
    if (quote.authorAci) {
      authorId = this.#getRecipientByServiceId(
        quote.authorAci,
        'quote.authorAci'
      );
    } else if (quote.author) {
      authorId = this.#getRecipientByE164(quote.author, 'quote.author');
    }

    if (authorId == null) {
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
          : BigInt(quote.id),
      authorId,
      text:
        quote.text != null
          ? {
              body: trimBody(quote.text, BACKUP_QUOTE_BODY_LIMIT),
              bodyRanges: this.#toBodyRanges(quote.bodyRanges),
            }
          : null,
      attachments: await Promise.all(
        quote.attachments.map(
          async (
            attachment: QuotedAttachmentType
          ): Promise<Backups.Quote.QuotedAttachment.Params> => {
            return {
              contentType: attachment.contentType,
              fileName: attachment.fileName ?? null,
              thumbnail: attachment.thumbnail
                ? await this.#processMessageAttachment({
                    attachment: attachment.thumbnail,
                    message,
                  })
                : null,
            };
          }
        )
      ),
      type: quoteType,
    };
  }

  #toBodyRange(range: RawBodyRange): Backups.BodyRange.Params | null {
    const { data: parsedRange, error } = safeParseStrict(
      bodyRangeSchema,
      range
    );

    if (error) {
      log.warn('toBodyRange: Dropping invalid body range', toLogFormat(error));
      return null;
    }
    return {
      start: parsedRange.start,
      length: parsedRange.length,
      associatedValue:
        'mentionAci' in parsedRange
          ? {
              mentionAci: this.#aciToBytes(parsedRange.mentionAci),
            }
          : {
              // Numeric values are compatible between backup and message protos
              style: parsedRange.style,
            },
    };
  }

  #toBodyRanges(
    ranges: ReadonlyArray<RawBodyRange> | undefined
  ): Array<Backups.BodyRange.Params> | null {
    if (!ranges?.length) {
      return null;
    }

    const result = ranges
      .map(range => this.#toBodyRange(range))
      .filter(isNotNil);
    return result.length > 0 ? result : null;
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
  }): Promise<Backups.MessageAttachment.Params> {
    const { clientUuid } = attachment;
    const filePointer = await this.#processAttachment({
      attachment,
      messageReceivedAt: message.received_at,
    });

    return {
      pointer: filePointer,
      flag: this.#getMessageAttachmentFlag(message, attachment),
      wasDownloaded: isDownloaded(attachment),
      clientUuid: clientUuid ? uuidToBytes(clientUuid) : null,
    };
  }

  async #processAttachment({
    attachment,
    messageReceivedAt,
  }: {
    attachment: AttachmentType;
    messageReceivedAt: number;
  }): Promise<Backups.FilePointer.Params> {
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
  }: Pick<
    MessageAttributesType,
    'reactions'
  >): Array<Backups.Reaction.Params> | null {
    if (reactions == null) {
      return null;
    }

    return reactions
      .map((reaction, sortOrder): Backups.Reaction.Params | null => {
        const authorId = this.#getRecipientByConversationId(
          reaction.fromId,
          'reaction.authorId'
        );

        if (!authorId) {
          return null;
        }

        return {
          emoji: reaction.emoji ?? null,
          authorId,
          sentTimestamp: getSafeLongFromTimestamp(reaction.timestamp),
          sortOrder: BigInt(sortOrder),
        };
      })
      .filter(isNotNil);
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
  >): Backups.ChatItem.IncomingMessageDetails.Params {
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
  ): Backups.ChatItem.OutgoingMessageDetails.Params {
    const sealedSenderServiceIds = new Set(unidentifiedDeliveries);
    const errorMap = new Map(
      errors?.map(({ serviceId, name }) => {
        return [serviceId, name];
      })
    );

    const sendStatuses = new Array<Backups.SendStatus.Params>();
    for (const [id, entry] of Object.entries(sendStateByConversationId)) {
      const target = window.ConversationController.get(id);
      const recipientId =
        this.#getRecipientByConversationId(id, 'sendStateByConversationId') ??
        null;

      if (!target || recipientId == null) {
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
      const timestamp =
        entry.updatedAt != null
          ? getSafeLongFromTimestamp(entry.updatedAt)
          : null;

      const sealedSender = serviceId
        ? sealedSenderServiceIds.has(serviceId)
        : false;

      let deliveryStatus: Backups.SendStatus.Params['deliveryStatus'];
      switch (entry.status) {
        case SendStatus.Pending:
          deliveryStatus = { pending: {} };
          break;
        case SendStatus.Sent:
          deliveryStatus = { sent: { sealedSender } };
          break;
        case SendStatus.Delivered:
          deliveryStatus = { delivered: { sealedSender } };
          break;
        case SendStatus.Read:
          deliveryStatus = { read: { sealedSender } };
          break;
        case SendStatus.Viewed:
          deliveryStatus = { viewed: { sealedSender } };
          break;
        case SendStatus.Skipped:
          deliveryStatus = { skipped: {} };
          break;
        case SendStatus.Failed: {
          let reason: Backups.SendStatus.Failed.Params['reason'];

          if (!serviceId) {
            reason = null;
          } else {
            const errorName = errorMap.get(serviceId);
            if (!errorName) {
              reason = null;
            } else if (errorName === 'OutgoingIdentityKeyError') {
              reason =
                Backups.SendStatus.Failed.FailureReason.IDENTITY_KEY_MISMATCH;
            } else if (errorName === 'UnknownError') {
              // See ts/backups/import.ts
              reason = Backups.SendStatus.Failed.FailureReason.UNKNOWN;
            } else {
              reason = Backups.SendStatus.Failed.FailureReason.NETWORK;
            }
          }

          deliveryStatus = { failed: { reason } };
          break;
        }
        default:
          throw missingCaseError(entry.status);
      }

      sendStatuses.push({
        recipientId,
        timestamp,
        deliveryStatus,
      });
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
  }): Promise<Backups.StandardMessage.Params | undefined> {
    if (
      message.body &&
      isBodyTooLong(message.body, MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH)
    ) {
      log.warn(`${message.timestamp}: Message body is too long; will truncate`);
    }

    const result = {
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
        : null,
      ...(await this.#toTextAndLongTextFields(message)),
      linkPreview: message.preview
        ? await Promise.all(
            message.preview.map(
              async (preview): Promise<Backups.LinkPreview.Params> => {
                return {
                  url: preview.url,
                  title: preview.title ?? null,
                  description: preview.description ?? null,
                  date: getSafeLongFromTimestamp(preview.date ?? 0),
                  image: preview.image
                    ? await this.#processAttachment({
                        attachment: preview.image,
                        messageReceivedAt: message.received_at,
                      })
                    : null,
                };
              }
            )
          )
        : null,
      reactions: this.#getMessageReactions(message),
    };

    if (!result.attachments?.length && !result.text) {
      log.warn('toStandardMessage: had neither text nor attachments, dropping');
      return undefined;
    }
    return result;
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
  }): Promise<Backups.DirectStoryReplyMessage.Params | undefined> {
    const reactions = this.#getMessageReactions(message);

    let reply: Backups.DirectStoryReplyMessage.Params['reply'];
    if (message.storyReaction) {
      reply = { emoji: message.storyReaction.emoji };
    } else if (message.body) {
      reply = { textReply: await this.#toTextAndLongTextFields(message) };
    } else {
      log.warn('Dropping direct story reply message without reaction or body');
      return undefined;
    }

    return { reply, reactions };
  }

  async #toTextAndLongTextFields(
    message: Pick<
      MessageAttributesType,
      'bodyAttachment' | 'body' | 'bodyRanges' | 'received_at'
    >
  ): Promise<Backups.DirectStoryReplyMessage.TextReply.Params> {
    const includeLongTextAttachment =
      message.bodyAttachment && !isDownloaded(message.bodyAttachment);
    const bodyRanges = this.#toBodyRanges(message.bodyRanges);
    const includeText = Boolean(message.body) || Boolean(bodyRanges?.length);

    return {
      longText:
        // We only include the bodyAttachment if it's not downloaded; otherwise all text
        // is inlined
        includeLongTextAttachment && message.bodyAttachment
          ? await this.#processAttachment({
              attachment: message.bodyAttachment,
              messageReceivedAt: message.received_at,
            })
          : null,
      text: includeText
        ? {
            body: message.body
              ? trimBody(
                  message.body,
                  includeLongTextAttachment
                    ? MAX_MESSAGE_BODY_BYTE_LENGTH
                    : MAX_BACKUP_MESSAGE_BODY_BYTE_LENGTH
                )
              : null,
            bodyRanges,
          }
        : null,
    };
  }

  async #toViewOnceMessage({
    message,
  }: {
    message: Pick<
      MessageAttributesType,
      'attachments' | 'received_at' | 'reactions'
    >;
  }): Promise<Backups.ViewOnceMessage.Params> {
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
    parent: Pick<
      Backups.ChatItem.Params,
      'chatId' | 'authorId' | 'expireStartDate' | 'expiresInMs' | 'sms'
    >,
    parentItem: NonNullable<Backups.ChatItem.Params['item']>,
    message: MessageAttributesType
  ): Promise<Array<Backups.ChatItem.Params> | null> {
    const { editHistory } = message;
    if (editHistory == null) {
      return null;
    }

    const isOutgoing = message.type === 'outgoing';

    const revisions = await Promise.all(
      editHistory
        // The first history is the copy of the current message
        .slice(1)
        .map(async history => {
          const base: Omit<Backups.ChatItem.Params, 'item'> = {
            // Required fields
            chatId: parent.chatId,
            authorId: parent.authorId,
            dateSent: getSafeLongFromTimestamp(history.timestamp),
            expireStartDate: parent.expireStartDate,
            expiresInMs: parent.expiresInMs,
            sms: parent.sms,

            directionalDetails: isOutgoing
              ? {
                  outgoing: this.#getOutgoingMessageDetails(
                    history.timestamp,
                    history,
                    { conversationId: message.conversationId }
                  ),
                }
              : {
                  incoming: this.#getIncomingMessageDetails(history),
                },

            revisions: null,
            pinDetails: null,
          };

          let item: Backups.ChatItem.Params['item'];
          if (parentItem.directStoryReplyMessage) {
            const directStoryReplyMessage =
              await this.#toDirectStoryReplyMessage({
                message: history,
              });
            if (!directStoryReplyMessage) {
              return undefined;
            }
            item = {
              directStoryReplyMessage,
            };
          } else {
            const standardMessage = await this.#toStandardMessage({
              message: history,
            });
            if (!standardMessage) {
              log.warn('Chat revision was invalid, dropping');
              return null;
            }

            item = {
              standardMessage,
            };
          }
          return { ...base, item };
        })
        // Backups use oldest to newest order
        .reverse()
    );
    return revisions.filter(isNotNil);
  }

  #toCustomChatColors(): Array<Backups.ChatStyle.CustomChatColor.Params> {
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

    const result = new Array<Backups.ChatStyle.CustomChatColor.Params>();
    for (const [uuid, color] of map.entries()) {
      const id = BigInt(result.length + 1);
      this.#customColorIdByUuid.set(uuid, id);

      const start = desktopHslToRgbInt(
        color.start.hue,
        color.start.saturation,
        color.start.lightness
      );

      if (color.end == null) {
        result.push({
          id,
          color: { solid: start },
        });
      } else {
        const end = desktopHslToRgbInt(
          color.end.hue,
          color.end.saturation,
          color.end.lightness
        );

        // Desktop uses a different angle convention than the backup proto. Our degrees
        // rotate in the opposite direction (sadly!) and our start is shifted by 90
        // degrees
        const backupAngle = 360 - ((color.deg ?? 0) + 90);

        result.push({
          id,
          color: {
            gradient: {
              colors: [start, end],
              positions: [0, 1],
              angle: (backupAngle + 360) % 360,
            },
          },
        });
      }
    }

    return result;
  }

  #toDefaultChatStyle(): Backups.ChatStyle.Params | null {
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
  }: LocalChatStyle): Backups.ChatStyle.Params | null {
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

    let wallpaper: Backups.ChatStyle.Params['wallpaper'];
    if (Bytes.isNotEmpty(wallpaperPhotoPointer)) {
      wallpaper = {
        wallpaperPhoto: Backups.FilePointer.decode(wallpaperPhotoPointer),
      };
    } else if (wallpaperPreset) {
      wallpaper = { wallpaperPreset };
    } else {
      wallpaper = null;
    }

    let bubbleColor: Backups.ChatStyle.Params['bubbleColor'];
    if (color == null || autoBubbleColor) {
      bubbleColor = { autoBubbleColor: {} };
    } else if (color === 'custom') {
      strictAssert(
        customColorId != null,
        'No custom color id for custom color'
      );

      const index = this.#customColorIdByUuid.get(customColorId);
      strictAssert(index != null, 'Missing custom color');

      bubbleColor = { customColorId: index };
    } else {
      const { BubbleColorPreset } = Backups.ChatStyle;

      let preset: Backups.ChatStyle.BubbleColorPreset;
      switch (color) {
        case 'ultramarine':
          preset = BubbleColorPreset.SOLID_ULTRAMARINE;
          break;
        case 'crimson':
          preset = BubbleColorPreset.SOLID_CRIMSON;
          break;
        case 'vermilion':
          preset = BubbleColorPreset.SOLID_VERMILION;
          break;
        case 'burlap':
          preset = BubbleColorPreset.SOLID_BURLAP;
          break;
        case 'forest':
          preset = BubbleColorPreset.SOLID_FOREST;
          break;
        case 'wintergreen':
          preset = BubbleColorPreset.SOLID_WINTERGREEN;
          break;
        case 'teal':
          preset = BubbleColorPreset.SOLID_TEAL;
          break;
        case 'blue':
          preset = BubbleColorPreset.SOLID_BLUE;
          break;
        case 'indigo':
          preset = BubbleColorPreset.SOLID_INDIGO;
          break;
        case 'violet':
          preset = BubbleColorPreset.SOLID_VIOLET;
          break;
        case 'plum':
          preset = BubbleColorPreset.SOLID_PLUM;
          break;
        case 'taupe':
          preset = BubbleColorPreset.SOLID_TAUPE;
          break;
        case 'steel':
          preset = BubbleColorPreset.SOLID_STEEL;
          break;
        case 'ember':
          preset = BubbleColorPreset.GRADIENT_EMBER;
          break;
        case 'midnight':
          preset = BubbleColorPreset.GRADIENT_MIDNIGHT;
          break;
        case 'infrared':
          preset = BubbleColorPreset.GRADIENT_INFRARED;
          break;
        case 'lagoon':
          preset = BubbleColorPreset.GRADIENT_LAGOON;
          break;
        case 'fluorescent':
          preset = BubbleColorPreset.GRADIENT_FLUORESCENT;
          break;
        case 'basil':
          preset = BubbleColorPreset.GRADIENT_BASIL;
          break;
        case 'sublime':
          preset = BubbleColorPreset.GRADIENT_SUBLIME;
          break;
        case 'sea':
          preset = BubbleColorPreset.GRADIENT_SEA;
          break;
        case 'tangerine':
          preset = BubbleColorPreset.GRADIENT_TANGERINE;
          break;
        default:
          throw missingCaseError(color);
      }

      bubbleColor = { bubbleColorPreset: preset };
    }

    return {
      dimWallpaperInDarkMode: dimWallpaperInDarkMode ?? null,
      wallpaper,
      bubbleColor,
    };
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

function toAppTheme(theme: ThemeType): Backups.AccountData.AppTheme {
  const ENUM = Backups.AccountData.AppTheme;

  if (theme === 'light') {
    return ENUM.LIGHT;
  }
  if (theme === 'dark') {
    return ENUM.DARK;
  }

  return ENUM.SYSTEM;
}

async function* getAllMessages(): AsyncIterable<MessageAttributesType> {
  let cursor: PageBackupMessagesCursorType | undefined;
  while (!cursor?.done) {
    const { messages, cursor: newCursor } =
      // eslint-disable-next-line no-await-in-loop
      await DataReader.pageBackupMessages(cursor);

    cursor = newCursor;

    yield* messages;
  }
}
