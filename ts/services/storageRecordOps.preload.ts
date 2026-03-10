// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash, { omit, partition, without } from 'lodash';

import { ServiceId } from '@signalapp/libsignal-client';
import { uuidToBytes, bytesToUuid } from '../util/uuidToBytes.std.js';
import { deriveMasterKeyFromGroupV1 } from '../Crypto.node.js';
import * as Bytes from '../Bytes.std.js';
import {
  deriveGroupFields,
  waitThenMaybeUpdateGroup,
  waitThenRespondToGroupV2Migration,
} from '../groups.preload.js';
import { assertDev, strictAssert } from '../util/assert.std.js';
import { dropNull } from '../util/dropNull.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { isNotNil } from '../util/isNotNil.std.js';
import {
  PhoneNumberSharingMode,
  parsePhoneNumberSharingMode,
} from '../types/PhoneNumberSharingMode.std.js';
import {
  PhoneNumberDiscoverability,
  parsePhoneNumberDiscoverability,
} from '../util/phoneNumberDiscoverability.std.js';
import { arePinnedConversationsEqual } from '../util/arePinnedConversationsEqual.node.js';
import type { ConversationModel } from '../models/conversations.preload.js';
import {
  getSafeLongFromTimestamp,
  getTimestampFromLong,
} from '../util/timestampLongUtils.std.js';
import { canHaveUsername } from '../util/getTitle.preload.js';
import {
  get as getUniversalExpireTimer,
  set as setUniversalExpireTimer,
} from '../util/universalExpireTimer.preload.js';
import { ourProfileKeyService } from './ourProfileKey.std.js';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from '../util/whatTypeOfConversation.dom.js';
import { DurationInSeconds } from '../util/durations/index.std.js';
import * as preferredReactionEmoji from '../reactions/preferredReactionEmoji.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { createLogger } from '../logging/log.std.js';
import { normalizeStoryDistributionId } from '../types/StoryDistributionId.std.js';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import {
  ServiceIdKind,
  normalizeServiceId,
  toUntaggedPni,
} from '../types/ServiceId.std.js';
import { isAciString } from '../util/isAciString.std.js';
import * as Stickers from '../types/Stickers.preload.js';
import type {
  StoryDistributionWithMembersType,
  StickerPackInfoType,
} from '../sql/Interface.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { MY_STORY_ID, StorySendMode } from '../types/Stories.std.js';
import { findAndDeleteOnboardingStoryIfExists } from '../util/findAndDeleteOnboardingStoryIfExists.preload.js';
import { downloadOnboardingStory } from '../util/downloadOnboardingStory.preload.js';
import { drop } from '../util/drop.std.js';
import { redactExtendedStorageID } from '../util/privacy.node.js';
import type {
  CallLinkRecord,
  DefunctCallLinkType,
  PendingCallLinkType,
} from '../types/CallLink.std.js';
import {
  callLinkFromRecord,
  fromRootKeyBytes,
  getRoomIdFromRootKeyString,
  toRootKeyBytes,
} from '../util/callLinksRingrtc.node.js';
import { fromAdminKeyBytes, toAdminKeyBytes } from '../util/callLinks.std.js';
import { isOlderThan } from '../util/timestamp.std.js';
import { getMessageQueueTime } from '../util/getMessageQueueTime.dom.js';
import { callLinkRefreshJobQueue } from '../jobs/callLinkRefreshJobQueue.preload.js';
import {
  generateBackupsSubscriberData,
  saveBackupsSubscriberData,
  saveBackupTier,
} from '../util/backupSubscriptionData.preload.js';
import {
  toAciObject,
  toPniObject,
  toServiceIdObject,
  fromServiceIdBinaryOrString,
  fromAciUuidBytesOrString,
  fromPniUuidBytesOrUntaggedString,
} from '../util/ServiceId.node.js';
import { isProtoBinaryEncodingEnabled } from '../util/isProtoBinaryEncodingEnabled.dom.js';
import {
  getLinkPreviewSetting,
  getReadReceiptSetting,
  getSealedSenderIndicatorSetting,
  getTypingIndicatorSetting,
} from '../util/Settings.preload.js';
import { MessageRequestResponseSource } from '../types/MessageRequestResponseEvent.std.js';
import type { ChatFolder, ChatFolderId } from '../types/ChatFolder.std.js';
import {
  CHAT_FOLDER_DELETED_POSITION,
  ChatFolderType,
} from '../types/ChatFolder.std.js';
import {
  deriveGroupID,
  deriveGroupSecretParams,
} from '../util/zkgroup.node.js';
import { chatFolderCleanupService } from './expiring/chatFolderCleanupService.preload.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import type {
  NotificationProfileOverride,
  NotificationProfileType,
} from '../types/NotificationProfile.std.js';
import {
  DEFAULT_PROFILE_COLOR,
  fromDayOfWeekArray,
  redactNotificationProfileId,
  toDayOfWeekArray,
} from '../types/NotificationProfile.std.js';
import {
  generateNotificationProfileId,
  normalizeNotificationProfileId,
} from '../types/NotificationProfile-node.node.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { onHasStoriesDisabledChange } from '../textsecure/WebAPI.preload.js';
import { keyTransparency } from './keyTransparency.preload.js';
import { toNumber } from '../util/toNumber.std.js';
import { MAX_VALUE } from '../util/long.std.js';
import { isKnownProtoEnumMember } from '../util/isKnownProtoEnumMember.std.js';

const { isEqual } = lodash;

const log = createLogger('storageRecordOps');

const MY_STORY_BYTES = uuidToBytes(MY_STORY_ID);

type RecordClass =
  | Proto.AccountRecord.Params
  | Proto.ContactRecord.Params
  | Proto.GroupV1Record.Params
  | Proto.GroupV2Record.Params;

export type MergeResultType = Readonly<{
  shouldDrop?: boolean;
  conversation?: ConversationModel;
  needsProfileFetch?: boolean;
  updatedConversations?: ReadonlyArray<ConversationModel>;
  oldStorageID?: string | null;
  oldStorageVersion?: number | null;
  details: ReadonlyArray<string>;
}>;

function toRecordVerified(verified: number): Proto.ContactRecord.IdentityState {
  const VERIFIED_ENUM = signalProtocolStore.VerifiedStatus;
  const STATE_ENUM = Proto.ContactRecord.IdentityState;

  switch (verified) {
    case VERIFIED_ENUM.VERIFIED:
      return STATE_ENUM.VERIFIED;
    case VERIFIED_ENUM.UNVERIFIED:
      return STATE_ENUM.UNVERIFIED;
    default:
      return STATE_ENUM.DEFAULT;
  }
}

function fromRecordVerified(
  verified: Proto.ContactRecord['identityState']
): number {
  const VERIFIED_ENUM = signalProtocolStore.VerifiedStatus;
  const STATE_ENUM = Proto.ContactRecord.IdentityState;

  switch (verified) {
    case STATE_ENUM.VERIFIED:
      return VERIFIED_ENUM.VERIFIED;
    case STATE_ENUM.UNVERIFIED:
      return VERIFIED_ENUM.UNVERIFIED;
    default:
      return VERIFIED_ENUM.DEFAULT;
  }
}

function fromAvatarColor(
  color: (
    | Proto.ContactRecord
    | Proto.GroupV2Record
    | Proto.AccountRecord
  )['avatarColor']
): string | undefined {
  switch (color) {
    case Proto.AvatarColor.A100:
      return 'A100';
    case Proto.AvatarColor.A110:
      return 'A110';
    case Proto.AvatarColor.A120:
      return 'A120';
    case Proto.AvatarColor.A130:
      return 'A130';
    case Proto.AvatarColor.A140:
      return 'A140';
    case Proto.AvatarColor.A150:
      return 'A150';
    case Proto.AvatarColor.A160:
      return 'A160';
    case Proto.AvatarColor.A170:
      return 'A170';
    case Proto.AvatarColor.A180:
      return 'A180';
    case Proto.AvatarColor.A190:
      return 'A190';
    case Proto.AvatarColor.A200:
      return 'A200';
    case Proto.AvatarColor.A210:
      return 'A210';
    case undefined:
    case null:
      return undefined;
    default:
      // Default value for proto
      return 'A100';
  }
}

function applyAvatarColor(
  conversation: ConversationModel,
  protoColor: (
    | Proto.ContactRecord
    | Proto.GroupV2Record
    | Proto.AccountRecord
  )['avatarColor']
): void {
  conversation.set({
    colorFromPrimary: dropNull(protoColor as number),
    color: fromAvatarColor(protoColor) ?? conversation.get('color'),
  });
}

// Conversation stores a base64-encoded storageUnknownFields field
function addUnknownFieldsToConversation(
  record: RecordClass,
  conversation: ConversationModel,
  details: Array<string>
): void {
  if (record.$unknown) {
    details.push('adding unknown fields');
    conversation.set({
      storageUnknownFields: Bytes.toBase64(Bytes.concatenate(record.$unknown)),
    });
  } else if (conversation.get('storageUnknownFields')) {
    // If the record doesn't have unknown fields attached but we have them
    // saved locally then we need to clear it out
    details.push('clearing unknown fields');
    conversation.set({ storageUnknownFields: undefined });
  }
}

function conversationUnknownFieldsToRecord(
  conversation: ConversationModel
): Array<Uint8Array> | null {
  const storageUnknownFields = conversation.get('storageUnknownFields');
  if (storageUnknownFields == null) {
    return null;
  }
  log.info(
    'storageService.applyUnknownFields: Applying unknown fields for',
    conversation.idForLogging()
  );
  return [Bytes.fromBase64(storageUnknownFields)];
}

// Other records save a UInt8Array to the database
function toStorageUnknownFields(
  unknownFields: ReadonlyArray<Uint8Array> | undefined
): Uint8Array | null {
  if (!unknownFields) {
    return null;
  }

  return Bytes.concatenate(unknownFields);
}
function fromStorageUnknownFields(
  storageUnknownFields: Uint8Array | null | undefined
): Array<Uint8Array> | null {
  if (storageUnknownFields == null) {
    return null;
  }

  return [storageUnknownFields];
}

export async function toContactRecord(
  conversation: ConversationModel
): Promise<Proto.ContactRecord.Params> {
  const aci = conversation.getAci();
  const username = conversation.get('username');
  const ourID = window.ConversationController.getOurConversationId();
  const pni = conversation.getPni();

  const profileKey = conversation.get('profileKey');
  const serviceId = aci ?? pni;
  const verified = conversation.get('verified');
  const nicknameGivenName = conversation.get('nicknameGivenName');
  const nicknameFamilyName = conversation.get('nicknameFamilyName');
  const hideStory = conversation.get('hideStory');

  return {
    e164: conversation.get('e164') ?? null,
    aciBinary:
      isProtoBinaryEncodingEnabled() && aci
        ? toAciObject(aci).getRawUuidBytes()
        : null,
    aci: !isProtoBinaryEncodingEnabled() && aci ? aci : null,
    pniBinary:
      isProtoBinaryEncodingEnabled() && pni
        ? toPniObject(pni).getRawUuidBytes()
        : null,
    pni: !isProtoBinaryEncodingEnabled() && pni ? toUntaggedPni(pni) : null,
    username:
      username && canHaveUsername(conversation.attributes, ourID)
        ? username
        : null,
    identityKey: serviceId
      ? ((await signalProtocolStore.loadIdentityKey(serviceId)) ?? null)
      : null,
    identityState: verified ? toRecordVerified(Number(verified)) : null,
    pniSignatureVerified: conversation.get('pniSignatureVerified') ?? false,
    profileKey: profileKey ? Bytes.fromBase64(String(profileKey)) : null,
    givenName: conversation.get('profileName') ?? null,
    familyName: conversation.get('profileFamilyName') ?? null,
    nickname:
      nicknameGivenName || nicknameFamilyName
        ? {
            given: nicknameGivenName ?? null,
            family: nicknameFamilyName ?? null,
          }
        : null,
    note: conversation.get('note') ?? null,
    systemGivenName: conversation.get('systemGivenName') ?? null,
    systemFamilyName: conversation.get('systemFamilyName') ?? null,
    systemNickname: conversation.get('systemNickname') ?? null,
    blocked: conversation.isBlocked(),
    hidden: conversation.get('removalStage') !== undefined,
    whitelisted: Boolean(conversation.get('profileSharing')),
    archived: Boolean(conversation.get('isArchived')),
    markedUnread: Boolean(conversation.get('markedUnread')),
    mutedUntilTimestamp: getSafeLongFromTimestamp(
      conversation.get('muteExpiresAt'),
      MAX_VALUE
    ),
    avatarColor: conversation.get('colorFromPrimary') ?? null,
    hideStory: hideStory != null ? Boolean(hideStory) : null,
    unregisteredAtTimestamp: getSafeLongFromTimestamp(
      conversation.get('firstUnregisteredAt')
    ),
    $unknown: conversationUnknownFieldsToRecord(conversation),
  };
}

