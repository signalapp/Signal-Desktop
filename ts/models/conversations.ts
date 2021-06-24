// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import { ProfileKeyCredentialRequestContext } from 'zkgroup';
import { compact, sample } from 'lodash';
import {
  MessageModelCollectionType,
  WhatIsThis,
  MessageAttributesType,
  ReactionModelType,
  ConversationAttributesType,
  VerificationOptions,
} from '../model-types.d';
import { CallMode, CallHistoryDetailsType } from '../types/Calling';
import { CallbackResultType, GroupV2InfoType } from '../textsecure/SendMessage';
import { ConversationType } from '../state/ducks/conversations';
import {
  AvatarColorType,
  AvatarColors,
  ConversationColorType,
  CustomColorType,
  DEFAULT_CONVERSATION_COLOR,
} from '../types/Colors';
import { MessageModel } from './messages';
import { isMuted } from '../util/isMuted';
import { isConversationSMSOnly } from '../util/isConversationSMSOnly';
import { isConversationUnregistered } from '../util/isConversationUnregistered';
import { missingCaseError } from '../util/missingCaseError';
import { sniffImageMimeType } from '../util/sniffImageMimeType';
import { MIMEType, IMAGE_WEBP } from '../types/MIME';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveAccessKey,
  fromEncodedBinaryToArrayBuffer,
  stringFromBytes,
  trimForDisplay,
  verifyAccessKey,
} from '../Crypto';
import * as Bytes from '../Bytes';
import { DataMessageClass } from '../textsecure.d';
import { BodyRangesType } from '../types/Util';
import { getTextWithMentions } from '../util';
import { migrateColor } from '../util/migrateColor';
import { isNotNil } from '../util/isNotNil';
import { ourProfileKeyService } from '../services/ourProfileKey';
import { getSendOptions } from '../util/getSendOptions';
import { isConversationAccepted } from '../util/isConversationAccepted';
import { markConversationRead } from '../util/markConversationRead';
import { handleMessageSend } from '../util/handleMessageSend';
import { getConversationMembers } from '../util/getConversationMembers';
import { sendReadReceiptsFor } from '../util/sendReadReceiptsFor';
import { updateConversationsWithUuidLookup } from '../updateConversationsWithUuidLookup';
import { filter, map, take } from '../util/iterables';
import * as universalExpireTimer from '../util/universalExpireTimer';
import { GroupNameCollisionsWithIdsByTitle } from '../util/groupMemberNameCollisions';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
  isMe,
} from '../util/whatTypeOfConversation';
import { deprecated } from '../util/deprecated';
import { SignalService as Proto } from '../protobuf';
import {
  hasErrors,
  isIncoming,
  isTapToView,
  getMessagePropStatus,
} from '../state/selectors/message';
import { Deletes } from '../messageModifiers/Deletes';
import { Reactions } from '../messageModifiers/Reactions';

// TODO: remove once we move away from ArrayBuffers
const FIXMEU8 = Uint8Array;

/* eslint-disable more/no-then */
window.Whisper = window.Whisper || {};

const SEALED_SENDER = {
  UNKNOWN: 0,
  ENABLED: 1,
  DISABLED: 2,
  UNRESTRICTED: 3,
};

const { Services, Util } = window.Signal;
const { Contact, Message } = window.Signal.Types;
const {
  deleteAttachmentData,
  doesAttachmentExist,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
  readStickerData,
  upgradeMessageSchema,
  writeNewAttachmentData,
} = window.Signal.Migrations;
const { addStickerPackReference } = window.Signal.Data;

const THREE_HOURS = 3 * 60 * 60 * 1000;
const FIVE_MINUTES = 1000 * 60 * 5;

const JOB_REPORTING_THRESHOLD_MS = 25;

const ATTRIBUTES_THAT_DONT_INVALIDATE_PROPS_CACHE = new Set([
  'profileLastFetchedAt',
]);

