import { queueAttachmentDownloads } from './attachments';

import _ from 'lodash';
import { Data } from '../../ts/data/data';
import { ConversationModel } from '../models/conversation';
import { MessageModel } from '../models/message';
import { getConversationController } from '../session/conversations';
import { Quote } from './types';

import { ConversationTypeEnum, READ_MESSAGE_STATE } from '../models/conversationAttributes';
import { MessageDirection } from '../models/messageType';
import { SignalService } from '../protobuf';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { showMessageRequestBannerOutsideRedux } from '../state/ducks/userConfig';
import { getHideMessageRequestBannerOutsideRedux } from '../state/selectors/userConfig';
import { GoogleChrome } from '../util';
import { LinkPreviews } from '../util/linkPreviews';
import { ReleasedFeatures } from '../util/releaseFeature';

function contentTypeSupported(type: string): boolean {
  const Chrome = GoogleChrome;
  return Chrome.isImageTypeSupported(type) || Chrome.isVideoTypeSupported(type);
}

/**
 * Note: this function does not trigger a write to the db nor trigger redux update.
 * You have to call msg.commit() once you are done with the handling of this message
 */
async function copyFromQuotedMessage(
  // tslint:disable-next-line: cyclomatic-complexity
  msg: MessageModel,
  quote?: SignalService.DataMessage.IQuote | null
): Promise<void> {
  if (!quote) {
    return;
  }
  const { attachments, id: quoteId, author } = quote;

  const quoteLocal: Quote = {
    attachments: attachments || null,
    author: author,
    id: _.toNumber(quoteId),
    text: null,
    referencedMessageNotFound: false,
  };

  const firstAttachment = attachments?.[0] || undefined;

  const id = _.toNumber(quoteId);

  // We always look for the quote by sentAt timestamp, for opengroups, closed groups and session chats
  // this will return an array of sent message by id we have locally.

  const collection = await Data.getMessagesBySentAt(id);
  // we now must make sure this is the sender we expect
  const found = collection.find(message => {
    return Boolean(author === message.get('source'));
  });

  if (!found) {
    window?.log?.warn(`We did not found quoted message ${id} with author ${author}.`);
    quoteLocal.referencedMessageNotFound = true;
    msg.set({ quote: quoteLocal });
    return;
  }

  window?.log?.info(`Found quoted message id: ${id}`);
  quoteLocal.referencedMessageNotFound = false;
  // NOTE we send the entire body to be consistent with the other platforms
  quoteLocal.text = found.get('body') || '';

  // no attachments, just save the quote with the body
  if (
    !firstAttachment ||
    !firstAttachment.contentType ||
    !contentTypeSupported(firstAttachment.contentType)
  ) {
    msg.set({ quote: quoteLocal });
    return;
  }

  firstAttachment.thumbnail = null;

  const queryAttachments = found.get('attachments') || [];

  if (queryAttachments.length > 0) {
    const queryFirst = queryAttachments[0];
    const { thumbnail } = queryFirst;

    if (thumbnail && thumbnail.path) {
      firstAttachment.thumbnail = {
        ...thumbnail,
        copied: true,
      };
    }
  }

  const queryPreview = found.get('preview') || [];
  if (queryPreview.length > 0) {
    const queryFirst = queryPreview[0];
    const { image } = queryFirst;

    if (image && image.path) {
      firstAttachment.thumbnail = {
        ...image,
        copied: true,
      };
    }
  }
  quoteLocal.attachments = [firstAttachment];

  msg.set({ quote: quoteLocal });
}

/**
 * Note: This does not trigger a redux update, nor write to the DB
 */
function handleLinkPreviews(messageBody: string, messagePreview: any, message: MessageModel) {
  const urls = LinkPreviews.findLinks(messageBody);
  const incomingPreview = messagePreview || [];
  const preview = incomingPreview.filter(
    (item: any) => (item.image || item.title) && urls.includes(item.url)
  );
  if (preview.length < incomingPreview.length) {
    window?.log?.info(
      `${message.idForLogging()}: Eliminated ${preview.length -
        incomingPreview.length} previews with invalid urls'`
    );
  }

  message.set({ preview });
}

