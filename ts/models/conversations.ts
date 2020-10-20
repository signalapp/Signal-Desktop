/* eslint-disable class-methods-use-this */
/* eslint-disable camelcase */
import {
  MessageModelCollectionType,
  WhatIsThis,
  MessageAttributesType,
  ConversationAttributesType,
  VerificationOptions,
} from '../model-types.d';
import { CallHistoryDetailsType } from '../types/Calling';
import { CallbackResultType, GroupV2InfoType } from '../textsecure/SendMessage';
import {
  ConversationType,
  ConversationTypeType,
} from '../state/ducks/conversations';
import { ColorType } from '../types/Colors';
import { MessageModel } from './messages';
import { sniffImageMimeType } from '../util/sniffImageMimeType';
import { MIMEType, IMAGE_WEBP } from '../types/MIME';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveAccessKey,
  fromEncodedBinaryToArrayBuffer,
  getRandomBytes,
  stringFromBytes,
  verifyAccessKey,
} from '../Crypto';
import { GroupChangeClass } from '../textsecure.d';

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

const COLORS = [
  'red',
  'deep_orange',
  'brown',
  'pink',
  'purple',
  'indigo',
  'blue',
  'teal',
  'green',
  'light_green',
  'blue_grey',
  'ultramarine',
];

const THREE_HOURS = 3 * 60 * 60 * 1000;

interface CustomError extends Error {
  identifier?: string;
  number?: string;
}

export class ConversationModel extends window.Backbone.Model<
  ConversationAttributesType
