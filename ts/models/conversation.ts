import Backbone from 'backbone';
import {
  debounce,
  defaults,
  filter,
  includes,
  isArray,
  isEmpty,
  isEqual,
  isNumber,
  isString,
  map,
  sortBy,
  throttle,
  uniq,
} from 'lodash';
import { getMessageQueue } from '../session';
import { getConversationController } from '../session/conversations';
import { ClosedGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../session/types';
import { ToastUtils, UserUtils } from '../session/utils';
import { BlockedNumberController } from '../util';
import { leaveClosedGroup } from '../session/group/closed-group';
import { SignalService } from '../protobuf';
import { MessageModel, sliceQuoteText } from './message';
import { MessageAttributesOptionals, MessageDirection } from './messageType';
import autoBind from 'auto-bind';

import { Data } from '../../ts/data/data';
import { toHex } from '../session/utils/String';
import {
  actions as conversationActions,
  conversationChanged,
  conversationsChanged,
  markConversationFullyRead,
  MessageModelPropsWithoutConvoProps,
  ReduxConversationType,
} from '../state/ducks/conversations';
import { ExpirationTimerUpdateMessage } from '../session/messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { TypingMessage } from '../session/messages/outgoing/controlMessage/TypingMessage';
import {
  VisibleMessage,
  VisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { GroupInvitationMessage } from '../session/messages/outgoing/visibleMessage/GroupInvitationMessage';
import { ReadReceiptMessage } from '../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupV2FromConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { createTaskWithTimeout } from '../session/utils/TaskWithTimeout';
import { perfEnd, perfStart } from '../session/utils/Performance';

import { ed25519Str } from '../session/onions/onionPath';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { IMAGE_JPEG } from '../types/MIME';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { getNowWithNetworkOffset } from '../session/apis/snode_api/SNodeAPI';
import { createLastMessageUpdate } from '../types/Conversation';
import {
  ReplyingToMessageProps,
  SendMessageType,
} from '../components/conversation/composition/CompositionBox';
import { SettingsKey } from '../data/settings-key';
import {
  deleteExternalFilesOfConversation,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
} from '../types/MessageAttachment';
import { getOurProfile } from '../session/utils/User';
import {
  MessageRequestResponse,
  MessageRequestResponseParams,
} from '../session/messages/outgoing/controlMessage/MessageRequestResponse';
import { Notifications } from '../util/notifications';
import { Storage } from '../util/storage';
import {
  ConversationAttributes,
  ConversationNotificationSetting,
  ConversationTypeEnum,
  fillConvoAttributesWithDefaults,
} from './conversationAttributes';
import { SogsBlinding } from '../session/apis/open_group_api/sogsv3/sogsBlinding';
import { from_hex } from 'libsodium-wrappers-sumo';
import { OpenGroupData } from '../data/opengroups';
import {
  roomHasBlindEnabled,
  roomHasReactionsEnabled,
} from '../session/apis/open_group_api/sogsv3/sogsV3Capabilities';
import { addMessagePadding } from '../session/crypto/BufferPadding';
import { getSodiumRenderer } from '../session/crypto';
import {
  findCachedOurBlindedPubkeyOrLookItUp,
  isUsAnySogsFromCache,
} from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { sogsV3FetchPreviewAndSaveIt } from '../session/apis/open_group_api/sogsv3/sogsV3FetchFile';
import { Reaction } from '../types/Reaction';
import { Reactions } from '../util/reactions';
import { DisappearingMessageConversationType } from '../util/expiringMessages';

export class ConversationModel extends Backbone.Model<ConversationAttributes> {
  public updateLastMessage: () => any;
  public throttledBumpTyping: () => void;
  public throttledNotify: (message: MessageModel) => void;
  public markRead: (newestUnreadDate: number, providedOptions?: any) => void;
  public initialPromise: any;

  private typingRefreshTimer?: NodeJS.Timeout | null;
  private typingPauseTimer?: NodeJS.Timeout | null;
  private typingTimer?: NodeJS.Timeout | null;
  private lastReadTimestamp: number;

  private pending?: Promise<any>;

  constructor(attributes: ConversationAttributes) {
    super(fillConvoAttributesWithDefaults(attributes));

    // This may be overridden by getConversationController().getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();
    autoBind(this);

    this.throttledBumpTyping = throttle(this.bumpTyping, 300);
    this.updateLastMessage = throttle(this.bouncyUpdateLastMessage.bind(this), 1000, {
      trailing: true,
      leading: true,
    });

    this.throttledNotify = debounce(this.notify, 2000, { maxWait: 2000, trailing: true });
    //start right away the function is called, and wait 1sec before calling it again
    const markReadDebounced = debounce(this.markReadBouncy, 1000, {
      leading: true,
      trailing: true,
    });
    this.markRead = (newestUnreadDate: number) => {
      const lastReadTimestamp = this.lastReadTimestamp;
      if (newestUnreadDate > lastReadTimestamp) {
        this.lastReadTimestamp = newestUnreadDate;
      }

      if (newestUnreadDate !== lastReadTimestamp) {
        void markReadDebounced(newestUnreadDate);
      }
    };
    // Listening for out-of-band data updates

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;
    this.lastReadTimestamp = 0;
    window.inboxStore?.dispatch(
      conversationChanged({ id: this.id, data: this.getConversationModelProps() })
    );
  }

  /**
   * Method to evaluate if a convo contains the right values
   * @param values Required properties to evaluate if this is a message request
   */
  public static hasValidIncomingRequestValues({
    isMe,
    isApproved,
    isBlocked,
    isPrivate,
    activeAt,
  }: {
    isMe?: boolean;
    isApproved?: boolean;
    isBlocked?: boolean;
    isPrivate?: boolean;
    activeAt?: number;
  }): boolean {
    // if a convo is not active, it means we didn't get any messages nor sent any.
    const isActive = activeAt && isFinite(activeAt) && activeAt > 0;
    return Boolean(isPrivate && !isMe && !isApproved && !isBlocked && isActive);
  }

  public static hasValidOutgoingRequestValues({
    isMe,
    didApproveMe,
    isApproved,
    isBlocked,
    isPrivate,
  }: {
    isMe?: boolean;
    isApproved?: boolean;
    didApproveMe?: boolean;
    isBlocked?: boolean;
    isPrivate?: boolean;
  }): boolean {
    return Boolean(!isMe && isApproved && isPrivate && !isBlocked && !didApproveMe);
  }

  public idForLogging() {
    if (this.isPrivate()) {
      return this.id;
    }

    if (this.isPublic()) {
      const opengroup = this.toOpenGroupV2();
      return `${opengroup.serverUrl}/${opengroup.roomId}`;
    }

    return `group(${ed25519Str(this.id)})`;
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
  public isClosedGroup() {
    return this.get('type') === ConversationTypeEnum.GROUP && !this.isPublic();
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

  public async cleanup() {
    await deleteExternalFilesOfConversation(this.attributes);
  }

  public getGroupAdmins(): Array<string> {
    const groupAdmins = this.get('groupAdmins');

    return groupAdmins && groupAdmins?.length > 0 ? groupAdmins : [];
  }

  /**
   * Get the list of moderators in that room, or an empty array
   * Only to be called for opengroup conversations.
   * This makes no sense for a private chat or an closed group, as closed group admins must be stored with getGroupAdmins
   * @returns the list of moderators for the conversation if the conversation is public, or []
   */
  public getGroupModerators(): Array<string> {
    const groupModerators = this.get('groupModerators') as Array<string> | undefined;

    return this.isPublic() && groupModerators && groupModerators?.length > 0 ? groupModerators : [];
  }

  // tslint:disable-next-line: cyclomatic-complexity max-func-body-length
  public getConversationModelProps(): ReduxConversationType {
    const groupAdmins = this.getGroupAdmins();
    const groupModerators = this.getGroupModerators();
    // tslint:disable-next-line: cyclomatic-complexity
    const isPublic = this.isPublic();

    const members = this.isGroup() && !isPublic ? this.get('members') : [];
    const zombies = this.isGroup() && !isPublic ? this.get('zombies') : [];
    const ourNumber = UserUtils.getOurPubKeyStrFromCache();
    const avatarPath = this.getAvatarPath();
    const isPrivate = this.isPrivate();
    const isGroup = !isPrivate;
    const weAreAdmin = this.isAdmin(ourNumber);
    const weAreModerator = this.isModerator(ourNumber); // only used for sogs
    const isMe = this.isMe();
    const isTyping = !!this.typingTimer;
    const unreadCount = this.get('unreadCount') || undefined;
    const mentionedUs = this.get('mentionedUs') || undefined;
    const isBlocked = this.isBlocked();
    const subscriberCount = this.get('subscriberCount');
    const isPinned = this.isPinned();
    const isApproved = this.isApproved();
    const didApproveMe = this.didApproveMe();
    const hasNickname = !!this.getNickname();
    const isKickedFromGroup = !!this.get('isKickedFromGroup');
    const left = !!this.get('left');
    const expirationType = this.get('expirationType');
    const expireTimer = this.get('expireTimer');
    const currentNotificationSetting = this.get('triggerNotificationsFor');
    const displayNameInProfile = this.get('displayNameInProfile');
    const nickname = this.get('nickname');

    // To reduce the redux store size, only set fields which cannot be undefined.
    // For instance, a boolean can usually be not set if false, etc
    const toRet: ReduxConversationType = {
      id: this.id as string,
      activeAt: this.get('active_at'),
      type: isPrivate ? ConversationTypeEnum.PRIVATE : ConversationTypeEnum.GROUP,
    };

    if (isPrivate) {
      toRet.isPrivate = true;
    }

    if (isGroup) {
      toRet.isGroup = true;
    }

    if (weAreAdmin) {
      toRet.weAreAdmin = true;
    }

    if (weAreModerator) {
      toRet.weAreModerator = true;
    }

    if (isMe) {
      toRet.isMe = true;
    }
    if (isPublic) {
      toRet.isPublic = true;
    }
    if (isTyping) {
      toRet.isTyping = true;
    }

    if (isTyping) {
      toRet.isTyping = true;
    }

    if (avatarPath) {
      toRet.avatarPath = avatarPath;
    }

    if (displayNameInProfile) {
      toRet.displayNameInProfile = displayNameInProfile;
    }

    if (nickname) {
      toRet.nickname = nickname;
    }

    if (unreadCount) {
      toRet.unreadCount = unreadCount;
    }

    if (mentionedUs) {
      toRet.mentionedUs = mentionedUs;
    }

    if (isBlocked) {
      toRet.isBlocked = isBlocked;
    }
    if (hasNickname) {
      toRet.hasNickname = hasNickname;
    }

    if (isKickedFromGroup) {
      toRet.isKickedFromGroup = isKickedFromGroup;
    }
    if (left) {
      toRet.left = left;
    }
    if (isPinned) {
      toRet.isPinned = isPinned;
    }
    if (didApproveMe) {
      toRet.didApproveMe = didApproveMe;
    }

    if (isApproved) {
      toRet.isApproved = isApproved;
    }

    if (subscriberCount) {
      toRet.subscriberCount = subscriberCount;
    }

    if (groupAdmins && groupAdmins.length) {
      toRet.groupAdmins = uniq(groupAdmins);
    }

    if (groupModerators && groupModerators.length) {
      toRet.groupModerators = uniq(groupModerators);
    }

    if (members && members.length) {
      toRet.members = uniq(members);
    }

    if (zombies && zombies.length) {
      toRet.zombies = uniq(zombies);
    }

    if (expirationType) {
      toRet.expirationType = expirationType;
    }

    if (expireTimer) {
      toRet.expireTimer = expireTimer;
    }

    if (
      currentNotificationSetting &&
      currentNotificationSetting !== ConversationNotificationSetting[0]
    ) {
      toRet.currentNotificationSetting = currentNotificationSetting;
    }

    if (this.isOpenGroupV2()) {
      const room = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (room && isArray(room.capabilities) && room.capabilities.length) {
        toRet.capabilities = room.capabilities;
      }

      if (this.get('writeCapability')) {
        toRet.writeCapability = this.get('writeCapability');
      }
      if (this.get('readCapability')) {
        toRet.readCapability = this.get('readCapability');
      }
      if (this.get('uploadCapability')) {
        toRet.uploadCapability = this.get('uploadCapability');
      }
    }

    const lastMessageText = this.get('lastMessage');
    if (lastMessageText && lastMessageText.length) {
      const lastMessageStatus = this.get('lastMessageStatus');

      toRet.lastMessage = {
        status: lastMessageStatus,
        text: lastMessageText,
      };
    }
    return toRet;
  }

  public async updateGroupAdmins(groupAdmins: Array<string>, shouldCommit: boolean) {
    const existingAdmins = uniq(sortBy(this.getGroupAdmins()));
    const newAdmins = uniq(sortBy(groupAdmins));

    if (isEqual(existingAdmins, newAdmins)) {
      return false;
    }
    this.set({ groupAdmins });
    if (shouldCommit) {
      await this.commit();
    }
    return true;
  }

  public async updateGroupModerators(groupModerators: Array<string>, shouldCommit: boolean) {
    if (!this.isPublic()) {
      throw new Error('group moderators are only possible on SOGS');
    }
    const existingModerators = uniq(sortBy(this.getGroupModerators()));
    const newModerators = uniq(sortBy(groupModerators));

    if (isEqual(existingModerators, newModerators)) {
      return false;
    }
    this.set({ groupModerators: newModerators });
    if (shouldCommit) {
      await this.commit();
    }
    return true;
  }

  public async getUnreadCount() {
    const unreadCount = await Data.getUnreadCountByConversation(this.id);

    return unreadCount;
  }

  public async queueJob(callback: () => Promise<void>) {
    // tslint:disable-next-line: no-promise-as-boolean
    const previous = this.pending || Promise.resolve();

    const taskWithTimeout = createTaskWithTimeout(callback, `conversation ${this.idForLogging()}`);

    this.pending = previous.then(taskWithTimeout, taskWithTimeout);
    const current = this.pending;

    void current.then(() => {
      if (this.pending === current) {
        delete this.pending;
      }
    });

    return current;
  }

  public async makeQuote(quotedMessage: MessageModel): Promise<ReplyingToMessageProps | null> {
    const attachments = quotedMessage.get('attachments');
    const preview = quotedMessage.get('preview');

    const body = quotedMessage.get('body');
    const quotedAttachments = await this.getQuoteAttachment(attachments, preview);

    if (!quotedMessage.get('sent_at')) {
      window.log.warn('tried to make a quote without a sent_at timestamp');
      return null;
    }
    let msgSource = quotedMessage.getSource();
    if (this.isPublic()) {
      const room = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (room && roomHasBlindEnabled(room) && msgSource === UserUtils.getOurPubKeyStrFromCache()) {
        // this room should send message with blinded pubkey, so we need to make the quote with them too.
        // when we make a quote to ourself on a blind sogs, that message has a sender being our naked pubkey
        const sodium = await getSodiumRenderer();
        msgSource = await findCachedOurBlindedPubkeyOrLookItUp(room.serverPublicKey, sodium);
      }
    }
    return {
      author: msgSource,
      id: `${quotedMessage.get('sent_at')}` || '',
      // no need to quote the full message length.
      text: sliceQuoteText(body),
      attachments: quotedAttachments,
      timestamp: quotedMessage.get('sent_at') || 0,
      convoId: this.id,
    };
  }

  public toOpenGroupV2(): OpenGroupRequestCommonType {
    if (!this.isOpenGroupV2()) {
      throw new Error('tried to run toOpenGroup for not public group v2');
    }
    return getOpenGroupV2FromConversationId(this.id);
  }

  public async sendMessageJob(message: MessageModel) {
    try {
      const { body, attachments, preview, quote, fileIdsToLink } = await message.uploadData();
      const { id } = message;
      const destination = this.id;

      const sentAt = message.get('sent_at');
      if (!sentAt) {
        throw new Error('sendMessageJob() sent_at must be set.');
      }

      const expirationType = message.get('expirationType');
      const expireTimer = message.get('expireTimer');

      if (this.isPublic() && !this.isOpenGroupV2()) {
        throw new Error('Only opengroupv2 are supported now');
      }
      // an OpenGroupV2 message is just a visible message
      const chatMessageParams: VisibleMessageParams = {
        body,
        identifier: id,
        timestamp: sentAt,
        attachments,
        expirationType,
        expireTimer,
        preview: preview ? [preview] : [],
        quote,
        lokiProfile: UserUtils.getOurProfile(),
      };

      const shouldApprove = !this.isApproved() && this.isPrivate();
      const incomingMessageCount = await Data.getMessageCountByType(
        this.id,
        MessageDirection.incoming
      );
      const hasIncomingMessages = incomingMessageCount > 0;

      if (this.id.startsWith('15')) {
        window.log.info('Sending a blinded message to this user: ', this.id);
        await this.sendBlindedMessageRequest(chatMessageParams);
        return;
      }

      if (shouldApprove) {
        await this.setIsApproved(true);
        if (hasIncomingMessages) {
          // have to manually add approval for local client here as DB conditional approval check in config msg handling will prevent this from running
          await this.addOutgoingApprovalMessage(Date.now());
          if (!this.didApproveMe()) {
            await this.setDidApproveMe(true);
          }
          // should only send once
          await this.sendMessageRequestResponse();
          void forceSyncConfigurationNowIfNeeded();
        }
      }

      if (this.isOpenGroupV2()) {
        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }
        const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
        // send with blinding if we need to
        await getMessageQueue().sendToOpenGroupV2(
          chatMessageOpenGroupV2,
          roomInfos,
          Boolean(roomHasBlindEnabled(openGroup)),
          fileIdsToLink
        );
        return;
      }

      const destinationPubkey = new PubKey(destination);

      // TODO check expiration types per different conversation setting

      if (this.isPrivate()) {
        if (this.isMe()) {
          chatMessageParams.syncTarget = this.id;
          const chatMessageMe = new VisibleMessage(chatMessageParams);

          // TODO handle sync messages for disappearing messages here
          await getMessageQueue().sendSyncMessage(chatMessageMe);
          return;
        }

        if (message.get('groupInvitation')) {
          const groupInvitation = message.get('groupInvitation');
          const groupInviteMessage = new GroupInvitationMessage({
            identifier: id,
            timestamp: sentAt,
            name: groupInvitation.name,
            url: groupInvitation.url,
            expireTimer: this.get('expireTimer'),
          });
          // we need the return await so that errors are caught in the catch {}
          await getMessageQueue().sendToPubKey(destinationPubkey, groupInviteMessage);
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
          expirationType,
          expireTimer,
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

  public async sendReactionJob(sourceMessage: MessageModel, reaction: Reaction) {
    try {
      const destination = this.id;

      const sentAt = sourceMessage.get('sent_at');
      if (!sentAt) {
        throw new Error('sendReactMessageJob() sent_at must be set.');
      }

      if (this.isPublic() && !this.isOpenGroupV2()) {
        throw new Error('Only opengroupv2 are supported now');
      }

      // an OpenGroupV2 message is just a visible message
      const chatMessageParams: VisibleMessageParams = {
        body: '',
        timestamp: sentAt,
        reaction,
        lokiProfile: UserUtils.getOurProfile(),
      };

      const shouldApprove = !this.isApproved() && this.isPrivate();
      const incomingMessageCount = await Data.getMessageCountByType(
        this.id,
        MessageDirection.incoming
      );
      const hasIncomingMessages = incomingMessageCount > 0;

      if (this.id.startsWith('15')) {
        window.log.info('Sending a blinded message to this user: ', this.id);
        await this.sendBlindedMessageRequest(chatMessageParams);
        return;
      }

      if (shouldApprove) {
        await this.setIsApproved(true);
        if (hasIncomingMessages) {
          // have to manually add approval for local client here as DB conditional approval check in config msg handling will prevent this from running
          await this.addOutgoingApprovalMessage(Date.now());
          if (!this.didApproveMe()) {
            await this.setDidApproveMe(true);
          }
          // should only send once
          await this.sendMessageRequestResponse();
          void forceSyncConfigurationNowIfNeeded();
        }
      }

      if (this.isOpenGroupV2()) {
        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }
        const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
        const blinded = Boolean(roomHasBlindEnabled(openGroup));

        // send with blinding if we need to
        await getMessageQueue().sendToOpenGroupV2(chatMessageOpenGroupV2, roomInfos, blinded, []);
        return;
      }

      const destinationPubkey = new PubKey(destination);

      if (this.isPrivate()) {
        const chatMessageMe = new VisibleMessage({
          ...chatMessageParams,
          syncTarget: this.id,
        });
        await getMessageQueue().sendSyncMessage(chatMessageMe);

        const chatMessagePrivate = new VisibleMessage(chatMessageParams);
        await getMessageQueue().sendToPubKey(destinationPubkey, chatMessagePrivate);
        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
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
        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
        return;
      }

      if (this.isClosedGroup()) {
        throw new Error('Legacy group are not supported anymore. You need to recreate this group.');
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e) {
      window.log.error(`Reaction job failed id:${reaction.id} error:`, e);
      return null;
    }
  }

  /**
   * Does this conversation contain the properties to be considered a message request
   */
  public isIncomingRequest(): boolean {
    return ConversationModel.hasValidIncomingRequestValues({
      isMe: this.isMe(),
      isApproved: this.isApproved(),
      isBlocked: this.isBlocked(),
      isPrivate: this.isPrivate(),
    });
  }

  /**
   * Is this conversation an outgoing message request
   */
  public isOutgoingRequest(): boolean {
    return ConversationModel.hasValidOutgoingRequestValues({
      isMe: this.isMe(),
      isApproved: this.isApproved(),
      didApproveMe: this.didApproveMe(),
      isBlocked: this.isBlocked(),
      isPrivate: this.isPrivate(),
    });
  }

  /**
   * When you have accepted another users message request
   * @param timestamp for determining the order for this message to appear like a regular message
   */
  public async addOutgoingApprovalMessage(timestamp: number) {
    await this.addSingleOutgoingMessage({
      sent_at: timestamp,
      messageRequestResponse: {
        isApproved: 1,
      },
      expireTimer: 0,
    });

    this.updateLastMessage();
  }

  /**
   * When the other user has accepted your message request
   * @param timestamp For determining message order in conversation
   * @param source For determining the conversation name used in the message.
   */
  public async addIncomingApprovalMessage(timestamp: number, source: string) {
    await this.addSingleIncomingMessage({
      sent_at: timestamp, // TODO: maybe add timestamp to messageRequestResponse? confirm it doesn't exist first
      source,
      messageRequestResponse: {
        isApproved: 1,
      },
      unread: 1, // 1 means unread
      expireTimer: 0,
    });
    this.updateLastMessage();
  }

  public async sendBlindedMessageRequest(messageParams: VisibleMessageParams) {
    const ourSignKeyBytes = await UserUtils.getUserED25519KeyPairBytes();
    const groupUrl = this.getSogsOriginMessage();

    if (!PubKey.hasBlindedPrefix(this.id)) {
      window?.log?.warn('sendBlindedMessageRequest - convo is not a blinded one');
      return;
    }

    if (!messageParams.body) {
      window?.log?.warn('sendBlindedMessageRequest - needs a body');
      return;
    }

    // include our profile (displayName + avatar url + key for the recipient)
    messageParams.lokiProfile = getOurProfile();

    if (!ourSignKeyBytes || !groupUrl) {
      window?.log?.error(
        'sendBlindedMessageRequest - Cannot get required information for encrypting blinded message.'
      );
      return;
    }

    const roomInfo = OpenGroupData.getV2OpenGroupRoom(groupUrl);

    if (!roomInfo || !roomInfo.serverPublicKey) {
      ToastUtils.pushToastError('no-sogs-matching', window.i18n('couldntFindServerMatching'));
      window?.log?.error('Could not find room with matching server url', groupUrl);
      throw new Error(`Could not find room with matching server url: ${groupUrl}`);
    }

    const sogsVisibleMessage = new OpenGroupVisibleMessage(messageParams);
    const paddedBody = addMessagePadding(sogsVisibleMessage.plainTextBuffer());

    const serverPubKey = roomInfo.serverPublicKey;

    const encryptedMsg = await SogsBlinding.encryptBlindedMessage({
      rawData: paddedBody,
      senderSigningKey: ourSignKeyBytes,
      serverPubKey: from_hex(serverPubKey),
      recipientBlindedPublicKey: from_hex(this.id.slice(2)),
    });

    if (!encryptedMsg) {
      throw new Error('encryptBlindedMessage failed');
    }
    if (!messageParams.identifier) {
      throw new Error('encryptBlindedMessage messageParams needs an identifier');
    }

    this.set({ active_at: Date.now(), isApproved: true });

    await getMessageQueue().sendToOpenGroupV2BlindedRequest(
      encryptedMsg,
      roomInfo,
      sogsVisibleMessage,
      this.id
    );
  }

  /**
   * Sends an accepted message request response.
   * Currently, we never send anything for denied message requests.
   */
  public async sendMessageRequestResponse() {
    if (!this.isPrivate()) {
      return;
    }

    const timestamp = Date.now();

    const messageRequestResponseParams: MessageRequestResponseParams = {
      timestamp,
      lokiProfile: UserUtils.getOurProfile(),
    };

    const messageRequestResponse = new MessageRequestResponse(messageRequestResponseParams);
    const pubkeyForSending = new PubKey(this.id);
    await getMessageQueue()
      .sendToPubKey(pubkeyForSending, messageRequestResponse)
      .catch(window?.log?.error);
  }

  public async sendMessage(msg: SendMessageType) {
    const { attachments, body, groupInvitation, preview, quote } = msg;
    this.clearTypingTimers();
    const expirationType = this.get('expirationType');
    const expireTimer = this.get('expireTimer');
    const networkTimestamp = getNowWithNetworkOffset();

    window?.log?.info(
      'Sending message to conversation',
      this.idForLogging(),
      'with networkTimestamp: ',
      networkTimestamp
    );

    const messageModel = await this.addSingleOutgoingMessage({
      body,
      quote: isEmpty(quote) ? undefined : quote,
      preview,
      attachments,
      sent_at: networkTimestamp,
      expirationType,
      expireTimer,
      serverTimestamp: this.isPublic() ? networkTimestamp : undefined,
      groupInvitation,
    });

    // We're offline!
    if (!window.isOnline) {
      const error = new Error('Network is not available');
      error.name = 'SendMessageNetworkError';
      (error as any).number = this.id;
      await messageModel.saveErrors([error]);
      await this.commit();

      return;
    }

    this.set({
      lastMessage: messageModel.getNotificationText(),
      lastMessageStatus: 'sending',
      active_at: networkTimestamp,
    });
    await this.commit();

    void this.queueJob(async () => {
      await this.sendMessageJob(messageModel);
    });
  }

  public async sendReaction(sourceId: string, reaction: Reaction) {
    const sourceMessage = await Data.getMessageById(sourceId);

    if (!sourceMessage) {
      return;
    }

    void this.queueJob(async () => {
      await this.sendReactionJob(sourceMessage, reaction);
    });
  }

  public async bouncyUpdateLastMessage() {
    if (!this.id || !this.get('active_at')) {
      return;
    }
    const messages = await Data.getLastMessagesByConversation(this.id, 1, true);

    if (!messages || !messages.length) {
      return;
    }
    const lastMessageModel = messages.at(0);
    const lastMessageStatusModel = lastMessageModel
      ? lastMessageModel.getMessagePropStatus()
      : undefined;
    const lastMessageUpdate = createLastMessageUpdate({
      lastMessageStatus: lastMessageStatusModel,
      lastMessageNotificationText: lastMessageModel
        ? lastMessageModel.getNotificationText()
        : undefined,
    });

    if (
      lastMessageUpdate.lastMessage !== this.get('lastMessage') ||
      lastMessageUpdate.lastMessageStatus !== this.get('lastMessageStatus')
    ) {
      const lastMessageAttribute = this.get('lastMessage');
      if (
        lastMessageUpdate.lastMessageStatus === this.get('lastMessageStatus') &&
        lastMessageUpdate.lastMessage &&
        lastMessageUpdate.lastMessage.length > 40 &&
        lastMessageAttribute &&
        lastMessageAttribute.length > 40 &&
        lastMessageUpdate.lastMessage.startsWith(lastMessageAttribute)
      ) {
        // if status is the same, and text has a long length which starts with the db status, do not trigger an update.
        // we only store the first 60 chars in the db for the lastMessage attributes (see sql.ts)
        return;
      }
      this.set(lastMessageUpdate);
      await this.commit();
    }
  }

  public async updateExpireTimer({
    providedExpirationType,
    providedExpireTimer,
    providedChangeTimestamp,
    providedSource,
    receivedAt, // is set if it comes from outside
    fromSync,
    shouldCommit = true,
  }: {
    providedExpirationType: DisappearingMessageConversationType;
    providedExpireTimer?: number;
    providedChangeTimestamp?: number;
    providedSource?: string;
    receivedAt?: number; // is set if it comes from outside
    fromSync?: boolean;
    shouldCommit?: boolean;
  }): Promise<void> {
    let expirationType = providedExpirationType;
    let expireTimer = providedExpireTimer;
    let source = providedSource;

    defaults({ fromSync }, { fromSync: false });

    if (!expirationType || !expireTimer) {
      expirationType = 'off';
      expireTimer = 0;
    }

    // TODO does this actually work?
    if (
      isEqual(expirationType, this.get('expirationType')) &&
      isEqual(expireTimer, this.get('expireTimer'))
    ) {
      window.log.info(
        'WIP: Dropping ExpireTimerUpdate message as we already have the same one set.'
      );
      return;
    }

    const isOutgoing = Boolean(!receivedAt);
    source = source || UserUtils.getOurPubKeyStrFromCache();

    // When we add a disappearing messages notification to the conversation, we want it
    // to be above the message that initiated that change, hence the subtraction.
    const timestamp = (receivedAt || Date.now()) - 1;

    this.set({
      expirationType,
      expireTimer,
      lastDisappearingMessageChangeTimestamp: providedChangeTimestamp || undefined,
    });

    window?.log?.info('WIP: Updated conversation disappearing messages setting', {
      id: this.idForLogging(),
      expirationType,
      expireTimer,
      source,
    });

    const lastDisappearingMessageChangeTimestamp = providedChangeTimestamp || 0;
    const commonAttributes = {
      flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expirationType,
        expireTimer,
        lastDisappearingMessageChangeTimestamp,
        source,
        fromSync,
      },
    };

    let message: MessageModel | undefined;

    if (isOutgoing) {
      message = await this.addSingleOutgoingMessage({
        ...commonAttributes,
        sent_at: timestamp,
      });
    } else {
      // TODO do we still want to handle expiration in incoming messages?
      message = await this.addSingleIncomingMessage({
        ...commonAttributes,
        // Even though this isn't reflected to the user, we want to place the last seen
        //   indicator above it. We set it to 'unread' to trigger that placement.
        unread: 1,
        source,
        sent_at: timestamp,
        received_at: timestamp,
      });
    }

    if (this.isActive()) {
      this.set('active_at', timestamp);
    }

    if (shouldCommit) {
      // tell the UI this conversation was updated
      await this.commit();
    }
    // if change was made remotely, don't send it to the number/group
    if (receivedAt) {
      return;
    }

    const expireUpdate = {
      identifier: message.id,
      timestamp,
      expirationType,
      expireTimer,
      lastDisappearingMessageChangeTimestamp,
    };

    if (this.isMe()) {
      // TODO Check that the args are correct
      if (expireUpdate.expirationType === 'deleteAfterRead') {
        window.log.info(`WIP: Note to Self messages cannot be delete after read!`);
        return;
      }

      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);
      return message.sendSyncMessageOnly(expirationTimerMessage);
    }

    if (this.isPrivate()) {
      // TODO Check that the args are correct
      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);
      const pubkey = new PubKey(this.get('id'));
      await getMessageQueue().sendToPubKey(pubkey, expirationTimerMessage);
    } else {
      // TODO Check that the args are correct
      // Cannot be an open group
      window?.log?.warn('TODO: Expiration update for closed groups are to be updated');
      const expireUpdateForGroup = {
        ...expireUpdate,
        groupId: this.get('id'),
      };

      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdateForGroup);

      await getMessageQueue().sendToGroup(expirationTimerMessage);
    }
    return;
  }

  public triggerUIRefresh() {
    updatesToDispatch.set(this.id, this.getConversationModelProps());
    throttledAllConversationsDispatch();
  }

  public async commit() {
    perfStart(`conversationCommit-${this.attributes.id}`);
    // write to DB
    await Data.saveConversation(this.attributes);
    this.triggerUIRefresh();
    perfEnd(`conversationCommit-${this.attributes.id}`, 'conversationCommit');
  }

  public async addSingleOutgoingMessage(
    messageAttributes: Omit<
      MessageAttributesOptionals,
      'conversationId' | 'source' | 'type' | 'direction' | 'received_at' | 'unread'
    >
  ) {
    let sender = UserUtils.getOurPubKeyStrFromCache();
    if (this.isPublic()) {
      const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (openGroup && openGroup.serverPublicKey && roomHasBlindEnabled(openGroup)) {
        const signingKeys = await UserUtils.getUserED25519KeyPairBytes();

        if (!signingKeys) {
          throw new Error('addSingleOutgoingMessage: getUserED25519KeyPairBytes returned nothing');
        }

        const sodium = await getSodiumRenderer();

        const ourBlindedPubkeyForCurrentSogs = await findCachedOurBlindedPubkeyOrLookItUp(
          openGroup.serverPublicKey,
          sodium
        );

        if (ourBlindedPubkeyForCurrentSogs) {
          sender = ourBlindedPubkeyForCurrentSogs;
        }
      }
    }
    return this.addSingleMessage({
      ...messageAttributes,
      conversationId: this.id,
      source: sender,
      type: 'outgoing',
      direction: 'outgoing',
      unread: 0, // an outgoing message must be read right?
      received_at: messageAttributes.sent_at, // make sure to set an received_at timestamp for an outgoing message, so the order are right.
    });
  }

  public async addSingleIncomingMessage(
    messageAttributes: Omit<MessageAttributesOptionals, 'conversationId' | 'type' | 'direction'>
  ) {
    // if there's a message by the other user, they've replied to us which we consider an accepted convo
    if (!this.didApproveMe() && this.isPrivate()) {
      await this.setDidApproveMe(true);
    }

    return this.addSingleMessage({
      ...messageAttributes,
      conversationId: this.id,
      type: 'incoming',
      direction: 'outgoing',
    });
  }

  public async leaveClosedGroup() {
    if (this.isMediumGroup()) {
      await leaveClosedGroup(this.id);
    } else {
      window?.log?.error('Cannot leave a non-medium group conversation');
      throw new Error(
        'Legacy group are not supported anymore. You need to create this group again.'
      );
    }
  }

  /**
   * Mark everything as read efficiently if possible.
   *
   * For convos with a expiration timer enable, start the timer as of now.
   * Send read receipt if needed.
   */
  public async markAllAsRead() {
    /**
     *  when marking all as read, there is a bunch of things we need to do.
     *   - we need to update all the messages in the DB not read yet for that conversation
     *   - we need to send the read receipts if there is one needed for those messages
     *   - we need to trigger a change on the redux store, so those messages are read AND mark the whole convo as read.
     *   - we need to remove any notifications related to this conversation ID.
     *
     *
     * (if there is an expireTimer, we do it the slow way, handling each message separately)
     */
    const expireTimerSet = !!this.get('expireTimer');
    if (this.isOpenGroupV2() || !expireTimerSet) {
      // for opengroups, we batch everything as there is no expiration timer to take care (and potentially a lot of messages)

      const isOpenGroup = this.isOpenGroupV2();
      // if this is an opengroup there is no need to send read receipt, and so no need to fetch messages updated.
      const allReadMessages = await Data.markAllAsReadByConversationNoExpiration(
        this.id,
        !isOpenGroup
      );
      this.set({ mentionedUs: false, unreadCount: 0 });

      await this.commit();
      if (!this.isOpenGroupV2() && allReadMessages.length) {
        await this.sendReadReceiptsIfNeeded(uniq(allReadMessages));
      }
      Notifications.clearByConversationID(this.id);
      window.inboxStore?.dispatch(markConversationFullyRead(this.id));

      return;
    }
    // otherwise, do it the slow way
    await this.markReadBouncy(Date.now());
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public async markReadBouncy(
    newestUnreadDate: number,
    providedOptions: { sendReadReceipts?: boolean; readAt?: number } = {}
  ) {
    const lastReadTimestamp = this.lastReadTimestamp;
    if (newestUnreadDate < lastReadTimestamp) {
      return;
    }

    const readAt = providedOptions?.readAt || Date.now();
    const sendReadReceipts = providedOptions?.sendReadReceipts || true;

    const conversationId = this.id;
    Notifications.clearByConversationID(conversationId);
    let allUnreadMessagesInConvo = (await this.getUnread()).models;

    const oldUnreadNowRead = allUnreadMessagesInConvo.filter(
      message => (message.get('received_at') as number) <= newestUnreadDate
    );

    let read = [];

    // Build the list of updated message models so we can mark them all as read on a single sqlite call
    for (const nowRead of oldUnreadNowRead) {
      nowRead.markReadNoCommit(readAt);

      const errors = nowRead.get('errors');
      read.push({
        sender: nowRead.get('source'),
        timestamp: nowRead.get('sent_at'),
        hasErrors: Boolean(errors && errors.length),
      });
    }

    const oldUnreadNowReadAttrs = oldUnreadNowRead.map(m => m.attributes);
    if (oldUnreadNowReadAttrs?.length) {
      await Data.saveMessages(oldUnreadNowReadAttrs);
    }
    const allProps: Array<MessageModelPropsWithoutConvoProps> = [];

    for (const nowRead of oldUnreadNowRead) {
      allProps.push(nowRead.getMessageModelProps());
    }

    if (allProps.length) {
      window.inboxStore?.dispatch(conversationActions.messagesChanged(allProps));
    }
    // Some messages we're marking read are local notifications with no sender
    read = filter(read, m => Boolean(m.sender));
    const realUnreadCount = await this.getUnreadCount();
    if (read.length === 0) {
      const cachedUnreadCountOnConvo = this.get('unreadCount');
      if (cachedUnreadCountOnConvo !== realUnreadCount) {
        // reset the unreadCount on the convo to the real one coming from markRead messages on the db
        this.set({ unreadCount: realUnreadCount });
        await this.commit();
      } else {
        // window?.log?.info('markRead(): nothing newly read.');
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
      return !stillUnread.some(m => m.get('body')?.indexOf(`@${ourNumber}`) !== -1);
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

    if (read.length && sendReadReceipts) {
      const timestamps = map(read, 'timestamp').filter(t => !!t) as Array<number>;
      await this.sendReadReceiptsIfNeeded(timestamps);
    }
  }

  public async sendReadReceiptsIfNeeded(timestamps: Array<number>) {
    if (!this.isPrivate() || !timestamps.length) {
      return;
    }
    const settingsReadReceiptEnabled = Storage.get(SettingsKey.settingsReadReceipt) || false;
    const sendReceipt =
      settingsReadReceiptEnabled && !this.isBlocked() && !this.isIncomingRequest();

    if (sendReceipt) {
      window?.log?.info(`Sending ${timestamps.length} read receipts.`);
      // we should probably stack read receipts and send them every 5 seconds for instance per conversation

      const receiptMessage = new ReadReceiptMessage({
        timestamp: Date.now(),
        timestamps,
      });

      const device = new PubKey(this.id);
      await getMessageQueue().sendToPubKey(device, receiptMessage);
    }
  }

  public async setNickname(nickname: string | null) {
    if (!this.isPrivate()) {
      window.log.info('cannot setNickname to a non private conversation.');
      return;
    }
    const trimmed = nickname && nickname.trim();
    if (this.get('nickname') === trimmed) {
      return;
    }
    // make sure to save the lokiDisplayName as name in the db. so a search of conversation returns it.
    // (we look for matches in name too)
    const realUserName = this.getRealSessionUsername();

    if (!trimmed || !trimmed.length) {
      this.set({ nickname: undefined, displayNameInProfile: realUserName });
    } else {
      this.set({ nickname: trimmed, displayNameInProfile: realUserName });
    }

    await this.commit();
  }

  public async setSessionProfile(newProfile: {
    displayName?: string | null;
    avatarPath?: string | null;
    avatarImageId?: number;
  }) {
    let changes = false;

    const existingSessionName = this.getRealSessionUsername();
    if (newProfile.displayName !== existingSessionName && newProfile.displayName) {
      this.set({
        displayNameInProfile: newProfile.displayName,
      });
      changes = true;
    }

    // a user cannot remove an avatar. Only change it
    // if you change this behavior, double check all setSessionProfile calls (especially the one in EditProfileDialog)
    if (newProfile.avatarPath) {
      const originalAvatar = this.get('avatarInProfile');
      if (!isEqual(originalAvatar, newProfile.avatarPath)) {
        this.set({ avatarInProfile: newProfile.avatarPath });
        changes = true;
      }
      const existingImageId = this.get('avatarImageId');

      if (existingImageId !== newProfile.avatarImageId) {
        this.set({ avatarImageId: newProfile.avatarImageId });
        changes = true;
      }
    }

    if (changes) {
      await this.commit();
    }
  }

  public setSessionDisplayNameNoCommit(newDisplayName?: string | null) {
    const existingSessionName = this.getRealSessionUsername();
    if (newDisplayName !== existingSessionName && newDisplayName) {
      this.set({ displayNameInProfile: newDisplayName });
    }
  }

  /**
   * @returns `displayNameInProfile` so the real username as defined by that user/group
   */
  public getRealSessionUsername(): string | undefined {
    return this.get('displayNameInProfile');
  }

  /**
   * @returns `nickname` so the nickname we forced for that user. For a group, this returns `undefined`
   */
  public getNickname(): string | undefined {
    return this.isPrivate() ? this.get('nickname') : undefined;
  }

  /**
   * @returns `getNickname` if a private convo and a nickname is set, or `getRealSessionUsername`
   */
  public getNicknameOrRealUsername(): string | undefined {
    return this.getNickname() || this.getRealSessionUsername();
  }

  /**
   * @returns `getNickname` if a private convo and a nickname is set, or `getRealSessionUsername`
   *
   * Can also a localized 'Anonymous' for an unknown private chat and localized 'Unknown' for an unknown group (open/closed)
   */
  public getNicknameOrRealUsernameOrPlaceholder(): string {
    const nickOrReal = this.getNickname() || this.getRealSessionUsername();

    if (nickOrReal) {
      return nickOrReal;
    }
    if (this.isPrivate()) {
      return window.i18n('anonymous');
    }
    return window.i18n('unknown');
  }

  public isAdmin(pubKey?: string) {
    if (!this.isPublic() && !this.isGroup()) {
      return false;
    }
    if (!pubKey) {
      throw new Error('isAdmin() pubKey is falsy');
    }
    const groupAdmins = this.getGroupAdmins();
    return Array.isArray(groupAdmins) && groupAdmins.includes(pubKey);
  }

  /**
   * Check if the provided pubkey is a moderator.
   * Being a moderator only makes sense for a sogs as closed groups have their admin under the groupAdmins property
   */
  public isModerator(pubKey?: string) {
    if (!pubKey) {
      throw new Error('isModerator() pubKey is falsy');
    }
    if (!this.isPublic()) {
      return false;
    }

    const groupModerators = this.getGroupModerators();
    return Array.isArray(groupModerators) && groupModerators.includes(pubKey);
  }

  public async setIsPinned(value: boolean) {
    if (value !== this.isPinned()) {
      this.set({
        isPinned: value,
      });
      await this.commit();
    }
  }

  public async setIsApproved(value: boolean, shouldCommit: boolean = true) {
    if (value !== this.isApproved()) {
      window?.log?.info(`Setting ${ed25519Str(this.id)} isApproved to: ${value}`);
      this.set({
        isApproved: value,
      });

      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public async setDidApproveMe(value: boolean, shouldCommit: boolean = true) {
    if (value !== this.didApproveMe()) {
      window?.log?.info(`Setting ${ed25519Str(this.id)} didApproveMe to: ${value}`);
      this.set({
        didApproveMe: value,
      });

      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public async setOriginConversationID(conversationIdOrigin: string) {
    if (conversationIdOrigin === this.get('conversationIdOrigin')) {
      return;
    }
    this.set({
      conversationIdOrigin,
    });
    await this.commit();
  }

  public async setSubscriberCount(count: number) {
    if (this.get('subscriberCount') !== count) {
      this.set({ subscriberCount: count });
      await this.commit();
    }
    // Not sure if we care about updating the database
  }

  /**
   * Saves the infos of that room directly on the conversation table.
   * This does not write anything to the db if no changes are detected
   */
  // tslint:disable-next-line: cyclomatic-complexity
  public async setPollInfo(infos?: {
    subscriberCount: number;
    read: boolean;
    write: boolean;
    upload: boolean;
    details: {
      admins?: Array<string>;
      image_id?: number;
      name?: string;
      moderators?: Array<string>;
      hidden_admins?: Array<string>;
      hidden_moderators?: Array<string>;
    };
  }) {
    if (!infos || isEmpty(infos)) {
      return;
    }
    let hasChange = false;
    const { read, write, upload, subscriberCount, details } = infos;
    if (
      isNumber(infos.subscriberCount) &&
      infos.subscriberCount !== 0 &&
      this.get('subscriberCount') !== subscriberCount
    ) {
      hasChange = true;
      this.set('subscriberCount', subscriberCount);
    }

    if (Boolean(this.get('readCapability')) !== Boolean(read)) {
      hasChange = true;
      this.set('readCapability', Boolean(read));
    }

    if (Boolean(this.get('writeCapability')) !== Boolean(write)) {
      hasChange = true;
      this.set('writeCapability', Boolean(write));
    }

    if (Boolean(this.get('uploadCapability')) !== Boolean(upload)) {
      hasChange = true;
      this.set('uploadCapability', Boolean(upload));
    }

    const adminChanged = await this.handleModsOrAdminsChanges({
      modsOrAdmins: details.admins,
      hiddenModsOrAdmins: details.hidden_admins,
      type: 'admins',
    });

    hasChange = hasChange || adminChanged;

    const modsChanged = await this.handleModsOrAdminsChanges({
      modsOrAdmins: details.moderators,
      hiddenModsOrAdmins: details.hidden_moderators,
      type: 'mods',
    });

    if (details.name && details.name !== this.getRealSessionUsername()) {
      hasChange = hasChange || true;
      this.setSessionDisplayNameNoCommit(details.name);
    }

    hasChange = hasChange || modsChanged;

    if (this.isOpenGroupV2() && details.image_id && isNumber(details.image_id)) {
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (roomInfos) {
        void sogsV3FetchPreviewAndSaveIt({ ...roomInfos, imageID: `${details.image_id}` });
      }
    }

    // only trigger a write to the db if a change is detected
    if (hasChange) {
      await this.commit();
    }
  }

  /**
   * profileKey MUST be a hex string
   * @param profileKey MUST be a hex string
   */
  public async setProfileKey(profileKey?: Uint8Array, autoCommit = true) {
    if (!profileKey) {
      return;
    }

    const profileKeyHex = toHex(profileKey);

    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKeyHex) {
      this.set({
        profileKey: profileKeyHex,
      });

      if (autoCommit) {
        await this.commit();
      }
    }
  }

  public hasMember(pubkey: string) {
    return includes(this.get('members'), pubkey);
  }

  public hasReactions() {
    // message requests should not have reactions
    if (this.isPrivate() && !this.isApproved()) {
      return false;
    }
    // older open group conversations won't have reaction support
    if (this.isOpenGroupV2()) {
      const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
      return roomHasReactionsEnabled(openGroup);
    } else {
      return true;
    }
  }

  // returns true if this is a closed/medium or open group
  public isGroup() {
    return this.get('type') === ConversationTypeEnum.GROUP;
  }

  public async removeMessage(messageId: string) {
    await Data.removeMessage(messageId);
    this.updateLastMessage();

    window.inboxStore?.dispatch(
      conversationActions.messagesDeleted([
        {
          conversationKey: this.id,
          messageId,
        },
      ])
    );
  }

  public isPinned() {
    return Boolean(this.get('isPinned'));
  }

  public didApproveMe() {
    return Boolean(this.get('didApproveMe'));
  }

  public isApproved() {
    return Boolean(this.get('isApproved'));
  }

  public getTitle() {
    return this.getNicknameOrRealUsernameOrPlaceholder();
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

    const pubkey = this.id;
    if (UserUtils.isUsFromCache(pubkey)) {
      return window.i18n('you');
    }

    const profileName = this.get('displayNameInProfile');

    return profileName || PubKey.shorten(pubkey);
  }

  public isPrivate() {
    return this.get('type') === ConversationTypeEnum.PRIVATE;
  }

  public getAvatarPath(): string | null {
    const avatar = this.get('avatarInProfile');
    if (isString(avatar)) {
      return avatar;
    }

    if (avatar) {
      throw new Error('avatarInProfile must be a string as we do not allow the {path: xxx} syntax');
    }

    return null;
  }

  public async getNotificationIcon() {
    const avatarUrl = this.getAvatarPath();
    const noIconUrl = 'images/session/session_icon_32.png';

    if (!avatarUrl) {
      return noIconUrl;
    }
    const decryptedAvatarUrl = await getDecryptedMediaUrl(avatarUrl, IMAGE_JPEG, true);

    if (!decryptedAvatarUrl) {
      window.log.warn('Could not decrypt avatar stored locally for getNotificationIcon..');
      return noIconUrl;
    }
    return decryptedAvatarUrl;
  }

  public async notify(message: MessageModel) {
    if (!message.isIncoming()) {
      return;
    }
    const conversationId = this.id;

    let friendRequestText;
    if (!this.isApproved()) {
      window?.log?.info('notification cancelled for unapproved convo', this.idForLogging());
      const hadNoRequestsPrior =
        getConversationController()
          .getConversations()
          .filter(conversation => {
            return (
              !conversation.isApproved() &&
              !conversation.isBlocked() &&
              conversation.isPrivate() &&
              !conversation.isMe()
            );
          }).length === 1;
      const isFirstMessageOfConvo =
        (await Data.getMessagesByConversation(this.id, { messageId: null })).length === 1;
      if (hadNoRequestsPrior && isFirstMessageOfConvo) {
        friendRequestText = window.i18n('youHaveANewFriendRequest');
      } else {
        window?.log?.info(
          'notification cancelled for as pending requests already exist',
          this.idForLogging()
        );
        return;
      }
    }

    // make sure the notifications are not muted for this convo (and not the source convo)
    const convNotif = this.get('triggerNotificationsFor');
    if (convNotif === 'disabled') {
      window?.log?.info('notifications disabled for convo', this.idForLogging());
      return;
    }
    if (convNotif === 'mentions_only') {
      // check if the message has ourselves as mentions
      const regex = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');
      const text = message.get('body');
      const mentions = text?.match(regex) || ([] as Array<string>);
      const mentionMe = mentions && mentions.some(m => isUsAnySogsFromCache(m.slice(1)));

      const quotedMessageAuthor = message.get('quote')?.author;

      const isReplyToOurMessage =
        quotedMessageAuthor && UserUtils.isUsFromCache(quotedMessageAuthor);
      if (!mentionMe && !isReplyToOurMessage) {
        window?.log?.info(
          'notifications disabled for non mentions or reply for convo',
          conversationId
        );

        return;
      }
    }

    const convo = await getConversationController().getOrCreateAndWait(
      message.get('source'),
      ConversationTypeEnum.PRIVATE
    );

    const iconUrl = await this.getNotificationIcon();

    const messageJSON = message.toJSON();
    const messageSentAt = messageJSON.sent_at;
    const messageId = message.id;
    const isExpiringMessage = this.isExpiringMessage(messageJSON);

    Notifications.addNotification({
      conversationId,
      iconUrl,
      isExpiringMessage,
      message: friendRequestText ? friendRequestText : message.getNotificationText(),
      messageId,
      messageSentAt,
      title: friendRequestText ? '' : convo.getTitle(),
    });
  }

  public async notifyIncomingCall() {
    if (!this.isPrivate()) {
      window?.log?.info('notifyIncomingCall: not a private convo', this.idForLogging());
      return;
    }
    const conversationId = this.id;

    // make sure the notifications are not muted for this convo (and not the source convo)
    const convNotif = this.get('triggerNotificationsFor');
    if (convNotif === 'disabled') {
      window?.log?.info(
        'notifyIncomingCall: notifications disabled for convo',
        this.idForLogging()
      );
      return;
    }

    const now = Date.now();
    const iconUrl = await this.getNotificationIcon();

    Notifications.addNotification({
      conversationId,
      iconUrl,
      isExpiringMessage: false,
      message: window.i18n('incomingCallFrom', [
        this.getNicknameOrRealUsername() || window.i18n('anonymous'),
      ]),
      messageSentAt: now,
      title: this.getNicknameOrRealUsernameOrPlaceholder(),
    });
  }

  public async notifyTypingNoCommit({ isTyping, sender }: { isTyping: boolean; sender: string }) {
    // We don't do anything with typing messages from our other devices
    if (UserUtils.isUsFromCache(sender)) {
      return;
    }

    // typing only works for private chats for now
    if (!this.isPrivate()) {
      return;
    }

    if (this.typingTimer) {
      global.clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    // we do not trigger a state change here, instead we rely on the caller to do the commit once it is done with the queue of messages
    this.typingTimer = isTyping
      ? global.setTimeout(this.clearContactTypingTimer.bind(this, sender), 15 * 1000)
      : null;
  }

  private async getUnread() {
    return Data.getUnreadByConversation(this.id);
  }

  /**
   *
   * @returns The open group conversationId this conversation originated from
   */
  private getSogsOriginMessage() {
    return this.get('conversationIdOrigin');
  }

  private async addSingleMessage(messageAttributes: MessageAttributesOptionals) {
    const voiceMessageFlags = messageAttributes.attachments?.[0]?.isVoiceMessage
      ? SignalService.AttachmentPointer.Flags.VOICE_MESSAGE
      : undefined;
    const model = new MessageModel({ ...messageAttributes, flags: voiceMessageFlags });

    // no need to trigger a UI update now, we trigger a messagesAdded just below
    const messageId = await model.commit(false);
    model.set({ id: messageId });

    await model.setToExpire();

    const messageModelProps = model.getMessageModelProps();
    window.inboxStore?.dispatch(conversationActions.messagesChanged([messageModelProps]));
    const unreadCount = await this.getUnreadCount();
    this.set({ unreadCount });
    this.updateLastMessage();

    await this.commit();
    return model;
  }

  private async clearContactTypingTimer(_sender: string) {
    if (!!this.typingTimer) {
      global.clearTimeout(this.typingTimer);
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

    return isFinite(expireTimer) && expireTimer > 0;
  }

  private shouldDoTyping() {
    // for typing to happen, this must be a private unblocked active convo, and the settings to be on
    if (
      !this.isActive() ||
      !Storage.get(SettingsKey.settingsTypingIndicator) ||
      this.isBlocked() ||
      !this.isPrivate()
    ) {
      return false;
    }
    return Boolean(this.get('isApproved'));
  }

  private async bumpTyping() {
    if (!this.shouldDoTyping()) {
      return;
    }

    if (!this.typingRefreshTimer) {
      const isTyping = true;
      this.setTypingRefreshTimer();
      this.sendTypingMessage(isTyping);
    }

    this.setTypingPauseTimer();
  }

  private setTypingRefreshTimer() {
    if (this.typingRefreshTimer) {
      global.clearTimeout(this.typingRefreshTimer);
    }
    this.typingRefreshTimer = global.setTimeout(this.onTypingRefreshTimeout.bind(this), 10 * 1000);
  }

  private onTypingRefreshTimeout() {
    const isTyping = true;
    this.sendTypingMessage(isTyping);

    // This timer will continue to reset itself until the pause timer stops it
    this.setTypingRefreshTimer();
  }

  private setTypingPauseTimer() {
    if (this.typingPauseTimer) {
      global.clearTimeout(this.typingPauseTimer);
    }
    this.typingPauseTimer = global.setTimeout(this.onTypingPauseTimeout.bind(this), 10 * 1000);
  }

  private onTypingPauseTimeout() {
    const isTyping = false;
    this.sendTypingMessage(isTyping);

    this.clearTypingTimers();
  }

  private clearTypingTimers() {
    if (this.typingPauseTimer) {
      global.clearTimeout(this.typingPauseTimer);
      this.typingPauseTimer = null;
    }
    if (this.typingRefreshTimer) {
      global.clearTimeout(this.typingRefreshTimer);
      this.typingRefreshTimer = null;
    }
  }

  private sendTypingMessage(isTyping: boolean) {
    if (!this.isPrivate()) {
      return;
    }

    const recipientId = this.id;

    if (!recipientId) {
      throw new Error('Need to provide either recipientId');
    }

    if (!this.isApproved()) {
      return;
    }

    if (this.isMe()) {
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
      .catch(window?.log?.error);
  }

  private async replaceWithOurRealSessionId(toReplace: Array<string>) {
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(this.id);
    const sodium = await getSodiumRenderer();
    const ourBlindedPubkeyForThisSogs =
      roomInfos && roomHasBlindEnabled(roomInfos)
        ? await findCachedOurBlindedPubkeyOrLookItUp(roomInfos?.serverPublicKey, sodium)
        : UserUtils.getOurPubKeyStrFromCache();
    const replacedWithOurRealSessionId = toReplace.map(m =>
      m === ourBlindedPubkeyForThisSogs ? UserUtils.getOurPubKeyStrFromCache() : m
    );
    return replacedWithOurRealSessionId;
  }

  private async handleModsOrAdminsChanges({
    modsOrAdmins,
    hiddenModsOrAdmins,
    type,
  }: {
    modsOrAdmins?: Array<string>;
    hiddenModsOrAdmins?: Array<string>;
    type: 'mods' | 'admins';
  }) {
    if (modsOrAdmins && isArray(modsOrAdmins)) {
      const localModsOrAdmins = [...modsOrAdmins];
      if (hiddenModsOrAdmins && isArray(hiddenModsOrAdmins)) {
        localModsOrAdmins.push(...hiddenModsOrAdmins);
      }

      const replacedWithOurRealSessionId = await this.replaceWithOurRealSessionId(
        uniq(localModsOrAdmins)
      );

      const moderatorsOrAdminsChanged =
        type === 'admins'
          ? await this.updateGroupAdmins(replacedWithOurRealSessionId, false)
          : await this.updateGroupModerators(replacedWithOurRealSessionId, false);
      return moderatorsOrAdminsChanged;
    }
    return false;
  }

  private async getQuoteAttachment(attachments: any, preview: any) {
    if (attachments?.length) {
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
              thumbnail: attachment?.thumbnail?.path // loadAttachmentData throws if the thumbnail.path is not set
                ? {
                    ...(await loadAttachmentData(thumbnail)),
                    objectUrl: getAbsoluteAttachmentPath(thumbnail.path),
                  }
                : null,
            };
          })
      );
    }

    if (preview?.length) {
      return Promise.all(
        preview
          .filter((attachment: any) => attachment?.image?.path) // loadAttachmentData throws if the image.path is not set
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
}

const throttledAllConversationsDispatch = debounce(
  () => {
    if (updatesToDispatch.size === 0) {
      return;
    }
    window.inboxStore?.dispatch(conversationsChanged([...updatesToDispatch.values()]));

    updatesToDispatch.clear();
  },
  500,
  { trailing: true, leading: true, maxWait: 1000 }
);

const updatesToDispatch: Map<string, ReduxConversationType> = new Map();

export class ConversationCollection extends Backbone.Collection<ConversationModel> {
  constructor(models?: Array<ConversationModel>) {
    super(models);
    this.comparator = (m: ConversationModel) => {
      return -(m.get('active_at') || 0);
    };
  }
}
ConversationCollection.prototype.model = ConversationModel;
