import { queueAttachmentDownloads } from './attachments';

import { Quote } from './types';
import { PubKey } from '../session/types';
import _ from 'lodash';
import { getConversationController } from '../session/conversations';
import { ConversationModel, ConversationTypeEnum } from '../models/conversation';
import { MessageModel } from '../models/message';
import { getMessageById, getMessagesBySentAt } from '../../ts/data/data';
import { MessageModelPropsWithoutConvoProps, messagesAdded } from '../state/ducks/conversations';
import { updateProfileOneAtATime } from './dataMessage';
import Long from 'long';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { showMessageRequestBanner } from '../state/ducks/userConfig';

function contentTypeSupported(type: string): boolean {
  const Chrome = window.Signal.Util.GoogleChrome;
  return Chrome.isImageTypeSupported(type) || Chrome.isVideoTypeSupported(type);
}

// tslint:disable-next-line: cyclomatic-complexity
async function copyFromQuotedMessage(msg: MessageModel, quote?: Quote): Promise<void> {
  if (!quote) {
    return;
  }

  const { attachments, id: quoteId, author } = quote;
  const firstAttachment = attachments[0];

  const id: number = Long.isLong(quoteId) ? quoteId.toNumber() : quoteId;

  // We always look for the quote by sentAt timestamp, for opengroups, closed groups and session chats
  // this will return an array of sent message by id we have locally.

  const collection = await getMessagesBySentAt(id);
  // we now must make sure this is the sender we expect
  const found = collection.find(message => {
    return Boolean(author === message.getSource());
  });

  if (!found) {
    window?.log?.warn(`We did not found quoted message ${id}.`);
    quote.referencedMessageNotFound = true;
    msg.set({ quote });
    await msg.commit();
    return;
  }

  window?.log?.info(`Found quoted message id: ${id}`);
  quote.referencedMessageNotFound = false;

  quote.text = found.get('body') || '';

  if (!firstAttachment || !contentTypeSupported(firstAttachment.contentType)) {
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
}

function handleLinkPreviews(messageBody: string, messagePreview: any, message: MessageModel) {
  const urls = window.Signal.LinkPreviews.findLinks(messageBody);
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

async function processProfileKey(
  conversation: ConversationModel,
  sendingDeviceConversation: ConversationModel,
  profileKeyBuffer?: Uint8Array
) {
  if (conversation.isPrivate()) {
    await conversation.setProfileKey(profileKeyBuffer);
  } else {
    await sendingDeviceConversation.setProfileKey(profileKeyBuffer);
  }
}

function handleMentions(
  message: MessageModel,
  conversation: ConversationModel,
  ourPrimaryNumber: PubKey
) {
  const body = message.get('body');
  if (body && body.indexOf(`@${ourPrimaryNumber.key}`) !== -1) {
    conversation.set({ mentionedUs: true });
  }
}

function updateReadStatus(message: MessageModel, conversation: ConversationModel) {
  const readSync = window.Whisper.ReadSyncs.forMessage(message);
  if (readSync) {
    const shouldExpire = message.get('expireTimer');
    const alreadyStarted = message.get('expirationStartTimestamp');
    if (shouldExpire && !alreadyStarted) {
      // Start message expiration timer
      const start = Math.min(readSync.get('read_at'), Date.now());
      message.set('expirationStartTimestamp', start);
    }
  }
  if (readSync || message.isExpirationTimerUpdate()) {
    message.set({ unread: 0 });

    // This is primarily to allow the conversation to mark all older
    // messages as read, as is done when we receive a read sync for
    // a message we already know about.
    void conversation.onReadMessage(message, Date.now());
  }
}

async function handleSyncedReceipts(message: MessageModel, conversation: ConversationModel) {
  const readReceipts = window.Whisper.ReadReceipts.forMessage(conversation, message);
  if (readReceipts.length) {
    const readBy = readReceipts.map((receipt: any) => receipt.get('reader'));
    message.set({
      read_by: _.union(message.get('read_by'), readBy),
    });
  }

  // A sync'd message to ourself is automatically considered read
  const recipients = conversation.getRecipients();
  if (conversation.isMe()) {
    message.set({
      read_by: recipients,
    });
  }

  message.set({ recipients });

  // If the newly received message is from us, we assume that we've seen the messages up until that point
  const sentTimestamp = message.get('sent_at');
  if (sentTimestamp) {
    await conversation.markRead(sentTimestamp);
  }
}

async function handleRegularMessage(
  conversation: ConversationModel,
  message: MessageModel,
  initialMessage: any,
  source: string,
  ourNumber: string,
  messageHash: string
) {
  const type = message.get('type');
  await copyFromQuotedMessage(message, initialMessage.quote);

  const dataMessage = initialMessage;

  const now = Date.now();

  if (dataMessage.openGroupInvitation) {
    message.set({ groupInvitation: dataMessage.openGroupInvitation });
  }

  handleLinkPreviews(dataMessage.body, dataMessage.preview, message);
  const existingExpireTimer = conversation.get('expireTimer');

  message.set({
    flags: dataMessage.flags,
    hasAttachments: dataMessage.hasAttachments,
    hasFileAttachments: dataMessage.hasFileAttachments,
    hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
    quote: dataMessage.quote,
    attachments: dataMessage.attachments,
    body: dataMessage.body,
    conversationId: conversation.id,
    decrypted_at: now,
    messageHash,
    errors: [],
  });

  if (existingExpireTimer) {
    message.set({ expireTimer: existingExpireTimer });
  }

  // Expire timer updates are now explicit.
  // We don't handle an expire timer from a incoming message except if it is an ExpireTimerUpdate message.

  const ourPubKey = PubKey.cast(ourNumber);

  handleMentions(message, conversation, ourPubKey);

  if (type === 'incoming') {
    updateReadStatus(message, conversation);
  }

  if (type === 'outgoing') {
    await handleSyncedReceipts(message, conversation);
  }

    if (
      conversation.isPrivate() &&
      !conversation.isApproved() &&
      window.inboxStore?.getState().userConfig.hideMessageRequests
    ) {
      window.inboxStore?.dispatch(showMessageRequestBanner());
    }

    if (!conversation.didApproveMe()) {
      conversation.setDidApproveMe(true);
      await forceSyncConfigurationNowIfNeeded();
    }

  const conversationActiveAt = conversation.get('active_at');
  if (!conversationActiveAt || (message.get('sent_at') || 0) > conversationActiveAt) {
    conversation.set({
      active_at: message.get('sent_at'),
      lastMessage: message.getNotificationText(),
    });
  }

  const sendingDeviceConversation = await getConversationController().getOrCreateAndWait(
    source,
    ConversationTypeEnum.PRIVATE
  );

  // Check if we need to update any profile names
  // the only profile we don't update with what is coming here is ours,
  // as our profile is shared accross our devices with a ConfigurationMessage
  if (type === 'incoming' && dataMessage.profile) {
    void updateProfileOneAtATime(
      sendingDeviceConversation,
      dataMessage.profile,
      dataMessage.profileKey
    );
  }

  if (dataMessage.profileKey) {
    await processProfileKey(conversation, sendingDeviceConversation, dataMessage.profileKey);
  }

  // we just received a message from that user so we reset the typing indicator for this convo
  await conversation.notifyTyping({
    isTyping: false,
    sender: source,
  });
}

async function handleExpirationTimerUpdate(
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
    unread: 0, // mark the message as read.
  });
  conversation.set({ expireTimer });

  window?.log?.info("Update conversation 'expireTimer'", {
    id: conversation.idForLogging(),
    expireTimer,
    source: 'handleDataMessage',
  });

  await conversation.updateExpireTimer(expireTimer, source, message.get('received_at'));
}

