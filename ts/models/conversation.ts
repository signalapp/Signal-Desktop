import Backbone from 'backbone';
import _ from 'lodash';
import { getMessageQueue } from '../session';
import { ConversationController } from '../session/conversations';
import { ClosedGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../session/types';
import { ToastUtils, UserUtils } from '../session/utils';
import { BlockedNumberController } from '../util';
import { MessageController } from '../session/messages';
import { leaveClosedGroup } from '../session/group';
import { SignalService } from '../protobuf';
import { MessageModel } from './message';
import { MessageAttributesOptionals, MessageModelType } from './messageType';
import autoBind from 'auto-bind';
import {
  getMessagesByConversation,
  getUnreadByConversation,
  getUnreadCountByConversation,
  removeAllMessagesInConversation,
  removeMessage as dataRemoveMessage,
  saveMessages,
  updateConversation,
} from '../../ts/data/data';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';
import {
  actions as conversationActions,
  ConversationType as ReduxConversationType,
  LastMessageStatusType,
} from '../state/ducks/conversations';
import { OpenGroupMessage } from '../session/messages/outgoing';
import { ExpirationTimerUpdateMessage } from '../session/messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { TypingMessage } from '../session/messages/outgoing/controlMessage/TypingMessage';
import {
  VisibleMessage,
  VisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { GroupInvitationMessage } from '../session/messages/outgoing/visibleMessage/GroupInvitationMessage';
import { ReadReceiptMessage } from '../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage';
import { OpenGroup } from '../opengroup/opengroupV1/OpenGroup';
import { OpenGroupUtils } from '../opengroup/utils';
import { ConversationInteraction } from '../interactions';
import { getV2OpenGroupRoom } from '../data/opengroups';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { OpenGroupRequestCommonType } from '../opengroup/opengroupV2/ApiUtil';
import { getOpenGroupV2FromConversationId } from '../opengroup/utils/OpenGroupUtils';
import { ApiV2 } from '../opengroup/opengroupV2';

export enum ConversationType {
  GROUP = 'group',
  PRIVATE = 'private',
}

export interface ConversationAttributes {
  profileName?: string;
  id: string;
  name?: string;
  members: Array<string>;
  left: boolean;
  expireTimer: number;
  mentionedUs: boolean;
  unreadCount: number;
  lastMessageStatus: LastMessageStatusType;
  lastMessage: string | null;

  active_at: number;
  lastJoinedTimestamp: number; // ClosedGroup: last time we were added to this group
  groupAdmins?: Array<string>;
  moderators?: Array<string>; // TODO to merge to groupAdmins with a migration on the db
  isKickedFromGroup?: boolean;
  avatarPath?: string;
  isMe?: boolean;
  subscriberCount?: number;
  sessionRestoreSeen?: boolean;
  is_medium_group?: boolean;
  type: string;
  avatarPointer?: any;
  avatar?: any;
  server?: any;
  channelId?: any;
  nickname?: string;
  profile?: any;
  lastPublicMessage?: any;
  profileAvatar?: any;
  profileKey?: string;
  accessKey?: any;
}

export interface ConversationAttributesOptionals {
  profileName?: string;
  id: string;
  name?: string;
  members?: Array<string>;
  left?: boolean;
  expireTimer?: number;
  mentionedUs?: boolean;
  unreadCount?: number;
  lastMessageStatus?: LastMessageStatusType;
  lastMessage: string | null;
  active_at?: number;
  timestamp?: number; // timestamp of what?
  lastJoinedTimestamp?: number;
  groupAdmins?: Array<string>;
  moderators?: Array<string>;
  isKickedFromGroup?: boolean;
  avatarPath?: string;
  isMe?: boolean;
  subscriberCount?: number;
  sessionRestoreSeen?: boolean;
  is_medium_group?: boolean;
  type: string;
  avatarPointer?: any;
  avatar?: any;
  server?: any;
  channelId?: any;
  nickname?: string;
  profile?: any;
  lastPublicMessage?: any;
  profileAvatar?: any;
  profileKey?: string;
  accessKey?: any;
}

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 */
export const fillConvoAttributesWithDefaults = (
  optAttributes: ConversationAttributesOptionals
): ConversationAttributes => {
  return _.defaults(optAttributes, {
    members: [],
    left: false,
    unreadCount: 0,
    lastMessageStatus: null,
    lastJoinedTimestamp: new Date('1970-01-01Z00:00:00:000').getTime(),
    groupAdmins: [],
    moderators: [],
    isKickedFromGroup: false,
    isMe: false,
    subscriberCount: 0,
    sessionRestoreSeen: false,
    is_medium_group: false,
    lastMessage: null,
    expireTimer: 0,
    mentionedUs: false,
    active_at: 0,
  });
};

export class ConversationModel extends Backbone.Model<ConversationAttributes> {
  public updateLastMessage: () => any;
  public throttledBumpTyping: any;
  public throttledNotify: any;
  public markRead: any;
  public initialPromise: any;

  private typingRefreshTimer?: NodeJS.Timeout | null;
  private typingPauseTimer?: NodeJS.Timeout | null;
  private typingTimer?: NodeJS.Timeout | null;

  private pending: any;

  constructor(attributes: ConversationAttributesOptionals) {
    super(fillConvoAttributesWithDefaults(attributes));

    // This may be overridden by ConversationController.getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();
    autoBind(this);

    this.throttledBumpTyping = _.throttle(this.bumpTyping, 300);
    this.updateLastMessage = _.throttle(this.bouncyUpdateLastMessage.bind(this), 1000);
    this.throttledNotify = _.debounce(this.notify, 500, { maxWait: 1000 });
    //start right away the function is called, and wait 1sec before calling it again
    this.markRead = _.debounce(this.markReadBouncy, 1000, { leading: true });
    // Listening for out-of-band data updates
    this.on('ourAvatarChanged', avatar => this.updateAvatarOnPublicChat(avatar));

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;

    window.inboxStore?.dispatch(conversationActions.conversationChanged(this.id, this.getProps()));
  }

  public idForLogging() {
    if (this.isPrivate()) {
      return this.id;
    }

    return `group(${this.id})`;
  }

  public isMe() {
    return UserUtils.isUsFromCache(this.id);
  }
  public isPublic(): boolean {
    return Boolean(this.id && this.id.match(OpenGroupUtils.openGroupPrefixRegex));
  }
  public isOpenGroupV2(): boolean {
    return OpenGroupUtils.isOpenGroupV2(this.id);
  }
  public isOpenGroupV1(): boolean {
    return OpenGroupUtils.isOpenGroupV1(this.id);
  }
  public isClosedGroup() {
    return this.get('type') === ConversationType.GROUP && !this.isPublic();
  }

  public isBlocked() {
    if (!this.id || this.isMe()) {
      return false;
    }

    if (this.isClosedGroup()) {
      return BlockedNumberController.isGroupBlocked(this.id);
    }

    if (this.isPrivate()) {
      return BlockedNumberController.isBlocked(this.id);
    }

    return false;
  }

  public isMediumGroup() {
    return this.get('is_medium_group');
  }
  /**
   * Returns true if this conversation is active
   * i.e. the conversation is visibie on the left pane. (Either we or another user created this convo).
   * This is useful because we do not want bumpTyping on the first message typing to a new convo to
   *  send a message.
   */
  public isActive() {
    return Boolean(this.get('active_at'));
  }
  public async block() {
    if (!this.id || this.isPublic()) {
      return;
    }

    const promise = this.isPrivate()
      ? BlockedNumberController.block(this.id)
      : BlockedNumberController.blockGroup(this.id);
    await promise;
    await this.commit();
  }

  public async unblock() {
    if (!this.id || this.isPublic()) {
      return;
    }
    const promise = this.isPrivate()
      ? BlockedNumberController.unblock(this.id)
      : BlockedNumberController.unblockGroup(this.id);
    await promise;
    await this.commit();
  }
  public async bumpTyping() {
    // We don't send typing messages if the setting is disabled
    // or we blocked that user
    if (
      this.isPublic() ||
      this.isMediumGroup() ||
      !this.isActive() ||
      !window.storage.get('typing-indicators-setting') ||
      this.isBlocked()
    ) {
      return;
    }

    if (!this.typingRefreshTimer) {
      const isTyping = true;
      this.setTypingRefreshTimer();
      this.sendTypingMessage(isTyping);
    }

    this.setTypingPauseTimer();
  }

  public setTypingRefreshTimer() {
    if (this.typingRefreshTimer) {
      clearTimeout(this.typingRefreshTimer);
    }
    this.typingRefreshTimer = global.setTimeout(this.onTypingRefreshTimeout.bind(this), 10 * 1000);
  }

  public onTypingRefreshTimeout() {
    const isTyping = true;
    this.sendTypingMessage(isTyping);

    // This timer will continue to reset itself until the pause timer stops it
    this.setTypingRefreshTimer();
  }

  public setTypingPauseTimer() {
    if (this.typingPauseTimer) {
      clearTimeout(this.typingPauseTimer);
    }
    this.typingPauseTimer = global.setTimeout(this.onTypingPauseTimeout.bind(this), 10 * 1000);
  }

  public onTypingPauseTimeout() {
    const isTyping = false;
    this.sendTypingMessage(isTyping);

    this.clearTypingTimers();
  }

  public clearTypingTimers() {
    if (this.typingPauseTimer) {
      clearTimeout(this.typingPauseTimer);
      this.typingPauseTimer = null;
    }
    if (this.typingRefreshTimer) {
      clearTimeout(this.typingRefreshTimer);
      this.typingRefreshTimer = null;
    }
  }

  public sendTypingMessage(isTyping: boolean) {
    if (!this.isPrivate()) {
      return;
    }

    const recipientId = this.id;

    if (!recipientId) {
      throw new Error('Need to provide either recipientId');
    }

    const primaryDevicePubkey = window.storage.get('primaryDevicePubKey');
    if (recipientId && primaryDevicePubkey === recipientId) {
      // note to self
      return;
    }

    const typingParams = {
      timestamp: Date.now(),
      isTyping,
      typingTimestamp: Date.now(),
    };
    const typingMessage = new TypingMessage(typingParams);

    // send the message to a single recipient if this is a session chat
    const device = new PubKey(recipientId);
    getMessageQueue()
      .sendToPubKey(device, typingMessage)
      .catch(window.log.error);
  }

  public async cleanup() {
    const { deleteAttachmentData } = window.Signal.Migrations;
    await window.Signal.Types.Conversation.deleteExternalFiles(this.attributes, {
      deleteAttachmentData,
    });
    window.profileImages.removeImage(this.id);
  }

  public async updateProfileAvatar() {
    if (this.isPublic()) {
      return;
    }

    // Remove old identicons
    if (window.profileImages.hasImage(this.id)) {
      window.profileImages.removeImage(this.id);
      await this.setProfileAvatar(null);
    }
  }

  public async onExpired(message: MessageModel) {
    await this.updateLastMessage();

    // removeMessage();
  }

  public getGroupAdmins() {
    const groupAdmins = this.get('groupAdmins');
    if (groupAdmins?.length) {
      return groupAdmins;
    }
    return this.get('moderators');
  }
  public getProps(): ReduxConversationType {
    const groupAdmins = this.getGroupAdmins();

    const members = this.isGroup() && !this.isPublic() ? this.get('members') : undefined;
    // isSelected is overriden by redux
    return {
      isSelected: false,
      id: this.id as string,
      activeAt: this.get('active_at'),
      avatarPath: this.getAvatarPath() || undefined,
      type: this.isPrivate() ? 'direct' : 'group',
      isMe: this.isMe(),
      isPublic: this.isPublic(),
      isTyping: !!this.typingTimer,
      name: this.getName(),
      profileName: this.getProfileName(),
      // title: this.getTitle(),
      unreadCount: this.get('unreadCount') || 0,
      mentionedUs: this.get('mentionedUs') || false,
      isBlocked: this.isBlocked(),
      phoneNumber: this.id,
      lastMessage: {
        status: this.get('lastMessageStatus'),
        text: this.get('lastMessage'),
      },
      hasNickname: !!this.getNickname(),
      isKickedFromGroup: !!this.get('isKickedFromGroup'),
      left: !!this.get('left'),
      groupAdmins,
      members,
      onClick: () => this.trigger('select', this),
      onBlockContact: this.block,
      onUnblockContact: this.unblock,
      onCopyPublicKey: this.copyPublicKey,
      onDeleteContact: this.deleteContact,
      onLeaveGroup: () => {
        window.Whisper.events.trigger('leaveGroup', this);
      },
      onDeleteMessages: this.deleteMessages,
      onInviteContacts: () => {
        window.Whisper.events.trigger('inviteContacts', this);
      },
      onMarkAllRead: () => {
        void this.markReadBouncy(Date.now());
      },
      onClearNickname: () => {
        void this.setLokiProfile({ displayName: null });
      },
    };
  }

  public async updateGroupAdmins(groupAdmins: Array<string>) {
    const existingAdmins = _.sortBy(this.getGroupAdmins());
    const newAdmins = _.sortBy(groupAdmins);

    if (_.isEqual(existingAdmins, newAdmins)) {
      // window.log.info(
      //   'Skipping updates of groupAdmins/moderators. No change detected.'
      // );
      return;
    }
    this.set({ groupAdmins });
    await this.commit();
  }

  public async onReadMessage(message: MessageModel, readAt: number) {
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
      this.markReadBouncy(message.get('received_at') as any, {
        sendReadReceipts: false,
        readAt,
      })
    );
  }

  public async getUnread() {
    return getUnreadByConversation(this.id);
  }

  public async getUnreadCount() {
    const unreadCount = await getUnreadCountByConversation(this.id);

    return unreadCount;
  }

  public queueJob(callback: any) {
    // tslint:disable-next-line: no-promise-as-boolean
    const previous = this.pending || Promise.resolve();

    const taskWithTimeout = window.textsecure.createTaskWithTimeout(
      callback,
      `conversation ${this.idForLogging()}`
    );

    this.pending = previous.then(taskWithTimeout, taskWithTimeout);
    const current = this.pending;

    current.then(() => {
      if (this.pending === current) {
        delete this.pending;
      }
    });

    return current;
  }
  public getRecipients() {
    if (this.isPrivate()) {
      return [this.id];
    }
    const me = UserUtils.getOurPubKeyStrFromCache();
    return _.without(this.get('members'), me);
  }

  public async getQuoteAttachment(attachments: any, preview: any) {
    const { loadAttachmentData, getAbsoluteAttachmentPath } = window.Signal.Migrations;

    if (attachments && attachments.length) {
      return Promise.all(
        attachments
          .filter(
            (attachment: any) =>
              attachment && attachment.contentType && !attachment.pending && !attachment.error
          )
          .slice(0, 1)
          .map(async (attachment: any) => {
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
          .filter((item: any) => item && item.image)
          .slice(0, 1)
          .map(async (attachment: any) => {
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

    return [];
  }

  public async makeQuote(quotedMessage: MessageModel) {
    const attachments = quotedMessage.get('attachments');
    const preview = quotedMessage.get('preview');

    const body = quotedMessage.get('body');
    const quotedAttachments = await this.getQuoteAttachment(attachments, preview);
    return {
      author: quotedMessage.getSource(),
      id: quotedMessage.get('sent_at'),
      text: body,
      attachments: quotedAttachments,
    };
  }

  public toOpenGroupV2(): OpenGroupRequestCommonType {
    if (!this.isOpenGroupV2()) {
      throw new Error('tried to run toOpenGroup for not public group v2');
    }
    return getOpenGroupV2FromConversationId(this.id);
  }

  public toOpenGroupV1(): OpenGroup {
    if (!this.isOpenGroupV1()) {
      throw new Error('tried to run toOpenGroup for not public group v1');
    }

    return new OpenGroup({
      server: this.get('server'),
      channel: this.get('channelId'),
      conversationId: this.id,
    });
  }
  public async sendMessageJob(message: MessageModel, expireTimer: number | undefined) {
    try {
      const uploads = await message.uploadData();
      const { id } = message;
      const destination = this.id;

      const sentAt = message.get('sent_at');

      if (!sentAt) {
        throw new Error('sendMessageJob() sent_at must be set.');
      }

      if (this.isPublic() && !this.isOpenGroupV2()) {
        const openGroup = this.toOpenGroupV1();

        const openGroupParams = {
          body: uploads.body,
          timestamp: sentAt,
          group: openGroup,
          attachments: uploads.attachments,
          preview: uploads.preview,
          quote: uploads.quote,
          identifier: id,
        };
        const openGroupMessage = new OpenGroupMessage(openGroupParams);
        // we need the return await so that errors are caught in the catch {}
        await getMessageQueue().sendToOpenGroup(openGroupMessage);

        return;
      }
      // an OpenGroupV2 message is just a visible message
      const chatMessageParams: VisibleMessageParams = {
        body: uploads.body,
        identifier: id,
        timestamp: sentAt,
        attachments: uploads.attachments,
        expireTimer,
        preview: uploads.preview,
        quote: uploads.quote,
        lokiProfile: UserUtils.getOurProfile(),
      };

      if (this.isOpenGroupV2()) {
        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }

        // we need the return await so that errors are caught in the catch {}
        await getMessageQueue().sendToOpenGroupV2(chatMessageOpenGroupV2, roomInfos);
        return;
      }

      const destinationPubkey = new PubKey(destination);
      if (this.isPrivate()) {
        if (this.isMe()) {
          chatMessageParams.syncTarget = this.id;
          const chatMessageMe = new VisibleMessage(chatMessageParams);

          await getMessageQueue().sendSyncMessage(chatMessageMe);
          return;
        }
        // Handle Group Invitation Message
        if (message.get('groupInvitation')) {
          const groupInvitation = message.get('groupInvitation');
          const groupInvitMessage = new GroupInvitationMessage({
            identifier: id,
            timestamp: sentAt,
            serverName: groupInvitation.name,
            channelId: groupInvitation.channelId,
            serverAddress: groupInvitation.address,
            expireTimer: this.get('expireTimer'),
          });
          // we need the return await so that errors are caught in the catch {}
          await getMessageQueue().sendToPubKey(destinationPubkey, groupInvitMessage);
          return;
        }
        const chatMessagePrivate = new VisibleMessage(chatMessageParams);

        await getMessageQueue().sendToPubKey(destinationPubkey, chatMessagePrivate);
        return;
      }

      if (this.isMediumGroup()) {
        const chatMessageMediumGroup = new VisibleMessage(chatMessageParams);
        const closedGroupVisibleMessage = new ClosedGroupVisibleMessage({
          chatMessage: chatMessageMediumGroup,
          groupId: destination,
        });

        // we need the return await so that errors are caught in the catch {}
        await getMessageQueue().sendToGroup(closedGroupVisibleMessage);
        return;
      }

      if (this.isClosedGroup()) {
        throw new Error('Legacy group are not supported anymore. You need to recreate this group.');
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e) {
      await message.saveErrors(e);
      return null;
    }
  }
  public async sendMessage(
    body: string,
    attachments: any,
    quote: any,
    preview: any,
    groupInvitation = null
  ) {
    this.clearTypingTimers();

    const destination = this.id;
    const isPrivate = this.isPrivate();
    const expireTimer = this.get('expireTimer');
    const recipients = this.getRecipients();

    const now = Date.now();

    window.log.info('Sending message to conversation', this.idForLogging(), 'with timestamp', now);
    // be sure an empty quote is marked as undefined rather than being empty
    // otherwise upgradeMessageSchema() will return an object with an empty array
    // and this.get('quote') will be true, even if there is no quote.
    const editedQuote = _.isEmpty(quote) ? undefined : quote;
    const { upgradeMessageSchema } = window.Signal.Migrations;

    const messageWithSchema = await upgradeMessageSchema({
      type: 'outgoing',
      body,
      conversationId: destination,
      quote: editedQuote,
      preview,
      attachments,
      sent_at: now,
      received_at: now,
      expireTimer,
      recipients,
    });

    if (!this.isPublic()) {
      messageWithSchema.destination = destination;
    }
    messageWithSchema.source = UserUtils.getOurPubKeyStrFromCache();
    messageWithSchema.sourceDevice = 1;

    // set the serverTimestamp only if this conversation is a public one.
    const attributes: MessageAttributesOptionals = {
      ...messageWithSchema,
      groupInvitation,
      conversationId: this.id,
      destination: isPrivate ? destination : undefined,
      serverTimestamp: this.isPublic() ? new Date().getTime() : undefined,
    };

    const messageModel = await this.addSingleMessage(attributes);

    this.set({
      lastMessage: messageModel.getNotificationText(),
      lastMessageStatus: 'sending',
      active_at: now,
    });
    await this.commit();

    // We're offline!
    if (!window.textsecure.messaging) {
      const error = new Error('Network is not available');
      error.name = 'SendMessageNetworkError';
      (error as any).number = this.id;
      await messageModel.saveErrors([error]);
      return null;
    }
    this.queueJob(async () => {
      await this.sendMessageJob(messageModel, expireTimer);
    });
    return null;
  }

  public async updateAvatarOnPublicChat({ url, profileKey }: any) {
    if (!this.isPublic()) {
      return;
    }
    // Always share avatars on PublicChat

    if (profileKey && typeof profileKey !== 'string') {
      // eslint-disable-next-line no-param-reassign
      // tslint:disable-next-line: no-parameter-reassignment
      profileKey = fromArrayBufferToBase64(profileKey);
    }
    const serverAPI = await window.lokiPublicChatAPI.findOrCreateServer(this.get('server'));
    if (!serverAPI) {
      return;
    }
    await serverAPI.setAvatar(url, profileKey);
  }
  public async bouncyUpdateLastMessage() {
    if (!this.id) {
      return;
    }
    if (!this.get('active_at')) {
      window.log.info('Skipping update last message as active_at is falsy');
      return;
    }
    const messages = await getMessagesByConversation(this.id, {
      limit: 1,
    });
    const lastMessageModel = messages.at(0);
    const lastMessageJSON = lastMessageModel ? lastMessageModel.toJSON() : null;
    const lastMessageStatusModel = lastMessageModel
      ? lastMessageModel.getMessagePropStatus()
      : null;
    const lastMessageUpdate = window.Signal.Types.Conversation.createLastMessageUpdate({
      currentTimestamp: this.get('active_at') || null,
      lastMessage: lastMessageJSON,
      lastMessageStatus: lastMessageStatusModel,
      lastMessageNotificationText: lastMessageModel ? lastMessageModel.getNotificationText() : null,
    });
    // Because we're no longer using Backbone-integrated saves, we need to manually
    //   clear the changed fields here so our hasChanged() check below is useful.
    (this as any).changed = {};
    this.set(lastMessageUpdate);
    if (this.hasChanged()) {
      await this.commit();
    }
  }

  public async updateExpirationTimer(
    providedExpireTimer: any,
    providedSource?: string,
    receivedAt?: number, // is set if it comes from outside
    options: {
      fromSync?: boolean;
    } = {}
  ) {
    let expireTimer = providedExpireTimer;
    let source = providedSource;

    _.defaults(options, { fromSync: false });

    if (!expireTimer) {
      expireTimer = null;
    }
    if (this.get('expireTimer') === expireTimer || (!expireTimer && !this.get('expireTimer'))) {
      return null;
    }

    window.log.info("Update conversation 'expireTimer'", {
      id: this.idForLogging(),
      expireTimer,
      source,
    });

    const isOutgoing = Boolean(receivedAt);

    source = source || UserUtils.getOurPubKeyStrFromCache();

    // When we add a disappearing messages notification to the conversation, we want it
    //   to be above the message that initiated that change, hence the subtraction.
    const timestamp = (receivedAt || Date.now()) - 1;

    this.set({ expireTimer });

    const messageAttributes = {
      // Even though this isn't reflected to the user, we want to place the last seen
      //   indicator above it. We set it to 'unread' to trigger that placement.
      unread: 1,
      conversationId: this.id,
      // No type; 'incoming' messages are specially treated by conversation.markRead()
      sent_at: timestamp,
      received_at: timestamp,
      flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expireTimer,
        source,
        fromSync: options.fromSync,
      },
      expireTimer: 0,
      type: isOutgoing ? 'outgoing' : ('incoming' as MessageModelType),
      destination: this.id,
      recipients: isOutgoing ? this.getRecipients() : undefined,
    };
    const message = await this.addSingleMessage(messageAttributes);

    // tell the UI this conversation was updated
    await this.commit();

    // if change was made remotely, don't send it to the number/group
    if (receivedAt) {
      return message;
    }

    const expireUpdate = {
      identifier: message.id,
      timestamp,
      expireTimer,
    };

    if (!expireUpdate.expireTimer) {
      delete expireUpdate.expireTimer;
    }

    if (this.isMe()) {
      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);
      return message.sendSyncMessageOnly(expirationTimerMessage);
    }

    if (this.isPrivate()) {
      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);
      const pubkey = new PubKey(this.get('id'));
      await getMessageQueue().sendToPubKey(pubkey, expirationTimerMessage);
    } else {
      window.log.warn('TODO: Expiration update for closed groups are to be updated');
      const expireUpdateForGroup = {
        ...expireUpdate,
        groupId: this.get('id'),
      };

      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdateForGroup);

      await getMessageQueue().sendToGroup(expirationTimerMessage);
    }
    return message;
  }

  public async commit() {
    // write to DB
    await updateConversation(this.attributes);
    window.inboxStore?.dispatch(
      conversationActions.conversationChanged(this.id, {
        ...this.getProps(),
        isSelected: false,
      })
    );
  }

  public async addSingleMessage(messageAttributes: MessageAttributesOptionals, setToExpire = true) {
    const model = new MessageModel(messageAttributes);

    const messageId = await model.commit();
    model.set({ id: messageId });

    if (setToExpire) {
      await model.setToExpire();
    }
    MessageController.getInstance().register(messageId, model);
    window.inboxStore?.dispatch(
      conversationActions.messageAdded({
        conversationKey: this.id,
        messageModel: model,
      })
    );

    return model;
  }

  public async leaveGroup() {
    if (this.isMediumGroup()) {
      await leaveClosedGroup(this.id);
    } else {
      window.log.error('Cannot leave a non-medium group conversation');
      throw new Error(
        'Legacy group are not supported anymore. You need to create this group again.'
      );
    }
  }

  public async markReadBouncy(newestUnreadDate: number, providedOptions: any = {}) {
    const options = providedOptions || {};
    _.defaults(options, { sendReadReceipts: true });

    const conversationId = this.id;
    window.Whisper.Notifications.remove(
      window.Whisper.Notifications.where({
        conversationId,
      })
    );
    let allUnreadMessagesInConvo = (await this.getUnread()).models;

    const oldUnreadNowRead = allUnreadMessagesInConvo.filter(
      (message: any) => message.get('received_at') <= newestUnreadDate
    );

    let read = [];

    // Build the list of updated message models so we can mark them all as read on a single sqlite call
    for (const nowRead of oldUnreadNowRead) {
      nowRead.markReadNoCommit(options.readAt);

      const errors = nowRead.get('errors');
      read.push({
        sender: nowRead.get('source'),
        timestamp: nowRead.get('sent_at'),
        hasErrors: Boolean(errors && errors.length),
      });
    }

    const oldUnreadNowReadAttrs = oldUnreadNowRead.map(m => m.attributes);

    await saveMessages(oldUnreadNowReadAttrs);

    for (const nowRead of oldUnreadNowRead) {
      nowRead.generateProps(false);
    }
    window.inboxStore?.dispatch(conversationActions.messagesChanged(oldUnreadNowRead));

    // Some messages we're marking read are local notifications with no sender
    read = _.filter(read, m => Boolean(m.sender));
    const realUnreadCount = await this.getUnreadCount();
    if (read.length === 0) {
      const cachedUnreadCountOnConvo = this.get('unreadCount');
      if (cachedUnreadCountOnConvo !== read.length) {
        // reset the unreadCount on the convo to the real one coming from markRead messages on the db
        this.set({ unreadCount: 0 });
        await this.commit();
      } else {
        // window.log.info('markRead(): nothing newly read.');
      }
      return;
    }

    allUnreadMessagesInConvo = allUnreadMessagesInConvo.filter((m: any) => Boolean(m.isIncoming()));

    this.set({ unreadCount: realUnreadCount });

    const mentionRead = (() => {
      const stillUnread = allUnreadMessagesInConvo.filter(
        (m: any) => m.get('received_at') > newestUnreadDate
      );
      const ourNumber = UserUtils.getOurPubKeyStrFromCache();
      return !stillUnread.some(
        (m: any) =>
          m.propsForMessage &&
          m.propsForMessage.text &&
          m.propsForMessage.text.indexOf(`@${ourNumber}`) !== -1
      );
    })();

    if (mentionRead) {
      this.set({ mentionedUs: false });
    }

    await this.commit();

    // If a message has errors, we don't want to send anything out about it.
    //   read syncs - let's wait for a client that really understands the message
    //      to mark it read. we'll mark our local error read locally, though.
    //   read receipts - here we can run into infinite loops, where each time the
    //      conversation is viewed, another error message shows up for the contact
    read = read.filter(item => !item.hasErrors);

    if (this.isPublic()) {
      window.log.debug('public conversation... No need to send read receipt');
      return;
    }
    if (this.isPrivate() && read.length && options.sendReadReceipts) {
      window.log.info(`Sending ${read.length} read receipts`);
      if (window.storage.get('read-receipt-setting')) {
        await Promise.all(
          _.map(_.groupBy(read, 'sender'), async (receipts, sender) => {
            const timestamps = _.map(receipts, 'timestamp').filter(t => !!t) as Array<number>;
            const receiptMessage = new ReadReceiptMessage({
              timestamp: Date.now(),
              timestamps,
            });

            const device = new PubKey(sender);
            await getMessageQueue().sendToPubKey(device, receiptMessage);
          })
        );
      }
    }
  }

  // LOKI PROFILES
  public async setNickname(nickname: string) {
    const trimmed = nickname && nickname.trim();
    if (this.get('nickname') === trimmed) {
      return;
    }

    this.set({ nickname: trimmed });
    await this.commit();

    await this.updateProfileName();
  }
  public async setLokiProfile(newProfile: { displayName?: string | null; avatar?: string }) {
    if (!_.isEqual(this.get('profile'), newProfile)) {
      this.set({ profile: newProfile });
      await this.commit();
    }

    // a user cannot remove an avatar. Only change it
    // if you change this behavior, double check all setLokiProfile calls (especially the one in EditProfileDialog)
    if (newProfile.avatar) {
      await this.setProfileAvatar({ path: newProfile.avatar });
    }

    await this.updateProfileName();
  }
  public async updateProfileName() {
    // Prioritise nickname over the profile display name
    const nickname = this.getNickname();
    const profile = this.getLokiProfile();
    const displayName = profile && profile.displayName;

    const profileName = nickname || displayName || null;
    await this.setProfileName(profileName);
  }
  public getLokiProfile() {
    return this.get('profile');
  }
  public getNickname() {
    return this.get('nickname');
  }
  // maybe "Backend" instead of "Source"?
  public async setPublicSource(newServer: any, newChannelId: any) {
    if (!this.isPublic()) {
      window.log.warn(`trying to setPublicSource on non public chat conversation ${this.id}`);
      return;
    }
    if (this.get('server') !== newServer || this.get('channelId') !== newChannelId) {
      // mark active so it's not in the contacts list but in the conversation list
      this.set({
        server: newServer,
        channelId: newChannelId,
        active_at: Date.now(),
      });
      await this.commit();
    }
  }
  public getPublicSource() {
    if (!this.isPublic()) {
      window.log.warn(`trying to getPublicSource on non public chat conversation ${this.id}`);
      return null;
    }
    return {
      server: this.get('server'),
      channelId: this.get('channelId'),
      conversationId: this.get('id'),
    };
  }
  public async getPublicSendData() {
    const channelAPI = await window.lokiPublicChatAPI.findOrCreateChannel(
      this.get('server'),
      this.get('channelId'),
      this.id
    );
    return channelAPI;
  }
  public getLastRetrievedMessage() {
    if (!this.isPublic()) {
      return null;
    }
    const lastMessageId = this.get('lastPublicMessage') || 0;
    return lastMessageId;
  }
  public async setLastRetrievedMessage(newLastMessageId: any) {
    if (!this.isPublic()) {
      return;
    }
    if (this.get('lastPublicMessage') !== newLastMessageId) {
      this.set({ lastPublicMessage: newLastMessageId });
      await this.commit();
    }
  }
  public isAdmin(pubKey?: string) {
    if (!this.isPublic()) {
      return false;
    }
    if (!pubKey) {
      throw new Error('isAdmin() pubKey is falsy');
    }
    const groupAdmins = this.getGroupAdmins();
    return Array.isArray(groupAdmins) && groupAdmins.includes(pubKey);
  }
  // SIGNAL PROFILES
  public async getProfiles() {
    // request all conversation members' keys
    let ids = [];
    if (this.isPrivate()) {
      ids = [this.id];
    } else {
      ids = this.get('members');
    }
    return Promise.all(_.map(ids, this.getProfile));
  }

  // This function is wrongly named by signal
  // This is basically an `update` function and thus we have overwritten it with such
  public async getProfile(id: string) {
    const c = await ConversationController.getInstance().getOrCreateAndWait(
      id,
      ConversationType.PRIVATE
    );

    // We only need to update the profile as they are all stored inside the conversation
    await c.updateProfileName();
  }
  public async setProfileName(name: string) {
    const profileName = this.get('profileName');
    if (profileName !== name) {
      this.set({ profileName: name });
      await this.commit();
    }
  }
  public async setGroupName(name: string) {
    const profileName = this.get('name');
    if (profileName !== name) {
      this.set({ name });
      await this.commit();
    }
  }
  public async setSubscriberCount(count: number) {
    if (this.get('subscriberCount') !== count) {
      this.set({ subscriberCount: count });
      await this.commit();
    }
    // Not sure if we care about updating the database
  }
  public async setGroupNameAndAvatar(name: string, avatarPath: string) {
    const currentName = this.get('name');
    const profileAvatar = this.get('avatar');
    if (profileAvatar !== avatarPath || currentName !== name) {
      // only update changed items
      if (profileAvatar !== avatarPath) {
        this.set({ avatar: avatarPath });
      }
      if (currentName !== name) {
        this.set({ name });
      }
      // save
      await this.commit();
    }
  }
  public async setProfileAvatar(avatar: any) {
    const profileAvatar = this.get('avatar');
    if (profileAvatar !== avatar) {
      this.set({ avatar });
      await this.commit();
    }
  }
  public async setProfileKey(profileKey: string) {
    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKey) {
      this.set({
        profileKey,
        accessKey: null,
      });

      await this.deriveAccessKeyIfNeeded();

      await this.commit();
    }
  }

  public async deriveAccessKeyIfNeeded() {
    const profileKey = this.get('profileKey');
    if (!profileKey) {
      return;
    }
    if (this.get('accessKey')) {
      return;
    }

    try {
      const profileKeyBuffer = fromBase64ToArrayBuffer(profileKey);
      const accessKeyBuffer = await window.Signal.Crypto.deriveAccessKey(profileKeyBuffer);
      const accessKey = fromArrayBufferToBase64(accessKeyBuffer);
      this.set({ accessKey });
    } catch (e) {
      window.log.warn(`Failed to derive access key for ${this.id}`);
    }
  }

  public async upgradeMessages(messages: any) {
    // tslint:disable-next-line: one-variable-per-declaration
    for (let max = messages.length, i = 0; i < max; i += 1) {
      const message = messages.at(i);
      const { attributes } = message;
      const { schemaVersion } = attributes;

      if (schemaVersion < window.Signal.Types.Message.VERSION_NEEDED_FOR_DISPLAY) {
        // Yep, we really do want to wait for each of these
        // eslint-disable-next-line no-await-in-loop
        const { upgradeMessageSchema } = window.Signal.Migrations;

        const upgradedMessage = await upgradeMessageSchema(attributes);
        message.set(upgradedMessage);
        // eslint-disable-next-line no-await-in-loop
        await upgradedMessage.commit();
      }
    }
  }

  public hasMember(pubkey: string) {
    return _.includes(this.get('members'), pubkey);
  }
  // returns true if this is a closed/medium or open group
  public isGroup() {
    return this.get('type') === 'group';
  }

  public copyPublicKey() {
    void ConversationInteraction.copyPublicKey(this.id);
  }

  public changeNickname() {
    throw new Error('changeNickname todo');
  }

  public deleteContact() {
    let title = window.i18n('delete');
    let message = window.i18n('deleteContactConfirmation');

    if (this.isGroup()) {
      title = window.i18n('leaveGroup');
      message = window.i18n('leaveGroupConfirmation');
    }

    window.confirmationDialog({
      title,
      message,
      resolve: () => {
        void ConversationController.getInstance().deleteContact(this.id);
      },
    });
  }

  public async removeMessage(messageId: any) {
    await dataRemoveMessage(messageId);
    this.updateLastMessage();

    window.inboxStore?.dispatch(
      conversationActions.messageDeleted({
        conversationKey: this.id,
        messageId,
      })
    );
  }

  public deleteMessages() {
    let params;
    if (this.isPublic()) {
      throw new Error('Called deleteMessages() on an open group. Only leave group is supported.');
    } else {
      params = {
        title: window.i18n('deleteMessages'),
        message: window.i18n('deleteConversationConfirmation'),
        resolve: () => this.destroyMessages(),
      };
    }

    window.confirmationDialog(params);
  }

  public async destroyMessages() {
    await removeAllMessagesInConversation(this.id);
    window.inboxStore?.dispatch(
      conversationActions.conversationReset({
        conversationKey: this.id,
      })
    );

    // destroy message keeps the active timestamp set so the
    // conversation still appears on the conversation list but is empty
    this.set({
      lastMessage: null,
      unreadCount: 0,
      mentionedUs: false,
    });

    await this.commit();
  }

  public getName() {
    if (this.isPrivate()) {
      return this.get('name');
    }
    return this.get('name') || window.i18n('unknown');
  }

  public getTitle() {
    if (this.isPrivate()) {
      const profileName = this.getProfileName();
      const number = this.getNumber();
      const name = profileName ? `${profileName} (${PubKey.shorten(number)})` : number;

      return this.get('name') || name;
    }
    return this.get('name') || 'Unknown group';
  }

  /**
   * For a private convo, returns the loki profilename if set, or a shortened
   * version of the contact pubkey.
   * Throws an error if called on a group convo.
   *
   */
  public getContactProfileNameOrShortenedPubKey() {
    if (!this.isPrivate()) {
      throw new Error(
        'getContactProfileNameOrShortenedPubKey() cannot be called with a non private convo.'
      );
    }

    const profileName = this.get('profileName');
    const pubkey = this.id;
    if (UserUtils.isUsFromCache(pubkey)) {
      return window.i18n('you');
    }
    return profileName || PubKey.shorten(pubkey);
  }

  /**
   * For a private convo, returns the loki profilename if set, or a full length
   * version of the contact pubkey.
   * Throws an error if called on a group convo.
   */
  public getContactProfileNameOrFullPubKey() {
    if (!this.isPrivate()) {
      throw new Error(
        'getContactProfileNameOrFullPubKey() cannot be called with a non private convo.'
      );
    }
    const profileName = this.get('profileName');
    const pubkey = this.id;
    if (UserUtils.isUsFromCache(pubkey)) {
      return window.i18n('you');
    }
    return profileName || pubkey;
  }

  public getProfileName() {
    if (this.isPrivate() && !this.get('name')) {
      return this.get('profileName');
    }
    return undefined;
  }

  public getNumber() {
    if (!this.isPrivate()) {
      return '';
    }
    return this.id;
  }

  public isPrivate() {
    return this.get('type') === ConversationType.PRIVATE;
  }

  public getAvatarPath() {
    const avatar = this.get('avatar') || this.get('profileAvatar');
    if (typeof avatar === 'string') {
      return avatar;
    }

    if (avatar && avatar.path && typeof avatar.path === 'string') {
      const { getAbsoluteAttachmentPath } = window.Signal.Migrations;

      return getAbsoluteAttachmentPath(avatar.path) as string;
    }

    return null;
  }
  public getAvatar() {
    const url = this.getAvatarPath();

    return { url: url || null };
  }

  public async getNotificationIcon() {
    return new Promise(resolve => {
      const avatar = this.getAvatar();
      if (avatar.url) {
        resolve(avatar.url);
      } else {
        resolve(new window.Whisper.IdenticonSVGView(avatar).getDataUrl());
      }
    });
  }

  public async notify(message: MessageModel) {
    if (!message.isIncoming()) {
      return;
    }
    const conversationId = this.id;

    const convo = await ConversationController.getInstance().getOrCreateAndWait(
      message.get('source'),
      ConversationType.PRIVATE
    );

    const iconUrl = await convo.getNotificationIcon();

    const messageJSON = message.toJSON();
    const messageSentAt = messageJSON.sent_at;
    const messageId = message.id;
    const isExpiringMessage = this.isExpiringMessage(messageJSON);

    // window.log.info('Add notification', {
    //   conversationId: this.idForLogging(),
    //   isExpiringMessage,
    //   messageSentAt,
    // });
    window.Whisper.Notifications.add({
      conversationId,
      iconUrl,
      isExpiringMessage,
      message: message.getNotificationText(),
      messageId,
      messageSentAt,
      title: convo.getTitle(),
    });
  }

  public async notifyTyping({ isTyping, sender }: any) {
    // We don't do anything with typing messages from our other devices
    if (UserUtils.isUsFromCache(sender)) {
      return;
    }

    // typing only works for private chats for now
    if (!this.isPrivate()) {
      return;
    }

    const wasTyping = !!this.typingTimer;
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    // Note: We trigger two events because:
    //   'change' causes a re-render of this conversation's list item in the left pane

    if (isTyping) {
      this.typingTimer = global.setTimeout(
        this.clearContactTypingTimer.bind(this, sender),
        15 * 1000
      );

      if (!wasTyping) {
        // User was not previously typing before. State change!
        await this.commit();
      }
    } else {
      // tslint:disable-next-line: no-dynamic-delete
      this.typingTimer = null;
      if (wasTyping) {
        // User was previously typing, and is no longer. State change!
        await this.commit();
      }
    }
  }

  public async clearContactTypingTimer(sender: string) {
    if (!!this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;

      // User was previously typing, but timed out or we received message. State change!
      await this.commit();
    }
  }

  private isExpiringMessage(json: any) {
    if (json.type === 'incoming') {
      return false;
    }

    const { expireTimer } = json;

    return typeof expireTimer === 'number' && expireTimer > 0;
  }
}

export class ConversationCollection extends Backbone.Collection<ConversationModel> {
  constructor(models?: Array<ConversationModel>) {
    super(models);
    this.comparator = (m: ConversationModel) => {
      return -m.get('active_at');
    };
  }
}
ConversationCollection.prototype.model = ConversationModel;