async function processProfileKeyNoCommit(
  conversation: ConversationModel,
  sendingDeviceConversation: ConversationModel,
  profileKeyBuffer?: Uint8Array
) {
  if (conversation.isPrivate()) {
    await conversation.setProfileKey(profileKeyBuffer, false);
  } else {
    await sendingDeviceConversation.setProfileKey(profileKeyBuffer, false);
  }
}

function updateReadStatus(message: MessageModel) {
  if (message.isExpirationTimerUpdate()) {
    message.set({ unread: READ_MESSAGE_STATE.read });
  }
}

function handleSyncedReceiptsNoCommit(message: MessageModel, conversation: ConversationModel) {
  // If the newly received message is from us, we assume that we've seen the messages up until that point
  const sentTimestamp = message.get('sent_at');
  if (sentTimestamp) {
    conversation.markConversationRead(sentTimestamp);
  }
}

export type RegularMessageType = Pick<
  SignalService.DataMessage,
  | 'attachments'
  | 'body'
  | 'flags'
  | 'openGroupInvitation'
  | 'quote'
  | 'preview'
  | 'reaction'
  | 'profile'
  | 'profileKey'
  | 'expireTimer'
> & { isRegularMessage: true };

/**
 * This function is just used to make sure we do not forward things we shouldn't in the incoming message pipeline
 */
export function toRegularMessage(rawDataMessage: SignalService.DataMessage): RegularMessageType {
  return {
    ..._.pick(rawDataMessage, [
      'attachments',
      'preview',
      'reaction',
      'body',
      'flags',
      'profileKey',
      'openGroupInvitation',
      'quote',
      'profile',
      'expireTimer',
    ]),
    isRegularMessage: true,
  };
}

async function handleRegularMessage(
  conversation: ConversationModel,
  sendingDeviceConversation: ConversationModel,
  message: MessageModel,
  rawDataMessage: RegularMessageType,
  source: string,
  messageHash: string
): Promise<void> {
  const type = message.get('type');
  // this does not trigger a UI update nor write to the db
  await copyFromQuotedMessage(message, rawDataMessage.quote);

  if (rawDataMessage.openGroupInvitation) {
    message.set({ groupInvitation: rawDataMessage.openGroupInvitation });
  }

  handleLinkPreviews(rawDataMessage.body, rawDataMessage.preview, message);
  const existingExpireTimer = conversation.get('expireTimer');

  message.set({
    flags: rawDataMessage.flags,
    // quote: rawDataMessage.quote, // do not do this copy here, it must be done only in copyFromQuotedMessage()
    attachments: rawDataMessage.attachments,
    body: rawDataMessage.body,
    conversationId: conversation.id,
    messageHash,
    errors: [],
  });

  if (existingExpireTimer) {
    message.set({ expireTimer: existingExpireTimer });
  }

  // Expire timer updates are now explicit.
  // We don't handle an expire timer from a incoming message except if it is an ExpireTimerUpdate message.

  if (type === 'incoming') {
    if (conversation.isPrivate()) {
      updateReadStatus(message);
      const incomingMessageCount = await Data.getMessageCountByType(
        conversation.id,
        MessageDirection.incoming
      );
      const isFirstRequestMessage = incomingMessageCount < 2;
      if (
        conversation.isIncomingRequest() &&
        isFirstRequestMessage &&
        getHideMessageRequestBannerOutsideRedux()
      ) {
        showMessageRequestBannerOutsideRedux();
      }

      // For edge case when messaging a client that's unable to explicitly send request approvals
      if (conversation.isOutgoingRequest()) {
        // Conversation was not approved before so a sync is needed
        await conversation.addIncomingApprovalMessage(
          _.toNumber(message.get('sent_at')) - 1,
          source
        );
      }
      // should only occur after isOutgoing request as it relies on didApproveMe being false.
      await conversation.setDidApproveMe(true);
    }
  } else if (type === 'outgoing') {
    const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

    if (!userConfigLibsession) {
      // we want to do this for all types of conversations, not just private chats
      handleSyncedReceiptsNoCommit(message, conversation);

      if (conversation.isPrivate()) {
        await conversation.setIsApproved(true);
      }
    }
  }

  const conversationActiveAt = conversation.get('active_at');
  if (
    !conversationActiveAt ||
    conversation.isHidden() ||
    (message.get('sent_at') || 0) > conversationActiveAt
  ) {
    conversation.set({
      active_at: message.get('sent_at'),
      lastMessage: message.getNotificationText(),
    });
    // a new message was received for that conversation. If it was not it should not be hidden anymore
    await conversation.unhideIfNeeded(false);
  }

  if (rawDataMessage.profileKey) {
    await processProfileKeyNoCommit(
      conversation,
      sendingDeviceConversation,
      rawDataMessage.profileKey
    );
  }

  // we just received a message from that user so we reset the typing indicator for this convo
  await conversation.notifyTypingNoCommit({
    isTyping: false,
    sender: source,
  });
}