> {
  static COLORS: string;

  cachedProps?: ConversationType | null;

  contactTypingTimers?: Record<
    string,
    { senderId: string; timer: NodeJS.Timer }
  >;

  contactCollection?: Backbone.Collection<WhatIsThis>;

  debouncedUpdateLastMessage?: () => void;

  // backbone ensures this exists in initialize()
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  generateProps: () => void;

  // backbone ensures this exists
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  id: string;

  initialPromise?: Promise<unknown>;

  inProgressFetch?: Promise<unknown>;

  incomingMessageQueue?: typeof window.PQueueType;

  jobQueue?: typeof window.PQueueType;

  messageCollection?: MessageModelCollectionType;

  ourNumber?: string;

  ourUuid?: string;

  storeName?: string | null;

  throttledBumpTyping: unknown;

  typingRefreshTimer?: NodeJS.Timer | null;

  typingPauseTimer?: NodeJS.Timer | null;

  verifiedEnum?: typeof window.textsecure.storage.protocol.VerifiedStatus;

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
    if (this.isPrivate()) {
      const uuid = this.get('uuid');
      const e164 = this.get('e164');
      return `${uuid || e164} (${this.id})`;
    }
    if (this.isGroupV2()) {
      return `groupv2(${this.get('groupId')})`;
    }

    const groupId = this.get('groupId');
    return `group(${groupId})`;
  }

  debugID(): string {
    const uuid = this.get('uuid');
    const e164 = this.get('e164');
    const groupId = this.get('groupId');
    return `group(${groupId}), sender(${uuid || e164}), id(${this.id})`;
  }

  // This is one of the few times that we want to collapse our uuid/e164 pair down into
  //   just one bit of data. If we have a UUID, we'll send using it.
  getSendTarget(): string | undefined {
    return this.get('uuid') || this.get('e164');
  }

  handleMessageError(message: unknown, errors: unknown): void {
    this.trigger('messageError', message, errors);
  }

  // eslint-disable-next-line class-methods-use-this
  getContactCollection(): Backbone.Collection<ConversationModel> {
    const collection = new window.Backbone.Collection<ConversationModel>();
    const collator = new Intl.Collator();
    collection.comparator = (
      left: ConversationModel,
      right: ConversationModel
    ) => {
      const leftLower = left.getTitle().toLowerCase();
      const rightLower = right.getTitle().toLowerCase();
      return collator.compare(leftLower, rightLower);
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

    this.contactCollection = this.getContactCollection();
    this.messageCollection = new window.Whisper.MessageCollection([], {
      conversation: this,
    });

    this.messageCollection.on('change:errors', this.handleMessageError, this);
    this.messageCollection.on('send-error', this.onMessageError, this);

    this.throttledBumpTyping = window._.throttle(this.bumpTyping, 300);
    this.debouncedUpdateLastMessage = window._.debounce(
      this.updateLastMessage.bind(this),
      200
    );

    this.listenTo(
      this.messageCollection,
      'add remove destroy content-changed',
      this.debouncedUpdateLastMessage
    );
    this.listenTo(this.messageCollection, 'sent', this.updateLastMessage);
    this.listenTo(this.messageCollection, 'send-error', this.updateLastMessage);

    this.on('newmessage', this.onNewMessage);
    this.on('change:profileKey', this.onChangeProfileKey);

    // Listening for out-of-band data updates
    this.on('delivered', this.updateAndMerge);
    this.on('read', this.updateAndMerge);
    this.on('expiration-change', this.updateAndMerge);
    this.on('expired', this.onExpired);

    const sealedSender = this.get('sealedSender');
    if (sealedSender === undefined) {
      this.set({ sealedSender: SEALED_SENDER.UNKNOWN });
    }
    this.unset('unidentifiedDelivery');
    this.unset('unidentifiedDeliveryUnrestricted');
    this.unset('hasFetchedProfile');
    this.unset('tokens');

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;

    // Keep props ready
    this.generateProps = () => {
      this.cachedProps = this.getProps();
    };
    this.on('change', this.generateProps);
    this.generateProps();
  }

  isMe(): boolean {
    const e164 = this.get('e164');
    const uuid = this.get('uuid');
    return Boolean(
      (e164 && e164 === this.ourNumber) || (uuid && uuid === this.ourUuid)
    );
  }

  isGroupV1(): boolean {
    const groupId = this.get('groupId');
    if (!groupId) {
      return false;
    }

    return fromEncodedBinaryToArrayBuffer(groupId).byteLength === 16;
  }

  isGroupV2(): boolean {
    const groupId = this.get('groupId');
    if (!groupId) {
      return false;
    }

    const groupVersion = this.get('groupVersion') || 0;

    return groupVersion === 2 && base64ToArrayBuffer(groupId).byteLength === 32;
  }

  isMemberPending(conversationId: string): boolean {
    if (!this.isGroupV2()) {
      throw new Error(
        `isPendingMember: Called for non-GroupV2 conversation ${this.idForLogging()}`
      );
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

  isMember(conversationId: string): boolean {
    if (!this.isGroupV2()) {
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
  ): Promise<GroupChangeClass.Actions | undefined> {
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
  ): Promise<GroupChangeClass.Actions | undefined> {
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

  async removePendingMember(
    conversationId: string
  ): Promise<GroupChangeClass.Actions | undefined> {
    const idLog = this.idForLogging();

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
      throw new Error(
        `removePendingMember/${idLog}: No conversation found for conversation ${conversationId}`
      );
    }

    const uuid = pendingMember.get('uuid');
    if (!uuid) {
      throw new Error(
        `removePendingMember/${idLog}: Missing uuid for conversation ${pendingMember.idForLogging()}`
      );
    }

    return window.Signal.Groups.buildDeletePendingMemberChange({
      group: this.attributes,
      uuid,
    });
  }

  async removeMember(
    conversationId: string
  ): Promise<GroupChangeClass.Actions | undefined> {
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

  async modifyGroupV2({
    name,
    createGroupChange,
  }: {
    name: string;
    createGroupChange: () => Promise<GroupChangeClass.Actions | undefined>;
  }): Promise<void> {
    const idLog = `${name}/${this.idForLogging()}`;

    if (!this.isGroupV2()) {
      throw new Error(
        `modifyGroupV2/${idLog}: Called for non-GroupV2 conversation`
      );
    }

    const ONE_MINUTE = 1000 * 60;
    const startTime = Date.now();
    const timeoutTime = startTime + ONE_MINUTE;

    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      window.log.info(`modifyGroupV2/${idLog}: Starting attempt ${attempt}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        await window.waitForEmptyEventQueue();

        window.log.info(`modifyGroupV2/${idLog}: Queuing attempt ${attempt}`);

        // eslint-disable-next-line no-await-in-loop
        await this.queueJob(async () => {
          window.log.info(`modifyGroupV2/${idLog}: Running attempt ${attempt}`);

          const actions = await createGroupChange();
          if (!actions) {
            window.log.warn(
              `modifyGroupV2/${idLog}: No change actions. Returning early.`
            );
            return;
          }

          // The new revision has to be exactly one more than the current revision
          //   or it won't upload properly, and it won't apply in maybeUpdateGroup
          const currentRevision = this.get('revision');
          const newRevision = actions.version;

          if ((currentRevision || 0) + 1 !== newRevision) {
            throw new Error(
              `modifyGroupV2/${idLog}: Revision mismatch - ${currentRevision} to ${newRevision}.`
            );
          }

          // Upload. If we don't have permission, the server will return an error here.
          const groupChange = await window.Signal.Groups.uploadGroupChange({
            actions,
            group: this.attributes,
            serverPublicParamsBase64: window.getServerPublicParams(),
          });

          const groupChangeBuffer = groupChange.toArrayBuffer();
          const groupChangeBase64 = arrayBufferToBase64(groupChangeBuffer);

          // Apply change locally, just like we would with an incoming change. This will
          //   change conversation state and add change notifications to the timeline.
          await window.Signal.Groups.maybeUpdateGroup({
            conversation: this,
            groupChangeBase64,
            newRevision,
          });

          // Send message to notify group members (including pending members) of change
          const profileKey = this.get('profileSharing')
            ? window.storage.get('profileKey')
            : undefined;

          const sendOptions = this.getSendOptions();
          const timestamp = Date.now();

          const promise = this.wrapSend(
            window.textsecure.messaging.sendMessageToGroup(
              {
                groupV2: this.getGroupV2Info({
                  groupChange: groupChangeBuffer,
                  includePendingMembers: true,
                }),
                timestamp,
                profileKey,
              },
              sendOptions
            )
          );

          // We don't save this message; we just use it to ensure that a sync message is
          //   sent to our linked devices.
          const m = new window.Whisper.Message(({
            conversationId: this.id,
            type: 'not-to-save',
            sent_at: timestamp,
            received_at: timestamp,
            // TODO: DESKTOP-722
            // this type does not fully implement the interface it is expected to
          } as unknown) as MessageAttributesType);

          // This is to ensure that the functions in send() and sendSyncMessage()
          //   don't save anything to the database.
          m.doNotSave = true;

          await m.send(promise);
        });

        // If we've gotten here with no error, we exit!
        window.log.info(
          `modifyGroupV2/${idLog}: Update complete, with attempt ${attempt}!`
        );
        break;
      } catch (error) {
        if (error.code === 409 && Date.now() <= timeoutTime) {
          window.log.info(
            `modifyGroupV2/${idLog}: Conflict while updating. Trying again...`
          );

          // eslint-disable-next-line no-await-in-loop
          await this.fetchLatestGroupV2Data();
        } else if (error.code === 409) {
          window.log.error(
            `modifyGroupV2/${idLog}: Conflict while updating. Timed out; not retrying.`
          );
          // We don't wait here because we're breaking out of the loop immediately.
          this.fetchLatestGroupV2Data();
          throw error;
        } else {
          const errorString = error && error.stack ? error.stack : error;
          window.log.error(
            `modifyGroupV2/${idLog}: Error updating: ${errorString}`
          );
          throw error;
        }
      }
    }
  }

  isEverUnregistered(): boolean {
    return Boolean(this.get('discoveredUnregisteredAt'));
  }

  isUnregistered(): boolean {
    const now = Date.now();
    const sixHoursAgo = now - 1000 * 60 * 60 * 6;
    const discoveredUnregisteredAt = this.get('discoveredUnregisteredAt');

    if (discoveredUnregisteredAt && discoveredUnregisteredAt > sixHoursAgo) {
      return true;
    }

    return false;
  }

  setUnregistered(): void {
    window.log.info(`Conversation ${this.idForLogging()} is now unregistered`);
    this.set({
      discoveredUnregisteredAt: Date.now(),
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  setRegistered(): void {
    window.log.info(
      `Conversation ${this.idForLogging()} is registered once again`
    );
    this.set({
      discoveredUnregisteredAt: undefined,
    });
    window.Signal.Data.updateConversation(this.attributes);
  }

  isBlocked(): boolean {
    const uuid = this.get('uuid');
    if (uuid) {
      return window.storage.isUuidBlocked(uuid);
    }

    const e164 = this.get('e164');
    if (e164) {
      return window.storage.isBlocked(e164);
    }

    const groupId = this.get('groupId');
    if (groupId) {
      return window.storage.isGroupBlocked(groupId);
    }

    return false;
  }

  block({ viaStorageServiceSync = false } = {}): void {
    let blocked = false;
    const isBlocked = this.isBlocked();

    const uuid = this.get('uuid');
    if (uuid) {
      window.storage.addBlockedUuid(uuid);
      blocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      window.storage.addBlockedNumber(e164);
      blocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      window.storage.addBlockedGroup(groupId);
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
      window.storage.removeBlockedUuid(uuid);
      unblocked = true;
    }

    const e164 = this.get('e164');
    if (e164) {
      window.storage.removeBlockedNumber(e164);
      unblocked = true;
    }

    const groupId = this.get('groupId');
    if (groupId) {
      window.storage.removeBlockedGroup(groupId);
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
      this.captureChange('profileSharing');
    }
  }

  disableProfileSharing({ viaStorageServiceSync = false } = {}): void {
    const before = this.get('profileSharing');

    this.set({ profileSharing: false });

    const after = this.get('profileSharing');

    if (!viaStorageServiceSync && Boolean(before) !== Boolean(after)) {
      this.captureChange('profileSharing');
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
      return draft;
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
    if (!this.isGroupV2()) {
      return;
    }

    await window.Signal.Groups.waitThenMaybeUpdateGroup({
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

  getGroupV2Info(
    options: { groupChange?: ArrayBuffer; includePendingMembers?: boolean } = {}
  ): GroupV2InfoType | undefined {
    const { groupChange, includePendingMembers } = options;

    if (this.isPrivate() || !this.isGroupV2()) {
      return undefined;
    }
    return {
      masterKey: window.Signal.Crypto.base64ToArrayBuffer(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('masterKey')!
      ),
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      revision: this.get('revision')!,
      members: this.getRecipients({
        includePendingMembers,
      }),
      groupChange,
    };
  }

  getGroupV1Info(): WhatIsThis {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (this.isPrivate() || this.get('groupVersion')! > 0) {
      return undefined;
    }

    return {
      id: this.get('groupId'),
      members: this.getRecipients(),
    };
  }

  sendTypingMessage(isTyping: boolean): void {
    if (!window.textsecure.messaging) {
      return;
    }

    // We don't send typing messages to our other devices
    if (this.isMe()) {
      return;
    }

    const recipientId = this.isPrivate() ? this.getSendTarget() : undefined;
    const groupId = !this.isPrivate() ? this.get('groupId') : undefined;
    const groupMembers = this.getRecipients();

    // We don't send typing messages if our recipients list is empty
    if (!this.isPrivate() && !groupMembers.length) {
      return;
    }

    const sendOptions = this.getSendOptions();
    this.wrapSend(
      window.textsecure.messaging.sendTypingMessage(
        {
          isTyping,
          recipientId,
          groupId,
          groupMembers,
        },
        sendOptions
      )
    );
  }

  async cleanup(): Promise<void> {
    await window.Signal.Types.Conversation.deleteExternalFiles(
      this.attributes,
      {
        deleteAttachmentData,
      }
    );
  }

  async updateAndMerge(message: MessageModel): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.debouncedUpdateLastMessage!();

    const mergeMessage = () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const existing = this.messageCollection!.get(message.id);
      if (!existing) {
        return;
      }

      existing.merge(message.attributes);
    };

    await this.inProgressFetch;
    mergeMessage();
  }

  async onExpired(message: MessageModel): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.debouncedUpdateLastMessage!();

    const removeMessage = () => {
      const { id } = message;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const existing = this.messageCollection!.get(id);
      if (!existing) {
        return;
      }

      window.log.info('Remove expired message from collection', {
        sentAt: existing.get('sent_at'),
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.messageCollection!.remove(id);
      existing.trigger('expired');
      existing.cleanup();

      // An expired message only counts as decrementing the message count, not
      // the sent message count
      this.decrementMessageCount();
    };

    // If a fetch is in progress, then we need to wait until that's complete to
    //   do this removal. Otherwise we could remove from messageCollection, then
    //   the async database fetch could include the removed message.

    await this.inProgressFetch;
    removeMessage();
  }

  async onNewMessage(message: WhatIsThis): Promise<void> {
    const uuid = message.get ? message.get('sourceUuid') : message.sourceUuid;
    const e164 = message.get ? message.get('source') : message.source;
    const sourceDevice = message.get
      ? message.get('sourceDevice')
      : message.sourceDevice;

    const sourceId = window.ConversationController.ensureContactIds({
      uuid,
      e164,
    });
    const typingToken = `${sourceId}.${sourceDevice}`;

    // Clear typing indicator for a given contact if we receive a message from them
    this.clearContactTypingTimer(typingToken);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.debouncedUpdateLastMessage!();
  }

  // For outgoing messages, we can call this directly. We're already loaded.
  addSingleMessage(message: MessageModel): MessageModel {
    const { id } = message;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const existing = this.messageCollection!.get(id);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const model = this.messageCollection!.add(message, { merge: true });
    model.setToExpire();

    if (!existing) {
      const { messagesAdded } = window.reduxActions.conversations;
      const isNewMessage = true;
      messagesAdded(
        this.id,
        [model.getReduxData()],
        isNewMessage,
        window.isActive()
      );
    }

    return model;
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

  format(): ConversationType | null | undefined {
    return this.cachedProps;
  }

  getProps(): ConversationType | null {
    // This is to prevent race conditions on startup; Conversation models are created
    //   but the full window.ConversationController.load() sequence isn't complete. So, we
    //   don't cache props on create, but we do later when load() calls generateProps()
    //   for us.
    if (!window.ConversationController.isFetchComplete()) {
      return null;
    }

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
    const shouldShowDraft = (this.hasDraft() &&
      draftTimestamp &&
      draftTimestamp >= timestamp) as boolean;
    const inboxPosition = this.get('inbox_position');
    const messageRequestsEnabled = window.Signal.RemoteConfig.isEnabled(
      'desktop.messageRequests'
    );

    // TODO: DESKTOP-720
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    const result = {
      id: this.id,
      uuid: this.get('uuid'),
      e164: this.get('e164'),

      acceptedMessageRequest: this.getAccepted(),
      activeAt: this.get('active_at')!,
      avatarPath: this.getAvatarPath()!,
      color,
      draftPreview,
      draftText,
      firstName: this.get('profileName')!,
      inboxPosition,
      isAccepted: this.getAccepted(),
      isArchived: this.get('isArchived')!,
      isBlocked: this.isBlocked(),
      isMe: this.isMe(),
      isPinned: this.get('isPinned'),
      isVerified: this.isVerified(),
      lastMessage: {
        status: this.get('lastMessageStatus')!,
        text: this.get('lastMessage')!,
        deletedForEveryone: this.get('lastMessageDeletedForEveryone')!,
      },
      lastUpdated: this.get('timestamp')!,
      membersCount: this.isPrivate()
        ? undefined
        : (this.get('membersV2')! || this.get('members')! || []).length,
      messageRequestsEnabled,
      muteExpiresAt: this.get('muteExpiresAt')!,
      name: this.get('name')!,
      phoneNumber: this.getNumber()!,
      profileName: this.getProfileName()!,
      sharedGroupNames: this.get('sharedGroupNames')!,
      shouldShowDraft,
      timestamp,
      title: this.getTitle()!,
      type: (this.isPrivate() ? 'direct' : 'group') as ConversationTypeType,
      typingContact: typingContact ? typingContact.format() : null,
      unreadCount: this.get('unreadCount')! || 0,
    };
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
          messageId: first ? first.id : undefined,
        }
      );

      if (!messages.length) {
        return;
      }

      const readMessages = messages.filter(
        m => !m.hasErrors() && m.isIncoming()
      );
      const receiptSpecs = readMessages.map(m => ({
        senderE164: m.get('source'),
        senderUuid: m.get('sourceUuid'),
        senderId: window.ConversationController.ensureContactIds({
          e164: m.get('source'),
          uuid: m.get('sourceUuid'),
        }),
        timestamp: m.get('sent_at'),
        hasErrors: m.hasErrors(),
      }));

      if (isLocalAction) {
        // eslint-disable-next-line no-await-in-loop
        await this.sendReadReceiptsFor(receiptSpecs);
      }

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(readMessages.map(m => m.queueAttachmentDownloads()));
    } while (messages.length > 0);
  }

  async applyMessageRequestResponse(
    response: number,
    { fromSync = false, viaStorageServiceSync = false } = {}
  ): Promise<void> {
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
    window.Signal.Data.updateConversation(this.attributes);

    if (response === messageRequestEnum.ACCEPT) {
      this.unblock({ viaStorageServiceSync });
      this.enableProfileSharing({ viaStorageServiceSync });

      // We really don't want to call this if we don't have to. It can take a lot of time
      //   to go through old messages to download attachments.
      if (didResponseChange && !wasPreviouslyAccepted) {
        await this.handleReadAndDownloadAttachments({ isLocalAction });
      }

      if (isLocalAction) {
        if (this.isGroupV1() || this.isPrivate()) {
          this.sendProfileKeyUpdate();
        } else if (
          ourConversationId &&
          this.isGroupV2() &&
          this.isMemberPending(ourConversationId)
        ) {
          await this.modifyGroupV2({
            name: 'promotePendingMember',
            createGroupChange: () =>
              this.promotePendingMember(ourConversationId),
          });
        } else if (
          ourConversationId &&
          this.isGroupV2() &&
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
        if (this.isGroupV1() || this.isPrivate()) {
          await this.leaveGroup();
        } else if (this.isGroupV2()) {
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

        if (this.isGroupV1() || this.isPrivate()) {
          await this.leaveGroup();
        } else if (this.isGroupV2()) {
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

        if (this.isGroupV1() || this.isPrivate()) {
          await this.leaveGroup();
        } else if (this.isGroupV2()) {
          await this.leaveGroupV2();
        }
      }
    }
  }

  async leaveGroupV2(): Promise<void> {
    const ourConversationId = window.ConversationController.getOurConversationId();

    if (
      ourConversationId &&
      this.isGroupV2() &&
      this.isMemberPending(ourConversationId)
    ) {
      await this.modifyGroupV2({
        name: 'delete',
        createGroupChange: () => this.removePendingMember(ourConversationId),
      });
    } else if (
      ourConversationId &&
      this.isGroupV2() &&
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

  async syncMessageRequestResponse(response: number): Promise<void> {
    // In GroupsV2, this may modify the server. We only want to continue if those
    //   server updates were successful.
    await this.applyMessageRequestResponse(response);

    const { ourNumber, ourUuid } = this;
    const { wrap, sendOptions } = window.ConversationController.prepareForSend(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ourNumber || ourUuid!,
      {
        syncMessage: true,
      }
    );

    await wrap(
      window.textsecure.messaging.syncMessageRequestResponse(
        {
          threadE164: this.get('e164'),
          threadUuid: this.get('uuid'),
          groupId: this.get('groupId'),
          type: response,
        },
        sendOptions
      )
    );
  }

  onMessageError(): void {
    this.updateVerified();
  }

  async safeGetVerified(): Promise<number> {
    const promise = window.textsecure.storage.protocol.getVerified(this.id);
    return promise.catch(
      () => window.textsecure.storage.protocol.VerifiedStatus.DEFAULT
    );
  }

  async updateVerified(): Promise<void> {
    if (this.isPrivate()) {
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
        if (!contact.isMe()) {
          await contact.updateVerified();
        }
      })
    );

    this.onMemberVerifiedChange();
  }

  setVerifiedDefault(options?: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { DEFAULT } = this.verifiedEnum!;
    return this.queueJob(() => this._setVerified(DEFAULT, options));
  }

  setVerified(options?: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { VERIFIED } = this.verifiedEnum!;
    return this.queueJob(() => this._setVerified(VERIFIED, options));
  }

  setUnverified(options: VerificationOptions): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { UNVERIFIED } = this.verifiedEnum!;
    return this.queueJob(() => this._setVerified(UNVERIFIED, options));
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

    if (!this.isPrivate()) {
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        options.key!
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
    const { sendOptions } = window.ConversationController.prepareForSend(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.ourNumber || this.ourUuid!,
      { syncMessage: true }
    );
    const contactSendOptions = this.getSendOptions();
    const options = { ...sendOptions, ...contactSendOptions };

    const promise = window.textsecure.storage.protocol.loadIdentityKey(e164);
    return promise.then(key =>
      this.wrapSend(
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
    if (this.isPrivate()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.get('verified') === this.verifiedEnum!.VERIFIED;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.contactCollection!.length) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.contactCollection!.every(contact => {
      if (contact.isMe()) {
        return true;
      }
      return contact.isVerified();
    });
  }

  isUnverified(): boolean {
    if (this.isPrivate()) {
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
      if (contact.isMe()) {
        return false;
      }
      return contact.isUnverified();
    });
  }

  getUnverified(): Backbone.Collection<ConversationModel> {
    if (this.isPrivate()) {
      return this.isUnverified()
        ? new window.Backbone.Collection([this])
        : new window.Backbone.Collection();
    }
    return new window.Backbone.Collection(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.filter(contact => {
        if (contact.isMe()) {
          return false;
        }
        return contact.isUnverified();
      })
    );
  }

  setApproved(): boolean | void {
    if (!this.isPrivate()) {
      throw new Error(
        'You cannot set a group conversation as trusted. ' +
          'You must set individual contacts as trusted.'
      );
    }

    return window.textsecure.storage.protocol.setApproval(this.id, true);
  }

  async safeIsUntrusted(): Promise<boolean> {
    return window.textsecure.storage.protocol
      .isUntrusted(this.id)
      .catch(() => false);
  }

  async isUntrusted(): Promise<boolean> {
    if (this.isPrivate()) {
      return this.safeIsUntrusted();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!this.contactCollection!.length) {
      return Promise.resolve(false);
    }

    return Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.map(contact => {
        if (contact.isMe()) {
          return false;
        }
        return contact.safeIsUntrusted();
      })
    ).then(results => window._.any(results, result => result));
  }

  async getUntrusted(): Promise<Backbone.Collection> {
    // This is a bit ugly because isUntrusted() is async. Could do the work to cache
    //   it locally, but we really only need it for this call.
    if (this.isPrivate()) {
      return this.isUntrusted().then(untrusted => {
        if (untrusted) {
          return new window.Backbone.Collection([this]);
        }

        return new window.Backbone.Collection();
      });
    }
    return Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.map(contact => {
        if (contact.isMe()) {
          return [false, contact];
        }
        return Promise.all([contact.isUntrusted(), contact]);
      })
    ).then(results => {
      const filtered = window._.filter(results, result => {
        const untrusted = result[0];
        return untrusted;
      });
      return new window.Backbone.Collection(
        window._.map(filtered, result => {
          const contact = result[1];
          return contact;
        })
      );
    });
  }

  getSentMessageCount(): number {
    return this.get('sentMessageCount') || 0;
  }

  getMessageRequestResponseType(): number {
    return this.get('messageRequestResponseType') || 0;
  }

  /**
   * Determine if this conversation should be considered "accepted" in terms
   * of message requests
   */
  getAccepted(): boolean {
    const messageRequestsEnabled = window.Signal.RemoteConfig.isEnabled(
      'desktop.messageRequests'
    );

    if (!messageRequestsEnabled) {
      return true;
    }

    if (this.isMe()) {
      return true;
    }

    const messageRequestEnum =
      window.textsecure.protobuf.SyncMessage.MessageRequestResponse.Type;
    if (this.getMessageRequestResponseType() === messageRequestEnum.ACCEPT) {
      return true;
    }

    const isFromOrAddedByTrustedContact = this.isFromOrAddedByTrustedContact();
    const hasSentMessages = this.getSentMessageCount() > 0;
    const hasMessagesBeforeMessageRequests =
      (this.get('messageCountBeforeMessageRequests') || 0) > 0;
    const hasNoMessages = (this.get('messageCount') || 0) === 0;

    const isEmptyPrivateConvo = hasNoMessages && this.isPrivate();
    const isEmptyWhitelistedGroup =
      hasNoMessages && !this.isPrivate() && this.get('profileSharing');

    return (
      isFromOrAddedByTrustedContact ||
      hasSentMessages ||
      hasMessagesBeforeMessageRequests ||
      // an empty group is the scenario where we need to rely on
      // whether the profile has already been shared or not
      isEmptyPrivateConvo ||
      isEmptyWhitelistedGroup
    );
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
      received_at: timestamp,
      key_changed: keyChangedId,
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

  async addVerifiedChange(
    verifiedChangeId: string,
    verified: boolean,
    providedOptions: Record<string, unknown>
  ): Promise<void> {
    const options = providedOptions || {};
    window._.defaults(options, { local: true });

    if (this.isMe()) {
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
      received_at: timestamp,
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

    if (this.isPrivate()) {
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
    const { acceptedTime, endedTime, wasDeclined } = callHistoryDetails;
    const message = ({
      conversationId: this.id,
      type: 'call-history',
      sent_at: endedTime,
      received_at: endedTime,
      unread: !wasDeclined && !acceptedTime,
      callHistoryDetails,
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

  async addProfileChange(
    profileChange: unknown,
    conversationId?: string
  ): Promise<void> {
    const message = ({
      conversationId: this.id,
      type: 'profile-change',
      sent_at: Date.now(),
      received_at: Date.now(),
      unread: true,
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

    if (this.isPrivate()) {
      window.ConversationController.getAllGroupsInvolvingId(this.id).then(
        groups => {
          window._.forEach(groups, group => {
            group.addProfileChange(profileChange, this.id);
          });
        }
      );
    }
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
    return this.queueJob(() =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.markRead(message.get('received_at')!, {
        sendReadReceipts: false,
        readAt,
      })
    );
  }

  getUnread(): Promise<MessageModelCollectionType> {
    return window.Signal.Data.getUnreadByConversation(this.id, {
      MessageCollection: window.Whisper.MessageCollection,
    });
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
    if (this.isPrivate() && this.get('e164')) {
      const regionCode = window.storage.get('regionCode');
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

      return number.error || 'Invalid phone number';
    }

    return null;
  }

  validateUuid(): string | null {
    if (this.isPrivate() && this.get('uuid')) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (window.isValidGuid(this.get('uuid')!)) {
        return null;
      }

      return 'Invalid UUID';
    }

    return null;
  }

  queueJob(callback: () => unknown | Promise<unknown>): Promise<WhatIsThis> {
    this.jobQueue = this.jobQueue || new window.PQueue({ concurrency: 1 });

    const taskWithTimeout = window.textsecure.createTaskWithTimeout(
      callback,
      `conversation ${this.idForLogging()}`
    );

    return this.jobQueue.add(taskWithTimeout);
  }

  getMembers(
    options: { includePendingMembers?: boolean } = {}
  ): Array<WhatIsThis> {
    if (this.isPrivate()) {
      return [this];
    }

    if (this.get('membersV2')) {
      const { includePendingMembers } = options;
      const members: Array<{ conversationId: string }> = includePendingMembers
        ? [
            ...(this.get('membersV2') || []),
            ...(this.get('pendingMembersV2') || []),
          ]
        : this.get('membersV2') || [];

      return window._.compact(
        members.map(member => {
          const c = window.ConversationController.get(member.conversationId);

          // In groups we won't sent to contacts we believe are unregistered
          if (c && c.isUnregistered()) {
            return null;
          }

          return c;
        })
      );
    }

    if (this.get('members')) {
      return window._.compact(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('members')!.map(id => {
          const c = window.ConversationController.get(id);

          // In groups we won't sent to contacts we believe are unregistered
          if (c && c.isUnregistered()) {
            return null;
          }

          return c;
        })
      );
    }

    window.log.warn(
      'getMembers: Group conversation had neither membersV2 nor members'
    );

    return [];
  }

  getMemberIds(): Array<string> {
    const members = this.getMembers();
    return members.map(member => member.id);
  }

  getRecipients(
    options: { includePendingMembers?: boolean } = {}
  ): Array<string> {
    const { includePendingMembers } = options;

    const members = this.getMembers({ includePendingMembers });

    // Eliminate our
    return window._.compact(
      members.map(member => (member.isMe() ? null : member.getSendTarget()))
    );
  }

  async getQuoteAttachment(
    attachments: Array<WhatIsThis>,
    preview: Array<WhatIsThis>,
    sticker: WhatIsThis
  ): Promise<WhatIsThis> {
    if (attachments && attachments.length) {
      return Promise.all(
        attachments
          .filter(
            attachment =>
              attachment &&
              attachment.contentType &&
              !attachment.pending &&
              !attachment.error
          )
          .slice(0, 1)
          .map(async attachment => {
            const { fileName, thumbnail, contentType } = attachment;

            return {
              contentType,
              // Our protos library complains about this field being undefined, so we
              //   force it to null
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
      return Promise.all(
        preview
          .filter(item => item && item.image)
          .slice(0, 1)
          .map(async attachment => {
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
  ): Promise<WhatIsThis> {
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
      author: contact.get('e164'),
      authorUuid: contact.get('uuid'),
      bodyRanges: quotedMessage.get('bodyRanges'),
      id: quotedMessage.get('sent_at'),
      text: body || embeddedContactName,
      attachments: quotedMessage.isTapToView()
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

    const deleteModel = window.Whisper.Deletes.add({
      targetSentTimestamp: targetTimestamp,
      fromId: window.ConversationController.getOurConversationId(),
    });

    window.Whisper.Deletes.onDelete(deleteModel);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const recipients = this.getRecipients();

    let profileKey: ArrayBuffer | undefined;
    if (this.get('profileSharing')) {
      profileKey = window.storage.get('profileKey');
    }

    return this.queueJob(async () => {
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
        received_at: timestamp,
        recipients,
        deletedForEveryoneTimestamp: targetTimestamp,
        // TODO: DESKTOP-722
      } as unknown) as typeof window.Whisper.MessageAttributesType;

      if (this.isPrivate()) {
        attributes.destination = destination;
      }

      // We are only creating this model so we can use its sync message
      // sending functionality. It will not be saved to the datbase.
      const message = new window.Whisper.Message(attributes);

      // We're offline!
      if (!window.textsecure.messaging) {
        throw new Error('Cannot send DOE while offline!');
      }

      const options = this.getSendOptions();

      const promise = (() => {
        if (this.isPrivate()) {
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
            profileKey,
            options
          );
        }

        return window.textsecure.messaging.sendMessageToGroup(
          {
            groupV1: this.getGroupV1Info(),
            groupV2: this.getGroupV2Info(),
            deletedForEveryoneTimestamp: targetTimestamp,
            timestamp,
            profileKey,
          },
          options
        );
      })();

      // This is to ensure that the functions in send() and sendSyncMessage() don't save
      //   anything to the database.
      message.doNotSave = true;

      return message.send(this.wrapSend(promise));
    }).catch(error => {
      window.log.error(
        'Error sending deleteForEveryone',
        deleteModel,
        targetTimestamp,
        error
      );

      throw error;
    });
  }

  async sendReactionMessage(
    reaction: { emoji: string; remove: boolean },
    target: {
      targetAuthorE164: string;
      targetAuthorUuid: string;
      targetTimestamp: number;
    }
  ): Promise<WhatIsThis> {
    const timestamp = Date.now();
    const outgoingReaction = { ...reaction, ...target };
    const expireTimer = this.get('expireTimer');

    const reactionModel = window.Whisper.Reactions.add({
      ...outgoingReaction,
      fromId: window.ConversationController.getOurConversationId(),
      timestamp,
      fromSync: true,
    });
    window.Whisper.Reactions.onReaction(reactionModel);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const recipients = this.getRecipients();

    let profileKey: ArrayBuffer | undefined;
    if (this.get('profileSharing')) {
      profileKey = window.storage.get('profileKey');
    }

    return this.queueJob(async () => {
      window.log.info(
        'Sending reaction to conversation',
        this.idForLogging(),
        'with timestamp',
        timestamp
      );

      const attributes = ({
        id: window.getGuid(),
        type: 'outgoing',
        conversationId: this.get('id'),
        sent_at: timestamp,
        received_at: timestamp,
        recipients,
        reaction: outgoingReaction,
        // TODO: DESKTOP-722
      } as unknown) as typeof window.Whisper.MessageAttributesType;

      if (this.isPrivate()) {
        attributes.destination = destination;
      }

      // We are only creating this model so we can use its sync message
      // sending functionality. It will not be saved to the datbase.
      const message = new window.Whisper.Message(attributes);

      // We're offline!
      if (!window.textsecure.messaging) {
        throw new Error('Cannot send reaction while offline!');
      }

      // Special-case the self-send case - we send only a sync message
      if (this.isMe()) {
        const dataMessage = await window.textsecure.messaging.getMessageProto(
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
          profileKey
        );
        return message.sendSyncMessageOnly(dataMessage);
      }

      const options = this.getSendOptions();

      const promise = (() => {
        if (this.isPrivate()) {
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
            profileKey,
            options
          );
        }

        return window.textsecure.messaging.sendMessageToGroup(
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
          options
        );
      })();

      // This is to ensure that the functions in send() and sendSyncMessage() don't save
      //   anything to the database.
      message.doNotSave = true;

      return message.send(this.wrapSend(promise));
    }).catch(error => {
      window.log.error('Error sending reaction', reaction, target, error);

      const reverseReaction = reactionModel.clone();
      reverseReaction.set('remove', !reverseReaction.get('remove'));
      window.Whisper.Reactions.onReaction(reverseReaction);

      throw error;
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
    const profileKey = window.storage.get('profileKey');
    await window.textsecure.messaging.sendProfileKeyUpdate(
      profileKey,
      recipients,
      this.getSendOptions(),
      this.get('groupId')
    );
  }

  sendMessage(
    body: string | null,
    attachments: Array<WhatIsThis>,
    quote: WhatIsThis,
    preview: WhatIsThis,
    sticker: WhatIsThis
  ): void {
    this.clearTypingTimers();

    const { clearUnreadMetrics } = window.reduxActions.conversations;
    clearUnreadMetrics(this.id);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const destination = this.getSendTarget()!;
    const expireTimer = this.get('expireTimer');
    const recipients = this.getRecipients();

    let profileKey: ArrayBuffer | undefined;
    if (this.get('profileSharing')) {
      profileKey = window.storage.get('profileKey');
    }

    this.queueJob(async () => {
      const now = Date.now();

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
        received_at: now,
        expireTimer,
        recipients,
        sticker,
      });

      if (this.isPrivate()) {
        messageWithSchema.destination = destination;
      }
      const attributes = {
        ...messageWithSchema,
        id: window.getGuid(),
      };

      const model = this.addSingleMessage(attributes);
      if (sticker) {
        await addStickerPackReference(model.id, sticker.packId);
      }
      const message = window.MessageController.register(model.id, model);
      await window.Signal.Data.saveMessage(message.attributes, {
        forceSave: true,
        Message: window.Whisper.Message,
      });

      this.set({
        lastMessage: model.getNotificationText(),
        lastMessageStatus: 'sending',
        active_at: now,
        timestamp: now,
        isArchived: false,
        draft: null,
        draftTimestamp: null,
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

      // Special-case the self-send case - we send only a sync message
      if (this.isMe()) {
        const dataMessage = await window.textsecure.messaging.getMessageProto(
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
          profileKey
        );
        return message.sendSyncMessageOnly(dataMessage);
      }

      const conversationType = this.get('type');
      const options = this.getSendOptions();

      let promise;
      if (conversationType === Message.GROUP) {
        promise = window.textsecure.messaging.sendMessageToGroup(
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
          },
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
          profileKey,
          options
        );
      }

      return message.send(this.wrapSend(promise));
    });
  }

  async wrapSend(
    promise: Promise<CallbackResultType | void | null>
  ): Promise<CallbackResultType | void | null> {
    return promise.then(
      async result => {
        // success
        if (result) {
          await this.handleMessageSendResult(
            result.failoverIdentifiers,
            result.unidentifiedDeliveries,
            result.discoveredIdentifierPairs
          );
        }
        return result;
      },
      async result => {
        // failure
        if (result) {
          await this.handleMessageSendResult(
            result.failoverIdentifiers,
            result.unidentifiedDeliveries,
            result.discoveredIdentifierPairs
          );
        }
        throw result;
      }
    );
  }

  async handleMessageSendResult(
    failoverIdentifiers: Array<string> | undefined,
    unidentifiedDeliveries: Array<string> | undefined,
    discoveredIdentifierPairs:
      | Array<{
          uuid: string | null;
          e164: string | null;
        }>
      | undefined
  ): Promise<void> {
    (discoveredIdentifierPairs || []).forEach(item => {
      const { uuid, e164 } = item;
      window.ConversationController.ensureContactIds({
        uuid,
        e164,
        highTrust: true,
      });
    });

    await Promise.all(
      (failoverIdentifiers || []).map(async identifier => {
        const conversation = window.ConversationController.get(identifier);

        if (
          conversation &&
          conversation.get('sealedSender') !== SEALED_SENDER.DISABLED
        ) {
          window.log.info(
            `Setting sealedSender to DISABLED for conversation ${conversation.idForLogging()}`
          );
          conversation.set({
            sealedSender: SEALED_SENDER.DISABLED,
          });
          window.Signal.Data.updateConversation(conversation.attributes);
        }
      })
    );

    await Promise.all(
      (unidentifiedDeliveries || []).map(async identifier => {
        const conversation = window.ConversationController.get(identifier);

        if (
          conversation &&
          conversation.get('sealedSender') === SEALED_SENDER.UNKNOWN
        ) {
          if (conversation.get('accessKey')) {
            window.log.info(
              `Setting sealedSender to ENABLED for conversation ${conversation.idForLogging()}`
            );
            conversation.set({
              sealedSender: SEALED_SENDER.ENABLED,
            });
          } else {
            window.log.info(
              `Setting sealedSender to UNRESTRICTED for conversation ${conversation.idForLogging()}`
            );
            conversation.set({
              sealedSender: SEALED_SENDER.UNRESTRICTED,
            });
          }
          window.Signal.Data.updateConversation(conversation.attributes);
        }
      })
    );
  }

  getSendOptions(options = {}): WhatIsThis {
    const senderCertificate = window.storage.get('senderCertificate');
    const sendMetadata = this.getSendMetadata(options);

    return {
      senderCertificate,
      sendMetadata,
    };
  }

  getUuidCapable(): boolean {
    return Boolean(window._.property('uuid')(this.get('capabilities')));
  }

  getSendMetadata(
    options: { syncMessage?: string; disableMeCheck?: boolean } = {}
  ): WhatIsThis | null {
    const { syncMessage, disableMeCheck } = options;

    // START: this code has an Expiration date of ~2018/11/21
    // We don't want to enable unidentified delivery for send unless it is
    //   also enabled for our own account.
    const myId = window.ConversationController.getOurConversationId();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const me = window.ConversationController.get(myId)!;
    if (!disableMeCheck && me.get('sealedSender') === SEALED_SENDER.DISABLED) {
      return null;
    }
    // END

    if (!this.isPrivate()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const infoArray = this.contactCollection!.map(conversation =>
        conversation.getSendMetadata(options)
      );
      return Object.assign({}, ...infoArray);
    }

    const accessKey = this.get('accessKey');
    const sealedSender = this.get('sealedSender');
    const uuidCapable = this.getUuidCapable();

    // We never send sync messages as sealed sender
    if (syncMessage && this.isMe()) {
      return null;
    }

    const e164 = this.get('e164');
    const uuid = this.get('uuid');

    // If we've never fetched user's profile, we default to what we have
    if (sealedSender === SEALED_SENDER.UNKNOWN) {
      const info = {
        accessKey: accessKey || arrayBufferToBase64(getRandomBytes(16)),
        // Indicates that a client is capable of receiving uuid-only messages.
        // Not used yet.
        uuidCapable,
      };
      return {
        ...(e164 ? { [e164]: info } : {}),
        ...(uuid ? { [uuid]: info } : {}),
      };
    }

    if (sealedSender === SEALED_SENDER.DISABLED) {
      return null;
    }

    const info = {
      accessKey:
        accessKey && sealedSender === SEALED_SENDER.ENABLED
          ? accessKey
          : arrayBufferToBase64(getRandomBytes(16)),
      // Indicates that a client is capable of receiving uuid-only messages.
      // Not used yet.
      uuidCapable,
    };

    return {
      ...(e164 ? { [e164]: info } : {}),
      ...(uuid ? { [uuid]: info } : {}),
    };
  }

  // Is this someone who is a contact, or are we sharing our profile with them?
  //   Or is the person who added us to this group a contact or are we sharing profile
  //   with them?
  isFromOrAddedByTrustedContact(): boolean {
    if (this.isPrivate()) {
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
      conv.isMe() || conv.get('name') || conv.get('profileSharing')
    );
  }

  async updateLastMessage(): Promise<void> {
    if (!this.id) {
      return;
    }

    let [previewMessage, activityMessage] = await Promise.all([
      window.Signal.Data.getLastConversationPreview(this.id, {
        Message: window.Whisper.Message,
      }),
      window.Signal.Data.getLastConversationActivity(this.id, {
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
        (previewMessage ? previewMessage.getMessagePropStatus() : null) || null,
      timestamp,
      lastMessageDeletedForEveryone: previewMessage
        ? previewMessage.deletedForEveryone
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

  async updateExpirationTimer(
    providedExpireTimer: number | undefined,
    providedSource: unknown,
    receivedAt: number,
    options: { fromSync?: unknown; fromGroupUpdate?: unknown } = {}
  ): Promise<boolean | null | MessageModel | void> {
    if (this.isGroupV2()) {
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
    window.Signal.Data.updateConversation(this.attributes);

    const model = new window.Whisper.Message(({
      // Even though this isn't reflected to the user, we want to place the last seen
      //   indicator above it. We set it to 'unread' to trigger that placement.
      unread: 1,
      conversationId: this.id,
      // No type; 'incoming' messages are specially treated by conversation.markRead()
      sent_at: timestamp,
      received_at: timestamp,
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

    if (this.isPrivate()) {
      model.set({ destination: this.getSendTarget() });
    }
    if (model.isOutgoing()) {
      model.set({ recipients: this.getRecipients() });
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

    let profileKey;
    if (this.get('profileSharing')) {
      profileKey = window.storage.get('profileKey');
    }
    const sendOptions = this.getSendOptions();
    let promise;

    if (this.isMe()) {
      const flags =
        window.textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
      const dataMessage = await window.textsecure.messaging.getMessageProto(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.getSendTarget()!,
        undefined, // body
        [], // attachments
        undefined, // quote
        [], // preview
        undefined, // sticker
        undefined, // reaction
        undefined, // deletedForEveryoneTimestamp
        message.get('sent_at'),
        expireTimer,
        profileKey,
        flags
      );
      return message.sendSyncMessageOnly(dataMessage);
    }

    if (this.get('type') === 'private') {
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

    await message.send(this.wrapSend(promise));

    return message;
  }

  async addMessageHistoryDisclaimer(): Promise<MessageModel> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const lastMessage = this.messageCollection!.last();
    if (lastMessage && lastMessage.get('type') === 'message-history-unsynced') {
      // We do not need another message history disclaimer
      return lastMessage;
    }

    const timestamp = Date.now();

    const model = new window.Whisper.Message(({
      type: 'message-history-unsynced',
      // Even though this isn't reflected to the user, we want to place the last seen
      //   indicator above it. We set it to 'unread' to trigger that placement.
      unread: 1,
      conversationId: this.id,
      // No type; 'incoming' messages are specially treated by conversation.markRead()
      sent_at: timestamp,
      received_at: timestamp,
      // TODO: DESKTOP-722
    } as unknown) as MessageAttributesType);

    if (this.isPrivate()) {
      model.set({ destination: this.id });
    }
    if (model.isOutgoing()) {
      model.set({ recipients: this.getRecipients() });
    }
    const id = await window.Signal.Data.saveMessage(model.attributes, {
      Message: window.Whisper.Message,
    });

    model.set({ id });

    const message = window.MessageController.register(id, model);
    this.addSingleMessage(message);

    return message;
  }

  isSearchable(): boolean {
    return !this.get('left');
  }

  async endSession(): Promise<void> {
    if (this.isPrivate()) {
      const now = Date.now();
      const model = new window.Whisper.Message(({
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
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

      const options = this.getSendOptions();
      message.send(
        this.wrapSend(
          // TODO: DESKTOP-724
          // resetSession returns `Array<void>` which is incompatible with the
          // expected promise return values. `[]` is truthy and wrapSend assumes
          // it's a valid callback result type
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          window.textsecure.messaging.resetSession(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.get('uuid')!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.get('e164')!,
            now,
            options
          )
        )
      );
    }
  }

  async leaveGroup(): Promise<void> {
    const now = Date.now();
    if (this.get('type') === 'group') {
      const groupIdentifiers = this.getRecipients();
      this.set({ left: true });
      window.Signal.Data.updateConversation(this.attributes);

      const model = new Whisper.Message(({
        group_update: { left: 'You' },
        conversationId: this.id,
        type: 'outgoing',
        sent_at: now,
        received_at: now,
        // TODO: DESKTOP-722
      } as unknown) as MessageAttributesType);

      const id = await window.Signal.Data.saveMessage(model.attributes, {
        Message: Whisper.Message,
      });
      model.set({ id });

      const message = window.MessageController.register(model.id, model);
      this.addSingleMessage(message);

      const options = this.getSendOptions();
      message.send(
        this.wrapSend(
          window.textsecure.messaging.leaveGroup(
            this.id,
            groupIdentifiers,
            options
          )
        )
      );
    }
  }

  async markRead(
    newestUnreadDate: number,
    providedOptions: { readAt?: number; sendReadReceipts: boolean }
  ): Promise<WhatIsThis> {
    const options = providedOptions || {};
    window._.defaults(options, { sendReadReceipts: true });

    const conversationId = this.id;
    window.Whisper.Notifications.removeBy({ conversationId });

    let unreadMessages:
      | MessageModelCollectionType
      | Array<MessageModel> = await this.getUnread();
    const oldUnread = unreadMessages.filter(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      message => message.get('received_at')! <= newestUnreadDate
    );

    let read = await Promise.all(
      window._.map(oldUnread, async providedM => {
        const m = window.MessageController.register(providedM.id, providedM);

        // Note that this will update the message in the database
        await m.markRead(options.readAt);

        return {
          senderE164: m.get('source'),
          senderUuid: m.get('sourceUuid'),
          senderId: window.ConversationController.ensureContactIds({
            e164: m.get('source'),
            uuid: m.get('sourceUuid'),
          }),
          timestamp: m.get('sent_at'),
          hasErrors: m.hasErrors(),
        };
      })
    );

    // Some messages we're marking read are local notifications with no sender
    read = window._.filter(read, m => Boolean(m.senderId));
    unreadMessages = unreadMessages.filter(m => Boolean(m.isIncoming()));

    const unreadCount = unreadMessages.length - read.length;
    this.set({ unreadCount });
    window.Signal.Data.updateConversation(this.attributes);

    // If a message has errors, we don't want to send anything out about it.
    //   read syncs - let's wait for a client that really understands the message
    //      to mark it read. we'll mark our local error read locally, though.
    //   read receipts - here we can run into infinite loops, where each time the
    //      conversation is viewed, another error message shows up for the contact
    read = read.filter(item => !item.hasErrors);

    if (read.length && options.sendReadReceipts) {
      window.log.info(`Sending ${read.length} read syncs`);
      // Because syncReadMessages sends to our other devices, and sendReadReceipts goes
      //   to a contact, we need accessKeys for both.
      const {
        sendOptions,
      } = window.ConversationController.prepareForSend(
        window.ConversationController.getOurConversationId(),
        { syncMessage: true }
      );
      await this.wrapSend(
        window.textsecure.messaging.syncReadMessages(read, sendOptions)
      );
      await this.sendReadReceiptsFor(read);
    }
  }

  async sendReadReceiptsFor(items: Array<unknown>): Promise<void> {
    // Only send read receipts for accepted conversations
    if (window.storage.get('read-receipt-setting') && this.getAccepted()) {
      window.log.info(`Sending ${items.length} read receipts`);
      const convoSendOptions = this.getSendOptions();
      const receiptsBySender = window._.groupBy(items, 'senderId');

      await Promise.all(
        window._.map(receiptsBySender, async (receipts, senderId) => {
          const timestamps = window._.map(receipts, 'timestamp');
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const c = window.ConversationController.get(senderId)!;
          await this.wrapSend(
            window.textsecure.messaging.sendReadReceipts(
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              c.get('e164')!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              c.get('uuid')!,
              timestamps,
              convoSendOptions
            )
          );
        })
      );
    }
  }

  // This is an expensive operation we use to populate the message request hero row. It
  //   shows groups the current user has in common with this potential new contact.
  async updateSharedGroups(): Promise<void> {
    if (!this.isPrivate()) {
      return;
    }
    if (this.isMe()) {
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
    if (this.isPrivate()) {
      this.getProfiles();
    }
  }

  getProfiles(): Promise<Array<void>> {
    // request all conversation members' keys
    const conversations = (this.getMembers() as unknown) as Array<
      ConversationModel
    >;
    return Promise.all(
      window._.map(conversations, conversation => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.getProfile(conversation.get('uuid')!, conversation.get('e164')!);
      })
    );
  }

  async getProfile(providedUuid: string, providedE164: string): Promise<void> {
    if (!window.textsecure.messaging) {
      throw new Error(
        'Conversation.getProfile: window.textsecure.messaging not available'
      );
    }

    const id = window.ConversationController.ensureContactIds({
      uuid: providedUuid,
      e164: providedE164,
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const c = window.ConversationController.get(id)!;
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

      let profileKeyCredentialRequestHex;
      let profileCredentialRequestContext;

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

      const sendMetadata = c.getSendMetadata({ disableMeCheck: true }) || {};
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
        const address = new window.libsignal.SignalProtocolAddress(
          identifier,
          1
        );
        window.log.info('closing session for', address.toString());
        const sessionCipher = new window.libsignal.SessionCipher(
          window.textsecure.storage.protocol,
          address
        );
        await sessionCipher.closeOpenSessionForDevice();
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

      if (profile.capabilities) {
        c.set({ capabilities: profile.capabilities });
      }
      if (profileCredentialRequestContext && profile.credential) {
        const profileKeyCredential = handleProfileKeyCredential(
          clientZkProfileCipher,
          profileCredentialRequestContext,
          profile.credential
        );
        c.set({ profileKeyCredential });
      }
    } catch (error) {
      if (error.code !== 403 && error.code !== 404) {
        window.log.warn(
          'getProfile failure:',
          c.idForLogging(),
          error && error.stack ? error.stack : error
        );
      } else {
        await c.dropProfileKey();
      }
      return;
    }

    try {
      await c.setEncryptedProfileName(profile.name);
    } catch (error) {
      window.log.warn(
        'getProfile decryption failure:',
        c.idForLogging(),
        error && error.stack ? error.stack : error
      );
      await c.dropProfileKey();
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

    if (!this.isMe() && hadPreviousName && nameChanged) {
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

    if (this.isMe()) {
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
        profileAvatar: undefined,
        profileKey,
        profileKeyVersion: undefined,
        profileKeyCredential: null,
        accessKey: null,
        sealedSender: SEALED_SENDER.UNKNOWN,
      });

      if (
        !viaStorageServiceSync &&
        profileKey !== this.get('storageProfileKey')
      ) {
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

    if (viaStorageServiceSync) {
      this.set({
        storageProfileKey: profileKey,
      });
    }
  }

  async dropProfileKey(): Promise<void> {
    if (this.get('profileKey')) {
      window.log.info(
        `Dropping profileKey, setting sealedSender to UNKNOWN for conversation ${this.idForLogging()}`
      );
      const profileAvatar = this.get('profileAvatar');
      if (profileAvatar && profileAvatar.path) {
        await deleteAttachmentData(profileAvatar.path);
      }

      this.set({
        profileKey: undefined,
        profileKeyVersion: undefined,
        profileKeyCredential: null,
        accessKey: null,
        profileName: undefined,
        profileFamilyName: undefined,
        profileAvatar: null,
        sealedSender: SEALED_SENDER.UNKNOWN,
      });

      window.Signal.Data.updateConversation(this.attributes);
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
    if (this.isPrivate()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.contactCollection!.reset([this]);
    }
    const members = this.getMembers();
    window._.forEach(members, member => {
      this.listenTo(member, 'change:verified', this.onMemberVerifiedChange);
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.contactCollection!.reset(members);
  }

  async destroyMessages(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.messageCollection!.reset([]);

    this.set({
      lastMessage: null,
      timestamp: null,
      active_at: null,
    });
    window.Signal.Data.updateConversation(this.attributes);

    await window.Signal.Data.removeAllMessagesInConversation(this.id, {
      MessageCollection: window.Whisper.MessageCollection,
    });
  }

  getTitle(): string {
    if (this.isPrivate()) {
      return (
        this.get('name') ||
        this.getProfileName() ||
        this.getNumber() ||
        window.i18n('unknownContact')
      );
    }
    return this.get('name') || window.i18n('unknownGroup');
  }

  getProfileName(): string | null {
    if (this.isPrivate()) {
      return Util.combineNames(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.get('profileName')!,
        this.get('profileFamilyName')
      );
    }
    return null;
  }

  getNumber(): string {
    if (!this.isPrivate()) {
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

  isPrivate(): boolean {
    return this.get('type') === 'private';
  }

  getColor(): ColorType {
    if (!this.isPrivate()) {
      return 'signal-blue';
    }

    const { migrateColor } = Util;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return migrateColor(this.get('color')!);
  }

  getAvatarPath(): string | null {
    const avatar = this.isMe()
      ? this.get('profileAvatar') || this.get('avatar')
      : this.get('avatar') || this.get('profileAvatar');

    if (avatar && avatar.path) {
      return getAbsoluteAttachmentPath(avatar.path);
    }

    return null;
  }

  canChangeTimer(): boolean {
    if (this.isPrivate()) {
      return true;
    }

    if (!this.isGroupV2()) {
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

    const memberEnum = window.textsecure.protobuf.Member.Role;
    const members = this.get('membersV2') || [];
    const myId = window.ConversationController.getOurConversationId();
    const me = members.find(item => item.conversationId === myId);
    if (!me) {
      return false;
    }

    const isAdministrator = me.role === memberEnum.ADMINISTRATOR;
    if (isAdministrator) {
      return true;
    }

    return false;
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
  captureChange(property: string): void {
    if (!window.Signal.RemoteConfig.isEnabled('desktop.storageWrite')) {
      window.log.info(
        'conversation.captureChange: Returning early; desktop.storageWrite is falsey'
      );

      return;
    }

    window.log.info(
      'storageService[captureChange]',
      property,
      this.idForLogging()
    );
    this.set({ needsStorageServiceSync: true });

    this.queueJob(() => {
      Services.storageServiceUploadJob();
    });
  }

  isMuted(): boolean {
    return (
      Boolean(this.get('muteExpiresAt')) &&
      Date.now() < this.get('muteExpiresAt')
    );
  }

  getMuteTimeoutId(): string {
    return `mute(${this.get('id')})`;
  }

  async notify(message: WhatIsThis, reaction?: WhatIsThis): Promise<void> {
    if (this.isMuted()) {
      return;
    }

    if (!message.isIncoming() && !reaction) {
      return;
    }

    const conversationId = this.id;

    const sender = reaction
      ? window.ConversationController.get(reaction.get('fromId'))
      : message.getContact();
    const senderName = sender
      ? sender.getTitle()
      : window.i18n('unknownContact');
    const senderTitle = this.isPrivate()
      ? senderName
      : window.i18n('notificationSenderInGroup', {
          sender: senderName,
          group: this.getTitle(),
        });

    let notificationIconUrl;
    const avatar = this.get('avatar') || this.get('profileAvatar');
    if (avatar && avatar.path) {
      notificationIconUrl = getAbsoluteAttachmentPath(avatar.path);
    } else if (this.isPrivate()) {
      notificationIconUrl = await new window.Whisper.IdenticonSVGView({
        color: this.getColor(),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        content: this.getInitials(this.get('name')!) || '#',
      }).getDataUrl();
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

  notifyTyping(
    options: {
      isTyping: boolean;
      senderId: string;
      isMe: boolean;
      senderDevice: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = ({} as unknown) as any
  ): void {
    const { isTyping, senderId, isMe, senderDevice } = options;

    // We don't do anything with typing messages from our other devices
    if (isMe) {
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
    window.log.info('pinning', this.idForLogging());
    const pinnedConversationIds = new Set(
      window.storage.get<Array<string>>('pinnedConversationIds', [])
    );

    pinnedConversationIds.add(this.id);

    this.writePinnedConversations([...pinnedConversationIds]);

    this.set('isPinned', true);
    window.Signal.Data.updateConversation(this.attributes);

    if (this.get('isArchived')) {
      this.setArchived(false);
    }
  }

  unpin(): void {
    window.log.info('un-pinning', this.idForLogging());

    const pinnedConversationIds = new Set(
      window.storage.get<Array<string>>('pinnedConversationIds', [])
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
            delete this._byGroupid[oldValue];
          }
        }
        if (model.get('e164')) {
          this._byE164[model.get('e164')] = model;
        }
        if (model.get('uuid')) {
          this._byUuid[model.get('uuid')] = model;
        }
        if (model.get('groupId')) {
          this._byGroupid[model.get('groupId')] = model;
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

  generateLookups(models: Array<WhatIsThis>) {
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

  add(...models: Array<WhatIsThis>) {
    const result = window.Backbone.Collection.prototype.add.apply(
      this,
      models as WhatIsThis
    );

    this.generateLookups(Array.isArray(result) ? result.slice(0) : [result]);

    return result;
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

window.Whisper.Conversation.COLORS = COLORS.concat(['grey', 'default']).join(
  ' '
);

// This is a wrapper model used to display group members in the member list view, within
//   the world of backbone, but layering another bit of group-specific data top of base
//   conversation data.
window.Whisper.GroupMemberConversation = window.Backbone.Model.extend({
  initialize(attributes: { conversation: boolean; isAdmin: boolean }) {
    const { conversation, isAdmin } = attributes;

    if (!conversation) {
      throw new Error(
        'GroupMemberConversation.initialze: conversation required!'
      );
    }
    if (!window._.isBoolean(isAdmin)) {
      throw new Error('GroupMemberConversation.initialze: isAdmin required!');
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
    return this.conversation.isMe();
  },
});

// We need a custom collection here to get the sorting we need
window.Whisper.GroupConversationCollection = window.Backbone.Collection.extend({
  model: window.Whisper.GroupMemberConversation,

  initialize() {
    this.collator = new Intl.Collator();
  },

  comparator(left: WhatIsThis, right: WhatIsThis) {
    if (left.isAdmin && !right.isAdmin) {
      return -1;
    }
    if (!left.isAdmin && right.isAdmin) {
      return 1;
    }

    const leftLower = left.getTitle().toLowerCase();
    const rightLower = right.getTitle().toLowerCase();
    return this.collator.compare(leftLower, rightLower);
  },
});