export function toAccountRecord(
  conversation: ConversationModel,
  {
    notificationProfileSyncDisabled,
  }: { notificationProfileSyncDisabled: boolean }
): Proto.AccountRecord.Params {
  const PHONE_NUMBER_SHARING_MODE_ENUM =
    Proto.AccountRecord.PhoneNumberSharingMode;
  const localPhoneNumberSharingMode = parsePhoneNumberSharingMode(
    itemStorage.get('phoneNumberSharingMode')
  );
  let phoneNumberSharingMode: Proto.AccountRecord.PhoneNumberSharingMode;
  switch (localPhoneNumberSharingMode) {
    case PhoneNumberSharingMode.Everybody:
      phoneNumberSharingMode = PHONE_NUMBER_SHARING_MODE_ENUM.EVERYBODY;
      break;
    case PhoneNumberSharingMode.ContactsOnly:
    case PhoneNumberSharingMode.Nobody:
      phoneNumberSharingMode = PHONE_NUMBER_SHARING_MODE_ENUM.NOBODY;
      break;
    default:
      throw missingCaseError(localPhoneNumberSharingMode);
  }

  const phoneNumberDiscoverability = parsePhoneNumberDiscoverability(
    itemStorage.get('phoneNumberDiscoverability')
  );
  let unlistedPhoneNumber: boolean;
  switch (phoneNumberDiscoverability) {
    case PhoneNumberDiscoverability.Discoverable:
      unlistedPhoneNumber = false;
      break;
    case PhoneNumberDiscoverability.NotDiscoverable:
      unlistedPhoneNumber = true;
      break;
    default:
      throw missingCaseError(phoneNumberDiscoverability);
  }

  const pinnedConversations = itemStorage
    .get('pinnedConversationIds', new Array<string>())
    .map((id): Proto.AccountRecord.PinnedConversation.Params | undefined => {
      const pinnedConversation = window.ConversationController.get(id);

      if (!pinnedConversation) {
        return undefined;
      }

      if (pinnedConversation.get('type') === 'private') {
        const serviceId = pinnedConversation.getServiceId();
        return {
          identifier: {
            contact: {
              ...(isProtoBinaryEncodingEnabled()
                ? {
                    serviceIdBinary:
                      serviceId == null
                        ? null
                        : toServiceIdObject(serviceId).getServiceIdBinary(),
                    serviceId: null,
                  }
                : {
                    serviceId: serviceId ?? null,
                    serviceIdBinary: null,
                  }),
              e164: pinnedConversation.get('e164') ?? null,
            },
          },
        };
      }
      if (isGroupV1(pinnedConversation.attributes)) {
        const groupId = pinnedConversation.get('groupId');
        if (!groupId) {
          throw new Error(
            'toAccountRecord: trying to pin a v1 Group without groupId'
          );
        }
        return {
          identifier: {
            legacyGroupId: Bytes.fromBinary(groupId),
          },
        };
      }
      if (isGroupV2(pinnedConversation.attributes)) {
        const masterKey = pinnedConversation.get('masterKey');
        if (!masterKey) {
          throw new Error(
            'toAccountRecord: trying to pin a v2 Group without masterKey'
          );
        }
        return {
          identifier: {
            groupMasterKey: Bytes.fromBase64(masterKey),
          },
        };
      }
      return undefined;
    })
    .filter(isNotNil);

  // Username link
  let usernameLink: Proto.AccountRecord.UsernameLink.Params | null = null;
  {
    const color = itemStorage.get('usernameLinkColor');
    const linkData = itemStorage.get('usernameLink');

    if (linkData?.entropy.length && linkData?.serverId.length) {
      usernameLink = {
        color: color ?? null,
        entropy: linkData.entropy,
        serverId: linkData.serverId,
      };
    }
  }

  const override = notificationProfileSyncDisabled
    ? itemStorage.get('notificationProfileOverrideFromPrimary')
    : itemStorage.get('notificationProfileOverride');

  let notificationProfileManualOverride: Proto.AccountRecord.NotificationProfileManualOverride.Params | null =
    null;
  if (override?.disabledAtMs && override?.disabledAtMs > 0) {
    notificationProfileManualOverride = {
      override: {
        disabledAtTimestampMs: BigInt(override.disabledAtMs),
      },
    };
  } else if (override?.enabled) {
    const { profileId, endsAtMs } = override.enabled;

    notificationProfileManualOverride = {
      override: {
        enabled: {
          id: Bytes.fromHex(profileId),
          endAtTimestampMs: endsAtMs && endsAtMs > 0 ? BigInt(endsAtMs) : null,
        },
      },
    };
  }

  const profileKey = conversation.get('profileKey');
  const storyViewReceiptsEnabled = itemStorage.get('storyViewReceiptsEnabled');
  const backupTier = itemStorage.get('backupTier');

  const subscriberId = itemStorage.get('subscriberId');
  const subscriberCurrencyCode = itemStorage.get('subscriberCurrencyCode');
  const donorSubscriptionManuallyCanceled = itemStorage.get(
    'donorSubscriptionManuallyCancelled'
  );

  const preferContactAvatars = itemStorage.get('preferContactAvatars');
  const rawPreferredReactionEmoji = itemStorage.get('preferredReactionEmoji');
  const universalExpireTimer = getUniversalExpireTimer();

  let storyViewReceiptsEnabledValue: Proto.AccountRecord.Params['storyViewReceiptsEnabled'];

  if (storyViewReceiptsEnabled !== undefined) {
    if (storyViewReceiptsEnabled) {
      storyViewReceiptsEnabledValue = Proto.OptionalBool.ENABLED;
    } else {
      storyViewReceiptsEnabledValue = Proto.OptionalBool.DISABLED;
    }
  } else {
    storyViewReceiptsEnabledValue = Proto.OptionalBool.UNSET;
  }

  return {
    profileKey: profileKey ? Bytes.fromBase64(String(profileKey)) : null,
    givenName: conversation.get('profileName') ?? null,
    familyName: conversation.get('profileFamilyName') ?? null,
    avatarUrlPath: itemStorage.get('avatarUrl') ?? null,
    username: conversation.get('username') ?? null,
    noteToSelfArchived: Boolean(conversation.get('isArchived')),
    noteToSelfMarkedUnread: Boolean(conversation.get('markedUnread')),
    readReceipts: getReadReceiptSetting(),
    sealedSenderIndicators: getSealedSenderIndicatorSetting(),
    typingIndicators: getTypingIndicatorSetting(),
    linkPreviews: getLinkPreviewSetting(),

    preferContactAvatars:
      preferContactAvatars != null ? Boolean(preferContactAvatars) : null,
    preferredReactionEmoji: preferredReactionEmoji.canBeSynced(
      rawPreferredReactionEmoji
    )
      ? rawPreferredReactionEmoji
      : null,

    universalExpireTimer: universalExpireTimer
      ? Number(universalExpireTimer)
      : null,

    phoneNumberSharingMode,
    unlistedPhoneNumber,
    pinnedConversations,

    donorSubscriberId: Bytes.isNotEmpty(subscriberId) ? subscriberId : null,
    donorSubscriberCurrencyCode:
      typeof subscriberCurrencyCode === 'string'
        ? subscriberCurrencyCode
        : null,
    donorSubscriptionManuallyCancelled:
      typeof donorSubscriptionManuallyCanceled === 'boolean'
        ? donorSubscriptionManuallyCanceled
        : null,

    // TODO: DESKTOP-9870
    hasBackup: null,
    backupSubscriberData: generateBackupsSubscriberData(),
    backupTier: backupTier != null ? BigInt(backupTier) : null,

    displayBadgesOnProfile: itemStorage.get('displayBadgesOnProfile') ?? null,
    keepMutedChatsArchived: itemStorage.get('keepMutedChatsArchived') ?? null,

    hasSetMyStoriesPrivacy: itemStorage.get('hasSetMyStoriesPrivacy') ?? null,
    hasViewedOnboardingStory:
      itemStorage.get('hasViewedOnboardingStory') ?? null,

    hasCompletedUsernameOnboarding:
      itemStorage.get('hasCompletedUsernameOnboarding') ?? null,

    hasSeenGroupStoryEducationSheet:
      itemStorage.get('hasSeenGroupStoryEducationSheet') ?? null,

    hasSeenAdminDeleteEducationDialog:
      itemStorage.get('hasSeenAdminDeleteEducationDialog') ?? null,

    avatarColor: conversation.get('colorFromPrimary') ?? null,
    automaticKeyVerificationDisabled:
      itemStorage.get('hasKeyTransparencyDisabled') === true,
    storiesDisabled: itemStorage.get('hasStoriesDisabled') === true,

    storyViewReceiptsEnabled: storyViewReceiptsEnabledValue,
    usernameLink,
    notificationProfileManualOverride,
    notificationProfileSyncDisabled,

    $unknown: conversationUnknownFieldsToRecord(conversation),
  };
}

export function toGroupV1Record(
  conversation: ConversationModel
): Proto.GroupV1Record.Params {
  return {
    id: Bytes.fromBinary(String(conversation.get('groupId'))),
    $unknown: conversationUnknownFieldsToRecord(conversation),
  };
}

export function toGroupV2Record(
  conversation: ConversationModel
): Proto.GroupV2Record.Params {
  const localStorySendMode = conversation.get('storySendMode');
  let storySendMode: Proto.GroupV2Record.StorySendMode;
  if (
    localStorySendMode === StorySendMode.IfActive ||
    localStorySendMode == null
  ) {
    storySendMode = Proto.GroupV2Record.StorySendMode.DEFAULT;
  } else if (localStorySendMode === StorySendMode.Never) {
    storySendMode = Proto.GroupV2Record.StorySendMode.DISABLED;
  } else if (localStorySendMode === StorySendMode.Always) {
    storySendMode = Proto.GroupV2Record.StorySendMode.ENABLED;
  } else {
    throw missingCaseError(localStorySendMode);
  }

  const avatarColor = conversation.get('colorFromPrimary');

  const masterKey = conversation.get('masterKey');

  return {
    masterKey: masterKey != null ? Bytes.fromBase64(masterKey) : null,
    blocked: conversation.isBlocked(),
    whitelisted: Boolean(conversation.get('profileSharing')),
    archived: Boolean(conversation.get('isArchived')),
    markedUnread: Boolean(conversation.get('markedUnread')),
    mutedUntilTimestamp: getSafeLongFromTimestamp(
      conversation.get('muteExpiresAt'),
      MAX_VALUE
    ),
    dontNotifyForMentionsIfMuted: Boolean(
      conversation.get('dontNotifyForMentionsIfMuted')
    ),
    hideStory: Boolean(conversation.get('hideStory')),
    avatarColor: avatarColor ?? null,
    storySendMode,

    $unknown: conversationUnknownFieldsToRecord(conversation),
  };
}