export async function handleMessageJob(
  message: MessageModel,
  conversation: ConversationModel,
  initialMessage: any,
  ourNumber: string,
  confirm: () => void,
  source: string,
  messageHash: string
) {
  window?.log?.info(
    `Starting handleDataMessage for message ${message.idForLogging()}, ${message.get(
      'serverTimestamp'
    ) || message.get('timestamp')} in conversation ${conversation.idForLogging()}`
  );

  try {
    message.set({ flags: initialMessage.flags });
    if (message.isExpirationTimerUpdate()) {
      const { expireTimer } = initialMessage;
      const oldValue = conversation.get('expireTimer');
      if (expireTimer === oldValue) {
        if (confirm) {
          confirm();
        }
        window?.log?.info(
          'Dropping ExpireTimerUpdate message as we already have the same one set.'
        );
        return;
      }
      await handleExpirationTimerUpdate(conversation, message, source, expireTimer);
    } else {
      await handleRegularMessage(
        conversation,
        message,
        initialMessage,
        source,
        ourNumber,
        messageHash
      );
    }

    const id = await message.commit();

    message.set({ id });

    // Note that this can save the message again, if jobs were queued. We need to
    //   call it after we have an id for this message, because the jobs refer back
    //   to their source message.

    void queueAttachmentDownloads(message, conversation);

    const unreadCount = await conversation.getUnreadCount();
    conversation.set({ unreadCount });
    // this is a throttled call and will only run once every 1 sec
    conversation.updateLastMessage();
    await conversation.commit();

    try {
      // We go to the database here because, between the message save above and
      // the previous line's trigger() call, we might have marked all messages
      // unread in the database. This message might already be read!
      const fetched = await getMessageById(message.get('id'));

      const previousUnread = message.get('unread');

      // Important to update message with latest read state from database
      message.merge(fetched);

      if (previousUnread !== message.get('unread')) {
        window?.log?.warn(
          'Caught race condition on new message read state! ' + 'Manually starting timers.'
        );
        // We call markRead() even though the message is already
        // marked read because we need to start expiration
        // timers, etc.
        await message.markRead(Date.now());
      }
    } catch (error) {
      window?.log?.warn('handleDataMessage: Message', message.idForLogging(), 'was deleted');
    }

    // this updates the redux store.
    // if the convo on which this message should become visible,
    // it will be shown to the user, and might as well be read right away

    updatesToDispatch.set(message.id, {
      conversationKey: conversation.id,
      messageModelProps: message.getMessageModelProps(),
    });
    throttledAllMessagesAddedDispatch();
    if (message.get('unread')) {
      conversation.throttledNotify(message);
    }

    if (confirm) {
      confirm();
    }
  } catch (error) {
    const errorForLog = error && error.stack ? error.stack : error;
    window?.log?.error('handleDataMessage', message.idForLogging(), 'error:', errorForLog);

    throw error;
  }
}

const throttledAllMessagesAddedDispatch = _.throttle(() => {
  if (updatesToDispatch.size === 0) {
    return;
  }
  window.inboxStore?.dispatch(messagesAdded([...updatesToDispatch.values()]));
  updatesToDispatch.clear();
}, 1000);

const updatesToDispatch: Map<
  string,
  { conversationKey: string; messageModelProps: MessageModelPropsWithoutConvoProps }
> = new Map();
