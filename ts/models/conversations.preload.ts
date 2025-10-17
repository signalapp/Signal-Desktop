// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { v4 as generateGuid } from 'uuid';
import PQueue from 'p-queue';
import { ContentHint } from '@signalapp/libsignal-client';

import type { ReadonlyDeep } from 'type-fest';
import type {
  ConversationAttributesType,
  ConversationLastProfileType,
  ConversationRenderInfoType,
  MessageAttributesType,
  QuotedMessageType,
  SenderKeyInfoType,
} from '../model-types.d.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { getConversation } from '../util/getConversation.preload.js';
import {
  copyAttachmentIntoTempDirectory,
  deleteAttachmentData,
  doesAttachmentExist,
  getAbsoluteAttachmentPath,
  getAbsoluteTempPath,
  readStickerData,
  upgradeMessageSchema,
  writeNewAttachmentData,
} from '../util/migrations.preload.js';
import { drop } from '../util/drop.std.js';
import { isShallowEqual } from '../util/isShallowEqual.std.js';
import { getInitials } from '../util/getInitials.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.js';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.js';
import { getNotificationDataForMessage } from '../util/getNotificationDataForMessage.preload.js';
import type { ProfileNameChangeType } from '../util/getStringForProfileChange.std.js';
import type { AttachmentType, ThumbnailType } from '../types/Attachment.std.js';
import { toDayMillis } from '../util/timestamp.std.js';
import { areWeAdmin } from '../util/areWeAdmin.preload.js';
import { isBlocked } from '../util/isBlocked.preload.js';
import { getAboutText } from '../util/getAboutText.dom.js';
import {
  getAvatar,
  getRawAvatarPath,
  getLocalAvatarUrl,
} from '../util/avatarUtils.preload.js';
import { getDraftPreview } from '../util/getDraftPreview.preload.js';
import { hasDraft } from '../util/hasDraft.std.js';
import { hydrateStoryContext } from '../util/hydrateStoryContext.preload.js';
import * as Conversation from '../types/Conversation.node.js';
import type {
  StickerType,
  StickerWithHydratedData,
} from '../types/Stickers.preload.js';
import * as Stickers from '../types/Stickers.preload.js';
import { StorySendMode } from '../types/Stories.std.js';
import type { EmbeddedContactWithHydratedAvatar } from '../types/EmbeddedContact.std.js';
import {
  type GroupV2InfoType,
  messageSender,
} from '../textsecure/SendMessage.preload.js';
import {
  getAvatar as doGetAvatar,
  cdsLookup,
  checkAccountExistence,
} from '../textsecure/WebAPI.preload.js';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout.std.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import type {
  CallbackResultType,
  PniSignatureMessageType,
} from '../textsecure/Types.d.ts';
import type {
  ConversationType,
  DraftPreviewType,
} from '../state/ducks/conversations.preload.js';
import type {
  AvatarColorType,
  ConversationColorType,
  CustomColorType,
} from '../types/Colors.std.js';
import { strictAssert } from '../util/assert.std.js';
import { isConversationMuted } from '../util/isConversationMuted.std.js';
import { isConversationSMSOnly } from '../util/isConversationSMSOnly.std.js';
import {
  isConversationEverUnregistered,
  isConversationUnregistered,
  isConversationUnregisteredAndStale,
} from '../util/isConversationUnregistered.dom.js';
import { sniffImageMimeType } from '../util/sniffImageMimeType.std.js';
import { isValidE164 } from '../util/isValidE164.std.js';
import type { MIMEType } from '../types/MIME.std.js';
import { IMAGE_JPEG, IMAGE_WEBP } from '../types/MIME.std.js';
import type {
  AciString,
  PniString,
  ServiceIdString,
} from '../types/ServiceId.std.js';
import {
  ServiceIdKind,
  normalizeServiceId,
  normalizePni,
} from '../types/ServiceId.std.js';
import { isAciString } from '../util/isAciString.std.js';
import {
  constantTimeEqual,
  decryptProfile,
  decryptProfileName,
  hashProfileKey,
} from '../Crypto.node.js';
import { decryptAttachmentV2 } from '../AttachmentCrypto.node.js';
import * as Bytes from '../Bytes.std.js';
import type { DraftBodyRanges } from '../types/BodyRange.std.js';
import { migrateColor } from '../util/migrateColor.node.js';
import { isNotNil } from '../util/isNotNil.std.js';
import { signalProtocolStore } from '../SignalProtocolStore.preload.js';
import { shouldSaveNotificationAvatarToDisk } from '../services/notifications.preload.js';
import { storageServiceUploadJob } from '../services/storage.preload.js';
import { challengeHandler } from '../services/challengeHandler.preload.js';
import { getSendOptions } from '../util/getSendOptions.preload.js';
import type { IsConversationAcceptedOptionsType } from '../util/isConversationAccepted.preload.js';
import { isConversationAccepted } from '../util/isConversationAccepted.preload.js';
import {
  getNumber,
  getProfileName,
  getTitle,
  getTitleNoDefault,
  hasNumberTitle,
  hasUsernameTitle,
  canHaveUsername,
} from '../util/getTitle.preload.js';
import { markConversationRead } from '../util/markConversationRead.preload.js';
import { handleMessageSend } from '../util/handleMessageSend.preload.js';
import { getConversationMembers } from '../util/getConversationMembers.dom.js';
import { updateConversationsWithUuidLookup } from '../updateConversationsWithUuidLookup.dom.js';
import { ReadStatus } from '../messages/MessageReadStatus.std.js';
import { SendStatus } from '../messages/MessageSendState.std.js';
import type {
  LinkPreviewType,
  LinkPreviewWithHydratedData,
} from '../types/message/LinkPreviews.std.js';
import {
  MINUTE,
  SECOND,
  DurationInSeconds,
} from '../util/durations/index.std.js';
import {
  concat,
  filter,
  map,
  repeat,
  zipObject,
} from '../util/iterables.std.js';
import * as universalExpireTimer from '../util/universalExpireTimer.preload.js';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions.std.js';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
  isGroupV2,
  isMe,
} from '../util/whatTypeOfConversation.dom.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import {
  getMessagePropStatus,
  hasErrors,
  isIncoming,
  isStory,
} from '../state/selectors/message.preload.js';
import { getPreloadedConversationId } from '../state/selectors/conversations.dom.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue.preload.js';
import { getProfile } from '../util/getProfile.preload.js';
import { SEALED_SENDER } from '../types/SealedSender.std.js';
import { createIdenticon } from '../util/createIdenticon.preload.js';
import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import { isMessageUnread } from '../util/isMessageUnread.std.js';
import type { SenderKeyTargetType } from '../util/sendToGroup.preload.js';
import {
  resetSenderKey,
  sendContentMessageToGroup,
} from '../util/sendToGroup.preload.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import { TimelineMessageLoadingState } from '../util/timelineUtil.std.js';
import { SeenStatus } from '../MessageSeenStatus.std.js';
import { getConversationIdForLogging } from '../util/idForLogging.preload.js';
import { getSendTarget } from '../util/getSendTarget.std.js';
import { getRecipients } from '../util/getRecipients.dom.js';
import { validateConversation } from '../util/validateConversation.dom.js';
import { isSignalConversation } from '../util/isSignalConversation.dom.js';
import { removePendingMember } from '../util/removePendingMember.preload.js';
import {
  isMember,
  isMemberAwaitingApproval,
  isMemberBanned,
  isMemberPending,
  isMemberRequestingToJoin,
} from '../util/groupMembershipUtils.preload.js';
import { imageToBlurHash } from '../util/imageToBlurHash.dom.js';
import { ReceiptType } from '../types/Receipt.std.js';
import { getQuoteAttachment } from '../util/makeQuote.preload.js';
import {
  deriveAccessKeyFromProfileKey,
  deriveProfileKeyVersion,
} from '../util/zkgroup.node.js';
import { incrementMessageCounter } from '../util/incrementMessageCounter.preload.js';
import { generateMessageId } from '../util/generateMessageId.node.js';
import { getMessageAuthorText } from '../util/getMessageAuthorText.preload.js';
import { downscaleOutgoingAttachment } from '../util/attachments.preload.js';
import {
  MessageRequestResponseSource,
  type MessageRequestResponseInfo,
  MessageRequestResponseEvent,
} from '../types/MessageRequestResponseEvent.std.js';
import type { AddressableMessage } from '../textsecure/messageReceiverEvents.std.js';
import {
  getConversationIdentifier,
  getAddressableMessage,
} from '../util/syncIdentifiers.preload.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { getCallHistorySelector } from '../state/selectors/callHistory.std.js';
import { migrateLegacyReadStatus } from '../messages/migrateLegacyReadStatus.std.js';
import { migrateLegacySendAttributes } from '../messages/migrateLegacySendAttributes.preload.js';
import { getIsInitialContactSync } from '../services/contactSync.preload.js';
import { queueAttachmentDownloadsAndMaybeSaveMessage } from '../util/queueAttachmentDownloads.preload.js';
import { cleanupMessages } from '../util/cleanup.preload.js';
import { MessageModel } from './messages.preload.js';
import {
  applyNewAvatar,
  buildAccessControlAddFromInviteLinkChange,
  buildAccessControlAttributesChange,
  buildAccessControlMembersChange,
  buildAddBannedMemberChange,
  buildAddMember,
  buildAddPendingAdminApprovalMemberChange,
  buildAnnouncementsOnlyChange,
  buildDeleteMemberChange,
  buildDeletePendingAdminApprovalMemberChange,
  buildDisappearingMessagesTimerChange,
  buildGroupLink,
  buildInviteLinkPasswordChange,
  buildModifyMemberRoleChange,
  buildNewGroupLinkChange,
  buildPromoteMemberChange,
  generateGroupInviteLinkPassword,
  hasV1GroupBeenMigrated,
  joinGroupV2ViaLinkAndMigrate,
  modifyGroupV2,
  waitThenMaybeUpdateGroup,
  waitThenRespondToGroupV2Migration,
} from '../groups.preload.js';
import { safeSetTimeout } from '../util/timeout.std.js';
import { getTypingIndicatorSetting } from '../util/Settings.preload.js';
import { INITIAL_EXPIRE_TIMER_VERSION } from '../util/expirationTimer.std.js';
import { maybeNotify } from '../messages/maybeNotify.preload.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import * as Message from '../types/Message2.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { compact, isNumber, throttle, debounce } = lodash;

const log = createLogger('conversations');

const {
  getConversationRangeCenteredOnMessage,
  getOlderMessagesByConversation,
  getMessageMetricsForConversation,
  getMessageById,
  getMostRecentAddressableMessages,
  getMostRecentAddressableNondisappearingMessages,
  getNewerMessagesByConversation,
} = DataReader;
const { addStickerPackReference } = DataWriter;

const FIVE_MINUTES = MINUTE * 5;
const FETCH_TIMEOUT = SECOND * 30;

const JOB_REPORTING_THRESHOLD_MS = 25;
const SEND_REPORTING_THRESHOLD_MS = 25;

const MESSAGE_LOAD_CHUNK_SIZE = 30;

const MAX_EXPIRE_TIMER_VERSION = 0xffffffff;

type CachedIdenticon = {
  readonly color: AvatarColorType;
  readonly text?: string;
  readonly path?: string;
  readonly url: string;
};
type StringKey<T> = keyof T & string;

export class ConversationModel {
  static COLORS: string;

  #_attributes: ConversationAttributesType;

  cachedProps?: ConversationType | null;

  oldCachedProps?: ConversationType | null;

  contactTypingTimers?: Record<
    string,
    {
      senderId: string;
      timer: NodeJS.Timeout;
      timestamp: number;
    }
  >;

  contactCollection?: Array<ConversationModel>;

  debouncedUpdateLastMessage: (() => void) & { flush(): void };

  initialPromise?: Promise<unknown>;

  inProgressFetch?: Promise<unknown>;

  newMessageQueue?: PQueue;

  jobQueue?: PQueue;

  storeName?: string | null;

  throttledBumpTyping?: () => void;

  throttledFetchSMSOnlyUUID?: () => Promise<void>;

  throttledMaybeMigrateV1Group?: () => Promise<void>;

  throttledGetProfiles?: () => Promise<void>;

  throttledUpdateVerified?: () => void;

  throttledUpdateUnread: () => void;

  typingRefreshTimer?: NodeJS.Timeout | null;

  typingPauseTimer?: NodeJS.Timeout | null;

  intlCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

  lastSuccessfulGroupFetch?: number;

  throttledUpdateSharedGroups?: () => Promise<void>;

  #cachedIdenticon?: CachedIdenticon;

  public isFetchingUUID?: boolean;

  #lastIsTyping?: boolean;
  #muteTimer?: NodeJS.Timeout;
  #privVerifiedEnum?: typeof signalProtocolStore.VerifiedStatus;
  #isShuttingDown = false;
  #savePromises = new Set<Promise<void>>();

  public get id(): string {
    return this.#_attributes.id;
  }

  public get<keyName extends StringKey<ConversationAttributesType>>(
    key: keyName
  ): ConversationAttributesType[keyName] {
    return this.attributes[key];
  }
  public set(
    attributes: Partial<ConversationAttributesType>,
    { noTrigger }: { noTrigger?: boolean } = {}
  ): void {
    const previousAttributes = this.#_attributes;
    this.#_attributes = {
      ...previousAttributes,
      ...attributes,
    };

    if (noTrigger) {
      return;
    }

    const hasAttributeChanged = (name: keyof ConversationAttributesType) => {
      return (
        name in attributes && attributes[name] !== previousAttributes[name]
      );
    };

    if (hasAttributeChanged('profileKey')) {
      this.onChangeProfileKey();
    }

    const clearUsernameTriggers: Array<keyof ConversationAttributesType> = [
      'name',
      'profileName',
      'profileFamilyName',
      'e164',
      'systemGivenName',
      'systemFamilyName',
      'systemNickname',
    ];

    if (clearUsernameTriggers.some(attrName => hasAttributeChanged(attrName))) {
      drop(this.maybeClearUsername());
    }

    if (hasAttributeChanged('members') || hasAttributeChanged('membersV2')) {
      this.fetchContacts();
    }

    if (hasAttributeChanged('active_at')) {
      drop(this.#onActiveAtChange());
    }

    window.ConversationController.conversationUpdated(this, previousAttributes);
  }

  public get attributes(): Readonly<ConversationAttributesType> {
    return this.#_attributes;
  }

  idForLogging(): string {
    return getConversationIdForLogging(this.attributes);
  }

  getSendTarget(): ServiceIdString | undefined {
    return getSendTarget(this.attributes);
  }

  constructor(attributes: ConversationAttributesType) {
    this.#_attributes = attributes;

    // Note that we intentionally don't use `initialize()` method because it
    // isn't compatible with esnext output of esbuild.
    const serviceId = this.getServiceId();
    const normalizedServiceId =
      serviceId &&
      normalizeServiceId(serviceId, 'ConversationModel.initialize');
    if (serviceId && normalizedServiceId !== serviceId) {
      log.warn(
        'ConversationModel.initialize: normalizing serviceId from ' +
          `${serviceId} to ${normalizedServiceId}`
      );
      this.set({ serviceId: normalizedServiceId });
    }

    if (isValidE164(attributes.id, false)) {
      this.set({ id: generateGuid(), e164: attributes.id });
    }

    this.storeName = 'conversations';

    this.#privVerifiedEnum = signalProtocolStore.VerifiedStatus;

    // This may be overridden by window.ConversationController.getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();

    this.debouncedUpdateLastMessage = debounce(
      this.updateLastMessage.bind(this),
      200
    );

    this.contactCollection = [];

    const sealedSender = this.get('sealedSender');
    if (sealedSender === undefined) {
      this.set({ sealedSender: SEALED_SENDER.UNKNOWN });
    }

    if (
      // @ts-expect-error -- Removing legacy prop
      this.get('unidentifiedDelivery') ||
      // @ts-expect-error -- Removing legacy prop
      this.get('unidentifiedDeliveryUnrestricted') ||
      // @ts-expect-error -- Removing legacy prop
      this.get('hasFetchedProfile') ||
      // @ts-expect-error -- Removing legacy prop
      this.get('tokens')
    ) {
      this.set({
        // @ts-expect-error -- Removing legacy prop
        unidentifiedDelivery: undefined,
        unidentifiedDeliveryUnrestricted: undefined,
        hasFetchedProfile: undefined,
        tokens: undefined,
      });
    }

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;

    // Set `isFetchingUUID` eagerly to avoid UI flicker when opening the
    // conversation for the first time.
    this.isFetchingUUID = this.isSMSOnly();

    this.throttledBumpTyping = throttle(this.bumpTyping, 300);
    this.throttledUpdateUnread = throttle(this.#updateUnread, 300);
    this.throttledUpdateSharedGroups = throttle(
      this.updateSharedGroups.bind(this),
      FIVE_MINUTES
    );
    this.throttledFetchSMSOnlyUUID = throttle(
      this.fetchSMSOnlyUUID.bind(this),
      FIVE_MINUTES
    );
    this.throttledMaybeMigrateV1Group = throttle(
      this.maybeMigrateV1Group.bind(this),
      FIVE_MINUTES
    );
    this.throttledGetProfiles = throttle(
      this.getProfiles.bind(this),
      FIVE_MINUTES
    );
    this.throttledUpdateVerified = throttle(
      this.updateVerified.bind(this),
      SECOND
    );

    const migratedColor = this.getColor();
    if (this.get('color') !== migratedColor) {
      this.set({ color: migratedColor });
      // Not saving the conversation here we're hoping it'll be saved elsewhere
      // this may cause some color thrashing if Signal is restarted without
      // the convo saving. If that is indeed the case and it's too disruptive
      // we should add batched saving.
    }
  }

  addSavePromise(promise: Promise<void>): void {
    this.#savePromises.add(promise);
  }
  removeSavePromise(promise: Promise<void>): void {
    this.#savePromises.delete(promise);
  }
  getSavePromises(): Array<Promise<void>> {
    return Array.from(this.#savePromises);
  }

  toSenderKeyTarget(): SenderKeyTargetType {
    return {
      getGroupId: () => this.get('groupId'),
      getMembers: () => this.getMembers(),
      hasMember: (serviceId: ServiceIdString) => this.hasMember(serviceId),
      idForLogging: () => this.idForLogging(),
      isGroupV2: () => isGroupV2(this.attributes),
      isValid: () => isGroupV2(this.attributes),

      getSenderKeyInfo: () => this.get('senderKeyInfo'),
      saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) => {
        this.set({ senderKeyInfo });
        await DataWriter.updateConversation(this.attributes);
      },
    };
  }

  get #verifiedEnum(): typeof signalProtocolStore.VerifiedStatus {
    strictAssert(this.#privVerifiedEnum, 'ConversationModel not initialize');
    return this.#privVerifiedEnum;
  }

  #isMemberRequestingToJoin(serviceId: ServiceIdString): boolean {
    return isMemberRequestingToJoin(this.attributes, serviceId);
  }

  isMemberPending(serviceId: ServiceIdString): boolean {
    return isMemberPending(this.attributes, serviceId);
  }

  isMemberAwaitingApproval(serviceId: ServiceIdString): boolean {
    return isMemberAwaitingApproval(this.attributes, serviceId);
  }

  isMember(serviceId: ServiceIdString): boolean {
    return isMember(this.attributes, serviceId);
  }

  async updateExpirationTimerInGroupV2(
    seconds?: DurationInSeconds
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();
    const current = this.get('expireTimer');
    const bothFalsey = Boolean(current) === false && Boolean(seconds) === false;

    if (current === seconds || bothFalsey) {
      log.warn(
        `updateExpirationTimerInGroupV2/${idLog}: Requested timer ${seconds} is unchanged from existing ${current}.`
      );
      return undefined;
    }

    return buildDisappearingMessagesTimerChange({
      expireTimer: seconds || DurationInSeconds.ZERO,
      group: this.attributes,
    });
  }