async function handleExpirationTimerUpdateNoCommit(
  conversation: ConversationModel,
  message: MessageModel,
  source: string,
  expireTimer: number
) {
  message.set({
    expirationTimerUpdate: {
      source,
      expireTimer,
    },
    unread: READ_MESSAGE_STATE.read, // mark the message as read.
  });
  conversation.set({ expireTimer });

  await conversation.updateExpireTimer(expireTimer, source, message.get('received_at'), {}, false);
}

function markConvoAsReadIfOutgoingMessage(conversation: ConversationModel, message: MessageModel) {
  const isOutgoingMessage =
    message.get('type') === 'outgoing' || message.get('direction') === 'outgoing';
  if (isOutgoingMessage) {
    const sentAt = message.get('sent_at') || message.get('serverTimestamp');
    if (sentAt) {
      conversation.markConversationRead(sentAt);
    }
  }
}

export async function handleMessageJob(
  messageModel: MessageModel,
  conversation: ConversationModel,
  regularDataMessage: RegularMessageType,
  confirm: () => void,
  source: string,
  messageHash: string
) {
  window?.log?.info(
    `Starting handleMessageJob for message ${messageModel.idForLogging()}, ${messageModel.get(
      'serverTimestamp'
    ) || messageModel.get('timestamp')} in conversation ${conversation.idForLogging()}`
  );

  const sendingDeviceConversation = await getConversationController().getOrCreateAndWait(
    source,
    ConversationTypeEnum.PRIVATE
  );
  try {
    messageModel.set({ flags: regularDataMessage.flags });
    if (messageModel.isExpirationTimerUpdate()) {
      const { expireTimer } = regularDataMessage;
      const oldValue = conversation.get('expireTimer');
      if (expireTimer === oldValue) {
        confirm?.();
        window?.log?.info(
          'Dropping ExpireTimerUpdate message as we already have the same one set.'
        );
        return;
      }
      await handleExpirationTimerUpdateNoCommit(conversation, messageModel, source, expireTimer);
    } else {
      // this does not commit to db nor UI unless we need to approve a convo
      await handleRegularMessage(
        conversation,
        sendingDeviceConversation,
        messageModel,
        regularDataMessage,
        source,
        messageHash
      );
    }

    // save the message model to the db and then save the messageId generated to our in-memory copy
    const id = await messageModel.commit();
    messageModel.set({ id });

    // Note that this can save the message again, if jobs were queued. We need to
    //   call it after we have an id for this message, because the jobs refer back
    //   to their source message.

    conversation.set({
      active_at: Math.max(conversation.get('active_at'), messageModel.get('sent_at') || 0),
    });
    // this is a throttled call and will only run once every 1 sec at most
    conversation.updateLastMessage();
    await conversation.commit();

    if (conversation.id !== sendingDeviceConversation.id) {
      await sendingDeviceConversation.commit();
    }

    void queueAttachmentDownloads(messageModel, conversation);
    // Check if we need to update any profile names
    // the only profile we don't update with what is coming here is ours,
    // as our profile is shared across our devices with a ConfigurationMessage
    if (messageModel.isIncoming() && regularDataMessage.profile) {
      await ProfileManager.updateProfileOfContact(
        sendingDeviceConversation.id,
        regularDataMessage.profile.displayName,
        regularDataMessage.profile.profilePicture,
        regularDataMessage.profileKey
      );
    }

    markConvoAsReadIfOutgoingMessage(conversation, messageModel);
    if (messageModel.get('unread')) {
      conversation.throttledNotify(messageModel);
    }
    confirm?.();
  } catch (error) {
    const errorForLog = error && error.stack ? error.stack : error;
    window?.log?.error('handleMessageJob', messageModel.idForLogging(), 'error:', errorForLog);
  }
}