export function toStoryDistributionListRecord(
  storyDistributionList: StoryDistributionWithMembersType
): Proto.StoryDistributionListRecord.Params {
  return {
    identifier: uuidToBytes(storyDistributionList.id),
    name: storyDistributionList.name,
    deletedAtTimestamp: getSafeLongFromTimestamp(
      storyDistributionList.deletedAtTimestamp
    ),
    allowsReplies: Boolean(storyDistributionList.allowsReplies),
    isBlockList: Boolean(storyDistributionList.isBlockList),
    recipientServiceIdsBinary: isProtoBinaryEncodingEnabled()
      ? storyDistributionList.members.map(serviceId => {
          return toServiceIdObject(serviceId).getServiceIdBinary();
        })
      : null,
    recipientServiceIds: isProtoBinaryEncodingEnabled()
      ? null
      : storyDistributionList.members,

    $unknown: fromStorageUnknownFields(
      storyDistributionList.storageUnknownFields
    ),
  };
}

export function toStickerPackRecord(
  stickerPack: StickerPackInfoType
): Proto.StickerPackRecord.Params {
  const $unknown = fromStorageUnknownFields(stickerPack.storageUnknownFields);

  if (stickerPack.uninstalledAt !== undefined) {
    return {
      packId: Bytes.fromHex(stickerPack.id),
      packKey: null,
      position: null,
      deletedAtTimestamp: BigInt(stickerPack.uninstalledAt),
      $unknown,
    };
  }

  return {
    packId: Bytes.fromHex(stickerPack.id),
    packKey: Bytes.fromBase64(stickerPack.key),
    position: stickerPack.position ?? null,
    deletedAtTimestamp: null,
    $unknown,
  };
}

// callLinkDbRecord exposes additional fields not available on CallLinkType
export function toCallLinkRecord(
  callLinkDbRecord: CallLinkRecord
): Proto.CallLinkRecord.Params {
  strictAssert(callLinkDbRecord.rootKey, 'toCallLinkRecord: no rootKey');

  const $unknown = fromStorageUnknownFields(
    callLinkDbRecord.storageUnknownFields
  );

  if (callLinkDbRecord.deleted === 1) {
    // adminKey is intentionally omitted for deleted call links.
    return {
      rootKey: callLinkDbRecord.rootKey,
      adminPasskey: null,
      deletedAtTimestampMs: BigInt(
        callLinkDbRecord.deletedAt || new Date().getTime()
      ),
      $unknown,
    };
  }
  strictAssert(callLinkDbRecord.adminKey, 'toCallLinkRecord: no adminPasskey');
  return {
    rootKey: callLinkDbRecord.rootKey,
    adminPasskey: callLinkDbRecord.adminKey,
    deletedAtTimestampMs: null,
    $unknown,
  };
}

export function toDefunctOrPendingCallLinkRecord(
  callLink: DefunctCallLinkType | PendingCallLinkType
): Proto.CallLinkRecord.Params {
  const rootKey = toRootKeyBytes(callLink.rootKey);
  const adminPasskey = callLink.adminKey
    ? toAdminKeyBytes(callLink.adminKey)
    : null;

  strictAssert(rootKey, 'toDefunctOrPendingCallLinkRecord: no rootKey');
  strictAssert(
    adminPasskey,
    'toDefunctOrPendingCallLinkRecord: no adminPasskey'
  );

  return {
    rootKey,
    adminPasskey,
    deletedAtTimestampMs: null,
    $unknown: fromStorageUnknownFields(callLink.storageUnknownFields),
  };
}

function toRecipient(
  conversationId: string,
  logPrefix: string
): Proto.Recipient.Params | undefined {
  const conversation = window.ConversationController.get(conversationId);

  if (conversation == null) {
    log.error(
      `${logPrefix}/toRecipient: Missing conversation with id ${conversationId}`
    );
    return undefined;
  }

  const logId = `${logPrefix}/toRecipient(${conversation.idForLogging()})`;

  if (isDirectConversation(conversation.attributes)) {
    const serviceId = conversation.getServiceId();
    strictAssert(
      serviceId,
      `${logId}: Missing serviceId on direct conversation`
    );
    const serviceIdBinary =
      ServiceId.parseFromServiceIdString(serviceId).getServiceIdBinary();
    return {
      identifier: {
        contact: {
          serviceId,
          e164: conversation.get('e164') ?? null,
          serviceIdBinary,
        },
      },
    };
  }

  if (isGroupV2(conversation.attributes)) {
    const masterKey = conversation.get('masterKey');
    strictAssert(
      masterKey,
      `${logId}: Missing masterKey on groupV2 conversation`
    );
    return {
      identifier: {
        groupMasterKey: Bytes.fromBase64(masterKey),
      },
    };
  }

  if (isGroupV1(conversation.attributes)) {
    const legacyGroupId = conversation.getGroupIdBuffer();
    strictAssert(legacyGroupId, 'GroupV1 must have an id');
    return {
      identifier: {
        legacyGroupId,
      },
    };
  }

  throw new Error(`${logPrefix}: Unexpected conversation type for recipient`);
}

function toRecipients(
  conversationIds: ReadonlyArray<string>,
  logPrefix: string
): Array<Proto.Recipient.Params> {
  return conversationIds
    .map(conversationId => {
      return toRecipient(conversationId, logPrefix);
    })
    .filter(isNotNil);
}

function toChatFolderRecordFolderType(
  folderType: ChatFolderType
): Proto.ChatFolderRecord.FolderType {
  if (folderType === ChatFolderType.ALL) {
    return Proto.ChatFolderRecord.FolderType.ALL;
  }
  if (folderType === ChatFolderType.CUSTOM) {
    return Proto.ChatFolderRecord.FolderType.CUSTOM;
  }
  return Proto.ChatFolderRecord.FolderType.UNKNOWN;
}

export function toChatFolderRecord(
  chatFolder: ChatFolder
): Proto.ChatFolderRecord.Params {
  const logId = `toChatFolderRecord(${chatFolder.id})`;

  return {
    id: uuidToBytes(chatFolder.id),
    name: chatFolder.name,
    position: chatFolder.position,
    showOnlyUnread: chatFolder.showOnlyUnread,
    showMutedChats: chatFolder.showMutedChats,
    includeAllIndividualChats: chatFolder.includeAllIndividualChats,
    includeAllGroupChats: chatFolder.includeAllGroupChats,
    folderType: toChatFolderRecordFolderType(chatFolder.folderType),
    includedRecipients: toRecipients(chatFolder.includedConversationIds, logId),
    excludedRecipients: toRecipients(chatFolder.excludedConversationIds, logId),
    deletedAtTimestampMs: BigInt(chatFolder.deletedAtTimestampMs),
    $unknown: fromStorageUnknownFields(chatFolder.storageUnknownFields),
  };
}

export function toNotificationProfileRecord(
  profile: NotificationProfileType
): Proto.NotificationProfile.Params {
  const {
    id,
    name,
    emoji,
    color,
    createdAtMs,
    deletedAtTimestampMs,
    allowAllCalls,
    allowAllMentions,
    allowedMembers,
    scheduleEnabled,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysEnabled,
    storageUnknownFields,
  } = profile;
  const logId = `toNotificationProfileRecord(${redactNotificationProfileId(id)})`;

  return {
    id: Bytes.fromHex(id),
    name,
    emoji: emoji ?? null,
    color,
    createdAtMs: BigInt(createdAtMs),
    deletedAtTimestampMs:
      deletedAtTimestampMs == null ? null : BigInt(deletedAtTimestampMs),
    allowAllCalls,
    allowAllMentions,
    scheduleEnabled,
    scheduleStartTime: scheduleStartTime ?? null,
    scheduleEndTime: scheduleEndTime ?? null,
    scheduleDaysEnabled: toDayOfWeekArray(scheduleDaysEnabled) ?? [],
    allowedMembers: toRecipients(Array.from(allowedMembers), logId),
    $unknown: fromStorageUnknownFields(storageUnknownFields),
  };
}

type MessageRequestCapableRecord =
  | Proto.ContactRecord.Params
  | Proto.GroupV2Record.Params;

async function applyMessageRequestState(
  record: MessageRequestCapableRecord,
  conversation: ConversationModel
): Promise<void> {
  const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

  if (record.blocked) {
    await conversation.applyMessageRequestResponse(
      messageRequestEnum.BLOCK,
      {
        source: MessageRequestResponseSource.STORAGE_SERVICE,
        learnedAtMs: Date.now(),
      },
      { shouldSave: false }
    );
  } else if (record.whitelisted) {
    // unblocking is also handled by this function which is why the next
    // condition is part of the else-if and not separate
    await conversation.applyMessageRequestResponse(
      messageRequestEnum.ACCEPT,
      {
        source: MessageRequestResponseSource.STORAGE_SERVICE,
        learnedAtMs: Date.now(),
      },
      { shouldSave: false }
    );
  } else if (!record.blocked) {
    // if the condition above failed the state could still be blocked=false
    // in which case we should unblock the conversation
    conversation.unblock({ viaStorageServiceSync: true });
  }

  if (record.whitelisted === false) {
    conversation.disableProfileSharing({
      reason: 'storage record not whitelisted',
      viaStorageServiceSync: true,
    });
  }
}

type RecordClassObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function areNicknamesEqual(
  local: Proto.ContactRecord.Name.Params | undefined | null,
  remote: Proto.ContactRecord.Name.Params | undefined | null
): boolean {
  return local?.given === remote?.given && local?.family === remote?.family;
}

function logRecordChanges(
  localRecord: RecordClassObject | undefined,
  remoteRecord: RecordClassObject
): Array<string> {
  const details = new Array<string>();
  if (localRecord == null) {
    details.push('no local');
    return details;
  }

  const allKeys = new Set([
    ...Object.keys(remoteRecord),
    ...Object.keys(localRecord),
  ]);

  for (const key of allKeys) {
    const localValue = localRecord[key];
    const remoteValue = remoteRecord[key];

    // Sometimes we have a ByteBuffer and an Uint8Array, this ensures that we
    // are comparing them both equally by converting them into base64 string.
    if (localValue instanceof Uint8Array) {
      const areEqual = Bytes.areEqual(localValue, remoteValue);
      if (!areEqual) {
        details.push(`key=${key}: different bytes`);
      }
      continue;
    }

    // If both types are Long we can use Long's equals to compare them
    if (typeof localValue === 'bigint' || typeof localValue === 'number') {
      if (
        !(typeof remoteValue === 'bigint') &&
        typeof remoteValue !== 'number'
      ) {
        details.push(`key=${key}: type mismatch`);
        continue;
      }

      const areEqual = BigInt(localValue) === BigInt(remoteValue);
      if (!areEqual) {
        details.push(`key=${key}: different integers`);
      }
      continue;
    }

    if (key === 'pinnedConversations') {
      const areEqual = arePinnedConversationsEqual(localValue, remoteValue);
      if (!areEqual) {
        details.push('pinnedConversations');
      }
      continue;
    }

    if (key === 'nickname') {
      const areEqual = areNicknamesEqual(localValue, remoteValue);
      if (!areEqual) {
        details.push('nickname');
      }
      continue;
    }

    if (localValue === remoteValue) {
      continue;
    }

    const isRemoteNullish = !remoteValue;
    const isLocalNullish = !localValue;

    // Sometimes we get `null` values from Protobuf and they should default to
    // false, empty string, or 0 for these records we do not count them as
    // conflicting.
    if (isRemoteNullish && isLocalNullish) {
      continue;
    }

    const areEqual = isEqual(localValue, remoteValue);

    if (!areEqual) {
      if (isRemoteNullish) {
        details.push(`key=${key}: removed`);
      } else if (isLocalNullish) {
        details.push(`key=${key}: added`);
      } else {
        details.push(`key=${key}: different values`);
      }
    }
  }
  return details;
}

