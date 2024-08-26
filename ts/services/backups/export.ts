// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import { Aci, Pni, ServiceId } from '@signalapp/libsignal-client';
import type { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import pMap from 'p-map';
import pTimeout from 'p-timeout';
import { Readable } from 'stream';
import { isNumber } from 'lodash';
import { CallLinkRootKey } from '@signalapp/ringrtc';

import { Backups, SignalService } from '../../protobuf';
import {
  DataReader,
  DataWriter,
  pauseWriteAccess,
  resumeWriteAccess,
} from '../../sql/Client';
import type { PageMessagesCursorType } from '../../sql/Interface';
import * as log from '../../logging/log';
import { GiftBadgeStates } from '../../components/conversation/Message';
import { StorySendMode, MY_STORY_ID } from '../../types/Stories';
import {
  isPniString,
  type AciString,
  type ServiceIdString,
} from '../../types/ServiceId';
import type { RawBodyRange } from '../../types/BodyRange';
import { LONG_ATTACHMENT_LIMIT } from '../../types/Message';
import { PaymentEventKind } from '../../types/Payment';
import { MessageRequestResponseEvent } from '../../types/MessageRequestResponseEvent';
import type {
  ConversationAttributesType,
  MessageAttributesType,
  QuotedAttachmentType,
  QuotedMessageType,
} from '../../model-types.d';
import { drop } from '../../util/drop';
import { explodePromise } from '../../util/explodePromise';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
  isGroupV2,
  isMe,
} from '../../util/whatTypeOfConversation';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { uuidToBytes } from '../../util/uuidToBytes';
import { assertDev, strictAssert } from '../../util/assert';
import { getSafeLongFromTimestamp } from '../../util/timestampLongUtils';
import { DAY, MINUTE, SECOND, DurationInSeconds } from '../../util/durations';
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
  isChangeNumberNotification,
  isJoinedSignalNotification,
  isTitleTransitionNotification,
  isMessageRequestResponse,
} from '../../state/selectors/message';
import * as Bytes from '../../Bytes';
import { canBeSynced as canPreferredReactionEmojiBeSynced } from '../../reactions/preferredReactionEmoji';
import { SendStatus } from '../../messages/MessageSendState';
import { BACKUP_VERSION } from './constants';
import { getMessageIdForLogging } from '../../util/idForLogging';
import { makeLookup } from '../../util/makeLookup';
import type {
  CallHistoryDetails,
  CallStatus,
} from '../../types/CallDisposition';
import {
  CallMode,
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  AdhocCallStatus,
} from '../../types/CallDisposition';
import { isAciString } from '../../util/isAciString';
import { hslToRGB } from '../../util/hslToRGB';
import type { AboutMe, LocalChatStyle } from './types';
import { messageHasPaymentEvent } from '../../messages/helpers';
import {
  numberToAddressType,
  numberToPhoneType,
} from '../../types/EmbeddedContact';
import {
  type AttachmentType,
  isGIF,
  isDownloaded,
  isVoiceMessage as isVoiceMessageAttachment,
} from '../../types/Attachment';
import {
  getFilePointerForAttachment,
  maybeGetBackupJobForAttachmentAndFilePointer,
} from './util/filePointers';
import type { CoreAttachmentBackupJobType } from '../../types/AttachmentBackup';
import { AttachmentBackupManager } from '../../jobs/AttachmentBackupManager';
import { getBackupCdnInfo } from './util/mediaId';
import { calculateExpirationTimestamp } from '../../util/expirationTimer';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { CallLinkRestrictions } from '../../types/CallLink';
import { toAdminKeyBytes } from '../../util/callLinks';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc';
import { SeenStatus } from '../../MessageSeenStatus';

const MAX_CONCURRENCY = 10;

// We want a very generous timeout to make sure that we always resume write
// access to the database.
const FLUSH_TIMEOUT = 30 * MINUTE;

// Threshold for reporting slow flushes
const REPORTING_THRESHOLD = SECOND;