  async #promotePendingMember(
    serviceIdKind: ServiceIdKind
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const us = window.ConversationController.getOurConversationOrThrow();
    const serviceId = itemStorage.user.getCheckedServiceId(serviceIdKind);

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberPending(serviceId)) {
      log.warn(
        `promotePendingMember/${idLog}: we are not a pending member of group. Returning early.`
      );
      return undefined;
    }

    // We need the user's profileKeyCredential, which requires a roundtrip with the
    //   server, and most definitely their profileKey. A getProfiles() call will
    //   ensure that we have as much as we can get with the data we have.
    if (!us.get('profileKeyCredential')) {
      await us.getProfiles();
    }

    const profileKeyCredentialBase64 = us.get('profileKeyCredential');
    strictAssert(profileKeyCredentialBase64, 'Must have profileKeyCredential');

    if (serviceIdKind === ServiceIdKind.ACI) {
      return buildPromoteMemberChange({
        group: this.attributes,
        isPendingPniAciProfileKey: false,
        profileKeyCredentialBase64,
        serverPublicParamsBase64: window.getServerPublicParams(),
      });
    }

    strictAssert(
      serviceIdKind === ServiceIdKind.PNI,
      'Must be a PNI promotion'
    );

    return buildPromoteMemberChange({
      group: this.attributes,
      isPendingPniAciProfileKey: true,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async #denyPendingApprovalRequest(
    aci: AciString
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.#isMemberRequestingToJoin(aci)) {
      log.warn(
        `denyPendingApprovalRequest/${idLog}: ${aci} is not requesting ` +
          'to join the group. Returning early.'
      );
      return undefined;
    }

    const ourAci = itemStorage.user.getCheckedAci();

    return buildDeletePendingAdminApprovalMemberChange({
      group: this.attributes,
      ourAci,
      aci,
    });
  }

  async addPendingApprovalRequest(): Promise<
    Proto.GroupChange.Actions | undefined
  > {
    const idLog = this.idForLogging();

    // Hard-coded to our own ID, because you don't add other users for admin approval
    const toRequest = window.ConversationController.getOurConversationOrThrow();
    const serviceId = toRequest.getCheckedServiceId(
      `addPendingApprovalRequest/${idLog}`
    );

    // We need the user's profileKeyCredential, which requires a roundtrip with the
    //   server, and most definitely their profileKey. A getProfiles() call will
    //   ensure that we have as much as we can get with the data we have.
    let profileKeyCredentialBase64 = toRequest.get('profileKeyCredential');
    if (!profileKeyCredentialBase64) {
      await toRequest.getProfiles();

      profileKeyCredentialBase64 = toRequest.get('profileKeyCredential');
      if (!profileKeyCredentialBase64) {
        throw new Error(
          `promotePendingMember/${idLog}: No profileKeyCredential for conversation ${toRequest.idForLogging()}`
        );
      }
    }

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (this.isMemberAwaitingApproval(serviceId)) {
      log.warn(
        `addPendingApprovalRequest/${idLog}: ` +
          `${toRequest.idForLogging()} already in pending approval.`
      );
      return undefined;
    }

    return buildAddPendingAdminApprovalMemberChange({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async addMember(
    serviceId: ServiceIdString
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const toRequest = window.ConversationController.get(serviceId);
    if (!toRequest) {
      throw new Error(
        `addMember/${idLog}: No conversation found for ${serviceId}`
      );
    }

    // We need the user's profileKeyCredential, which requires a roundtrip with the
    //   server, and most definitely their profileKey. A getProfiles() call will
    //   ensure that we have as much as we can get with the data we have.
    let profileKeyCredentialBase64 = toRequest.get('profileKeyCredential');
    if (!profileKeyCredentialBase64) {
      await toRequest.getProfiles();

      profileKeyCredentialBase64 = toRequest.get('profileKeyCredential');
      if (!profileKeyCredentialBase64) {
        throw new Error(
          `addMember/${idLog}: No profileKeyCredential for conversation ${toRequest.idForLogging()}`
        );
      }
    }

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (this.isMember(serviceId)) {
      log.warn(
        `addMember/${idLog}: ${toRequest.idForLogging()} ` +
          'is already a member.'
      );
      return undefined;
    }

    return buildAddMember({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
      serviceId,
    });
  }

  async #removePendingMember(
    serviceIds: ReadonlyArray<ServiceIdString>
  ): Promise<Proto.GroupChange.Actions | undefined> {
    return removePendingMember(this.attributes, serviceIds);
  }

  async #removeMember(
    serviceId: ServiceIdString
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMember(serviceId)) {
      log.warn(
        `removeMember/${idLog}: ${serviceId} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const ourAci = itemStorage.user.getCheckedAci();

    return buildDeleteMemberChange({
      group: this.attributes,
      ourAci,
      serviceId,
    });
  }

  async #toggleAdminChange(
    serviceId: ServiceIdString
  ): Promise<Proto.GroupChange.Actions | undefined> {
    if (!isGroupV2(this.attributes)) {
      return undefined;
    }

    const idLog = this.idForLogging();

    if (!this.isMember(serviceId)) {
      log.warn(
        `toggleAdminChange/${idLog}: ${serviceId} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const MEMBER_ROLES = Proto.Member.Role;

    const role = this.isAdmin(serviceId)
      ? MEMBER_ROLES.DEFAULT
      : MEMBER_ROLES.ADMINISTRATOR;

    return buildModifyMemberRoleChange({
      group: this.attributes,
      serviceId,
      role,
    });
  }

  async modifyGroupV2({
    usingCredentialsFrom,
    createGroupChange,
    extraConversationsForSend,
    inviteLinkPassword,
    name,
    syncMessageOnly,
  }: {
    usingCredentialsFrom: ReadonlyArray<ConversationModel>;
    createGroupChange: () => Promise<Proto.GroupChange.Actions | undefined>;
    extraConversationsForSend?: ReadonlyArray<string>;
    inviteLinkPassword?: string;
    name: string;
    syncMessageOnly?: boolean;
  }): Promise<void> {
    await modifyGroupV2({
      conversation: this,
      usingCredentialsFrom,
      createGroupChange,
      extraConversationsForSend,
      inviteLinkPassword,
      name,
      syncMessageOnly,
    });
  }

  isEverUnregistered(): boolean {
    return isConversationEverUnregistered(this.attributes);
  }

  isUnregistered(): boolean {
    return isConversationUnregistered(this.attributes);
  }

  isUnregisteredAndStale(): boolean {
    return isConversationUnregisteredAndStale(this.attributes);
  }

  isSMSOnly(): boolean {
    return isConversationSMSOnly({
      ...this.attributes,
      type: isDirectConversation(this.attributes) ? 'direct' : 'unknown',
    });
  }

  setUnregistered({
    timestamp = Date.now(),
    fromStorageService = false,
    shouldSave = true,
  }: {
    timestamp?: number;
    fromStorageService?: boolean;
    shouldSave?: boolean;
  } = {}): void {
    log.info(
      `setUnregistered(${this.idForLogging()}): conversation is now ` +
        `unregistered, timestamp=${timestamp}`
    );

    const oldFirstUnregisteredAt = this.get('firstUnregisteredAt');

    this.set({
      // We always keep the latest `discoveredUnregisteredAt` because if it
      // was less than 6 hours ago - `isUnregistered()` has to return `false`
      // and let us retry sends.
      discoveredUnregisteredAt: Math.max(
        this.get('discoveredUnregisteredAt') ?? timestamp,
        timestamp
      ),

      // Here we keep the oldest `firstUnregisteredAt` unless timestamp is
      // coming from storage service where remote value always wins.
      firstUnregisteredAt: fromStorageService
        ? timestamp
        : Math.min(this.get('firstUnregisteredAt') ?? timestamp, timestamp),
    });

    if (shouldSave) {
      drop(DataWriter.updateConversation(this.attributes));
    }

    const e164 = this.get('e164');
    const aci = this.getAci();
    const pni = this.getPni();
    if (e164 && aci) {
      this.updateE164(undefined);
      this.updatePni(undefined, false);

      const { conversation: split } =
        window.ConversationController.maybeMergeContacts({
          pni,
          e164,
          reason: `ConversationModel.setUnregistered(${aci})`,
        });

      log.info(
        `setUnregistered(${this.idForLogging()}): splitting pni ${pni} and ` +
          `e164 ${e164} into a separate conversation ${split.idForLogging()}`
      );
    }

    if (
      !fromStorageService &&
      oldFirstUnregisteredAt !== this.get('firstUnregisteredAt')
    ) {
      this.captureChange('setUnregistered');
    }
  }

  setRegistered({
    shouldSave = true,
    fromStorageService = false,
  }: {
    shouldSave?: boolean;
    fromStorageService?: boolean;
  } = {}): void {
    if (
      this.get('discoveredUnregisteredAt') === undefined &&
      this.get('firstUnregisteredAt') === undefined
    ) {
      return;
    }

    const oldFirstUnregisteredAt = this.get('firstUnregisteredAt');

    log.info(`Conversation ${this.idForLogging()} is registered once again`);
    this.set({
      discoveredUnregisteredAt: undefined,
      firstUnregisteredAt: undefined,
    });

    if (shouldSave) {
      drop(DataWriter.updateConversation(this.attributes));
    }

    if (
      !fromStorageService &&
      oldFirstUnregisteredAt !== this.get('firstUnregisteredAt')
    ) {
      this.captureChange('setRegistered');
    }
  }

  isGroupV1AndDisabled(): boolean {
    return isGroupV1(this.attributes);
  }

  isBlocked(): boolean {
    return isBlocked(this.attributes);
  }

  block({ viaStorageServiceSync = false } = {}): void {
    let blocked = false;
    const wasBlocked = this.isBlocked();

    const serviceId = this.getServiceId();
    if (serviceId && isAciString(serviceId)) {
      drop(itemStorage.blocked.addBlockedServiceId(serviceId));
      blocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      drop(itemStorage.blocked.addBlockedNumber(e164));
      blocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      drop(itemStorage.blocked.addBlockedGroup(groupId));
      blocked = true;
    }

    if (blocked && !wasBlocked) {
      window.ConversationController.conversationUpdated(this, this.attributes);

      if (!viaStorageServiceSync) {
        this.captureChange('block');
      }
    }
  }

  unblock({ viaStorageServiceSync = false } = {}): boolean {
    let unblocked = false;
    const wasBlocked = this.isBlocked();

    const serviceId = this.getServiceId();
    if (serviceId && isAciString(serviceId)) {
      drop(itemStorage.blocked.removeBlockedServiceId(serviceId));
      unblocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      drop(itemStorage.blocked.removeBlockedNumber(e164));
      unblocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      drop(itemStorage.blocked.removeBlockedGroup(groupId));
      unblocked = true;
    }

    if (unblocked && wasBlocked) {
      // We need to force a props refresh - blocked state is not in backbone attributes
      window.ConversationController.conversationUpdated(this, this.attributes);

      if (!viaStorageServiceSync) {
        this.captureChange('unblock');
      }

      void this.fetchLatestGroupV2Data({ force: true });
    }

    return unblocked;
  }

  async removeContact({
    viaStorageServiceSync = false,
    shouldSave = true,
  } = {}): Promise<void> {
    const logId = `removeContact(${this.idForLogging()}) storage? ${viaStorageServiceSync}`;

    if (!isDirectConversation(this.attributes)) {
      log.warn(`${logId}: not direct conversation`);
      return;
    }

    if (this.get('removalStage')) {
      log.warn(`${logId}: already removed`);
      return;
    }

    // Don't show message request state until first incoming message.
    log.info(`${logId}: updating`);
    this.set({ removalStage: 'justNotification' });

    if (!viaStorageServiceSync) {
      this.captureChange('removeContact');
    }

    this.disableProfileSharing({ reason: 'remove', viaStorageServiceSync });

    // Drop existing message request state to avoid sending receipts and
    // display MR actions.
    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;
    await this.applyMessageRequestResponse(
      messageRequestEnum.UNKNOWN,
      viaStorageServiceSync
        ? {
            source: MessageRequestResponseSource.STORAGE_SERVICE,
            learnedAtMs: Date.now(),
          }
        : {
            source: MessageRequestResponseSource.LOCAL,
            timestamp: Date.now(),
          },
      { shouldSave: false }
    );

    window.reduxActions?.stories.removeAllContactStories(this.id);
    const serviceId = this.getServiceId();
    if (serviceId) {
      window.reduxActions?.storyDistributionLists.removeMemberFromAllDistributionLists(
        serviceId
      );
    }

    // Add notification
    drop(this.queueJob('removeContact', () => this.maybeSetContactRemoved()));

    if (shouldSave) {
      await DataWriter.updateConversation(this.attributes);
    }
  }

  async restoreContact({
    viaStorageServiceSync = false,
    shouldSave = true,
  } = {}): Promise<void> {
    const logId = `restoreContact(${this.idForLogging()}) storage? ${viaStorageServiceSync}`;

    if (!isDirectConversation(this.attributes)) {
      log.warn(`${logId}: not direct conversation`);
      return;
    }

    if (this.get('removalStage') === undefined) {
      if (!viaStorageServiceSync) {
        log.warn(`${logId}: not removed`);
      }
      return;
    }

    log.info(`${logId}: updating`);
    this.set({ removalStage: undefined });

    if (!viaStorageServiceSync) {
      this.captureChange('restoreContact');
    }

    // Remove notification since the conversation isn't hidden anymore
    await this.maybeClearContactRemoved();

    if (shouldSave) {
      await DataWriter.updateConversation(this.attributes);
    }
  }

  enableProfileSharing({
    reason,
    viaStorageServiceSync = false,
  }: {
    reason: string;
    viaStorageServiceSync?: boolean;
  }): void {
    log.info(
      `enableProfileSharing: ${this.idForLogging()} reason=${reason} ` +
        `storage? ${viaStorageServiceSync}`
    );
    const before = this.get('profileSharing');
    if (before === true) {
      return;
    }

    this.set({ profileSharing: true });

    if (!viaStorageServiceSync) {
      this.captureChange(`enableProfileSharing/${reason}`);
    }
  }

  disableProfileSharing({
    reason,
    viaStorageServiceSync = false,
  }: {
    reason: string;
    viaStorageServiceSync?: boolean;
  }): void {
    log.info(
      `disableProfileSharing: ${this.idForLogging()} reason=${reason} ` +
        `storage? ${viaStorageServiceSync}`
    );
    const before = this.get('profileSharing');

    this.set({ profileSharing: false });

    const after = this.get('profileSharing');

    if (!viaStorageServiceSync && Boolean(before) !== Boolean(after)) {
      this.captureChange(`disableProfileSharing/${reason}`);
    }
  }

  hasDraft(): boolean {
    return hasDraft(this.attributes);
  }

  getDraftPreview(): DraftPreviewType {
    return getDraftPreview(this.attributes);
  }

  bumpTyping(): void {
    // We don't send typing messages if the setting is disabled
    if (!getTypingIndicatorSetting()) {
      return;
    }

    if (!this.typingRefreshTimer) {
      const isTyping = true;
      this.setTypingRefreshTimer();
      void this.sendTypingMessage(isTyping);
    }

    this.setTypingPauseTimer();
  }

  setTypingRefreshTimer(): void {
    clearTimeoutIfNecessary(this.typingRefreshTimer);
    this.typingRefreshTimer = setTimeout(
      this.onTypingRefreshTimeout.bind(this),
      10 * 1000
    );
  }

  onTypingRefreshTimeout(): void {
    const isTyping = true;
    void this.sendTypingMessage(isTyping);

    // This timer will continue to reset itself until the pause timer stops it
    this.setTypingRefreshTimer();
  }

  setTypingPauseTimer(): void {
    clearTimeoutIfNecessary(this.typingPauseTimer);
    this.typingPauseTimer = setTimeout(
      this.onTypingPauseTimeout.bind(this),
      3 * 1000
    );
  }

  onTypingPauseTimeout(): void {
    const isTyping = false;
    void this.sendTypingMessage(isTyping);

    this.clearTypingTimers();
  }

  clearTypingTimers(): void {
    clearTimeoutIfNecessary(this.typingPauseTimer);
    this.typingPauseTimer = null;
    clearTimeoutIfNecessary(this.typingRefreshTimer);
    this.typingRefreshTimer = null;
  }

  async fetchLatestGroupV2Data(
    options: { force?: boolean } = {}
  ): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      log.info('fetchLatestGroupV2Data: Not groupV2');
      return;
    }

    await waitThenMaybeUpdateGroup({
      force: options.force,
      conversation: this,
    });
  }

  async fetchSMSOnlyUUID(): Promise<void> {
    if (!this.isSMSOnly()) {
      return;
    }

    log.info(
      `Fetching uuid for a sms-only conversation ${this.idForLogging()}`
    );

    this.isFetchingUUID = true;
    window.ConversationController.conversationUpdated(this, this.attributes);

    try {
      // Attempt to fetch UUID
      await updateConversationsWithUuidLookup({
        conversationController: window.ConversationController,
        conversations: [this],
        server: {
          cdsLookup,
          checkAccountExistence,
        },
      });
    } finally {
      // No redux update here
      this.isFetchingUUID = false;
      window.ConversationController.conversationUpdated(this, this.attributes);

      log.info(
        `Done fetching uuid for a sms-only conversation ${this.idForLogging()}`
      );
    }

    if (!this.getServiceId()) {
      return;
    }

    // On successful fetch - mark contact as registered.
    this.setRegistered();
  }

  async maybeMigrateV1Group(): Promise<void> {
    if (!isGroupV1(this.attributes)) {
      return;
    }

    const isMigrated = await hasV1GroupBeenMigrated(this);
    if (!isMigrated) {
      return;
    }

    await waitThenRespondToGroupV2Migration({
      conversation: this,
    });
  }

  maybeRepairGroupV2(data: {
    masterKey: string;
    secretParams: string;
    publicParams: string;
  }): void {
    if (
      this.get('groupVersion') &&
      this.get('masterKey') &&
      this.get('secretParams') &&
      this.get('publicParams')
    ) {
      return;
    }

    log.info(`Repairing GroupV2 conversation ${this.idForLogging()}`);
    const { masterKey, secretParams, publicParams } = data;

    this.set({ masterKey, secretParams, publicParams, groupVersion: 2 });

    drop(DataWriter.updateConversation(this.attributes));
  }

  getGroupV2Info(
    options: Readonly<
      { groupChange?: Uint8Array } & (
        | {
            includePendingMembers?: boolean;
            extraConversationsForSend?: ReadonlyArray<string>;
          }
        | { members: ReadonlyArray<ServiceIdString> }
      )
    > = {}
  ): GroupV2InfoType | undefined {
    if (isDirectConversation(this.attributes) || !isGroupV2(this.attributes)) {
      return undefined;
    }
    return {
      masterKey: Bytes.fromBase64(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('masterKey')!
      ),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      revision: this.get('revision')!,
      members:
        'members' in options ? options.members : this.getRecipients(options),
      groupChange: options.groupChange,
    };
  }

  getGroupIdBuffer(): Uint8Array | undefined {
    const groupIdString = this.get('groupId');

    if (!groupIdString) {
      return undefined;
    }

    if (isGroupV1(this.attributes)) {
      return Bytes.fromBinary(groupIdString);
    }
    if (isGroupV2(this.attributes)) {
      return Bytes.fromBase64(groupIdString);
    }

    return undefined;
  }

  async sendTypingMessage(isTyping: boolean): Promise<void> {
    // We don't send typing messages to our other devices
    if (isMe(this.attributes)) {
      return;
    }

    if (isGroupV1(this.attributes)) {
      return;
    }

    if (isSignalConversation(this.attributes)) {
      return;
    }

    // Coalesce multiple sendTypingMessage calls into one.
    //
    // `lastIsTyping` is set to the last `isTyping` value passed to the
    // `sendTypingMessage`. The first 'sendTypingMessage' job to run will
    // pick it and reset it back to `undefined` so that later jobs will
    // in effect be ignored.
    this.#lastIsTyping = isTyping;

    // If captchas are active, then we should drop typing messages because
    // they're less important and could overwhelm the queue.
    if (challengeHandler.areAnyRegistered() && this.isSealedSenderDisabled()) {
      log.info(
        `sendTypingMessage(${this.idForLogging()}): Challenge is registered and can't send sealed, ignoring`
      );
      return;
    }

    await this.queueJob('sendTypingMessage', async () => {
      const groupMembers = this.getRecipients();

      // We don't send typing messages if our recipients list is empty
      if (!isDirectConversation(this.attributes) && !groupMembers.length) {
        return;
      }

      if (!this.areWeAMember()) {
        log.warn(
          `sendTypingMessage(${this.idForLogging()}): not sending, we are not a member`
        );
        return;
      }

      if (this.#lastIsTyping === undefined) {
        log.info(`sendTypingMessage(${this.idForLogging()}): ignoring`);
        return;
      }

      const recipientId = isDirectConversation(this.attributes)
        ? this.getSendTarget()
        : undefined;
      const groupId = this.getGroupIdBuffer();
      const timestamp = Date.now();

      const content = {
        recipientId,
        groupId,
        groupMembers,
        isTyping: this.#lastIsTyping,
        timestamp,
      };
      this.#lastIsTyping = undefined;

      log.info(
        `sendTypingMessage(${this.idForLogging()}): sending ${content.isTyping}`
      );

      const contentMessage = messageSender.getTypingContentMessage(content);

      const sendOptions = {
        ...(await getSendOptions(this.attributes)),
        online: true,
      };
      if (isDirectConversation(this.attributes)) {
        await handleMessageSend(
          messageSender.sendMessageProtoAndWait({
            contentHint: ContentHint.Implicit,
            groupId: undefined,
            options: sendOptions,
            proto: contentMessage,
            recipients: groupMembers,
            timestamp,
            urgent: false,
          }),
          { messageIds: [], sendType: 'typing' }
        );
      } else {
        await handleMessageSend(
          sendContentMessageToGroup({
            contentHint: ContentHint.Implicit,
            contentMessage,
            messageId: undefined,
            online: true,
            recipients: groupMembers,
            sendOptions,
            sendTarget: this.toSenderKeyTarget(),
            sendType: 'typing',
            timestamp,
            urgent: false,
          }),
          { messageIds: [], sendType: 'typing' }
        );
      }
    });
  }

  async onNewMessage(message: MessageModel): Promise<void> {
    const {
      sourceServiceId: serviceId,
      source: e164,
      sourceDevice,
      storyId,
    } = message.attributes;
    this.throttledUpdateVerified?.();

    const source = window.ConversationController.lookupOrCreate({
      serviceId,
      e164,
      reason: 'ConversationModel.onNewMessage',
    });
    if (source) {
      const typingToken = `${source.id}.${sourceDevice}`;

      // Clear typing indicator for a given contact if we receive a message from them
      this.clearContactTypingTimer(typingToken);
    }

    // If it's a group story reply or a story message, we don't want to update
    // the last message or add new messages to redux.
    const isGroupStoryReply = isGroup(this.attributes) && storyId;
    if (isGroupStoryReply || isStory(message.attributes)) {
      return;
    }

    // Change to message request state if contact was removed and sent message.
    if (
      this.get('removalStage') === 'justNotification' &&
      isIncoming(message.attributes)
    ) {
      this.set({
        removalStage: 'messageRequest',
      });
      await this.maybeClearContactRemoved();
      await DataWriter.updateConversation(this.attributes);
    }

    drop(this.addSingleMessage(message.attributes));
  }

  // New messages might arrive while we're in the middle of a bulk fetch from the
  //   database. We'll wait until that is done before moving forward.
  async addSingleMessage(
    message: MessageAttributesType,
    { isJustSent }: { isJustSent: boolean } = { isJustSent: false }
  ): Promise<void> {
    await this.#beforeAddSingleMessage(message);
    this.#doAddSingleMessage(message, { isJustSent });
    this.debouncedUpdateLastMessage();
  }

  async #beforeAddSingleMessage(message: MessageAttributesType): Promise<void> {
    await hydrateStoryContext(message.id, undefined, { shouldSave: true });

    if (!this.newMessageQueue) {
      this.newMessageQueue = new PQueue({
        concurrency: 1,
        timeout: FETCH_TIMEOUT * 2,
      });
    }

    // We use a queue here to ensure messages are added to the UI in the order received
    await this.newMessageQueue.add(async () => {
      await this.inProgressFetch;
    });
  }

  #doAddSingleMessage(
    message: MessageAttributesType,
    { isJustSent }: { isJustSent: boolean }
  ): void {
    const { messagesAdded } = window.reduxActions.conversations;
    const { conversations } = window.reduxStore.getState();
    const { messagesByConversation } = conversations;

    const conversationId = this.id;
    const existingConversation = messagesByConversation[conversationId];
    const newestId = existingConversation?.metrics?.newest?.id;
    const messageIds = existingConversation?.messageIds;

    const isLatestInMemory =
      newestId && messageIds && messageIds[messageIds.length - 1] === newestId;

    if (isJustSent && existingConversation && !isLatestInMemory) {
      // The message is being sent before the user has scrolled down to load the newest
      // messages into memory; in that case, we scroll the user all the way down by
      // loading the newest message
      drop(this.loadNewestMessages(newestId, undefined));
    } else if (
      // The message has to be not a story or has to be a story reply in direct
      // conversation.
      !isStory(message) &&
      (message.storyId == null || isDirectConversation(this.attributes))
    ) {
      messagesAdded({
        conversationId,
        messages: [{ ...message }],
        isActive: window.SignalContext.activeWindowService.isActive(),
        isJustSent,
        isNewMessage: true,
      });
    }
  }

  async #setInProgressFetch(): Promise<() => void> {
    const logId = `setInProgressFetch(${this.idForLogging()})`;
    while (this.inProgressFetch != null) {
      log.warn(`${logId}: blocked, waiting`);
      // eslint-disable-next-line no-await-in-loop
      await this.inProgressFetch;
    }
    const start = Date.now();

    const { resolve, promise } = explodePromise<void>();
    this.inProgressFetch = promise;

    let isFinished = false;
    let timeout: NodeJS.Timeout;
    const finish = () => {
      strictAssert(!isFinished, 'inProgressFetch.finish called twice');
      isFinished = true;

      const duration = Date.now() - start;
      if (duration > 500) {
        log.warn(`${logId}: in progress fetch took ${duration}ms`);
      }

      resolve();
      clearTimeout(timeout);
      strictAssert(this.inProgressFetch === promise, `${logId}: conflict`);
      this.inProgressFetch = undefined;
    };
    timeout = setTimeout(() => {
      log.warn(`${logId}: Calling finish manually after timeout`);
      finish();
    }, FETCH_TIMEOUT);

    return finish;
  }

  async preloadNewestMessages(): Promise<void> {
    const logId = `preloadNewestMessages/${this.idForLogging()}`;

    const { addPreloadData } = window.reduxActions.conversations;

    // Bail-out of complex paths
    if (!this.getAccepted()) {
      log.info(`${logId}: not accepted, skipping`);
      return;
    }

    const finish = await this.#setInProgressFetch();
    log.info(`${logId}: starting`);
    try {
      let metrics = await getMessageMetricsForConversation({
        conversationId: this.id,
        includeStoryReplies: !isGroup(this.attributes),
      });

      let messages: ReadonlyArray<MessageAttributesType>;
      let unboundedFetch = true;
      if (metrics.oldestUnseen) {
        const unseen = await getMessageById(metrics.oldestUnseen.id);
        if (!unseen) {
          throw new Error(
            `preloadNewestMessages: failed to load oldestUnseen ${metrics.oldestUnseen.id}`
          );
        }

        const receivedAt = unseen.received_at;
        const sentAt = unseen.sent_at;
        const {
          older,
          newer,
          metrics: freshMetrics,
        } = await getConversationRangeCenteredOnMessage({
          conversationId: this.id,
          includeStoryReplies: !isGroup(this.attributes),
          limit: MESSAGE_LOAD_CHUNK_SIZE,
          messageId: unseen.id,
          receivedAt,
          sentAt,
          storyId: undefined,
        });
        messages = [...older, unseen, ...newer];

        metrics = freshMetrics;
        unboundedFetch = false;
      } else {
        messages = await getOlderMessagesByConversation({
          conversationId: this.id,
          includeStoryReplies: !isGroup(this.attributes),
          limit: MESSAGE_LOAD_CHUNK_SIZE,
          storyId: undefined,
        });
      }

      const cleaned = await this.cleanAttributes(messages);

      log.info(
        `${logId}: preloaded ${cleaned.length} messages, ` +
          `latest timestamp=${cleaned.at(-1)?.sent_at}`
      );

      addPreloadData({
        conversationId: this.id,
        messages: cleaned,
        metrics,
        unboundedFetch,
      });
    } finally {
      finish();
    }
  }

  async loadNewestMessages(
    newestMessageId: string | undefined,
    setFocus: boolean | undefined
  ): Promise<void> {
    const logId = `loadNewestMessages/${this.idForLogging()}`;

    const { messagesReset, setMessageLoadingState, consumePreloadData } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.DoingInitialLoad
    );
    let finish: undefined | (() => void) = await this.#setInProgressFetch();

    const preloadedId = getPreloadedConversationId(
      window.reduxStore.getState()
    );
    try {
      let scrollToLatestUnread = true;

      if (
        // Arguments provided by onConversationOpened
        newestMessageId == null &&
        !setFocus &&
        // Cache conditions for preloadNewestMessages above (in case they are
        // invalidated after loading cache)
        this.getAccepted() &&
        // Existing preload
        preloadedId === conversationId
      ) {
        log.info(`${logId}: preload cache still valid, skipping`);
        consumePreloadData(preloadedId);
        return;
      }

      if (newestMessageId) {
        const newestInMemoryMessage = await getMessageById(newestMessageId);
        if (newestInMemoryMessage) {
          // If newest in-memory message is unread, scrolling down would mean going to
          //   the very bottom, not the oldest unread.
          if (isMessageUnread(newestInMemoryMessage)) {
            scrollToLatestUnread = false;
          }
        } else {
          log.warn(
            `loadNewestMessages: did not find message ${newestMessageId}`
          );
        }
      }

      const metrics = await getMessageMetricsForConversation({
        conversationId,
        includeStoryReplies: !isGroup(this.attributes),
      });

      // If this is a message request that has not yet been accepted, we always show the
      //   oldest messages, to ensure that the ConversationHero is shown. We don't want to
      //   scroll directly to the oldest message, because that could scroll the hero off
      //   the screen.
      if (
        !newestMessageId &&
        !this.getAccepted() &&
        this.get('removalStage') !== 'justNotification' &&
        metrics.oldest
      ) {
        log.info(`${logId}: scrolling to oldest ${metrics.oldest.sent_at}`);
        void this.loadAndScroll(metrics.oldest.id, {
          disableScroll: true,
          onFinish: finish,
        });
        finish = undefined;
        return;
      }

      if (scrollToLatestUnread && metrics.oldestUnseen) {
        log.info(
          `${logId}: scrolling to oldest unseen ${metrics.oldestUnseen.sent_at}`
        );
        void this.loadAndScroll(metrics.oldestUnseen.id, {
          disableScroll: !setFocus,
          onFinish: finish,
        });
        finish = undefined;
        return;
      }

      const messages = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: !isGroup(this.attributes),
        limit: MESSAGE_LOAD_CHUNK_SIZE,
        storyId: undefined,
      });

      const cleaned = await this.cleanAttributes(messages);
      const scrollToMessageId =
        setFocus && metrics.newest ? metrics.newest.id : undefined;

      log.info(
        `${logId}: loaded ${cleaned.length} messages, ` +
          `latest timestamp=${cleaned.at(-1)?.sent_at}`
      );

      // Because our `getOlderMessages` fetch above didn't specify a receivedAt, we got
      //   the most recent N messages in the conversation. If it has a conflict with
      //   metrics, fetched a bit before, that's likely a race condition. So we tell our
      //   reducer to trust the message set we just fetched for determining if we have
      //   the newest message loaded.
      const unboundedFetch = true;
      messagesReset({
        conversationId,
        messages: cleaned,
        metrics,
        scrollToMessageId,
        unboundedFetch,
      });
    } catch (error) {
      setMessageLoadingState(conversationId, undefined);
      throw error;
    } finally {
      finish?.();
    }
  }
  async loadOlderMessages(oldestMessageId: string): Promise<void> {
    const logId = `loadOlderMessages/${this.idForLogging()}`;

    const { messagesAdded, setMessageLoadingState, repairOldestMessage } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.LoadingOlderMessages
    );
    const finish = await this.#setInProgressFetch();

    try {
      const message = await getMessageById(oldestMessageId);
      if (!message) {
        throw new Error(`${logId}: failed to load message ${oldestMessageId}`);
      }

      const receivedAt = message.received_at;
      const sentAt = message.sent_at;
      const models = await getOlderMessagesByConversation({
        conversationId,
        includeStoryReplies: !isGroup(this.attributes),
        limit: MESSAGE_LOAD_CHUNK_SIZE,
        messageId: oldestMessageId,
        receivedAt,
        sentAt,
        storyId: undefined,
      });

      if (models.length < 1) {
        log.warn(`${logId}: requested, but loaded no messages`);
        repairOldestMessage(conversationId);
        return;
      }

      const cleaned = await this.cleanAttributes(models);

      log.info(
        `${logId}: loaded ${cleaned.length} messages, ` +
          `first timestamp=${cleaned.at(0)?.sent_at}`
      );

      messagesAdded({
        conversationId,
        messages: cleaned,
        isActive: window.SignalContext.activeWindowService.isActive(),
        isJustSent: false,
        isNewMessage: false,
      });
    } catch (error) {
      setMessageLoadingState(conversationId, undefined);
      throw error;
    } finally {
      finish();
    }
  }

  async loadNewerMessages(newestMessageId: string): Promise<void> {
    const { messagesAdded, setMessageLoadingState, repairNewestMessage } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.LoadingNewerMessages
    );
    const finish = await this.#setInProgressFetch();

    try {
      const message = await getMessageById(newestMessageId);
      if (!message) {
        throw new Error(
          `loadNewerMessages: failed to load message ${newestMessageId}`
        );
      }

      const receivedAt = message.received_at;
      const sentAt = message.sent_at;
      const models = await getNewerMessagesByConversation({
        conversationId,
        includeStoryReplies: !isGroup(this.attributes),
        limit: MESSAGE_LOAD_CHUNK_SIZE,
        receivedAt,
        sentAt,
        storyId: undefined,
      });

      if (models.length < 1) {
        log.warn('loadNewerMessages: requested, but loaded no messages');
        repairNewestMessage(conversationId);
        return;
      }

      const cleaned = await this.cleanAttributes(models);
      messagesAdded({
        conversationId,
        messages: cleaned,
        isActive: window.SignalContext.activeWindowService.isActive(),
        isJustSent: false,
        isNewMessage: false,
      });
    } catch (error) {
      setMessageLoadingState(conversationId, undefined);
      throw error;
    } finally {
      finish();
    }
  }

  async loadAndScroll(
    messageId: string,
    options: { disableScroll?: boolean; onFinish?: () => void } = {}
  ): Promise<void> {
    const { messagesReset, setMessageLoadingState } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.DoingInitialLoad
    );
    let { onFinish: finish } = options;
    if (!finish) {
      finish = await this.#setInProgressFetch();
    }

    try {
      const message = await getMessageById(messageId);
      if (!message) {
        throw new Error(
          `loadMoreAndScroll: failed to load message ${messageId}`
        );
      }

      const receivedAt = message.received_at;
      const sentAt = message.sent_at;
      const { older, newer, metrics } =
        await getConversationRangeCenteredOnMessage({
          conversationId,
          includeStoryReplies: !isGroup(this.attributes),
          limit: MESSAGE_LOAD_CHUNK_SIZE,
          messageId,
          receivedAt,
          sentAt,
          storyId: undefined,
        });
      const all = [...older, message, ...newer];

      const cleaned = await this.cleanAttributes(all);
      const scrollToMessageId =
        options && options.disableScroll ? undefined : messageId;

      messagesReset({
        conversationId,
        messages: cleaned,
        metrics,
        scrollToMessageId,
      });
    } catch (error) {
      setMessageLoadingState(conversationId, undefined);
      throw error;
    } finally {
      finish();
    }
  }

  async cleanAttributes(
    messages: ReadonlyArray<MessageAttributesType>
  ): Promise<Array<MessageAttributesType>> {
    const present = messages.filter(message => Boolean(message.id));

    const eliminated = messages.length - present.length;
    if (eliminated > 0) {
      log.warn(
        `cleanAttributes: Eliminated ${eliminated} messages without an id`
      );
    }

    let upgraded = 0;
    const ourConversationId =
      window.ConversationController.getOurConversationId();

    const hydrated = await Promise.all(
      present.map(async message => {
        const model = window.MessageCache.register(new MessageModel(message));
        let updated = false;

        const readStatus = migrateLegacyReadStatus(model.attributes);
        if (readStatus !== undefined) {
          updated = true;
          model.set({
            readStatus,
            seenStatus:
              readStatus === ReadStatus.Unread
                ? SeenStatus.Unseen
                : SeenStatus.Seen,
          });
        }

        if (ourConversationId) {
          const sendStateByConversationId = migrateLegacySendAttributes(
            model.attributes,
            window.ConversationController.get.bind(
              window.ConversationController
            ),
            ourConversationId
          );
          if (sendStateByConversationId) {
            updated = true;
            model.set({
              sendStateByConversationId,
            });
          }
        }

        const startingAttributes = model.attributes;
        await window.MessageCache.upgradeSchema(
          model,
          Message.VERSION_NEEDED_FOR_DISPLAY
        );
        if (startingAttributes !== model.attributes) {
          updated = true;
        }

        const patch = await hydrateStoryContext(message.id, undefined, {
          shouldSave: true,
        });
        if (patch) {
          updated = true;
          model.set(patch);
        }

        if (updated) {
          upgraded += 1;
          await window.MessageCache.saveMessage(model.attributes);
        }

        return model.attributes;
      })
    );
    if (upgraded > 0) {
      log.warn(`cleanAttributes: Upgraded schema of ${upgraded} messages`);
    }

    return hydrated;
  }

  format(): ConversationType {
    if (this.cachedProps) {
      return this.cachedProps;
    }

    const oldFormat = this.format;
    // We don't want to crash or have an infinite loop if we loop back into this function
    //   again. We'll log a warning and returned old cached props or throw an error.
    this.format = () => {
      if (!this.oldCachedProps) {
        throw new Error(
          `Conversation.format()/${this.idForLogging()} reentrant call, no old cached props!`
        );
      }

      const { stack } = new Error('for stack');
      log.warn(
        `Conversation.format()/${this.idForLogging()} reentrant call! ${stack}`
      );

      return this.oldCachedProps;
    };

    try {
      const { oldCachedProps } = this;
      const newCachedProps = getConversation(this);

      if (oldCachedProps && isShallowEqual(oldCachedProps, newCachedProps)) {
        this.cachedProps = oldCachedProps;
      } else {
        this.cachedProps = newCachedProps;
      }

      return this.cachedProps;
    } finally {
      this.format = oldFormat;
    }
  }

  updateE164(e164?: string | null): void {
    const oldValue = this.get('e164');
    if (e164 === oldValue) {
      return;
    }

    this.set({ e164: e164 || undefined });

    // This user changed their phone number
    if (oldValue && e164 && this.get('sharingPhoneNumber')) {
      void this.addChangeNumberNotification(oldValue, e164);
    }

    drop(DataWriter.updateConversation(this.attributes));
    window.ConversationController.idUpdated(this, 'e164', oldValue);
    this.captureChange('updateE164');
  }

  updateServiceId(serviceId?: ServiceIdString): void {
    const oldValue = this.getServiceId();
    if (serviceId === oldValue) {
      return;
    }

    this.set({
      serviceId: serviceId
        ? normalizeServiceId(serviceId, 'Conversation.updateServiceId')
        : undefined,
    });
    drop(DataWriter.updateConversation(this.attributes));
    window.ConversationController.idUpdated(this, 'serviceId', oldValue);

    // We should delete the old sessions and identity information in all situations except
    //   for the case where we need to do old and new PNI comparisons. We'll wait
    //   for the PNI update to do that.
    if (oldValue && oldValue !== this.getPni()) {
      drop(signalProtocolStore.removeIdentityKey(oldValue));
    }

    this.captureChange('updateServiceId');
  }

  trackPreviousIdentityKey(publicKey: Uint8Array): void {
    const logId = `trackPreviousIdentityKey/${this.idForLogging()}`;
    const identityKey = Bytes.toBase64(publicKey);

    if (!isDirectConversation(this.attributes)) {
      throw new Error(`${logId}: Called for non-private conversation`);
    }

    const existingIdentityKey = this.get('previousIdentityKey');
    if (existingIdentityKey && existingIdentityKey !== identityKey) {
      log.warn(
        `${logId}: Already had previousIdentityKey, new one does not match`
      );
      void this.addKeyChange('trackPreviousIdentityKey - change');
    }

    log.warn(`${logId}: Setting new previousIdentityKey`);
    this.set({
      previousIdentityKey: identityKey,
    });
    drop(DataWriter.updateConversation(this.attributes));
  }

  updatePni(pni: PniString | undefined, pniSignatureVerified: boolean): void {
    const oldValue = this.getPni();
    if (pni === oldValue) {
      return;
    }

    this.set({
      pni: pni ? normalizePni(pni, 'Conversation.updatePni') : undefined,
    });
    const newPniSignatureVerified = pni ? pniSignatureVerified : false;
    if (this.get('pniSignatureVerified') !== newPniSignatureVerified) {
      log.warn(
        `updatePni/${this.idForLogging()}: setting ` +
          `pniSignatureVerified to ${newPniSignatureVerified}`
      );
      this.set({ pniSignatureVerified: newPniSignatureVerified });
      this.captureChange('pniSignatureVerified');
    }

    const pniIsPrimaryId =
      !this.getServiceId() ||
      this.getServiceId() === oldValue ||
      this.getServiceId() === pni;
    const haveSentMessage = Boolean(
      this.get('profileSharing') || this.get('sentMessageCount')
    );

    if (oldValue && pniIsPrimaryId && haveSentMessage) {
      // We're going from an old PNI to a new PNI
      if (pni) {
        const oldIdentityRecord =
          signalProtocolStore.getIdentityRecord(oldValue);
        const newIdentityRecord = signalProtocolStore.getIdentityRecord(pni);

        if (
          newIdentityRecord &&
          oldIdentityRecord &&
          !constantTimeEqual(
            oldIdentityRecord.publicKey,
            newIdentityRecord.publicKey
          )
        ) {
          void this.addKeyChange('updatePni - change');
        } else if (!newIdentityRecord && oldIdentityRecord) {
          this.trackPreviousIdentityKey(oldIdentityRecord.publicKey);
        }
      }

      // We're just dropping the PNI
      if (!pni) {
        const oldIdentityRecord =
          signalProtocolStore.getIdentityRecord(oldValue);

        if (oldIdentityRecord) {
          this.trackPreviousIdentityKey(oldIdentityRecord.publicKey);
        }
      }
    }

    // If this PNI is going away or going to someone else, we'll delete all its sessions
    if (oldValue) {
      drop(signalProtocolStore.removeIdentityKey(oldValue));
    }

    if (pni && !this.getServiceId()) {
      log.warn(
        `updatePni/${this.idForLogging()}: pni field set to ${pni}, but service id field is empty!`
      );
    }

    drop(DataWriter.updateConversation(this.attributes));
    window.ConversationController.idUpdated(this, 'pni', oldValue);
    this.captureChange('updatePni');
  }

  updateGroupId(groupId?: string): void {
    const oldValue = this.get('groupId');
    if (groupId && groupId !== oldValue) {
      this.set({ groupId });
      drop(DataWriter.updateConversation(this.attributes));
      window.ConversationController.idUpdated(this, 'groupId', oldValue);
    }
  }

  async updateReportingToken(token?: Uint8Array): Promise<void> {
    const oldValue = this.get('reportingToken');
    const newValue = token ? Bytes.toBase64(token) : undefined;

    if (oldValue === newValue) {
      return;
    }

    this.set({ reportingToken: newValue });
    await DataWriter.updateConversation(this.attributes);
  }

  incrementMessageCount(): void {
    this.set({
      messageCount: (this.get('messageCount') || 0) + 1,
    });
    drop(DataWriter.updateConversation(this.attributes));
  }

  incrementSentMessageCount({ dry = false }: { dry?: boolean } = {}):
    | Partial<ConversationAttributesType>
    | undefined {
    const needsTitleTransition =
      hasNumberTitle(this.attributes) || hasUsernameTitle(this.attributes);
    const update = {
      messageCount: (this.get('messageCount') || 0) + 1,
      sentMessageCount: (this.get('sentMessageCount') || 0) + 1,
      ...(needsTitleTransition ? { needsTitleTransition: true } : {}),
    };

    if (dry) {
      return update;
    }
    this.set(update);
    drop(DataWriter.updateConversation(this.attributes));

    return undefined;
  }

  /**
   * This function is called when a message request is accepted in order to
   * handle sending read receipts and download any pending attachments.
   */
  async handleReadAndDownloadAttachments(
    options: { isLocalAction?: boolean } = {}
  ): Promise<void> {
    const { isLocalAction } = options;

    let messages: Array<MessageAttributesType> | undefined;
    do {
      const first = messages ? messages[0] : undefined;

      // eslint-disable-next-line no-await-in-loop
      messages = await DataReader.getOlderMessagesByConversation({
        conversationId: this.get('id'),
        includeStoryReplies: !isGroup(this.attributes),
        limit: 100,
        messageId: first ? first.id : undefined,
        receivedAt: first ? first.received_at : undefined,
        sentAt: first ? first.sent_at : undefined,
        storyId: undefined,
      });

      if (!messages.length) {
        return;
      }

      const readMessages = messages.filter(m => !hasErrors(m) && isIncoming(m));

      if (isLocalAction) {
        const conversationId = this.get('id');

        // eslint-disable-next-line no-await-in-loop
        await conversationJobQueue.add({
          type: conversationQueueJobEnum.enum.Receipts,
          conversationId: this.get('id'),
          receiptsType: ReceiptType.Read,
          receipts: readMessages.map(m => {
            const { sourceServiceId: senderAci } = m;
            strictAssert(isAciString(senderAci), "Can't send receipt to PNI");

            return {
              messageId: m.id,
              conversationId,
              senderE164: m.source,
              senderAci,
              timestamp: getMessageSentTimestamp(m, { log }),
              isDirectConversation: isDirectConversation(this.attributes),
            };
          }),
        });
      }

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        readMessages.map(async m => {
          const registered = window.MessageCache.register(new MessageModel(m));
          await queueAttachmentDownloadsAndMaybeSaveMessage(registered, {
            isManualDownload: false,
          });
        })
      );
    } while (messages.length > 0);
  }

  async addMessageRequestResponseEventMessage(
    event: MessageRequestResponseEvent,
    responseInfo: MessageRequestResponseInfo,
    { messageCountFromEnvelope }: { messageCountFromEnvelope: number }
  ): Promise<void> {
    const idForLogging = getConversationIdForLogging(this.attributes);
    log.info(`addMessageRequestResponseEventMessage/${idForLogging}: ${event}`);

    let receivedAtMs: number;
    let timestamp: number;
    let receivedAtCounter: number;

    const lastMessageTimestamp =
      this.get('lastMessageReceivedAtMs') ?? this.get('timestamp');

    const { source } = responseInfo;
    switch (source) {
      case MessageRequestResponseSource.LOCAL:
        receivedAtMs = responseInfo.timestamp;
        receivedAtCounter = incrementMessageCounter();
        timestamp = responseInfo.timestamp;
        break;
      case MessageRequestResponseSource.MRR_SYNC:
        receivedAtMs = responseInfo.receivedAtMs;
        receivedAtCounter = responseInfo.receivedAtCounter;
        timestamp = responseInfo.timestamp;
        break;
      case MessageRequestResponseSource.BLOCK_SYNC:
        receivedAtMs = lastMessageTimestamp ?? responseInfo.receivedAtMs;
        receivedAtCounter = responseInfo.receivedAtCounter;
        timestamp = responseInfo.timestamp;
        break;
      case MessageRequestResponseSource.STORAGE_SERVICE:
        receivedAtMs = lastMessageTimestamp ?? responseInfo.learnedAtMs;
        receivedAtCounter = incrementMessageCounter();
        timestamp = responseInfo.learnedAtMs;
        break;
      default:
        throw missingCaseError(source);
    }

    const message = new MessageModel({
      ...generateMessageId(receivedAtCounter),
      conversationId: this.id,
      type: 'message-request-response-event',
      // we increment sent_at by messageCountFromEnvelope to ensure consistent in-timeline
      // ordering when we add multiple messages from a single envelope (e.g. a
      // BlOCK_AND_SPAM MRRSync)
      sent_at: timestamp + messageCountFromEnvelope,
      received_at_ms: receivedAtMs,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,
      timestamp,
      messageRequestResponseEvent: event,
    });

    await window.MessageCache.saveMessage(message, {
      forceSave: true,
    });
    if (!getIsInitialContactSync() && !this.get('active_at')) {
      this.set({ active_at: Date.now() });
      await DataWriter.updateConversation(this.attributes);
    }
    window.MessageCache.register(message);
    drop(this.onNewMessage(message));
    drop(this.updateLastMessage());
  }

  async applyMessageRequestResponse(
    response: Proto.SyncMessage.MessageRequestResponse.Type,
    responseInfo: MessageRequestResponseInfo,
    { shouldSave = true }: { shouldSave?: boolean } = {}
  ): Promise<void> {
    try {
      const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;
      const { source } = responseInfo;
      const isLocalAction = source === MessageRequestResponseSource.LOCAL;
      const viaStorageServiceSync =
        source === MessageRequestResponseSource.STORAGE_SERVICE;

      const currentMessageRequestState = this.get('messageRequestResponseType');
      const hasSpam = (messageRequestValue: number | undefined): boolean => {
        return (
          messageRequestValue === messageRequestEnum.SPAM ||
          messageRequestValue === messageRequestEnum.BLOCK_AND_SPAM
        );
      };
      const hasBlock = (messageRequestValue: number | undefined): boolean => {
        return (
          messageRequestValue === messageRequestEnum.BLOCK ||
          messageRequestValue === messageRequestEnum.BLOCK_AND_SPAM ||
          messageRequestValue === messageRequestEnum.BLOCK_AND_DELETE
        );
      };
      const didSpamChange =
        hasSpam(currentMessageRequestState) !== hasSpam(response);
      const didBlockChange = hasBlock(response) !== this.isBlocked();
      const didUnblock =
        response === messageRequestEnum.ACCEPT && this.isBlocked();

      const didResponseChange = response !== currentMessageRequestState;
      const wasPreviouslyAccepted = this.getAccepted();

      if (didResponseChange) {
        let messageCount = 0;

        if (response === messageRequestEnum.ACCEPT) {
          // Only add a message if the user unblocked this conversation, or took an
          // explicit action to accept the message request on one of their devices
          if (!viaStorageServiceSync || didUnblock) {
            drop(
              this.addMessageRequestResponseEventMessage(
                didUnblock
                  ? MessageRequestResponseEvent.UNBLOCK
                  : MessageRequestResponseEvent.ACCEPT,
                responseInfo,
                { messageCountFromEnvelope: messageCount }
              )
            );
            messageCount += 1;
          }
        }

        if (hasBlock(response) && didBlockChange) {
          drop(
            this.addMessageRequestResponseEventMessage(
              MessageRequestResponseEvent.BLOCK,
              responseInfo,
              { messageCountFromEnvelope: messageCount }
            )
          );
          messageCount += 1;
        }

        if (hasSpam(response) && didSpamChange) {
          drop(
            this.addMessageRequestResponseEventMessage(
              MessageRequestResponseEvent.SPAM,
              responseInfo,
              { messageCountFromEnvelope: messageCount }
            )
          );
          messageCount += 1;
        }
      }

      // Apply message request response locally
      this.set({
        messageRequestResponseType: response,
      });

      const rejectConversation = async ({
        isBlock = false,
        isDelete = false,
        isSpam = false,
      }: {
        isBlock?: boolean;
        isDelete?: boolean;
        isSpam?: boolean;
      }) => {
        if (isBlock) {
          this.block({ viaStorageServiceSync });
        }

        if (isBlock || isDelete) {
          this.disableProfileSharing({
            reason: isBlock ? 'block' : 'delete',
            viaStorageServiceSync,
          });
        }

        if (isDelete) {
          await this.destroyMessages({ source: 'message-request' });
          void this.updateLastMessage();
        }

        if (isBlock || isDelete) {
          if (isLocalAction) {
            window.reduxActions.conversations.onConversationClosed(
              this.id,
              isBlock
                ? 'blocked from message request'
                : 'deleted from message request'
            );

            if (isGroupV2(this.attributes)) {
              await this.leaveGroupV2();
            }
          }
        }

        if (isSpam) {
          this.set({ isReported: true });
        }
      };

      if (response === messageRequestEnum.ACCEPT) {
        this.unblock({ viaStorageServiceSync });
        if (!viaStorageServiceSync) {
          await this.restoreContact({ shouldSave: false });
        }
        this.enableProfileSharing({
          reason: 'ACCEPT Message Request',
          viaStorageServiceSync,
        });

        // We really don't want to call this if we don't have to. It can take a lot of
        //   time to go through old messages to download attachments.
        if (didResponseChange && !wasPreviouslyAccepted) {
          await this.handleReadAndDownloadAttachments({ isLocalAction });
          if (this.attributes.remoteAvatarUrl) {
            if (isDirectConversation(this.attributes)) {
              drop(
                this.setAndMaybeFetchProfileAvatar({
                  avatarUrl: this.attributes.remoteAvatarUrl,
                })
              );
            }

            if (isGroup(this.attributes)) {
              const updateAttrs = await applyNewAvatar({
                newAvatarUrl: this.attributes.remoteAvatarUrl,
                attributes: this.attributes,
                logId: 'applyMessageRequestResponse',
                forceDownload: true,
              });
              this.set(updateAttrs);
            }
          }
        }

        if (isLocalAction) {
          const ourAci = itemStorage.user.getCheckedAci();
          const ourPni = itemStorage.user.getPni();
          const ourConversation =
            window.ConversationController.getOurConversationOrThrow();

          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
            void this.sendProfileKeyUpdate();
          } else if (
            isGroupV2(this.attributes) &&
            this.isMemberPending(ourAci)
          ) {
            await this.modifyGroupV2({
              name: 'promotePendingMember',
              usingCredentialsFrom: [ourConversation],
              createGroupChange: () =>
                this.#promotePendingMember(ServiceIdKind.ACI),
            });
          } else if (
            ourPni &&
            isGroupV2(this.attributes) &&
            this.isMemberPending(ourPni)
          ) {
            await this.modifyGroupV2({
              name: 'promotePendingMember',
              usingCredentialsFrom: [ourConversation],
              createGroupChange: () =>
                this.#promotePendingMember(ServiceIdKind.PNI),
            });
          } else if (isGroupV2(this.attributes) && this.isMember(ourAci)) {
            log.info(
              'applyMessageRequestResponse/accept: Already a member of v2 group'
            );
          } else {
            log.error(
              'applyMessageRequestResponse/accept: Neither member nor pending member of v2 group'
            );
          }
        }
      } else if (response === messageRequestEnum.BLOCK) {
        await rejectConversation({ isBlock: true });
      } else if (response === messageRequestEnum.DELETE) {
        await rejectConversation({ isDelete: true });
      } else if (response === messageRequestEnum.BLOCK_AND_DELETE) {
        await rejectConversation({ isBlock: true, isDelete: true });
      } else if (response === messageRequestEnum.SPAM) {
        await rejectConversation({ isSpam: true });
      } else if (response === messageRequestEnum.BLOCK_AND_SPAM) {
        await rejectConversation({ isBlock: true, isSpam: true });
      }
    } finally {
      if (shouldSave) {
        await DataWriter.updateConversation(this.attributes);
      }
    }
  }

  async joinGroupV2ViaLinkAndMigrate({
    approvalRequired,
    inviteLinkPassword,
    revision,
  }: {
    approvalRequired: boolean;
    inviteLinkPassword: string;
    revision: number;
  }): Promise<void> {
    await joinGroupV2ViaLinkAndMigrate({
      approvalRequired,
      conversation: this,
      inviteLinkPassword,
      revision,
    });
  }

  async joinGroupV2ViaLink({
    inviteLinkPassword,
    approvalRequired,
  }: {
    inviteLinkPassword: string;
    approvalRequired: boolean;
  }): Promise<void> {
    const ourAci = itemStorage.user.getCheckedAci();
    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();
    try {
      if (approvalRequired) {
        await this.modifyGroupV2({
          name: 'requestToJoin',
          usingCredentialsFrom: [ourConversation],
          inviteLinkPassword,
          createGroupChange: () => this.addPendingApprovalRequest(),
        });
      } else {
        await this.modifyGroupV2({
          name: 'joinGroup',
          usingCredentialsFrom: [ourConversation],
          inviteLinkPassword,
          createGroupChange: () => this.addMember(ourAci),
        });
      }
    } catch (error) {
      const ALREADY_REQUESTED_TO_JOIN =
        '{"code":400,"message":"cannot ask to join via invite link if already asked to join"}';
      if (!error.response) {
        throw error;
      } else {
        const errorDetails = Bytes.toString(error.response);
        if (errorDetails !== ALREADY_REQUESTED_TO_JOIN) {
          throw error;
        } else {
          log.info(
            'joinGroupV2ViaLink: Got 400, but server is telling us we have already requested to join. Forcing that local state'
          );
          this.set({
            pendingAdminApprovalV2: [
              {
                aci: ourAci,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

    // Ensure active_at is set, because this is an event that justifies putting the group
    //   in the left pane.
    this.set({
      messageRequestResponseType: messageRequestEnum.ACCEPT,
      active_at: this.get('active_at') || Date.now(),
    });
    await DataWriter.updateConversation(this.attributes);
  }

  async cancelJoinRequest(): Promise<void> {
    const ourAci = itemStorage.user.getCheckedAci();

    const inviteLinkPassword = this.get('groupInviteLinkPassword');
    if (!inviteLinkPassword) {
      log.warn(
        `cancelJoinRequest/${this.idForLogging()}: We don't have an inviteLinkPassword!`
      );
    }

    await this.modifyGroupV2({
      name: 'cancelJoinRequest',
      usingCredentialsFrom: [],
      inviteLinkPassword,
      createGroupChange: () => this.#denyPendingApprovalRequest(ourAci),
    });
  }

  async leaveGroupV2(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const ourAci = itemStorage.user.getCheckedAci();
    const ourPni = itemStorage.user.getPni();

    if (this.isMemberPending(ourAci)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#removePendingMember([ourAci]),
      });
    } else if (this.isMember(ourAci)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#removeMember(ourAci),
      });
      // Keep PNI in pending if ACI was a member.
    } else if (ourPni && this.isMemberPending(ourPni)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#removePendingMember([ourPni]),
        syncMessageOnly: true,
      });
    } else {
      const logId = this.idForLogging();
      log.error(
        'leaveGroupV2: We were neither a member nor a pending member of ' +
          `the group ${logId}`
      );
    }
  }

  async addBannedMember(
    serviceId: ServiceIdString
  ): Promise<Proto.GroupChange.Actions | undefined> {
    if (this.isMember(serviceId)) {
      log.warn('addBannedMember: Member is a part of the group!');

      return;
    }

    if (this.isMemberPending(serviceId)) {
      log.warn('addBannedMember: Member is pending to be added to group!');

      return;
    }

    if (isMemberBanned(this.attributes, serviceId)) {
      log.warn('addBannedMember: Member is already banned!');

      return;
    }

    return buildAddBannedMemberChange({
      group: this.attributes,
      serviceId,
    });
  }

  async blockGroupLinkRequests(serviceId: ServiceIdString): Promise<void> {
    await this.modifyGroupV2({
      name: 'addBannedMember',
      usingCredentialsFrom: [],
      createGroupChange: async () => this.addBannedMember(serviceId),
    });
  }

  async toggleAdmin(conversationId: string): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const logId = this.idForLogging();

    const member = window.ConversationController.get(conversationId);
    if (!member) {
      log.error(`toggleAdmin/${logId}: ${conversationId} does not exist`);
      return;
    }

    const serviceId = member.getCheckedServiceId(`toggleAdmin/${logId}`);

    if (!this.isMember(serviceId)) {
      log.error(
        `toggleAdmin: Member ${conversationId} is not a member of the group`
      );
      return;
    }

    await this.modifyGroupV2({
      name: 'toggleAdmin',
      usingCredentialsFrom: [],
      createGroupChange: () => this.#toggleAdminChange(serviceId),
    });
  }

  async removeFromGroupV2(conversationId: string): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const logId = this.idForLogging();
    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      throw new Error(
        `removeFromGroupV2/${logId}: No conversation found for conversation ${conversationId}`
      );
    }

    const serviceId = pendingMember.getCheckedServiceId(
      `removeFromGroupV2/${logId}`
    );

    if (this.#isMemberRequestingToJoin(serviceId)) {
      strictAssert(isAciString(serviceId), 'Requesting member is not  ACI');
      await this.modifyGroupV2({
        name: 'denyPendingApprovalRequest',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#denyPendingApprovalRequest(serviceId),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMemberPending(serviceId)) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#removePendingMember([serviceId]),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMember(serviceId)) {
      await this.modifyGroupV2({
        name: 'removeFromGroup',
        usingCredentialsFrom: [],
        createGroupChange: () => this.#removeMember(serviceId),
        extraConversationsForSend: [conversationId],
      });
    } else {
      log.error(
        `removeFromGroupV2: Member ${conversationId} is neither a member nor a pending member of the group`
      );
    }
  }

  async safeGetVerified(): Promise<number> {
    const serviceId = this.getServiceId();
    if (!serviceId) {
      return this.#verifiedEnum.DEFAULT;
    }

    try {
      return await signalProtocolStore.getVerified(serviceId);
    } catch {
      return this.#verifiedEnum.DEFAULT;
    }
  }

  async updateVerified(): Promise<void> {
    if (isDirectConversation(this.attributes)) {
      await this.initialPromise;
      const verified = await this.safeGetVerified();

      const oldVerified = this.get('verified');
      if (oldVerified !== verified) {
        this.set({ verified });
        this.captureChange(`updateVerified from=${oldVerified} to=${verified}`);
        await DataWriter.updateConversation(this.attributes);
      }

      return;
    }

    this.fetchContacts();

    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.map(async contact => {
        if (!isMe(contact.attributes)) {
          await contact.updateVerified();
        }
      })
    );
  }

  setVerifiedDefault(): Promise<boolean> {
    const { DEFAULT } = this.#verifiedEnum;
    return this.queueJob('setVerifiedDefault', () =>
      this.#_setVerified(DEFAULT)
    );
  }

  setVerified(): Promise<boolean> {
    const { VERIFIED } = this.#verifiedEnum;
    return this.queueJob('setVerified', () => this.#_setVerified(VERIFIED));
  }

  setUnverified(): Promise<boolean> {
    const { UNVERIFIED } = this.#verifiedEnum;
    return this.queueJob('setUnverified', () => this.#_setVerified(UNVERIFIED));
  }

  async #_setVerified(verified: number): Promise<boolean> {
    const { VERIFIED, DEFAULT } = this.#verifiedEnum;

    if (!isDirectConversation(this.attributes)) {
      throw new Error(
        'You cannot verify a group conversation. ' +
          'You must verify individual contacts.'
      );
    }

    const aci = this.getAci();
    const beginningVerified = this.get('verified') ?? DEFAULT;
    const keyChange = false;
    if (aci) {
      if (verified === this.#verifiedEnum.DEFAULT) {
        await signalProtocolStore.setVerified(aci, verified);
      } else {
        await signalProtocolStore.setVerified(aci, verified, {
          firstUse: false,
          nonblockingApproval: true,
        });
      }
    } else {
      log.warn(`_setVerified(${this.id}): no aci to update protocol storage`);
    }

    this.set({ verified });

    await DataWriter.updateConversation(this.attributes);

    if (beginningVerified !== verified) {
      this.captureChange(
        `_setVerified from=${beginningVerified} to=${verified}`
      );
    }

    const didVerifiedChange = beginningVerified !== verified;
    const isExplicitUserAction = true;
    if (
      // The message came from an explicit verification in a client (not
      // storage service sync)
      (didVerifiedChange && isExplicitUserAction) ||
      // Our local verification status is VERIFIED and it hasn't changed, but the key did
      //   change (Key1/VERIFIED -> Key2/VERIFIED), but we don't want to show DEFAULT ->
      //   DEFAULT or UNVERIFIED -> UNVERIFIED
      (keyChange && verified === VERIFIED)
    ) {
      await this.addVerifiedChange(this.id, verified === VERIFIED, {
        local: isExplicitUserAction,
      });
    }
    if (isExplicitUserAction && aci) {
      await this.sendVerifySyncMessage(this.get('e164'), aci, verified);
    }

    return keyChange;
  }

  async sendVerifySyncMessage(
    e164: string | undefined,
    aci: AciString,
    state: number
  ): Promise<CallbackResultType | void> {
    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'sendVerifySyncMessage: We are primary device; not sending sync'
      );
      return;
    }

    const key = await signalProtocolStore.loadIdentityKey(aci);
    if (!key) {
      throw new Error(
        `sendVerifySyncMessage: No identity key found for aci ${aci}`
      );
    }

    try {
      await singleProtoJobQueue.add(
        MessageSender.getVerificationSync(e164, aci, state, key)
      );
    } catch (error) {
      log.error(
        'sendVerifySyncMessage: Failed to queue sync message',
        Errors.toLogFormat(error)
      );
    }
  }

  isVerified(): boolean {
    if (isDirectConversation(this.attributes)) {
      return this.get('verified') === this.#verifiedEnum.VERIFIED;
    }

    const contacts = this.contactCollection;

    if (contacts == null || contacts.length === 0) {
      return false;
    }

    if (contacts.length === 1 && isMe(contacts[0]?.attributes)) {
      return false;
    }

    return contacts.every(contact => {
      if (isMe(contact.attributes)) {
        return true;
      }
      return contact.isVerified();
    });
  }

  isUnverified(): boolean {
    if (isDirectConversation(this.attributes)) {
      const verified = this.get('verified');
      return (
        verified !== this.#verifiedEnum.VERIFIED &&
        verified !== this.#verifiedEnum.DEFAULT
      );
    }

    if (!this.contactCollection?.length) {
      return true;
    }

    return this.contactCollection?.some(contact => {
      if (isMe(contact.attributes)) {
        return false;
      }
      return contact.isUnverified();
    });
  }

  getUnverified(): Array<ConversationModel> {
    if (isDirectConversation(this.attributes)) {
      return this.isUnverified() ? [this] : [];
    }
    return (
      this.contactCollection?.filter(contact => {
        if (isMe(contact.attributes)) {
          return false;
        }
        return contact.isUnverified();
      }) || []
    );
  }

  async setApproved(): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      throw new Error(
        'You cannot set a group conversation as trusted. ' +
          'You must set individual contacts as trusted.'
      );
    }

    const serviceId = this.getServiceId();
    if (!serviceId) {
      log.warn(`setApproved(${this.id}): no serviceId, ignoring`);
      return;
    }

    return this.queueJob('setApproved', async () => {
      return signalProtocolStore.setApproval(serviceId, true);
    });
  }

  safeIsUntrusted(timestampThreshold?: number): boolean {
    try {
      const serviceId = this.getServiceId();
      strictAssert(serviceId, `No serviceId for conversation: ${this.id}`);
      return signalProtocolStore.isUntrusted(serviceId, timestampThreshold);
    } catch (err) {
      return false;
    }
  }

  isUntrusted(timestampThreshold?: number): boolean {
    if (isDirectConversation(this.attributes)) {
      return this.safeIsUntrusted(timestampThreshold);
    }
    const { contactCollection } = this;

    if (!contactCollection?.length) {
      return false;
    }

    return contactCollection.some(contact => {
      if (isMe(contact.attributes)) {
        return false;
      }
      return contact.safeIsUntrusted(timestampThreshold);
    });
  }

  getUntrusted(timestampThreshold?: number): Array<ConversationModel> {
    if (isDirectConversation(this.attributes)) {
      if (this.isUntrusted(timestampThreshold)) {
        return [this];
      }
      return [];
    }

    return (
      this.contactCollection?.filter(contact => {
        if (isMe(contact.attributes)) {
          return false;
        }
        return contact.isUntrusted(timestampThreshold);
      }) || []
    );
  }

  getSentMessageCount(): number {
    return this.get('sentMessageCount') || 0;
  }

  getMessageRequestResponseType(): number {
    return this.get('messageRequestResponseType') || 0;
  }

  getAboutText(): string | undefined {
    return getAboutText(this.attributes);
  }

  /**
   * Determine if this conversation should be considered "accepted" in terms
   * of message requests
   */
  getAccepted(options?: IsConversationAcceptedOptionsType): boolean {
    return isConversationAccepted(this.attributes, options);
  }

  onMemberVerifiedChange(): void {
    // If the verified state of a member changes, our aggregate state changes.
    window.ConversationController.conversationUpdated(this, this.attributes);
  }

  async toggleVerified(): Promise<unknown> {
    if (this.isVerified()) {
      return this.setVerifiedDefault();
    }
    return this.setVerified();
  }

  async addChatSessionRefreshed({
    receivedAt,
    receivedAtCounter,
  }: {
    receivedAt: number;
    receivedAtCounter: number;
  }): Promise<void> {
    log.info(`addChatSessionRefreshed: adding for ${this.idForLogging()}`, {
      receivedAt,
    });

    const message = new MessageModel({
      ...generateMessageId(receivedAtCounter),
      conversationId: this.id,
      type: 'chat-session-refreshed',
      timestamp: receivedAt,
      sent_at: receivedAt,
      received_at_ms: receivedAt,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    });

    await window.MessageCache.saveMessage(message, {
      forceSave: true,
    });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));
    this.throttledUpdateUnread();
  }

  async addDeliveryIssue({
    receivedAt,
    receivedAtCounter,
    senderAci,
    sentAt,
  }: {
    receivedAt: number;
    receivedAtCounter: number;
    senderAci: AciString;
    sentAt: number;
  }): Promise<void> {
    log.info(`addDeliveryIssue: adding for ${this.idForLogging()}`, {
      sentAt,
      senderAci,
    });

    if (!this.get('active_at')) {
      log.warn(
        `addDeliveryIssue: ${this.idForLogging()} has no active_at, dropping delivery issue instead of adding`
      );
      return;
    }

    const message = new MessageModel({
      ...generateMessageId(receivedAtCounter),
      conversationId: this.id,
      type: 'delivery-issue',
      sourceServiceId: senderAci,
      sent_at: receivedAt,
      received_at_ms: receivedAt,
      timestamp: receivedAt,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    });

    await window.MessageCache.saveMessage(message, {
      forceSave: true,
    });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));
    this.throttledUpdateUnread();

    await maybeNotify({ message: message.attributes, conversation: this });
  }

  async addKeyChange(
    reason: string,
    keyChangedId?: ServiceIdString
  ): Promise<void> {
    return this.queueJob(`addKeyChange(${keyChangedId})`, async () => {
      log.info(
        'adding key change advisory in',
        this.idForLogging(),
        'for',
        keyChangedId || 'this conversation',
        this.get('timestamp'),
        'reason:',
        reason
      );

      if (!keyChangedId && !isDirectConversation(this.attributes)) {
        throw new Error(
          'addKeyChange: Cannot omit keyChangedId in group conversation!'
        );
      }

      const timestamp = Date.now();
      const message = new MessageModel({
        ...generateMessageId(incrementMessageCounter()),
        conversationId: this.id,
        type: 'keychange',
        sent_at: timestamp,
        timestamp,
        received_at_ms: timestamp,
        key_changed: keyChangedId,
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Unseen,
        schemaVersion: Message.VERSION_NEEDED_FOR_DISPLAY,
      });

      await window.MessageCache.saveMessage(message, {
        forceSave: true,
      });
      window.MessageCache.register(message);

      drop(this.onNewMessage(message));

      const serviceId = this.getServiceId();

      if (isDirectConversation(this.attributes)) {
        window.reduxActions?.safetyNumber.clearSafetyNumber(this.id);
      }

      if (isDirectConversation(this.attributes) && serviceId) {
        const groups = await this.#getSharedGroups();
        groups?.forEach(group => {
          drop(group.addKeyChange('addKeyChange - group fan-out', serviceId));
        });
      }

      // Reset sender key for next send
      const senderKeyInfo = this.get('senderKeyInfo');
      if (senderKeyInfo) {
        await resetSenderKey(this.toSenderKeyTarget());
      }

      if (isDirectConversation(this.attributes)) {
        this.captureChange(`addKeyChange(${reason})`);
      }
    });
  }

  async addConversationMerge(
    renderInfo: ConversationRenderInfoType
  ): Promise<void> {
    log.info(
      `addConversationMerge/${this.idForLogging()}: Adding notification`
    );

    const timestamp = Date.now();
    const message = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      conversationId: this.id,
      type: 'conversation-merge',
      sent_at: timestamp,
      timestamp,
      received_at_ms: timestamp,
      conversationMerge: {
        renderInfo,
      },
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Unseen,
      schemaVersion: Message.VERSION_NEEDED_FOR_DISPLAY,
    });

    await window.MessageCache.saveMessage(message, { forceSave: true });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));
  }

  async addPhoneNumberDiscoveryIfNeeded(originalPni: PniString): Promise<void> {
    const logId = `addPhoneNumberDiscoveryIfNeeded(${this.idForLogging()}, ${originalPni})`;

    const e164 = this.get('e164');

    if (!e164) {
      log.info(`${logId}: not adding, no e164`);
      return;
    }

    const hadSession = await signalProtocolStore.hasSessionWith(originalPni);

    if (!hadSession) {
      log.info(`${logId}: not adding, no PNI session`);
      return;
    }

    log.info(`${logId}: adding notification`);
    const timestamp = Date.now();
    const message = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      conversationId: this.id,
      type: 'phone-number-discovery',
      sent_at: timestamp,
      timestamp,
      received_at_ms: timestamp,
      phoneNumberDiscovery: {
        e164,
      },
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Unseen,
      schemaVersion: Message.VERSION_NEEDED_FOR_DISPLAY,
    });

    await window.MessageCache.saveMessage(message, { forceSave: true });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));
  }

  async addVerifiedChange(
    verifiedChangeId: string,
    verified: boolean,
    options: { local?: boolean } = { local: true }
  ): Promise<void> {
    if (isMe(this.attributes)) {
      log.info('refusing to add verified change advisory for our own number');
      return;
    }

    const timestamp = Date.now();
    log.info(
      'adding verified change advisory for',
      this.idForLogging(),
      verifiedChangeId,
      timestamp
    );

    const message = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      conversationId: this.id,
      local: Boolean(options.local),
      readStatus: ReadStatus.Read,
      received_at_ms: timestamp,
      seenStatus: options.local ? SeenStatus.Seen : SeenStatus.Unseen,
      sent_at: timestamp,
      timestamp,
      type: 'verified-change',
      verified,
      verifiedChanged: verifiedChangeId,
    });

    await window.MessageCache.saveMessage(message, { forceSave: true });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));
    this.throttledUpdateUnread();

    const serviceId = this.getServiceId();
    if (isDirectConversation(this.attributes) && serviceId) {
      const groups = await this.#getSharedGroups();
      groups?.forEach(group => {
        drop(group.addVerifiedChange(this.id, verified, options));
      });
    }
  }

  async addProfileChange(
    profileChange: ProfileNameChangeType,
    conversationId?: string
  ): Promise<void> {
    const now = Date.now();
    const message = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      conversationId: this.id,
      type: 'profile-change',
      sent_at: now,
      received_at_ms: now,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,
      timestamp: now,
      changedId: conversationId || this.id,
      profileChange,
    });

    await window.MessageCache.saveMessage(message, { forceSave: true });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));

    const serviceId = this.getServiceId();
    if (isDirectConversation(this.attributes) && serviceId) {
      this.set({ profileLastUpdatedAt: Date.now() });

      const groups = await this.#getSharedGroups();
      groups?.forEach(group => {
        drop(group.addProfileChange(profileChange, this.id));
      });
    }
  }

  async addNotification(
    type: MessageAttributesType['type'],
    extra: Partial<MessageAttributesType> = {}
  ): Promise<string> {
    const now = Date.now();
    const message = new MessageModel({
      ...generateMessageId(incrementMessageCounter()),
      conversationId: this.id,
      type,
      sent_at: now,
      received_at_ms: now,
      timestamp: now,

      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,

      ...extra,
    });

    await window.MessageCache.saveMessage(message, { forceSave: true });
    window.MessageCache.register(message);

    drop(this.onNewMessage(message));

    return message.id;
  }

  async maybeSetPendingUniversalTimer(
    hasUserInitiatedMessages: boolean
  ): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      return;
    }

    if (this.isSMSOnly()) {
      return;
    }

    if (isSignalConversation(this.attributes)) {
      return;
    }

    if (hasUserInitiatedMessages) {
      await this.maybeRemoveUniversalTimer();
      return;
    }

    if (this.get('pendingUniversalTimer') || this.get('expireTimer')) {
      return;
    }

    const expireTimer = universalExpireTimer.get();
    if (!expireTimer) {
      return;
    }

    log.info(
      `maybeSetPendingUniversalTimer(${this.idForLogging()}): added notification`
    );
    const notificationId = await this.addNotification(
      'universal-timer-notification'
    );
    this.set({ pendingUniversalTimer: notificationId });
  }

  async maybeApplyUniversalTimer(): Promise<void> {
    // Check if we had a notification
    if (!(await this.maybeRemoveUniversalTimer())) {
      return;
    }

    // We already have an expiration timer
    if (this.get('expireTimer')) {
      return;
    }

    const expireTimer = universalExpireTimer.get();
    if (expireTimer) {
      log.info(
        `maybeApplyUniversalTimer(${this.idForLogging()}): applying timer`
      );

      await this.updateExpirationTimer(expireTimer, {
        reason: 'maybeApplyUniversalTimer',
        version: undefined,
      });
    }
  }

  async maybeRemoveUniversalTimer(): Promise<boolean> {
    const notificationId = this.get('pendingUniversalTimer');
    if (!notificationId) {
      return false;
    }

    this.set({ pendingUniversalTimer: undefined });
    log.info(
      `maybeRemoveUniversalTimer(${this.idForLogging()}): removed notification`
    );

    const message = window.MessageCache.getById(notificationId);
    if (message) {
      await DataWriter.removeMessage(message.id, {
        cleanupMessages,
      });
    }
    return true;
  }

  async maybeSetContactRemoved(): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      return;
    }

    if (this.attributes.removalStage !== 'justNotification') {
      return;
    }

    if (this.get('pendingRemovedContactNotification')) {
      return;
    }

    log.info(
      `maybeSetContactRemoved(${this.idForLogging()}): added notification`
    );
    const notificationId = await this.addNotification(
      'contact-removed-notification'
    );
    this.set({ pendingRemovedContactNotification: notificationId });
    await DataWriter.updateConversation(this.attributes);
  }

  async maybeClearContactRemoved(): Promise<boolean> {
    const notificationId = this.get('pendingRemovedContactNotification');
    if (!notificationId) {
      return false;
    }

    this.set({ pendingRemovedContactNotification: undefined });
    log.info(
      `maybeClearContactRemoved(${this.idForLogging()}): removed notification`
    );

    const message = window.MessageCache.getById(notificationId);
    if (message) {
      await DataWriter.removeMessage(message.id, {
        cleanupMessages,
      });
    }

    return true;
  }

  async addChangeNumberNotification(
    oldValue: string,
    newValue: string
  ): Promise<void> {
    const sourceServiceId = this.getCheckedServiceId(
      'Change number notification without service id'
    );

    if (
      itemStorage.user.getOurServiceIdKind(sourceServiceId) !==
      ServiceIdKind.Unknown
    ) {
      log.info(
        `Conversation ${this.idForLogging()}: not adding change number ` +
          'notification for ourselves'
      );
      return;
    }

    log.info(
      `Conversation ${this.idForLogging()}: adding change number ` +
        `notification for ${sourceServiceId} from ${oldValue} to ${newValue}`
    );

    const convos = [this, ...((await this.#getSharedGroups()) ?? [])];

    await Promise.all(
      convos.map(convo => {
        return convo.addNotification('change-number-notification', {
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Unseen,
          sourceServiceId,
        });
      })
    );
  }

  async onReadMessage(
    message: MessageAttributesType,
    readAt?: number
  ): Promise<void> {
    // We mark as read everything older than this message - to clean up old stuff
    //   still marked unread in the database. If the user generally doesn't read in
    //   the desktop app, so the desktop app only gets read syncs, we can very
    //   easily end up with messages never marked as read (our previous early read
    //   sync handling, read syncs never sent because app was offline)

    // We queue it because we often get a whole lot of read syncs at once, and
    //   their markRead calls could very easily overlap given the async pull from DB.

    // Lastly, we don't send read syncs for any message marked read due to a read
    //   sync. That's a notification explosion we don't need.
    return this.queueJob('onReadMessage', () =>
      this.markRead(message, {
        sendReadReceipts: false,
        readAt,
      })
    );
  }

  async queueJob<T>(
    name: string,
    callback: (abortSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const logId = `conversation.queueJob(${this.idForLogging()}, ${name})`;

    if (this.#isShuttingDown) {
      log.warn(`${logId}: shutting down, can't accept more work`);
      throw new Error(`${logId}: shutting down, can't accept more work`);
    }

    this.jobQueue = this.jobQueue || new PQueue({ concurrency: 1 });

    const taskWithTimeout = createTaskWithTimeout(callback, logId);

    const abortController = new AbortController();
    const { signal: abortSignal } = abortController;

    const queuedAt = Date.now();
    return this.jobQueue.add(async () => {
      const startedAt = Date.now();
      const waitTime = startedAt - queuedAt;

      if (waitTime > JOB_REPORTING_THRESHOLD_MS) {
        log.info(`${logId}: was blocked for ${waitTime}ms`);
      }

      try {
        return await taskWithTimeout(abortSignal);
      } catch (error) {
        abortController.abort();
        throw error;
      } finally {
        const duration = Date.now() - startedAt;

        if (duration > JOB_REPORTING_THRESHOLD_MS) {
          log.info(`${logId}: took ${duration}ms`);
        }
      }
    });
  }

  isAdmin(serviceId: ServiceIdString): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    const members = this.get('membersV2') || [];
    const member = members.find(x => x.aci === serviceId);
    if (!member) {
      return false;
    }

    const MEMBER_ROLES = Proto.Member.Role;

    return member.role === MEMBER_ROLES.ADMINISTRATOR;
  }

  getServiceId(): ServiceIdString | undefined {
    return this.get('serviceId');
  }

  getCheckedServiceId(reason: string): ServiceIdString {
    const serviceId = this.getServiceId();
    strictAssert(serviceId !== undefined, reason);
    return serviceId;
  }

  getAci(): AciString | undefined {
    const value = this.getServiceId();
    if (value && isAciString(value)) {
      return value;
    }
    return undefined;
  }

  getCheckedAci(reason: string): AciString {
    const aci = this.getAci();
    strictAssert(aci !== undefined, reason);
    return aci;
  }

  getPni(): PniString | undefined {
    return this.get('pni');
  }

  getGroupLink(): string | undefined {
    if (!isGroupV2(this.attributes)) {
      return undefined;
    }

    if (!this.get('groupInviteLinkPassword')) {
      return undefined;
    }

    return buildGroupLink(this.attributes);
  }

  getMembers(
    options: { includePendingMembers?: boolean } = {}
  ): Array<ConversationModel> {
    return compact(
      getConversationMembers(this.attributes, options).map(conversationAttrs =>
        window.ConversationController.get(conversationAttrs.id)
      )
    );
  }

  canBeAnnouncementGroup(): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    return true;
  }

  getMemberIds(): Array<string> {
    const members = this.getMembers();
    return members.map(member => member.id);
  }

  getRecipients({
    includePendingMembers,
    extraConversationsForSend,
  }: {
    includePendingMembers?: boolean;
    extraConversationsForSend?: ReadonlyArray<string>;
    isStoryReply?: boolean;
  } = {}): Array<ServiceIdString> {
    return getRecipients(this.attributes, {
      includePendingMembers,
      extraConversationsForSend,
    });
  }

  // Members is all people in the group
  getMemberConversationIds(): Set<string> {
    return new Set(map(this.getMembers(), conversation => conversation.id));
  }

  async getQuoteAttachment(
    attachments?: Array<AttachmentType>,
    preview?: Array<LinkPreviewType>,
    sticker?: StickerType
  ): Promise<
    Array<{
      contentType: MIMEType;
      fileName?: string | null;
      thumbnail?: ThumbnailType | null;
    }>
  > {
    return getQuoteAttachment(attachments, preview, sticker);
  }

  async sendStickerMessage(packId: string, stickerId: number): Promise<void> {
    const packData = Stickers.getStickerPack(packId);
    const stickerData = Stickers.getSticker(packId, stickerId);
    if (!stickerData || !packData) {
      log.warn(
        `Attempted to send nonexistent (${packId}, ${stickerId}) sticker!`
      );
      return;
    }

    const { key } = packData;
    const { emoji, width, height } = stickerData;
    const data = await readStickerData(stickerData);

    // We need this content type to be an image so we can display an `<img>` instead of a
    //   `<video>` or an error, but it's not critical that we get the full type correct.
    //   In other words, it's probably fine if we say that a GIF is `image/png`, but it's
    //   but it's bad if we say it's `video/mp4` or `text/plain`. We do our best to sniff
    //   the MIME type here, but it's okay if we have to use a possibly-incorrect
    //   fallback.
    let contentType: MIMEType;
    const sniffedMimeType = sniffImageMimeType(data);
    if (sniffedMimeType) {
      contentType = sniffedMimeType;
    } else {
      log.warn(
        'sendStickerMessage: Unable to sniff sticker MIME type; falling back to WebP'
      );
      contentType = IMAGE_WEBP;
    }

    const sticker: StickerWithHydratedData = {
      packId,
      stickerId,
      packKey: key,
      emoji,
      data: {
        size: data.byteLength,
        data,
        contentType,
        width,
        height,
        blurHash: await imageToBlurHash(
          new Blob([data], {
            type: IMAGE_JPEG,
          })
        ),
      },
    };

    drop(
      this.enqueueMessageForSend(
        {
          body: undefined,
          attachments: [],
          sticker,
        },
        { dontClearDraft: true }
      )
    );
    window.reduxActions.stickers.useSticker(packId, stickerId);
  }

  async sendProfileKeyUpdate(): Promise<void> {
    if (isMe(this.attributes)) {
      return;
    }

    if (!this.get('profileSharing')) {
      log.error(
        'sendProfileKeyUpdate: profileSharing not enabled for conversation',
        this.idForLogging()
      );
      return;
    }

    try {
      await conversationJobQueue.add({
        type: conversationQueueJobEnum.enum.ProfileKey,
        conversationId: this.id,
        revision: this.get('revision'),
      });
    } catch (error) {
      log.error(
        'sendProfileKeyUpdate: Failed to queue profile share',
        Errors.toLogFormat(error)
      );
    }
  }

  beforeMessageSend({
    message,
    dontAddMessage,
    dontClearDraft,
    now,
    extraReduxActions,
  }: {
    message: MessageAttributesType;
    dontAddMessage: boolean;
    dontClearDraft: boolean;
    now: number;
    extraReduxActions?: () => void;
  }): void {
    const { clearUnreadMetrics } = window.reduxActions.conversations;
    clearUnreadMetrics(this.id);

    const enabledProfileSharing = Boolean(!this.get('profileSharing'));
    const unarchivedConversation = Boolean(this.get('isArchived'));

    log.info(
      `beforeMessageSend(${this.idForLogging()}): ` +
        `clearDraft(${!dontClearDraft}) addMessage(${!dontAddMessage})`
    );

    if (!dontAddMessage) {
      this.#doAddSingleMessage(message, { isJustSent: true });
    }

    const draftProperties = dontClearDraft
      ? {}
      : {
          draft: '',
          draftEditMessage: undefined,
          draftBodyRanges: [],
          draftTimestamp: null,
          quotedMessageId: undefined,
        };
    const lastMessageProperties = this.getLastMessageData(message, message);
    const isEditMessage = Boolean(message.editHistory);

    this.set({
      ...draftProperties,
      ...lastMessageProperties,
      ...(enabledProfileSharing ? { profileSharing: true } : {}),
      ...(dontAddMessage ? {} : this.incrementSentMessageCount({ dry: true })),
      // If it's an edit message we don't want to optimistically set the
      // active_at & timestamp to now. We want it to stay the same.
      active_at: isEditMessage ? this.get('active_at') : now,
      timestamp: isEditMessage ? this.get('timestamp') : now,
      ...(unarchivedConversation ? { isArchived: false } : {}),
    });

    if (enabledProfileSharing) {
      this.captureChange('beforeMessageSend/mandatoryProfileSharing');
    }
    if (unarchivedConversation) {
      this.captureChange('beforeMessageSend/unarchive');
    }

    extraReduxActions?.();
  }

  async enqueueMessageForSend(
    {
      attachments,
      body,
      contact,
      bodyRanges,
      preview,
      quote,
      sticker,
    }: {
      attachments: Array<AttachmentType>;
      body: string | undefined;
      contact?: Array<EmbeddedContactWithHydratedAvatar>;
      bodyRanges?: DraftBodyRanges;
      preview?: Array<LinkPreviewWithHydratedData>;
      quote?: QuotedMessageType;
      sticker?: StickerWithHydratedData;
    },
    {
      dontClearDraft = false,
      sendHQImages,
      storyId,
      timestamp,
      extraReduxActions,
    }: {
      dontClearDraft?: boolean;
      sendHQImages?: boolean;
      storyId?: string;
      timestamp?: number;
      extraReduxActions?: () => void;
    } = {}
  ): Promise<MessageAttributesType | undefined> {
    if (this.isGroupV1AndDisabled()) {
      return;
    }

    if (isSignalConversation(this.attributes)) {
      return;
    }

    const now = timestamp || Date.now();

    log.info(
      'Sending message to conversation',
      this.idForLogging(),
      'with timestamp',
      now
    );

    this.clearTypingTimers();

    let expirationStartTimestamp: number | undefined;
    let expireTimer: DurationInSeconds | undefined;

    // For normal messages and 1:1 story replies, we use the parent conversation's timer
    if (!storyId || isDirectConversation(this.attributes)) {
      await this.maybeApplyUniversalTimer();
      expireTimer = this.get('expireTimer');
    }

    const recipientMaybeConversations = map(
      this.getRecipients({
        isStoryReply: storyId !== undefined,
      }),
      identifier => window.ConversationController.get(identifier)
    );
    const recipientConversations = filter(
      recipientMaybeConversations,
      isNotNil
    );
    const recipientConversationIds = concat(
      map(recipientConversations, c => c.id),
      [window.ConversationController.getOurConversationIdOrThrow()]
    );

    // If there are link previews present in the message we shouldn't include
    // any attachments as well.
    let attachmentsToSend = preview && preview.length ? [] : attachments;

    if (preview && preview.length) {
      attachments.forEach(attachment => {
        if (attachment.path) {
          void deleteAttachmentData(attachment.path);
        }
      });
    }

    /**
     * At this point, all attachments have been processed and written to disk as draft
     * attachments, via processAttachments. All transcodable images have been re-encoded
     * via canvas to remove EXIF data. Images above the high-quality threshold size have
     * been scaled to high-quality JPEGs.
     *
     * If we choose to send images in standard quality, we need to scale them down
     * (potentially for the second time). When we do so, we also delete the current
     * draft attachment on disk for cleanup.
     *
     * All draft attachments (with a path or just in-memory) will be written to disk for
     * real in `upgradeMessageSchema`.
     */
    if (!sendHQImages) {
      attachmentsToSend = await Promise.all(
        attachmentsToSend.map(async attachment => {
          const downscaledAttachment =
            await downscaleOutgoingAttachment(attachment);
          if (downscaledAttachment !== attachment && attachment.path) {
            drop(deleteAttachmentData(attachment.path));
          }
          return downscaledAttachment;
        })
      );
    }

    // Here we move attachments to disk
    const attributes = await upgradeMessageSchema({
      ...generateMessageId(incrementMessageCounter()),
      timestamp: now,
      type: 'outgoing',
      body,
      conversationId: this.id,
      contact,
      quote,
      preview,
      attachments: attachmentsToSend,
      sent_at: now,
      received_at_ms: now,
      expirationStartTimestamp,
      expireTimer,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,
      sticker,
      bodyRanges,
      sendHQImages,
      sendStateByConversationId: zipObject(
        recipientConversationIds,
        repeat({
          status: SendStatus.Pending,
          updatedAt: now,
        })
      ),
      storyId,
    });

    const model = window.MessageCache.register(new MessageModel(attributes));

    const dbStart = Date.now();

    strictAssert(
      typeof model.get('timestamp') === 'number',
      'Expected a timestamp'
    );

    // Make sure profile sharing is enabled before job is queued and run
    this.enableProfileSharing({
      reason: 'mandatoryProfileSharing',
    });

    await conversationJobQueue.add(
      {
        type: conversationQueueJobEnum.enum.NormalMessage,
        conversationId: this.id,
        messageId: model.id,
        revision: this.get('revision'),
      },
      async jobToInsert => {
        log.info(
          `enqueueMessageForSend: saving message ${model.id} and job ${jobToInsert.id}`
        );
        await window.MessageCache.saveMessage(model, {
          jobToInsert,
          forceSave: true,
        });
      }
    );

    const dbDuration = Date.now() - dbStart;
    if (dbDuration > SEND_REPORTING_THRESHOLD_MS) {
      log.info(
        `ConversationModel(${this.idForLogging()}.sendMessage(${now}): ` +
          `db save took ${dbDuration}ms`
      );
    }

    const renderStart = Date.now();

    // Perform asynchronous tasks before entering the batching mode
    await this.#beforeAddSingleMessage(model.attributes);

    if (sticker) {
      await addStickerPackReference({
        messageId: model.id,
        packId: sticker.packId,
        stickerId: sticker.stickerId,
        isUnresolved: false,
      });
    }

    this.beforeMessageSend({
      message: model.attributes,
      dontClearDraft,
      dontAddMessage: false,
      now,
      extraReduxActions,
    });

    // The call above enables profile sharing so we have to restore contact
    // afterwards, otherwise Message Request state will flash.
    if (!storyId || isDirectConversation(this.attributes)) {
      await this.restoreContact();
    }

    const renderDuration = Date.now() - renderStart;

    if (renderDuration > SEND_REPORTING_THRESHOLD_MS) {
      log.info(
        `ConversationModel(${this.idForLogging()}.sendMessage(${now}): ` +
          `render save took ${renderDuration}ms`
      );
    }

    await DataWriter.updateConversation(this.attributes);

    return attributes;
  }

  async maybeClearUsername(): Promise<void> {
    const ourConversationId =
      window.ConversationController.getOurConversationId();

    const oldUsername = this.get('username');

    // Clear username once we have other information about the contact
    if (canHaveUsername(this.attributes, ourConversationId) || !oldUsername) {
      return;
    }

    log.info(`maybeClearUsername(${this.idForLogging()}): clearing username`);

    this.set({ username: undefined });

    if (this.get('needsTitleTransition') && getProfileName(this.attributes)) {
      log.info(
        `maybeClearUsername(${this.idForLogging()}): adding a notification`
      );
      const { type, e164, username } = this.attributes;

      this.set({ needsTitleTransition: undefined });

      await this.addNotification('title-transition-notification', {
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Unseen,
        titleTransition: {
          renderInfo: {
            type,
            e164,
            username,
          },
        },
      });
    }

    await DataWriter.updateConversation(this.attributes);
    this.captureChange('clearUsername');
  }

  async updateUsername(
    username: string | undefined,
    { shouldSave = true }: { shouldSave?: boolean } = {}
  ): Promise<void> {
    const ourConversationId =
      window.ConversationController.getOurConversationId();

    if (!canHaveUsername(this.attributes, ourConversationId)) {
      return;
    }

    if (this.get('username') === username) {
      return;
    }

    log.info(`updateUsername(${this.idForLogging()}): updating username`);

    this.set({ username });
    this.captureChange('updateUsername');

    if (shouldSave) {
      await DataWriter.updateConversation(this.attributes);
    }
  }

  async updateLastMessage(): Promise<void> {
    if (!this.id) {
      return;
    }

    const conversationId = this.id;

    const stats = await DataReader.getConversationMessageStats({
      conversationId,
      includeStoryReplies: !isGroup(this.attributes),
    });

    // This runs as a job to avoid race conditions
    drop(
      this.queueJob('maybeSetPendingUniversalTimer', async () =>
        this.maybeSetPendingUniversalTimer(stats.hasUserInitiatedMessages)
      )
    );
    drop(
      this.queueJob('maybeAddRemovedNotification', async () =>
        this.maybeSetContactRemoved()
      )
    );

    const { preview: previewAttributes, activity: activityAttributes } = stats;
    let preview: MessageModel | undefined;
    let activity: MessageModel | undefined;

    // Get the in-memory message from MessageCache so that if it already exists
    // in memory we use that data instead of the data from the db which may
    // be out of date.
    if (previewAttributes) {
      preview = window.MessageCache.register(
        new MessageModel(previewAttributes)
      );
      const updates = (await this.cleanAttributes([preview.attributes]))?.[0];
      preview.set(updates);
    }

    if (activityAttributes) {
      activity = window.MessageCache.register(
        new MessageModel(activityAttributes)
      );
      const updates = (await this.cleanAttributes([activity.attributes]))?.[0];
      activity.set(updates);
    }

    if (
      this.hasDraft() &&
      this.get('draftTimestamp') &&
      (!preview ||
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        preview.get('sent_at') < this.get('draftTimestamp')!)
    ) {
      return;
    }

    this.set(
      this.getLastMessageData(preview?.attributes, activity?.attributes)
    );

    await DataWriter.updateConversation(this.attributes);
  }

  getLastMessageData(
    preview?: MessageAttributesType,
    activity?: MessageAttributesType
  ): Pick<
    ConversationAttributesType,
    | 'lastMessage'
    | 'lastMessageBodyRanges'
    | 'lastMessagePrefix'
    | 'lastMessageAuthor'
    | 'lastMessageStatus'
    | 'lastMessageReceivedAt'
    | 'lastMessageReceivedAtMs'
    | 'timestamp'
    | 'lastMessageDeletedForEveryone'
  > {
    const ourConversationId =
      window.ConversationController.getOurConversationId();
    if (!ourConversationId) {
      throw new Error('getLastMessageData: Failed to fetch ourConversationId');
    }

    let timestamp = this.get('timestamp') || null;
    let lastMessageReceivedAt = this.get('lastMessageReceivedAt');
    let lastMessageReceivedAtMs = this.get('lastMessageReceivedAtMs');
    if (activity) {
      const { callId } = activity;
      const callHistory = callId
        ? getCallHistorySelector(window.reduxStore.getState())(callId)
        : undefined;

      timestamp = callHistory?.timestamp || activity.sent_at || timestamp;
      lastMessageReceivedAt = activity.received_at || lastMessageReceivedAt;
      lastMessageReceivedAtMs =
        activity.received_at_ms || lastMessageReceivedAtMs;
    }

    const notificationData = preview
      ? getNotificationDataForMessage(preview)
      : undefined;

    return {
      lastMessage:
        notificationData?.text ||
        (preview ? getNotificationTextForMessage(preview) : undefined) ||
        '',
      lastMessageBodyRanges: notificationData?.bodyRanges,
      lastMessagePrefix: notificationData?.emoji,
      lastMessageAuthor: preview ? getMessageAuthorText(preview) : undefined,
      lastMessageStatus: preview
        ? getMessagePropStatus(preview, ourConversationId)
        : undefined,
      lastMessageReceivedAt,
      lastMessageReceivedAtMs,
      timestamp,
      lastMessageDeletedForEveryone: preview?.deletedForEveryone || false,
    };
  }

  setArchived(isArchived: boolean): void {
    const before = this.get('isArchived');

    this.set({ isArchived });
    drop(DataWriter.updateConversation(this.attributes));

    const after = this.get('isArchived');

    if (Boolean(before) !== Boolean(after)) {
      if (after) {
        this.unpin();
      }
      this.captureChange('isArchived');
    }
  }

  setMarkedUnread(markedUnread: boolean): void {
    const previousMarkedUnread = this.get('markedUnread');

    this.set({ markedUnread });
    drop(DataWriter.updateConversation(this.attributes));

    if (Boolean(previousMarkedUnread) !== Boolean(markedUnread)) {
      this.captureChange('markedUnread');
    }
  }

  async #onActiveAtChange(): Promise<void> {
    if (this.get('active_at') && this.get('messagesDeleted')) {
      this.set({ messagesDeleted: false });
      await DataWriter.updateConversation(this.attributes);
    }
  }

  async refreshGroupLink(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const groupInviteLinkPassword = Bytes.toBase64(
      generateGroupInviteLinkPassword()
    );

    log.info('refreshGroupLink for conversation', this.idForLogging());

    await this.modifyGroupV2({
      name: 'updateInviteLinkPassword',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        buildInviteLinkPasswordChange(this.attributes, groupInviteLinkPassword),
    });

    this.set({ groupInviteLinkPassword });
  }

  async toggleGroupLink(value: boolean): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const shouldCreateNewGroupLink =
      value && !this.get('groupInviteLinkPassword');
    const groupInviteLinkPassword =
      this.get('groupInviteLinkPassword') ||
      Bytes.toBase64(generateGroupInviteLinkPassword());

    log.info('toggleGroupLink for conversation', this.idForLogging(), value);

    const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
    const addFromInviteLink = value
      ? ACCESS_ENUM.ANY
      : ACCESS_ENUM.UNSATISFIABLE;

    if (shouldCreateNewGroupLink) {
      await this.modifyGroupV2({
        name: 'updateNewGroupLink',
        usingCredentialsFrom: [],
        createGroupChange: async () =>
          buildNewGroupLinkChange(
            this.attributes,
            groupInviteLinkPassword,
            addFromInviteLink
          ),
      });
    } else {
      await this.modifyGroupV2({
        name: 'updateAccessControlAddFromInviteLink',
        usingCredentialsFrom: [],
        createGroupChange: async () =>
          buildAccessControlAddFromInviteLinkChange(
            this.attributes,
            addFromInviteLink
          ),
      });
    }

    this.set({
      accessControl: {
        addFromInviteLink,
        attributes: this.get('accessControl')?.attributes || ACCESS_ENUM.MEMBER,
        members: this.get('accessControl')?.members || ACCESS_ENUM.MEMBER,
      },
    });

    if (shouldCreateNewGroupLink) {
      this.set({ groupInviteLinkPassword });
    }
  }

  async updateAccessControlAddFromInviteLink(value: boolean): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

    const addFromInviteLink = value
      ? ACCESS_ENUM.ADMINISTRATOR
      : ACCESS_ENUM.ANY;

    await this.modifyGroupV2({
      name: 'updateAccessControlAddFromInviteLink',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        buildAccessControlAddFromInviteLinkChange(
          this.attributes,
          addFromInviteLink
        ),
    });

    this.set({
      accessControl: {
        addFromInviteLink,
        attributes: this.get('accessControl')?.attributes || ACCESS_ENUM.MEMBER,
        members: this.get('accessControl')?.members || ACCESS_ENUM.MEMBER,
      },
    });
  }

  async updateAccessControlAttributes(value: number): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    await this.modifyGroupV2({
      name: 'updateAccessControlAttributes',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        buildAccessControlAttributesChange(this.attributes, value),
    });

    const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
    this.set({
      accessControl: {
        addFromInviteLink:
          this.get('accessControl')?.addFromInviteLink || ACCESS_ENUM.MEMBER,
        attributes: value,
        members: this.get('accessControl')?.members || ACCESS_ENUM.MEMBER,
      },
    });
  }

  async updateAccessControlMembers(value: number): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    await this.modifyGroupV2({
      name: 'updateAccessControlMembers',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        buildAccessControlMembersChange(this.attributes, value),
    });

    const ACCESS_ENUM = Proto.AccessControl.AccessRequired;
    this.set({
      accessControl: {
        addFromInviteLink:
          this.get('accessControl')?.addFromInviteLink || ACCESS_ENUM.MEMBER,
        attributes: this.get('accessControl')?.attributes || ACCESS_ENUM.MEMBER,
        members: value,
      },
    });
  }

  async updateAnnouncementsOnly(value: boolean): Promise<void> {
    if (!isGroupV2(this.attributes) || !this.canBeAnnouncementGroup()) {
      return;
    }

    await this.modifyGroupV2({
      name: 'updateAnnouncementsOnly',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        buildAnnouncementsOnlyChange(this.attributes, value),
    });

    this.set({ announcementsOnly: value });
  }

  async updateExpirationTimer(
    providedExpireTimer: DurationInSeconds | undefined,
    {
      reason,
      receivedAt,
      receivedAtMS = Date.now(),
      sentAt: providedSentAt,
      source: providedSource,
      version,
      fromSync = false,
      isInitialSync = false,
    }: {
      reason: string;
      receivedAt?: number;
      receivedAtMS?: number;
      sentAt?: number;
      source?: string;
      version: number | undefined;
      fromSync?: boolean;
      isInitialSync?: boolean;
    }
  ): Promise<void> {
    const isSetByOther = providedSource || providedSentAt !== undefined;

    if (isSignalConversation(this.attributes)) {
      return;
    }

    if (isGroupV2(this.attributes)) {
      if (isSetByOther) {
        throw new Error(
          'updateExpirationTimer: GroupV2 timers are not updated this way'
        );
      }
      await this.modifyGroupV2({
        name: 'updateExpirationTimer',
        usingCredentialsFrom: [],
        createGroupChange: () =>
          this.updateExpirationTimerInGroupV2(providedExpireTimer),
      });
      return;
    }

    if (!isSetByOther && this.isGroupV1AndDisabled()) {
      throw new Error(
        'updateExpirationTimer: GroupV1 is deprecated; cannot update expiration timer'
      );
    }

    // If this is the initial sync, we want to use the provided expire timer & version and
    // disregard our local version. We might be re-linking after the primary has
    // re-registered and their expireTimerVersion may have been reset, but we don't want
    // to ignore it; our local version is out of date.
    if (
      isInitialSync &&
      this.get('expireTimerVersion') !== INITIAL_EXPIRE_TIMER_VERSION
    ) {
      log.warn(
        'updateExpirationTimer: Resetting expireTimerVersion since this is initialSync'
      );
      // This is reset after unlink, but we do it here as well to recover from errors
      this.set({ expireTimerVersion: INITIAL_EXPIRE_TIMER_VERSION });
    }

    let expireTimer: DurationInSeconds | undefined = providedExpireTimer;
    let source = providedSource;
    if (this.get('left')) {
      return;
    }

    if (!expireTimer) {
      expireTimer = undefined;
    }

    const timerMatchesLocalValue =
      this.get('expireTimer') === expireTimer ||
      (!expireTimer && !this.get('expireTimer'));

    const localVersion = this.getExpireTimerVersion();

    const logId =
      `updateExpirationTimer(${this.idForLogging()}, ` +
      `${expireTimer || 'disabled'}, version=${version || 0}) ` +
      `source=${source ?? '?'} localValue=${this.get('expireTimer')} ` +
      `localVersion=${localVersion}, reason=${reason}, isInitialSync=${isInitialSync}`;

    if (isSetByOther) {
      if (version) {
        if (localVersion && version < localVersion) {
          log.warn(`${logId}: not updating, local version is ${localVersion}`);
          return;
        }

        if (version === localVersion) {
          if (!timerMatchesLocalValue) {
            log.warn(`${logId}: expire version glare`);
          }
        } else {
          this.set({ expireTimerVersion: version });
          log.info(`${logId}: updating expire version`);
        }
      }
    }

    if (timerMatchesLocalValue) {
      return;
    }

    if (!isSetByOther) {
      log.info(`${logId}: queuing send job`);
      // if change wasn't made remotely, send it to the number/group
      try {
        await this.incrementExpireTimerVersion();
        await conversationJobQueue.add({
          type: conversationQueueJobEnum.enum.DirectExpirationTimerUpdate,
          conversationId: this.id,
          expireTimer,
        });
      } catch (error) {
        log.error(
          `${logId}: Failed to queue expiration timer update`,
          Errors.toLogFormat(error)
        );
        throw error;
      }
    }

    log.info(`${logId}: updating`);

    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();
    source = source || ourConversation.id;
    const sourceServiceId =
      window.ConversationController.get(source)?.get('serviceId');

    this.set({
      expireTimer,
    });

    // This call actually removes universal timer notification and clears
    // the pending flags.
    await this.maybeRemoveUniversalTimer();

    await DataWriter.updateConversation(this.attributes);

    // When we add a disappearing messages notification to the conversation, we want it
    //   to be above the message that initiated that change, hence the subtraction.
    const sentAt = (providedSentAt || receivedAtMS) - 1;

    const isFromSyncOperation =
      reason === 'group sync' || reason === 'contact sync';
    const isFromMe =
      window.ConversationController.get(source) === ourConversation;
    const isNoteToSelf = isMe(this.attributes);
    const shouldBeRead =
      (isInitialSync && isFromSyncOperation) || isFromMe || isNoteToSelf;

    const counter = receivedAt ?? incrementMessageCounter();
    const message = new MessageModel({
      ...generateMessageId(counter),
      conversationId: this.id,
      expirationTimerUpdate: {
        expireTimer,
        source,
        sourceServiceId,
        fromSync,
      },
      flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      readStatus: shouldBeRead ? ReadStatus.Read : ReadStatus.Unread,
      received_at_ms: receivedAtMS,
      seenStatus: shouldBeRead ? SeenStatus.Seen : SeenStatus.Unseen,
      sent_at: sentAt,
      timestamp: sentAt,
      type: 'timer-notification' as const,
    });

    await window.MessageCache.saveMessage(message, {
      forceSave: true,
    });
    window.MessageCache.register(message);

    void this.addSingleMessage(message.attributes);
    this.throttledUpdateUnread();

    log.info(
      `${logId}: added a notification received_at=${message.get('received_at')}`
    );
  }

  isSealedSenderDisabled(): boolean {
    const members = this.getMembers();
    if (
      members.some(
        member => member.get('sealedSender') === SEALED_SENDER.DISABLED
      )
    ) {
      return true;
    }

    return false;
  }

  isSearchable(): boolean {
    return !this.get('left');
  }

  async markRead(
    readMessage: { received_at: number; sent_at: number },
    options: {
      readAt?: number;
      sendReadReceipts: boolean;
    } = {
      sendReadReceipts: true,
    }
  ): Promise<void> {
    await markConversationRead(this.attributes, readMessage, options);
    this.throttledUpdateUnread();
    window.reduxActions.callHistory.updateCallHistoryUnreadCount();
  }

  async #updateUnread(): Promise<void> {
    const options = {
      storyId: undefined,
      includeStoryReplies: !isGroup(this.attributes),
    };
    const [unreadCount, unreadMentionsCount] = await Promise.all([
      DataReader.getTotalUnreadForConversation(this.id, options),
      DataReader.getTotalUnreadMentionsOfMeForConversation(this.id, options),
    ]);

    const prevUnreadCount = this.get('unreadCount');
    const prevUnreadMentionsCount = this.get('unreadMentionsCount');
    if (
      prevUnreadCount !== unreadCount ||
      prevUnreadMentionsCount !== unreadMentionsCount
    ) {
      this.set({
        unreadCount,
        unreadMentionsCount,
      });
      await DataWriter.updateConversation(this.attributes);
    }
  }

  async #getSharedGroups(): Promise<Array<ConversationModel> | undefined> {
    if (!isDirectConversation(this.attributes)) {
      return undefined;
    }
    if (isMe(this.attributes)) {
      return undefined;
    }

    const ourAci = itemStorage.user.getCheckedAci();
    const theirAci = this.getAci();
    if (!theirAci) {
      return undefined;
    }

    const ourGroups =
      await window.ConversationController.getAllGroupsInvolvingServiceId(
        ourAci
      );
    return ourGroups
      .filter(c => c.hasMember(ourAci) && c.hasMember(theirAci))
      .sort(
        (left, right) =>
          (right.get('timestamp') || 0) - (left.get('timestamp') || 0)
      );
  }

  // This is an expensive operation we use to populate the message request hero row. It
  //   shows groups the current user has in common with this potential new contact.
  async updateSharedGroups(): Promise<void> {
    const sharedGroups = await this.#getSharedGroups();

    if (sharedGroups == null) {
      return;
    }

    const sharedGroupNames = sharedGroups.map(conversation =>
      conversation.getTitle()
    );

    this.set({ sharedGroupNames });
  }

  onChangeProfileKey(): void {
    if (isDirectConversation(this.attributes)) {
      drop(this.getProfiles());
    }
  }

  async getProfiles(): Promise<void> {
    // request all conversation members' keys
    const conversations =
      this.getMembers() as unknown as Array<ConversationModel>;

    const groupId = isGroupV2(this.attributes)
      ? (this.get('groupId') ?? null)
      : null;

    await Promise.all(
      conversations.map(conversation =>
        getProfile({
          serviceId: conversation.getServiceId() ?? null,
          e164: conversation.get('e164') ?? null,
          groupId,
        })
      )
    );
  }

  async setEncryptedProfileName(
    encryptedName: string,
    decryptionKey: Uint8Array
  ): Promise<void> {
    if (!encryptedName) {
      return;
    }

    // decrypt
    const { given, family } = decryptProfileName(encryptedName, decryptionKey);

    // encode
    const profileName = given ? Bytes.toString(given) : undefined;
    const profileFamilyName = family ? Bytes.toString(family) : undefined;

    // set then check for changes
    const oldName = this.getProfileName();
    const hadPreviousName = Boolean(oldName);
    this.set({ profileName, profileFamilyName });

    const newName = this.getProfileName();

    // Note that we compare the combined names to ensure that we don't present the exact
    //   same before/after string, even if someone is moving from just first name to
    //   first/last name in their profile data.
    const nameChanged = oldName !== newName;
    if (!isMe(this.attributes) && hadPreviousName && nameChanged) {
      const change: ProfileNameChangeType = {
        type: 'name',
        oldName: oldName ?? '',
        newName: newName ?? '',
      };

      await this.addProfileChange(change);
    }
  }

  async setAndMaybeFetchProfileAvatar(options: {
    avatarUrl: undefined | null | string;
    decryptionKey?: Uint8Array | null | undefined;
    forceFetch?: boolean;
  }): Promise<void> {
    const { avatarUrl, decryptionKey, forceFetch } = options;
    if (isMe(this.attributes)) {
      if (avatarUrl) {
        await itemStorage.put('avatarUrl', avatarUrl);
      } else {
        await itemStorage.remove('avatarUrl');
      }
    }

    if (!avatarUrl) {
      this.set({ profileAvatar: undefined });
      return;
    }

    if (!this.getAccepted({ ignoreEmptyConvo: true }) && !forceFetch) {
      this.set({ remoteAvatarUrl: avatarUrl });
      return;
    }

    const avatar = await doGetAvatar(avatarUrl);

    // If decryptionKey isn't provided, use the one from the model
    const modelProfileKey = this.get('profileKey');
    const updatedDecryptionKey =
      decryptionKey ||
      (modelProfileKey ? Bytes.fromBase64(modelProfileKey) : null);

    if (!updatedDecryptionKey) {
      log.warn(
        'setAndMaybeFetchProfileAvatar: No decryption key provided and none found on model'
      );
      return;
    }

    // decrypt
    const decrypted = decryptProfile(avatar, updatedDecryptionKey);

    // update the conversation avatar only if hash differs
    if (decrypted) {
      const newAttributes = await Conversation.maybeUpdateProfileAvatar(
        this.attributes,
        {
          data: decrypted,
          writeNewAttachmentData,
          deleteAttachmentData,
          doesAttachmentExist,
        }
      );
      this.set(newAttributes);
    }
  }

  async setProfileKey(
    profileKey: string,
    {
      viaStorageServiceSync = false,
      reason,
    }: { viaStorageServiceSync?: boolean; reason: string }
  ): Promise<boolean> {
    strictAssert(
      profileKey == null || profileKey.length > 0,
      'setProfileKey: Profile key cannot be an empty string'
    );
    if (profileKey === undefined) {
      log.warn('setProfileKey: Refusing to set an undefined profileKey');
      return false;
    }

    let derivedAccessKey: Uint8Array;
    try {
      derivedAccessKey = deriveAccessKeyFromProfileKey(
        Bytes.fromBase64(profileKey)
      );
    } catch (error) {
      log.warn(
        'setProfileKey: refusing to set invalid profile key',
        Errors.toLogFormat(error)
      );
      return false;
    }

    const oldProfileKey = this.get('profileKey');

    // profileKey is a string so we can compare it directly
    if (oldProfileKey === profileKey) {
      return false;
    }

    const serviceId = this.get('serviceId');
    const aci = isAciString(serviceId) ? serviceId : undefined;
    const profileKeyHash = aci ? hashProfileKey(profileKey, aci) : 'no-aci';
    const logId = `setProfileKey(${this.idForLogging()}/${profileKeyHash}/${reason})`;

    log.info(`${logId}: Profile key changed. Setting sealedSender to UNKNOWN`);
    this.set({
      profileKeyCredential: null,
      profileKeyCredentialExpiration: null,
      accessKey: null,
      sealedSender: SEALED_SENDER.UNKNOWN,
    });

    // We messaged the contact when it had either phone number or username
    // title.
    if (this.get('needsTitleTransition')) {
      log.info(`${logId}: adding a title transition notification`);

      const { type, e164, username } = this.attributes;

      this.set({ needsTitleTransition: undefined });

      await this.addNotification('title-transition-notification', {
        readStatus: ReadStatus.Read,
        seenStatus: SeenStatus.Unseen,
        titleTransition: {
          renderInfo: {
            type,
            e164,
            username,
          },
        },
      });
    }

    // Don't trigger immediate profile fetches when syncing to remote storage
    this.set(
      { profileKey, accessKey: Bytes.toBase64(derivedAccessKey) },
      { noTrigger: viaStorageServiceSync }
    );

    // If our profile key was cleared above, we don't tell our linked devices about it.
    //   We want linked devices to tell us what it should be, instead of telling them to
    //   erase their local value.
    if (!viaStorageServiceSync) {
      this.captureChange('profileKey');
    }

    this.deriveAccessKeyIfNeeded();

    // We will update the conversation during storage service sync
    if (!viaStorageServiceSync) {
      await DataWriter.updateConversation(this.attributes);
    }

    return true;
  }

  hasProfileKeyCredentialExpired(): boolean {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return false;
    }

    const profileKeyCredential = this.get('profileKeyCredential');
    const profileKeyCredentialExpiration = this.get(
      'profileKeyCredentialExpiration'
    );

    if (!profileKeyCredential) {
      return true;
    }

    if (!isNumber(profileKeyCredentialExpiration)) {
      const logId = this.idForLogging();
      log.warn(`hasProfileKeyCredentialExpired(${logId}): missing expiration`);
      return true;
    }

    const today = toDayMillis(Date.now());

    return profileKeyCredentialExpiration <= today;
  }

  deriveAccessKeyIfNeeded(): void {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }
    if (this.get('accessKey')) {
      return;
    }

    this.set({
      accessKey: Bytes.toBase64(
        deriveAccessKeyFromProfileKey(Bytes.fromBase64(profileKey))
      ),
    });
  }

  deriveProfileKeyVersion(): string | undefined {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }

    const serviceId = this.getServiceId();
    if (!serviceId) {
      return;
    }

    const lastProfile = this.get('lastProfile');
    if (lastProfile?.profileKey === profileKey) {
      return lastProfile.profileKeyVersion;
    }

    const profileKeyVersion = deriveProfileKeyVersion(profileKey, serviceId);
    if (!profileKeyVersion) {
      log.warn(
        'deriveProfileKeyVersion: Failed to derive profile key version, return nothing.'
      );
      return;
    }

    return profileKeyVersion;
  }

  async updateLastProfile(
    oldValue: ConversationLastProfileType | undefined,
    { profileKey, profileKeyVersion }: ConversationLastProfileType
  ): Promise<void> {
    const lastProfile = this.get('lastProfile');

    // Atomic updates only
    if (lastProfile !== oldValue) {
      return;
    }

    if (
      lastProfile?.profileKey === profileKey &&
      lastProfile?.profileKeyVersion === profileKeyVersion
    ) {
      return;
    }

    log.warn(
      'ConversationModel.updateLastProfile: updating for',
      this.idForLogging()
    );

    this.set({ lastProfile: { profileKey, profileKeyVersion } });

    await DataWriter.updateConversation(this.attributes);
  }

  hasMember(serviceId: ServiceIdString): boolean {
    const members = this.getMembers();

    return members.some(member => member.getServiceId() === serviceId);
  }

  fetchContacts(): void {
    this.contactCollection = this.getMembers();
  }

  async destroyMessages({
    source,
  }: {
    source: 'message-request' | 'local-delete-sync' | 'local-delete';
  }): Promise<void> {
    const logId = `destroyMessages(${this.idForLogging()})/${source}`;

    log.info(`${logId}: Queuing job on conversation`);

    await this.queueJob(logId, async () => {
      log.info(`${logId}: Starting...`);

      await this.destroyMessagesInner({ logId, source });
    });
  }

  async destroyMessagesInner({
    logId: providedLogId,
    source,
  }: {
    logId: string;
    source: 'message-request' | 'local-delete-sync' | 'local-delete';
  }): Promise<void> {
    const logId = `${providedLogId}/destroyMessagesInner`;
    this.set({
      lastMessage: null,
      lastMessageAuthor: null,
      timestamp: null,
      active_at: null,
      pendingUniversalTimer: undefined,
      messagesDeleted: true,
    });
    await DataWriter.updateConversation(this.attributes);

    if (source === 'local-delete') {
      log.info(`${logId}: Preparing sync message`);
      const timestamp = Date.now();

      const addressableMessages = await getMostRecentAddressableMessages(
        this.id
      );
      const mostRecentMessages: Array<AddressableMessage> = addressableMessages
        .map(getAddressableMessage)
        .filter(isNotNil)
        .slice(0, 5);
      log.info(
        `${logId}: Found ${mostRecentMessages.length} most recent messages`
      );

      const areAnyDisappearing = addressableMessages.some(
        item => item.expireTimer
      );

      let mostRecentNonExpiringMessages: Array<AddressableMessage> | undefined;
      if (areAnyDisappearing) {
        const nondisappearingAddressableMessages =
          await getMostRecentAddressableNondisappearingMessages(this.id);
        mostRecentNonExpiringMessages = nondisappearingAddressableMessages
          .map(getAddressableMessage)
          .filter(isNotNil)
          .slice(0, 5);
        log.info(
          `${logId}: Found ${mostRecentNonExpiringMessages.length} most recent nondisappearing messages`
        );
      }

      if (mostRecentMessages.length > 0) {
        await singleProtoJobQueue.add(
          MessageSender.getDeleteForMeSyncMessage([
            {
              type: 'delete-conversation',
              conversation: getConversationIdentifier(this.attributes),
              isFullDelete: true,
              mostRecentMessages,
              mostRecentNonExpiringMessages,
              timestamp,
            },
          ])
        );
      } else {
        await singleProtoJobQueue.add(
          MessageSender.getDeleteForMeSyncMessage([
            {
              type: 'delete-local-conversation',
              conversation: getConversationIdentifier(this.attributes),
              timestamp,
            },
          ])
        );
      }

      log.info(`${logId}: Sync message queue complete`);
    }

    log.info(`${logId}: Starting delete`);
    await DataWriter.removeMessagesInConversation(this.id, {
      cleanupMessages,
      fromSync: source !== 'local-delete-sync',
      logId: this.idForLogging(),
    });
    log.info(`${logId}: Delete complete`);
  }

  getTitle(options?: { isShort?: boolean }): string {
    return getTitle(this.attributes, options);
  }

  getTitleNoDefault(options?: { isShort?: boolean }): string | undefined {
    return getTitleNoDefault(this.attributes, options);
  }

  getProfileName(): string | undefined {
    return getProfileName(this.attributes);
  }

  getNumber(): string | undefined {
    return getNumber(this.attributes);
  }

  getColor(): AvatarColorType {
    return migrateColor(this.get('color'), {
      aci: this.getAci(),
      e164: this.get('e164'),
      pni: this.getPni(),
      groupId: this.get('groupId'),
    });
  }

  getConversationColor(): ConversationColorType | undefined {
    return this.get('conversationColor');
  }

  getCustomColorData(): {
    customColor?: CustomColorType;
    customColorId?: string;
  } {
    if (this.getConversationColor() !== 'custom') {
      return {
        customColor: undefined,
        customColorId: undefined,
      };
    }

    return {
      customColor: this.get('customColor'),
      customColorId: this.get('customColorId'),
    };
  }

  areWeAdmin(): boolean {
    return areWeAdmin(this.attributes);
  }

  areWeAMember(): boolean {
    return (
      !this.get('left') && this.hasMember(itemStorage.user.getCheckedAci())
    );
  }

  getExpireTimerVersion(): number | undefined {
    return isDirectConversation(this.attributes)
      ? Math.min(this.get('expireTimerVersion') || 0, MAX_EXPIRE_TIMER_VERSION)
      : undefined;
  }

  async incrementExpireTimerVersion(): Promise<void> {
    const logId = `incrementExpireTimerVersion(${this.idForLogging()})`;
    if (!isDirectConversation(this.attributes)) {
      return;
    }
    const { expireTimerVersion } = this.attributes;

    // This should not happen in practice, but be ready to handle
    if (expireTimerVersion >= MAX_EXPIRE_TIMER_VERSION) {
      log.warn(`${logId}: expire version overflow`);
      return;
    }

    const newVersion = expireTimerVersion + 1;
    this.set({ expireTimerVersion: newVersion });
    await DataWriter.updateConversation(this.attributes);
  }

  // Set of items to captureChanges on:
  // [-] serviceId
  // [-] e164
  // [X] profileKey
  // [-] identityKey
  // [X] verified!
  // [-] profileName
  // [-] profileFamilyName
  // [X] nicknameAndNote
  // [X] blocked
  // [X] whitelisted
  // [X] archived
  // [X] markedUnread
  // [X] dontNotifyForMentionsIfMuted
  // [x] firstUnregisteredAt
  captureChange(logMessage: string): void {
    if (isSignalConversation(this.attributes)) {
      return;
    }

    log.info('storageService[captureChange]', logMessage, this.idForLogging());
    this.set({ needsStorageServiceSync: true });

    void this.queueJob('captureChange', async () => {
      storageServiceUploadJob({ reason: `captureChange/${logMessage}` });
    });
  }

  startMuteTimer({ viaStorageServiceSync = false } = {}): void {
    clearTimeoutIfNecessary(this.#muteTimer);
    this.#muteTimer = undefined;

    const muteExpiresAt = this.get('muteExpiresAt');
    if (isNumber(muteExpiresAt) && muteExpiresAt < Number.MAX_SAFE_INTEGER) {
      const delay = muteExpiresAt - Date.now();
      if (delay <= 0) {
        this.setMuteExpiration(0, { viaStorageServiceSync });
        return;
      }

      this.#muteTimer =
        safeSetTimeout(() => this.setMuteExpiration(0), delay) ?? undefined;
    }
  }

  toggleHideStories(): void {
    const hideStory = !this.get('hideStory');
    log.info(
      `toggleHideStories(${this.idForLogging()}): newValue=${hideStory}`
    );
    this.set({ hideStory });
    this.captureChange('hideStory');
    drop(DataWriter.updateConversation(this.attributes));
  }

  setMuteExpiration(
    muteExpiresAt = 0,
    { viaStorageServiceSync = false } = {}
  ): void {
    const prevExpiration = this.get('muteExpiresAt');

    if (prevExpiration === muteExpiresAt) {
      return;
    }

    this.set({ muteExpiresAt });

    // Don't cause duplicate captureChange
    this.startMuteTimer({ viaStorageServiceSync: true });

    if (!viaStorageServiceSync) {
      this.captureChange('mutedUntilTimestamp');
      drop(DataWriter.updateConversation(this.attributes));
    }
  }

  isMuted(): boolean {
    return isConversationMuted(this.attributes);
  }

  async getAvatarOrIdenticon(): Promise<{
    url: string;
    absolutePath?: string;
  }> {
    const saveToDisk = shouldSaveNotificationAvatarToDisk();
    const avatarUrl = getLocalAvatarUrl(this.attributes);
    if (avatarUrl) {
      return {
        url: avatarUrl,
        absolutePath: saveToDisk
          ? await this.#getTemporaryAvatarPath()
          : undefined,
      };
    }

    const { url, path } = await this.#getIdenticon({
      saveToDisk,
    });
    return {
      url,
      absolutePath: path ? getAbsoluteTempPath(path) : undefined,
    };
  }

  async #getTemporaryAvatarPath(): Promise<string | undefined> {
    const avatar = getAvatar(this.attributes);
    if (avatar?.path == null) {
      return undefined;
    }

    const avatarPath = getRawAvatarPath(this.attributes);
    if (!avatarPath) {
      return undefined;
    }

    // Already plaintext
    if (avatar.version !== 2) {
      return avatarPath;
    }

    if (!avatar.localKey || !avatar.size) {
      return undefined;
    }

    const { path: plaintextPath } = await decryptAttachmentV2({
      ciphertextPath: avatarPath,
      idForLogging: 'getAvatarOrIdenticon',
      keysBase64: avatar.localKey,
      size: avatar.size,

      getAbsoluteAttachmentPath,
      type: 'local',
    });

    try {
      const { path: tempPath } = await copyAttachmentIntoTempDirectory(
        getAbsoluteAttachmentPath(plaintextPath)
      );
      return getAbsoluteTempPath(tempPath);
    } finally {
      await deleteAttachmentData(plaintextPath);
    }
  }

  async #getIdenticon({ saveToDisk }: { saveToDisk?: boolean } = {}): Promise<{
    url: string;
    path?: string;
  }> {
    const isContact = isDirectConversation(this.attributes);
    const color = this.getColor();
    const title = this.getTitle();

    if (isContact) {
      const text = (title && getInitials(title)) || '#';

      const cached = this.#cachedIdenticon;
      if (cached && cached.text === text && cached.color === color) {
        return { ...cached };
      }

      const { url, path } = await createIdenticon(
        color,
        {
          type: 'contact',
          text,
        },
        {
          saveToDisk,
        }
      );

      this.#cachedIdenticon = { text, color, url, path };
      return { url, path };
    }

    const cached = this.#cachedIdenticon;
    if (cached && cached.color === color) {
      return { ...cached };
    }

    const { url, path } = await createIdenticon(
      color,
      { type: 'group' },
      {
        saveToDisk,
      }
    );

    this.#cachedIdenticon = { color, url, path };
    return { url, path };
  }

  notifyTyping(options: {
    isTyping: boolean;
    senderId: string;
    fromMe: boolean;
    senderDevice: number;
  }): void {
    const { isTyping, senderId, fromMe, senderDevice } = options;

    // We don't do anything with typing messages from our other devices
    if (fromMe) {
      return;
    }

    const sender = window.ConversationController.get(senderId);
    if (!sender) {
      return;
    }

    const senderServiceId = sender.getServiceId();
    if (!senderServiceId) {
      return;
    }

    // Drop typing indicators for announcement only groups where the sender
    // is not an admin
    if (this.get('announcementsOnly') && !this.isAdmin(senderServiceId)) {
      return;
    }

    const typingToken = `${sender.id}.${senderDevice}`;

    this.contactTypingTimers = this.contactTypingTimers || {};
    const record = this.contactTypingTimers[typingToken];

    if (record) {
      clearTimeout(record.timer);
    }

    if (isTyping) {
      this.contactTypingTimers[typingToken] = this.contactTypingTimers[
        typingToken
      ] || {
        timestamp: Date.now(),
        senderId,
        senderDevice,
      };

      this.contactTypingTimers[typingToken].timer = setTimeout(
        this.clearContactTypingTimer.bind(this, typingToken),
        15 * 1000
      );
      // User was not previously typing before. State change!
      if (!record) {
        window.ConversationController.conversationUpdated(
          this,
          this.attributes
        );
      }
    } else {
      delete this.contactTypingTimers[typingToken];
      if (record) {
        // User was previously typing, and is no longer. State change!
        window.ConversationController.conversationUpdated(
          this,
          this.attributes
        );
      }
    }
  }

  clearContactTypingTimer(typingToken: string): void {
    this.contactTypingTimers = this.contactTypingTimers || {};
    const record = this.contactTypingTimers[typingToken];

    if (record) {
      clearTimeout(record.timer);
      delete this.contactTypingTimers[typingToken];

      // User was previously typing, but timed out or we received message. State change!
      window.ConversationController.conversationUpdated(this, this.attributes);
    }
  }

  pin(): void {
    if (this.get('isPinned')) {
      return;
    }

    const validationErrorString = validateConversation(this.attributes);
    if (validationErrorString) {
      log.error(
        `not pinning ${this.idForLogging()} because of ` +
          `validation error ${validationErrorString}`
      );
      return;
    }

    log.info('pinning', this.idForLogging());
    const pinnedConversationIds = new Set(
      itemStorage.get('pinnedConversationIds', new Array<string>())
    );

    pinnedConversationIds.add(this.id);

    this.writePinnedConversations([...pinnedConversationIds]);

    this.set({ isPinned: true });

    if (this.get('isArchived')) {
      this.set({ isArchived: false });
    }
    drop(DataWriter.updateConversation(this.attributes));
  }

  unpin(): void {
    if (!this.get('isPinned')) {
      return;
    }

    log.info('un-pinning', this.idForLogging());

    const pinnedConversationIds = new Set(
      itemStorage.get('pinnedConversationIds', new Array<string>())
    );

    pinnedConversationIds.delete(this.id);

    this.writePinnedConversations([...pinnedConversationIds]);

    this.set({ isPinned: false });
    drop(DataWriter.updateConversation(this.attributes));
  }

  writePinnedConversations(pinnedConversationIds: Array<string>): void {
    drop(itemStorage.put('pinnedConversationIds', pinnedConversationIds));

    const myId = window.ConversationController.getOurConversationId();
    const me = window.ConversationController.get(myId);

    if (me) {
      me.captureChange('pin');
    }
  }

  setDontNotifyForMentionsIfMuted(newValue: boolean): void {
    const previousValue = Boolean(this.get('dontNotifyForMentionsIfMuted'));
    if (previousValue === newValue) {
      return;
    }

    this.set({ dontNotifyForMentionsIfMuted: newValue });
    drop(DataWriter.updateConversation(this.attributes));
    this.captureChange('dontNotifyForMentionsIfMuted');
  }

  acknowledgeGroupMemberNameCollisions(
    groupNameCollisions: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>
  ): void {
    this.set({ acknowledgedGroupNameCollisions: groupNameCollisions });
    drop(DataWriter.updateConversation(this.attributes));
  }

  onOpenStart(): void {
    log.info(`conversation ${this.idForLogging()} open start`);
    window.ConversationController.onConvoOpenStart(this.id);
  }

  onOpenComplete(startedAt: number): void {
    const now = Date.now();
    const delta = now - startedAt;

    log.info(`conversation ${this.idForLogging()} open took ${delta}ms`);
    window.SignalCI?.handleEvent('conversation:open', { delta });
  }

  async flushDebouncedUpdates(): Promise<void> {
    try {
      this.debouncedUpdateLastMessage.flush();
    } catch (error) {
      const logId = this.idForLogging();
      log.error(
        `flushDebouncedUpdates(${logId}): got error`,
        Errors.toLogFormat(error)
      );
    }
  }

  getPniSignatureMessage(): PniSignatureMessageType | undefined {
    if (!this.get('shareMyPhoneNumber')) {
      return undefined;
    }
    return signalProtocolStore.signAlternateIdentity();
  }

  /** @return only undefined if not a group */
  getStorySendMode(): StorySendMode | undefined {
    // isDirectConversation is used instead of isGroup because this is what
    // used in `format()` when sending conversation "type" to redux.
    if (isDirectConversation(this.attributes)) {
      return undefined;
    }

    return this.#getGroupStorySendMode();
  }

  #getGroupStorySendMode(): StorySendMode {
    strictAssert(
      !isDirectConversation(this.attributes),
      'Must be a group to have send story mode'
    );

    return this.get('storySendMode') ?? StorySendMode.IfActive;
  }

  async shutdownJobQueue(): Promise<void> {
    log.info(`conversation ${this.idForLogging()} jobQueue shutdown start`);

    if (!this.jobQueue) {
      log.info(`conversation ${this.idForLogging()} no jobQueue to shutdown`);
      return;
    }

    // If the queue takes more than 10 seconds to get to idle, we force it by setting
    // isShuttingDown = true which will reject incoming requests.
    const to = setTimeout(() => {
      log.warn(
        `conversation ${this.idForLogging()} jobQueue stop accepting new work`
      );
      this.#isShuttingDown = true;
    }, 10 * SECOND);

    await this.jobQueue.onIdle();
    this.#isShuttingDown = true;
    clearTimeout(to);

    log.info(`conversation ${this.idForLogging()} jobQueue shutdown complete`);
  }
}