export async function mergeGroupV1Record(
  storageID: string,
  storageVersion: number,
  groupV1Record: Proto.GroupV1Record
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  if (!groupV1Record.id) {
    throw new Error(`No ID for ${redactedStorageID}`);
  }

  const groupId = Bytes.toBinary(groupV1Record.id);

  // Attempt to fetch an existing group pertaining to the `groupId` or create
  // a new group and populate it with the attributes from the record.
  let conversation = window.ConversationController.get(groupId);

  // Because ConversationController.get retrieves all types of records we
  // may sometimes have a situation where we get a record of groupv1 type
  // where the binary representation of its ID matches a v2 record in memory.
  // Here we ensure that the record we're about to process is GV1 otherwise
  // we drop the update.
  if (conversation && !isGroupV1(conversation.attributes)) {
    throw new Error(
      `Record has group type mismatch ${conversation.idForLogging()}`
    );
  }

  const details = logRecordChanges(
    conversation == null ? undefined : toGroupV1Record(conversation),
    groupV1Record
  );

  if (!conversation) {
    // It's possible this group was migrated to a GV2 if so we attempt to
    // retrieve the master key and find the conversation locally. If we
    // are successful then we continue setting and applying state.
    const masterKeyBuffer = deriveMasterKeyFromGroupV1(groupV1Record.id);
    const fields = deriveGroupFields(masterKeyBuffer);
    const derivedGroupV2Id = Bytes.toBase64(fields.id);

    details.push(
      'failed to find group by v1 id ' +
        `attempting lookup by v2 groupv2(${derivedGroupV2Id})`
    );
    conversation = window.ConversationController.get(derivedGroupV2Id);
  }
  if (!conversation) {
    if (groupV1Record.id.byteLength !== 16) {
      throw new Error('Not a valid gv1');
    }

    conversation = await window.ConversationController.getOrCreateAndWait(
      groupId,
      'group'
    );
    details.push('created a new group locally');
  }

  const oldStorageID = conversation.get('storageID');
  const oldStorageVersion = conversation.get('storageVersion');

  if (!isGroupV1(conversation.attributes)) {
    details.push('GV1 record for GV2 group, dropping');

    return {
      shouldDrop: true,
      conversation,
      oldStorageID,
      oldStorageVersion,
      details,
    };
  }

  conversation.set({
    storageID,
    storageVersion,
    needsStorageServiceSync: false,
  });

  if (isGroupV1(conversation.attributes)) {
    addUnknownFieldsToConversation(groupV1Record, conversation, details);
  } else {
    // We cannot preserve unknown fields if local group is V2 and the remote is
    // still V1, because the storageItem that we'll put into manifest will have
    // a different record type.

    // We want to upgrade group in the storage after merging it.
    conversation.set({ needsStorageServiceSync: true });
    details.push('marking v1 group for an update to v2');
  }

  return {
    conversation,
    oldStorageID,
    oldStorageVersion,
    details,
    updatedConversations: [conversation],
  };
}

function getGroupV2Conversation(
  masterKeyBuffer: Uint8Array
): ConversationModel {
  const groupFields = deriveGroupFields(masterKeyBuffer);

  const groupId = Bytes.toBase64(groupFields.id);
  const masterKey = Bytes.toBase64(masterKeyBuffer);
  const secretParams = Bytes.toBase64(groupFields.secretParams);
  const publicParams = Bytes.toBase64(groupFields.publicParams);

  // First we check for an existing GroupV2 group
  const groupV2 = window.ConversationController.get(groupId);
  if (groupV2) {
    groupV2.maybeRepairGroupV2({
      masterKey,
      secretParams,
      publicParams,
    });

    return groupV2;
  }

  // Then check for V1 group with matching derived GV2 id
  const groupV1 = window.ConversationController.getByDerivedGroupV2Id(groupId);
  if (groupV1) {
    return groupV1;
  }

  const conversationId = window.ConversationController.ensureGroup(groupId, {
    // Note: We don't set active_at, because we don't want the group to show until
    //   we have information about it beyond these initial details.
    //   see maybeUpdateGroup().
    groupVersion: 2,
    masterKey,
    secretParams,
    publicParams,
  });
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error(
      `getGroupV2Conversation: Failed to create conversation for groupv2(${groupId})`
    );
  }

  return conversation;
}

export async function mergeGroupV2Record(
  storageID: string,
  storageVersion: number,
  groupV2Record: Proto.GroupV2Record
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  if (!groupV2Record.masterKey) {
    throw new Error(`No master key for ${redactedStorageID}`);
  }

  const masterKeyBuffer = groupV2Record.masterKey;
  const conversation = getGroupV2Conversation(masterKeyBuffer);

  const oldStorageID = conversation.get('storageID');
  const oldStorageVersion = conversation.get('storageVersion');

  const recordStorySendMode =
    groupV2Record.storySendMode ?? Proto.GroupV2Record.StorySendMode.DEFAULT;
  let storySendMode: StorySendMode;
  if (recordStorySendMode === Proto.GroupV2Record.StorySendMode.DEFAULT) {
    storySendMode = StorySendMode.IfActive;
  } else if (
    recordStorySendMode === Proto.GroupV2Record.StorySendMode.DISABLED
  ) {
    storySendMode = StorySendMode.Never;
  } else if (
    recordStorySendMode === Proto.GroupV2Record.StorySendMode.ENABLED
  ) {
    storySendMode = StorySendMode.Always;
  } else {
    throw new Error(`Unsupported story send mode: ${recordStorySendMode}`);
  }

  const details = logRecordChanges(
    toGroupV2Record(conversation),
    groupV2Record
  );

  conversation.set({
    hideStory: Boolean(groupV2Record.hideStory),
    isArchived: Boolean(groupV2Record.archived),
    markedUnread: Boolean(groupV2Record.markedUnread),
    dontNotifyForMentionsIfMuted: Boolean(
      groupV2Record.dontNotifyForMentionsIfMuted
    ),
    storageID,
    storageVersion,
    storySendMode,
    needsStorageServiceSync: false,
  });

  conversation.setMuteExpiration(
    getTimestampFromLong(
      groupV2Record.mutedUntilTimestamp,
      Number.MAX_SAFE_INTEGER
    ),
    {
      viaStorageServiceSync: true,
    }
  );

  await applyMessageRequestState(groupV2Record, conversation);

  applyAvatarColor(conversation, groupV2Record.avatarColor);

  addUnknownFieldsToConversation(groupV2Record, conversation, details);

  if (isGroupV1(conversation.attributes)) {
    // If we found a GroupV1 conversation from this incoming GroupV2 record, we need to
    //   migrate it!

    // We don't await this because this could take a very long time, waiting for queues to
    //   empty, etc.
    drop(
      waitThenRespondToGroupV2Migration({
        conversation,
      })
    );
  } else {
    const isFirstSync = !itemStorage.get('storageFetchComplete');
    const dropInitialJoinMessage = isFirstSync;

    // We don't await this because this could take a very long time, waiting for queues to
    //   empty, etc.
    drop(
      waitThenMaybeUpdateGroup(
        {
          conversation,
          dropInitialJoinMessage,
        },
        { viaFirstStorageSync: isFirstSync }
      )
    );
  }

  return {
    conversation,
    updatedConversations: [conversation],
    oldStorageID,
    oldStorageVersion,
    details,
  };
}

export async function mergeContactRecord(
  storageID: string,
  storageVersion: number,
  originalContactRecord: Proto.ContactRecord
): Promise<MergeResultType> {
  const contactRecord = {
    ...originalContactRecord,

    aci:
      fromAciUuidBytesOrString(
        originalContactRecord.aciBinary,
        originalContactRecord.aci,
        'ContactRecord.aci'
      ) ?? null,
    pni:
      fromPniUuidBytesOrUntaggedString(
        originalContactRecord.pniBinary,
        originalContactRecord.pni,
        'ContactRecord.pni'
      ) ?? null,
  } satisfies Proto.ContactRecord.Params;

  const e164 = dropNull(contactRecord.e164);
  const { aci } = contactRecord;
  const pni = dropNull(contactRecord.pni);
  const pniSignatureVerified = contactRecord.pniSignatureVerified || false;
  const serviceId = aci || pni;

  // All contacts must have UUID
  if (!serviceId) {
    return { shouldDrop: true, details: ['no uuid'] };
  }

  // Contacts should not have PNI as ACI
  if (aci && !isAciString(aci)) {
    return { shouldDrop: true, details: ['invalid aci'] };
  }

  if (
    itemStorage.user.getOurServiceIdKind(serviceId) !== ServiceIdKind.Unknown
  ) {
    return { shouldDrop: true, details: ['our own uuid'] };
  }

  const { conversation } = window.ConversationController.maybeMergeContacts({
    aci,
    e164,
    pni,
    fromPniSignature: pniSignatureVerified,
    reason: 'mergeContactRecord',
  });

  const details = logRecordChanges(
    await toContactRecord(conversation),
    originalContactRecord
  );

  // We're going to ignore this; it's likely a PNI-only contact we've already merged
  if (conversation.getServiceId() !== serviceId) {
    const previousStorageID = conversation.get('storageID');
    const redactedpreviousStorageID = previousStorageID
      ? redactExtendedStorageID({
          storageID: previousStorageID,
          storageVersion: conversation.get('storageVersion'),
        })
      : '<none>';
    log.warn(
      `mergeContactRecord: ${conversation.idForLogging()} ` +
        `with storageId ${redactedpreviousStorageID} ` +
        `had serviceId that didn't match provided serviceId ${serviceId}`
    );
    return {
      shouldDrop: true,
      details,
    };
  }

  await conversation.updateUsername(dropNull(contactRecord.username), {
    shouldSave: false,
    fromStorageService: true,
  });

  let needsProfileFetch = false;
  if (contactRecord.profileKey && contactRecord.profileKey.length > 0) {
    needsProfileFetch = await conversation.setProfileKey(
      Bytes.toBase64(contactRecord.profileKey),
      { viaStorageServiceSync: true, reason: 'mergeContactRecord' }
    );
  }

  const remoteName = dropNull(contactRecord.givenName);
  const remoteFamilyName = dropNull(contactRecord.familyName);
  const localName = conversation.get('profileName');
  const localFamilyName = conversation.get('profileFamilyName');
  if (
    remoteName &&
    (localName !== remoteName || localFamilyName !== remoteFamilyName)
  ) {
    log.info(
      `mergeContactRecord: ${conversation.idForLogging()} name doesn't match remote name; overwriting`
    );
    details.push('updated profile name');
    conversation.set({
      profileName: remoteName,
      profileFamilyName: remoteFamilyName,
    });
    if (localName) {
      log.info(
        `mergeContactRecord: ${conversation.idForLogging()} name doesn't match remote name; also fetching profile`
      );
      drop(conversation.getProfiles());
      details.push('refreshing profile');
    }
  }
  conversation.set({
    systemGivenName: dropNull(contactRecord.systemGivenName),
    systemFamilyName: dropNull(contactRecord.systemFamilyName),
    systemNickname: dropNull(contactRecord.systemNickname),
    nicknameGivenName: dropNull(contactRecord.nickname?.given),
    nicknameFamilyName: dropNull(contactRecord.nickname?.family),
    note: dropNull(contactRecord.note),
  });

  // https://github.com/signalapp/Signal-Android/blob/fc3db538bcaa38dc149712a483d3032c9c1f3998/app/src/main/java/org/thoughtcrime/securesms/database/RecipientDatabase.kt#L921-L936
  if (contactRecord.identityKey.length) {
    const verified = await conversation.safeGetVerified();
    let { identityState } = contactRecord;
    if (identityState == null) {
      identityState = Proto.ContactRecord.IdentityState.DEFAULT;
    }
    const newVerified = fromRecordVerified(identityState);

    const { shouldAddVerifiedChangedMessage } =
      await signalProtocolStore.updateIdentityAfterSync(
        serviceId,
        newVerified,
        contactRecord.identityKey
      );

    if (verified !== newVerified) {
      details.push(
        `updating verified state from=${verified} ` +
          `is_null=${identityState == null} to=${newVerified}`
      );

      conversation.set({ verified: newVerified });
    }

    const VERIFIED_ENUM = signalProtocolStore.VerifiedStatus;
    if (shouldAddVerifiedChangedMessage) {
      details.push('adding a verified notification');
      await conversation.addVerifiedChange(
        conversation.id,
        newVerified === VERIFIED_ENUM.VERIFIED,
        { local: false }
      );
    }
  }

  await applyMessageRequestState(contactRecord, conversation);

  addUnknownFieldsToConversation(contactRecord, conversation, details);

  const oldStorageID = conversation.get('storageID');
  const oldStorageVersion = conversation.get('storageVersion');

  conversation.set({
    hideStory: Boolean(contactRecord.hideStory),
    isArchived: Boolean(contactRecord.archived),
    markedUnread: Boolean(contactRecord.markedUnread),
    storageID,
    storageVersion,
    needsStorageServiceSync: false,
  });

  if (contactRecord.hidden) {
    await conversation.removeContact({
      viaStorageServiceSync: true,
      shouldSave: false,
    });
  } else {
    await conversation.restoreContact({
      viaStorageServiceSync: true,
      shouldSave: false,
    });
  }

  conversation.setMuteExpiration(
    getTimestampFromLong(
      contactRecord.mutedUntilTimestamp,
      Number.MAX_SAFE_INTEGER
    ),
    {
      viaStorageServiceSync: true,
    }
  );

  if (
    !contactRecord.unregisteredAtTimestamp ||
    contactRecord.unregisteredAtTimestamp === 0n
  ) {
    conversation.setRegistered({ fromStorageService: true, shouldSave: false });
  } else {
    conversation.setUnregistered({
      timestamp: getTimestampFromLong(contactRecord.unregisteredAtTimestamp),
      fromStorageService: true,
      shouldSave: false,
    });
  }

  applyAvatarColor(conversation, contactRecord.avatarColor);

  return {
    conversation,
    updatedConversations: [conversation],
    needsProfileFetch,
    oldStorageID,
    oldStorageVersion,
    details,
  };
}

