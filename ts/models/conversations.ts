// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { compact, has, isNumber, throttle, debounce } from 'lodash';
import { batch as batchDispatch } from 'react-redux';
import { v4 as generateGuid } from 'uuid';

import type {
  ConversationAttributesType,
  ConversationLastProfileType,
  LastMessageStatus,
  MessageAttributesType,
  QuotedMessageType,
  SenderKeyInfoType,
  VerificationOptions,
} from '../model-types.d';
import { getInitials } from '../util/getInitials';
import { normalizeUuid } from '../util/normalizeUuid';
import { getRegionCodeForNumber } from '../util/libphonenumberUtil';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import type { AttachmentType, ThumbnailType } from '../types/Attachment';
import { toDayMillis } from '../util/timestamp';
import { isGIF } from '../types/Attachment';
import type { CallHistoryDetailsType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import * as EmbeddedContact from '../types/EmbeddedContact';
import * as Conversation from '../types/Conversation';
import type { StickerType, StickerWithHydratedData } from '../types/Stickers';
import * as Stickers from '../types/Stickers';
import type {
  ContactWithHydratedAvatar,
  GroupV1InfoType,
  GroupV2InfoType,
} from '../textsecure/SendMessage';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import MessageSender from '../textsecure/SendMessage';
import type { CallbackResultType } from '../textsecure/Types.d';
import type { ConversationType } from '../state/ducks/conversations';
import type {
  AvatarColorType,
  ConversationColorType,
  CustomColorType,
} from '../types/Colors';
import type { MessageModel } from './messages';
import { getContact } from '../messages/helpers';
import { strictAssert } from '../util/assert';
import { isConversationMuted } from '../util/isConversationMuted';
import { isConversationSMSOnly } from '../util/isConversationSMSOnly';
import { isConversationUnregistered } from '../util/isConversationUnregistered';
import { missingCaseError } from '../util/missingCaseError';
import { sniffImageMimeType } from '../util/sniffImageMimeType';
import { isValidE164 } from '../util/isValidE164';
import type { MIMEType } from '../types/MIME';
import { IMAGE_JPEG, IMAGE_GIF, IMAGE_WEBP } from '../types/MIME';
import { UUID, UUIDKind } from '../types/UUID';
import type { UUIDStringType } from '../types/UUID';
import { deriveAccessKey, decryptProfileName, decryptProfile } from '../Crypto';
import * as Bytes from '../Bytes';
import type { BodyRangesType } from '../types/Util';
import { getTextWithMentions } from '../util/getTextWithMentions';
import { migrateColor } from '../util/migrateColor';
import { isNotNil } from '../util/isNotNil';
import { dropNull } from '../util/dropNull';
import { notificationService } from '../services/notifications';
import { getSendOptions } from '../util/getSendOptions';
import { isConversationAccepted } from '../util/isConversationAccepted';
import { markConversationRead } from '../util/markConversationRead';
import { handleMessageSend } from '../util/handleMessageSend';
import { getConversationMembers } from '../util/getConversationMembers';
import { updateConversationsWithUuidLookup } from '../updateConversationsWithUuidLookup';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SendStatus } from '../messages/MessageSendState';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import * as durations from '../util/durations';
import {
  concat,
  filter,
  map,
  take,
  repeat,
  zipObject,
  collect,
} from '../util/iterables';
import * as universalExpireTimer from '../util/universalExpireTimer';
import type { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import {
  isDirectConversation,
  isGroup,
  isGroupV1,
  isGroupV2,
  isMe,
} from '../util/whatTypeOfConversation';
import { SignalService as Proto } from '../protobuf';
import {
  getMessagePropStatus,
  hasErrors,
  isGiftBadge,
  isIncoming,
  isStory,
  isTapToView,
} from '../state/selectors/message';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../jobs/conversationJobQueue';
import { readReceiptsJobQueue } from '../jobs/readReceiptsJobQueue';
import type { ReactionModel } from '../messageModifiers/Reactions';
import { isAnnouncementGroupReady } from '../util/isAnnouncementGroupReady';
import { getProfile } from '../util/getProfile';
import { SEALED_SENDER } from '../types/SealedSender';
import { getAvatarData } from '../util/getAvatarData';
import { createIdenticon } from '../util/createIdenticon';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { isMessageUnread } from '../util/isMessageUnread';
import type { SenderKeyTargetType } from '../util/sendToGroup';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { TimelineMessageLoadingState } from '../util/timelineUtil';
import { SeenStatus } from '../MessageSeenStatus';
import { getConversationIdForLogging } from '../util/idForLogging';
import { getSendTarget } from '../util/getSendTarget';
import { getRecipients } from '../util/getRecipients';
import { validateConversation } from '../util/validateConversation';

/* eslint-disable more/no-then */
window.Whisper = window.Whisper || {};

const { Services, Util } = window.Signal;
const { Message } = window.Signal.Types;
const {
  deleteAttachmentData,
  doesAttachmentExist,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
  readStickerData,
  upgradeMessageSchema,
  writeNewAttachmentData,
} = window.Signal.Migrations;
const {
  addStickerPackReference,
  getConversationRangeCenteredOnMessage,
  getOlderMessagesByConversation,
  getMessageMetricsForConversation,
  getMessageById,
  getNewerMessagesByConversation,
} = window.Signal.Data;

const FIVE_MINUTES = durations.MINUTE * 5;

const JOB_REPORTING_THRESHOLD_MS = 25;
const SEND_REPORTING_THRESHOLD_MS = 25;

const MESSAGE_LOAD_CHUNK_SIZE = 30;

const ATTRIBUTES_THAT_DONT_INVALIDATE_PROPS_CACHE = new Set([
  'lastProfile',
  'profileLastFetchedAt',
  'needsStorageServiceSync',
  'storageID',
  'storageVersion',
  'storageUnknownFields',
]);

type CachedIdenticon = {
  readonly url: string;
  readonly content: string;
  readonly color: AvatarColorType;
};

export class ConversationModel extends window.Backbone
  .Model<ConversationAttributesType> {
  static COLORS: string;

  cachedProps?: ConversationType | null;

  oldCachedProps?: ConversationType | null;

  contactTypingTimers?: Record<
    string,
    { senderId: string; timer: NodeJS.Timer }
  >;

  contactCollection?: Backbone.Collection<ConversationModel>;

  debouncedUpdateLastMessage?: (() => void) & { flush(): void };

  initialPromise?: Promise<unknown>;

  inProgressFetch?: Promise<unknown>;

  newMessageQueue?: typeof window.PQueueType;

  jobQueue?: typeof window.PQueueType;

  storeName?: string | null;

  throttledBumpTyping?: () => void;

  throttledFetchSMSOnlyUUID?: () => Promise<void> | void;

  throttledMaybeMigrateV1Group?: () => Promise<void> | void;

  throttledGetProfiles?: () => Promise<void>;

  typingRefreshTimer?: NodeJS.Timer | null;

  typingPauseTimer?: NodeJS.Timer | null;

  verifiedEnum?: typeof window.textsecure.storage.protocol.VerifiedStatus;

  intlCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

  lastSuccessfulGroupFetch?: number;

  throttledUpdateSharedGroups?: () => Promise<void>;

  private cachedLatestGroupCallEraId?: string;

  private cachedIdenticon?: CachedIdenticon;

  private isFetchingUUID?: boolean;

  private lastIsTyping?: boolean;

  private muteTimer?: NodeJS.Timer;

  private isInReduxBatch = false;

  override defaults(): Partial<ConversationAttributesType> {
    return {
      unreadCount: 0,
      verified: window.textsecure.storage.protocol.VerifiedStatus.DEFAULT,
      messageCount: 0,
      sentMessageCount: 0,
    };
  }

  idForLogging(): string {
    return getConversationIdForLogging(this.attributes);
  }

  // This is one of the few times that we want to collapse our uuid/e164 pair down into
  //   just one bit of data. If we have a UUID, we'll send using it.
  getSendTarget(): string | undefined {
    return getSendTarget(this.attributes);
  }

  getContactCollection(): Backbone.Collection<ConversationModel> {
    const collection = new window.Backbone.Collection<ConversationModel>();
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    collection.comparator = (
      left: ConversationModel,
      right: ConversationModel
    ) => {
      return collator.compare(left.getTitle(), right.getTitle());
    };
    return collection;
  }

  override initialize(
    attributes: Partial<ConversationAttributesType> = {}
  ): void {
    const uuid = this.get('uuid');
    const normalizedUuid =
      uuid && normalizeUuid(uuid, 'ConversationModel.initialize');
    if (uuid && normalizedUuid !== uuid) {
      log.warn(
        'ConversationModel.initialize: normalizing uuid from ' +
          `${uuid} to ${normalizedUuid}`
      );
      this.set('uuid', normalizedUuid);
    }

    if (isValidE164(attributes.id, false)) {
      this.set({ id: UUID.generate().toString(), e164: attributes.id });
    }

    this.storeName = 'conversations';

    this.verifiedEnum = window.textsecure.storage.protocol.VerifiedStatus;

    // This may be overridden by window.ConversationController.getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();

    this.throttledBumpTyping = throttle(this.bumpTyping, 300);
    this.debouncedUpdateLastMessage = debounce(
      this.updateLastMessage.bind(this),
      200
    );
    this.throttledUpdateSharedGroups =
      this.throttledUpdateSharedGroups ||
      throttle(this.updateSharedGroups.bind(this), FIVE_MINUTES);

    this.contactCollection = this.getContactCollection();
    this.contactCollection.on(
      'change:name change:profileName change:profileFamilyName change:e164',
      this.debouncedUpdateLastMessage,
      this
    );
    if (!isDirectConversation(this.attributes)) {
      this.contactCollection.on(
        'change:verified',
        this.onMemberVerifiedChange.bind(this)
      );
    }

    this.on('newmessage', this.onNewMessage);
    this.on('change:profileKey', this.onChangeProfileKey);

    const sealedSender = this.get('sealedSender');
    if (sealedSender === undefined) {
      this.set({ sealedSender: SEALED_SENDER.UNKNOWN });
    }
    this.unset('unidentifiedDelivery');
    this.unset('unidentifiedDeliveryUnrestricted');
    this.unset('hasFetchedProfile');
    this.unset('tokens');

    this.on('change:members change:membersV2', this.fetchContacts);

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;

    // We clear our cached props whenever we change so that the next call to format() will
    //   result in refresh via a getProps() call. See format() below.
    this.on(
      'change',
      (_model: MessageModel, options: { force?: boolean } = {}) => {
        const changedKeys = Object.keys(this.changed || {});
        const isPropsCacheStillValid =
          !options.force &&
          Boolean(
            changedKeys.length &&
              changedKeys.every(key =>
                ATTRIBUTES_THAT_DONT_INVALIDATE_PROPS_CACHE.has(key)
              )
          );
        if (isPropsCacheStillValid) {
          return;
        }

        if (this.cachedProps) {
          this.oldCachedProps = this.cachedProps;
        }
        this.cachedProps = null;
        this.trigger('props-change', this, this.isInReduxBatch);
      }
    );

    // Set `isFetchingUUID` eagerly to avoid UI flicker when opening the
    // conversation for the first time.
    this.isFetchingUUID = this.isSMSOnly();

    this.throttledFetchSMSOnlyUUID = throttle(
      this.fetchSMSOnlyUUID.bind(this),
      FIVE_MINUTES
    );
    this.throttledMaybeMigrateV1Group = throttle(
      this.maybeMigrateV1Group.bind(this),
      FIVE_MINUTES
    );

    const migratedColor = this.getColor();
    if (this.get('color') !== migratedColor) {
      this.set('color', migratedColor);
      // Not saving the conversation here we're hoping it'll be saved elsewhere
      // this may cause some color thrashing if Signal is restarted without
      // the convo saving. If that is indeed the case and it's too disruptive
      // we should add batched saving.
    }
  }

  toSenderKeyTarget(): SenderKeyTargetType {
    return {
      getGroupId: () => this.get('groupId'),
      getMembers: () => this.getMembers(),
      hasMember: (uuid: UUIDStringType) => this.hasMember(new UUID(uuid)),
      idForLogging: () => this.idForLogging(),
      isGroupV2: () => isGroupV2(this.attributes),
      isValid: () => isGroupV2(this.attributes),

      getSenderKeyInfo: () => this.get('senderKeyInfo'),
      saveSenderKeyInfo: async (senderKeyInfo: SenderKeyInfoType) => {
        this.set({ senderKeyInfo });
        window.Signal.Data.updateConversation(this.attributes);
      },
    };
  }

  private isMemberRequestingToJoin(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingAdminApprovalV2 = this.get('pendingAdminApprovalV2');

    if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
      return false;
    }

    return pendingAdminApprovalV2.some(item => item.uuid === uuid.toString());
  }

  isMemberPending(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingMembersV2 = this.get('pendingMembersV2');

    if (!pendingMembersV2 || !pendingMembersV2.length) {
      return false;
    }

    return pendingMembersV2.some(item => item.uuid === uuid.toString());
  }

  private isMemberBanned(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const bannedMembersV2 = this.get('bannedMembersV2');

    if (!bannedMembersV2 || !bannedMembersV2.length) {
      return false;
    }

    return bannedMembersV2.some(member => member.uuid === uuid.toString());
  }

  isMemberAwaitingApproval(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingAdminApprovalV2 = this.get('pendingAdminApprovalV2');

    if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
      return false;
    }

    return pendingAdminApprovalV2.some(
      member => member.uuid === uuid.toString()
    );
  }

  isMember(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const membersV2 = this.get('membersV2');

    if (!membersV2 || !membersV2.length) {
      return false;
    }

    return window._.any(membersV2, item => item.uuid === uuid.toString());
  }

  async updateExpirationTimerInGroupV2(
    seconds?: number
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

    return window.Signal.Groups.buildDisappearingMessagesTimerChange({
      expireTimer: seconds || 0,
      group: this.attributes,
    });
  }

  private async promotePendingMember(
    uuidKind: UUIDKind
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const us = window.ConversationController.getOurConversationOrThrow();
    const uuid = window.storage.user.getCheckedUuid(uuidKind);

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberPending(uuid)) {
      log.warn(
        `promotePendingMember/${idLog}: we are not a pending member of group. Returning early.`
      );
      return undefined;
    }

    // We need the user's profileKeyCredential, which requires a roundtrip with the
    //   server, and most definitely their profileKey. A getProfiles() call will
    //   ensure that we have as much as we can get with the data we have.
    if (uuidKind === UUIDKind.ACI) {
      if (!us.get('profileKeyCredential')) {
        await us.getProfiles();
      }

      const profileKeyCredentialBase64 = us.get('profileKeyCredential');
      strictAssert(
        profileKeyCredentialBase64,
        'Must have profileKeyCredential'
      );

      return window.Signal.Groups.buildPromoteMemberChange({
        group: this.attributes,
        profileKeyCredentialBase64,
        serverPublicParamsBase64: window.getServerPublicParams(),
      });
    }

    strictAssert(uuidKind === UUIDKind.PNI, 'Must be a PNI promotion');

    // Similarly we need `pniCredential` even if this would require a server
    // roundtrip.
    if (!us.get('pniCredential')) {
      await us.getProfiles();
    }
    const pniCredentialBase64 = us.get('pniCredential');
    strictAssert(pniCredentialBase64, 'Must have pniCredential');

    return window.Signal.Groups.buildPromoteMemberChange({
      group: this.attributes,
      pniCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  private async approvePendingApprovalRequest(
    uuid: UUID
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberRequestingToJoin(uuid)) {
      log.warn(
        `approvePendingApprovalRequest/${idLog}: ${uuid} is not requesting ` +
          'to join the group. Returning early.'
      );
      return undefined;
    }

    return window.Signal.Groups.buildPromotePendingAdminApprovalMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  private async denyPendingApprovalRequest(
    uuid: UUID
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberRequestingToJoin(uuid)) {
      log.warn(
        `denyPendingApprovalRequest/${idLog}: ${uuid} is not requesting ` +
          'to join the group. Returning early.'
      );
      return undefined;
    }

    const ourUuid = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);

    return window.Signal.Groups.buildDeletePendingAdminApprovalMemberChange({
      group: this.attributes,
      ourUuid,
      uuid,
    });
  }

  async addPendingApprovalRequest(): Promise<
    Proto.GroupChange.Actions | undefined
  > {
    const idLog = this.idForLogging();

    // Hard-coded to our own ID, because you don't add other users for admin approval
    const conversationId =
      window.ConversationController.getOurConversationIdOrThrow();

    const toRequest = window.ConversationController.get(conversationId);
    if (!toRequest) {
      throw new Error(
        `addPendingApprovalRequest/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = toRequest.getCheckedUuid(`addPendingApprovalRequest/${idLog}`);

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
    if (this.isMemberAwaitingApproval(uuid)) {
      log.warn(
        `addPendingApprovalRequest/${idLog}: ` +
          `${toRequest.idForLogging()} already in pending approval.`
      );
      return undefined;
    }

    return window.Signal.Groups.buildAddPendingAdminApprovalMemberChange({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async addMember(uuid: UUID): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const toRequest = window.ConversationController.get(uuid.toString());
    if (!toRequest) {
      throw new Error(`addMember/${idLog}: No conversation found for ${uuid}`);
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
    if (this.isMember(uuid)) {
      log.warn(
        `addMember/${idLog}: ${toRequest.idForLogging()} ` +
          'is already a member.'
      );
      return undefined;
    }

    return window.Signal.Groups.buildAddMember({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
      uuid,
    });
  }

  private async removePendingMember(
    uuids: ReadonlyArray<UUID>
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const pendingUuids = uuids
      .map(uuid => {
        // This user's pending state may have changed in the time between the user's
        //   button press and when we get here. It's especially important to check here
        //   in conflict/retry cases.
        if (!this.isMemberPending(uuid)) {
          log.warn(
            `removePendingMember/${idLog}: ${uuid} is not a pending member of group. Returning early.`
          );
          return undefined;
        }

        return uuid;
      })
      .filter(isNotNil);

    if (!uuids.length) {
      return undefined;
    }

    return window.Signal.Groups.buildDeletePendingMemberChange({
      group: this.attributes,
      uuids: pendingUuids,
    });
  }

  private async removeMember(
    uuid: UUID
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMember(uuid)) {
      log.warn(
        `removeMember/${idLog}: ${uuid} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const ourUuid = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);

    return window.Signal.Groups.buildDeleteMemberChange({
      group: this.attributes,
      ourUuid,
      uuid,
    });
  }

  private async toggleAdminChange(
    uuid: UUID
  ): Promise<Proto.GroupChange.Actions | undefined> {
    if (!isGroupV2(this.attributes)) {
      return undefined;
    }

    const idLog = this.idForLogging();

    if (!this.isMember(uuid)) {
      log.warn(
        `toggleAdminChange/${idLog}: ${uuid} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const MEMBER_ROLES = Proto.Member.Role;

    const role = this.isAdmin(uuid)
      ? MEMBER_ROLES.DEFAULT
      : MEMBER_ROLES.ADMINISTRATOR;

    return window.Signal.Groups.buildModifyMemberRoleChange({
      group: this.attributes,
      uuid,
      role,
    });
  }

  async modifyGroupV2({
    usingCredentialsFrom,
    createGroupChange,
    extraConversationsForSend,
    inviteLinkPassword,
    name,
  }: {
    usingCredentialsFrom: ReadonlyArray<ConversationModel>;
    createGroupChange: () => Promise<Proto.GroupChange.Actions | undefined>;
    extraConversationsForSend?: Array<string>;
    inviteLinkPassword?: string;
    name: string;
  }): Promise<void> {
    await window.Signal.Groups.modifyGroupV2({
      conversation: this,
      usingCredentialsFrom,
      createGroupChange,
      extraConversationsForSend,
      inviteLinkPassword,
      name,
    });
  }

  isEverUnregistered(): boolean {
    return Boolean(this.get('discoveredUnregisteredAt'));
  }

  isUnregistered(): boolean {
    return isConversationUnregistered(this.attributes);
  }

  isSMSOnly(): boolean {
    return isConversationSMSOnly({
      ...this.attributes,
      type: isDirectConversation(this.attributes) ? 'direct' : 'unknown',
    });
  }

  setUnregistered(): void {
    log.info(`Conversation ${this.idForLogging()} is now unregistered`);
    this.set({
      discoveredUnregisteredAt: Date.now(),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  setRegistered(): void {
    if (this.get('discoveredUnregisteredAt') === undefined) {
      return;
    }

    log.info(`Conversation ${this.idForLogging()} is registered once again`);
    this.set({
      discoveredUnregisteredAt: undefined,
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  isGroupV1AndDisabled(): boolean {
    return isGroupV1(this.attributes);
  }

  isBlocked(): boolean {
    const uuid = this.get('uuid');
    if (uuid) {
      return window.storage.blocked.isUuidBlocked(uuid);
    }

    const e164 = this.get('e164');
    if (e164) {
      return window.storage.blocked.isBlocked(e164);
    }

    const groupId = this.get('groupId');
    if (groupId) {
      return window.storage.blocked.isGroupBlocked(groupId);
    }

    return false;
  }

  block({ viaStorageServiceSync = false } = {}): void {
    let blocked = false;
    const wasBlocked = this.isBlocked();

    const uuid = this.get('uuid');
    if (uuid) {
      window.storage.blocked.addBlockedUuid(uuid);
      blocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      window.storage.blocked.addBlockedNumber(e164);
      blocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      window.storage.blocked.addBlockedGroup(groupId);
      blocked = true;
    }

    if (blocked && !wasBlocked) {
      // We need to force a props refresh - blocked state is not in backbone attributes
      this.trigger('change', this, { force: true });

      if (!viaStorageServiceSync) {
        this.captureChange('block');
      }
    }
  }

  unblock({ viaStorageServiceSync = false } = {}): boolean {
    let unblocked = false;
    const wasBlocked = this.isBlocked();

    const uuid = this.get('uuid');
    if (uuid) {
      window.storage.blocked.removeBlockedUuid(uuid);
      unblocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      window.storage.blocked.removeBlockedNumber(e164);
      unblocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      window.storage.blocked.removeBlockedGroup(groupId);
      unblocked = true;
    }

    if (unblocked && wasBlocked) {
      // We need to force a props refresh - blocked state is not in backbone attributes
      this.trigger('change', this, { force: true });

      if (!viaStorageServiceSync) {
        this.captureChange('unblock');
      }

      this.fetchLatestGroupV2Data({ force: true });
    }

    return unblocked;
  }

  enableProfileSharing({ viaStorageServiceSync = false } = {}): void {
    log.info(
      `enableProfileSharing: ${this.idForLogging()} storage? ${viaStorageServiceSync}`
    );
    const before = this.get('profileSharing');

    this.set({ profileSharing: true });

    const after = this.get('profileSharing');

    if (!viaStorageServiceSync && Boolean(before) !== Boolean(after)) {
      this.captureChange('enableProfileSharing');
    }
  }

  disableProfileSharing({ viaStorageServiceSync = false } = {}): void {
    log.info(
      `disableProfileSharing: ${this.idForLogging()} storage? ${viaStorageServiceSync}`
    );
    const before = this.get('profileSharing');

    this.set({ profileSharing: false });

    const after = this.get('profileSharing');

    if (!viaStorageServiceSync && Boolean(before) !== Boolean(after)) {
      this.captureChange('disableProfileSharing');
    }
  }

  hasDraft(): boolean {
    const draftAttachments = this.get('draftAttachments') || [];
    return (this.get('draft') ||
      this.get('quotedMessageId') ||
      draftAttachments.length > 0) as boolean;
  }

  getDraftPreview(): string {
    const draft = this.get('draft');

    if (draft) {
      const bodyRanges = this.get('draftBodyRanges') || [];

      return getTextWithMentions(bodyRanges, draft);
    }

    const draftAttachments = this.get('draftAttachments') || [];
    if (draftAttachments.length > 0) {
      return window.i18n('Conversation--getDraftPreview--attachment');
    }

    const quotedMessageId = this.get('quotedMessageId');
    if (quotedMessageId) {
      return window.i18n('Conversation--getDraftPreview--quote');
    }

    return window.i18n('Conversation--getDraftPreview--draft');
  }

  bumpTyping(): void {
    // We don't send typing messages if the setting is disabled
    if (!window.Events.getTypingIndicatorSetting()) {
      return;
    }

    if (!this.typingRefreshTimer) {
      const isTyping = true;
      this.setTypingRefreshTimer();
      this.sendTypingMessage(isTyping);
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
    this.sendTypingMessage(isTyping);

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
    this.sendTypingMessage(isTyping);

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
      return;
    }

    await window.Signal.Groups.waitThenMaybeUpdateGroup({
      force: options.force,
      conversation: this,
    });
  }

  async fetchSMSOnlyUUID(): Promise<void> {
    const { messaging } = window.textsecure;
    if (!messaging) {
      return;
    }
    if (!this.isSMSOnly()) {
      return;
    }

    log.info(
      `Fetching uuid for a sms-only conversation ${this.idForLogging()}`
    );

    this.isFetchingUUID = true;
    this.trigger('change', this, { force: true });

    try {
      // Attempt to fetch UUID
      await updateConversationsWithUuidLookup({
        conversationController: window.ConversationController,
        conversations: [this],
        messaging,
      });
    } finally {
      // No redux update here
      this.isFetchingUUID = false;
      this.trigger('change', this, { force: true });

      log.info(
        `Done fetching uuid for a sms-only conversation ${this.idForLogging()}`
      );
    }

    if (!this.get('uuid')) {
      return;
    }

    // On successful fetch - mark contact as registered.
    this.setRegistered();
  }

  override isValid(): boolean {
    return (
      isDirectConversation(this.attributes) ||
      isGroupV1(this.attributes) ||
      isGroupV2(this.attributes)
    );
  }

  async maybeMigrateV1Group(): Promise<void> {
    if (!isGroupV1(this.attributes)) {
      return;
    }

    const isMigrated = await window.Signal.Groups.hasV1GroupBeenMigrated(this);
    if (!isMigrated) {
      return;
    }

    await window.Signal.Groups.waitThenRespondToGroupV2Migration({
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

    window.Signal.Data.updateConversation(this.attributes);
  }

  getGroupV2Info(
    options: Readonly<
      { groupChange?: Uint8Array } & (
        | {
            includePendingMembers?: boolean;
            extraConversationsForSend?: Array<string>;
          }
        | { members: Array<string> }
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

  getGroupV1Info(members?: Array<string>): GroupV1InfoType | undefined {
    const groupId = this.get('groupId');
    const groupVersion = this.get('groupVersion');

    if (
      isDirectConversation(this.attributes) ||
      !groupId ||
      (groupVersion && groupVersion > 0)
    ) {
      return undefined;
    }

    return {
      id: groupId,
      members: members || this.getRecipients(),
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
    const { messaging } = window.textsecure;

    if (!messaging) {
      return;
    }

    // We don't send typing messages to our other devices
    if (isMe(this.attributes)) {
      return;
    }

    // Coalesce multiple sendTypingMessage calls into one.
    //
    // `lastIsTyping` is set to the last `isTyping` value passed to the
    // `sendTypingMessage`. The first 'sendTypingMessage' job to run will
    // pick it and reset it back to `undefined` so that later jobs will
    // in effect be ignored.
    this.lastIsTyping = isTyping;

    await this.queueJob('sendTypingMessage', async () => {
      const groupMembers = this.getRecipients();

      // We don't send typing messages if our recipients list is empty
      if (!isDirectConversation(this.attributes) && !groupMembers.length) {
        return;
      }

      if (this.lastIsTyping === undefined) {
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
        isTyping: this.lastIsTyping,
        timestamp,
      };
      this.lastIsTyping = undefined;

      log.info(
        `sendTypingMessage(${this.idForLogging()}): sending ${content.isTyping}`
      );

      const contentMessage = messaging.getTypingContentMessage(content);

      const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

      const sendOptions = {
        ...(await getSendOptions(this.attributes)),
        online: true,
      };
      if (isDirectConversation(this.attributes)) {
        await handleMessageSend(
          messaging.sendMessageProtoAndWait({
            contentHint: ContentHint.IMPLICIT,
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
          window.Signal.Util.sendContentMessageToGroup({
            contentHint: ContentHint.IMPLICIT,
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
    const uuid = message.get('sourceUuid');
    const e164 = message.get('source');
    const sourceDevice = message.get('sourceDevice');

    const source = window.ConversationController.lookupOrCreate({
      uuid,
      e164,
    });
    const typingToken = `${source?.id}.${sourceDevice}`;

    // Clear typing indicator for a given contact if we receive a message from them
    this.clearContactTypingTimer(typingToken);

    // If it's a group story reply or a story message, we don't want to update
    // the last message or add new messages to redux.
    const isGroupStoryReply =
      isGroup(this.attributes) && message.get('storyId');
    if (isGroupStoryReply || isStory(message.attributes)) {
      return;
    }

    this.addSingleMessage(message);
  }

  // New messages might arrive while we're in the middle of a bulk fetch from the
  //   database. We'll wait until that is done before moving forward.
  async addSingleMessage(
    message: MessageModel,
    { isJustSent }: { isJustSent: boolean } = { isJustSent: false }
  ): Promise<void> {
    await this.beforeAddSingleMessage();
    this.doAddSingleMessage(message, { isJustSent });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.debouncedUpdateLastMessage!();
  }

  private async beforeAddSingleMessage(): Promise<void> {
    if (!this.newMessageQueue) {
      this.newMessageQueue = new window.PQueue({
        concurrency: 1,
        timeout: durations.MINUTE * 30,
      });
    }

    // We use a queue here to ensure messages are added to the UI in the order received
    await this.newMessageQueue.add(async () => {
      await this.inProgressFetch;
    });
  }

  private doAddSingleMessage(
    message: MessageModel,
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
      this.loadNewestMessages(undefined, undefined);
    } else {
      messagesAdded({
        conversationId,
        messages: [{ ...message.attributes }],
        isActive: window.SignalContext.activeWindowService.isActive(),
        isJustSent,
        isNewMessage: true,
      });
    }
  }

  setInProgressFetch(): () => unknown {
    let resolvePromise: (value?: unknown) => void;
    this.inProgressFetch = new Promise(resolve => {
      resolvePromise = resolve;
    });

    const finish = () => {
      resolvePromise();
      this.inProgressFetch = undefined;
    };

    return finish;
  }

  async loadNewestMessages(
    newestMessageId: string | undefined,
    setFocus: boolean | undefined
  ): Promise<void> {
    const { messagesReset, setMessageLoadingState } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.DoingInitialLoad
    );
    const finish = this.setInProgressFetch();

    try {
      let scrollToLatestUnread = true;

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

      const metrics = await getMessageMetricsForConversation(
        conversationId,
        undefined,
        isGroup(this.attributes)
      );

      // If this is a message request that has not yet been accepted, we always show the
      //   oldest messages, to ensure that the ConversationHero is shown. We don't want to
      //   scroll directly to the oldest message, because that could scroll the hero off
      //   the screen.
      if (!newestMessageId && !this.getAccepted() && metrics.oldest) {
        this.loadAndScroll(metrics.oldest.id, { disableScroll: true });
        return;
      }

      if (scrollToLatestUnread && metrics.oldestUnseen) {
        this.loadAndScroll(metrics.oldestUnseen.id, {
          disableScroll: !setFocus,
        });
        return;
      }

      const messages = await getOlderMessagesByConversation(conversationId, {
        isGroup: isGroup(this.attributes),
        limit: MESSAGE_LOAD_CHUNK_SIZE,
        storyId: undefined,
      });

      const cleaned: Array<MessageModel> = await this.cleanModels(messages);
      const scrollToMessageId =
        setFocus && metrics.newest ? metrics.newest.id : undefined;

      // Because our `getOlderMessages` fetch above didn't specify a receivedAt, we got
      //   the most recent N messages in the conversation. If it has a conflict with
      //   metrics, fetched a bit before, that's likely a race condition. So we tell our
      //   reducer to trust the message set we just fetched for determining if we have
      //   the newest message loaded.
      const unboundedFetch = true;
      messagesReset({
        conversationId,
        messages: cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
        metrics,
        scrollToMessageId,
        unboundedFetch,
      });
    } catch (error) {
      setMessageLoadingState(conversationId, undefined);
      throw error;
    } finally {
      finish();
    }
  }
  async loadOlderMessages(oldestMessageId: string): Promise<void> {
    const { messagesAdded, setMessageLoadingState, repairOldestMessage } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.LoadingOlderMessages
    );
    const finish = this.setInProgressFetch();

    try {
      const message = await getMessageById(oldestMessageId);
      if (!message) {
        throw new Error(
          `loadOlderMessages: failed to load message ${oldestMessageId}`
        );
      }

      const receivedAt = message.received_at;
      const sentAt = message.sent_at;
      const models = await getOlderMessagesByConversation(conversationId, {
        isGroup: isGroup(this.attributes),
        limit: MESSAGE_LOAD_CHUNK_SIZE,
        messageId: oldestMessageId,
        receivedAt,
        sentAt,
        storyId: undefined,
      });

      if (models.length < 1) {
        log.warn('loadOlderMessages: requested, but loaded no messages');
        repairOldestMessage(conversationId);
        return;
      }

      const cleaned = await this.cleanModels(models);

      messagesAdded({
        conversationId,
        messages: cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
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
    const finish = this.setInProgressFetch();

    try {
      const message = await getMessageById(newestMessageId);
      if (!message) {
        throw new Error(
          `loadNewerMessages: failed to load message ${newestMessageId}`
        );
      }

      const receivedAt = message.received_at;
      const sentAt = message.sent_at;
      const models = await getNewerMessagesByConversation(conversationId, {
        isGroup: isGroup(this.attributes),
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

      const cleaned = await this.cleanModels(models);
      messagesAdded({
        conversationId,
        messages: cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
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
    options?: { disableScroll?: boolean }
  ): Promise<void> {
    const { messagesReset, setMessageLoadingState } =
      window.reduxActions.conversations;
    const conversationId = this.id;

    setMessageLoadingState(
      conversationId,
      TimelineMessageLoadingState.DoingInitialLoad
    );
    const finish = this.setInProgressFetch();

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
          isGroup: isGroup(this.attributes),
          limit: MESSAGE_LOAD_CHUNK_SIZE,
          messageId,
          receivedAt,
          sentAt,
          storyId: undefined,
        });
      const all = [...older, message, ...newer];

      const cleaned: Array<MessageModel> = await this.cleanModels(all);
      const scrollToMessageId =
        options && options.disableScroll ? undefined : messageId;

      messagesReset({
        conversationId,
        messages: cleaned.map((messageModel: MessageModel) => ({
          ...messageModel.attributes,
        })),
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

  async cleanModels(
    messages: ReadonlyArray<MessageAttributesType>
  ): Promise<Array<MessageModel>> {
    const result = messages
      .filter(message => Boolean(message.id))
      .map(message => window.MessageController.register(message.id, message));

    const eliminated = messages.length - result.length;
    if (eliminated > 0) {
      log.warn(`cleanModels: Eliminated ${eliminated} messages without an id`);
    }
    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();

    let upgraded = 0;
    for (let max = result.length, i = 0; i < max; i += 1) {
      const message = result[i];
      const { attributes } = message;
      const { schemaVersion } = attributes;

      if (schemaVersion < Message.VERSION_NEEDED_FOR_DISPLAY) {
        // Yep, we really do want to wait for each of these
        // eslint-disable-next-line no-await-in-loop
        const upgradedMessage = await upgradeMessageSchema(attributes);
        message.set(upgradedMessage);
        // eslint-disable-next-line no-await-in-loop
        await window.Signal.Data.saveMessage(upgradedMessage, { ourUuid });
        upgraded += 1;
      }
    }
    if (upgraded > 0) {
      log.warn(`cleanModels: Upgraded schema of ${upgraded} messages`);
    }

    await Promise.all(result.map(model => model.hydrateStoryContext()));

    return result;
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
      this.cachedProps = this.getProps();
      return this.cachedProps;
    } finally {
      this.format = oldFormat;
    }
  }

  // Note: this should never be called directly. Use conversation.format() instead, which
  //   maintains a cache, and protects against reentrant calls.
  // Note: When writing code inside this function, do not call .format() on a conversation
  //   unless you are sure that it's not this very same conversation.
  // Note: If you start relying on an attribute that is in
  //   `ATTRIBUTES_THAT_DONT_INVALIDATE_PROPS_CACHE`, remove it from that list.
  private getProps(): ConversationType {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const color = this.getColor()!;

    let lastMessage:
      | undefined
      | {
          status?: LastMessageStatus;
          text: string;
          deletedForEveryone: false;
        }
      | { deletedForEveryone: true };

    if (this.get('lastMessageDeletedForEveryone')) {
      lastMessage = { deletedForEveryone: true };
    } else {
      const lastMessageText = this.get('lastMessage');
      if (lastMessageText) {
        lastMessage = {
          status: dropNull(this.get('lastMessageStatus')),
          text: lastMessageText,
          deletedForEveryone: false,
        };
      }
    }

    const typingValues = window._.values(this.contactTypingTimers || {});
    const typingMostRecent = window._.first(
      window._.sortBy(typingValues, 'timestamp')
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const timestamp = this.get('timestamp')!;
    const draftTimestamp = this.get('draftTimestamp');
    const draftPreview = this.getDraftPreview();
    const draftText = this.get('draft');
    const draftBodyRanges = this.get('draftBodyRanges');
    const shouldShowDraft = (this.hasDraft() &&
      draftTimestamp &&
      draftTimestamp >= timestamp) as boolean;
    const inboxPosition = this.get('inbox_position');
    const messageRequestsEnabled = window.Signal.RemoteConfig.isEnabled(
      'desktop.messageRequests'
    );
    const ourConversationId =
      window.ConversationController.getOurConversationId();

    let groupVersion: undefined | 1 | 2;
    if (isGroupV1(this.attributes)) {
      groupVersion = 1;
    } else if (isGroupV2(this.attributes)) {
      groupVersion = 2;
    }

    const sortedGroupMembers = isGroupV2(this.attributes)
      ? this.getMembers()
          .sort((left, right) =>
            sortConversationTitles(left, right, this.intlCollator)
          )
          .map(member => member.format())
          .filter(isNotNil)
      : undefined;

    const { customColor, customColorId } = this.getCustomColorData();

    const ourACI = window.textsecure.storage.user.getUuid(UUIDKind.ACI);
    const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);

    // TODO: DESKTOP-720
    return {
      id: this.id,
      uuid: this.get('uuid'),
      e164: this.get('e164'),

      // We had previously stored `null` instead of `undefined` in some cases. We should
      //   be able to remove this `dropNull` once usernames have gone to production.
      username: dropNull(this.get('username')),

      about: this.getAboutText(),
      aboutText: this.get('about'),
      aboutEmoji: this.get('aboutEmoji'),
      acceptedMessageRequest: this.getAccepted(),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activeAt: this.get('active_at')!,
      areWePending:
        ourACI &&
        (this.isMemberPending(ourACI) ||
          Boolean(
            ourPNI && !this.isMember(ourACI) && this.isMemberPending(ourPNI)
          )),
      areWePendingApproval: Boolean(
        ourConversationId && ourACI && this.isMemberAwaitingApproval(ourACI)
      ),
      areWeAdmin: this.areWeAdmin(),
      avatars: getAvatarData(this.attributes),
      badges: this.get('badges') || [],
      canChangeTimer: this.canChangeTimer(),
      canEditGroupInfo: this.canEditGroupInfo(),
      avatarPath: this.getAbsoluteAvatarPath(),
      avatarHash: this.getAvatarHash(),
      unblurredAvatarPath: this.getAbsoluteUnblurredAvatarPath(),
      profileAvatarPath: this.getAbsoluteProfileAvatarPath(),
      color,
      conversationColor: this.getConversationColor(),
      customColor,
      customColorId,
      discoveredUnregisteredAt: this.get('discoveredUnregisteredAt'),
      draftBodyRanges,
      draftPreview,
      draftText,
      familyName: this.get('profileFamilyName'),
      firstName: this.get('profileName'),
      groupDescription: this.get('description'),
      groupVersion,
      groupId: this.get('groupId'),
      groupLink: this.getGroupLink(),
      isGroupStorySendReady: Boolean(this.get('isGroupStorySendReady')),
      hideStory: Boolean(this.get('hideStory')),
      inboxPosition,
      isArchived: this.get('isArchived'),
      isBlocked: this.isBlocked(),
      isMe: isMe(this.attributes),
      isGroupV1AndDisabled: this.isGroupV1AndDisabled(),
      isPinned: this.get('isPinned'),
      isUntrusted: this.isUntrusted(),
      isVerified: this.isVerified(),
      isFetchingUUID: this.isFetchingUUID,
      lastMessage,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      lastUpdated: this.get('timestamp')!,
      left: Boolean(this.get('left')),
      markedUnread: this.get('markedUnread'),
      membersCount: this.getMembersCount(),
      memberships: this.getMemberships(),
      messageCount: this.get('messageCount') || 0,
      pendingMemberships: this.getPendingMemberships(),
      pendingApprovalMemberships: this.getPendingApprovalMemberships(),
      bannedMemberships: this.getBannedMemberships(),
      profileKey: this.get('profileKey'),
      messageRequestsEnabled,
      accessControlAddFromInviteLink:
        this.get('accessControl')?.addFromInviteLink,
      accessControlAttributes: this.get('accessControl')?.attributes,
      accessControlMembers: this.get('accessControl')?.members,
      announcementsOnly: Boolean(this.get('announcementsOnly')),
      announcementsOnlyReady: this.canBeAnnouncementGroup(),
      expireTimer: this.get('expireTimer'),
      muteExpiresAt: this.get('muteExpiresAt'),
      dontNotifyForMentionsIfMuted: this.get('dontNotifyForMentionsIfMuted'),
      name: this.get('name'),
      phoneNumber: this.getNumber(),
      profileName: this.getProfileName(),
      profileSharing: this.get('profileSharing'),
      publicParams: this.get('publicParams'),
      secretParams: this.get('secretParams'),
      shouldShowDraft,
      sortedGroupMembers,
      timestamp,
      title: this.getTitle(),
      typingContactId: typingMostRecent?.senderId,
      searchableTitle: isMe(this.attributes)
        ? window.i18n('noteToSelf')
        : this.getTitle(),
      unreadCount: this.get('unreadCount') || 0,
      ...(isDirectConversation(this.attributes)
        ? {
            type: 'direct' as const,
            sharedGroupNames: this.get('sharedGroupNames') || [],
          }
        : {
            type: 'group' as const,
            acknowledgedGroupNameCollisions:
              this.get('acknowledgedGroupNameCollisions') || {},
            sharedGroupNames: [],
          }),
    };
  }

  updateE164(e164?: string | null): void {
    const oldValue = this.get('e164');
    if (e164 !== oldValue) {
      this.set('e164', e164 || undefined);

      // When our own number has changed - reset pniCredential
      if (isMe(this.attributes)) {
        this.set({ pniCredential: null });
      }

      if (oldValue && e164) {
        this.addChangeNumberNotification(oldValue, e164);
      }

      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'e164', oldValue);
      this.captureChange('updateE164');
    }
  }

  updateUuid(uuid?: string): void {
    const oldValue = this.get('uuid');
    if (uuid !== oldValue) {
      this.set('uuid', uuid ? UUID.cast(uuid.toLowerCase()) : undefined);
      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'uuid', oldValue);
      this.captureChange('updateUuid');
    }
  }

  updatePni(pni?: string): void {
    const oldValue = this.get('pni');
    if (pni !== oldValue) {
      this.set('pni', pni ? UUID.cast(pni.toLowerCase()) : undefined);

      if (
        oldValue &&
        pni &&
        (!this.get('uuid') || this.get('uuid') === oldValue)
      ) {
        // TODO: DESKTOP-3974
        this.addKeyChange(UUID.checkedLookup(oldValue));
      }

      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'pni', oldValue);
      this.captureChange('updatePni');
    }
  }

  updateGroupId(groupId?: string): void {
    const oldValue = this.get('groupId');
    if (groupId && groupId !== oldValue) {
      this.set('groupId', groupId);
      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'groupId', oldValue);
    }
  }

  incrementMessageCount(): void {
    this.set({
      messageCount: (this.get('messageCount') || 0) + 1,
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  getMembersCount(): number | undefined {
    if (isDirectConversation(this.attributes)) {
      return undefined;
    }

    const memberList = this.get('membersV2') || this.get('members');

    // We'll fail over if the member list is empty
    if (memberList && memberList.length) {
      return memberList.length;
    }

    const temporaryMemberCount = this.get('temporaryMemberCount');
    if (isNumber(temporaryMemberCount)) {
      return temporaryMemberCount;
    }

    return undefined;
  }

  decrementMessageCount(): void {
    this.set({
      messageCount: Math.max((this.get('messageCount') || 0) - 1, 0),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  incrementSentMessageCount({ dry = false }: { dry?: boolean } = {}):
    | Partial<ConversationAttributesType>
    | undefined {
    const update = {
      messageCount: (this.get('messageCount') || 0) + 1,
      sentMessageCount: (this.get('sentMessageCount') || 0) + 1,
    };

    if (dry) {
      return update;
    }
    this.set(update);
    window.Signal.Data.updateConversation(this.attributes);

    return undefined;
  }

  decrementSentMessageCount(): void {
    this.set({
      messageCount: Math.max((this.get('messageCount') || 0) - 1, 0),
      sentMessageCount: Math.max((this.get('sentMessageCount') || 0) - 1, 0),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  /**
   * This function is called when a message request is accepted in order to
   * handle sending read receipts and download any pending attachments.
   */
  async handleReadAndDownloadAttachments(
    options: { isLocalAction?: boolean } = {}
  ): Promise<void> {
    const { isLocalAction } = options;
    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();

    let messages: Array<MessageAttributesType> | undefined;
    do {
      const first = messages ? messages[0] : undefined;

      // eslint-disable-next-line no-await-in-loop
      messages = await window.Signal.Data.getOlderMessagesByConversation(
        this.get('id'),
        {
          isGroup: isGroup(this.attributes),
          limit: 100,
          messageId: first ? first.id : undefined,
          receivedAt: first ? first.received_at : undefined,
          sentAt: first ? first.sent_at : undefined,
          storyId: undefined,
        }
      );

      if (!messages.length) {
        return;
      }

      const readMessages = messages.filter(m => !hasErrors(m) && isIncoming(m));

      if (isLocalAction) {
        // eslint-disable-next-line no-await-in-loop
        await readReceiptsJobQueue.addIfAllowedByUser(
          window.storage,
          readMessages.map(m => ({
            messageId: m.id,
            senderE164: m.source,
            senderUuid: m.sourceUuid,
            timestamp: m.sent_at,
          }))
        );
      }

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        readMessages.map(async m => {
          const registered = window.MessageController.register(m.id, m);
          const shouldSave = await registered.queueAttachmentDownloads();
          if (shouldSave) {
            await window.Signal.Data.saveMessage(registered.attributes, {
              ourUuid,
            });
          }
        })
      );
    } while (messages.length > 0);
  }

  async applyMessageRequestResponse(
    response: number,
    { fromSync = false, viaStorageServiceSync = false } = {}
  ): Promise<void> {
    try {
      const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;
      const isLocalAction = !fromSync && !viaStorageServiceSync;

      const currentMessageRequestState = this.get('messageRequestResponseType');
      const didResponseChange = response !== currentMessageRequestState;
      const wasPreviouslyAccepted = this.getAccepted();

      // Apply message request response locally
      this.set({
        messageRequestResponseType: response,
      });

      if (response === messageRequestEnum.ACCEPT) {
        this.unblock({ viaStorageServiceSync });
        this.enableProfileSharing({ viaStorageServiceSync });

        // We really don't want to call this if we don't have to. It can take a lot of
        //   time to go through old messages to download attachments.
        if (didResponseChange && !wasPreviouslyAccepted) {
          await this.handleReadAndDownloadAttachments({ isLocalAction });
        }

        if (isLocalAction) {
          const ourACI = window.textsecure.storage.user.getCheckedUuid(
            UUIDKind.ACI
          );
          const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);
          const ourConversation =
            window.ConversationController.getOurConversationOrThrow();

          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
            this.sendProfileKeyUpdate();
          } else if (
            isGroupV2(this.attributes) &&
            this.isMemberPending(ourACI)
          ) {
            await this.modifyGroupV2({
              name: 'promotePendingMember',
              usingCredentialsFrom: [ourConversation],
              createGroupChange: () => this.promotePendingMember(UUIDKind.ACI),
            });
          } else if (
            ourPNI &&
            isGroupV2(this.attributes) &&
            this.isMemberPending(ourPNI)
          ) {
            await this.modifyGroupV2({
              name: 'promotePendingMember',
              usingCredentialsFrom: [ourConversation],
              createGroupChange: () => this.promotePendingMember(UUIDKind.PNI),
            });
          } else if (isGroupV2(this.attributes) && this.isMember(ourACI)) {
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
        // Block locally, other devices should block upon receiving the sync message
        this.block({ viaStorageServiceSync });
        this.disableProfileSharing({ viaStorageServiceSync });

        if (isLocalAction) {
          if (isGroupV1(this.attributes)) {
            await this.leaveGroup();
          } else if (isGroupV2(this.attributes)) {
            await this.leaveGroupV2();
          }
        }
      } else if (response === messageRequestEnum.DELETE) {
        this.disableProfileSharing({ viaStorageServiceSync });

        // Delete messages locally, other devices should delete upon receiving
        // the sync message
        await this.destroyMessages();
        this.updateLastMessage();

        if (isLocalAction) {
          this.trigger('unload', 'deleted from message request');

          if (isGroupV1(this.attributes)) {
            await this.leaveGroup();
          } else if (isGroupV2(this.attributes)) {
            await this.leaveGroupV2();
          }
        }
      } else if (response === messageRequestEnum.BLOCK_AND_DELETE) {
        // Block locally, other devices should block upon receiving the sync message
        this.block({ viaStorageServiceSync });
        this.disableProfileSharing({ viaStorageServiceSync });

        // Delete messages locally, other devices should delete upon receiving
        // the sync message
        await this.destroyMessages();
        this.updateLastMessage();

        if (isLocalAction) {
          this.trigger('unload', 'blocked and deleted from message request');

          if (isGroupV1(this.attributes)) {
            await this.leaveGroup();
          } else if (isGroupV2(this.attributes)) {
            await this.leaveGroupV2();
          }
        }
      }
    } finally {
      window.Signal.Data.updateConversation(this.attributes);
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
    await window.Signal.Groups.joinGroupV2ViaLinkAndMigrate({
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
    const ourACI = window.textsecure.storage.user.getCheckedUuid();
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
          createGroupChange: () => this.addMember(ourACI),
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
                uuid: ourACI.toString(),
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
    window.Signal.Data.updateConversation(this.attributes);
  }

  async cancelJoinRequest(): Promise<void> {
    const ourACI = window.storage.user.getCheckedUuid(UUIDKind.ACI);

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
      createGroupChange: () => this.denyPendingApprovalRequest(ourACI),
    });
  }

  async addMembersV2(conversationIds: ReadonlyArray<string>): Promise<void> {
    await this.modifyGroupV2({
      name: 'addMembersV2',
      usingCredentialsFrom: conversationIds
        .map(id => window.ConversationController.get(id))
        .filter(isNotNil),
      createGroupChange: () =>
        window.Signal.Groups.buildAddMembersChange(
          this.attributes,
          conversationIds
        ),
    });
  }

  async updateGroupAttributesV2(
    attributes: Readonly<{
      avatar?: undefined | Uint8Array;
      description?: string;
      title?: string;
    }>
  ): Promise<void> {
    await this.modifyGroupV2({
      name: 'updateGroupAttributesV2',
      usingCredentialsFrom: [],
      createGroupChange: () =>
        window.Signal.Groups.buildUpdateAttributesChange(
          {
            id: this.id,
            publicParams: this.get('publicParams'),
            revision: this.get('revision'),
            secretParams: this.get('secretParams'),
          },
          attributes
        ),
    });
  }

  async leaveGroupV2(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const ourACI = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);
    const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);
    const ourConversation =
      window.ConversationController.getOurConversationOrThrow();

    if (this.isMemberPending(ourACI)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [],
        createGroupChange: () => this.removePendingMember([ourACI]),
      });
    } else if (this.isMember(ourACI)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [ourConversation],
        createGroupChange: () => this.removeMember(ourACI),
      });
      // Keep PNI in pending if ACI was a member.
    } else if (ourPNI && this.isMemberPending(ourPNI)) {
      await this.modifyGroupV2({
        name: 'delete',
        usingCredentialsFrom: [],
        createGroupChange: () => this.removePendingMember([ourPNI]),
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
    uuid: UUID
  ): Promise<Proto.GroupChange.Actions | undefined> {
    if (this.isMember(uuid)) {
      log.warn('addBannedMember: Member is a part of the group!');

      return;
    }

    if (this.isMemberPending(uuid)) {
      log.warn('addBannedMember: Member is pending to be added to group!');

      return;
    }

    if (this.isMemberBanned(uuid)) {
      log.warn('addBannedMember: Member is already banned!');

      return;
    }

    return window.Signal.Groups.buildAddBannedMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  async blockGroupLinkRequests(uuid: UUIDStringType): Promise<void> {
    await this.modifyGroupV2({
      name: 'addBannedMember',
      usingCredentialsFrom: [],
      createGroupChange: async () => this.addBannedMember(new UUID(uuid)),
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

    const uuid = member.getCheckedUuid(`toggleAdmin/${logId}`);

    if (!this.isMember(uuid)) {
      log.error(
        `toggleAdmin: Member ${conversationId} is not a member of the group`
      );
      return;
    }

    await this.modifyGroupV2({
      name: 'toggleAdmin',
      usingCredentialsFrom: [member],
      createGroupChange: () => this.toggleAdminChange(uuid),
    });
  }

  async approvePendingMembershipFromGroupV2(
    conversationId: string
  ): Promise<void> {
    const logId = this.idForLogging();

    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      throw new Error(
        `approvePendingMembershipFromGroupV2/${logId}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = pendingMember.getCheckedUuid(
      `approvePendingMembershipFromGroupV2/${logId}`
    );

    if (isGroupV2(this.attributes) && this.isMemberRequestingToJoin(uuid)) {
      await this.modifyGroupV2({
        name: 'approvePendingApprovalRequest',
        usingCredentialsFrom: [pendingMember],
        createGroupChange: () => this.approvePendingApprovalRequest(uuid),
      });
    }
  }

  async revokePendingMembershipsFromGroupV2(
    conversationIds: Array<string>
  ): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    // Only pending memberships can be revoked for multiple members at once
    if (conversationIds.length > 1) {
      const uuids = conversationIds.map(id => {
        const uuid = window.ConversationController.get(id)?.getUuid();
        strictAssert(uuid, `UUID does not exist for ${id}`);
        return uuid;
      });
      await this.modifyGroupV2({
        name: 'removePendingMember',
        usingCredentialsFrom: [],
        createGroupChange: () => this.removePendingMember(uuids),
        extraConversationsForSend: conversationIds,
      });
      return;
    }

    const [conversationId] = conversationIds;

    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      const logId = this.idForLogging();
      throw new Error(
        `revokePendingMembershipsFromGroupV2/${logId}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = pendingMember.getCheckedUuid(
      'revokePendingMembershipsFromGroupV2'
    );

    if (this.isMemberRequestingToJoin(uuid)) {
      await this.modifyGroupV2({
        name: 'denyPendingApprovalRequest',
        usingCredentialsFrom: [],
        createGroupChange: () => this.denyPendingApprovalRequest(uuid),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMemberPending(uuid)) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        usingCredentialsFrom: [],
        createGroupChange: () => this.removePendingMember([uuid]),
        extraConversationsForSend: [conversationId],
      });
    }
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

    const uuid = pendingMember.getCheckedUuid(`removeFromGroupV2/${logId}`);

    if (this.isMemberRequestingToJoin(uuid)) {
      await this.modifyGroupV2({
        name: 'denyPendingApprovalRequest',
        usingCredentialsFrom: [],
        createGroupChange: () => this.denyPendingApprovalRequest(uuid),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMemberPending(uuid)) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        usingCredentialsFrom: [],
        createGroupChange: () => this.removePendingMember([uuid]),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMember(uuid)) {
      await this.modifyGroupV2({
        name: 'removeFromGroup',
        usingCredentialsFrom: [pendingMember],
        createGroupChange: () => this.removeMember(uuid),
        extraConversationsForSend: [conversationId],
      });
    } else {
      log.error(
        `removeFromGroupV2: Member ${conversationId} is neither a member nor a pending member of the group`
      );
    }
  }

  async syncMessageRequestResponse(response: number): Promise<void> {
    // In GroupsV2, this may modify the server. We only want to continue if those
    //   server updates were successful.
    await this.applyMessageRequestResponse(response);

    const groupId = this.getGroupIdBuffer();

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'syncMessageRequestResponse: We are primary device; not sending message request sync'
      );
      return;
    }

    try {
      await singleProtoJobQueue.add(
        MessageSender.getMessageRequestResponseSync({
          threadE164: this.get('e164'),
          threadUuid: this.get('uuid'),
          groupId,
          type: response,
        })
      );
    } catch (error) {
      log.error(
        'syncMessageRequestResponse: Failed to queue sync message',
        Errors.toLogFormat(error)
      );
    }
  }

  async safeGetVerified(): Promise<number> {
    const uuid = this.getUuid();
    if (!uuid) {
      return window.textsecure.storage.protocol.VerifiedStatus.DEFAULT;
    }

    const promise = window.textsecure.storage.protocol.getVerified(uuid);
    return promise.catch(
      () => window.textsecure.storage.protocol.VerifiedStatus.DEFAULT
    );
  }

  async updateVerified(): Promise<void> {
    if (isDirectConversation(this.attributes)) {
      await this.initialPromise;
      const verified = await this.safeGetVerified();

      if (this.get('verified') !== verified) {
        this.set({ verified });
        window.Signal.Data.updateConversation(this.attributes);
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

  setVerifiedDefault(options?: VerificationOptions): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { DEFAULT } = this.verifiedEnum!;
    return this.queueJob('setVerifiedDefault', () =>
      this._setVerified(DEFAULT, options)
    );
  }

  setVerified(options?: VerificationOptions): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { VERIFIED } = this.verifiedEnum!;
    return this.queueJob('setVerified', () =>
      this._setVerified(VERIFIED, options)
    );
  }

  setUnverified(options: VerificationOptions): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { UNVERIFIED } = this.verifiedEnum!;
    return this.queueJob('setUnverified', () =>
      this._setVerified(UNVERIFIED, options)
    );
  }

  private async _setVerified(
    verified: number,
    providedOptions?: VerificationOptions
  ): Promise<boolean> {
    const options = providedOptions || {};
    window._.defaults(options, {
      viaStorageServiceSync: false,
      key: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { VERIFIED, DEFAULT } = this.verifiedEnum!;

    if (!isDirectConversation(this.attributes)) {
      throw new Error(
        'You cannot verify a group conversation. ' +
          'You must verify individual contacts.'
      );
    }

    const uuid = this.getUuid();
    const beginningVerified = this.get('verified');
    let keyChange = false;
    if (options.viaStorageServiceSync) {
      strictAssert(
        uuid,
        `Sync message didn't update uuid for conversation: ${this.id}`
      );

      // handle the incoming key from the sync messages - need different
      // behavior if that key doesn't match the current key
      keyChange =
        await window.textsecure.storage.protocol.processVerifiedMessage(
          uuid,
          verified,
          options.key || undefined
        );
    } else if (uuid) {
      await window.textsecure.storage.protocol.setVerified(uuid, verified);
    } else {
      log.warn(`_setVerified(${this.id}): no uuid to update protocol storage`);
    }

    this.set({ verified });

    // We will update the conversation during storage service sync
    if (!options.viaStorageServiceSync) {
      window.Signal.Data.updateConversation(this.attributes);
    }

    if (!options.viaStorageServiceSync) {
      if (keyChange) {
        this.captureChange('keyChange');
      }
      if (beginningVerified !== verified) {
        this.captureChange(`verified from=${beginningVerified} to=${verified}`);
      }
    }

    const didVerifiedChange = beginningVerified !== verified;
    const isExplicitUserAction = !options.viaStorageServiceSync;
    const shouldShowFromStorageSync =
      options.viaStorageServiceSync && verified !== DEFAULT;
    if (
      // The message came from an explicit verification in a client (not
      // storage service sync)
      (didVerifiedChange && isExplicitUserAction) ||
      // The verification value received by the storage sync is different from what we
      //   have on record (and it's not a transition to UNVERIFIED)
      (didVerifiedChange && shouldShowFromStorageSync) ||
      // Our local verification status is VERIFIED and it hasn't changed, but the key did
      //   change (Key1/VERIFIED -> Key2/VERIFIED), but we don't want to show DEFAULT ->
      //   DEFAULT or UNVERIFIED -> UNVERIFIED
      (keyChange && verified === VERIFIED)
    ) {
      await this.addVerifiedChange(this.id, verified === VERIFIED, {
        local: isExplicitUserAction,
      });
    }
    if (isExplicitUserAction && uuid) {
      await this.sendVerifySyncMessage(this.get('e164'), uuid, verified);
    }

    return keyChange;
  }

  async sendVerifySyncMessage(
    e164: string | undefined,
    uuid: UUID,
    state: number
  ): Promise<CallbackResultType | void> {
    const identifier = uuid ? uuid.toString() : e164;
    if (!identifier) {
      throw new Error(
        'sendVerifySyncMessage: Neither e164 nor UUID were provided'
      );
    }

    if (window.ConversationController.areWePrimaryDevice()) {
      log.warn(
        'sendVerifySyncMessage: We are primary device; not sending sync'
      );
      return;
    }

    const key = await window.textsecure.storage.protocol.loadIdentityKey(
      UUID.checkedLookup(identifier)
    );
    if (!key) {
      throw new Error(
        `sendVerifySyncMessage: No identity key found for identifier ${identifier}`
      );
    }

    try {
      await singleProtoJobQueue.add(
        MessageSender.getVerificationSync(e164, uuid.toString(), state, key)
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.get('verified') === this.verifiedEnum!.VERIFIED;
    }

    if (!this.contactCollection?.length) {
      return false;
    }

    return this.contactCollection?.every(contact => {
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        verified !== this.verifiedEnum!.VERIFIED &&
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        verified !== this.verifiedEnum!.DEFAULT
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

    const uuid = this.getUuid();
    if (!uuid) {
      log.warn(`setApproved(${this.id}): no uuid, ignoring`);
      return;
    }

    return window.textsecure.storage.protocol.setApproval(uuid, true);
  }

  safeIsUntrusted(): boolean {
    try {
      const uuid = this.getUuid();
      strictAssert(uuid, `No uuid for conversation: ${this.id}`);
      return window.textsecure.storage.protocol.isUntrusted(uuid);
    } catch (err) {
      return false;
    }
  }

  isUntrusted(): boolean {
    if (isDirectConversation(this.attributes)) {
      return this.safeIsUntrusted();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.contactCollection!.length) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.contactCollection!.any(contact => {
      if (isMe(contact.attributes)) {
        return false;
      }
      return contact.safeIsUntrusted();
    });
  }

  getUntrusted(): Array<ConversationModel> {
    if (isDirectConversation(this.attributes)) {
      if (this.isUntrusted()) {
        return [this];
      }
      return [];
    }

    return (
      this.contactCollection?.filter(contact => {
        if (isMe(contact.attributes)) {
          return false;
        }
        return contact.isUntrusted();
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
    if (!this.get('about')) {
      return undefined;
    }

    const emoji = this.get('aboutEmoji');
    const text = this.get('about');

    if (!emoji) {
      return text;
    }

    return window.i18n('message--getNotificationText--text-with-emoji', {
      text,
      emoji,
    });
  }

  /**
   * Determine if this conversation should be considered "accepted" in terms
   * of message requests
   */
  getAccepted(): boolean {
    return isConversationAccepted(this.attributes);
  }

  onMemberVerifiedChange(): void {
    // If the verified state of a member changes, our aggregate state changes.
    // We trigger both events to replicate the behavior of window.Backbone.Model.set()
    this.trigger('change:verified', this);
    this.trigger('change', this, { force: true });
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

    const message = {
      conversationId: this.id,
      type: 'chat-session-refreshed',
      sent_at: receivedAt,
      received_at: receivedAtCounter,
      received_at_ms: receivedAt,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown as MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);
    this.updateUnread();
  }

  async addDeliveryIssue({
    receivedAt,
    receivedAtCounter,
    senderUuid,
    sentAt,
  }: {
    receivedAt: number;
    receivedAtCounter: number;
    senderUuid: string;
    sentAt: number;
  }): Promise<void> {
    log.info(`addDeliveryIssue: adding for ${this.idForLogging()}`, {
      sentAt,
      senderUuid,
    });

    const message = {
      conversationId: this.id,
      type: 'delivery-issue',
      sourceUuid: senderUuid,
      sent_at: receivedAt,
      received_at: receivedAtCounter,
      received_at_ms: receivedAt,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown as MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);

    await this.notify(model);
    this.updateUnread();
  }

  async addKeyChange(keyChangedId: UUID): Promise<void> {
    log.info(
      'adding key change advisory for',
      this.idForLogging(),
      keyChangedId.toString(),
      this.get('timestamp')
    );

    const timestamp = Date.now();
    const message = {
      conversationId: this.id,
      type: 'keychange',
      sent_at: this.get('timestamp'),
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      key_changed: keyChangedId.toString(),
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Unseen,
      schemaVersion: Message.VERSION_NEEDED_FOR_DISPLAY,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown as MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    const isUntrusted = await this.isUntrusted();

    this.trigger('newmessage', model);

    const uuid = this.get('uuid');
    // Group calls are always with folks that have a UUID
    if (isUntrusted && uuid) {
      window.reduxActions.calling.keyChanged({ uuid });
    }
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

    const lastMessage = this.get('timestamp') || Date.now();

    log.info(
      'adding verified change advisory for',
      this.idForLogging(),
      verifiedChangeId,
      lastMessage
    );

    const shouldBeUnseen = !options.local && !verified;
    const timestamp = Date.now();
    const message: MessageAttributesType = {
      id: generateGuid(),
      conversationId: this.id,
      local: Boolean(options.local),
      readStatus: shouldBeUnseen ? ReadStatus.Unread : ReadStatus.Read,
      received_at_ms: timestamp,
      received_at: window.Signal.Util.incrementMessageCounter(),
      seenStatus: shouldBeUnseen ? SeenStatus.Unseen : SeenStatus.Unseen,
      sent_at: lastMessage,
      timestamp,
      type: 'verified-change',
      verified,
      verifiedChanged: verifiedChangeId,
    };

    await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      forceSave: true,
    });
    const model = window.MessageController.register(
      message.id,
      new window.Whisper.Message(message)
    );

    this.trigger('newmessage', model);
    this.updateUnread();

    const uuid = this.getUuid();
    if (isDirectConversation(this.attributes) && uuid) {
      window.ConversationController.getAllGroupsInvolvingUuid(uuid).then(
        groups => {
          window._.forEach(groups, group => {
            group.addVerifiedChange(this.id, verified, options);
          });
        }
      );
    }
  }

  async addCallHistory(
    callHistoryDetails: CallHistoryDetailsType,
    receivedAtCounter: number | undefined
  ): Promise<void> {
    let timestamp: number;
    let unread: boolean;
    let detailsToSave: CallHistoryDetailsType;

    switch (callHistoryDetails.callMode) {
      case CallMode.Direct:
        timestamp = callHistoryDetails.endedTime;
        unread =
          !callHistoryDetails.wasDeclined && !callHistoryDetails.acceptedTime;
        detailsToSave = {
          ...callHistoryDetails,
          callMode: CallMode.Direct,
        };
        break;
      case CallMode.Group:
        timestamp = callHistoryDetails.startedTime;
        unread = false;
        detailsToSave = callHistoryDetails;
        break;
      default:
        throw missingCaseError(callHistoryDetails);
    }

    const message = {
      conversationId: this.id,
      type: 'call-history',
      sent_at: timestamp,
      received_at:
        receivedAtCounter || window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      readStatus: unread ? ReadStatus.Unread : ReadStatus.Read,
      seenStatus: unread ? SeenStatus.Unseen : SeenStatus.NotApplicable,
      callHistoryDetails: detailsToSave,
      // TODO: DESKTOP-722
    } as unknown as MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);
    this.updateUnread();
  }

  /**
   * Adds a group call history message if one is needed. It won't add history messages for
   * the same group call era ID.
   *
   * Resolves with `true` if a new message was added, and `false` otherwise.
   */
  async updateCallHistoryForGroupCall(
    eraId: string,
    creatorUuid: string
  ): Promise<boolean> {
    // We want to update the cache quickly in case this function is called multiple times.
    const oldCachedEraId = this.cachedLatestGroupCallEraId;
    this.cachedLatestGroupCallEraId = eraId;

    const alreadyHasMessage =
      (oldCachedEraId && oldCachedEraId === eraId) ||
      (await window.Signal.Data.hasGroupCallHistoryMessage(this.id, eraId));

    if (alreadyHasMessage) {
      this.updateLastMessage();
      return false;
    }

    await this.addCallHistory(
      {
        callMode: CallMode.Group,
        creatorUuid,
        eraId,
        startedTime: Date.now(),
      },
      undefined
    );
    return true;
  }

  async addProfileChange(
    profileChange: unknown,
    conversationId?: string
  ): Promise<void> {
    const now = Date.now();
    const message = {
      conversationId: this.id,
      type: 'profile-change',
      sent_at: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: now,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,
      changedId: conversationId || this.id,
      profileChange,
      // TODO: DESKTOP-722
    } as unknown as MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);

    const uuid = this.getUuid();
    if (isDirectConversation(this.attributes) && uuid) {
      window.ConversationController.getAllGroupsInvolvingUuid(uuid).then(
        groups => {
          window._.forEach(groups, group => {
            group.addProfileChange(profileChange, this.id);
          });
        }
      );
    }
  }

  async addNotification(
    type: MessageAttributesType['type'],
    extra: Partial<MessageAttributesType> = {}
  ): Promise<string> {
    const now = Date.now();
    const message: Partial<MessageAttributesType> = {
      conversationId: this.id,
      type,
      sent_at: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: now,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,

      ...extra,
    };

    const id = await window.Signal.Data.saveMessage(
      // TODO: DESKTOP-722
      message as MessageAttributesType,
      {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      }
    );
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...(message as MessageAttributesType),
        id,
      })
    );

    this.trigger('newmessage', model);

    return id;
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
    this.set('pendingUniversalTimer', notificationId);
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
      });
    }
  }

  async maybeRemoveUniversalTimer(): Promise<boolean> {
    const notificationId = this.get('pendingUniversalTimer');
    if (!notificationId) {
      return false;
    }

    this.set('pendingUniversalTimer', undefined);
    log.info(
      `maybeRemoveUniversalTimer(${this.idForLogging()}): removed notification`
    );

    const message = window.MessageController.getById(notificationId);
    if (message) {
      await window.Signal.Data.removeMessage(message.id);
    }
    return true;
  }

  async addChangeNumberNotification(
    oldValue: string,
    newValue: string
  ): Promise<void> {
    const sourceUuid = this.getCheckedUuid(
      'Change number notification without uuid'
    );

    const { storage } = window.textsecure;
    if (storage.user.getOurUuidKind(sourceUuid) !== UUIDKind.Unknown) {
      log.info(
        `Conversation ${this.idForLogging()}: not adding change number ` +
          'notification for ourselves'
      );
      return;
    }

    log.info(
      `Conversation ${this.idForLogging()}: adding change number ` +
        `notification for ${sourceUuid.toString()} from ${oldValue} to ${newValue}`
    );

    const convos = [
      this,
      ...(await window.ConversationController.getAllGroupsInvolvingUuid(
        sourceUuid
      )),
    ];

    await Promise.all(
      convos.map(convo => {
        return convo.addNotification('change-number-notification', {
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Unseen,
          sourceUuid: sourceUuid.toString(),
        });
      })
    );
  }

  async onReadMessage(message: MessageModel, readAt?: number): Promise<void> {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.markRead(message.get('received_at')!, {
        newestSentAt: message.get('sent_at'),
        sendReadReceipts: false,
        readAt,
      })
    );
  }

  override validate(attributes = this.attributes): string | null {
    return validateConversation(attributes);
  }

  queueJob<T>(
    name: string,
    callback: (abortSignal: AbortSignal) => Promise<T>
  ): Promise<T> {
    this.jobQueue = this.jobQueue || new window.PQueue({ concurrency: 1 });

    const taskWithTimeout = createTaskWithTimeout(
      callback,
      `conversation ${this.idForLogging()}`
    );

    const abortController = new AbortController();
    const { signal: abortSignal } = abortController;

    const queuedAt = Date.now();
    return this.jobQueue.add(async () => {
      const startedAt = Date.now();
      const waitTime = startedAt - queuedAt;

      if (waitTime > JOB_REPORTING_THRESHOLD_MS) {
        log.info(`Conversation job ${name} was blocked for ${waitTime}ms`);
      }

      try {
        return await taskWithTimeout(abortSignal);
      } catch (error) {
        abortController.abort();
        throw error;
      } finally {
        const duration = Date.now() - startedAt;

        if (duration > JOB_REPORTING_THRESHOLD_MS) {
          log.info(`Conversation job ${name} took ${duration}ms`);
        }
      }
    });
  }

  isAdmin(uuid: UUID): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    const members = this.get('membersV2') || [];
    const member = members.find(x => x.uuid === uuid.toString());
    if (!member) {
      return false;
    }

    const MEMBER_ROLES = Proto.Member.Role;

    return member.role === MEMBER_ROLES.ADMINISTRATOR;
  }

  getUuid(): UUID | undefined {
    try {
      const value = this.get('uuid');
      return value ? new UUID(value) : undefined;
    } catch (err) {
      log.warn(
        `getUuid(): failed to obtain conversation(${this.id}) uuid due to`,
        Errors.toLogFormat(err)
      );
      return undefined;
    }
  }

  getCheckedUuid(reason: string): UUID {
    const result = this.getUuid();
    strictAssert(result !== undefined, reason);
    return result;
  }

  private getMemberships(): Array<{
    uuid: UUIDStringType;
    isAdmin: boolean;
  }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('membersV2') || [];
    return members.map(member => ({
      isAdmin: member.role === Proto.Member.Role.ADMINISTRATOR,
      uuid: member.uuid,
    }));
  }

  getGroupLink(): string | undefined {
    if (!isGroupV2(this.attributes)) {
      return undefined;
    }

    if (!this.get('groupInviteLinkPassword')) {
      return undefined;
    }

    return window.Signal.Groups.buildGroupLink(this);
  }

  private getPendingMemberships(): Array<{
    addedByUserId?: UUIDStringType;
    uuid: UUIDStringType;
  }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('pendingMembersV2') || [];
    return members.map(member => ({
      addedByUserId: member.addedByUserId,
      uuid: member.uuid,
    }));
  }

  private getPendingApprovalMemberships(): Array<{ uuid: UUIDStringType }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('pendingAdminApprovalV2') || [];
    return members.map(member => ({
      uuid: member.uuid,
    }));
  }

  private getBannedMemberships(): Array<UUIDStringType> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    return (this.get('bannedMembersV2') || []).map(member => member.uuid);
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

    if (!isAnnouncementGroupReady()) {
      return false;
    }

    return true;
  }

  getMemberIds(): Array<string> {
    const members = this.getMembers();
    return members.map(member => member.id);
  }

  getMemberUuids(): Array<UUID> {
    const members = this.getMembers();
    return members.map(member => {
      return member.getCheckedUuid('Group member without uuid');
    });
  }

  getRecipients({
    includePendingMembers,
    extraConversationsForSend,
  }: {
    includePendingMembers?: boolean;
    extraConversationsForSend?: Array<string>;
  } = {}): Array<string> {
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
      fileName: string | null;
      thumbnail: ThumbnailType | null;
    }>
  > {
    if (attachments && attachments.length) {
      const attachmentsToUse = Array.from(take(attachments, 1));
      const isGIFQuote = isGIF(attachmentsToUse);

      return Promise.all(
        map(attachmentsToUse, async attachment => {
          const { path, fileName, thumbnail, contentType } = attachment;

          if (!path) {
            return {
              contentType: isGIFQuote ? IMAGE_GIF : contentType,
              // Our protos library complains about this field being undefined, so we
              //   force it to null
              fileName: fileName || null,
              thumbnail: null,
            };
          }

          return {
            contentType: isGIFQuote ? IMAGE_GIF : contentType,
            // Our protos library complains about this field being undefined, so we force
            //   it to null
            fileName: fileName || null,
            thumbnail: thumbnail
              ? {
                  ...(await loadAttachmentData(thumbnail)),
                  objectUrl: thumbnail.path
                    ? getAbsoluteAttachmentPath(thumbnail.path)
                    : undefined,
                }
              : null,
          };
        })
      );
    }

    if (preview && preview.length) {
      const previewImages = collect(preview, prev => prev.image);
      const previewImagesToUse = take(previewImages, 1);

      return Promise.all(
        map(previewImagesToUse, async image => {
          const { contentType } = image;

          return {
            contentType,
            // Our protos library complains about this field being undefined, so we
            //   force it to null
            fileName: null,
            thumbnail: image
              ? {
                  ...(await loadAttachmentData(image)),
                  objectUrl: image.path
                    ? getAbsoluteAttachmentPath(image.path)
                    : undefined,
                }
              : null,
          };
        })
      );
    }

    if (sticker && sticker.data && sticker.data.path) {
      const { path, contentType } = sticker.data;

      return [
        {
          contentType,
          // Our protos library complains about this field being undefined, so we
          //   force it to null
          fileName: null,
          thumbnail: {
            ...(await loadAttachmentData(sticker.data)),
            objectUrl: path ? getAbsoluteAttachmentPath(path) : undefined,
          },
        },
      ];
    }

    return [];
  }

  async makeQuote(quotedMessage: MessageModel): Promise<QuotedMessageType> {
    const { getName } = EmbeddedContact;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contact = getContact(quotedMessage.attributes)!;
    const attachments = quotedMessage.get('attachments');
    const preview = quotedMessage.get('preview');
    const sticker = quotedMessage.get('sticker');

    const body = quotedMessage.get('body');
    const embeddedContact = quotedMessage.get('contact');
    const embeddedContactName =
      embeddedContact && embeddedContact.length > 0
        ? getName(embeddedContact[0])
        : '';

    return {
      authorUuid: contact.get('uuid'),
      attachments: isTapToView(quotedMessage.attributes)
        ? [{ contentType: IMAGE_JPEG, fileName: null }]
        : await this.getQuoteAttachment(attachments, preview, sticker),
      bodyRanges: quotedMessage.get('bodyRanges'),
      id: quotedMessage.get('sent_at'),
      isViewOnce: isTapToView(quotedMessage.attributes),
      isGiftBadge: isGiftBadge(quotedMessage.attributes),
      messageId: quotedMessage.get('id'),
      referencedMessageNotFound: false,
      text: body || embeddedContactName,
    };
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
    const { emoji, path, width, height } = stickerData;
    const data = await readStickerData(path);

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
        blurHash: await window.imageToBlurHash(
          new Blob([data], {
            type: IMAGE_JPEG,
          })
        ),
      },
    };

    this.enqueueMessageForSend({
      body: undefined,
      attachments: [],
      sticker,
    });
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

  async enqueueMessageForSend(
    {
      attachments,
      body,
      contact,
      mentions,
      preview,
      quote,
      sticker,
    }: {
      attachments: Array<AttachmentType>;
      body: string | undefined;
      contact?: Array<ContactWithHydratedAvatar>;
      mentions?: BodyRangesType;
      preview?: Array<LinkPreviewType>;
      quote?: QuotedMessageType;
      sticker?: StickerWithHydratedData;
    },
    {
      dontClearDraft,
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

    const now = timestamp || Date.now();

    log.info(
      'Sending message to conversation',
      this.idForLogging(),
      'with timestamp',
      now
    );

    this.clearTypingTimers();

    const mandatoryProfileSharingEnabled = window.Signal.RemoteConfig.isEnabled(
      'desktop.mandatoryProfileSharing'
    );

    await this.maybeApplyUniversalTimer();

    const expireTimer = this.get('expireTimer');

    const recipientMaybeConversations = map(this.getRecipients(), identifier =>
      window.ConversationController.get(identifier)
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
    const attachmentsToSend = preview && preview.length ? [] : attachments;

    if (preview && preview.length) {
      attachments.forEach(attachment => {
        if (attachment.path) {
          deleteAttachmentData(attachment.path);
        }
      });
    }

    // Here we move attachments to disk
    const attributes = await upgradeMessageSchema({
      id: UUID.generate().toString(),
      timestamp: now,
      type: 'outgoing',
      body,
      conversationId: this.id,
      contact,
      quote,
      preview,
      attachments: attachmentsToSend,
      sent_at: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: now,
      expireTimer,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.NotApplicable,
      sticker,
      bodyRanges: mentions,
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

    const model = new window.Whisper.Message(attributes);
    const message = window.MessageController.register(model.id, model);
    message.cachedOutgoingContactData = contact;
    message.cachedOutgoingPreviewData = preview;
    message.cachedOutgoingQuoteData = quote;
    message.cachedOutgoingStickerData = sticker;

    const dbStart = Date.now();

    strictAssert(
      typeof message.attributes.timestamp === 'number',
      'Expected a timestamp'
    );

    await conversationJobQueue.add(
      {
        type: conversationQueueJobEnum.enum.NormalMessage,
        conversationId: this.id,
        messageId: message.id,
        revision: this.get('revision'),
      },
      async jobToInsert => {
        log.info(
          `enqueueMessageForSend: saving message ${message.id} and job ${jobToInsert.id}`
        );
        await window.Signal.Data.saveMessage(message.attributes, {
          jobToInsert,
          forceSave: true,
          ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
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
    await this.beforeAddSingleMessage();

    this.isInReduxBatch = true;
    batchDispatch(() => {
      try {
        const { clearUnreadMetrics } = window.reduxActions.conversations;
        clearUnreadMetrics(this.id);

        const enabledProfileSharing = Boolean(
          mandatoryProfileSharingEnabled && !this.get('profileSharing')
        );
        const unarchivedConversation = Boolean(this.get('isArchived'));

        this.doAddSingleMessage(model, { isJustSent: true });

        const draftProperties = dontClearDraft
          ? {}
          : {
              draft: null,
              draftTimestamp: null,
              lastMessage: model.getNotificationText(),
              lastMessageStatus: 'sending' as const,
            };

        this.set({
          ...draftProperties,
          ...(enabledProfileSharing ? { profileSharing: true } : {}),
          ...this.incrementSentMessageCount({ dry: true }),
          active_at: now,
          timestamp: now,
          ...(unarchivedConversation ? { isArchived: false } : {}),
        });

        if (enabledProfileSharing) {
          this.captureChange('enqueueMessageForSend/mandatoryProfileSharing');
        }
        if (unarchivedConversation) {
          this.captureChange('enqueueMessageForSend/unarchive');
        }

        extraReduxActions?.();
      } finally {
        this.isInReduxBatch = false;
      }
    });

    if (sticker) {
      await addStickerPackReference(model.id, sticker.packId);
    }

    const renderDuration = Date.now() - renderStart;

    if (renderDuration > SEND_REPORTING_THRESHOLD_MS) {
      log.info(
        `ConversationModel(${this.idForLogging()}.sendMessage(${now}): ` +
          `render save took ${renderDuration}ms`
      );
    }

    window.Signal.Data.updateConversation(this.attributes);

    return attributes;
  }

  // Is this someone who is a contact, or are we sharing our profile with them?
  //   Or is the person who added us to this group a contact or are we sharing profile
  //   with them?
  isFromOrAddedByTrustedContact(): boolean {
    if (isDirectConversation(this.attributes)) {
      return Boolean(this.get('name')) || Boolean(this.get('profileSharing'));
    }

    const addedBy = this.get('addedBy');
    if (!addedBy) {
      return false;
    }

    const conv = window.ConversationController.get(addedBy);
    if (!conv) {
      return false;
    }

    return Boolean(
      isMe(conv.attributes) || conv.get('name') || conv.get('profileSharing')
    );
  }

  async updateLastMessage(): Promise<void> {
    if (!this.id) {
      return;
    }

    const ourConversationId =
      window.ConversationController.getOurConversationId();
    if (!ourConversationId) {
      throw new Error('updateLastMessage: Failed to fetch ourConversationId');
    }

    const conversationId = this.id;

    const ourUuid = window.textsecure.storage.user.getCheckedUuid().toString();
    const stats = await window.Signal.Data.getConversationMessageStats({
      conversationId,
      isGroup: isGroup(this.attributes),
      ourUuid,
    });

    // This runs as a job to avoid race conditions
    this.queueJob('maybeSetPendingUniversalTimer', async () =>
      this.maybeSetPendingUniversalTimer(stats.hasUserInitiatedMessages)
    );

    const { preview, activity } = stats;
    let previewMessage: MessageModel | undefined;
    let activityMessage: MessageModel | undefined;

    // Register the message with MessageController so that if it already exists
    // in memory we use that data instead of the data from the db which may
    // be out of date.
    if (preview) {
      previewMessage = window.MessageController.register(preview.id, preview);
    }

    if (activity) {
      activityMessage = window.MessageController.register(
        activity.id,
        activity
      );
    }

    if (
      this.hasDraft() &&
      this.get('draftTimestamp') &&
      (!previewMessage ||
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        previewMessage.get('sent_at') < this.get('draftTimestamp')!)
    ) {
      return;
    }

    const currentTimestamp = this.get('timestamp') || null;
    const timestamp = activityMessage
      ? activityMessage.get('sent_at') ||
        activityMessage.get('received_at') ||
        currentTimestamp
      : currentTimestamp;

    this.set({
      lastMessage:
        (previewMessage ? previewMessage.getNotificationText() : '') || '',
      lastMessageStatus:
        (previewMessage
          ? getMessagePropStatus(previewMessage.attributes, ourConversationId)
          : null) || null,
      timestamp,
      lastMessageDeletedForEveryone: previewMessage
        ? previewMessage.get('deletedForEveryone')
        : false,
    });

    window.Signal.Data.updateConversation(this.attributes);
  }

  setArchived(isArchived: boolean): void {
    const before = this.get('isArchived');

    this.set({ isArchived });
    window.Signal.Data.updateConversation(this.attributes);

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
    window.Signal.Data.updateConversation(this.attributes);

    if (Boolean(previousMarkedUnread) !== Boolean(markedUnread)) {
      this.captureChange('markedUnread');
    }
  }

  async refreshGroupLink(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const groupInviteLinkPassword = Bytes.toBase64(
      window.Signal.Groups.generateGroupInviteLinkPassword()
    );

    log.info('refreshGroupLink for conversation', this.idForLogging());

    await this.modifyGroupV2({
      name: 'updateInviteLinkPassword',
      usingCredentialsFrom: [],
      createGroupChange: async () =>
        window.Signal.Groups.buildInviteLinkPasswordChange(
          this.attributes,
          groupInviteLinkPassword
        ),
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
      Bytes.toBase64(window.Signal.Groups.generateGroupInviteLinkPassword());

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
          window.Signal.Groups.buildNewGroupLinkChange(
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
          window.Signal.Groups.buildAccessControlAddFromInviteLinkChange(
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
        window.Signal.Groups.buildAccessControlAddFromInviteLinkChange(
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
        window.Signal.Groups.buildAccessControlAttributesChange(
          this.attributes,
          value
        ),
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
        window.Signal.Groups.buildAccessControlMembersChange(
          this.attributes,
          value
        ),
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
        window.Signal.Groups.buildAnnouncementsOnlyChange(
          this.attributes,
          value
        ),
    });

    this.set({ announcementsOnly: value });
  }

  async updateExpirationTimer(
    providedExpireTimer: number | undefined,
    {
      reason,
      receivedAt,
      receivedAtMS = Date.now(),
      sentAt: providedSentAt,
      source: providedSource,
      fromSync = false,
      isInitialSync = false,
      fromGroupUpdate = false,
    }: {
      reason: string;
      receivedAt?: number;
      receivedAtMS?: number;
      sentAt?: number;
      source?: string;
      fromSync?: boolean;
      isInitialSync?: boolean;
      fromGroupUpdate?: boolean;
    }
  ): Promise<boolean | null | MessageModel | void> {
    const isSetByOther = providedSource || providedSentAt !== undefined;

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
      return false;
    }

    if (!isSetByOther && this.isGroupV1AndDisabled()) {
      throw new Error(
        'updateExpirationTimer: GroupV1 is deprecated; cannot update expiration timer'
      );
    }

    let expireTimer: number | undefined = providedExpireTimer;
    let source = providedSource;
    if (this.get('left')) {
      return false;
    }

    if (!expireTimer) {
      expireTimer = undefined;
    }
    if (
      this.get('expireTimer') === expireTimer ||
      (!expireTimer && !this.get('expireTimer'))
    ) {
      return null;
    }

    const logId =
      `updateExpirationTimer(${this.idForLogging()}, ` +
      `${expireTimer || 'disabled'}) ` +
      `source=${source ?? '?'} reason=${reason}`;

    log.info(`${logId}: updating`);

    // if change wasn't made remotely, send it to the number/group
    if (!isSetByOther) {
      try {
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

    source = source || window.ConversationController.getOurConversationId();

    this.set({ expireTimer });

    // This call actually removes universal timer notification and clears
    // the pending flags.
    await this.maybeRemoveUniversalTimer();

    window.Signal.Data.updateConversation(this.attributes);

    // When we add a disappearing messages notification to the conversation, we want it
    //   to be above the message that initiated that change, hence the subtraction.
    const sentAt = (providedSentAt || receivedAtMS) - 1;

    const isNoteToSelf = isMe(this.attributes);
    const shouldBeRead = isNoteToSelf || isInitialSync;

    const model = new window.Whisper.Message({
      conversationId: this.id,
      expirationTimerUpdate: {
        expireTimer,
        source,
        fromSync,
        fromGroupUpdate,
      },
      flags: Proto.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      readStatus: shouldBeRead ? ReadStatus.Read : ReadStatus.Unread,
      received_at_ms: receivedAtMS,
      received_at: receivedAt ?? window.Signal.Util.incrementMessageCounter(),
      seenStatus: shouldBeRead ? SeenStatus.Seen : SeenStatus.Unseen,
      sent_at: sentAt,
      type: 'timer-notification',
      // TODO: DESKTOP-722
    } as unknown as MessageAttributesType);

    const id = await window.Signal.Data.saveMessage(model.attributes, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });

    model.set({ id });

    const message = window.MessageController.register(id, model);

    this.addSingleMessage(message);
    this.updateUnread();

    log.info(
      `${logId}: added a notification received_at=${model.get('received_at')}`
    );

    return message;
  }

  isSearchable(): boolean {
    return !this.get('left');
  }

  // Deprecated: only applies to GroupV1
  async leaveGroup(): Promise<void> {
    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('leaveGroup: Cannot leave v1 group when offline!');
    }

    if (!isGroupV1(this.attributes)) {
      throw new Error(
        `leaveGroup: Group ${this.idForLogging()} is not GroupV1!`
      );
    }

    const now = Date.now();
    const groupId = this.get('groupId');

    if (!groupId) {
      throw new Error(`leaveGroup/${this.idForLogging()}: No groupId!`);
    }

    const groupIdentifiers = this.getRecipients();
    this.set({ left: true });
    window.Signal.Data.updateConversation(this.attributes);

    const model = new window.Whisper.Message({
      conversationId: this.id,
      group_update: { left: 'You' },
      readStatus: ReadStatus.Read,
      received_at_ms: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      seenStatus: SeenStatus.NotApplicable,
      sent_at: now,
      type: 'group',
      // TODO: DESKTOP-722
    } as unknown as MessageAttributesType);

    const id = await window.Signal.Data.saveMessage(model.attributes, {
      ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
    });
    model.set({ id });

    const message = window.MessageController.register(model.id, model);
    this.addSingleMessage(message);

    const options = await getSendOptions(this.attributes);
    message.send(
      handleMessageSend(
        messaging.leaveGroup(groupId, groupIdentifiers, options),
        { messageIds: [], sendType: 'legacyGroupChange' }
      )
    );
  }

  async markRead(
    newestUnreadAt: number,
    options: {
      readAt?: number;
      sendReadReceipts: boolean;
      newestSentAt?: number;
    } = {
      sendReadReceipts: true,
    }
  ): Promise<void> {
    await markConversationRead(this.attributes, newestUnreadAt, options);
    await this.updateUnread();
  }

  async updateUnread(): Promise<void> {
    const unreadCount = await window.Signal.Data.getTotalUnreadForConversation(
      this.id,
      {
        storyId: undefined,
        isGroup: isGroup(this.attributes),
      }
    );

    const prevUnreadCount = this.get('unreadCount');
    if (prevUnreadCount !== unreadCount) {
      this.set({ unreadCount });
      window.Signal.Data.updateConversation(this.attributes);
    }
  }

  // This is an expensive operation we use to populate the message request hero row. It
  //   shows groups the current user has in common with this potential new contact.
  async updateSharedGroups(): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      return;
    }
    if (isMe(this.attributes)) {
      return;
    }

    const ourUuid = window.textsecure.storage.user.getCheckedUuid();
    const theirUuid = this.getUuid();
    if (!theirUuid) {
      return;
    }

    const ourGroups =
      await window.ConversationController.getAllGroupsInvolvingUuid(ourUuid);
    const sharedGroups = ourGroups
      .filter(c => c.hasMember(ourUuid) && c.hasMember(theirUuid))
      .sort(
        (left, right) =>
          (right.get('timestamp') || 0) - (left.get('timestamp') || 0)
      );

    const sharedGroupNames = sharedGroups.map(conversation =>
      conversation.getTitle()
    );

    this.set({ sharedGroupNames });
  }

  onChangeProfileKey(): void {
    if (isDirectConversation(this.attributes)) {
      this.getProfiles();
    }
  }

  async getProfiles(): Promise<void> {
    // request all conversation members' keys
    const conversations =
      this.getMembers() as unknown as Array<ConversationModel>;

    await Promise.all(
      conversations.map(conversation =>
        getProfile(conversation.get('uuid'), conversation.get('e164'))
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
      const change = {
        type: 'name',
        oldName,
        newName,
      };

      await this.addProfileChange(change);
    }
  }

  async setProfileAvatar(
    avatarPath: undefined | null | string,
    decryptionKey: Uint8Array
  ): Promise<void> {
    if (isMe(this.attributes)) {
      if (avatarPath) {
        window.storage.put('avatarUrl', avatarPath);
      } else {
        window.storage.remove('avatarUrl');
      }
    }

    if (!avatarPath) {
      this.set({ profileAvatar: undefined });
      return;
    }

    const { messaging } = window.textsecure;
    if (!messaging) {
      throw new Error('setProfileAvatar: Cannot fetch avatar when offline!');
    }
    const avatar = await messaging.getAvatar(avatarPath);

    // decrypt
    const decrypted = decryptProfile(avatar, decryptionKey);

    // update the conversation avatar only if hash differs
    if (decrypted) {
      const newAttributes = await Conversation.maybeUpdateProfileAvatar(
        this.attributes,
        decrypted,
        {
          writeNewAttachmentData,
          deleteAttachmentData,
          doesAttachmentExist,
        }
      );
      this.set(newAttributes);
    }
  }

  async setProfileKey(
    profileKey: string | undefined,
    { viaStorageServiceSync = false } = {}
  ): Promise<boolean> {
    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKey) {
      log.info(
        `Setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
      );
      this.set({
        profileKeyCredential: null,
        profileKeyCredentialExpiration: null,
        pniCredential: null,
        accessKey: null,
        sealedSender: SEALED_SENDER.UNKNOWN,
      });

      // Don't trigger immediate profile fetches when syncing to remote storage
      this.set({ profileKey }, { silent: viaStorageServiceSync });

      // If our profile key was cleared above, we don't tell our linked devices about it.
      //   We want linked devices to tell us what it should be, instead of telling them to
      //   erase their local value.
      if (!viaStorageServiceSync && profileKey) {
        this.captureChange('profileKey');
      }

      this.deriveAccessKeyIfNeeded();

      // We will update the conversation during storage service sync
      if (!viaStorageServiceSync) {
        window.Signal.Data.updateConversation(this.attributes);
      }

      return true;
    }
    return false;
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

    const profileKeyBuffer = Bytes.fromBase64(profileKey);
    const accessKeyBuffer = deriveAccessKey(profileKeyBuffer);
    const accessKey = Bytes.toBase64(accessKeyBuffer);
    this.set({ accessKey });
  }

  deriveProfileKeyVersion(): string | undefined {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }

    const uuid = this.get('uuid');
    if (!uuid) {
      return;
    }

    const lastProfile = this.get('lastProfile');
    if (lastProfile?.profileKey === profileKey) {
      return lastProfile.profileKeyVersion;
    }

    const profileKeyVersion = Util.zkgroup.deriveProfileKeyVersion(
      profileKey,
      uuid
    );
    if (!profileKeyVersion) {
      log.warn(
        'deriveProfileKeyVersion: Failed to derive profile key version, ' +
          'clearing profile key.'
      );
      this.setProfileKey(undefined);
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

    await window.Signal.Data.updateConversation(this.attributes);
  }

  async removeLastProfile(
    oldValue: ConversationLastProfileType | undefined
  ): Promise<void> {
    // Atomic updates only
    if (this.get('lastProfile') !== oldValue) {
      return;
    }

    log.warn(
      'ConversationModel.removeLastProfile: called for',
      this.idForLogging()
    );

    this.set({
      lastProfile: undefined,

      // We don't have any knowledge of profile anymore. Drop all associated
      // data.
      about: undefined,
      aboutEmoji: undefined,
      profileAvatar: undefined,
    });

    await window.Signal.Data.updateConversation(this.attributes);
  }

  hasMember(uuid: UUID): boolean {
    const members = this.getMembers();

    return members.some(member => member.get('uuid') === uuid.toString());
  }

  fetchContacts(): void {
    const members = this.getMembers();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.contactCollection!.reset(members);
  }

  async destroyMessages(): Promise<void> {
    this.set({
      lastMessage: null,
      timestamp: null,
      active_at: null,
      pendingUniversalTimer: undefined,
    });
    window.Signal.Data.updateConversation(this.attributes);

    await window.Signal.Data.removeAllMessagesInConversation(this.id, {
      logId: this.idForLogging(),
    });
  }

  getTitle(): string {
    if (isDirectConversation(this.attributes)) {
      const username = this.get('username');

      return (
        this.get('name') ||
        this.getProfileName() ||
        this.getNumber() ||
        (username && window.i18n('at-username', { username })) ||
        window.i18n('unknownContact')
      );
    }
    return this.get('name') || window.i18n('unknownGroup');
  }

  getProfileName(): string | undefined {
    if (isDirectConversation(this.attributes)) {
      return Util.combineNames(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('profileName')!,
        this.get('profileFamilyName')
      );
    }

    return undefined;
  }

  getNumber(): string {
    if (!isDirectConversation(this.attributes)) {
      return '';
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const number = this.get('e164')!;
    try {
      const parsedNumber = window.libphonenumberInstance.parse(number);
      const regionCode = getRegionCodeForNumber(number);
      if (regionCode === window.storage.get('regionCode')) {
        return window.libphonenumberInstance.format(
          parsedNumber,
          window.libphonenumberFormat.NATIONAL
        );
      }
      return window.libphonenumberInstance.format(
        parsedNumber,
        window.libphonenumberFormat.INTERNATIONAL
      );
    } catch (e) {
      return number;
    }
  }

  getColor(): AvatarColorType {
    return migrateColor(this.get('color'));
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

  private getAvatarPath(): undefined | string {
    const shouldShowProfileAvatar =
      isMe(this.attributes) ||
      window.storage.get('preferContactAvatars') === false;
    const avatar = shouldShowProfileAvatar
      ? this.get('profileAvatar') || this.get('avatar')
      : this.get('avatar') || this.get('profileAvatar');
    return avatar?.path || undefined;
  }

  private getAvatarHash(): undefined | string {
    const avatar = isMe(this.attributes)
      ? this.get('profileAvatar') || this.get('avatar')
      : this.get('avatar') || this.get('profileAvatar');
    return avatar?.hash || undefined;
  }

  getAbsoluteAvatarPath(): string | undefined {
    const avatarPath = this.getAvatarPath();
    return avatarPath ? getAbsoluteAttachmentPath(avatarPath) : undefined;
  }

  getAbsoluteProfileAvatarPath(): string | undefined {
    const avatarPath = this.get('profileAvatar')?.path;
    return avatarPath ? getAbsoluteAttachmentPath(avatarPath) : undefined;
  }

  getAbsoluteUnblurredAvatarPath(): string | undefined {
    const unblurredAvatarPath = this.get('unblurredAvatarPath');
    return unblurredAvatarPath
      ? getAbsoluteAttachmentPath(unblurredAvatarPath)
      : undefined;
  }

  unblurAvatar(): void {
    const avatarPath = this.getAvatarPath();
    if (avatarPath) {
      this.set('unblurredAvatarPath', avatarPath);
    } else {
      this.unset('unblurredAvatarPath');
    }
  }

  private canChangeTimer(): boolean {
    if (isDirectConversation(this.attributes)) {
      return true;
    }

    if (this.isGroupV1AndDisabled()) {
      return false;
    }

    if (!isGroupV2(this.attributes)) {
      return true;
    }

    const accessControlEnum = Proto.AccessControl.AccessRequired;
    const accessControl = this.get('accessControl');
    const canAnyoneChangeTimer =
      accessControl &&
      (accessControl.attributes === accessControlEnum.ANY ||
        accessControl.attributes === accessControlEnum.MEMBER);
    if (canAnyoneChangeTimer) {
      return true;
    }

    return this.areWeAdmin();
  }

  canEditGroupInfo(): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    if (this.get('left')) {
      return false;
    }

    return (
      this.areWeAdmin() ||
      this.get('accessControl')?.attributes ===
        Proto.AccessControl.AccessRequired.MEMBER
    );
  }

  areWeAdmin(): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    const memberEnum = Proto.Member.Role;
    const members = this.get('membersV2') || [];
    const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
    const me = members.find(item => item.uuid === ourUuid);
    if (!me) {
      return false;
    }

    return me.role === memberEnum.ADMINISTRATOR;
  }

  // Set of items to captureChanges on:
  // [-] uuid
  // [-] e164
  // [X] profileKey
  // [-] identityKey
  // [X] verified!
  // [-] profileName
  // [-] profileFamilyName
  // [X] blocked
  // [X] whitelisted
  // [X] archived
  // [X] markedUnread
  // [X] dontNotifyForMentionsIfMuted
  captureChange(logMessage: string): void {
    log.info('storageService[captureChange]', logMessage, this.idForLogging());
    this.set({ needsStorageServiceSync: true });

    this.queueJob('captureChange', async () => {
      Services.storageServiceUploadJob();
    });
  }

  startMuteTimer({ viaStorageServiceSync = false } = {}): void {
    clearTimeoutIfNecessary(this.muteTimer);
    this.muteTimer = undefined;

    const muteExpiresAt = this.get('muteExpiresAt');
    if (isNumber(muteExpiresAt) && muteExpiresAt < Number.MAX_SAFE_INTEGER) {
      const delay = muteExpiresAt - Date.now();
      if (delay <= 0) {
        this.setMuteExpiration(0, { viaStorageServiceSync });
        return;
      }

      this.muteTimer = setTimeout(() => this.setMuteExpiration(0), delay);
    }
  }

  toggleHideStories(): void {
    this.set({ hideStory: !this.get('hideStory') });
    this.captureChange('hideStory');
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
      window.Signal.Data.updateConversation(this.attributes);
    }
  }

  isMuted(): boolean {
    return isConversationMuted(this.attributes);
  }

  async notify(
    message: Readonly<MessageModel>,
    reaction?: Readonly<ReactionModel>
  ): Promise<void> {
    // As a performance optimization don't perform any work if notifications are
    // disabled.
    if (!notificationService.isEnabled) {
      return;
    }

    if (this.isMuted()) {
      if (this.get('dontNotifyForMentionsIfMuted')) {
        return;
      }

      const ourUuid = window.textsecure.storage.user.getUuid()?.toString();
      const mentionsMe = (message.get('bodyRanges') || []).some(
        range => range.mentionUuid && range.mentionUuid === ourUuid
      );
      if (!mentionsMe) {
        return;
      }
    }

    if (!isIncoming(message.attributes) && !reaction) {
      return;
    }

    const conversationId = this.id;

    const sender = reaction
      ? window.ConversationController.get(reaction.get('fromId'))
      : getContact(message.attributes);
    const senderName = sender
      ? sender.getTitle()
      : window.i18n('unknownContact');
    const senderTitle = isDirectConversation(this.attributes)
      ? senderName
      : window.i18n('notificationSenderInGroup', {
          sender: senderName,
          group: this.getTitle(),
        });

    let notificationIconUrl;
    const avatar = this.get('avatar') || this.get('profileAvatar');
    if (avatar && avatar.path) {
      notificationIconUrl = getAbsoluteAttachmentPath(avatar.path);
    } else if (isDirectConversation(this.attributes)) {
      notificationIconUrl = await this.getIdenticon();
    } else {
      // Not technically needed, but helps us be explicit: we don't show an icon for a
      //   group that doesn't have an icon.
      notificationIconUrl = undefined;
    }

    const messageJSON = message.toJSON();
    const messageId = message.id;
    const isExpiringMessage = Message.hasExpiration(messageJSON);

    notificationService.add({
      senderTitle,
      conversationId,
      notificationIconUrl,
      isExpiringMessage,
      message: message.getNotificationText(),
      messageId,
      reaction: reaction ? reaction.toJSON() : null,
    });
  }

  private async getIdenticon(): Promise<string> {
    const color = this.getColor();
    const title = this.getTitle();

    const content = (title && getInitials(title)) || '#';

    const cached = this.cachedIdenticon;
    if (cached && cached.content === content && cached.color === color) {
      return cached.url;
    }

    const url = await createIdenticon(color, content);

    this.cachedIdenticon = { content, color, url };

    return url;
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

    const senderUuid = sender.getUuid();
    if (!senderUuid) {
      return;
    }

    // Drop typing indicators for announcement only groups where the sender
    // is not an admin
    if (this.get('announcementsOnly') && !this.isAdmin(senderUuid)) {
      return;
    }

    const typingToken = `${senderId}.${senderDevice}`;

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
      if (!record) {
        // User was not previously typing before. State change!
        this.trigger('change', this, { force: true });
      }
    } else {
      delete this.contactTypingTimers[typingToken];
      if (record) {
        // User was previously typing, and is no longer. State change!
        this.trigger('change', this, { force: true });
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
      this.trigger('change', this, { force: true });
    }
  }

  pin(): void {
    if (this.get('isPinned')) {
      return;
    }

    log.info('pinning', this.idForLogging());
    const pinnedConversationIds = new Set(
      window.storage.get('pinnedConversationIds', new Array<string>())
    );

    pinnedConversationIds.add(this.id);

    this.writePinnedConversations([...pinnedConversationIds]);

    this.set('isPinned', true);

    if (this.get('isArchived')) {
      this.set({ isArchived: false });
    }
    window.Signal.Data.updateConversation(this.attributes);
  }

  unpin(): void {
    if (!this.get('isPinned')) {
      return;
    }

    log.info('un-pinning', this.idForLogging());

    const pinnedConversationIds = new Set(
      window.storage.get('pinnedConversationIds', new Array<string>())
    );

    pinnedConversationIds.delete(this.id);

    this.writePinnedConversations([...pinnedConversationIds]);

    this.set('isPinned', false);
    window.Signal.Data.updateConversation(this.attributes);
  }

  writePinnedConversations(pinnedConversationIds: Array<string>): void {
    window.storage.put('pinnedConversationIds', pinnedConversationIds);

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
    window.Signal.Data.updateConversation(this.attributes);
    this.captureChange('dontNotifyForMentionsIfMuted');
  }

  acknowledgeGroupMemberNameCollisions(
    groupNameCollisions: Readonly<GroupNameCollisionsWithIdsByTitle>
  ): void {
    this.set('acknowledgedGroupNameCollisions', groupNameCollisions);
    window.Signal.Data.updateConversation(this.attributes);
  }

  onOpenStart(): void {
    log.info(`conversation ${this.idForLogging()} open start`);
    window.ConversationController.onConvoOpenStart(this.id);
  }

  onOpenComplete(startedAt: number): void {
    const now = Date.now();
    const delta = now - startedAt;

    log.info(`conversation ${this.idForLogging()} open took ${delta}ms`);
    window.CI?.handleEvent('conversation:open', { delta });
  }

  async flushDebouncedUpdates(): Promise<void> {
    try {
      await this.debouncedUpdateLastMessage?.flush();
    } catch (error) {
      const logId = this.idForLogging();
      log.error(
        `flushDebouncedUpdates(${logId}): got error`,
        Errors.toLogFormat(error)
      );
    }
  }
}

window.Whisper.Conversation = ConversationModel;

window.Whisper.ConversationCollection = window.Backbone.Collection.extend({
  model: window.Whisper.Conversation,

  /**
   * window.Backbone defines a `_byId` field. Here we set up additional `_byE164`,
   * `_byUuid`, and `_byGroupId` fields so we can track conversations by more
   * than just their id.
   */
  initialize() {
    this.eraseLookups();
    this.on(
      'idUpdated',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (model: ConversationModel, idProp: string, oldValue: any) => {
        if (oldValue) {
          if (idProp === 'e164') {
            delete this._byE164[oldValue];
          }
          if (idProp === 'uuid') {
            delete this._byUuid[oldValue];
          }
          if (idProp === 'pni') {
            delete this._byPni[oldValue];
          }
          if (idProp === 'groupId') {
            delete this._byGroupId[oldValue];
          }
        }
        const e164 = model.get('e164');
        if (e164) {
          this._byE164[e164] = model;
        }
        const uuid = model.get('uuid');
        if (uuid) {
          this._byUuid[uuid] = model;
        }
        const pni = model.get('pni');
        if (pni) {
          this._byPni[pni] = model;
        }
        const groupId = model.get('groupId');
        if (groupId) {
          this._byGroupId[groupId] = model;
        }
      }
    );
  },

  reset(models?: Array<ConversationModel>, options?: Backbone.Silenceable) {
    window.Backbone.Collection.prototype.reset.call(this, models, options);
    this.resetLookups();
  },

  resetLookups() {
    this.eraseLookups();
    this.generateLookups(this.models);
  },

  generateLookups(models: ReadonlyArray<ConversationModel>) {
    models.forEach(model => {
      const e164 = model.get('e164');
      if (e164) {
        const existing = this._byE164[e164];

        // Prefer the contact with both e164 and uuid
        if (!existing || (existing && !existing.get('uuid'))) {
          this._byE164[e164] = model;
        }
      }

      const uuid = model.get('uuid');
      if (uuid) {
        const existing = this._byUuid[uuid];

        // Prefer the contact with both e164 and uuid
        if (!existing || (existing && !existing.get('e164'))) {
          this._byUuid[uuid] = model;
        }
      }

      const pni = model.get('pni');
      if (pni) {
        const existing = this._byPni[pni];

        // Prefer the contact with both uuid and pni
        if (!existing || (existing && !existing.get('uuid'))) {
          this._byPni[pni] = model;
        }
      }

      const groupId = model.get('groupId');
      if (groupId) {
        this._byGroupId[groupId] = model;
      }
    });
  },

  eraseLookups() {
    this._byE164 = Object.create(null);
    this._byUuid = Object.create(null);
    this._byPni = Object.create(null);
    this._byGroupId = Object.create(null);
  },

  add(
    data:
      | ConversationModel
      | ConversationAttributesType
      | Array<ConversationModel>
      | Array<ConversationAttributesType>
  ) {
    let hydratedData: Array<ConversationModel> | ConversationModel;

    // First, we need to ensure that the data we're working with is Conversation models
    if (Array.isArray(data)) {
      hydratedData = [];
      for (let i = 0, max = data.length; i < max; i += 1) {
        const item = data[i];

        // We create a new model if it's not already a model
        if (has(item, 'get')) {
          hydratedData.push(item as ConversationModel);
        } else {
          hydratedData.push(
            new window.Whisper.Conversation(item as ConversationAttributesType)
          );
        }
      }
    } else if (has(data, 'get')) {
      hydratedData = data as ConversationModel;
    } else {
      hydratedData = new window.Whisper.Conversation(
        data as ConversationAttributesType
      );
    }

    // Next, we update our lookups first to prevent infinite loops on the 'add' event
    this.generateLookups(
      Array.isArray(hydratedData) ? hydratedData : [hydratedData]
    );

    // Lastly, we fire off the add events related to this change
    // Go home Backbone, you're drunk.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.Backbone.Collection.prototype.add.call(this, hydratedData as any);

    return hydratedData;
  },

  /**
   * window.Backbone collections have a `_byId` field that `get` defers to. Here, we
   * override `get` to first access our custom `_byE164`, `_byUuid`, and
   * `_byGroupId` functions, followed by falling back to the original
   * window.Backbone implementation.
   */
  get(id: string) {
    return (
      this._byE164[id] ||
      this._byE164[`+${id}`] ||
      this._byUuid[id] ||
      this._byPni[id] ||
      this._byGroupId[id] ||
      window.Backbone.Collection.prototype.get.call(this, id)
    );
  },

  comparator(m: ConversationModel) {
    return -(m.get('active_at') || 0);
  },
});

type SortableByTitle = {
  getTitle: () => string;
};

const sortConversationTitles = (
  left: SortableByTitle,
  right: SortableByTitle,
  collator: Intl.Collator
) => {
  return collator.compare(left.getTitle(), right.getTitle());
};