const ZERO_PROFILE_KEY = new Uint8Array(32);

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
  backupLevel: BackupLevel;
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
  private now = Date.now();

  private readonly backupTimeMs = getSafeLongFromTimestamp(this.now);
  private readonly convoIdToRecipientId = new Map<string, number>();
  private readonly roomIdToRecipientId = new Map<string, number>();
  private attachmentBackupJobs: Array<CoreAttachmentBackupJobType> = [];
  private buffers = new Array<Uint8Array>();
  private nextRecipientId = 0;
  private flushResolve: (() => void) | undefined;

  // Map from custom color uuid to an index in accountSettings.customColors
  // array.
  private customColorIdByUuid = new Map<string, Long>();

  public run(backupLevel: BackupLevel): void {
    drop(
      (async () => {
        log.info('BackupExportStream: starting...');
        drop(AttachmentBackupManager.stop());
        await pauseWriteAccess();
        try {
          await this.unsafeRun(backupLevel);
        } catch (error) {
          this.emit('error', error);
        } finally {
          await resumeWriteAccess();

          // TODO (DESKTOP-7344): Clear & add backup jobs in a single transaction
          await DataWriter.clearAllAttachmentBackupJobs();
          await Promise.all(
            this.attachmentBackupJobs.map(job =>
              AttachmentBackupManager.addJobAndMaybeThumbnailJob(job)
            )
          );
          drop(AttachmentBackupManager.start());
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
      adHocCalls: 0,
      callLinks: 0,
      conversations: 0,
      chats: 0,
      distributionLists: 0,
      messages: 0,
      skippedMessages: 0,
      stickerPacks: 0,
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

      this.pushFrame({
        recipient: {
          id: Long.fromNumber(this.getNextRecipientId()),
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
                    this.getOrPushPrivateRecipient({ serviceId })
                  ),
                },
          },
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.distributionLists += 1;
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

      const id = this.getNextRecipientId();
      const rootKey = CallLinkRootKey.parse(rootKeyString);
      const roomId = getRoomIdFromRootKey(rootKey);

      this.roomIdToRecipientId.set(roomId, id);

      this.pushFrame({
        recipient: {
          id: Long.fromNumber(id),
          callLink: {
            rootKey: rootKey.bytes,
            adminKey: adminKey ? toAdminKeyBytes(adminKey) : null,
            name,
            restrictions: toCallLinkRestrictionsProto(restrictions),
            expirationMs: isNumber(expiration)
              ? Long.fromNumber(expiration)
              : null,
          },
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.callLinks += 1;
    }

    const stickerPacks = await DataReader.getInstalledStickerPacks();

    for (const { id, key } of stickerPacks) {
      this.pushFrame({
        stickerPack: {
          packId: Bytes.fromHex(id),
          packKey: Bytes.fromBase64(key),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.stickerPacks += 1;
    }

    const pinnedConversationIds =
      window.storage.get('pinnedConversationIds') || [];

    for (const { attributes } of window.ConversationController.getAll()) {
      if (isGroupV1(attributes)) {
        log.warn('backups: skipping gv1 conversation');
        continue;
      }

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

          style: this.toChatStyle({
            wallpaperPhotoPointer: attributes.wallpaperPhotoPointerBase64
              ? Bytes.fromBase64(attributes.wallpaperPhotoPointerBase64)
              : undefined,
            wallpaperPreset: attributes.wallpaperPreset,
            color: attributes.conversationColor,
            customColorId: attributes.customColorId,
            dimWallpaperInDarkMode: attributes.dimWallpaperInDarkMode,
          }),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.chats += 1;
    }

    const allCallHistoryItems = await DataReader.getAllCallHistory();

    for (const item of allCallHistoryItems) {
      const { callId, type, peerId: roomId, status, timestamp } = item;

      if (type !== CallType.Adhoc) {
        continue;
      }

      const recipientId = this.roomIdToRecipientId.get(roomId);
      if (!recipientId) {
        log.warn(
          `backups: Dropping ad-hoc call; recipientId for roomId ${roomId.slice(-2)} not found`
        );
        continue;
      }

      this.pushFrame({
        adHocCall: {
          callId: Long.fromString(callId),
          recipientId: Long.fromNumber(recipientId),
          state: toAdHocCallStateProto(status),
          callTimestamp: Long.fromNumber(timestamp),
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await this.flush();
      stats.adHocCalls += 1;
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
        await DataReader.finishPageMessages(cursor);
      }
    }

    await this.flush();

    log.warn('backups: final stats', {
      ...stats,
      attachmentBackupJobs: this.attachmentBackupJobs.length,
    });

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

    const subscriberId = storage.get('subscriberId');
    const backupsSubscriberId = storage.get('backupsSubscriberId');

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
      backupsSubscriberData: Bytes.isNotEmpty(backupsSubscriberId)
        ? {
            subscriberId: backupsSubscriberId,
            currencyCode: storage.get('backupsSubscriberCurrencyCode'),
            manuallyCancelled: storage.get(
              'backupsSubscriptionManuallyCancelled',
              false
            ),
          }
        : null,
      donationSubscriberData: Bytes.isNotEmpty(subscriberId)
        ? {
            subscriberId,
            currencyCode: storage.get('subscriberCurrencyCode'),
            manuallyCancelled: storage.get(
              'donorSubscriptionManuallyCancelled',
              false
            ),
          }
        : null,
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
        universalExpireTimerSeconds: storage.get('universalExpireTimer'),
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
        hasSeenGroupStoryEducationSheet: storage.get(
          'hasSeenGroupStoryEducationSheet'
        ),
        phoneNumberSharingMode,
        // Note that this should be called before `toDefaultChatStyle` because
        // it builds `customColorIdByUuid`
        customChatColors: this.toCustomChatColors(),
        defaultChatStyle: this.toDefaultChatStyle(),
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

  private getNextRecipientId(): number {
    const recipientId = this.nextRecipientId;
    this.nextRecipientId += 1;

    return recipientId;
  }

  private toRecipient(
    recipientId: Long,
    convo: Omit<
      ConversationAttributesType,
      'id' | 'version' | 'expireTimerVersion'
    >
  ): Backups.IRecipient | undefined {
    const res: Backups.IRecipient = {
      id: recipientId,
    };

    if (isMe(convo)) {
      res.self = {};
    } else if (isDirectConversation(convo)) {
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
        visibility,
        ...(isConversationUnregistered(convo)
          ? {
              notRegistered: {
                unregisteredTimestamp: convo.firstUnregisteredAt
                  ? Long.fromNumber(convo.firstUnregisteredAt)
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

      const masterKey = Bytes.fromBase64(convo.masterKey);

      res.group = {
        masterKey,
        whitelisted: convo.profileSharing,
        hideStory: convo.hideStory === true,
        storySendMode,
        snapshot: {
          title: {
            title: convo.name ?? '',
          },
          description: {
            descriptionText: convo.description ?? '',
          },
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
            const memberConvo = window.ConversationController.get(member.aci);
            strictAssert(memberConvo, 'Missing GV2 member');

            const { profileKey } = memberConvo.attributes;

            return {
              userId: this.aciToBytes(member.aci),
              role: member.role,
              profileKey: profileKey
                ? Bytes.fromBase64(profileKey)
                : ZERO_PROFILE_KEY,
              joinedAtVersion: member.joinedAtVersion,
            };
          }),
          membersPendingProfileKey: convo.pendingMembersV2?.map(member => {
            return {
              member: {
                userId: this.serviceIdToBytes(member.serviceId),
                role: member.role,
                profileKey: ZERO_PROFILE_KEY,
                joinedAtVersion: 0,
              },
              addedByUserId: this.aciToBytes(member.addedByUserId),
              timestamp: getSafeLongFromTimestamp(member.timestamp),
            };
          }),
          membersPendingAdminApproval: convo.pendingAdminApprovalV2?.map(
            member => {
              const memberConvo = window.ConversationController.get(member.aci);
              strictAssert(memberConvo, 'Missing GV2 member pending approval');

              const { profileKey } = memberConvo.attributes;
              return {
                userId: this.aciToBytes(member.aci),
                profileKey: profileKey
                  ? Bytes.fromBase64(profileKey)
                  : ZERO_PROFILE_KEY,
                timestamp: getSafeLongFromTimestamp(member.timestamp),
              };
            }
          ),
          membersBanned: convo.bannedMembersV2?.map(member => {
            return {
              userId: this.serviceIdToBytes(member.serviceId),
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

  private async toChatItem(
    message: MessageAttributesType,
    { aboutMe, callHistoryByCallId, backupLevel }: ToChatItemOptionsType
  ): Promise<Backups.IChatItem | undefined> {
    const conversation = window.ConversationController.get(
      message.conversationId
    );

    if (conversation && isGroupV1(conversation.attributes)) {
      log.warn('backups: skipping gv1 message');
      return undefined;
    }

    const chatId = this.getRecipientId({ id: message.conversationId });
    if (chatId === undefined) {
      log.warn('backups: message chat not found');
      return undefined;
    }

    const expirationTimestamp = calculateExpirationTimestamp(message);
    if (expirationTimestamp != null && expirationTimestamp <= this.now + DAY) {
      // Message expires too soon
      return undefined;
    }

    let authorId: Long | undefined;

    const isOutgoing = message.type === 'outgoing';
    const isIncoming = message.type === 'incoming';

    // Pacify typescript
    if (message.sourceServiceId) {
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
      strictAssert(!isIncoming, 'Incoming message must have source');

      // Author must be always present, even if we are directionless
      authorId = this.getOrPushPrivateRecipient({
        serviceId: aboutMe.aci,
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
      dateSent: getSafeLongFromTimestamp(
        message.editMessageTimestamp || message.sent_at
      ),
      expireStartDate,
      expiresInMs,
      revisions: [],
      sms: message.sms === true,
    };

    if (!isNormalBubble(message)) {
      const { patch, kind } = await this.toChatItemFromNonBubble({
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
        const me = this.getOrPushPrivateRecipient({
          serviceId: aboutMe.aci,
        });

        if (authorId === me) {
          result.outgoing = this.getOutgoingMessageDetails(
            message.sent_at,
            message
          );
        } else {
          result.incoming = this.getIncomingMessageDetails(message);
        }
      } else if (kind === NonBubbleResultKind.Directionless) {
        result.directionless = {};
      } else {
        throw missingCaseError(kind);
      }

      return { ...result, ...patch };
    }

    const { contact, sticker } = message;
    if (message.isErased) {
      result.remoteDeletedMessage = {};
    } else if (messageHasPaymentEvent(message)) {
      const { payment } = message;
      switch (payment.kind) {
        case PaymentEventKind.ActivationRequest: {
          result.updateMessage = {
            simpleUpdate: {
              type: Backups.SimpleChatUpdate.Type.PAYMENT_ACTIVATION_REQUEST,
            },
          };
          break;
        }
        case PaymentEventKind.Activation: {
          result.updateMessage = {
            simpleUpdate: {
              type: Backups.SimpleChatUpdate.Type.PAYMENTS_ACTIVATED,
            },
          };
          break;
        }
        case PaymentEventKind.Notification:
          result.paymentNotification = {
            note: payment.note || undefined,
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
      const contactMessage = new Backups.ContactMessage();

      contactMessage.contact = await Promise.all(
        contact.map(async contactDetails => ({
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
            ? await this.processAttachment({
                attachment: contactDetails.avatar.avatar,
                backupLevel,
                messageReceivedAt: message.received_at,
              })
            : undefined,
        }))
      );

      const reactions = this.getMessageReactions(message);
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
        ? await this.processAttachment({
            attachment: sticker.data,
            backupLevel,
            messageReceivedAt: message.received_at,
          })
        : undefined;

      result.stickerMessage = {
        sticker: stickerProto,
        reactions: this.getMessageReactions(message),
      };
    } else if (isGiftBadge(message)) {
      const { giftBadge } = message;
      strictAssert(giftBadge != null, 'Message must have gift badge');

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
          throw missingCaseError(giftBadge.state);
      }

      result.giftBadge = {
        receiptCredentialPresentation: Bytes.fromBase64(
          giftBadge.receiptCredentialPresentation
        ),
        state,
      };
    } else {
      result.standardMessage = await this.toStandardMessage(
        message,
        backupLevel
      );
      result.revisions = await this.toChatItemRevisions(
        result,
        message,
        backupLevel
      );
    }

    if (isOutgoing) {
      result.outgoing = this.getOutgoingMessageDetails(
        message.sent_at,
        message
      );
    } else {
      result.incoming = this.getIncomingMessageDetails(message);
    }

    return result;
  }

  private aciToBytes(aci: AciString | string): Uint8Array {
    return Aci.parseFromServiceIdString(aci).getRawUuidBytes();
  }
  private serviceIdToBytes(serviceId: ServiceIdString): Uint8Array {
    return ServiceId.parseFromServiceIdString(serviceId).getRawUuidBytes();
  }

  private async toChatItemFromNonBubble(
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

        const { ringerId } = callHistory;
        if (ringerId) {
          const ringerConversation =
            window.ConversationController.get(ringerId);
          if (!ringerConversation) {
            throw new Error(
              'toChatItemUpdate/callHistory: ringerId conversation not found!'
            );
          }

          const recipientId = this.getRecipientId(
            ringerConversation.attributes
          );
          groupCall.ringerRecipientId = recipientId;
          groupCall.startedCallRecipientId = recipientId;
        }

        groupCall.callId = Long.fromString(callId);
        groupCall.state = toGroupCallStateProto(callHistory.status);
        groupCall.startedCallTimestamp = Long.fromNumber(callHistory.timestamp);
        groupCall.endedCallTimestamp = Long.fromNumber(0);
        groupCall.read = message.seenStatus === SeenStatus.Seen;

        updateMessage.groupCall = groupCall;
        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      const individualCall = new Backups.IndividualCall();
      const { direction, type, status, timestamp } = callHistory;

      if (status === GroupCallStatus.Deleted) {
        return { kind: NonBubbleResultKind.Drop };
      }

      individualCall.callId = Long.fromString(callId);
      individualCall.type = toIndividualCallTypeProto(type);
      individualCall.direction = toIndividualCallDirectionProto(direction);
      individualCall.state = toIndividualCallStateProto(status);
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

      if (conversation && isGroup(conversation.attributes)) {
        const groupChatUpdate = new Backups.GroupChangeChatUpdate();

        const timerUpdate = new Backups.GroupExpirationTimerUpdate();
        timerUpdate.expiresInMs = Long.fromNumber(expiresInMs);

        const sourceServiceId = message.expirationTimerUpdate?.sourceServiceId;
        if (sourceServiceId && Aci.parseFromServiceIdString(sourceServiceId)) {
          timerUpdate.updaterAci = uuidToBytes(sourceServiceId);
        }

        const innerUpdate = new Backups.GroupChangeChatUpdate.Update();

        innerUpdate.groupExpirationTimerUpdate = timerUpdate;

        groupChatUpdate.updates = [innerUpdate];

        updateMessage.groupChange = groupChatUpdate;

        return { kind: NonBubbleResultKind.Directionless, patch };
      }

      const source =
        message.expirationTimerUpdate?.sourceServiceId ||
        message.expirationTimerUpdate?.source;
      if (source && !authorId) {
        patch.authorId = this.getOrPushPrivateRecipient({
          id: source,
        });
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

      if (message.key_changed) {
        // This will override authorId on the original chatItem
        patch.authorId = this.getOrPushPrivateRecipient({
          id: message.key_changed,
        });
      }

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isProfileChange(message)) {
      const profileChange = new Backups.ProfileChangeChatUpdate();
      if (!message.profileChange) {
        return { kind: NonBubbleResultKind.Drop };
      }

      if (message.changedId) {
        // This will override authorId on the original chatItem
        patch.authorId = this.getOrPushPrivateRecipient({
          id: message.changedId,
        });
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
        patch.authorId = this.getOrPushPrivateRecipient({
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
        case MessageRequestResponseEvent.ACCEPT:
        case MessageRequestResponseEvent.BLOCK:
        case MessageRequestResponseEvent.UNBLOCK:
          return { kind: NonBubbleResultKind.Drop };
        case MessageRequestResponseEvent.SPAM:
          type = Type.REPORTED_SPAM;
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
                ? this.serviceIdToBytes(message.sourceServiceId)
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

      return { kind: NonBubbleResultKind.Directed, patch };
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

      return { kind: NonBubbleResultKind.Directionless, patch };
    }

    if (isEndSession(message)) {
      const simpleUpdate = new Backups.SimpleChatUpdate();
      simpleUpdate.type = Backups.SimpleChatUpdate.Type.END_SESSION;

      updateMessage.simpleUpdate = simpleUpdate;

      return { kind: NonBubbleResultKind.Directed, patch };
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

  private async toQuote({
    quote,
    backupLevel,
    messageReceivedAt,
  }: {
    quote?: QuotedMessageType;
    backupLevel: BackupLevel;
    messageReceivedAt: number;
  }): Promise<Backups.IQuote | null> {
    if (!quote) {
      return null;
    }

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
      targetSentTimestamp: Long.fromNumber(quote.id),
      authorId,
      text: quote.text,
      attachments: await Promise.all(
        quote.attachments.map(
          async (
            attachment: QuotedAttachmentType
          ): Promise<Backups.Quote.IQuotedAttachment> => {
            return {
              contentType: attachment.contentType,
              fileName: attachment.fileName,
              thumbnail: attachment.thumbnail
                ? await this.processMessageAttachment({
                    attachment: attachment.thumbnail,
                    backupLevel,
                    messageReceivedAt,
                  })
                : undefined,
            };
          }
        )
      ),
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
    if (isVoiceMessageAttachment(attachment)) {
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
    messageReceivedAt,
  }: {
    attachment: AttachmentType;
    backupLevel: BackupLevel;
    messageReceivedAt: number;
  }): Promise<Backups.MessageAttachment> {
    const { clientUuid } = attachment;
    const filePointer = await this.processAttachment({
      attachment,
      backupLevel,
      messageReceivedAt,
    });

    return new Backups.MessageAttachment({
      pointer: filePointer,
      flag: this.getMessageAttachmentFlag(attachment),
      wasDownloaded: isDownloaded(attachment), // should always be true
      clientUuid: clientUuid ? uuidToBytes(clientUuid) : undefined,
    });
  }

  private async processAttachment({
    attachment,
    backupLevel,
    messageReceivedAt,
  }: {
    attachment: AttachmentType;
    backupLevel: BackupLevel;
    messageReceivedAt: number;
  }): Promise<Backups.FilePointer> {
    const { filePointer, updatedAttachment } =
      await getFilePointerForAttachment({
        attachment,
        backupLevel,
        getBackupCdnInfo,
      });

    if (updatedAttachment) {
      // TODO (DESKTOP-6688): ensure that we update the message/attachment in DB with the
      // new keys so that we don't try to re-upload it again on the next export
    }

    const backupJob = await maybeGetBackupJobForAttachmentAndFilePointer({
      attachment: updatedAttachment ?? attachment,
      filePointer,
      getBackupCdnInfo,
      messageReceivedAt,
    });

    if (backupJob) {
      this.attachmentBackupJobs.push(backupJob);
    }

    return filePointer;
  }

  private getMessageReactions({
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
        authorId: this.getOrPushPrivateRecipient({
          id: reaction.fromId,
        }),
        sentTimestamp: getSafeLongFromTimestamp(reaction.timestamp),
        receivedTimestamp: getSafeLongFromTimestamp(
          reaction.receivedAtDate ?? reaction.timestamp
        ),
        sortOrder: Long.fromNumber(sortOrder),
      };
    });
  }

  private getIncomingMessageDetails({
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
      read: readStatus === ReadStatus.Read,
      sealedSender: unidentifiedDeliveryReceived === true,
    };
  }

  private getOutgoingMessageDetails(
    sentAt: number,
    {
      sendStateByConversationId = {},
      unidentifiedDeliveries = [],
      errors = [],
    }: Pick<
      MessageAttributesType,
      'sendStateByConversationId' | 'unidentifiedDeliveries' | 'errors'
    >
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
        log.warn(`backups: no send target for a message ${sentAt}`);
        continue;
      }
      const { serviceId } = target.attributes;
      const recipientId = this.getOrPushPrivateRecipient(target.attributes);
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
    return {
      sendStatus: sendStatuses,
    };
  }

  private async toStandardMessage(
    message: Pick<
      MessageAttributesType,
      | 'quote'
      | 'attachments'
      | 'body'
      | 'bodyRanges'
      | 'preview'
      | 'reactions'
      | 'received_at'
    >,
    backupLevel: BackupLevel
  ): Promise<Backups.IStandardMessage> {
    const isVoiceMessage = message.attachments?.some(isVoiceMessageAttachment);
    const includeText = !isVoiceMessage;

    return {
      quote: await this.toQuote({
        quote: message.quote,
        backupLevel,
        messageReceivedAt: message.received_at,
      }),
      attachments: message.attachments
        ? await Promise.all(
            message.attachments.map(attachment => {
              return this.processMessageAttachment({
                attachment,
                backupLevel,
                messageReceivedAt: message.received_at,
              });
            })
          )
        : undefined,
      text: includeText
        ? {
            // TODO (DESKTOP-7207): handle long message text attachments
            // Note that we store full text on the message model so we have to
            // trim it before serializing.
            body: message.body?.slice(0, LONG_ATTACHMENT_LIMIT),
            bodyRanges: message.bodyRanges?.map(range =>
              this.toBodyRange(range)
            ),
          }
        : undefined,
      linkPreview: message.preview
        ? await Promise.all(
            message.preview.map(async preview => {
              return {
                url: preview.url,
                title: preview.title,
                description: preview.description,
                date: getSafeLongFromTimestamp(preview.date),
                image: preview.image
                  ? await this.processAttachment({
                      attachment: preview.image,
                      backupLevel,
                      messageReceivedAt: message.received_at,
                    })
                  : undefined,
              };
            })
          )
        : undefined,
      reactions: this.getMessageReactions(message),
    };
  }

  private async toChatItemRevisions(
    parent: Backups.IChatItem,
    message: MessageAttributesType,
    backupLevel: BackupLevel
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
          return {
            // Required fields
            chatId: parent.chatId,
            authorId: parent.authorId,
            dateSent: getSafeLongFromTimestamp(history.timestamp),
            expireStartDate: parent.expireStartDate,
            expiresInMs: parent.expiresInMs,
            sms: parent.sms,

            // Directional details
            outgoing: isOutgoing
              ? this.getOutgoingMessageDetails(history.timestamp, history)
              : undefined,
            incoming: isOutgoing
              ? undefined
              : this.getIncomingMessageDetails(history),

            // Message itself
            standardMessage: await this.toStandardMessage(history, backupLevel),
          };

          // Backups use oldest to newest order
        })
        .reverse()
    );
  }

  private toCustomChatColors(): Array<Backups.ChatStyle.ICustomChatColor> {
    const customColors = window.storage.get('customColors');
    if (!customColors) {
      return [];
    }

    const result = new Array<Backups.ChatStyle.ICustomChatColor>();
    for (const [uuid, color] of Object.entries(customColors.colors)) {
      const id = Long.fromNumber(result.length);
      this.customColorIdByUuid.set(uuid, id);

      const start = hslToRGBInt(color.start.hue, color.start.saturation);

      if (color.end == null) {
        result.push({
          id,
          solid: start,
        });
      } else {
        const end = hslToRGBInt(color.end.hue, color.end.saturation);

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

  private toDefaultChatStyle(): Backups.IChatStyle {
    const defaultColor = window.storage.get('defaultConversationColor');

    return this.toChatStyle({
      wallpaperPhotoPointer: window.storage.get('defaultWallpaperPhotoPointer'),
      wallpaperPreset: window.storage.get('defaultWallpaperPreset'),
      color: defaultColor?.color,
      customColorId: defaultColor?.customColorData?.id,
      dimWallpaperInDarkMode: window.storage.get(
        'defaultDimWallpaperInDarkMode',
        false
      ),
    });
  }

  private toChatStyle({
    wallpaperPhotoPointer,
    wallpaperPreset,
    color,
    customColorId,
    dimWallpaperInDarkMode,
  }: LocalChatStyle): Backups.IChatStyle {
    const result: Backups.IChatStyle = {
      dimWallpaperInDarkMode,
    };

    if (Bytes.isNotEmpty(wallpaperPhotoPointer)) {
      result.wallpaperPhoto = Backups.FilePointer.decode(wallpaperPhotoPointer);
    } else if (wallpaperPreset) {
      result.wallpaperPreset = wallpaperPreset;
    }

    if (color == null) {
      result.autoBubbleColor = {};
      return result;
    }

    if (color === 'custom') {
      strictAssert(
        customColorId != null,
        'No custom color id for custom color'
      );

      const index = this.customColorIdByUuid.get(customColorId);
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

function hslToRGBInt(hue: number, saturation: number): number {
  const { r, g, b } = hslToRGB(hue, saturation, 1);
  // eslint-disable-next-line no-bitwise
  return ((0xff << 24) | (r << 16) | (g << 8) | b) >>> 0;
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
  status: CallStatus
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