export async function mergeAccountRecord(
  storageID: string,
  storageVersion: number,
  accountRecord: Proto.AccountRecord
): Promise<MergeResultType> {
  const {
    linkPreviews,
    unlistedPhoneNumber,
    noteToSelfArchived,
    noteToSelfMarkedUnread,
    phoneNumberSharingMode,
    pinnedConversations,
    profileKey,
    readReceipts,
    sealedSenderIndicators,
    typingIndicators,
    preferContactAvatars,
    universalExpireTimer,
    preferredReactionEmoji: rawPreferredReactionEmoji,
    donorSubscriberId,
    donorSubscriberCurrencyCode,
    donorSubscriptionManuallyCancelled,
    backupSubscriberData,
    backupTier,
    displayBadgesOnProfile,
    keepMutedChatsArchived,
    hasCompletedUsernameOnboarding,
    hasSeenGroupStoryEducationSheet,
    hasSeenAdminDeleteEducationDialog,
    hasSetMyStoriesPrivacy,
    hasViewedOnboardingStory,
    storiesDisabled,
    storyViewReceiptsEnabled,
    username,
    usernameLink,
    notificationProfileManualOverride,
    notificationProfileSyncDisabled,
    automaticKeyVerificationDisabled,
  } = accountRecord;

  const conversation =
    window.ConversationController.getOurConversationOrThrow();

  const details = logRecordChanges(
    toAccountRecord(conversation, {
      notificationProfileSyncDisabled: Boolean(notificationProfileSyncDisabled),
    }),
    accountRecord
  );

  const updatedConversations = new Array<ConversationModel>();

  await itemStorage.put('read-receipt-setting', Boolean(readReceipts));

  if (typeof sealedSenderIndicators === 'boolean') {
    await itemStorage.put('sealedSenderIndicators', sealedSenderIndicators);
  }

  if (typeof typingIndicators === 'boolean') {
    await itemStorage.put('typingIndicators', typingIndicators);
  }

  if (typeof linkPreviews === 'boolean') {
    await itemStorage.put('linkPreviews', linkPreviews);
  }

  if (typeof preferContactAvatars === 'boolean') {
    const previous = itemStorage.get('preferContactAvatars');
    await itemStorage.put('preferContactAvatars', preferContactAvatars);

    const postRegistrationSyncsComplete =
      itemStorage.get('postRegistrationSyncsStatus') !== 'incomplete';

    if (
      Boolean(previous) !== Boolean(preferContactAvatars) &&
      postRegistrationSyncsComplete
    ) {
      await window.ConversationController.forceRerender();
    }
  }

  if (preferredReactionEmoji.canBeSynced(rawPreferredReactionEmoji)) {
    const localPreferredReactionEmoji =
      itemStorage.get('preferredReactionEmoji') || [];
    if (!isEqual(localPreferredReactionEmoji, rawPreferredReactionEmoji)) {
      log.warn(
        'storageService: remote and local preferredReactionEmoji do not match',
        localPreferredReactionEmoji.length,
        rawPreferredReactionEmoji.length
      );
    }
    await itemStorage.put('preferredReactionEmoji', rawPreferredReactionEmoji);
  }

  void setUniversalExpireTimer(
    DurationInSeconds.fromSeconds(universalExpireTimer || 0)
  );

  const PHONE_NUMBER_SHARING_MODE_ENUM =
    Proto.AccountRecord.PhoneNumberSharingMode;
  let phoneNumberSharingModeToStore: PhoneNumberSharingMode;
  switch (phoneNumberSharingMode) {
    case undefined:
    case null:
    case PHONE_NUMBER_SHARING_MODE_ENUM.EVERYBODY:
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Everybody;
      break;
    case PHONE_NUMBER_SHARING_MODE_ENUM.UNKNOWN:
    case PHONE_NUMBER_SHARING_MODE_ENUM.NOBODY:
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Nobody;
      break;
    default:
      assertDev(
        false,
        `storageService.mergeAccountRecord: Got an unexpected phone number sharing mode: ${phoneNumberSharingMode}. Falling back to default`
      );
      phoneNumberSharingModeToStore = PhoneNumberSharingMode.Everybody;
      break;
  }
  await itemStorage.put(
    'phoneNumberSharingMode',
    phoneNumberSharingModeToStore
  );

  const discoverability = unlistedPhoneNumber
    ? PhoneNumberDiscoverability.NotDiscoverable
    : PhoneNumberDiscoverability.Discoverable;

  // Key Transparancy parameters for self request change whenever
  // discoverability changes. Make sure we don't do self check prematurely
  if (discoverability !== itemStorage.get('phoneNumberDiscoverability')) {
    drop(keyTransparency.onKnownIdentifierChange());
  }
  await itemStorage.put('phoneNumberDiscoverability', discoverability);

  if (profileKey && profileKey.byteLength > 0) {
    // Access key is part of Key Transparency request and changing it must
    // delay self monitoring.
    drop(keyTransparency.onKnownIdentifierChange());
    drop(ourProfileKeyService.set(profileKey));
  }

  if (pinnedConversations) {
    const modelPinnedConversations =
      window.ConversationController.getAll().filter(convo =>
        Boolean(convo.get('isPinned'))
      );

    const modelPinnedConversationIds = modelPinnedConversations.map(convo =>
      convo.get('id')
    );

    const missingStoragePinnedConversationIds = itemStorage
      .get('pinnedConversationIds', new Array<string>())
      .filter(id => !modelPinnedConversationIds.includes(id));

    if (missingStoragePinnedConversationIds.length !== 0) {
      log.warn(
        'mergeAccountRecord: pinnedConversationIds in storage does not match pinned Conversation models'
      );
    }

    const locallyPinnedConversations = modelPinnedConversations.concat(
      missingStoragePinnedConversationIds
        .map(conversationId =>
          window.ConversationController.get(conversationId)
        )
        .filter((convo): convo is ConversationModel => convo !== undefined)
    );

    details.push(
      `local pinned=${locallyPinnedConversations.length}`,
      `remote pinned=${pinnedConversations.length}`
    );

    const remotelyPinnedConversations = pinnedConversations
      .map(({ identifier }) => {
        if (identifier == null) {
          return undefined;
        }

        const { contact, legacyGroupId, groupMasterKey } = identifier;
        let convo: ConversationModel | undefined;

        if (contact) {
          if (
            !contact.serviceId &&
            !Bytes.isNotEmpty(contact.serviceIdBinary) &&
            !contact.e164
          ) {
            log.error(
              'storageService.mergeAccountRecord: No serviceId or e164 on contact'
            );
            return undefined;
          }
          convo = window.ConversationController.lookupOrCreate({
            serviceId: fromServiceIdBinaryOrString(
              contact.serviceIdBinary,
              contact.serviceId,
              'AccountRecord.pin.serviceId'
            ),
            e164: contact.e164,
            reason: 'storageService.mergeAccountRecord',
          });
        } else if (legacyGroupId && legacyGroupId.length) {
          const groupId = Bytes.toBinary(legacyGroupId);
          convo = window.ConversationController.get(groupId);
        } else if (groupMasterKey && groupMasterKey.length) {
          const groupFields = deriveGroupFields(groupMasterKey);
          const groupId = Bytes.toBase64(groupFields.id);

          convo = window.ConversationController.get(groupId);
        } else {
          log.error(
            'storageService.mergeAccountRecord: Invalid identifier received'
          );
        }

        if (!convo) {
          log.error(
            'storageService.mergeAccountRecord: missing conversation id.'
          );
          return undefined;
        }

        return convo;
      })
      .filter(isNotNil);

    const remotelyPinnedConversationIds = remotelyPinnedConversations.map(
      ({ id }) => id
    );

    const conversationsToUnpin = locallyPinnedConversations.filter(
      ({ id }) => !remotelyPinnedConversationIds.includes(id)
    );

    details.push(
      `unpinning=${conversationsToUnpin.length}`,
      `pinning=${remotelyPinnedConversations.length}`
    );

    conversationsToUnpin.forEach(convo => {
      convo.set({ isPinned: false });
      updatedConversations.push(convo);
    });

    remotelyPinnedConversations.forEach(convo => {
      convo.set({ isPinned: true, isArchived: false });
      updatedConversations.push(convo);
    });

    await itemStorage.put(
      'pinnedConversationIds',
      remotelyPinnedConversationIds
    );
  }

  if (Bytes.isNotEmpty(donorSubscriberId)) {
    await itemStorage.put('subscriberId', donorSubscriberId);
  }
  if (typeof donorSubscriberCurrencyCode === 'string') {
    await itemStorage.put(
      'subscriberCurrencyCode',
      donorSubscriberCurrencyCode
    );
  }
  if (donorSubscriptionManuallyCancelled != null) {
    await itemStorage.put(
      'donorSubscriptionManuallyCancelled',
      donorSubscriptionManuallyCancelled
    );
  }

  await saveBackupsSubscriberData(backupSubscriberData);
  await saveBackupTier(toNumber(backupTier) ?? undefined);

  await itemStorage.put(
    'displayBadgesOnProfile',
    Boolean(displayBadgesOnProfile)
  );
  await itemStorage.put(
    'keepMutedChatsArchived',
    Boolean(keepMutedChatsArchived)
  );
  await itemStorage.put(
    'hasSetMyStoriesPrivacy',
    Boolean(hasSetMyStoriesPrivacy)
  );
  {
    const hasViewedOnboardingStoryBool = Boolean(hasViewedOnboardingStory);
    await itemStorage.put(
      'hasViewedOnboardingStory',
      hasViewedOnboardingStoryBool
    );
    if (hasViewedOnboardingStoryBool) {
      drop(findAndDeleteOnboardingStoryIfExists());
    } else {
      drop(downloadOnboardingStory());
    }
  }
  {
    const hasCompletedUsernameOnboardingBool = Boolean(
      hasCompletedUsernameOnboarding
    );
    await itemStorage.put(
      'hasCompletedUsernameOnboarding',
      hasCompletedUsernameOnboardingBool
    );
  }
  {
    const hasCompletedUsernameOnboardingBool = Boolean(
      hasSeenGroupStoryEducationSheet
    );
    await itemStorage.put(
      'hasSeenGroupStoryEducationSheet',
      hasCompletedUsernameOnboardingBool
    );
  }
  await itemStorage.put(
    'hasSeenAdminDeleteEducationDialog',
    hasSeenAdminDeleteEducationDialog ?? false
  );
  {
    const hasKeyTransparencyDisabled = Boolean(
      automaticKeyVerificationDisabled
    );
    await itemStorage.put(
      'hasKeyTransparencyDisabled',
      hasKeyTransparencyDisabled
    );
    if (hasKeyTransparencyDisabled) {
      await keyTransparency.disable();
    }
  }
  {
    const hasStoriesDisabled = Boolean(storiesDisabled);
    await itemStorage.put('hasStoriesDisabled', hasStoriesDisabled);
    onHasStoriesDisabledChange(hasStoriesDisabled);
  }

  switch (storyViewReceiptsEnabled) {
    case Proto.OptionalBool.ENABLED:
      await itemStorage.put('storyViewReceiptsEnabled', true);
      break;
    case Proto.OptionalBool.DISABLED:
      await itemStorage.put('storyViewReceiptsEnabled', false);
      break;
    case Proto.OptionalBool.UNSET:
    default:
      // Do nothing
      break;
  }

  if (usernameLink?.entropy?.length && usernameLink?.serverId?.length) {
    const oldLink = itemStorage.get('usernameLink');
    if (
      itemStorage.get('usernameLinkCorrupted') &&
      (!oldLink ||
        !Bytes.areEqual(usernameLink.entropy, oldLink.entropy) ||
        !Bytes.areEqual(usernameLink.serverId, oldLink.serverId))
    ) {
      details.push('clearing username link corruption');
      await itemStorage.remove('usernameLinkCorrupted');
    }

    let { color: linkColor } = usernameLink;
    if (
      !isKnownProtoEnumMember(Proto.AccountRecord.UsernameLink.Color, linkColor)
    ) {
      linkColor = 0;
    }

    await Promise.all([
      itemStorage.put('usernameLinkColor', linkColor),
      itemStorage.put('usernameLink', {
        entropy: usernameLink.entropy,
        serverId: usernameLink.serverId,
      }),
    ]);
  } else {
    await Promise.all([
      itemStorage.remove('usernameLinkColor'),
      itemStorage.remove('usernameLink'),
    ]);
  }

  const previousSyncDisabled = itemStorage.get(
    'notificationProfileSyncDisabled',
    false
  );
  if (previousSyncDisabled !== notificationProfileSyncDisabled) {
    log.info(
      `process(${storageVersion}): Account just flipped from notificationProfileSyncDisabled=${previousSyncDisabled} to ${notificationProfileSyncDisabled}`
    );
    await window.reduxActions.notificationProfiles.setIsSyncEnabled(
      !notificationProfileSyncDisabled,
      { fromStorageService: true }
    );
  }

  const override = notificationProfileManualOverride?.override;
  let overrideToSave: NotificationProfileOverride | undefined;
  if (override) {
    if (override.enabled?.id) {
      overrideToSave = {
        disabledAtMs: undefined,
        enabled: {
          profileId: normalizeNotificationProfileId(
            Bytes.toHex(override.enabled.id),
            'mergeAccountRecord'
          ),
          endsAtMs: toNumber(override.enabled.endAtTimestampMs),
        },
      };
    } else if (override.disabledAtTimestampMs) {
      overrideToSave = {
        disabledAtMs: toNumber(override.disabledAtTimestampMs),
        enabled: undefined,
      };
    } else {
      log.warn(
        'mergeAccountRecord: notificationProfileManualOverride had neither enabled nor disabledAtTimestamp. Clearing local override.'
      );
      overrideToSave = undefined;
    }
  } else {
    overrideToSave = undefined;
  }

  if (notificationProfileSyncDisabled) {
    await itemStorage.put(
      'notificationProfileOverrideFromPrimary',
      overrideToSave
    );
  } else {
    const { updateOverride } = window.reduxActions.notificationProfiles;
    updateOverride(overrideToSave, { fromStorageService: true });
  }

  addUnknownFieldsToConversation(accountRecord, conversation, details);

  const oldStorageID = conversation.get('storageID');
  const oldStorageVersion = conversation.get('storageVersion');

  if (username !== conversation.get('username')) {
    // Username is part of key transparency self monitor parameters. Make sure
    // we delay self-check until the changes fully propagate to the log.
    drop(keyTransparency.onKnownIdentifierChange());
    if (itemStorage.get('usernameCorrupted')) {
      details.push('clearing username corruption');
      await itemStorage.remove('usernameCorrupted');
    }
  }

  conversation.set({
    isArchived: Boolean(noteToSelfArchived),
    markedUnread: Boolean(noteToSelfMarkedUnread),
    storageID,
    storageVersion,
    needsStorageServiceSync: false,
  });

  await conversation.updateUsername(dropNull(username), {
    shouldSave: false,
    fromStorageService: true,
  });

  let needsProfileFetch = false;
  if (profileKey && profileKey.byteLength > 0) {
    needsProfileFetch = await conversation.setProfileKey(
      Bytes.toBase64(profileKey),
      { viaStorageServiceSync: true, reason: 'mergeAccountRecord' }
    );

    const avatarUrl = dropNull(accountRecord.avatarUrlPath);
    await conversation.setAndMaybeFetchProfileAvatar({
      avatarUrl,
      decryptionKey: profileKey,
    });
    await itemStorage.put('avatarUrl', avatarUrl);
  }

  applyAvatarColor(conversation, accountRecord.avatarColor);

  updatedConversations.push(conversation);

  return {
    conversation,
    updatedConversations,
    needsProfileFetch,
    oldStorageID,
    oldStorageVersion,
    details,
  };
}