type CustomError = Error & {
  identifier?: string;
  number?: string;
};

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

  debouncedUpdateLastMessage?: () => void;

  // backbone ensures this exists
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  id: string;

  initialPromise?: Promise<unknown>;

  inProgressFetch?: Promise<unknown>;

  incomingMessageQueue?: typeof window.PQueueType;

  jobQueue?: typeof window.PQueueType;

  ourNumber?: string;

  ourUuid?: string;

  storeName?: string | null;

  throttledBumpTyping: unknown;

  throttledFetchSMSOnlyUUID?: () => Promise<void> | void;

  throttledMaybeMigrateV1Group?: () => Promise<void> | void;

  typingRefreshTimer?: NodeJS.Timer | null;

  typingPauseTimer?: NodeJS.Timer | null;

  verifiedEnum?: typeof window.textsecure.storage.protocol.VerifiedStatus;

  intlCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

  lastSuccessfulGroupFetch?: number;

  throttledUpdateSharedGroups?: () => Promise<void>;

  private cachedLatestGroupCallEraId?: string;

  private cachedIdenticon?: CachedIdenticon;

  private isFetchingUUID?: boolean;

  private hasAddedHistoryDisclaimer?: boolean;

  // eslint-disable-next-line class-methods-use-this
  defaults(): Partial<ConversationAttributesType> {
    return {
      unreadCount: 0,
      verified: window.textsecure.storage.protocol.VerifiedStatus.DEFAULT,
      messageCount: 0,
      sentMessageCount: 0,
    };
  }

  idForLogging(): string {
    if (isDirectConversation(this.attributes)) {
      const uuid = this.get('uuid');
      const e164 = this.get('e164');
      return `${uuid || e164} (${this.id})`;
    }
    if (isGroupV2(this.attributes)) {
      return `groupv2(${this.get('groupId')})`;
    }

    const groupId = this.get('groupId');
    return `group(${groupId})`;
  }

  // This is one of the few times that we want to collapse our uuid/e164 pair down into
  //   just one bit of data. If we have a UUID, we'll send using it.
  getSendTarget(): string | undefined {
    return this.get('uuid') || this.get('e164');
  }

  // eslint-disable-next-line class-methods-use-this
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

  initialize(attributes: Partial<ConversationAttributesType> = {}): void {
    if (window.isValidE164(attributes.id)) {
      this.set({ id: window.getGuid(), e164: attributes.id });
    }

    this.storeName = 'conversations';

    this.ourNumber = window.textsecure.storage.user.getNumber();
    this.ourUuid = window.textsecure.storage.user.getUuid();
    this.verifiedEnum = window.textsecure.storage.protocol.VerifiedStatus;

    // This may be overridden by window.ConversationController.getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();

    this.throttledBumpTyping = window._.throttle(this.bumpTyping, 300);
    this.debouncedUpdateLastMessage = window._.debounce(
      this.updateLastMessage.bind(this),
      200
    );
    this.throttledUpdateSharedGroups =
      this.throttledUpdateSharedGroups ||
      window._.throttle(this.updateSharedGroups.bind(this), FIVE_MINUTES);

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
    this.on('change', () => {
      const changedKeys = Object.keys(this.changed || {});
      const isPropsCacheStillValid = Boolean(
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
    });

    // Set `isFetchingUUID` eagerly to avoid UI flicker when opening the
    // conversation for the first time.
    this.isFetchingUUID = this.isSMSOnly();

    this.throttledFetchSMSOnlyUUID = window._.throttle(
      this.fetchSMSOnlyUUID.bind(this),
      FIVE_MINUTES
    );
    this.throttledMaybeMigrateV1Group = window._.throttle(
      this.maybeMigrateV1Group.bind(this),
      FIVE_MINUTES
    );

    // Ensure each contact has a an avatar color associated with it
    if (!this.get('color')) {
      this.set('color', sample(AvatarColors));
      window.Signal.Data.updateConversation(this.attributes);
    }
  }

  isPrivate(): boolean {
    deprecated('isPrivate()');
    return isDirectConversation(this.attributes);
  }

  isMemberRequestingToJoin(conversationId: string): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingAdminApprovalV2 = this.get('pendingAdminApprovalV2');

    if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
      return false;
    }

    return pendingAdminApprovalV2.some(
      item => item.conversationId === conversationId
    );
  }

  isMemberPending(conversationId: string): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingMembersV2 = this.get('pendingMembersV2');

    if (!pendingMembersV2 || !pendingMembersV2.length) {
      return false;
    }

    return window._.any(
      pendingMembersV2,
      item => item.conversationId === conversationId
    );
  }

  isMemberAwaitingApproval(conversationId: string): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }
    const pendingAdminApprovalV2 = this.get('pendingAdminApprovalV2');

    if (!pendingAdminApprovalV2 || !pendingAdminApprovalV2.length) {
      return false;
    }

    return window._.any(
      pendingAdminApprovalV2,
      item => item.conversationId === conversationId
    );
  }

  isMember(conversationId: string): boolean {
    if (!isGroupV2(this.attributes)) {
      throw new Error(
        `isMember: Called for non-GroupV2 conversation ${this.idForLogging()}`
      );
    }
    const membersV2 = this.get('membersV2');

    if (!membersV2 || !membersV2.length) {
      return false;
    }

    return window._.any(
      membersV2,
      item => item.conversationId === conversationId
    );
  }

  async updateExpirationTimerInGroupV2(
    seconds?: number
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();
    const current = this.get('expireTimer');
    const bothFalsey = Boolean(current) === false && Boolean(seconds) === false;

    if (current === seconds || bothFalsey) {
      window.log.warn(
        `updateExpirationTimerInGroupV2/${idLog}: Requested timer ${seconds} is unchanged from existing ${current}.`
      );
      return undefined;
    }

    return window.Signal.Groups.buildDisappearingMessagesTimerChange({
      expireTimer: seconds || 0,
      group: this.attributes,
    });
  }

  async promotePendingMember(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberPending(conversationId)) {
      window.log.warn(
        `promotePendingMember/${idLog}: ${conversationId} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      throw new Error(
        `promotePendingMember/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    // We need the user's profileKeyCredential, which requires a roundtrip with the
    //   server, and most definitely their profileKey. A getProfiles() call will
    //   ensure that we have as much as we can get with the data we have.
    let profileKeyCredentialBase64 = pendingMember.get('profileKeyCredential');
    if (!profileKeyCredentialBase64) {
      await pendingMember.getProfiles();

      profileKeyCredentialBase64 = pendingMember.get('profileKeyCredential');
      if (!profileKeyCredentialBase64) {
        throw new Error(
          `promotePendingMember/${idLog}: No profileKeyCredential for conversation ${pendingMember.idForLogging()}`
        );
      }
    }

    return window.Signal.Groups.buildPromoteMemberChange({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async approvePendingApprovalRequest(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberRequestingToJoin(conversationId)) {
      window.log.warn(
        `approvePendingApprovalRequest/${idLog}: ${conversationId} is not requesting to join the group. Returning early.`
      );
      return undefined;
    }

    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      throw new Error(
        `approvePendingApprovalRequest/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = pendingMember.get('uuid');
    if (!uuid) {
      throw new Error(
        `approvePendingApprovalRequest/${idLog}: Missing uuid for conversation ${conversationId}`
      );
    }

    return window.Signal.Groups.buildPromotePendingAdminApprovalMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  async denyPendingApprovalRequest(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMemberRequestingToJoin(conversationId)) {
      window.log.warn(
        `denyPendingApprovalRequest/${idLog}: ${conversationId} is not requesting to join the group. Returning early.`
      );
      return undefined;
    }

    const pendingMember = window.ConversationController.get(conversationId);
    if (!pendingMember) {
      throw new Error(
        `denyPendingApprovalRequest/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = pendingMember.get('uuid');
    if (!uuid) {
      throw new Error(
        `denyPendingApprovalRequest/${idLog}: Missing uuid for conversation ${pendingMember.idForLogging()}`
      );
    }

    return window.Signal.Groups.buildDeletePendingAdminApprovalMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  async addPendingApprovalRequest(): Promise<
    Proto.GroupChange.Actions | undefined
  > {
    const idLog = this.idForLogging();

    // Hard-coded to our own ID, because you don't add other users for admin approval
    const conversationId = window.ConversationController.getOurConversationIdOrThrow();

    const toRequest = window.ConversationController.get(conversationId);
    if (!toRequest) {
      throw new Error(
        `addPendingApprovalRequest/${idLog}: No conversation found for conversation ${conversationId}`
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
          `promotePendingMember/${idLog}: No profileKeyCredential for conversation ${toRequest.idForLogging()}`
        );
      }
    }

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (this.isMemberAwaitingApproval(conversationId)) {
      window.log.warn(
        `addPendingApprovalRequest/${idLog}: ${conversationId} already in pending approval.`
      );
      return undefined;
    }

    return window.Signal.Groups.buildAddPendingAdminApprovalMemberChange({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async addMember(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const toRequest = window.ConversationController.get(conversationId);
    if (!toRequest) {
      throw new Error(
        `addMember/${idLog}: No conversation found for conversation ${conversationId}`
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
    if (this.isMember(conversationId)) {
      window.log.warn(
        `addMember/${idLog}: ${conversationId} already a member.`
      );
      return undefined;
    }

    return window.Signal.Groups.buildAddMember({
      group: this.attributes,
      profileKeyCredentialBase64,
      serverPublicParamsBase64: window.getServerPublicParams(),
    });
  }

  async removePendingMember(
    conversationIds: Array<string>
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    const uuids = conversationIds
      .map(conversationId => {
        // This user's pending state may have changed in the time between the user's
        //   button press and when we get here. It's especially important to check here
        //   in conflict/retry cases.
        if (!this.isMemberPending(conversationId)) {
          window.log.warn(
            `removePendingMember/${idLog}: ${conversationId} is not a pending member of group. Returning early.`
          );
          return undefined;
        }

        const pendingMember = window.ConversationController.get(conversationId);
        if (!pendingMember) {
          window.log.warn(
            `removePendingMember/${idLog}: No conversation found for conversation ${conversationId}`
          );
          return undefined;
        }

        const uuid = pendingMember.get('uuid');
        if (!uuid) {
          window.log.warn(
            `removePendingMember/${idLog}: Missing uuid for conversation ${pendingMember.idForLogging()}`
          );
          return undefined;
        }
        return uuid;
      })
      .filter((uuid): uuid is string => Boolean(uuid));

    if (!uuids.length) {
      return undefined;
    }

    return window.Signal.Groups.buildDeletePendingMemberChange({
      group: this.attributes,
      uuids,
    });
  }

  async removeMember(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    const idLog = this.idForLogging();

    // This user's pending state may have changed in the time between the user's
    //   button press and when we get here. It's especially important to check here
    //   in conflict/retry cases.
    if (!this.isMember(conversationId)) {
      window.log.warn(
        `removeMember/${idLog}: ${conversationId} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const member = window.ConversationController.get(conversationId);
    if (!member) {
      throw new Error(
        `removeMember/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = member.get('uuid');
    if (!uuid) {
      throw new Error(
        `removeMember/${idLog}: Missing uuid for conversation ${member.idForLogging()}`
      );
    }

    return window.Signal.Groups.buildDeleteMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  async toggleAdminChange(
    conversationId: string
  ): Promise<Proto.GroupChange.Actions | undefined> {
    if (!isGroupV2(this.attributes)) {
      return undefined;
    }

    const idLog = this.idForLogging();

    if (!this.isMember(conversationId)) {
      window.log.warn(
        `toggleAdminChange/${idLog}: ${conversationId} is not a pending member of group. Returning early.`
      );
      return undefined;
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error(
        `toggleAdminChange/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = conversation.get('uuid');
    if (!uuid) {
      throw new Error(
        `toggleAdminChange/${idLog}: Missing uuid for conversation ${conversationId}`
      );
    }

    const MEMBER_ROLES = window.textsecure.protobuf.Member.Role;

    const role = this.isAdmin(conversationId)
      ? MEMBER_ROLES.DEFAULT
      : MEMBER_ROLES.ADMINISTRATOR;

    return window.Signal.Groups.buildModifyMemberRoleChange({
      group: this.attributes,
      uuid,
      role,
    });
  }

  async modifyGroupV2({
    createGroupChange,
    extraConversationsForSend,
    inviteLinkPassword,
    name,
  }: {
    createGroupChange: () => Promise<Proto.GroupChange.Actions | undefined>;
    extraConversationsForSend?: Array<string>;
    inviteLinkPassword?: string;
    name: string;
  }): Promise<void> {
    await window.Signal.Groups.modifyGroupV2({
      conversation: this,
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
    window.log.info(`Conversation ${this.idForLogging()} is now unregistered`);
    this.set({
      discoveredUnregisteredAt: Date.now(),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  setRegistered(): void {
    if (this.get('discoveredUnregisteredAt') === undefined) {
      return;
    }

    window.log.info(
      `Conversation ${this.idForLogging()} is registered once again`
    );
    this.set({
      discoveredUnregisteredAt: undefined,
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  isGroupV1AndDisabled(): boolean {
    return (
      isGroupV1(this.attributes) &&
      window.Signal.RemoteConfig.isEnabled('desktop.disableGV1')
    );
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
    const isBlocked = this.isBlocked();

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

    if (!viaStorageServiceSync && !isBlocked && blocked) {
      this.captureChange('block');
    }
  }

  unblock({ viaStorageServiceSync = false } = {}): boolean {
    let unblocked = false;
    const isBlocked = this.isBlocked();

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

    if (!viaStorageServiceSync && isBlocked && unblocked) {
      this.captureChange('unblock');
    }

    return unblocked;
  }

  enableProfileSharing({ viaStorageServiceSync = false } = {}): void {
    const before = this.get('profileSharing');

    this.set({ profileSharing: true });

    const after = this.get('profileSharing');

    if (!viaStorageServiceSync && Boolean(before) !== Boolean(after)) {
      this.captureChange('enableProfileSharing');
    }
  }

  disableProfileSharing({ viaStorageServiceSync = false } = {}): void {
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
    if (!window.storage.get('typingIndicators')) {
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
    if (this.typingRefreshTimer) {
      clearTimeout(this.typingRefreshTimer);
    }
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
    if (this.typingPauseTimer) {
      clearTimeout(this.typingPauseTimer);
    }
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
    if (this.typingPauseTimer) {
      clearTimeout(this.typingPauseTimer);
      this.typingPauseTimer = null;
    }
    if (this.typingRefreshTimer) {
      clearTimeout(this.typingRefreshTimer);
      this.typingRefreshTimer = null;
    }
  }

  async fetchLatestGroupV2Data(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    await window.Signal.Groups.waitThenMaybeUpdateGroup({
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

    window.log.info(
      `Fetching uuid for a sms-only conversation ${this.idForLogging()}`
    );

    this.isFetchingUUID = true;
    this.trigger('change', this);

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
      this.trigger('change', this);

      window.log.info(
        `Done fetching uuid for a sms-only conversation ${this.idForLogging()}`
      );
    }

    if (!this.get('uuid')) {
      return;
    }

    // On successful fetch - mark contact as registered.
    this.setRegistered();

    // If we couldn't apply universal timer before - try it again.
    this.queueJob('maybeSetPendingUniversalTimer', () =>
      this.maybeSetPendingUniversalTimer()
    );
  }

  isValid(): boolean {
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

    window.log.info(`Repairing GroupV2 conversation ${this.idForLogging()}`);
    const { masterKey, secretParams, publicParams } = data;

    this.set({ masterKey, secretParams, publicParams, groupVersion: 2 });

    window.Signal.Data.updateConversation(this.attributes);
  }

  getGroupV2Info({
    groupChange,
    includePendingMembers,
    extraConversationsForSend,
  }: {
    groupChange?: ArrayBuffer;
    includePendingMembers?: boolean;
    extraConversationsForSend?: Array<string>;
  } = {}): GroupV2InfoType | undefined {
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
      members: this.getRecipients({
        includePendingMembers,
        extraConversationsForSend,
      }),
      groupChange: groupChange ? new FIXMEU8(groupChange) : undefined,
    };
  }

  getGroupV1Info(): WhatIsThis {
    if (
      isDirectConversation(this.attributes) ||
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.get('groupVersion')! > 0
    ) {
      return undefined;
    }

    return {
      id: this.get('groupId'),
      members: this.getRecipients(),
    };
  }

  getGroupIdBuffer(): ArrayBuffer | undefined {
    const groupIdString = this.get('groupId');

    if (!groupIdString) {
      return undefined;
    }

    if (isGroupV1(this.attributes)) {
      return fromEncodedBinaryToArrayBuffer(groupIdString);
    }
    if (isGroupV2(this.attributes)) {
      return base64ToArrayBuffer(groupIdString);
    }

    return undefined;
  }

  async sendTypingMessage(isTyping: boolean): Promise<void> {
    if (!window.textsecure.messaging) {
      return;
    }

    // We don't send typing messages to our other devices
    if (isMe(this.attributes)) {
      return;
    }

    await this.queueJob('sendTypingMessage', async () => {
      const recipientId = isDirectConversation(this.attributes)
        ? this.getSendTarget()
        : undefined;
      const groupId = this.getGroupIdBuffer();
      const groupMembers = this.getRecipients();

      // We don't send typing messages if our recipients list is empty
      if (!isDirectConversation(this.attributes) && !groupMembers.length) {
        return;
      }

      const timestamp = Date.now();
      const contentMessage = window.textsecure.messaging.getTypingContentMessage(
        {
          recipientId,
          groupId,
          groupMembers,
          isTyping,
          timestamp,
        }
      );

      const {
        ContentHint,
      } = window.textsecure.protobuf.UnidentifiedSenderMessage.Message;
      const sendOptions = await getSendOptions(this.attributes);
      if (isDirectConversation(this.attributes)) {
        handleMessageSend(
          window.textsecure.messaging.sendMessageProtoAndWait(
            timestamp,
            groupMembers,
            contentMessage,
            ContentHint.IMPLICIT,
            undefined,
            {
              ...sendOptions,
              online: true,
            }
          )
        );
      } else {
        handleMessageSend(
          window.Signal.Util.sendContentMessageToGroup({
            contentHint: ContentHint.IMPLICIT,
            contentMessage,
            conversation: this,
            online: true,
            recipients: groupMembers,
            sendOptions,
            timestamp,
          })
        );
      }
    });
  }

  async cleanup(): Promise<void> {
    await window.Signal.Types.Conversation.deleteExternalFiles(
      this.attributes,
      {
        deleteAttachmentData,
      }
    );
  }

  async onNewMessage(message: MessageModel): Promise<void> {
    const uuid = message.get('sourceUuid');
    const e164 = message.get('source');
    const sourceDevice = message.get('sourceDevice');

    const sourceId = window.ConversationController.ensureContactIds({
      uuid,
      e164,
    });
    const typingToken = `${sourceId}.${sourceDevice}`;

    // Clear typing indicator for a given contact if we receive a message from them
    this.clearContactTypingTimer(typingToken);

    this.addSingleMessage(message);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.debouncedUpdateLastMessage!();
  }

  addSingleMessage(message: MessageModel): MessageModel {
    const { messagesAdded } = window.reduxActions.conversations;
    const isNewMessage = true;
    messagesAdded(
      this.id,
      [{ ...message.attributes }],
      isNewMessage,
      window.isActive()
    );

    return message;
  }

  // For incoming messages, they might arrive while we're in the middle of a bulk fetch
  //   from the database. We'll wait until that is done to process this newly-arrived
  //   message.
  addIncomingMessage(message: MessageModel): void {
    if (!this.incomingMessageQueue) {
      this.incomingMessageQueue = new window.PQueue({
        concurrency: 1,
        timeout: 1000 * 60 * 2,
      });
    }

    // We use a queue here to ensure messages are added to the UI in the order received
    this.incomingMessageQueue.add(async () => {
      await this.inProgressFetch;

      this.addSingleMessage(message);
    });
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
      window.log.warn(
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

    const typingValues = window._.values(this.contactTypingTimers || {});
    const typingMostRecent = window._.first(
      window._.sortBy(typingValues, 'timestamp')
    );
    const typingContact = typingMostRecent
      ? window.ConversationController.get(typingMostRecent.senderId)
      : null;

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
    const ourConversationId = window.ConversationController.getOurConversationId();

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
          .filter((member): member is ConversationType => member !== null)
      : undefined;

    const { customColor, customColorId } = this.getCustomColorData();

    // TODO: DESKTOP-720
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const result: ConversationType = {
      id: this.id,
      uuid: this.get('uuid'),
      e164: this.get('e164'),

      about: this.getAboutText(),
      acceptedMessageRequest: this.getAccepted(),
      activeAt: this.get('active_at')!,
      areWePending: Boolean(
        ourConversationId && this.isMemberPending(ourConversationId)
      ),
      areWePendingApproval: Boolean(
        ourConversationId && this.isMemberAwaitingApproval(ourConversationId)
      ),
      areWeAdmin: this.areWeAdmin(),
      canChangeTimer: this.canChangeTimer(),
      canEditGroupInfo: this.canEditGroupInfo(),
      avatarPath: this.getAbsoluteAvatarPath(),
      unblurredAvatarPath: this.getAbsoluteUnblurredAvatarPath(),
      color,
      conversationColor: this.getConversationColor(),
      customColor,
      customColorId,
      discoveredUnregisteredAt: this.get('discoveredUnregisteredAt'),
      draftBodyRanges,
      draftPreview,
      draftText,
      firstName: this.get('profileName')!,
      groupDescription: this.get('description'),
      groupVersion,
      groupId: this.get('groupId'),
      groupLink: this.getGroupLink(),
      inboxPosition,
      isArchived: this.get('isArchived')!,
      isBlocked: this.isBlocked(),
      isMe: isMe(this.attributes),
      isGroupV1AndDisabled: this.isGroupV1AndDisabled(),
      isGroupV2Capable: isDirectConversation(this.attributes)
        ? Boolean(this.get('capabilities')?.gv2)
        : undefined,
      isPinned: this.get('isPinned'),
      isUntrusted: this.isUntrusted(),
      isVerified: this.isVerified(),
      isFetchingUUID: this.isFetchingUUID,
      lastMessage: {
        status: this.get('lastMessageStatus')!,
        text: this.get('lastMessage')!,
        deletedForEveryone: this.get('lastMessageDeletedForEveryone')!,
      },
      lastUpdated: this.get('timestamp')!,
      left: Boolean(this.get('left')),
      markedUnread: this.get('markedUnread')!,
      membersCount: this.getMembersCount(),
      memberships: this.getMemberships(),
      messageCount: this.get('messageCount') || 0,
      pendingMemberships: this.getPendingMemberships(),
      pendingApprovalMemberships: this.getPendingApprovalMemberships(),
      messageRequestsEnabled,
      accessControlAddFromInviteLink: this.get('accessControl')
        ?.addFromInviteLink,
      accessControlAttributes: this.get('accessControl')?.attributes,
      accessControlMembers: this.get('accessControl')?.members,
      expireTimer: this.get('expireTimer'),
      muteExpiresAt: this.get('muteExpiresAt')!,
      name: this.get('name')!,
      phoneNumber: this.getNumber()!,
      profileName: this.getProfileName()!,
      profileSharing: this.get('profileSharing'),
      publicParams: this.get('publicParams'),
      secretParams: this.get('secretParams'),
      shouldShowDraft,
      sortedGroupMembers,
      timestamp,
      title: this.getTitle()!,
      searchableTitle: isMe(this.attributes)
        ? window.i18n('noteToSelf')
        : this.getTitle(),
      unreadCount: this.get('unreadCount')! || 0,
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

    if (typingContact) {
      // We don't want to call .format() on our own conversation
      if (typingContact.id === this.id) {
        result.typingContact = result;
      } else {
        result.typingContact = typingContact.format();
      }
    }
    /* eslint-enable @typescript-eslint/no-non-null-assertion */

    return result;
  }

  updateE164(e164?: string | null): void {
    const oldValue = this.get('e164');
    if (e164 && e164 !== oldValue) {
      this.set('e164', e164);
      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'e164', oldValue);
    }
  }

  updateUuid(uuid?: string): void {
    const oldValue = this.get('uuid');
    if (uuid && uuid !== oldValue) {
      this.set('uuid', uuid.toLowerCase());
      window.Signal.Data.updateConversation(this.attributes);
      this.trigger('idUpdated', this, 'uuid', oldValue);
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
    if (window._.isNumber(temporaryMemberCount)) {
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

  incrementSentMessageCount(): void {
    this.set({
      messageCount: (this.get('messageCount') || 0) + 1,
      sentMessageCount: (this.get('sentMessageCount') || 0) + 1,
    });
    window.Signal.Data.updateConversation(this.attributes);
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

    let messages: MessageModelCollectionType | undefined;
    do {
      const first = messages ? messages.first() : undefined;

      // eslint-disable-next-line no-await-in-loop
      messages = await window.Signal.Data.getOlderMessagesByConversation(
        this.get('id'),
        {
          MessageCollection: window.Whisper.MessageCollection,
          limit: 100,
          receivedAt: first ? first.get('received_at') : undefined,
          sentAt: first ? first.get('sent_at') : undefined,
          messageId: first ? first.id : undefined,
        }
      );

      if (!messages.length) {
        return;
      }

      const readMessages = messages.filter(
        m => !hasErrors(m.attributes) && isIncoming(m.attributes)
      );
      const receiptSpecs = readMessages.map(m => ({
        senderE164: m.get('source'),
        senderUuid: m.get('sourceUuid'),
        senderId: window.ConversationController.ensureContactIds({
          e164: m.get('source'),
          uuid: m.get('sourceUuid'),
        }),
        timestamp: m.get('sent_at'),
        hasErrors: hasErrors(m.attributes),
      }));

      if (isLocalAction) {
        // eslint-disable-next-line no-await-in-loop
        await sendReadReceiptsFor(this.attributes, receiptSpecs);
      }

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        readMessages.map(async m => {
          const registered = window.MessageController.register(m.id, m);
          const shouldSave = await registered.queueAttachmentDownloads();
          if (shouldSave) {
            await window.Signal.Data.saveMessage(registered.attributes, {
              Message: window.Whisper.Message,
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
      const messageRequestEnum =
        window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;
      const isLocalAction = !fromSync && !viaStorageServiceSync;
      const ourConversationId = window.ConversationController.getOurConversationId();

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
          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
            this.sendProfileKeyUpdate();
          } else if (
            ourConversationId &&
            isGroupV2(this.attributes) &&
            this.isMemberPending(ourConversationId)
          ) {
            await this.modifyGroupV2({
              name: 'promotePendingMember',
              createGroupChange: () =>
                this.promotePendingMember(ourConversationId),
            });
          } else if (
            ourConversationId &&
            isGroupV2(this.attributes) &&
            this.isMember(ourConversationId)
          ) {
            window.log.info(
              'applyMessageRequestResponse/accept: Already a member of v2 group'
            );
          } else {
            window.log.error(
              'applyMessageRequestResponse/accept: Neither member nor pending member of v2 group'
            );
          }
        }
      } else if (response === messageRequestEnum.BLOCK) {
        // Block locally, other devices should block upon receiving the sync message
        this.block({ viaStorageServiceSync });
        this.disableProfileSharing({ viaStorageServiceSync });

        if (isLocalAction) {
          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
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

          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
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

          if (
            isGroupV1(this.attributes) ||
            isDirectConversation(this.attributes)
          ) {
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
    const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();
    try {
      if (approvalRequired) {
        await this.modifyGroupV2({
          name: 'requestToJoin',
          inviteLinkPassword,
          createGroupChange: () => this.addPendingApprovalRequest(),
        });
      } else {
        await this.modifyGroupV2({
          name: 'joinGroup',
          inviteLinkPassword,
          createGroupChange: () => this.addMember(ourConversationId),
        });
      }
    } catch (error) {
      const ALREADY_REQUESTED_TO_JOIN =
        '{"code":400,"message":"cannot ask to join via invite link if already asked to join"}';
      if (!error.response) {
        throw error;
      } else {
        const errorDetails = stringFromBytes(error.response);
        if (errorDetails !== ALREADY_REQUESTED_TO_JOIN) {
          throw error;
        } else {
          window.log.info(
            'joinGroupV2ViaLink: Got 400, but server is telling us we have already requested to join. Forcing that local state'
          );
          this.set({
            pendingAdminApprovalV2: [
              {
                conversationId: ourConversationId,
                timestamp: Date.now(),
              },
            ],
          });
        }
      }
    }

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;

    // Ensure active_at is set, because this is an event that justifies putting the group
    //   in the left pane.
    this.set({
      messageRequestResponseType: messageRequestEnum.ACCEPT,
      active_at: this.get('active_at') || Date.now(),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  async cancelJoinRequest(): Promise<void> {
    const ourConversationId = window.ConversationController.getOurConversationIdOrThrow();

    const inviteLinkPassword = this.get('groupInviteLinkPassword');
    if (!inviteLinkPassword) {
      throw new Error('Missing groupInviteLinkPassword!');
    }

    await this.modifyGroupV2({
      name: 'cancelJoinRequest',
      inviteLinkPassword,
      createGroupChange: () =>
        this.denyPendingApprovalRequest(ourConversationId),
    });
  }

  async addMembersV2(conversationIds: ReadonlyArray<string>): Promise<void> {
    await this.modifyGroupV2({
      name: 'addMembersV2',
      createGroupChange: () =>
        window.Signal.Groups.buildAddMembersChange(
          {
            id: this.id,
            publicParams: this.get('publicParams'),
            revision: this.get('revision'),
            secretParams: this.get('secretParams'),
          },
          conversationIds
        ),
    });
  }

  async updateGroupAttributesV2(
    attributes: Readonly<{
      avatar?: undefined | ArrayBuffer;
      description?: string;
      title?: string;
    }>
  ): Promise<void> {
    await this.modifyGroupV2({
      name: 'updateGroupAttributesV2',
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
    const ourConversationId = window.ConversationController.getOurConversationId();

    if (
      ourConversationId &&
      isGroupV2(this.attributes) &&
      this.isMemberPending(ourConversationId)
    ) {
      await this.modifyGroupV2({
        name: 'delete',
        createGroupChange: () => this.removePendingMember([ourConversationId]),
      });
    } else if (
      ourConversationId &&
      isGroupV2(this.attributes) &&
      this.isMember(ourConversationId)
    ) {
      await this.modifyGroupV2({
        name: 'delete',
        createGroupChange: () => this.removeMember(ourConversationId),
      });
    } else {
      window.log.error(
        'leaveGroupV2: We were neither a member nor a pending member of the group'
      );
    }
  }

  async toggleAdmin(conversationId: string): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    if (!this.isMember(conversationId)) {
      window.log.error(
        `toggleAdmin: Member ${conversationId} is not a member of the group`
      );
      return;
    }

    await this.modifyGroupV2({
      name: 'toggleAdmin',
      createGroupChange: () => this.toggleAdminChange(conversationId),
    });
  }

  async approvePendingMembershipFromGroupV2(
    conversationId: string
  ): Promise<void> {
    if (
      isGroupV2(this.attributes) &&
      this.isMemberRequestingToJoin(conversationId)
    ) {
      await this.modifyGroupV2({
        name: 'approvePendingApprovalRequest',
        createGroupChange: () =>
          this.approvePendingApprovalRequest(conversationId),
      });
    }
  }

  async revokePendingMembershipsFromGroupV2(
    conversationIds: Array<string>
  ): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const [conversationId] = conversationIds;

    // Only pending memberships can be revoked for multiple members at once
    if (conversationIds.length > 1) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        createGroupChange: () => this.removePendingMember(conversationIds),
        extraConversationsForSend: conversationIds,
      });
    } else if (this.isMemberRequestingToJoin(conversationId)) {
      await this.modifyGroupV2({
        name: 'denyPendingApprovalRequest',
        createGroupChange: () =>
          this.denyPendingApprovalRequest(conversationId),
        extraConversationsForSend: [conversationId],
      });
    } else if (this.isMemberPending(conversationId)) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        createGroupChange: () => this.removePendingMember([conversationId]),
        extraConversationsForSend: [conversationId],
      });
    }
  }

  async removeFromGroupV2(conversationId: string): Promise<void> {
    if (
      isGroupV2(this.attributes) &&
      this.isMemberRequestingToJoin(conversationId)
    ) {
      await this.modifyGroupV2({
        name: 'denyPendingApprovalRequest',
        createGroupChange: () =>
          this.denyPendingApprovalRequest(conversationId),
        extraConversationsForSend: [conversationId],
      });
    } else if (
      isGroupV2(this.attributes) &&
      this.isMemberPending(conversationId)
    ) {
      await this.modifyGroupV2({
        name: 'removePendingMember',
        createGroupChange: () => this.removePendingMember([conversationId]),
        extraConversationsForSend: [conversationId],
      });
    } else if (isGroupV2(this.attributes) && this.isMember(conversationId)) {
      await this.modifyGroupV2({
        name: 'removeFromGroup',
        createGroupChange: () => this.removeMember(conversationId),
        extraConversationsForSend: [conversationId],
      });
    } else {
      window.log.error(
        `removeFromGroupV2: Member ${conversationId} is neither a member nor a pending member of the group`
      );
    }
  }

  async syncMessageRequestResponse(response: number): Promise<void> {
    // In GroupsV2, this may modify the server. We only want to continue if those
    //   server updates were successful.
    await this.applyMessageRequestResponse(response);

    const { ourNumber, ourUuid } = this;
    const {
      wrap,
      sendOptions,
    } = await window.ConversationController.prepareForSend(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ourNumber || ourUuid!,
      {
        syncMessage: true,
      }
    );

    const groupId = this.getGroupIdBuffer();

    try {
      await wrap(
        window.textsecure.messaging.syncMessageRequestResponse(
          {
            threadE164: this.get('e164'),
            threadUuid: this.get('uuid'),
            groupId,
            type: response,
          },
          sendOptions
        )
      );
    } catch (result) {
      this.processSendResponse(result);
    }
  }

  // We only want to throw if there's a 'real' error contained with this information
  //   coming back from our low-level send infrastructure.
  processSendResponse(
    result: Error | CallbackResultType
  ): result is CallbackResultType {
    if (result instanceof Error) {
      throw result;
    } else if (result && result.errors) {
      // We filter out unregistered user errors, because we ignore those in groups
      const wasThereARealError = window._.some(
        result.errors,
        error => error.name !== 'UnregisteredUserError'
      );
      if (wasThereARealError) {
        throw result;
      }

      return true;
    }

    return true;
  }

  async safeGetVerified(): Promise<number> {
    const promise = window.textsecure.storage.protocol.getVerified(this.id);
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

  setVerifiedDefault(options?: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { DEFAULT } = this.verifiedEnum!;
    return this.queueJob('setVerifiedDefault', () =>
      this._setVerified(DEFAULT, options)
    );
  }

  setVerified(options?: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { VERIFIED } = this.verifiedEnum!;
    return this.queueJob('setVerified', () =>
      this._setVerified(VERIFIED, options)
    );
  }

  setUnverified(options: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { UNVERIFIED } = this.verifiedEnum!;
    return this.queueJob('setUnverified', () =>
      this._setVerified(UNVERIFIED, options)
    );
  }

  async _setVerified(
    verified: number,
    providedOptions?: VerificationOptions
  ): Promise<boolean | void> {
    const options = providedOptions || {};
    window._.defaults(options, {
      viaStorageServiceSync: false,
      viaSyncMessage: false,
      viaContactSync: false,
      key: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { VERIFIED, UNVERIFIED } = this.verifiedEnum!;

    if (!isDirectConversation(this.attributes)) {
      throw new Error(
        'You cannot verify a group conversation. ' +
          'You must verify individual contacts.'
      );
    }

    const beginningVerified = this.get('verified');
    let keyChange;
    if (options.viaSyncMessage) {
      // handle the incoming key from the sync messages - need different
      // behavior if that key doesn't match the current key
      keyChange = await window.textsecure.storage.protocol.processVerifiedMessage(
        this.id,
        verified,
        options.key || undefined
      );
    } else {
      keyChange = await window.textsecure.storage.protocol.setVerified(
        this.id,
        verified
      );
    }

    this.set({ verified });
    window.Signal.Data.updateConversation(this.attributes);

    if (
      !options.viaStorageServiceSync &&
      !keyChange &&
      beginningVerified !== verified
    ) {
      this.captureChange('verified');
    }

    // Three situations result in a verification notice in the conversation:
    //   1) The message came from an explicit verification in another client (not
    //      a contact sync)
    //   2) The verification value received by the contact sync is different
    //      from what we have on record (and it's not a transition to UNVERIFIED)
    //   3) Our local verification status is VERIFIED and it hasn't changed,
    //      but the key did change (Key1/VERIFIED to Key2/VERIFIED - but we don't
    //      want to show DEFAULT->DEFAULT or UNVERIFIED->UNVERIFIED)
    if (
      !options.viaContactSync ||
      (beginningVerified !== verified && verified !== UNVERIFIED) ||
      (keyChange && verified === VERIFIED)
    ) {
      await this.addVerifiedChange(this.id, verified === VERIFIED, {
        local: !options.viaSyncMessage,
      });
    }
    if (!options.viaSyncMessage) {
      await this.sendVerifySyncMessage(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('e164')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('uuid')!,
        verified
      );
    }

    return keyChange;
  }

  async sendVerifySyncMessage(
    e164: string,
    uuid: string,
    state: number
  ): Promise<WhatIsThis> {
    // Because syncVerification sends a (null) message to the target of the verify and
    //   a sync message to our own devices, we need to send the accessKeys down for both
    //   contacts. So we merge their sendOptions.
    const { sendOptions } = await window.ConversationController.prepareForSend(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.ourNumber || this.ourUuid!,
      { syncMessage: true }
    );
    const contactSendOptions = await getSendOptions(this.attributes);
    const options = { ...sendOptions, ...contactSendOptions };

    const promise = window.textsecure.storage.protocol.loadIdentityKey(e164);
    return promise.then(key =>
      handleMessageSend(
        window.textsecure.messaging.syncVerification(
          e164,
          uuid,
          state,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          key!,
          options
        )
      )
    );
  }

  isVerified(): boolean {
    if (isDirectConversation(this.attributes)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.get('verified') === this.verifiedEnum!.VERIFIED;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.contactCollection!.length) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.contactCollection!.every(contact => {
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.contactCollection!.length) {
      return true;
    }

    // Array.any does not exist. This is probably broken.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.contactCollection!.any(contact => {
      if (isMe(contact.attributes)) {
        return false;
      }
      return contact.isUnverified();
    });
  }

  getUnverified(): Backbone.Collection<ConversationModel> {
    if (isDirectConversation(this.attributes)) {
      return this.isUnverified()
        ? new window.Backbone.Collection([this])
        : new window.Backbone.Collection();
    }
    return new window.Backbone.Collection(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.filter(contact => {
        if (isMe(contact.attributes)) {
          return false;
        }
        return contact.isUnverified();
      })
    );
  }

  async setApproved(): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      throw new Error(
        'You cannot set a group conversation as trusted. ' +
          'You must set individual contacts as trusted.'
      );
    }

    return window.textsecure.storage.protocol.setApproval(this.id, true);
  }

  safeIsUntrusted(): boolean {
    try {
      return window.textsecure.storage.protocol.isUntrusted(this.id);
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

  getUntrusted(): Backbone.Collection<ConversationModel> {
    if (isDirectConversation(this.attributes)) {
      if (this.isUntrusted()) {
        return new window.Backbone.Collection([this]);
      }
      return new window.Backbone.Collection();
    }

    return new window.Backbone.Collection(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.filter(contact => {
        if (isMe(contact.attributes)) {
          return false;
        }
        return contact.isUntrusted();
      })
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
    this.trigger('change', this);
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
    window.log.info(
      `addChatSessionRefreshed: adding for ${this.idForLogging()}`,
      { receivedAt }
    );

    const message = ({
      conversationId: this.id,
      type: 'chat-session-refreshed',
      sent_at: receivedAt,
      received_at: receivedAtCounter,
      received_at_ms: receivedAt,
      unread: 1,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);
  }

  async addDeliveryIssue({
    receivedAt,
    receivedAtCounter,
    senderUuid,
  }: {
    receivedAt: number;
    receivedAtCounter: number;
    senderUuid: string;
  }): Promise<void> {
    window.log.info(`addDeliveryIssue: adding for ${this.idForLogging()}`, {
      receivedAt,
      senderUuid,
    });

    const message = ({
      conversationId: this.id,
      type: 'delivery-issue',
      sourceUuid: senderUuid,
      sent_at: receivedAt,
      received_at: receivedAtCounter,
      received_at_ms: receivedAt,
      unread: 1,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
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
  }

  async addKeyChange(keyChangedId: string): Promise<void> {
    window.log.info(
      'adding key change advisory for',
      this.idForLogging(),
      keyChangedId,
      this.get('timestamp')
    );

    const timestamp = Date.now();
    const message = ({
      conversationId: this.id,
      type: 'keychange',
      sent_at: this.get('timestamp'),
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      key_changed: keyChangedId,
      unread: 1,
      schemaVersion: Message.VERSION_NEEDED_FOR_DISPLAY,
      // TODO: DESKTOP-722
      // this type does not fully implement the interface it is expected to
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
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
    providedOptions: Record<string, unknown>
  ): Promise<void> {
    const options = providedOptions || {};
    window._.defaults(options, { local: true });

    if (isMe(this.attributes)) {
      window.log.info(
        'refusing to add verified change advisory for our own number'
      );
      return;
    }

    const lastMessage = this.get('timestamp') || Date.now();

    window.log.info(
      'adding verified change advisory for',
      this.idForLogging(),
      verifiedChangeId,
      lastMessage
    );

    const timestamp = Date.now();
    const message = ({
      conversationId: this.id,
      type: 'verified-change',
      sent_at: lastMessage,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      verifiedChanged: verifiedChangeId,
      verified,
      local: options.local,
      unread: 1,
      // TODO: DESKTOP-722
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);

    if (isDirectConversation(this.attributes)) {
      window.ConversationController.getAllGroupsInvolvingId(this.id).then(
        groups => {
          window._.forEach(groups, group => {
            group.addVerifiedChange(this.id, verified, options);
          });
        }
      );
    }
  }

  async addCallHistory(
    callHistoryDetails: CallHistoryDetailsType
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

    const message = ({
      conversationId: this.id,
      type: 'call-history',
      sent_at: timestamp,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      unread,
      callHistoryDetails: detailsToSave,
      // TODO: DESKTOP-722
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);
  }

  async updateCallHistoryForGroupCall(
    eraId: string,
    creatorUuid: string
  ): Promise<void> {
    // We want to update the cache quickly in case this function is called multiple times.
    const oldCachedEraId = this.cachedLatestGroupCallEraId;
    this.cachedLatestGroupCallEraId = eraId;

    const alreadyHasMessage =
      (oldCachedEraId && oldCachedEraId === eraId) ||
      (await window.Signal.Data.hasGroupCallHistoryMessage(this.id, eraId));

    if (!alreadyHasMessage) {
      this.addCallHistory({
        callMode: CallMode.Group,
        creatorUuid,
        eraId,
        startedTime: Date.now(),
      });
    }
  }

  async addProfileChange(
    profileChange: unknown,
    conversationId?: string
  ): Promise<void> {
    const now = Date.now();
    const message = ({
      conversationId: this.id,
      type: 'profile-change',
      sent_at: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: now,
      unread: 0,
      changedId: conversationId || this.id,
      profileChange,
      // TODO: DESKTOP-722
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);

    if (isDirectConversation(this.attributes)) {
      window.ConversationController.getAllGroupsInvolvingId(this.id).then(
        groups => {
          window._.forEach(groups, group => {
            group.addProfileChange(profileChange, this.id);
          });
        }
      );
    }
  }

  async addUniversalTimerNotification(): Promise<string> {
    const now = Date.now();
    const message = ({
      conversationId: this.id,
      type: 'universal-timer-notification',
      sent_at: now,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: now,
      unread: 0,
      // TODO: DESKTOP-722
    } as unknown) as typeof window.Whisper.MessageAttributesType;

    const id = await window.Signal.Data.saveMessage(message, {
      Message: window.Whisper.Message,
    });
    const model = window.MessageController.register(
      id,
      new window.Whisper.Message({
        ...message,
        id,
      })
    );

    this.trigger('newmessage', model);

    return id;
  }

  async maybeSetPendingUniversalTimer(): Promise<void> {
    if (!isDirectConversation(this.attributes)) {
      return;
    }

    if (this.isSMSOnly()) {
      return;
    }

    if (await window.Signal.Data.hasUserInitiatedMessages(this.get('id'))) {
      return;
    }

    if (this.get('pendingUniversalTimer') || this.get('expireTimer')) {
      return;
    }

    const expireTimer = universalExpireTimer.get();
    if (!expireTimer) {
      return;
    }

    const notificationId = await this.addUniversalTimerNotification();
    this.set('pendingUniversalTimer', notificationId);
  }

  async maybeApplyUniversalTimer(): Promise<void> {
    const notificationId = this.get('pendingUniversalTimer');
    if (!notificationId) {
      return;
    }

    const message = window.MessageController.getById(notificationId);
    if (message) {
      message.cleanup();
      window.Signal.Data.removeMessage(message.id, {
        Message: window.Whisper.Message,
      });
    }

    if (this.get('expireTimer')) {
      this.set('pendingUniversalTimer', undefined);
      return;
    }

    const expireTimer = universalExpireTimer.get();
    if (expireTimer) {
      // `updateExpirationTimer` calls `modifyGroupV2` and shouldn't be awaited
      // since we run both on conversation's queue.
      this.updateExpirationTimer(expireTimer);
    }

    this.set('pendingUniversalTimer', undefined);
  }

  async onReadMessage(
    message: MessageModel,
    readAt?: number
  ): Promise<WhatIsThis> {
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
        sendReadReceipts: false,
        readAt,
      })
    );
  }

  validate(attributes = this.attributes): string | null {
    const required = ['type'];
    const missing = window._.filter(required, attr => !attributes[attr]);
    if (missing.length) {
      return `Conversation must have ${missing}`;
    }

    if (attributes.type !== 'private' && attributes.type !== 'group') {
      return `Invalid conversation type: ${attributes.type}`;
    }

    const atLeastOneOf = ['e164', 'uuid', 'groupId'];
    const hasAtLeastOneOf =
      window._.filter(atLeastOneOf, attr => attributes[attr]).length > 0;

    if (!hasAtLeastOneOf) {
      return 'Missing one of e164, uuid, or groupId';
    }

    const error = this.validateNumber() || this.validateUuid();

    if (error) {
      return error;
    }

    return null;
  }

  validateNumber(): string | null {
    if (isDirectConversation(this.attributes) && this.get('e164')) {
      const regionCode = window.storage.get('regionCode');
      if (!regionCode) {
        throw new Error('No region code');
      }
      const number = window.libphonenumber.util.parseNumber(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('e164')!,
        regionCode
      );
      // TODO: DESKTOP-723
      // This is valid, but the typing thinks it's a function.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (number.isValidNumber) {
        this.set({ e164: number.e164 });
        return null;
      }

      let errorMessage: undefined | string;
      if (number.error instanceof Error) {
        errorMessage = number.error.message;
      } else if (typeof number.error === 'string') {
        errorMessage = number.error;
      }
      return errorMessage || 'Invalid phone number';
    }

    return null;
  }

  validateUuid(): string | null {
    if (isDirectConversation(this.attributes) && this.get('uuid')) {
      if (window.isValidGuid(this.get('uuid'))) {
        return null;
      }

      return 'Invalid UUID';
    }

    return null;
  }

  queueJob(
    name: string,
    callback: () => unknown | Promise<unknown>
  ): Promise<WhatIsThis> {
    this.jobQueue = this.jobQueue || new window.PQueue({ concurrency: 1 });

    const taskWithTimeout = window.textsecure.createTaskWithTimeout(
      callback,
      `conversation ${this.idForLogging()}`
    );

    const queuedAt = Date.now();
    return this.jobQueue.add(async () => {
      const startedAt = Date.now();
      const waitTime = startedAt - queuedAt;

      if (waitTime > JOB_REPORTING_THRESHOLD_MS) {
        window.log.info(
          `Conversation job ${name} was blocked for ${waitTime}ms`
        );
      }

      try {
        return await taskWithTimeout();
      } finally {
        const duration = Date.now() - startedAt;

        if (duration > JOB_REPORTING_THRESHOLD_MS) {
          window.log.info(`Conversation job ${name} took ${duration}ms`);
        }
      }
    });
  }

  isAdmin(conversationId: string): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    const members = this.get('membersV2') || [];
    const member = members.find(x => x.conversationId === conversationId);
    if (!member) {
      return false;
    }

    const MEMBER_ROLES = window.textsecure.protobuf.Member.Role;

    return member.role === MEMBER_ROLES.ADMINISTRATOR;
  }

  private getMemberships(): Array<{
    conversationId: string;
    isAdmin: boolean;
  }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('membersV2') || [];
    return members.map(member => ({
      isAdmin:
        member.role === window.textsecure.protobuf.Member.Role.ADMINISTRATOR,
      conversationId: member.conversationId,
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
    addedByUserId?: string;
    conversationId: string;
  }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('pendingMembersV2') || [];
    return members.map(member => ({
      addedByUserId: member.addedByUserId,
      conversationId: member.conversationId,
    }));
  }

  private getPendingApprovalMemberships(): Array<{ conversationId: string }> {
    if (!isGroupV2(this.attributes)) {
      return [];
    }

    const members = this.get('pendingAdminApprovalV2') || [];
    return members.map(member => ({
      conversationId: member.conversationId,
    }));
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

  getMemberIds(): Array<string> {
    const members = this.getMembers();
    return members.map(member => member.id);
  }

  getRecipients({
    includePendingMembers,
    extraConversationsForSend,
  }: {
    includePendingMembers?: boolean;
    extraConversationsForSend?: Array<string>;
  } = {}): Array<string> {
    const members = this.getMembers({ includePendingMembers });

    // There are cases where we need to send to someone we just removed from the group, to
    //   let them know that we removed them. In that case, we need to send to more than
    //   are currently in the group.
    const extraConversations = extraConversationsForSend
      ? extraConversationsForSend
          .map(id => window.ConversationController.get(id))
          .filter(isNotNil)
      : [];

    const unique = extraConversations.length
      ? window._.unique([...members, ...extraConversations])
      : members;

    // Eliminate ourself
    return window._.compact(
      unique.map(member =>
        isMe(member.attributes) ? null : member.getSendTarget()
      )
    );
  }

  async getQuoteAttachment(
    attachments?: Array<WhatIsThis>,
    preview?: Array<WhatIsThis>,
    sticker?: WhatIsThis
  ): Promise<WhatIsThis> {
    if (attachments && attachments.length) {
      const validAttachments = filter(
        attachments,
        attachment => attachment && !attachment.pending && !attachment.error
      );
      const attachmentsToUse = take(validAttachments, 1);

      return Promise.all(
        map(attachmentsToUse, async attachment => {
          const { fileName, thumbnail, contentType } = attachment;

          return {
            contentType,
            // Our protos library complains about this field being undefined, so we force
            //   it to null
            fileName: fileName || null,
            thumbnail: thumbnail
              ? {
                  ...(await loadAttachmentData(thumbnail)),
                  objectUrl: getAbsoluteAttachmentPath(thumbnail.path),
                }
              : null,
          };
        })
      );
    }

    if (preview && preview.length) {
      const validPreviews = filter(preview, item => item && item.image);
      const previewsToUse = take(validPreviews, 1);

      return Promise.all(
        map(previewsToUse, async attachment => {
          const { image } = attachment;
          const { contentType } = image;

          return {
            contentType,
            // Our protos library complains about this field being undefined, so we
            //   force it to null
            fileName: null,
            thumbnail: image
              ? {
                  ...(await loadAttachmentData(image)),
                  objectUrl: getAbsoluteAttachmentPath(image.path),
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
            objectUrl: getAbsoluteAttachmentPath(path),
          },
        },
      ];
    }

    return [];
  }

  async makeQuote(
    quotedMessage: typeof window.Whisper.MessageType
  ): Promise<DataMessageClass.Quote> {
    const { getName } = Contact;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const contact = quotedMessage.getContact()!;
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
      bodyRanges: quotedMessage.get('bodyRanges'),
      id: quotedMessage.get('sent_at'),
      text: body || embeddedContactName,
      isViewOnce: isTapToView(quotedMessage.attributes),
      attachments: isTapToView(quotedMessage.attributes)
        ? [{ contentType: 'image/jpeg', fileName: null }]
        : await this.getQuoteAttachment(attachments, preview, sticker),
    };
  }

  async sendStickerMessage(packId: string, stickerId: number): Promise<void> {
    const packData = window.Signal.Stickers.getStickerPack(packId);
    const stickerData = window.Signal.Stickers.getSticker(packId, stickerId);
    if (!stickerData || !packData) {
      window.log.warn(
        `Attempted to send nonexistent (${packId}, ${stickerId}) sticker!`
      );
      return;
    }

    const { key } = packData;
    const { path, width, height } = stickerData;
    const arrayBuffer = await readStickerData(path);

    // We need this content type to be an image so we can display an `<img>` instead of a
    //   `<video>` or an error, but it's not critical that we get the full type correct.
    //   In other words, it's probably fine if we say that a GIF is `image/png`, but it's
    //   but it's bad if we say it's `video/mp4` or `text/plain`. We do our best to sniff
    //   the MIME type here, but it's okay if we have to use a possibly-incorrect
    //   fallback.
    let contentType: MIMEType;
    const sniffedMimeType = sniffImageMimeType(arrayBuffer);
    if (sniffedMimeType) {
      contentType = sniffedMimeType;
    } else {
      window.log.warn(
        'Unable to sniff sticker MIME type; falling back to WebP'
      );
      contentType = IMAGE_WEBP;
    }

    const sticker = {
      packId,
      stickerId,
      packKey: key,
      data: {
        size: arrayBuffer.byteLength,
        data: arrayBuffer,
        contentType,
        width,
        height,
      },
    };

    this.sendMessage(null, [], null, [], sticker);
    window.reduxActions.stickers.useSticker(packId, stickerId);
  }

  async sendDeleteForEveryoneMessage(targetTimestamp: number): Promise<void> {
    const timestamp = Date.now();

    if (timestamp - targetTimestamp > THREE_HOURS) {
      throw new Error('Cannot send DOE for a message older than three hours');
    }

    const deleteModel = Deletes.getSingleton().add({
      targetSentTimestamp: targetTimestamp,
      fromId: window.ConversationController.getOurConversationId(),
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const recipients = this.getRecipients();

    return this.queueJob('sendDeleteForEveryone', async () => {
      window.log.info(
        'Sending deleteForEveryone to conversation',
        this.idForLogging(),
        'with timestamp',
        timestamp
      );

      const attributes = ({
        id: window.getGuid(),
        type: 'outgoing',
        conversationId: this.get('id'),
        sent_at: timestamp,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: timestamp,
        recipients,
        deletedForEveryoneTimestamp: targetTimestamp,
        // TODO: DESKTOP-722
      } as unknown) as typeof window.Whisper.MessageAttributesType;

      if (isDirectConversation(this.attributes)) {
        attributes.destination = destination;
      }

      // We are only creating this model so we can use its sync message
      // sending functionality. It will not be saved to the database.
      const message = new window.Whisper.Message(attributes);

      // We're offline!
      if (!window.textsecure.messaging) {
        throw new Error('Cannot send DOE while offline!');
      }

      const options = await getSendOptions(this.attributes);

      const promise = (async () => {
        let profileKey: ArrayBuffer | undefined;
        if (this.get('profileSharing')) {
          profileKey = await ourProfileKeyService.get();
        }

        const {
          ContentHint,
        } = window.textsecure.protobuf.UnidentifiedSenderMessage.Message;

        if (isDirectConversation(this.attributes)) {
          return window.textsecure.messaging.sendMessageToIdentifier(
            destination,
            undefined, // body
            [], // attachments
            undefined, // quote
            [], // preview
            undefined, // sticker
            undefined, // reaction
            targetTimestamp,
            timestamp,
            undefined, // expireTimer
            ContentHint.DEFAULT,
            undefined, // groupId
            profileKey,
            options
          );
        }

        return window.Signal.Util.sendToGroup(
          {
            groupV1: this.getGroupV1Info(),
            groupV2: this.getGroupV2Info(),
            deletedForEveryoneTimestamp: targetTimestamp,
            timestamp,
            profileKey,
          },
          this,
          ContentHint.DEFAULT,
          options
        );
      })();

      // This is to ensure that the functions in send() and sendSyncMessage() don't save
      //   anything to the database.
      message.doNotSave = true;

      const result = await message.send(handleMessageSend(promise));

      if (!message.hasSuccessfulDelivery()) {
        // This is handled by `conversation_view` which displays a toast on
        // send error.
        throw new Error('No successful delivery for delete for everyone');
      }
      Deletes.getSingleton().onDelete(deleteModel);

      return result;
    }).catch(error => {
      window.log.error(
        'Error sending deleteForEveryone',
        deleteModel,
        targetTimestamp,
        error && error.stack
      );

      throw error;
    });
  }

  async sendReactionMessage(
    reaction: { emoji: string; remove: boolean },
    target: {
      targetAuthorUuid: string;
      targetTimestamp: number;
    }
  ): Promise<WhatIsThis> {
    const timestamp = Date.now();
    const outgoingReaction = { ...reaction, ...target };

    const reactionModel = Reactions.getSingleton().add({
      ...outgoingReaction,
      fromId: window.ConversationController.getOurConversationId(),
      timestamp,
      fromSync: true,
    });

    // Apply reaction optimistically
    const oldReaction = await Reactions.getSingleton().onReaction(
      reactionModel
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const recipients = this.getRecipients();

    return this.queueJob('sendReactionMessage', async () => {
      window.log.info(
        'Sending reaction to conversation',
        this.idForLogging(),
        'with timestamp',
        timestamp
      );

      await this.maybeApplyUniversalTimer();

      const expireTimer = this.get('expireTimer');

      const attributes = ({
        id: window.getGuid(),
        type: 'outgoing',
        conversationId: this.get('id'),
        sent_at: timestamp,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: timestamp,
        recipients,
        reaction: outgoingReaction,
        // TODO: DESKTOP-722
      } as unknown) as typeof window.Whisper.MessageAttributesType;

      if (isDirectConversation(this.attributes)) {
        attributes.destination = destination;
      }

      // We are only creating this model so we can use its sync message
      // sending functionality. It will not be saved to the database.
      const message = new window.Whisper.Message(attributes);

      // This is to ensure that the functions in send() and sendSyncMessage() don't save
      //   anything to the database.
      message.doNotSave = true;

      // We're offline!
      if (!window.textsecure.messaging) {
        throw new Error('Cannot send reaction while offline!');
      }

      let profileKey: ArrayBuffer | undefined;
      if (this.get('profileSharing')) {
        profileKey = await ourProfileKeyService.get();
      }

      // Special-case the self-send case - we send only a sync message
      if (isMe(this.attributes)) {
        const dataMessage = await window.textsecure.messaging.getDataMessage({
          attachments: [],
          // body
          // deletedForEveryoneTimestamp
          expireTimer,
          preview: [],
          profileKey,
          // quote
          reaction: outgoingReaction,
          recipients: [destination],
          // sticker
          timestamp,
        });
        const result = await message.sendSyncMessageOnly(dataMessage);
        Reactions.getSingleton().onReaction(reactionModel);
        return result;
      }

      const options = await getSendOptions(this.attributes);
      const {
        ContentHint,
      } = window.textsecure.protobuf.UnidentifiedSenderMessage.Message;

      const promise = (() => {
        if (isDirectConversation(this.attributes)) {
          return window.textsecure.messaging.sendMessageToIdentifier(
            destination,
            undefined, // body
            [], // attachments
            undefined, // quote
            [], // preview
            undefined, // sticker
            outgoingReaction,
            undefined, // deletedForEveryoneTimestamp
            timestamp,
            expireTimer,
            ContentHint.DEFAULT,
            undefined, // groupId
            profileKey,
            options
          );
        }

        return window.Signal.Util.sendToGroup(
          {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            groupV1: this.getGroupV1Info()!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            groupV2: this.getGroupV2Info()!,
            reaction: outgoingReaction,
            timestamp,
            expireTimer,
            profileKey,
          },
          this,
          ContentHint.DEFAULT,
          options
        );
      })();

      const result = await message.send(handleMessageSend(promise));

      if (!message.hasSuccessfulDelivery()) {
        // This is handled by `conversation_view` which displays a toast on
        // send error.
        throw new Error('No successful delivery for reaction');
      }

      return result;
    }).catch(() => {
      let reverseReaction: ReactionModelType;
      if (oldReaction) {
        // Either restore old reaction
        reverseReaction = Reactions.getSingleton().add({
          ...oldReaction,
          fromId: window.ConversationController.getOurConversationId(),
          timestamp,
        });
      } else {
        // Or remove a new one on failure
        reverseReaction = reactionModel.clone();
        reverseReaction.set('remove', !reverseReaction.get('remove'));
      }

      Reactions.getSingleton().onReaction(reverseReaction);
    });
  }

  async sendProfileKeyUpdate(): Promise<void> {
    const id = this.get('id');
    const recipients = this.getRecipients();
    if (!this.get('profileSharing')) {
      window.log.error(
        'Attempted to send profileKeyUpdate to conversation without profileSharing enabled',
        id,
        recipients
      );
      return;
    }
    window.log.info('Sending profileKeyUpdate to conversation', id, recipients);
    const profileKey = await ourProfileKeyService.get();
    if (!profileKey) {
      window.log.error(
        'Attempted to send profileKeyUpdate but our profile key was not found'
      );
      return;
    }
    await window.textsecure.messaging.sendProfileKeyUpdate(
      profileKey,
      recipients,
      await getSendOptions(this.attributes),
      this.get('groupId')
    );
  }

  sendMessage(
    body: string | null,
    attachments: Array<WhatIsThis>,
    quote: WhatIsThis,
    preview: WhatIsThis,
    sticker?: WhatIsThis,
    mentions?: BodyRangesType,
    {
      dontClearDraft,
      timestamp,
    }: { dontClearDraft: boolean; timestamp?: number } = {
      dontClearDraft: false,
    }
  ): void {
    if (this.isGroupV1AndDisabled()) {
      return;
    }

    this.clearTypingTimers();

    const { clearUnreadMetrics } = window.reduxActions.conversations;
    clearUnreadMetrics(this.id);

    const mandatoryProfileSharingEnabled = window.Signal.RemoteConfig.isEnabled(
      'desktop.mandatoryProfileSharing'
    );
    if (mandatoryProfileSharingEnabled && !this.get('profileSharing')) {
      this.set({ profileSharing: true });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const recipients = this.getRecipients();

    this.queueJob('sendMessage', async () => {
      const now = timestamp || Date.now();

      await this.maybeApplyUniversalTimer();

      const expireTimer = this.get('expireTimer');

      window.log.info(
        'Sending message to conversation',
        this.idForLogging(),
        'with timestamp',
        now
      );

      // Here we move attachments to disk
      const messageWithSchema = await upgradeMessageSchema({
        type: 'outgoing',
        body,
        conversationId: this.id,
        quote,
        preview,
        attachments,
        sent_at: now,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: now,
        expireTimer,
        recipients,
        sticker,
        bodyRanges: mentions,
      });

      if (isDirectConversation(this.attributes)) {
        messageWithSchema.destination = destination;
      }
      const attributes: MessageAttributesType = {
        ...messageWithSchema,
        id: window.getGuid(),
      };

      const model = this.addSingleMessage(
        new window.Whisper.Message(attributes)
      );
      if (sticker) {
        await addStickerPackReference(model.id, sticker.packId);
      }
      const message = window.MessageController.register(model.id, model);
      await window.Signal.Data.saveMessage(message.attributes, {
        forceSave: true,
        Message: window.Whisper.Message,
      });

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
        active_at: now,
        timestamp: now,
        isArchived: false,
      });

      this.incrementSentMessageCount();
      window.Signal.Data.updateConversation(this.attributes);

      // We're offline!
      if (!window.textsecure.messaging) {
        const errors = [
          ...(this.contactCollection && this.contactCollection.length
            ? this.contactCollection
            : [this]),
        ].map(contact => {
          const error = new Error('Network is not available') as CustomError;
          error.name = 'SendMessageNetworkError';
          error.identifier = contact.get('id');
          return error;
        });
        await message.saveErrors(errors);
        return null;
      }

      const attachmentsWithData = await Promise.all(
        messageWithSchema.attachments.map(loadAttachmentData)
      );

      const {
        body: messageBody,
        attachments: finalAttachments,
      } = window.Whisper.Message.getLongMessageAttachment({
        body,
        attachments: attachmentsWithData,
        now,
      });

      let profileKey: ArrayBuffer | undefined;
      if (this.get('profileSharing')) {
        profileKey = await ourProfileKeyService.get();
      }

      // Special-case the self-send case - we send only a sync message
      if (isMe(this.attributes)) {
        const dataMessage = await window.textsecure.messaging.getDataMessage({
          attachments: finalAttachments,
          body: messageBody,
          // deletedForEveryoneTimestamp
          expireTimer,
          preview,
          profileKey,
          quote,
          // reaction
          recipients: [destination],
          sticker,
          timestamp: now,
        });
        return message.sendSyncMessageOnly(dataMessage);
      }

      const conversationType = this.get('type');
      const options = await getSendOptions(this.attributes);
      const {
        ContentHint,
      } = window.textsecure.protobuf.UnidentifiedSenderMessage.Message;

      let promise;
      if (conversationType === Message.GROUP) {
        promise = window.Signal.Util.sendToGroup(
          {
            attachments: finalAttachments,
            expireTimer,
            groupV1: this.getGroupV1Info(),
            groupV2: this.getGroupV2Info(),
            messageText: messageBody,
            preview,
            profileKey,
            quote,
            sticker,
            timestamp: now,
            mentions,
          },
          this,
          ContentHint.RESENDABLE,
          options
        );
      } else {
        promise = window.textsecure.messaging.sendMessageToIdentifier(
          destination,
          messageBody,
          finalAttachments,
          quote,
          preview,
          sticker,
          null, // reaction
          undefined, // deletedForEveryoneTimestamp
          now,
          expireTimer,
          ContentHint.RESENDABLE,
          undefined, // groupId
          profileKey,
          options
        );
      }

      return message.send(handleMessageSend(promise));
    });
  }

  // Is this someone who is a contact, or are we sharing our profile with them?
  //   Or is the person who added us to this group a contact or are we sharing profile
  //   with them?
  isFromOrAddedByTrustedContact(): boolean {
    if (isDirectConversation(this.attributes)) {
      return Boolean(this.get('name')) || this.get('profileSharing');
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

    this.queueJob('maybeSetPendingUniversalTimer', () =>
      this.maybeSetPendingUniversalTimer()
    );

    const ourConversationId = window.ConversationController.getOurConversationId();
    if (!ourConversationId) {
      throw new Error('updateLastMessage: Failed to fetch ourConversationId');
    }

    const conversationId = this.id;
    let [previewMessage, activityMessage] = await Promise.all([
      window.Signal.Data.getLastConversationPreview({
        conversationId,
        ourConversationId,
        Message: window.Whisper.Message,
      }),
      window.Signal.Data.getLastConversationActivity({
        conversationId,
        ourConversationId,
        Message: window.Whisper.Message,
      }),
    ]);

    // Register the message with MessageController so that if it already exists
    // in memory we use that data instead of the data from the db which may
    // be out of date.
    if (previewMessage) {
      previewMessage = window.MessageController.register(
        previewMessage.id,
        previewMessage
      );
    }

    if (activityMessage) {
      activityMessage = window.MessageController.register(
        activityMessage.id,
        activityMessage
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
          ? getMessagePropStatus(
              previewMessage.attributes,
              window.storage.get('read-receipt-setting', false)
            )
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
        // we're capturing a storage sync below so
        // we don't need to capture it twice
        this.unpin({ stopStorageSync: true });
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

    window.Whisper.events.trigger('updateUnreadCount');
  }

  async refreshGroupLink(): Promise<void> {
    if (!isGroupV2(this.attributes)) {
      return;
    }

    const groupInviteLinkPassword = arrayBufferToBase64(
      window.Signal.Groups.generateGroupInviteLinkPassword()
    );

    window.log.info('refreshGroupLink for conversation', this.idForLogging());

    await this.modifyGroupV2({
      name: 'updateInviteLinkPassword',
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
      arrayBufferToBase64(
        window.Signal.Groups.generateGroupInviteLinkPassword()
      );

    window.log.info(
      'toggleGroupLink for conversation',
      this.idForLogging(),
      value
    );

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
    const addFromInviteLink = value
      ? ACCESS_ENUM.ANY
      : ACCESS_ENUM.UNSATISFIABLE;

    if (shouldCreateNewGroupLink) {
      await this.modifyGroupV2({
        name: 'updateNewGroupLink',
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

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;

    const addFromInviteLink = value
      ? ACCESS_ENUM.ADMINISTRATOR
      : ACCESS_ENUM.ANY;

    await this.modifyGroupV2({
      name: 'updateAccessControlAddFromInviteLink',
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
      createGroupChange: async () =>
        window.Signal.Groups.buildAccessControlAttributesChange(
          this.attributes,
          value
        ),
    });

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
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
      createGroupChange: async () =>
        window.Signal.Groups.buildAccessControlMembersChange(
          this.attributes,
          value
        ),
    });

    const ACCESS_ENUM = window.textsecure.protobuf.AccessControl.AccessRequired;
    this.set({
      accessControl: {
        addFromInviteLink:
          this.get('accessControl')?.addFromInviteLink || ACCESS_ENUM.MEMBER,
        attributes: this.get('accessControl')?.attributes || ACCESS_ENUM.MEMBER,
        members: value,
      },
    });
  }

  async updateExpirationTimer(
    providedExpireTimer: number | undefined,
    providedSource?: unknown,
    receivedAt?: number,
    options: { fromSync?: unknown; fromGroupUpdate?: unknown } = {}
  ): Promise<boolean | null | MessageModel | void> {
    if (isGroupV2(this.attributes)) {
      if (providedSource || receivedAt) {
        throw new Error(
          'updateExpirationTimer: GroupV2 timers are not updated this way'
        );
      }
      await this.modifyGroupV2({
        name: 'updateExpirationTimer',
        createGroupChange: () =>
          this.updateExpirationTimerInGroupV2(providedExpireTimer),
      });
      return false;
    }

    let expireTimer: number | undefined = providedExpireTimer;
    let source = providedSource;
    if (this.get('left')) {
      return false;
    }

    window._.defaults(options, { fromSync: false, fromGroupUpdate: false });

    if (!expireTimer) {
      expireTimer = undefined;
    }
    if (
      this.get('expireTimer') === expireTimer ||
      (!expireTimer && !this.get('expireTimer'))
    ) {
      return null;
    }

    window.log.info("Update conversation 'expireTimer'", {
      id: this.idForLogging(),
      expireTimer,
      source,
    });

    source = source || window.ConversationController.getOurConversationId();

    // When we add a disappearing messages notification to the conversation, we want it
    //   to be above the message that initiated that change, hence the subtraction.
    const timestamp = (receivedAt || Date.now()) - 1;

    this.set({ expireTimer });

    // This call actually removes universal timer notification and clears
    // the pending flags.
    await this.maybeApplyUniversalTimer();

    window.Signal.Data.updateConversation(this.attributes);

    const model = new window.Whisper.Message(({
      // Even though this isn't reflected to the user, we want to place the last seen
      //   indicator above it. We set it to 'unread' to trigger that placement.
      unread: 1,
      conversationId: this.id,
      // No type; 'incoming' messages are specially treated by conversation.markRead()
      sent_at: timestamp,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      flags:
        window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expireTimer,
        source,
        fromSync: options.fromSync,
        fromGroupUpdate: options.fromGroupUpdate,
      },
      // TODO: DESKTOP-722
    } as unknown) as MessageAttributesType);

    if (isDirectConversation(this.attributes)) {
      model.set({ destination: this.getSendTarget() });
    }
    const id = await window.Signal.Data.saveMessage(model.attributes, {
      Message: window.Whisper.Message,
    });

    model.set({ id });

    const message = window.MessageController.register(id, model);
    this.addSingleMessage(message);

    // if change was made remotely, don't send it to the number/group
    if (receivedAt) {
      return message;
    }

    const sendOptions = await getSendOptions(this.attributes);

    let profileKey;
    if (this.get('profileSharing')) {
      profileKey = await ourProfileKeyService.get();
    }

    let promise;

    if (isMe(this.attributes)) {
      const flags =
        window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      const dataMessage = await window.textsecure.messaging.getDataMessage({
        attachments: [],
        // body
        // deletedForEveryoneTimestamp
        expireTimer,
        flags,
        preview: [],
        profileKey,
        // quote
        // reaction
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        recipients: [this.getSendTarget()!],
        // sticker
        timestamp: message.get('sent_at'),
      });
      return message.sendSyncMessageOnly(dataMessage);
    }

    if (isDirectConversation(this.attributes)) {
      promise = window.textsecure.messaging.sendExpirationTimerUpdateToIdentifier(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.getSendTarget()!,
        expireTimer,
        message.get('sent_at'),
        profileKey,
        sendOptions
      );
    } else {
      promise = window.textsecure.messaging.sendExpirationTimerUpdateToGroup(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('groupId')!,
        this.getRecipients(),
        expireTimer,
        message.get('sent_at'),
        profileKey,
        sendOptions
      );
    }

    await message.send(handleMessageSend(promise));

    return message;
  }

  async addMessageHistoryDisclaimer(): Promise<void> {
    const timestamp = Date.now();

    if (this.hasAddedHistoryDisclaimer) {
      window.log.warn(
        `addMessageHistoryDisclaimer/${this.idForLogging()}: Refusing to add another this session`
      );
      return;
    }
    this.hasAddedHistoryDisclaimer = true;

    const model = new window.Whisper.Message(({
      type: 'message-history-unsynced',
      // Even though this isn't reflected to the user, we want to place the last seen
      //   indicator above it. We set it to 'unread' to trigger that placement.
      unread: 1,
      conversationId: this.id,
      sent_at: timestamp,
      received_at: window.Signal.Util.incrementMessageCounter(),
      received_at_ms: timestamp,
      // TODO: DESKTOP-722
    } as unknown) as MessageAttributesType);

    if (isDirectConversation(this.attributes)) {
      model.set({ destination: this.id });
    }
    const id = await window.Signal.Data.saveMessage(model.attributes, {
      Message: window.Whisper.Message,
    });

    model.set({ id });

    const message = window.MessageController.register(id, model);
    this.addSingleMessage(message);
  }

  isSearchable(): boolean {
    return !this.get('left');
  }

  async endSession(): Promise<void> {
    if (isDirectConversation(this.attributes)) {
      const now = Date.now();
      const model = new window.Whisper.Message(({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: now,
        destination: this.get('e164'),
        destinationUuid: this.get('uuid'),
        recipients: this.getRecipients(),
        flags: window.textsecure.protobuf.DataMessage.Flags.END_SESSION,
        // TODO: DESKTOP-722
      } as unknown) as MessageAttributesType);

      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: window.Whisper.Message,
      });
      model.set({ id });

      const message = window.MessageController.register(model.id, model);
      this.addSingleMessage(message);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const uuid = this.get('uuid')!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const e164 = this.get('e164')!;

      message.sendUtilityMessageWithRetry({
        type: 'session-reset',
        uuid,
        e164,
        now,
      });
    }
  }

  async leaveGroup(): Promise<void> {
    const now = Date.now();
    if (this.get('type') === 'group') {
      const groupId = this.get('groupId');

      if (!groupId) {
        throw new Error(`leaveGroup/${this.idForLogging()}: No groupId!`);
      }

      const groupIdentifiers = this.getRecipients();
      this.set({ left: true });
      window.Signal.Data.updateConversation(this.attributes);

      const model = new window.Whisper.Message(({
        group_update: { left: 'You' },
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: window.Signal.Util.incrementMessageCounter(),
        received_at_ms: now,
        // TODO: DESKTOP-722
      } as unknown) as MessageAttributesType);

      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: window.Whisper.Message,
      });
      model.set({ id });

      const message = window.MessageController.register(model.id, model);
      this.addSingleMessage(message);

      const options = await getSendOptions(this.attributes);
      message.send(
        handleMessageSend(
          window.textsecure.messaging.leaveGroup(
            groupId,
            groupIdentifiers,
            options
          )
        )
      );
    }
  }

  async markRead(
    newestUnreadId: number,
    options: { readAt?: number; sendReadReceipts: boolean } = {
      sendReadReceipts: true,
    }
  ): Promise<void> {
    await markConversationRead(this.attributes, newestUnreadId, options);

    const unreadCount = await window.Signal.Data.getUnreadCountForConversation(
      this.id
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

    const ourGroups = await window.ConversationController.getAllGroupsInvolvingId(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      window.ConversationController.getOurConversationId()!
    );
    const theirGroups = await window.ConversationController.getAllGroupsInvolvingId(
      this.id
    );

    const sharedGroups = window._.intersection(ourGroups, theirGroups);
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

  getProfiles(): Promise<Array<void>> {
    // request all conversation members' keys
    const conversations = (this.getMembers() as unknown) as Array<ConversationModel>;
    return Promise.all(
      window._.map(conversations, conversation => {
        this.getProfile(conversation.get('uuid'), conversation.get('e164'));
      })
    );
  }

  async getProfile(
    providedUuid?: string,
    providedE164?: string
  ): Promise<void> {
    if (!window.textsecure.messaging) {
      throw new Error(
        'Conversation.getProfile: window.textsecure.messaging not available'
      );
    }

    const id = window.ConversationController.ensureContactIds({
      uuid: providedUuid,
      e164: providedE164,
    });
    const c = window.ConversationController.get(id);
    if (!c) {
      window.log.error(
        'getProfile: failed to find conversation; doing nothing'
      );
      return;
    }

    const {
      generateProfileKeyCredentialRequest,
      getClientZkProfileOperations,
      handleProfileKeyCredential,
    } = Util.zkgroup;

    const clientZkProfileCipher = getClientZkProfileOperations(
      window.getServerPublicParams()
    );

    let profile;

    try {
      await Promise.all([
        c.deriveAccessKeyIfNeeded(),
        c.deriveProfileKeyVersionIfNeeded(),
      ]);

      const profileKey = c.get('profileKey');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const uuid = c.get('uuid')!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const identifier = c.getSendTarget()!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const profileKeyVersionHex = c.get('profileKeyVersion')!;
      const existingProfileKeyCredential = c.get('profileKeyCredential');

      let profileKeyCredentialRequestHex: undefined | string;
      let profileCredentialRequestContext:
        | undefined
        | ProfileKeyCredentialRequestContext;

      if (
        profileKey &&
        uuid &&
        profileKeyVersionHex &&
        !existingProfileKeyCredential
      ) {
        window.log.info('Generating request...');
        ({
          requestHex: profileKeyCredentialRequestHex,
          context: profileCredentialRequestContext,
        } = generateProfileKeyCredentialRequest(
          clientZkProfileCipher,
          uuid,
          profileKey
        ));
      }

      const { sendMetadata = {} } = await getSendOptions(c.attributes);
      const getInfo =
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sendMetadata[c.get('uuid')!] || sendMetadata[c.get('e164')!] || {};

      if (getInfo.accessKey) {
        try {
          profile = await window.textsecure.messaging.getProfile(identifier, {
            accessKey: getInfo.accessKey,
            profileKeyVersion: profileKeyVersionHex,
            profileKeyCredentialRequest: profileKeyCredentialRequestHex,
          });
        } catch (error) {
          if (error.code === 401 || error.code === 403) {
            window.log.info(
              `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
            );
            c.set({ sealedSender: SEALED_SENDER.DISABLED });
            profile = await window.textsecure.messaging.getProfile(identifier, {
              profileKeyVersion: profileKeyVersionHex,
              profileKeyCredentialRequest: profileKeyCredentialRequestHex,
            });
          } else {
            throw error;
          }
        }
      } else {
        profile = await window.textsecure.messaging.getProfile(identifier, {
          profileKeyVersion: profileKeyVersionHex,
          profileKeyCredentialRequest: profileKeyCredentialRequestHex,
        });
      }

      const identityKey = base64ToArrayBuffer(profile.identityKey);
      const changed = await window.textsecure.storage.protocol.saveIdentity(
        `${identifier}.1`,
        identityKey,
        false
      );
      if (changed) {
        // save identity will close all sessions except for .1, so we
        // must close that one manually.
        await window.textsecure.storage.protocol.archiveSession(
          `${identifier}.1`
        );
      }

      const accessKey = c.get('accessKey');
      if (
        profile.unrestrictedUnidentifiedAccess &&
        profile.unidentifiedAccess
      ) {
        window.log.info(
          `Setting sealedSender to UNRESTRICTED for conversation ${c.idForLogging()}`
        );
        c.set({
          sealedSender: SEALED_SENDER.UNRESTRICTED,
        });
      } else if (accessKey && profile.unidentifiedAccess) {
        const haveCorrectKey = await verifyAccessKey(
          base64ToArrayBuffer(accessKey),
          base64ToArrayBuffer(profile.unidentifiedAccess)
        );

        if (haveCorrectKey) {
          window.log.info(
            `Setting sealedSender to ENABLED for conversation ${c.idForLogging()}`
          );
          c.set({
            sealedSender: SEALED_SENDER.ENABLED,
          });
        } else {
          window.log.info(
            `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
          );
          c.set({
            sealedSender: SEALED_SENDER.DISABLED,
          });
        }
      } else {
        window.log.info(
          `Setting sealedSender to DISABLED for conversation ${c.idForLogging()}`
        );
        c.set({
          sealedSender: SEALED_SENDER.DISABLED,
        });
      }

      if (profile.about) {
        const key = c.get('profileKey');
        if (key) {
          const keyBuffer = base64ToArrayBuffer(key);
          const decrypted = await window.textsecure.crypto.decryptProfile(
            base64ToArrayBuffer(profile.about),
            keyBuffer
          );
          c.set('about', stringFromBytes(trimForDisplay(decrypted)));
        }
      } else {
        c.unset('about');
      }

      if (profile.aboutEmoji) {
        const key = c.get('profileKey');
        if (key) {
          const keyBuffer = base64ToArrayBuffer(key);
          const decrypted = await window.textsecure.crypto.decryptProfile(
            base64ToArrayBuffer(profile.aboutEmoji),
            keyBuffer
          );
          c.set('aboutEmoji', stringFromBytes(trimForDisplay(decrypted)));
        }
      } else {
        c.unset('aboutEmoji');
      }

      if (profile.capabilities) {
        c.set({ capabilities: profile.capabilities });
      } else {
        c.unset('capabilities');
      }

      if (profileCredentialRequestContext) {
        if (profile.credential) {
          const profileKeyCredential = handleProfileKeyCredential(
            clientZkProfileCipher,
            profileCredentialRequestContext,
            profile.credential
          );
          c.set({ profileKeyCredential });
        } else {
          c.unset('profileKeyCredential');
        }
      }
    } catch (error) {
      switch (error?.code) {
        case 403:
          throw error;
        case 404:
          window.log.warn(
            `getProfile failure: failed to find a profile for ${c.idForLogging()}`,
            error && error.stack ? error.stack : error
          );
          c.setUnregistered();
          return;
        default:
          window.log.warn(
            'getProfile failure:',
            c.idForLogging(),
            error && error.stack ? error.stack : error
          );
          return;
      }
    }

    try {
      await c.setEncryptedProfileName(profile.name);
    } catch (error) {
      window.log.warn(
        'getProfile decryption failure:',
        c.idForLogging(),
        error && error.stack ? error.stack : error
      );
      await c.set({
        profileName: undefined,
        profileFamilyName: undefined,
      });
    }

    try {
      await c.setProfileAvatar(profile.avatar);
    } catch (error) {
      if (error.code === 403 || error.code === 404) {
        window.log.info(
          `Clearing profile avatar for conversation ${c.idForLogging()}`
        );
        c.set({
          profileAvatar: null,
        });
      }
    }

    c.set('profileLastFetchedAt', Date.now());

    window.Signal.Data.updateConversation(c.attributes);
  }

  async setEncryptedProfileName(encryptedName: string): Promise<void> {
    if (!encryptedName) {
      return;
    }
    // isn't this already an ArrayBuffer?
    const key = (this.get('profileKey') as unknown) as string;
    if (!key) {
      return;
    }

    // decode
    const keyBuffer = base64ToArrayBuffer(key);

    // decrypt
    const { given, family } = await window.textsecure.crypto.decryptProfileName(
      encryptedName,
      keyBuffer
    );

    // encode
    const profileName = given ? stringFromBytes(given) : undefined;
    const profileFamilyName = family ? stringFromBytes(family) : undefined;

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

  async setProfileAvatar(avatarPath: string): Promise<void> {
    if (!avatarPath) {
      return;
    }

    if (isMe(this.attributes)) {
      window.storage.put('avatarUrl', avatarPath);
    }

    const avatar = await window.textsecure.messaging.getAvatar(avatarPath);
    // isn't this already an ArrayBuffer?
    const key = (this.get('profileKey') as unknown) as string;
    if (!key) {
      return;
    }
    const keyBuffer = base64ToArrayBuffer(key);

    // decrypt
    const decrypted = await window.textsecure.crypto.decryptProfile(
      avatar,
      keyBuffer
    );

    // update the conversation avatar only if hash differs
    if (decrypted) {
      const newAttributes = await window.Signal.Types.Conversation.maybeUpdateProfileAvatar(
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
    profileKey: string,
    { viaStorageServiceSync = false } = {}
  ): Promise<void> {
    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKey) {
      window.log.info(
        `Setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
      );
      this.set({
        about: undefined,
        aboutEmoji: undefined,
        profileAvatar: undefined,
        profileKey,
        profileKeyVersion: undefined,
        profileKeyCredential: null,
        accessKey: null,
        sealedSender: SEALED_SENDER.UNKNOWN,
      });

      if (!viaStorageServiceSync) {
        this.captureChange('profileKey');
      }

      await Promise.all([
        this.deriveAccessKeyIfNeeded(),
        this.deriveProfileKeyVersionIfNeeded(),
      ]);

      window.Signal.Data.updateConversation(this.attributes, {
        Conversation: window.Whisper.Conversation,
      });
    }
  }

  async deriveAccessKeyIfNeeded(): Promise<void> {
    // isn't this already an array buffer?
    const profileKey = (this.get('profileKey') as unknown) as string;
    if (!profileKey) {
      return;
    }
    if (this.get('accessKey')) {
      return;
    }

    const profileKeyBuffer = base64ToArrayBuffer(profileKey);
    const accessKeyBuffer = await deriveAccessKey(profileKeyBuffer);
    const accessKey = arrayBufferToBase64(accessKeyBuffer);
    this.set({ accessKey });
  }

  async deriveProfileKeyVersionIfNeeded(): Promise<void> {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }

    const uuid = this.get('uuid');
    if (!uuid || this.get('profileKeyVersion')) {
      return;
    }

    const profileKeyVersion = Util.zkgroup.deriveProfileKeyVersion(
      profileKey,
      uuid
    );

    this.set({ profileKeyVersion });
  }

  hasMember(identifier: string): boolean {
    const id = window.ConversationController.getConversationId(identifier);
    const memberIds = this.getMemberIds();

    return window._.contains(memberIds, id);
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
      MessageCollection: window.Whisper.MessageCollection,
    });
  }

  getTitle(): string {
    if (isDirectConversation(this.attributes)) {
      return (
        this.get('name') ||
        this.getProfileName() ||
        this.getNumber() ||
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
      const parsedNumber = window.libphonenumber.parse(number);
      const regionCode = window.libphonenumber.getRegionCodeForNumber(
        parsedNumber
      );
      if (regionCode === window.storage.get('regionCode')) {
        return window.libphonenumber.format(
          parsedNumber,
          window.libphonenumber.PhoneNumberFormat.NATIONAL
        );
      }
      return window.libphonenumber.format(
        parsedNumber,
        window.libphonenumber.PhoneNumberFormat.INTERNATIONAL
      );
    } catch (e) {
      return number;
    }
  }

  getInitials(name: string): string | null {
    if (!name) {
      return null;
    }

    const cleaned = name.replace(/[^A-Za-z\s]+/g, '').replace(/\s+/g, ' ');
    const parts = cleaned.split(' ');
    const initials = parts.map(part => part.trim()[0]);
    if (!initials.length) {
      return null;
    }

    return initials.slice(0, 2).join('');
  }

  getColor(): AvatarColorType {
    if (!isDirectConversation(this.attributes)) {
      return 'ultramarine';
    }

    return migrateColor(this.get('color'));
  }

  getConversationColor(): ConversationColorType {
    const defaultConversationColor = window.storage.get(
      'defaultConversationColor',
      DEFAULT_CONVERSATION_COLOR
    );

    return this.get('conversationColor') || defaultConversationColor.color;
  }

  getCustomColorData(): {
    customColor?: CustomColorType;
    customColorId?: string;
  } {
    const defaultConversationColor = window.storage.get(
      'defaultConversationColor',
      DEFAULT_CONVERSATION_COLOR
    );

    if (this.getConversationColor() !== 'custom') {
      return {
        customColor: undefined,
        customColorId: undefined,
      };
    }

    return {
      customColor:
        this.get('customColor') ||
        defaultConversationColor.customColorData?.value,
      customColorId:
        this.get('customColorId') ||
        defaultConversationColor.customColorData?.id,
    };
  }

  private getAvatarPath(): undefined | string {
    const avatar = isMe(this.attributes)
      ? this.get('profileAvatar') || this.get('avatar')
      : this.get('avatar') || this.get('profileAvatar');
    return avatar?.path || undefined;
  }

  getAbsoluteAvatarPath(): string | undefined {
    const avatarPath = this.getAvatarPath();
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

    const accessControlEnum =
      window.textsecure.protobuf.AccessControl.AccessRequired;
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
        window.textsecure.protobuf.AccessControl.AccessRequired.MEMBER
    );
  }

  areWeAdmin(): boolean {
    if (!isGroupV2(this.attributes)) {
      return false;
    }

    const memberEnum = window.textsecure.protobuf.Member.Role;
    const members = this.get('membersV2') || [];
    const myId = window.ConversationController.getOurConversationId();
    const me = members.find(item => item.conversationId === myId);
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
  captureChange(logMessage: string): void {
    if (!window.Signal.RemoteConfig.isEnabled('desktop.storageWrite3')) {
      window.log.info(
        'conversation.captureChange: Returning early; desktop.storageWrite3 is falsey'
      );

      return;
    }

    window.log.info(
      'storageService[captureChange]',
      logMessage,
      this.idForLogging()
    );
    this.set({ needsStorageServiceSync: true });

    this.queueJob('captureChange', () => {
      Services.storageServiceUploadJob();
    });
  }

  setMuteExpiration(
    muteExpiresAt = 0,
    { viaStorageServiceSync = false } = {}
  ): void {
    const prevExpiration = this.get('muteExpiresAt');

    if (prevExpiration === muteExpiresAt) {
      return;
    }

    // we use a timeoutId here so that we can reference the mute that was
    // potentially set in the ConversationController. Specifically for a
    // scenario where a conversation is already muted and we boot up the app,
    // a timeout will be already set. But if we change the mute to a later
    // date a new timeout would need to be set and the old one cleared. With
    // this ID we can reference the existing timeout.
    const timeoutId = this.getMuteTimeoutId();
    window.Signal.Services.removeTimeout(timeoutId);

    if (muteExpiresAt && muteExpiresAt < Number.MAX_SAFE_INTEGER) {
      window.Signal.Services.onTimeout(
        muteExpiresAt,
        () => {
          this.setMuteExpiration(0);
        },
        timeoutId
      );
    }

    this.set({ muteExpiresAt });
    if (!viaStorageServiceSync) {
      this.captureChange('mutedUntilTimestamp');
    }
    window.Signal.Data.updateConversation(this.attributes);
  }

  isMuted(): boolean {
    return isMuted(this.get('muteExpiresAt'));
  }

  getMuteTimeoutId(): string {
    return `mute(${this.get('id')})`;
  }

  async notify(
    message: Readonly<MessageModel>,
    reaction?: WhatIsThis
  ): Promise<void> {
    // As a performance optimization don't perform any work if notifications are
    // disabled.
    if (!window.Whisper.Notifications.isEnabled) {
      return;
    }

    if (this.isMuted()) {
      return;
    }

    if (!isIncoming(message.attributes) && !reaction) {
      return;
    }

    const conversationId = this.id;

    const sender = reaction
      ? window.ConversationController.get(reaction.get('fromId'))
      : message.getContact();
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

    window.Whisper.Notifications.add({
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
    const name = this.get('name');

    const content = (name && this.getInitials(name)) || '#';

    const cached = this.cachedIdenticon;
    if (cached && cached.content === content && cached.color === color) {
      return cached.url;
    }

    const fresh = await new window.Whisper.IdenticonSVGView({
      color,
      content,
    }).getDataUrl();

    this.cachedIdenticon = { content, color, url: fresh };

    return fresh;
  }

  notifyTyping(options: {
    isTyping: boolean;
    senderId: string;
    fromMe: boolean;
    senderDevice: string;
  }): void {
    const { isTyping, senderId, fromMe, senderDevice } = options;

    // We don't do anything with typing messages from our other devices
    if (fromMe) {
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
        this.trigger('change', this);
      }
    } else {
      delete this.contactTypingTimers[typingToken];
      if (record) {
        // User was previously typing, and is no longer. State change!
        this.trigger('change', this);
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
      this.trigger('change', this);
    }
  }

  getName(): string | undefined {
    // eslint-disable-next-line no-useless-return
    return;
  }

  pin(): void {
    if (this.get('isPinned')) {
      return;
    }

    window.log.info('pinning', this.idForLogging());
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

  unpin({ stopStorageSync = false } = {}): void {
    if (!this.get('isPinned')) {
      return;
    }

    window.log.info('un-pinning', this.idForLogging());

    const pinnedConversationIds = new Set(
      window.storage.get('pinnedConversationIds', new Array<string>())
    );

    pinnedConversationIds.delete(this.id);

    if (!stopStorageSync) {
      this.writePinnedConversations([...pinnedConversationIds]);
    }

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

  acknowledgeGroupMemberNameCollisions(
    groupNameCollisions: Readonly<GroupNameCollisionsWithIdsByTitle>
  ): void {
    this.set('acknowledgedGroupNameCollisions', groupNameCollisions);
    window.Signal.Data.updateConversation(this.attributes);
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
      (model: WhatIsThis, idProp: string, oldValue: WhatIsThis) => {
        if (oldValue) {
          if (idProp === 'e164') {
            delete this._byE164[oldValue];
          }
          if (idProp === 'uuid') {
            delete this._byUuid[oldValue];
          }
          if (idProp === 'groupId') {
            delete this._byGroupId[oldValue];
          }
        }
        if (model.get('e164')) {
          this._byE164[model.get('e164')] = model;
        }
        if (model.get('uuid')) {
          this._byUuid[model.get('uuid')] = model;
        }
        if (model.get('groupId')) {
          this._byGroupId[model.get('groupId')] = model;
        }
      }
    );
  },

  reset(...args: Array<WhatIsThis>) {
    window.Backbone.Collection.prototype.reset.apply(this, args as WhatIsThis);
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

      const groupId = model.get('groupId');
      if (groupId) {
        this._byGroupId[groupId] = model;
      }
    });
  },

  eraseLookups() {
    this._byE164 = Object.create(null);
    this._byUuid = Object.create(null);
    this._byGroupId = Object.create(null);
  },

  add(data: WhatIsThis | Array<WhatIsThis>) {
    let hydratedData;

    // First, we need to ensure that the data we're working with is Conversation models
    if (Array.isArray(data)) {
      hydratedData = [];
      for (let i = 0, max = data.length; i < max; i += 1) {
        const item = data[i];

        // We create a new model if it's not already a model
        if (!item.get) {
          hydratedData.push(new window.Whisper.Conversation(item));
        } else {
          hydratedData.push(item);
        }
      }
    } else if (!data.get) {
      hydratedData = new window.Whisper.Conversation(data);
    } else {
      hydratedData = data;
    }

    // Next, we update our lookups first to prevent infinite loops on the 'add' event
    this.generateLookups(
      Array.isArray(hydratedData) ? hydratedData : [hydratedData]
    );

    // Lastly, we fire off the add events related to this change
    window.Backbone.Collection.prototype.add.call(this, hydratedData);

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
      this._byGroupId[id] ||
      window.Backbone.Collection.prototype.get.call(this, id)
    );
  },

  comparator(m: WhatIsThis) {
    return -m.get('timestamp');
  },
});

// This is a wrapper model used to display group members in the member list view, within
//   the world of backbone, but layering another bit of group-specific data top of base
//   conversation data.
window.Whisper.GroupMemberConversation = window.Backbone.Model.extend({
  initialize(attributes: { conversation: boolean; isAdmin: boolean }) {
    const { conversation, isAdmin } = attributes;

    if (!conversation) {
      throw new Error(
        'GroupMemberConversation.initialize: conversation required!'
      );
    }
    if (!window._.isBoolean(isAdmin)) {
      throw new Error('GroupMemberConversation.initialize: isAdmin required!');
    }

    // If our underlying conversation changes, we change too
    this.listenTo(conversation, 'change', () => {
      this.trigger('change', this);
    });

    this.conversation = conversation;
    this.isAdmin = isAdmin;
  },

  format() {
    return {
      ...this.conversation.format(),
      isAdmin: this.isAdmin,
    };
  },

  get(...params: Array<string>) {
    return this.conversation.get(...params);
  },

  getTitle() {
    return this.conversation.getTitle();
  },

  isMe() {
    return isMe(this.conversation.attributes);
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
