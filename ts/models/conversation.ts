import autoBind from 'auto-bind';
import Backbone from 'backbone';
import { from_hex } from 'libsodium-wrappers-sumo';
import {
  debounce,
  includes,
  isArray,
  isEmpty,
  isEqual,
  isFinite,
  isNil,
  isNumber,
  isString,
  sortBy,
  throttle,
  uniq,
  xor,
} from 'lodash';

import { v4 } from 'uuid';
import { SignalService } from '../protobuf';
import { getMessageQueue } from '../session';
import { getConversationController } from '../session/conversations';
import { ClosedGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../session/types';
import { ToastUtils, UserUtils } from '../session/utils';
import { BlockedNumberController } from '../util';
import { MessageModel } from './message';
import { MessageAttributesOptionals, MessageDirection } from './messageType';

import { Data } from '../data/data';
import { OpenGroupRequestCommonType } from '../session/apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getOpenGroupV2FromConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { ExpirationTimerUpdateMessage } from '../session/messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { ReadReceiptMessage } from '../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage';
import { TypingMessage } from '../session/messages/outgoing/controlMessage/TypingMessage';
import { GroupInvitationMessage } from '../session/messages/outgoing/visibleMessage/GroupInvitationMessage';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import {
  VisibleMessage,
  VisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { ed25519Str, toHex } from '../session/utils/String';
import { createTaskWithTimeout } from '../session/utils/TaskWithTimeout';
import {
  actions as conversationActions,
  conversationsChanged,
  markConversationFullyRead,
  messagesDeleted,
  ReduxConversationType,
} from '../state/ducks/conversations';

import {
  ReplyingToMessageProps,
  SendMessageType,
} from '../components/conversation/composition/CompositionBox';
import { OpenGroupData } from '../data/opengroups';
import { SettingsKey } from '../data/settings-key';
import {
  findCachedOurBlindedPubkeyOrLookItUp,
  getUsBlindedInThatServer,
  isUsAnySogsFromCache,
} from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { SogsBlinding } from '../session/apis/open_group_api/sogsv3/sogsBlinding';
import { sogsV3FetchPreviewAndSaveIt } from '../session/apis/open_group_api/sogsv3/sogsV3FetchFile';
import { GetNetworkTime } from '../session/apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../session/apis/snode_api/namespaces';
import { getSodiumRenderer } from '../session/crypto';
import { addMessagePadding } from '../session/crypto/BufferPadding';
import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import {
  MessageRequestResponse,
  MessageRequestResponseParams,
} from '../session/messages/outgoing/controlMessage/MessageRequestResponse';
import { ConfigurationSync } from '../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../session/utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../session/utils/libsession/libsession_utils_user_groups';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/sync/syncUtils';
import { getOurProfile } from '../session/utils/User';
import {
  deleteExternalFilesOfConversation,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
} from '../types/MessageAttachment';
import { IMAGE_JPEG } from '../types/MIME';
import { Reaction } from '../types/Reaction';
import {
  assertUnreachable,
  roomHasBlindEnabled,
  roomHasReactionsEnabled,
  SaveConversationReturn,
} from '../types/sqlSharedTypes';
import { Notifications } from '../util/notifications';
import { Reactions } from '../util/reactions';
import { Registration } from '../util/registration';
import { Storage } from '../util/storage';
import {
  CONVERSATION_PRIORITIES,
  ConversationAttributes,
  ConversationNotificationSetting,
  ConversationTypeEnum,
  fillConvoAttributesWithDefaults,
  isDirectConversation,
  isOpenOrClosedGroup,
  READ_MESSAGE_STATE,
} from './conversationAttributes';

import { LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { SessionUtilUserProfile } from '../session/utils/libsession/libsession_utils_user_profile';
import { ReduxSogsRoomInfos } from '../state/ducks/sogsRoomInfo';
import {
  getCanWriteOutsideRedux,
  getModeratorsOutsideRedux,
  getSubscriberCountOutsideRedux,
} from '../state/selectors/sogsRoomInfo'; // decide it it makes sense to move this to a redux slice?

import { DisappearingMessages } from '../session/disappearing_messages';
import { DisappearingMessageConversationModeType } from '../session/disappearing_messages/types';
import { FetchMsgExpirySwarm } from '../session/utils/job_runners/jobs/FetchMsgExpirySwarmJob';
import { UpdateMsgExpirySwarm } from '../session/utils/job_runners/jobs/UpdateMsgExpirySwarmJob';
import { ReleasedFeatures } from '../util/releaseFeature';
import { markAttributesAsReadIfNeeded } from './messageFactory';

type InMemoryConvoInfos = {
  mentionedUs: boolean;
  unreadCount: number;
};

/**
 * Some fields are not stored in the database, but are kept in memory.
 * We use this map to keep track of them. The key is the conversation id.
 */
const inMemoryConvoInfos: Map<string, InMemoryConvoInfos> = new Map();

export class ConversationModel extends Backbone.Model<ConversationAttributes> {
  public updateLastMessage: () => unknown; // unknown because it is a Promise that we do not wait to await
  public throttledBumpTyping: () => void;
  public throttledNotify: (message: MessageModel) => void;
  public markConversationRead: (opts: {
    newestUnreadDate: number;
    fromConfigMessage?: boolean;
  }) => void;
  public initialPromise: any;

  private typingRefreshTimer?: NodeJS.Timeout | null;
  private typingPauseTimer?: NodeJS.Timeout | null;
  private typingTimer?: NodeJS.Timeout | null;

  private pending?: Promise<any>;

  constructor(attributes: ConversationAttributes) {
    super(fillConvoAttributesWithDefaults(attributes));

    // This may be overridden by getConversationController().getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();
    autoBind(this);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.throttledBumpTyping = throttle(this.bumpTyping, 300);
    this.updateLastMessage = throttle(this.bouncyUpdateLastMessage.bind(this), 1000, {
      trailing: true,
      leading: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.throttledNotify = debounce(this.notify, 2000, { maxWait: 2000, trailing: true });
    // start right away the function is called, and wait 1sec before calling it again
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.markConversationRead = debounce(this.markConversationReadBouncy, 1000, {
      leading: true,
      trailing: true,
    });

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;
    window.inboxStore?.dispatch(conversationsChanged([this.getConversationModelProps()]));
  }

  public idForLogging() {
    if (this.isPrivate()) {
      return this.id;
    }

    if (this.isPublic()) {
      return this.id;
    }

    return `group(${ed25519Str(this.id)})`;
  }

  public isMe() {
    return UserUtils.isUsFromCache(this.id);
  }

  /**
   * Same as this.isOpenGroupV2().
   *
   * // TODOLATER merge them together
   */
  public isPublic(): boolean {
    return this.isOpenGroupV2();
  }

  /**
   * Same as this.isPublic().
   *
   * // TODOLATER merge them together
   */
  public isOpenGroupV2(): boolean {
    return OpenGroupUtils.isOpenGroupV2(this.id);
  }
  public isClosedGroup(): boolean {
    return Boolean(
      (this.get('type') === ConversationTypeEnum.GROUP && this.id.startsWith('05')) ||
        (this.get('type') === ConversationTypeEnum.GROUPV3 && this.id.startsWith('03'))
    );
  }

  public isPrivate() {
    return isDirectConversation(this.get('type'));
  }

  // returns true if this is a closed/medium or open group
  public isGroup() {
    return isOpenOrClosedGroup(this.get('type'));
  }

  public isBlocked() {
    if (!this.id || this.isMe()) {
      return false;
    }

    if (this.isPrivate() || this.isClosedGroup()) {
      return BlockedNumberController.isBlocked(this.id);
    }

    return false;
  }

  /**
   * Returns true if this conversation is active.
   * i.e. the conversation is visible on the left pane. (Either we or another user created this convo).
   * An active conversation is a user/group we interacted with directly, or they did, at some point.
   * For instance, all of the conversations created when receiving a community are not active, until we start directly talking with them (or they do).
   */
  public isActive() {
    return Boolean(this.get('active_at'));
  }

  /**
   *
   * @returns true if this conversation is private and hidden.
   * A non-private conversation cannot be hidden currently.
   *  - a community is removed straight away when we leave it and not marked hidden
   *  - a legacy group is kept visible if we leave it, until we explicitely delete it. At that time, it is removed completely and not marked hidden
   */
  public isHidden() {
    const priority = this.get('priority') || CONVERSATION_PRIORITIES.default;
    return this.isPrivate() && priority === CONVERSATION_PRIORITIES.hidden;
  }

  public async cleanup() {
    await deleteExternalFilesOfConversation(this.attributes);
  }

  public getGroupAdmins(): Array<string> {
    const groupAdmins = this.get('groupAdmins');

    return groupAdmins && groupAdmins.length > 0 ? groupAdmins : [];
  }

  public getConversationModelProps(): ReduxConversationType {
    const ourNumber = UserUtils.getOurPubKeyStrFromCache();
    const avatarPath = this.getAvatarPath();
    const isPrivate = this.isPrivate();
    // TODO we should maybe make this weAreAdmin not props in redux but computed selectors
    const weAreAdmin = this.isAdmin(ourNumber);
    const currentNotificationSetting = this.get('triggerNotificationsFor');
    const priorityFromDb = this.get('priority');

    // To reduce the redux store size, only set fields which cannot be undefined.
    // For instance, a boolean can usually be not set if false, etc
    const toRet: ReduxConversationType = {
      id: this.id as string,
      activeAt: this.get('active_at'),
      type: this.get('type'),
    };

    if (isFinite(priorityFromDb) && priorityFromDb !== CONVERSATION_PRIORITIES.default) {
      toRet.priority = priorityFromDb;
    }

    if (this.get('markedAsUnread')) {
      toRet.isMarkedUnread = !!this.get('markedAsUnread');
    }

    const blocksSogsMsgReqsTimestamp = this.get('blocksSogsMsgReqsTimestamp');
    if (blocksSogsMsgReqsTimestamp) {
      toRet.blocksSogsMsgReqsTimestamp = blocksSogsMsgReqsTimestamp;
    }

    if (isPrivate) {
      toRet.isPrivate = true;
      if (this.typingTimer) {
        toRet.isTyping = true;
      }
      if (this.isMe()) {
        toRet.isMe = true;
      }

      const foundContact = SessionUtilContact.getContactCached(this.id);

      if (!toRet.activeAt && foundContact && isFinite(foundContact.createdAtSeconds)) {
        toRet.activeAt = foundContact.createdAtSeconds * 1000; // active at is in ms
      }
    }

    if (weAreAdmin) {
      toRet.weAreAdmin = true;
    }

    if (this.isPublic()) {
      toRet.isPublic = true;
    }

    if (avatarPath) {
      toRet.avatarPath = avatarPath;
    }

    if (this.getExpirationMode()) {
      toRet.expirationMode = this.getExpirationMode();
    }

    if (this.getHasOutdatedClient()) {
      toRet.hasOutdatedClient = this.getHasOutdatedClient();
    }

    if (
      currentNotificationSetting &&
      currentNotificationSetting !== ConversationNotificationSetting[0]
    ) {
      toRet.currentNotificationSetting = currentNotificationSetting;
    }

    if (this.get('displayNameInProfile')) {
      toRet.displayNameInProfile = this.get('displayNameInProfile');
    }
    if (this.get('nickname')) {
      toRet.nickname = this.get('nickname');
    }
    if (BlockedNumberController.isBlocked(this.id)) {
      toRet.isBlocked = true;
    }
    if (this.get('didApproveMe')) {
      toRet.didApproveMe = this.get('didApproveMe');
    }
    if (this.get('isApproved')) {
      toRet.isApproved = this.get('isApproved');
    }
    if (this.getExpireTimer()) {
      toRet.expireTimer = this.getExpireTimer();
    }
    // those are values coming only from both the DB or the wrapper. Currently we display the data from the DB
    if (this.isClosedGroup()) {
      toRet.members = uniq(this.get('members') || []);
    }

    // those are values coming only from both the DB or the wrapper. Currently we display the data from the DB
    if (this.isClosedGroup() || this.isPublic()) {
      // for public, this value always comes from the DB
      toRet.groupAdmins = this.getGroupAdmins();
    }

    // those are values coming only from the DB when this is a closed group
    if (this.isClosedGroup()) {
      if (this.get('isKickedFromGroup')) {
        toRet.isKickedFromGroup = this.get('isKickedFromGroup');
      }
      if (this.get('left')) {
        toRet.left = this.get('left');
      }
      // to be dropped once we get rid of the legacy closed groups
      const zombies = this.get('zombies') || [];
      if (zombies?.length) {
        toRet.zombies = uniq(zombies);
      }
    }

    // -- Handle the field stored only in memory for all types of conversation--
    const inMemoryConvoInfo = inMemoryConvoInfos.get(this.id);
    if (inMemoryConvoInfo) {
      if (inMemoryConvoInfo.unreadCount) {
        toRet.unreadCount = inMemoryConvoInfo.unreadCount;
      }
      if (inMemoryConvoInfo.mentionedUs) {
        toRet.mentionedUs = inMemoryConvoInfo.mentionedUs;
      }
    }

    // -- Handle the last message status, if present --
    const lastMessageInteractionType = this.get('lastMessageInteractionType');
    const lastMessageInteractionStatus = this.get('lastMessageInteractionStatus');
    const lastMessageText = this.get('lastMessage');
    if (lastMessageText && lastMessageText.length) {
      const lastMessageStatus = this.get('lastMessageStatus');

      toRet.lastMessage = {
        status: lastMessageStatus,
        text: lastMessageText,
        interactionType: lastMessageInteractionType,
        interactionStatus: lastMessageInteractionStatus,
      };
    } else if (lastMessageInteractionType && lastMessageInteractionStatus) {
      // if there is no last message, we still want to display the interaction status

      toRet.lastMessage = {
        text: '',
        status: 'sent',
        interactionType: lastMessageInteractionType,
        interactionStatus: lastMessageInteractionStatus,
      };
    }

    return toRet;
  }

  /**
   *
   * @param groupAdmins the Array of group admins, where, if we are a group admin, we are present unblinded.
   * @param shouldCommit set this to true to auto commit changes
   * @returns true if the groupAdmins where not the same (and thus updated)
   */
  public async updateGroupAdmins(groupAdmins: Array<string>, shouldCommit: boolean) {
    const sortedNewAdmins = uniq(sortBy(groupAdmins));

    // check if there is any difference betwewen the two, if yes, override it with what we got.
    if (!xor(this.getGroupAdmins(), groupAdmins).length) {
      return false;
    }
    this.set({ groupAdmins: sortedNewAdmins });
    if (shouldCommit) {
      await this.commit();
    }
    return true;
  }

  /**
   * Fetches from the Database an update of what are the memory only informations like mentionedUs and the unreadCount, etc
   */
  public async refreshInMemoryDetails(providedMemoryDetails?: SaveConversationReturn) {
    if (!SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(this)) {
      return;
    }
    const memoryDetails = providedMemoryDetails || (await Data.fetchConvoMemoryDetails(this.id));

    if (!memoryDetails) {
      inMemoryConvoInfos.delete(this.id);
      return;
    }
    if (!inMemoryConvoInfos.get(this.id)) {
      inMemoryConvoInfos.set(this.id, {
        mentionedUs: false,
        unreadCount: 0,
      });
    }

    const existing = inMemoryConvoInfos.get(this.id);
    if (!existing) {
      return;
    }
    let changes = false;
    if (existing.unreadCount !== memoryDetails.unreadCount) {
      existing.unreadCount = memoryDetails.unreadCount;
      changes = true;
    }

    if (existing.mentionedUs !== memoryDetails.mentionedUs) {
      existing.mentionedUs = memoryDetails.mentionedUs;
      changes = true;
    }

    if (changes) {
      this.triggerUIRefresh();
    }
  }

  public async queueJob(callback: () => Promise<void>) {
    const previous = this.pending || Promise.resolve();

    const taskWithTimeout = createTaskWithTimeout(callback, `conversation ${this.idForLogging()}`);

    // eslint-disable-next-line more/no-then
    this.pending = previous.then(taskWithTimeout, taskWithTimeout);
    const current = this.pending;
    // eslint-disable-next-line more/no-then
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
      // NOTE we send the entire body to be consistent with the other platforms
      text: body,
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

  public async sendReactionJob(sourceMessage: MessageModel, reaction: Reaction) {
    try {
      const destination = this.id;

      const sentAt = sourceMessage.get('sent_at');
      if (!sentAt) {
        throw new Error('sendReactMessageJob() sent_at must be set.');
      }
      const expireTimer = this.getExpireTimer();
      const expirationType = DisappearingMessages.changeToDisappearingMessageType(
        this,
        expireTimer,
        this.getExpirationMode()
      );
      const chatMessageParams: VisibleMessageParams = {
        body: '',
        // we need to use a new timestamp here, otherwise android&iOS will consider this message as a duplicate and drop the synced reaction
        timestamp: GetNetworkTime.getNowWithNetworkOffset(),
        reaction,
        lokiProfile: UserUtils.getOurProfile(),
        expirationType,
        expireTimer,
      };

      const shouldApprove = !this.isApproved() && this.isPrivate();
      const incomingMessageCount = await Data.getMessageCountByType(
        this.id,
        MessageDirection.incoming
      );
      const hasIncomingMessages = incomingMessageCount > 0;

      if (PubKey.isBlinded(this.id)) {
        window.log.info('Sending a blinded message react to this user: ', this.id);
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
        // communities have no expiration timer support, so enforce it here.
        chatMessageParams.expirationType = null;
        chatMessageParams.expireTimer = null;

        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }
        const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
        const blinded = Boolean(roomHasBlindEnabled(openGroup));

        // send with blinding if we need to
        await getMessageQueue().sendToOpenGroupV2({
          message: chatMessageOpenGroupV2,
          roomInfos,
          blinded,
          filesToLink: [],
        });
        return;
      }

      const destinationPubkey = new PubKey(destination);

      if (this.isPrivate()) {
        const chatMessageMe = new VisibleMessage({
          ...chatMessageParams,
          syncTarget: this.id,
        });
        await getMessageQueue().sendSyncMessage({
          namespace: SnodeNamespaces.UserMessages,
          message: chatMessageMe,
        });

        const chatMessagePrivate = new VisibleMessage(chatMessageParams);

        await getMessageQueue().sendToPubKey(
          destinationPubkey,
          chatMessagePrivate,
          SnodeNamespaces.UserMessages
        );
        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
        return;
      }
      if (this.isClosedGroup()) {
        const chatMessageMediumGroup = new VisibleMessage(chatMessageParams);
        const closedGroupVisibleMessage = new ClosedGroupVisibleMessage({
          chatMessage: chatMessageMediumGroup,
          groupId: destinationPubkey,
          timestamp: sentAt,
        });
        // we need the return await so that errors are caught in the catch {}
        await getMessageQueue().sendToGroup({
          message: closedGroupVisibleMessage,
          namespace: SnodeNamespaces.ClosedGroupMessage,
        });

        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
        return;
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e) {
      window.log.error(`Reaction job failed id:${reaction.id} error:`, e);
    }
  }

  /**
   * Does this conversation contain the properties to be considered a message request
   */
  public isIncomingRequest(): boolean {
    return hasValidIncomingRequestValues({
      isMe: this.isMe(),
      isApproved: this.isApproved(),
      isBlocked: this.isBlocked(),
      isPrivate: this.isPrivate(),
      activeAt: this.get('active_at'),
      didApproveMe: this.didApproveMe(),
    });
  }

  /**
   * Is this conversation an outgoing message request
   */
  public isOutgoingRequest(): boolean {
    return hasValidOutgoingRequestValues({
      isMe: this.isMe() || false,
      isApproved: this.isApproved() || false,
      didApproveMe: this.didApproveMe() || false,
      isBlocked: this.isBlocked() || false,
      isPrivate: this.isPrivate() || false,
      activeAt: this.get('active_at') || 0,
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
      sent_at: timestamp,
      source,
      messageRequestResponse: {
        isApproved: 1,
      },
      unread: READ_MESSAGE_STATE.unread, // 1 means unread
      expireTimer: 0,
    });
    this.updateLastMessage();
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
      .sendToPubKey(pubkeyForSending, messageRequestResponse, SnodeNamespaces.UserMessages)
      .catch(window?.log?.error);
  }

  public async sendMessage(msg: SendMessageType) {
    const { attachments, body, groupInvitation, preview, quote } = msg;
    this.clearTypingTimers();
    const networkTimestamp = GetNetworkTime.getNowWithNetworkOffset();

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
      expirationType: DisappearingMessages.changeToDisappearingMessageType(
        this,
        this.getExpireTimer(),
        this.getExpirationMode()
      ),
      expireTimer: this.getExpireTimer(),
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

    const interactionNotification = messageModel.getInteractionNotification();

    if (interactionNotification) {
      this.set({
        lastMessageInteractionType: interactionNotification?.interactionType,
        lastMessageInteractionStatus: interactionNotification?.interactionStatus,
      });
    }

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

  /**
   * Updates the disappearing message settings for this conversation and sends an ExpirationTimerUpdate message if required
   * @param providedDisappearingMode
   * @param providedExpireTimer
   * @param providedSource the pubkey of the user who made the change
   * @param receivedAt the timestamp of when the change was received
   * @param fromSync if the change was made from a sync message
   * @param shouldCommitConvo if the conversation change should be committed to the DB
   * @param shouldCommitMessage if the timer update message change should be committed to the DB
   * @param existingMessage if we have an existing message model to update
   * @returns true, if the change was made or false if it was ignored
   */
  public async updateExpireTimer({
    providedDisappearingMode,
    providedExpireTimer,
    providedSource,
    receivedAt, // is set if it comes from outside
    fromSync, // if the update comes from sync message ONLY
    fromConfigMessage, // if the update comes from a libsession config message ONLY
    fromCurrentDevice,
    shouldCommitConvo = true,
    existingMessage,
  }: {
    providedDisappearingMode?: DisappearingMessageConversationModeType;
    providedExpireTimer?: number;
    providedSource?: string;
    receivedAt?: number; // is set if it comes from outside
    fromSync: boolean;
    fromCurrentDevice: boolean;
    fromConfigMessage: boolean;
    shouldCommitConvo?: boolean;
    existingMessage?: MessageModel;
  }): Promise<boolean> {
    const isRemoteChange = Boolean(
      (receivedAt || fromSync || fromConfigMessage) && !fromCurrentDevice
    );

    // we don't add an update message when this comes from a config message, as we already have the SyncedMessage itself with the right timestamp to display

    if (this.isPublic()) {
      throw new Error("updateExpireTimer() Disappearing messages aren't supported in communities");
    }
    let expirationMode = providedDisappearingMode;
    let expireTimer = providedExpireTimer;
    const source = providedSource || UserUtils.getOurPubKeyStrFromCache();

    if (expirationMode === undefined || expireTimer === undefined) {
      expirationMode = 'off';
      expireTimer = 0;
    }
    const shouldAddExpireUpdateMsgPrivate = this.isPrivate() && !fromConfigMessage;
    const isLegacyGroup = this.isClosedGroup() && !PubKey.isClosedGroupV3(this.id);

    /**
     * it's ugly, but we want to add a message for legacy groups only when
     * - not coming from a config message
     * - effectively changes the setting
     * - ignores a off setting for a legacy group (as we can get a setting from restored from configMessage, and a newgroup can still be in the swarm when linking a device
     */
    const shouldAddExpireUpdateMsgGroup =
      isLegacyGroup &&
      !fromConfigMessage &&
      (expirationMode !== this.get('expirationMode') || expireTimer !== this.get('expireTimer')) &&
      expirationMode !== 'off';

    const shouldAddExpireUpdateMessage =
      shouldAddExpireUpdateMsgPrivate || shouldAddExpireUpdateMsgGroup;

    // When we add a disappearing messages notification to the conversation, we want it
    // to be above the message that initiated that change, hence the subtraction.
    const timestamp = (receivedAt || Date.now()) - 1;

    // NOTE when we turn the disappearing setting to off, we don't want it to expire with the previous expiration anymore

    const isV2DisappearReleased = ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached();
    // when the v2 disappear is released, the changes we make are only for our outgoing messages, not shared with a contact anymore
    if (isV2DisappearReleased) {
      if (!this.isPrivate()) {
        this.set({
          expirationMode,
          expireTimer,
        });
      } else if (fromSync || fromCurrentDevice) {
        if (expirationMode === 'legacy') {
          // TODO legacy messages support will be removed in a future release
          return false;
        }
        // v2 is live, this is a private chat and a change we made, set the setting to what was given, otherwise discard it
        this.set({
          expirationMode,
          expireTimer,
        });
      }
    } else {
      // v2 is not live, we apply the setting we get blindly
      this.set({
        expirationMode,
        expireTimer,
      });
    }

    if (!shouldAddExpireUpdateMessage) {
      await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());

      if (shouldCommitConvo) {
        // tell the UI this conversation was updated
        await this.commit();
      }
      return false;
    }

    let message = existingMessage || undefined;
    const expirationType = DisappearingMessages.changeToDisappearingMessageType(
      this,
      expireTimer,
      expirationMode
    );

    const commonAttributes = {
      flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expirationType,
        expireTimer,
        source,
        fromSync,
      },
    };

    if (!message) {
      if (!receivedAt) {
        // outgoing message
        message = await this.addSingleOutgoingMessage({
          ...commonAttributes,
          sent_at: timestamp,
        });
      } else {
        message = await this.addSingleIncomingMessage({
          ...commonAttributes,
          // Even though this isn't reflected to the user, we want to place the last seen indicator above it. We set it to 'unread' to trigger that placement.
          unread: READ_MESSAGE_STATE.unread,
          source,
          sent_at: timestamp,
          received_at: timestamp,
        });
      }
    }

    // Note: we agreed that a closed group ControlMessage message does not expire.
    message.set({
      expirationType: this.isClosedGroup() ? 'unknown' : expirationType,
      expireTimer: this.isClosedGroup() ? 0 : expireTimer,
    });

    if (!message.get('id')) {
      message.set({ id: v4() });
    }

    if (this.isActive()) {
      this.set('active_at', timestamp);
    }

    if (shouldCommitConvo) {
      // tell the UI this conversation was updated
      await this.commit();
    }

    // if change was made remotely, don't send it to the contact/group
    if (isRemoteChange) {
      window.log.debug(
        `[updateExpireTimer] remote change, not sending message again. receivedAt: ${receivedAt} fromSync: ${fromSync} fromCurrentDevice: ${fromCurrentDevice} for ${ed25519Str(
          this.id
        )}`
      );

      if (!message.getExpirationStartTimestamp()) {
        // Note: we agreed that a closed group ControlMessage message does not expire.

        const canBeDeleteAfterSend = this.isMe() || !(this.isGroup() && message.isControlMessage());
        if (
          (canBeDeleteAfterSend && expirationMode === 'legacy') ||
          expirationMode === 'deleteAfterSend'
        ) {
          message.set({
            expirationStartTimestamp: DisappearingMessages.setExpirationStartTimestamp(
              expirationMode,
              message.get('sent_at'),
              'updateExpireTimer() remote change',
              message.get('id')
            ),
          });
        }
      }
      await message.commit();

      await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());
      return true;
    }
    await message.commit();

    await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());
    //
    // Below is the "sending the update to the conversation" part.
    // We would have returned if that message sending part was not needed
    //
    const expireUpdate = {
      identifier: message.id,
      timestamp,
      expirationType,
      expireTimer,
    };

    if (this.isMe()) {
      if (expireUpdate.expirationType === 'deleteAfterRead') {
        window.log.info('Note to Self messages cannot be delete after read!');
        return true;
      }

      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);

      await message?.sendSyncMessageOnly(expirationTimerMessage);
      return true;
    }

    if (this.isPrivate()) {
      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);

      const pubkey = new PubKey(this.get('id'));
      await getMessageQueue().sendToPubKey(
        pubkey,
        expirationTimerMessage,
        SnodeNamespaces.UserMessages
      );
      return true;
    }
    if (this.isClosedGroup()) {
      if (this.isAdmin(UserUtils.getOurPubKeyStrFromCache())) {
        // NOTE: we agreed that outgoing ExpirationTimerUpdate **for groups** are not expiring,
        // but they still need the content to be right(as this is what we use for the change itself)

        const expireUpdateForGroup = {
          ...expireUpdate,
          groupId: this.get('id'),
        };

        const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdateForGroup);

        await getMessageQueue().sendToGroup({
          message: expirationTimerMessage,
          namespace: SnodeNamespaces.ClosedGroupMessage,
        });
        return true;
      }
      window.log.warn(
        'tried to send a disappear update but we are not the creator of that legacy group... Cancelling'
      );
      return false;
    }
    throw new Error('Communities should not use disappearing messages');
  }

  public triggerUIRefresh() {
    updatesToDispatch.set(this.id, this.getConversationModelProps());
    throttledAllConversationsDispatch();
  }

  public async commit() {
    perfStart(`conversationCommit-${this.id}`);
    await commitConversationAndRefreshWrapper(this.id);
    perfEnd(`conversationCommit-${this.id}`, 'conversationCommit');
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
      unread: READ_MESSAGE_STATE.read, // an outgoing message must be already read
      received_at: messageAttributes.sent_at, // make sure to set a received_at timestamp for an outgoing message, so the order are right.
    });
  }

  public async addSingleIncomingMessage(
    messageAttributes: Omit<MessageAttributesOptionals, 'conversationId' | 'type' | 'direction'>
  ) {
    // if there's a message by the other user, they've replied to us which we consider an accepted convo
    if (this.isPrivate()) {
      await this.setDidApproveMe(true);
    }

    const toBeAddedAttributes: MessageAttributesOptionals = {
      unread: READ_MESSAGE_STATE.unread, // an incoming is by default unread, unless  messageAttributes or markAttributesAsReadIfNeeded marks it as read
      ...messageAttributes,
      conversationId: this.id,
      type: 'incoming',
      direction: 'incoming',
    };

    // if the message is trying to be added unread, make sure that it shouldn't be already read from our other devices
    markAttributesAsReadIfNeeded(toBeAddedAttributes);
    return this.addSingleMessage(toBeAddedAttributes);
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
    const expireTimerSet = !!this.getExpireTimer();
    const isOpenGroup = this.isOpenGroupV2();

    if (isOpenGroup || !expireTimerSet) {
      // for opengroups, we batch everything as there is no expiration timer to take care of (and potentially a lot of messages)

      // if this is an opengroup there is no need to send read receipt, and so no need to fetch messages updated.
      const allReadMessagesIds = await Data.markAllAsReadByConversationNoExpiration(
        this.id,
        !isOpenGroup
      );

      await this.markAsUnread(false, false);
      await this.commit();
      if (allReadMessagesIds.length) {
        await this.sendReadReceiptsIfNeeded(uniq(allReadMessagesIds));
      }
      Notifications.clearByConversationID(this.id);
      window.inboxStore?.dispatch(markConversationFullyRead(this.id));

      return;
    }

    // otherwise, do it the slow and expensive way
    await this.markConversationReadBouncy({ newestUnreadDate: Date.now() });
  }

  public getUsInThatConversation() {
    const usInThatConversation =
      getUsBlindedInThatServer(this) || UserUtils.getOurPubKeyStrFromCache();
    return usInThatConversation;
  }

  public async sendReadReceiptsIfNeeded(timestamps: Array<number>) {
    if (!this.isPrivate() || !timestamps.length) {
      return;
    }
    const settingsReadReceiptEnabled = Storage.get(SettingsKey.settingsReadReceipt) || false;
    const sendReceipt =
      settingsReadReceiptEnabled && !this.isBlocked() && !this.isIncomingRequest();

    if (!sendReceipt) {
      return;
    }
    window?.log?.info(`Sending ${timestamps.length} read receipts.`);

    const receiptMessage = new ReadReceiptMessage({
      timestamp: Date.now(),
      timestamps,
    });

    const device = new PubKey(this.id);
    await getMessageQueue().sendToPubKey(device, receiptMessage, SnodeNamespaces.UserMessages);
  }

  public async setNickname(nickname: string | null, shouldCommit = false) {
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

    if (shouldCommit) {
      await this.commit();
    }
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
    return this.isPrivate() ? this.get('nickname') || undefined : undefined;
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

    const groupModerators = getModeratorsOutsideRedux(this.id as string);
    return Array.isArray(groupModerators) && groupModerators.includes(pubKey);
  }

  /**
   * When receiving a shared config message, we need to apply the change after the merge happened to our database.
   * This is done with this function.
   * There are other actions to change the priority from the UI (or from )
   */
  public async setPriorityFromWrapper(
    priority: number,
    shouldCommit: boolean = true
  ): Promise<boolean> {
    if (priority !== this.get('priority')) {
      this.set({
        priority,
      });

      if (shouldCommit) {
        await this.commit();
      }
      return true;
    }
    return false;
  }

  /**
   * Toggle the pinned state of a conversation.
   * Any conversation can be pinned and the higher the priority, the higher it will be in the list.
   * Note: Currently, we do not have an order in the list of pinned conversation, but the libsession util wrapper can handle the order.
   */
  public async togglePinned(shouldCommit: boolean = true) {
    this.set({ priority: this.isPinned() ? 0 : 1 });
    if (shouldCommit) {
      await this.commit();
    }
    return true;
  }

  /**
   * Force the priority to be -1 (PRIORITY_DEFAULT_HIDDEN) so this conversation is hidden in the list. Currently only works for private chats.
   */
  public async setHidden(shouldCommit: boolean = true) {
    if (!this.isPrivate()) {
      return;
    }
    const priority = this.get('priority');
    if (priority >= CONVERSATION_PRIORITIES.default) {
      this.set({ priority: CONVERSATION_PRIORITIES.hidden });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  /**
   * Reset the priority of this conversation to 0 if it was < 0, but keep anything > 0 as is.
   * So if the conversation was pinned, we keep it pinned with its current priority.
   * A pinned cannot be hidden, as the it is all based on the same priority values.
   */
  public async unhideIfNeeded(shouldCommit: boolean = true) {
    const priority = this.get('priority');
    if (isFinite(priority) && priority < CONVERSATION_PRIORITIES.default) {
      this.set({ priority: CONVERSATION_PRIORITIES.default });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public async markAsUnread(forcedValue: boolean, shouldCommit: boolean = true) {
    if (!!forcedValue !== this.isMarkedUnread()) {
      this.set({
        markedAsUnread: !!forcedValue,
      });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public isMarkedUnread(): boolean {
    return !!this.get('markedAsUnread');
  }

  public async updateBlocksSogsMsgReqsTimestamp(
    blocksSogsMsgReqsTimestamp: number,
    shouldCommit: boolean = true
  ) {
    if (!PubKey.isBlinded(this.id)) {
      return; // this thing only applies to sogs blinded conversations
    }

    if (
      (isNil(this.get('blocksSogsMsgReqsTimestamp')) && !isNil(blocksSogsMsgReqsTimestamp)) ||
      (blocksSogsMsgReqsTimestamp === 0 && this.get('blocksSogsMsgReqsTimestamp') !== 0) ||
      blocksSogsMsgReqsTimestamp > this.get('blocksSogsMsgReqsTimestamp')
    ) {
      this.set({
        blocksSogsMsgReqsTimestamp,
      });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public blocksSogsMsgReqsTimestamp(): number {
    if (!PubKey.isBlinded(this.id)) {
      return 0; // this thing only applies to sogs blinded conversations
    }
    return this.get('blocksSogsMsgReqsTimestamp') || 0;
  }

  /**
   * Mark a private conversation as approved to the specified value.
   * Does not do anything on non private chats.
   */
  public async setIsApproved(value: boolean, shouldCommit: boolean = true) {
    const valueForced = Boolean(value);

    if (!this.isPrivate()) {
      return;
    }

    if (valueForced !== Boolean(this.isApproved())) {
      window?.log?.info(`Setting ${ed25519Str(this.id)} isApproved to: ${value}`);
      this.set({
        isApproved: valueForced,
      });

      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  /**
   * Mark a private conversation as approved_me to the specified value
   * Does not do anything on non private chats.
   */
  public async setDidApproveMe(value: boolean, shouldCommit: boolean = true) {
    if (!this.isPrivate()) {
      return;
    }
    const valueForced = Boolean(value);
    if (valueForced !== Boolean(this.didApproveMe())) {
      window?.log?.info(`Setting ${ed25519Str(this.id)} didApproveMe to: ${value}`);
      this.set({
        didApproveMe: valueForced,
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

  /**
   * Save the pollInfo to the Database or to the in memory redux slice depending on the data.
   * things stored to the redux slice of the sogs (ReduxSogsRoomInfos)  are:
   * - subscriberCount
   * - canWrite
   * - moderators
   *
   * things stored in the database are
   * - admins (as they are also stored for groups we just reuse the same field, saved in the DB for now)
   * - display name of that room
   *
   * This function also triggers the download of the new avatar if needed.
   *
   * Does not do anything for non public chats.
   */

  public async setPollInfo(infos?: {
    active_users: number;
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
    if (!this.isPublic()) {
      return;
    }
    if (!infos || isEmpty(infos)) {
      return;
    }
    const { write, active_users, details } = infos;

    if (
      isFinite(infos.active_users) &&
      infos.active_users !== 0 &&
      getSubscriberCountOutsideRedux(this.id) !== active_users
    ) {
      ReduxSogsRoomInfos.setSubscriberCountOutsideRedux(this.id, active_users);
    }

    if (getCanWriteOutsideRedux(this.id) !== !!write) {
      ReduxSogsRoomInfos.setCanWriteOutsideRedux(this.id, !!write);
    }

    let hasChange = await this.handleSogsModsOrAdminsChanges({
      modsOrAdmins: details.admins,
      hiddenModsOrAdmins: details.hidden_admins,
      type: 'admins',
    });

    const modsChanged = await this.handleSogsModsOrAdminsChanges({
      modsOrAdmins: details.moderators,
      hiddenModsOrAdmins: details.hidden_moderators,
      type: 'mods',
    });

    if (details.name && details.name !== this.getRealSessionUsername()) {
      hasChange = hasChange || true;
      this.setSessionDisplayNameNoCommit(details.name);
    }

    hasChange = hasChange || modsChanged;

    if (this.isPublic() && details.image_id && isNumber(details.image_id)) {
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
  public async setProfileKey(profileKey?: Uint8Array, shouldCommit = true) {
    if (!profileKey) {
      return;
    }

    const profileKeyHex = toHex(profileKey);

    // profileKey is a string so we can compare it directly
    if (this.get('profileKey') !== profileKeyHex) {
      this.set({
        profileKey: profileKeyHex,
      });

      if (shouldCommit) {
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
    }
    return true;
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
    const priority = this.get('priority');

    return isFinite(priority) && priority > CONVERSATION_PRIORITIES.default;
  }

  public didApproveMe() {
    return Boolean(this.get('didApproveMe'));
  }

  public isApproved() {
    return Boolean(this.get('isApproved'));
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
    const isLegacyGroup = this.isClosedGroup() && this.id.startsWith('05');

    let friendRequestText;
    // NOTE: legacy groups are never approved, so we should not cancel notifications
    if (!this.isApproved() && !isLegacyGroup) {
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
        (await Data.getMessagesByConversation(this.id, { messageId: null })).messages.length === 1;
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
      message: friendRequestText || message.getNotificationText(),
      messageId,
      messageSentAt,
      title: friendRequestText ? '' : convo.getNicknameOrRealUsernameOrPlaceholder(),
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
      ? // eslint-disable-next-line @typescript-eslint/no-misused-promises
        global.setTimeout(this.clearContactTypingTimer.bind(this, sender), 15 * 1000)
      : null;
  }

  /**
   * This call is not debounced and can be quite heavy, so only call it when handling config messages updates
   */
  public async markReadFromConfigMessage(newestUnreadDate: number) {
    return this.markConversationReadBouncy({ newestUnreadDate, fromConfigMessage: true });
  }

  private async sendMessageJob(message: MessageModel) {
    try {
      const { body, attachments, preview, quote, fileIdsToLink } = await message.uploadData();
      const { id } = message;
      const destination = this.id;

      const sentAt = message.get('sent_at');
      if (!sentAt) {
        throw new Error('sendMessageJob() sent_at must be set.');
      }

      // we are trying to send a message to someone. Make sure this convo is not hidden
      await this.unhideIfNeeded(true);

      // an OpenGroupV2 message is just a visible message
      const chatMessageParams: VisibleMessageParams = {
        body,
        identifier: id,
        timestamp: sentAt,
        attachments,
        expirationType: message.getExpirationType() ?? 'unknown', // Note we assume that the caller used a setting allowed for that conversation when building it. Here we just send it.
        expireTimer: message.getExpireTimerSeconds(),
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

      if (PubKey.isBlinded(this.id)) {
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
        await getMessageQueue().sendToOpenGroupV2({
          message: chatMessageOpenGroupV2,
          roomInfos,
          blinded: Boolean(roomHasBlindEnabled(openGroup)),
          filesToLink: fileIdsToLink,
        });
        return;
      }

      const destinationPubkey = new PubKey(destination);

      if (this.isPrivate()) {
        if (this.isMe()) {
          if (this.matchesDisappearingMode('deleteAfterRead')) {
            throw new Error('Note to Self disappearing messages must be deleteAterSend');
          }
          chatMessageParams.syncTarget = this.id;
          const chatMessageMe = new VisibleMessage(chatMessageParams);

          await getMessageQueue().sendSyncMessage({
            namespace: SnodeNamespaces.UserMessages,
            message: chatMessageMe,
          });
          return;
        }

        if (message.get('groupInvitation')) {
          const groupInvitation = message.get('groupInvitation');
          const groupInviteMessage = new GroupInvitationMessage({
            identifier: id,
            timestamp: sentAt,
            name: groupInvitation.name,
            url: groupInvitation.url,
            expirationType: chatMessageParams.expirationType,
            expireTimer: chatMessageParams.expireTimer,
          });
          // we need the return await so that errors are caught in the catch {}
          await getMessageQueue().sendToPubKey(
            destinationPubkey,
            groupInviteMessage,
            SnodeNamespaces.UserMessages
          );
          return;
        }
        const chatMessagePrivate = new VisibleMessage(chatMessageParams);
        await getMessageQueue().sendToPubKey(
          destinationPubkey,
          chatMessagePrivate,
          SnodeNamespaces.UserMessages
        );
        return;
      }

      if (this.isClosedGroup()) {
        if (this.matchesDisappearingMode('deleteAfterRead')) {
          throw new Error('Group disappearing messages must be deleteAterSend');
        }
        const chatMessageMediumGroup = new VisibleMessage(chatMessageParams);
        const closedGroupVisibleMessage = new ClosedGroupVisibleMessage({
          chatMessage: chatMessageMediumGroup,
          groupId: destinationPubkey,
          timestamp: sentAt,
          // expirationType & expireTimer are part of the chatMessageMediumGroup object
        });

        // we need the return await so that errors are caught in the catch {}
        await getMessageQueue().sendToGroup({
          message: closedGroupVisibleMessage,
          namespace: SnodeNamespaces.ClosedGroupMessage,
        });
        return;
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e) {
      await message.saveErrors(e);
    }
  }

  private async sendBlindedMessageRequest(messageParams: VisibleMessageParams) {
    const ourSignKeyBytes = await UserUtils.getUserED25519KeyPairBytes();
    const groupUrl = this.getSogsOriginMessage();

    if (!PubKey.isBlinded(this.id)) {
      window?.log?.warn('sendBlindedMessageRequest - convo is not a blinded one');
      return;
    }

    if (!messageParams.body) {
      window?.log?.warn('sendBlindedMessageRequest - needs a body');
      return;
    }

    // include our profile (displayName + avatar url + key for the recipient)
    // eslint-disable-next-line no-param-reassign
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
    // TODO we need to add support for sending blinded25 message request in addition to the legacy blinded15
    await getMessageQueue().sendToOpenGroupV2BlindedRequest({
      encryptedContent: encryptedMsg,
      roomInfos: roomInfo,
      message: sogsVisibleMessage,
      recipientBlindedId: this.id,
    });
  }

  // tslint:disable-next-line cyclomatic-complexity
  private async bouncyUpdateLastMessage() {
    if (!this.id || !this.get('active_at') || this.isHidden()) {
      return;
    }
    const messages = await Data.getLastMessagesByConversation(this.id, 1, true);
    const existingLastMessageAttribute = this.get('lastMessage');
    const existingLastMessageStatus = this.get('lastMessageStatus');
    if (!messages || !messages.length) {
      if (existingLastMessageAttribute || existingLastMessageStatus) {
        this.set({
          lastMessageStatus: undefined,
          lastMessage: undefined,
        });
        await this.commit();
      }
      return;
    }
    const lastMessageModel = messages.at(0);
    const interactionNotification = lastMessageModel.getInteractionNotification();

    const lastMessageInteractionType = interactionNotification?.interactionType;
    const lastMessageInteractionStatus =
      lastMessageModel.getInteractionNotification()?.interactionStatus;
    const lastMessageStatus = lastMessageModel.getMessagePropStatus() || undefined;
    const lastMessageNotificationText = lastMessageModel.getNotificationText() || undefined;
    // we just want to set the `status` to `undefined` if there are no `lastMessageNotificationText`
    const lastMessageUpdate =
      !!lastMessageNotificationText && !isEmpty(lastMessageNotificationText)
        ? {
            lastMessage: lastMessageNotificationText || '',
            lastMessageStatus,
            lastMessageInteractionType,
            lastMessageInteractionStatus,
          }
        : {
            lastMessage: '',
            lastMessageStatus: undefined,
            lastMessageInteractionType: undefined,
            lastMessageInteractionStatus: undefined,
          };
    const existingLastMessageInteractionType = this.get('lastMessageInteractionType');
    const existingLastMessageInteractionStatus = this.get('lastMessageInteractionStatus');

    if (
      lastMessageUpdate.lastMessage !== existingLastMessageAttribute ||
      lastMessageUpdate.lastMessageStatus !== existingLastMessageStatus ||
      lastMessageUpdate.lastMessageInteractionType !== existingLastMessageInteractionType ||
      lastMessageUpdate.lastMessageInteractionStatus !== existingLastMessageInteractionStatus
    ) {
      if (
        lastMessageUpdate.lastMessageStatus === existingLastMessageStatus &&
        lastMessageUpdate.lastMessageInteractionType === existingLastMessageInteractionType &&
        lastMessageUpdate.lastMessageInteractionStatus === existingLastMessageInteractionStatus &&
        lastMessageUpdate.lastMessage &&
        lastMessageUpdate.lastMessage.length > 40 &&
        existingLastMessageAttribute &&
        existingLastMessageAttribute.length > 40 &&
        lastMessageUpdate.lastMessage.startsWith(existingLastMessageAttribute)
      ) {
        // if status is the same, and text has a long length which starts with the db status, do not trigger an update.
        // we only store the first 60 chars in the db for the lastMessage attributes (see sql.ts)
        return;
      }
      this.set({
        ...lastMessageUpdate,
      });
      await this.commit();
    }
  }

  private async markConversationReadBouncy({
    newestUnreadDate,
    fromConfigMessage = false,
  }: {
    newestUnreadDate: number;
    fromConfigMessage?: boolean;
  }) {
    const readAt = Date.now();
    const conversationId = this.id;
    Notifications.clearByConversationID(conversationId);

    const oldUnreadNowRead = (await this.getUnreadByConversation(newestUnreadDate)).models;

    if (!oldUnreadNowRead.length) {
      // no new messages where read, no need to do anything
      return;
    }

    // Build the list of updated message models so we can mark them all as read on a single sqlite call
    const readDetails = [];
    const msgsIdsToUpdateExpireOnSwarm: Array<string> = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const nowRead of oldUnreadNowRead) {
      const shouldUpdateSwarmExpiry = nowRead.markMessageReadNoCommit(readAt);
      if (shouldUpdateSwarmExpiry) {
        msgsIdsToUpdateExpireOnSwarm.push(nowRead.get('id') as string);
      }

      const sentAt = nowRead.get('sent_at') || nowRead.get('serverTimestamp');
      if (nowRead.get('source') && sentAt && isFinite(sentAt)) {
        readDetails.push({
          sender: nowRead.get('source'),
          timestamp: sentAt,
        });
      }
    }

    if (!isEmpty(msgsIdsToUpdateExpireOnSwarm)) {
      if (fromConfigMessage) {
        // when we mark a message as read through a convo volatile update,
        // it means those messages have already an up to date expiry on the server side
        // so we can just fetch those expiries for all the hashes we are marking as read, and trust it.
        await FetchMsgExpirySwarm.queueNewJobIfNeeded(msgsIdsToUpdateExpireOnSwarm);
      } else {
        await UpdateMsgExpirySwarm.queueNewJobIfNeeded(msgsIdsToUpdateExpireOnSwarm);
      }
    }
    // save all the attributes in a single call
    await Data.saveMessages(oldUnreadNowRead.map(m => m.attributes));
    // trigger all the ui updates in a single call
    window.inboxStore?.dispatch(
      conversationActions.messagesChanged(oldUnreadNowRead.map(m => m.getMessageModelProps()))
    );

    await this.commit();

    if (readDetails.length) {
      const us = UserUtils.getOurPubKeyStrFromCache();
      const timestamps = readDetails.filter(m => m.sender !== us).map(m => m.timestamp);
      await this.sendReadReceiptsIfNeeded(timestamps);
    }
  }

  private async getUnreadByConversation(sentBeforeTs: number) {
    return Data.getUnreadByConversation(this.id, sentBeforeTs);
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
    // eslint-disable-next-line no-bitwise
    const flags = (messageAttributes?.flags || 0) | (voiceMessageFlags || 0);
    const model = new MessageModel({
      ...messageAttributes,
      flags,
    });

    // no need to trigger a UI update now, we trigger a messagesAdded just below
    const messageId = await model.commit(false);
    model.set({ id: messageId });

    await model.setToExpire();

    const messageModelProps = model.getMessageModelProps();
    window.inboxStore?.dispatch(conversationActions.messagesChanged([messageModelProps]));
    this.updateLastMessage();

    await this.commit();
    return model;
  }

  private async clearContactTypingTimer(_sender: string) {
    if (this.typingTimer) {
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
    // we can only send typing messages to approved contacts
    if (!this.isPrivate() || this.isMe() || !this.isApproved()) {
      return;
    }

    const recipientId = this.id as string;

    if (isEmpty(recipientId)) {
      throw new Error('Need to provide either recipientId');
    }

    const typingParams = {
      timestamp: GetNetworkTime.getNowWithNetworkOffset(),
      isTyping,
      typingTimestamp: GetNetworkTime.getNowWithNetworkOffset(),
    };
    const typingMessage = new TypingMessage(typingParams);

    const device = new PubKey(recipientId);
    void getMessageQueue()
      .sendToPubKey(device, typingMessage, SnodeNamespaces.UserMessages)
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

  private async handleSogsModsOrAdminsChanges({
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

      switch (type) {
        case 'admins':
          return this.updateGroupAdmins(replacedWithOurRealSessionId, false);
        case 'mods':
          ReduxSogsRoomInfos.setModeratorsOutsideRedux(this.id, replacedWithOurRealSessionId);
          return false;
        default:
          assertUnreachable(type, `handleSogsModsOrAdminsChanges: unhandled switch case: ${type}`);
      }
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

  private matchesDisappearingMode(mode: DisappearingMessageConversationModeType) {
    const ours = this.getExpirationMode();
    // Note: couldn't this be ours === mode with a twist maybe?
    const success =
      mode === 'deleteAfterRead'
        ? ours === 'deleteAfterRead'
        : mode === 'deleteAfterSend'
          ? ours === 'deleteAfterSend'
          : mode === 'off'
            ? ours === 'off'
            : false;

    return success;
  }

  // NOTE We want to replace Backbone .get() calls with these getters as we migrate to Redux completely eventually
  // #region Start of getters
  public getExpirationMode() {
    return this.get('expirationMode');
  }

  public getExpireTimer() {
    return this.get('expireTimer');
  }

  public getHasOutdatedClient() {
    return this.get('hasOutdatedClient');
  }

  // #endregion
}

export async function commitConversationAndRefreshWrapper(id: string) {
  const convo = getConversationController().get(id);
  if (!convo) {
    return;
  }

  // TODOLATER remove duplicates between db and wrapper (and move search by name or nickname to wrapper)
  // TODOLATER insertConvoFromDBIntoWrapperAndRefresh and insertContactFromDBIntoWrapperAndRefresh both fetches the same data from the DB. Might be worth fetching it and providing it to both?

  // write to db
  const savedDetails = await Data.saveConversation(convo.attributes);
  await convo.refreshInMemoryDetails(savedDetails);

  // Performance impact on this is probably to be pretty bad. We might want to push for that DB refactor to be done sooner so we do not need to fetch info from the DB anymore
  for (let index = 0; index < LibSessionUtil.requiredUserVariants.length; index++) {
    const variant = LibSessionUtil.requiredUserVariants[index];

    switch (variant) {
      case 'UserConfig':
        if (SessionUtilUserProfile.isUserProfileToStoreInWrapper(convo.id)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilUserProfile.insertUserProfileIntoWrapper(convo.id);
        }
        break;
      case 'ContactsConfig':
        if (SessionUtilContact.isContactToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilContact.insertContactFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      case 'UserGroupsConfig':
        if (SessionUtilUserGroups.isUserGroupToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilUserGroups.insertGroupsFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      case 'ConvoInfoVolatileConfig':
        if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilConvoInfoVolatile.insertConvoFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      default:
        assertUnreachable(
          variant,
          `commitConversationAndRefreshWrapper unhandled case "${variant}"`
        );
    }
  }

  if (Registration.isDone()) {
    // save the new dump if needed to the DB asap
    // this call throttled so we do not run this too often (and not for every .commit())
    await ConfigurationSync.queueNewJobIfNeeded();
  }
  convo.triggerUIRefresh();
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

export function hasValidOutgoingRequestValues({
  isMe,
  didApproveMe,
  isApproved,
  isBlocked,
  isPrivate,
  activeAt,
}: {
  isMe: boolean;
  isApproved: boolean;
  didApproveMe: boolean;
  isBlocked: boolean;
  isPrivate: boolean;
  activeAt: number;
}): boolean {
  const isActive = activeAt && isFinite(activeAt) && activeAt > 0;

  return Boolean(!isMe && isApproved && isPrivate && !isBlocked && !didApproveMe && isActive);
}

/**
 * Method to evaluate if a convo contains the right values
 * @param values Required properties to evaluate if this is a message request
 */
export function hasValidIncomingRequestValues({
  isMe,
  isApproved,
  isBlocked,
  isPrivate,
  activeAt,
  didApproveMe,
}: {
  isMe: boolean;
  isApproved: boolean;
  isBlocked: boolean;
  isPrivate: boolean;
  didApproveMe: boolean;
  activeAt: number;
}): boolean {
  // if a convo is not active, it means we didn't get any messages nor sent any.
  const isActive = activeAt && isFinite(activeAt) && activeAt > 0;
  return Boolean(isPrivate && !isMe && !isApproved && !isBlocked && isActive && didApproveMe);
}

async function cleanUpExpireHistoryFromConvo(conversationId: string, isPrivate: boolean) {
  const updateIdsRemoved = await Data.cleanUpExpirationTimerUpdateHistory(
    conversationId,
    isPrivate
  );
  window?.inboxStore?.dispatch(
    messagesDeleted(updateIdsRemoved.map(m => ({ conversationKey: conversationId, messageId: m })))
  );
}

export const Conversation = { cleanUpExpireHistoryFromConvo };