export async function mergeStoryDistributionListRecord(
  storageID: string,
  storageVersion: number,
  storyDistributionListRecord: Proto.StoryDistributionListRecord
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  if (!storyDistributionListRecord.identifier) {
    throw new Error(
      `No storyDistributionList identifier for ${redactedStorageID}`
    );
  }

  const isMyStory = Bytes.areEqual(
    MY_STORY_BYTES,
    storyDistributionListRecord.identifier
  );

  let listId: StoryDistributionIdString;
  if (isMyStory) {
    listId = MY_STORY_ID;
  } else {
    const uuid = bytesToUuid(storyDistributionListRecord.identifier);
    strictAssert(uuid, 'mergeStoryDistributionListRecord: no distribution id');
    listId = normalizeStoryDistributionId(
      uuid,
      'mergeStoryDistributionListRecord'
    );
  }

  const localStoryDistributionList =
    await DataReader.getStoryDistributionWithMembers(listId);

  const details = logRecordChanges(
    localStoryDistributionList == null
      ? undefined
      : toStoryDistributionListRecord(localStoryDistributionList),
    storyDistributionListRecord
  );

  let remoteListMembers: Array<ServiceIdString>;

  if (storyDistributionListRecord.recipientServiceIdsBinary?.length) {
    remoteListMembers =
      storyDistributionListRecord.recipientServiceIdsBinary.map(id =>
        fromServiceIdBinaryOrString(id, undefined, 'unused')
      );
  } else if (storyDistributionListRecord.recipientServiceIds?.length) {
    remoteListMembers = storyDistributionListRecord.recipientServiceIds.map(
      id => normalizeServiceId(id, 'mergeStoryDistributionListRecord')
    );
  } else {
    remoteListMembers = [];
  }

  if (storyDistributionListRecord.$unknown) {
    details.push('adding unknown fields');
  }

  const deletedAtTimestamp = getTimestampFromLong(
    storyDistributionListRecord.deletedAtTimestamp
  );

  const storyDistribution: StoryDistributionWithMembersType = {
    id: listId,
    name: String(storyDistributionListRecord.name),
    deletedAtTimestamp: isMyStory ? undefined : deletedAtTimestamp,
    allowsReplies: Boolean(storyDistributionListRecord.allowsReplies),
    isBlockList: Boolean(storyDistributionListRecord.isBlockList),
    members: remoteListMembers,
    senderKeyInfo: localStoryDistributionList?.senderKeyInfo,

    storageID,
    storageVersion,
    storageUnknownFields: toStorageUnknownFields(
      storyDistributionListRecord.$unknown
    ),
    storageNeedsSync: false,
  };

  if (!localStoryDistributionList) {
    await DataWriter.createNewStoryDistribution(storyDistribution);

    const shouldSave = false;
    window.reduxActions.storyDistributionLists.createDistributionList(
      storyDistribution.name,
      remoteListMembers,
      storyDistribution,
      shouldSave
    );

    return {
      details,
    };
  }

  const oldStorageID = localStoryDistributionList.storageID;
  const oldStorageVersion = localStoryDistributionList.storageVersion;

  const needsToClearUnknownFields =
    !storyDistributionListRecord.$unknown &&
    localStoryDistributionList.storageUnknownFields;

  if (needsToClearUnknownFields) {
    details.push('clearing unknown fields');
  }

  const isBadRemoteData = !deletedAtTimestamp && !storyDistribution.name;
  if (isBadRemoteData) {
    Object.assign(storyDistribution, {
      name: localStoryDistributionList.name,
      members: localStoryDistributionList.members,
    });
  }

  const localMembersListSet = new Set(localStoryDistributionList.members);
  const toAdd: Array<ServiceIdString> = remoteListMembers.filter(
    serviceId => !localMembersListSet.has(serviceId)
  );

  const remoteMemberListSet = new Set(remoteListMembers);
  const toRemove: Array<ServiceIdString> =
    localStoryDistributionList.members.filter(
      serviceId => !remoteMemberListSet.has(serviceId)
    );

  details.push('updated');
  await DataWriter.modifyStoryDistributionWithMembers(storyDistribution, {
    toAdd,
    toRemove,
  });
  window.reduxActions.storyDistributionLists.modifyDistributionList({
    allowsReplies: Boolean(storyDistribution.allowsReplies),
    deletedAtTimestamp: storyDistribution.deletedAtTimestamp,
    id: storyDistribution.id,
    isBlockList: Boolean(storyDistribution.isBlockList),
    membersToAdd: toAdd,
    membersToRemove: toRemove,
    name: storyDistribution.name,
  });

  return {
    details,
    oldStorageID,
    oldStorageVersion,
  };
}

export async function mergeStickerPackRecord(
  storageID: string,
  storageVersion: number,
  stickerPackRecord: Proto.StickerPackRecord
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  if (!stickerPackRecord.packId || Bytes.isEmpty(stickerPackRecord.packId)) {
    throw new Error(`No stickerPackRecord identifier for ${redactedStorageID}`);
  }

  const id = Bytes.toHex(stickerPackRecord.packId);

  const localStickerPack = await DataReader.getStickerPackInfo(id);

  const details = logRecordChanges(
    localStickerPack == null
      ? undefined
      : toStickerPackRecord(localStickerPack),
    stickerPackRecord
  );

  if (stickerPackRecord.$unknown) {
    details.push('adding unknown fields');
  }
  const storageUnknownFields = toStorageUnknownFields(
    stickerPackRecord.$unknown
  );

  let stickerPack: StickerPackInfoType;
  if (toNumber(stickerPackRecord.deletedAtTimestamp)) {
    stickerPack = {
      id,
      uninstalledAt: toNumber(stickerPackRecord.deletedAtTimestamp),
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync: false,
    };
  } else {
    if (
      !stickerPackRecord.packKey ||
      Bytes.isEmpty(stickerPackRecord.packKey)
    ) {
      throw new Error(`No stickerPackRecord key for ${redactedStorageID}`);
    }

    stickerPack = {
      id,
      key: Bytes.toBase64(stickerPackRecord.packKey),
      position:
        'position' in stickerPackRecord
          ? stickerPackRecord.position
          : (localStickerPack?.position ?? undefined),
      storageID,
      storageVersion,
      storageUnknownFields,
      storageNeedsSync: false,
    };
  }

  const oldStorageID = localStickerPack?.storageID;
  const oldStorageVersion = localStickerPack?.storageVersion;

  const needsToClearUnknownFields =
    !stickerPack.storageUnknownFields && localStickerPack?.storageUnknownFields;

  if (needsToClearUnknownFields) {
    details.push('clearing unknown fields');
  }

  const wasUninstalled = Boolean(localStickerPack?.uninstalledAt);
  const isUninstalled = Boolean(stickerPack.uninstalledAt);

  details.push(
    `wasUninstalled=${wasUninstalled}`,
    `isUninstalled=${isUninstalled}`,
    `oldPosition=${localStickerPack?.position ?? '?'}`,
    `newPosition=${stickerPack.position ?? '?'}`
  );

  if (!wasUninstalled && isUninstalled) {
    if (localStickerPack != null) {
      assertDev(localStickerPack.key, 'Installed sticker pack has no key');
      window.reduxActions.stickers.uninstallStickerPack(
        localStickerPack.id,
        localStickerPack.key,
        {
          actionSource: 'storageService',
          uninstalledAt: stickerPack.uninstalledAt,
        }
      );
    } else {
      strictAssert(
        stickerPack.key == null && stickerPack.uninstalledAt != null,
        'Created sticker pack must be already uninstalled'
      );
      await DataWriter.addUninstalledStickerPack(stickerPack);
    }
  } else if ((!localStickerPack || wasUninstalled) && !isUninstalled) {
    assertDev(stickerPack.key, 'Sticker pack does not have key');

    const status = Stickers.getStickerPackStatus(stickerPack.id);
    if (status === 'downloaded') {
      window.reduxActions.stickers.installStickerPack(
        stickerPack.id,
        stickerPack.key,
        {
          actionSource: 'storageService',
        }
      );
    } else {
      void Stickers.downloadStickerPack(stickerPack.id, stickerPack.key, {
        finalStatus: 'installed',
        actionSource: 'storageService',
      });
    }
  }

  await DataWriter.updateStickerPackInfo(stickerPack);

  return {
    details,
    oldStorageID,
    oldStorageVersion,
  };
}

export async function mergeCallLinkRecord(
  storageID: string,
  storageVersion: number,
  callLinkRecord: Proto.CallLinkRecord
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  // callLinkRecords must have rootKey
  if (!callLinkRecord.rootKey) {
    return { shouldDrop: true, details: ['no rootKey'] };
  }

  const rootKeyString = fromRootKeyBytes(callLinkRecord.rootKey);
  const adminKeyString = callLinkRecord.adminPasskey
    ? fromAdminKeyBytes(callLinkRecord.adminPasskey)
    : null;

  const roomId = getRoomIdFromRootKeyString(rootKeyString);
  const logId = `mergeCallLinkRecord(${redactedStorageID}, ${roomId})`;

  const localCallLinkDbRecord =
    await DataReader.getCallLinkRecordByRoomId(roomId);

  const details = logRecordChanges(
    localCallLinkDbRecord == null
      ? undefined
      : toCallLinkRecord(localCallLinkDbRecord),
    callLinkRecord
  );

  // Note deletedAtTimestampMs can be 0
  const deletedAtTimestampMs = toNumber(callLinkRecord.deletedAtTimestampMs);
  const deletedAt = deletedAtTimestampMs || null;
  const shouldDrop = Boolean(
    deletedAt && isOlderThan(deletedAt, getMessageQueueTime())
  );
  if (shouldDrop) {
    details.push(
      `expired deleted call link deletedAt=${deletedAt}; scheduling for removal`
    );
  }

  const callLinkDbRecord: CallLinkRecord = {
    roomId,
    rootKey: callLinkRecord.rootKey,
    adminKey: callLinkRecord.adminPasskey ?? null,
    name: localCallLinkDbRecord?.name ?? '',
    restrictions: localCallLinkDbRecord?.restrictions ?? 0,
    expiration: localCallLinkDbRecord?.expiration ?? null,
    revoked: localCallLinkDbRecord?.revoked === 1 ? 1 : 0,
    deleted: deletedAt ? 1 : 0,
    deletedAt,

    storageID,
    storageVersion,
    storageUnknownFields: toStorageUnknownFields(callLinkRecord.$unknown),
    storageNeedsSync: 0,
  };

  if (!localCallLinkDbRecord) {
    if (deletedAt) {
      details.push(
        `skipping deleted call link with no matching local record deletedAt=${deletedAt}`
      );
    } else if (await DataReader.defunctCallLinkExists(roomId)) {
      details.push('skipping known defunct call link');
    } else if (callLinkRefreshJobQueue.hasPendingCallLink(storageID)) {
      details.push('pending call link refresh, updating storage fields');
      callLinkRefreshJobQueue.updatePendingCallLinkStorageFields(
        rootKeyString,
        {
          storageID,
          storageVersion,
          storageUnknownFields: callLinkDbRecord.storageUnknownFields,
          storageNeedsSync: false,
        }
      );
    } else {
      details.push('new call link, enqueueing call link refresh and create');

      // Queue a job to refresh the call link to confirm its existence.
      // Include the bundle of call link data so we can insert the call link
      // after confirmation.
      const callLink = callLinkFromRecord(callLinkDbRecord);
      drop(
        callLinkRefreshJobQueue.add({
          rootKey: callLink.rootKey,
          adminKey: callLink.adminKey,
          storageID: callLink.storageID,
          storageVersion: callLink.storageVersion,
          storageUnknownFields: callLink.storageUnknownFields,
          source: `storage.mergeCallLinkRecord(${redactedStorageID})`,
        })
      );
    }

    return {
      details,
      shouldDrop,
    };
  }

  const oldStorageID = localCallLinkDbRecord.storageID || undefined;
  const oldStorageVersion = localCallLinkDbRecord.storageVersion || undefined;

  const needsToClearUnknownFields =
    !callLinkRecord.$unknown && localCallLinkDbRecord.storageUnknownFields;
  if (needsToClearUnknownFields) {
    details.push('clearing unknown fields');
  }

  const isBadRemoteData = Boolean(deletedAt && adminKeyString);
  if (isBadRemoteData) {
    log.warn(
      `${logId}: Found bad remote data: deletedAtTimestampMs and adminPasskey were both present. Assuming deleted.`
    );
  }

  // First update local record
  details.push('updated');
  const callLink = callLinkFromRecord(callLinkDbRecord);
  await DataWriter.updateCallLink(callLink);

  // Deleted in storage but we have it locally: Delete locally too and update redux
  if (deletedAt && localCallLinkDbRecord.deleted !== 1) {
    // Another device deleted the link and uploaded to storage, and we learned about it
    log.info(`${logId}: Discovered deleted call link, deleting locally`);
    details.push('deleting locally');
    // No need to delete via RingRTC as we assume the originating device did that already
    await DataWriter.deleteCallLinkAndHistory(roomId);
    window.reduxActions.calling.handleCallLinkDelete({ roomId });
  } else if (!deletedAt && localCallLinkDbRecord.deleted === 1) {
    // Not deleted in storage, but we've marked it as deleted locally.
    // Skip doing anything, we will update things locally after sync.
    log.warn(`${logId}: Found call link, but it was marked deleted locally.`);
  } else {
    window.reduxActions.calling.handleCallLinkUpdate({
      rootKey: rootKeyString,
      adminKey: adminKeyString,
    });
  }

  return {
    details,
    shouldDrop,
    oldStorageID,
    oldStorageVersion,
  };
}

function protoToChatFolderType(
  folderType: Proto.ChatFolderRecord['folderType']
) {
  if (folderType === Proto.ChatFolderRecord.FolderType.ALL) {
    return ChatFolderType.ALL;
  }
  if (folderType === Proto.ChatFolderRecord.FolderType.CUSTOM) {
    return ChatFolderType.CUSTOM;
  }
  return ChatFolderType.UNKNOWN;
}

function recipientToConversationId(
  recipient: Proto.Recipient,
  logPrefix: string
): string {
  let match: ConversationModel | undefined;
  if (recipient.identifier?.contact != null) {
    const serviceId = fromServiceIdBinaryOrString(
      recipient.identifier.contact.serviceIdBinary,
      recipient.identifier.contact.serviceId,
      `${logPrefix}.recipientToConversationId`
    );
    match = window.ConversationController.get(serviceId);
    match ??= window.ConversationController.get(
      recipient.identifier.contact.e164
    );
  } else if (
    recipient.identifier?.groupMasterKey != null &&
    recipient.identifier?.groupMasterKey.byteLength !== 0
  ) {
    const secretParams = deriveGroupSecretParams(
      recipient.identifier.groupMasterKey
    );
    const groupId = Bytes.toBase64(deriveGroupID(secretParams));
    match = window.ConversationController.get(groupId);
  } else if (
    recipient.identifier?.legacyGroupId != null &&
    recipient.identifier.legacyGroupId.byteLength !== 0
  ) {
    const groupId = Bytes.toBinary(recipient.identifier.legacyGroupId);
    match = window.ConversationController.get(groupId);
  } else {
    throw new Error('Unexpected type of recipient');
  }
  strictAssert(match, `${logPrefix}: Missing conversation for recipient`);
  return match.id;
}

function recipientsToConversationIds(
  recipients: ReadonlyArray<Proto.Recipient>,
  logPrefix: string
): ReadonlyArray<string> {
  return recipients.map(recipient => {
    return recipientToConversationId(recipient, logPrefix);
  });
}

export async function mergeChatFolderRecord(
  storageID: string,
  storageVersion: number,
  remoteChatFolderRecord: Proto.ChatFolderRecord
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });

  if (remoteChatFolderRecord.id == null) {
    return { shouldDrop: true, details: ['no id'] };
  }

  const idString = bytesToUuid(remoteChatFolderRecord.id) as ChatFolderId;
  const logPrefix = `mergeChatFolderRecord(${redactedStorageID}, idString)`;

  const remoteChatFolder: ChatFolder = {
    id: idString,
    folderType: protoToChatFolderType(
      remoteChatFolderRecord.folderType ??
        Proto.ChatFolderRecord.FolderType.UNKNOWN
    ),
    name: remoteChatFolderRecord.name ?? '',
    position: remoteChatFolderRecord.position ?? CHAT_FOLDER_DELETED_POSITION,
    showOnlyUnread: remoteChatFolderRecord.showOnlyUnread ?? false,
    showMutedChats: remoteChatFolderRecord.showMutedChats ?? false,
    includeAllIndividualChats:
      remoteChatFolderRecord.includeAllIndividualChats ?? false,
    includeAllGroupChats: remoteChatFolderRecord.includeAllGroupChats ?? false,
    includedConversationIds: recipientsToConversationIds(
      remoteChatFolderRecord.includedRecipients ?? [],
      logPrefix
    ),
    excludedConversationIds: recipientsToConversationIds(
      remoteChatFolderRecord.excludedRecipients ?? [],
      logPrefix
    ),
    deletedAtTimestampMs:
      toNumber(remoteChatFolderRecord.deletedAtTimestampMs) ?? 0,
    storageID,
    storageVersion,
    storageUnknownFields:
      remoteChatFolderRecord.$unknown != null
        ? Bytes.concatenate(remoteChatFolderRecord.$unknown)
        : null,
    storageNeedsSync: false,
  };

  const localChatFolder = await DataReader.getChatFolder(remoteChatFolder.id);

  let deletedAtTimestampMs: number;

  const remoteDeletedAt = remoteChatFolder.deletedAtTimestampMs;
  const localDeletedAt = localChatFolder?.deletedAtTimestampMs ?? 0;

  if (remoteDeletedAt > 0 && localDeletedAt > 0) {
    if (remoteDeletedAt < localDeletedAt) {
      deletedAtTimestampMs = remoteDeletedAt;
    } else {
      deletedAtTimestampMs = localDeletedAt;
    }
  } else if (remoteDeletedAt > 0) {
    deletedAtTimestampMs = remoteDeletedAt;
  } else if (localDeletedAt > 0) {
    deletedAtTimestampMs = localDeletedAt;
  } else {
    deletedAtTimestampMs = remoteDeletedAt;
  }

  if (remoteChatFolder.folderType === ChatFolderType.ALL) {
    log.info(`${logPrefix}: Updating or inserting all chats folder`);
    await DataWriter.upsertAllChatsChatFolderFromSync(remoteChatFolder);
  } else if (deletedAtTimestampMs > 0) {
    if (localChatFolder == null) {
      log.info(
        `${logPrefix}: skipping deleted chat folder, no local record found`
      );
    } else if (localDeletedAt === deletedAtTimestampMs) {
      log.info(
        `${logPrefix}: skipping deleted chat folder, local record already deleted`
      );
    } else if (localDeletedAt > 0) {
      log.info(`${logPrefix}: updating deleted chat folder timestamp`);

      await DataWriter.updateChatFolderDeletedAtTimestampMsFromSync(
        remoteChatFolder.id,
        // `deletedAtTimestampMs` should already be the earlier delete timestamp
        deletedAtTimestampMs
      );
      drop(chatFolderCleanupService.trigger('storage: updated timestamp'));
    } else {
      log.info(`${logPrefix}: deleting chat folder`);
      await DataWriter.markChatFolderDeleted(
        remoteChatFolder.id,
        deletedAtTimestampMs,
        false
      );
      drop(chatFolderCleanupService.trigger('storage: deleted chat folder'));
    }
  } else if (localChatFolder == null) {
    log.info(`${logPrefix}: creating new chat folder`);
    await DataWriter.createChatFolder(remoteChatFolder);
  } else {
    log.info(`${logPrefix}: updating existing chat folder`);
    await DataWriter.updateChatFolder(remoteChatFolder);
  }

  window.reduxActions.chatFolders.refetchChatFolders();

  const details = logRecordChanges(
    localChatFolder != null ? toChatFolderRecord(localChatFolder) : undefined,
    remoteChatFolderRecord
  );

  const shouldDrop =
    remoteChatFolder.deletedAtTimestampMs > 0 &&
    isOlderThan(remoteChatFolder.deletedAtTimestampMs, getMessageQueueTime());

  return {
    details,
    shouldDrop,
    oldStorageID: localChatFolder?.storageID ?? undefined,
    oldStorageVersion: localChatFolder?.storageVersion ?? undefined,
  };
}

function cleanNotificationProfileForComparision(
  profile: NotificationProfileType
): Omit<NotificationProfileType, 'id'> & {
  id: null;
} {
  return {
    ...profile,
    // Color and id are randomly assigned; profiles made on different devices will differ
    id: null,
    color: 0,
    // If we really just care about structure, then we shouldn't consider this
    createdAtMs: 0,
    // Storage services details could easily get out of date
    storageID: null,
    storageNeedsSync: false,
    storageVersion: null,
    storageUnknownFields: undefined,
  };
}

export function prepareForDisabledNotificationProfileSync(): {
  toAdd: Array<NotificationProfileType>;
  newOverride: NotificationProfileOverride | undefined;
} {
  const logId = 'prepareForDisabledNotificationProfileSync';
  const state = window.reduxStore.getState();
  const { profiles } = state.notificationProfiles;
  let newOverride: NotificationProfileOverride | undefined = itemStorage.get(
    'notificationProfileOverride'
  );

  const notDeletedProfiles = profiles.filter(
    profile =>
      (profile.storageID && profile.deletedAtTimestampMs == null) ||
      profile.deletedAtTimestampMs === 0
  );

  const toAdd: Array<NotificationProfileType> = [];

  notDeletedProfiles.forEach(profile => {
    const localId = generateNotificationProfileId();
    toAdd.push({
      ...omit(profile, 'storageID', 'storageVersion', 'storageUnknownFields'),
      id: localId,
      storageNeedsSync: true,
      // Note: we check for createdAtMs + 1 downfile for conflict detection
      createdAtMs: profile.createdAtMs + 1,
    });

    if (newOverride?.enabled?.profileId === profile.id) {
      log.info(
        `${logId}: Override referenced now-remote match; updating to local profile`
      );
      newOverride = {
        disabledAtMs: undefined,
        enabled: {
          endsAtMs: newOverride.enabled.endsAtMs,
          profileId: localId,
        },
      };
    }
  });

  log.info(`${logId}: Duplicated ${toAdd.length} profiles`);
  return {
    newOverride,
    toAdd,
  };
}

export function prepareForEnabledNotificationProfileSync(): {
  newOverride: NotificationProfileOverride | undefined;
  toAdd: Array<NotificationProfileType>;
  toRemove: Array<NotificationProfileType>;
} {
  const logId = 'prepareForEnabledNotificationProfileSync';
  const state = window.reduxStore.getState();
  const { profiles } = state.notificationProfiles;
  let newOverride: NotificationProfileOverride | undefined = itemStorage.get(
    'notificationProfileOverride'
  );

  const notDeletedProfiles = profiles.filter(
    profile =>
      profile.deletedAtTimestampMs == null || profile.deletedAtTimestampMs === 0
  );
  const withCleaned = notDeletedProfiles.map(profile => ({
    clean: cleanNotificationProfileForComparision(profile),
    profile,
  }));
  const result = partition(withCleaned, item => item.profile.storageID);
  const remoteProfiles = result[0];
  let localProfiles = result[1];

  const toRemove: Array<NotificationProfileType> = [];

  remoteProfiles.forEach(remote => {
    const localMatch = localProfiles.find(local =>
      isEqual(remote.clean, local.clean)
    );

    if (localMatch) {
      log.info(
        `${logId}: Found local record that matches. Dropping local in favor of remote`
      );
      toRemove.push(localMatch.profile);
      localProfiles = without(localProfiles, localMatch);

      if (newOverride?.enabled?.profileId === localMatch.profile.id) {
        log.info(
          `${logId}: Override referenced local match; updating to remote profile`
        );
        newOverride = {
          disabledAtMs: undefined,
          enabled: {
            endsAtMs: newOverride.enabled.endsAtMs,
            profileId: remote.profile.id,
          },
        };
      }
    }
  });

  const toAdd: Array<NotificationProfileType> = [];
  localProfiles.forEach(local => {
    if (
      remoteProfiles.some(
        remote =>
          remote.profile.name === local.profile.name &&
          // Note: when we create local copies above, we use original.createdAtMs + 1
          remote.profile.createdAtMs + 1 === local.profile.createdAtMs
      )
    ) {
      log.info(
        `${logId}: Found local record that indicates divergence; adding copy label`
      );
      toRemove.push(local.profile);
      toAdd.push({
        ...local.profile,
        name: window.SignalContext.i18n('icu:NotificationProfile--copy-label', {
          profileName: local.profile.name,
        }),
      });
    }
  });

  log.info(
    `${logId}: Removed ${toRemove.length} profiles, added ${toAdd.length} profiles`
  );
  return {
    newOverride,
    toAdd,
    toRemove,
  };
}

export async function mergeNotificationProfileRecord(
  storageID: string,
  storageVersion: number,
  profileRecord: Proto.NotificationProfile
): Promise<MergeResultType> {
  const redactedStorageID = redactExtendedStorageID({
    storageID,
    storageVersion,
  });
  const {
    id,
    name,
    color,
    emoji,
    createdAtMs,
    allowAllCalls,
    allowAllMentions,
    allowedMembers,
    scheduleEnabled,
    scheduleStartTime,
    scheduleEndTime,
    scheduleDaysEnabled,
    deletedAtTimestampMs,
  } = profileRecord;
  // NotificationProfile records must have id
  if (!id) {
    return { shouldDrop: true, details: ['no id'] };
  }
  // NotificationProfile records must have name
  if (!name) {
    return { shouldDrop: true, details: ['no name'] };
  }

  const details: Array<string> = [];

  const idString = normalizeNotificationProfileId(
    Bytes.toHex(id),
    'storage service merge',
    log
  );
  const logId = `mergeNotificationProfileRecord(${redactedStorageID}, ${redactNotificationProfileId(idString)})`;
  const localProfile = await DataReader.getNotificationProfileById(idString);

  // Note deletedAtTimestampMs can be 0
  const deletedAt = toNumber(deletedAtTimestampMs) || null;
  const shouldDrop = Boolean(
    deletedAt && isOlderThan(deletedAt, getMessageQueueTime())
  );
  if (shouldDrop) {
    details.push(
      `expired deleted notification profile deletedAt=${deletedAt}; scheduling for removal`
    );
  }

  const allowedMemberConversationIds = recipientsToConversationIds(
    allowedMembers || [],
    logId
  );

  if (localProfile?.storageNeedsSync) {
    log.warn(
      `${logId}: Local record had storageNeedsSync=true, but we're updating from remote`
    );
  }

  const localDeletedAt = localProfile?.deletedAtTimestampMs;
  const newProfile: NotificationProfileType = {
    id: idString,
    name,
    emoji: dropNull(emoji),
    color: dropNull(color) ?? DEFAULT_PROFILE_COLOR,
    createdAtMs: toNumber(createdAtMs) ?? Date.now(),
    allowAllCalls: Boolean(allowAllCalls),
    allowAllMentions: Boolean(allowAllMentions),
    allowedMembers: new Set(allowedMemberConversationIds),
    scheduleEnabled: Boolean(scheduleEnabled),
    scheduleStartTime: dropNull(scheduleStartTime),
    scheduleEndTime: dropNull(scheduleEndTime),
    scheduleDaysEnabled: fromDayOfWeekArray(
      scheduleDaysEnabled.map(day => {
        return isKnownProtoEnumMember(Proto.NotificationProfile.DayOfWeek, day)
          ? day
          : Proto.NotificationProfile.DayOfWeek.UNKNOWN;
      })
    ),
    deletedAtTimestampMs: localDeletedAt
      ? Math.min(localDeletedAt, deletedAt ?? Number.MAX_SAFE_INTEGER)
      : dropNull(deletedAt),
    storageID,
    storageVersion,
    storageUnknownFields:
      toStorageUnknownFields(profileRecord.$unknown) ?? undefined,
    storageNeedsSync: false,
  };

  const { profileWasCreated, profileWasUpdated } =
    window.reduxActions.notificationProfiles;

  if (!localProfile) {
    if (deletedAt) {
      details.push(
        `skipping deleted notification profile with no matching local record deletedAt=${deletedAt}`
      );
    } else {
      details.push('created new notification profile');
      await DataWriter.createNotificationProfile(newProfile);
      profileWasCreated(newProfile);
    }

    return {
      details,
      shouldDrop,
    };
  }

  const oldStorageID = localProfile.storageID || undefined;
  const oldStorageVersion = localProfile.storageVersion || undefined;

  const needsToClearUnknownFields =
    !profileRecord.$unknown && localProfile.storageUnknownFields;
  if (needsToClearUnknownFields) {
    details.push('clearing unknown fields');
  }

  const changeDetails = logRecordChanges(
    toNotificationProfileRecord(newProfile),
    profileRecord
  );

  // First update local record
  details.push('updated');
  await DataWriter.updateNotificationProfile(newProfile);
  profileWasUpdated(newProfile);

  if (deletedAt && !localProfile.deletedAtTimestampMs) {
    log.info(`${logId}: Discovered profile deleted remotely.`);
  } else if (!deletedAt && localProfile.deletedAtTimestampMs) {
    log.info(
      `${logId}: Notification profile deleted locally, but not remotely.`
    );
  } else if (deletedAt && localProfile.deletedAtTimestampMs) {
    // No need to do anything - deleted before, and deleted now
  }

  return {
    details: [...details, ...changeDetails],
    shouldDrop,
    oldStorageID,
    oldStorageVersion,
  };
}
