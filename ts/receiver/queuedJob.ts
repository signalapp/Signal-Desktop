import { queueAttachmentDownloads } from './attachments';

import { Quote } from './types';
import { ConversationModel } from '../../js/models/conversations';
import { MessageModel } from '../../js/models/messages';
import { PrimaryPubKey, PubKey } from '../session/types';
import _ from 'lodash';
import { MultiDeviceProtocol } from '../session/protocols';
import { SignalService } from '../protobuf';
import { StringUtils } from '../session/utils';

async function handleGroups(
  conversation: ConversationModel,
  group: any,
  source: any
): Promise<any> {
  const GROUP_TYPES = SignalService.GroupContext.Type;

  let groupUpdate = null;

  // conversation attributes
  const attributes: any = {
    type: 'group',
    groupId: group.id,
    ...conversation.attributes,
  };

  const oldMembers = conversation.get('members');

  if (group.type === GROUP_TYPES.UPDATE) {
    attributes.name = group.name;
    attributes.members = group.members;

    groupUpdate =
      conversation.changedAttributes(_.pick(group, 'name', 'avatar')) || {};

    const addedMembers = _.difference(attributes.members, oldMembers);
    if (addedMembers.length > 0) {
      groupUpdate.joined = addedMembers;
    }
    if (conversation.get('left')) {
      // TODO: Maybe we shouldn't assume this message adds us:
      // we could maybe still get this message by mistake
      window.log.warn('re-added to a left group');
      attributes.left = false;
    }

    if (attributes.isKickedFromGroup) {
      // Assume somebody re-invited us since we received this update
      attributes.isKickedFromGroup = false;
    }

    // Check if anyone got kicked:
    const removedMembers = _.difference(oldMembers, attributes.members);
    const isOurDeviceMap = await Promise.all(
      removedMembers.map(async member =>
        MultiDeviceProtocol.isOurDevice(member)
      )
    );
    const ourDeviceWasRemoved = isOurDeviceMap.includes(true);

    if (ourDeviceWasRemoved) {
      groupUpdate.kicked = 'You';
      attributes.isKickedFromGroup = true;
    } else if (removedMembers.length) {
      groupUpdate.kicked = removedMembers;
    }
  } else if (group.type === GROUP_TYPES.QUIT) {
    if (await MultiDeviceProtocol.isOurDevice(source)) {
      attributes.left = true;
      groupUpdate = { left: 'You' };
    } else {
      groupUpdate = { left: source };
    }
    attributes.members = _.without(oldMembers, source);
  }

  conversation.set(attributes);

  return groupUpdate;
}

function handleSessionReset(
  conversation: ConversationModel,
  message: MessageModel
) {
  const endSessionType = conversation.isSessionResetReceived()
    ? 'ongoing'
    : 'done';
  message.set({ endSessionType });
}

function contentTypeSupported(type: any): boolean {
  const Chrome = window.Signal.Util.GoogleChrome;
  return Chrome.isImageTypeSupported(type) || Chrome.isVideoTypeSupported(type);
}

async function copyFromQuotedMessage(
  msg: MessageModel,
  quote: Quote,
  attemptCount: number = 1
): Promise<void> {
  const { Whisper, getMessageController } = window;
  const { upgradeMessageSchema } = window.Signal.Migrations;
  const { Message: TypedMessage, Errors } = window.Signal.Types;

  if (!quote) {
    return;
  }

  const { attachments, id, author } = quote;
  const firstAttachment = attachments[0];

  const collection = await window.Signal.Data.getMessagesBySentAt(id, {
    MessageCollection: Whisper.MessageCollection,
  });
  const found = collection.find((item: any) => {
    const messageAuthor = item.getContact();

    return messageAuthor && author === messageAuthor.id;
  });

  if (!found) {
    // Exponential backoff, giving up after 5 attempts:
    if (attemptCount < 5) {
      setTimeout(() => {
        window.log.info(
          `Looking for the message id : ${id}, attempt: ${attemptCount + 1}`
        );
        copyFromQuotedMessage(msg, quote, attemptCount + 1).ignore();
      }, attemptCount * attemptCount * 500);
    } else {
      window.log.warn(
        `We did not found quoted message ${id} after ${attemptCount} attempts.`
      );
    }

    quote.referencedMessageNotFound = true;
    return;
  }

  window.log.info(`Found quoted message id: ${id}`);
  quote.referencedMessageNotFound = false;

  const queryMessage = getMessageController().register(found.id, found);
  quote.text = queryMessage.get('body');

  if (attemptCount > 1) {
    // Normally the caller would save the message, but in case we are
    // called by a timer, we need to update the message manually
    msg.set({ quote });
    await msg.commit();
    return;
  }

  if (!firstAttachment || !contentTypeSupported(firstAttachment)) {
    return;
  }

  firstAttachment.thumbnail = null;

  try {
    if (
      queryMessage.get('schemaVersion') <
      TypedMessage.VERSION_NEEDED_FOR_DISPLAY
    ) {
      const upgradedMessage = await upgradeMessageSchema(
        queryMessage.attributes
      );
      queryMessage.set(upgradedMessage);
      await upgradedMessage.commit();
    }
  } catch (error) {
    window.log.error(
      'Problem upgrading message quoted message from database',
      Errors.toLogFormat(error)
    );
    return;
  }

  const queryAttachments = queryMessage.get('attachments') || [];

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

  const queryPreview = queryMessage.get('preview') || [];
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

// Handle expiration timer as part of a regular message
async function handleExpireTimer(
  source: string,
  message: MessageModel,
  expireTimer: number,
  conversation: ConversationModel
) {
  const oldValue = conversation.get('expireTimer');

  if (expireTimer) {
    message.set({ expireTimer });

    if (expireTimer !== oldValue) {
      await conversation.updateExpirationTimer(
        expireTimer,
        source,
        message.get('received_at'),
        {
          fromGroupUpdate: message.isGroupUpdate(), // WHAT DOES GROUP UPDATE HAVE TO DO WITH THIS???
        }
      );
    }
  } else if (oldValue && !message.isGroupUpdate()) {
    // We only turn off timers if it's not a group update
    await conversation.updateExpirationTimer(
      null,
      source,
      message.get('received_at'),
      {}
    );
  }
}

function handleLinkPreviews(
  messageBody: string,
  messagePreview: any,
  message: MessageModel
) {
  const urls = window.Signal.LinkPreviews.findLinks(messageBody);
  const incomingPreview = messagePreview || [];
  const preview = incomingPreview.filter(
    (item: any) => (item.image || item.title) && urls.includes(item.url)
  );
  if (preview.length < incomingPreview.length) {
    window.log.info(
      `${message.idForLogging()}: Eliminated ${preview.length -
        incomingPreview.length} previews with invalid urls'`
    );
  }

  message.set({ preview });
}

async function processProfileKey(
  source: string,
  conversation: ConversationModel,
  sendingDeviceConversation: ConversationModel,
  profileKeyBuffer: Uint8Array
) {
  const ourNumber = window.textsecure.storage.user.getNumber();

  const profileKey = StringUtils.decode(profileKeyBuffer, 'base64');
  if (source === ourNumber) {
    conversation.set({ profileSharing: true });
  } else if (conversation.isPrivate()) {
    await conversation.setProfileKey(profileKey);
  } else {
    await sendingDeviceConversation.setProfileKey(profileKey);
  }
}

function handleMentions(
  message: MessageModel,
  conversation: ConversationModel,
  ourPrimaryNumber: PrimaryPubKey
) {
  const body = message.get('body');
  if (body && body.indexOf(`@${ourPrimaryNumber.key}`) !== -1) {
    conversation.set({ mentionedUs: true });
  }
}

function updateReadStatus(
  message: MessageModel,
  conversation: ConversationModel
) {
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
    message.unset('unread');
    // This is primarily to allow the conversation to mark all older
    // messages as read, as is done when we receive a read sync for
    // a message we already know about.
    conversation.onReadMessage(message);
  } else {
    conversation.set({
      isArchived: false,
    });
  }
}

function handleSyncedReceipts(
  message: MessageModel,
  conversation: ConversationModel
) {
  const readReceipts = window.Whisper.ReadReceipts.forMessage(
    conversation,
    message
  );
  if (readReceipts.length) {
    const readBy = readReceipts.map((receipt: any) => receipt.get('reader'));
    message.set({
      read_by: _.union(message.get('read_by'), readBy),
    });
  }

  const deliveryReceipts = window.Whisper.DeliveryReceipts.forMessage(
    conversation,
    message
  );

  if (deliveryReceipts.length) {
    handleSyncDeliveryReceipts(message, deliveryReceipts);
  }

  // A sync'd message to ourself is automatically considered read and delivered
  const recipients = conversation.getRecipients();
  if (conversation.isMe()) {
    message.set({
      read_by: recipients,
      delivered_to: recipients,
    });
  }

  message.set({ recipients });
}

function handleSyncDeliveryReceipts(message: MessageModel, receipts: any) {
  const sources = receipts.map((receipt: any) => receipt.get('source'));

  const deliveredTo = _.union(message.get('delivered_to') || [], sources);

  const deliveredCount = deliveredTo.length;

  message.set({
    delivered: deliveredCount,
    delivered_to: deliveredTo,
  });
}

async function handleRegularMessage(
  conversation: ConversationModel,
  message: MessageModel,
  initialMessage: any,
  source: string,
  ourNumber: any,
  primarySource: PubKey
) {
  const { ConversationController } = window;
  const { upgradeMessageSchema } = window.Signal.Migrations;

  const type = message.get('type');

  await copyFromQuotedMessage(message, initialMessage.quote);

  // `upgradeMessageSchema` only seems to add `schemaVersion: 10` to the message
  const dataMessage = await upgradeMessageSchema(initialMessage);

  const now = new Date().getTime();

  // Medium grups might have `group` set even if with group chat messages...
  if (dataMessage.group && !conversation.isMediumGroup()) {
    // This is not necessarily a group update message, it could also be a regular group message
    const groupUpdate = await handleGroups(
      conversation,
      dataMessage.group,
      source
    );
    if (groupUpdate !== null) {
      message.set({ group_update: groupUpdate });
    }
  }

  if (dataMessage.groupInvitation) {
    message.set({ groupInvitation: dataMessage.groupInvitation });
  }

  handleLinkPreviews(dataMessage.body, dataMessage.preview, message);

  message.set({
    flags: dataMessage.flags,
    hasAttachments: dataMessage.hasAttachments,
    hasFileAttachments: dataMessage.hasFileAttachments,
    hasVisualMediaAttachments: dataMessage.hasVisualMediaAttachments,
    quote: dataMessage.quote,
    schemaVersion: dataMessage.schemaVersion,
    attachments: dataMessage.attachments,
    body: dataMessage.body,
    contact: dataMessage.contact,
    conversationId: conversation.id,
    decrypted_at: now,
    errors: [],
  });

  conversation.set({ active_at: now });

  // Re-enable typing if re-joined the group
  conversation.updateTextInputState();

  // Handle expireTimer found directly as part of a regular message
  await handleExpireTimer(
    source,
    message,
    dataMessage.expireTimer,
    conversation
  );

  const ourPrimary = await MultiDeviceProtocol.getPrimaryDevice(ourNumber);

  handleMentions(message, conversation, ourPrimary);

  if (type === 'incoming') {
    updateReadStatus(message, conversation);
  }

  if (type === 'outgoing') {
    handleSyncedReceipts(message, conversation);
  }

  const conversationTimestamp = conversation.get('timestamp');
  if (
    !conversationTimestamp ||
    message.get('sent_at') > conversationTimestamp
  ) {
    conversation.lastMessage = message.getNotificationText();
    conversation.set({
      timestamp: message.get('sent_at'),
    });
  }

  const sendingDeviceConversation = await ConversationController.getOrCreateAndWait(
    source,
    'private'
  );

  if (dataMessage.profileKey) {
    await processProfileKey(
      source,
      conversation,
      sendingDeviceConversation,
      dataMessage.profileKey
    );
  }

  if (source !== ourNumber && primarySource) {
    message.set({ source: primarySource.key });
  }
}

async function handleExpirationTimerUpdate(
  conversation: ConversationModel,
  message: MessageModel,
  source: string,
  expireTimer: number
) {
  // TODO: if the message is an expiration timer update, it
  // shouldn't be responsible for anything else!!!
  message.set({
    expirationTimerUpdate: {
      source,
      expireTimer,
    },
  });
  conversation.set({ expireTimer });

  window.log.info("Update conversation 'expireTimer'", {
    id: conversation.idForLogging(),
    expireTimer,
    source: 'handleDataMessage',
  });

  await conversation.updateExpirationTimer(
    expireTimer,
    source,
    message.get('received_at'),
    {
      fromGroupUpdate: message.isGroupUpdate(), // WHAT DOES GROUP UPDATE HAVE TO DO WITH THIS???
    }
  );
}

export async function handleMessageJob(
  message: MessageModel,
  conversation: ConversationModel,
  initialMessage: any,
  ourNumber: string,
  confirm: () => void,
  source: string,
  primarySource: PubKey
) {
  window.log.info(
    `Starting handleDataMessage for message ${message.idForLogging()} in conversation ${conversation.idForLogging()}`
  );

  try {
    message.set({ flags: initialMessage.flags });

    if (message.isEndSession()) {
      handleSessionReset(conversation, message);
    } else if (message.isExpirationTimerUpdate()) {
      const { expireTimer } = initialMessage;
      const oldValue = conversation.get('expireTimer');
      if (expireTimer === oldValue) {
        if (confirm) {
          confirm();
        }
        window.log.info(
          'Dropping ExpireTimerUpdate message as we already have the same one set.'
        );
        return;
      }
      await handleExpirationTimerUpdate(
        conversation,
        message,
        source,
        expireTimer
      );
    } else {
      await handleRegularMessage(
        conversation,
        message,
        initialMessage,
        source,
        ourNumber,
        primarySource
      );
    }

    const { Whisper, getMessageController } = window;

    const id = await message.commit();
    message.set({ id });
    getMessageController().register(message.id, message);

    // Note that this can save the message again, if jobs were queued. We need to
    //   call it after we have an id for this message, because the jobs refer back
    //   to their source message.
    await queueAttachmentDownloads(message);
    // this is
    const unreadCount = await conversation.getUnreadCount();
    conversation.set({ unreadCount });
    await conversation.commit();

    conversation.trigger('newmessage', message);

    try {
      // We go to the database here because, between the message save above and
      // the previous line's trigger() call, we might have marked all messages
      // unread in the database. This message might already be read!
      const fetched = await window.Signal.Data.getMessageById(
        message.get('id'),
        {
          Message: Whisper.Message,
        }
      );
      const previousUnread = message.get('unread');

      // Important to update message with latest read state from database
      message.merge(fetched);

      if (previousUnread !== message.get('unread')) {
        window.log.warn(
          'Caught race condition on new message read state! ' +
            'Manually starting timers.'
        );
        // We call markRead() even though the message is already
        // marked read because we need to start expiration
        // timers, etc.
        message.markRead();
      }
    } catch (error) {
      window.log.warn(
        'handleDataMessage: Message',
        message.idForLogging(),
        'was deleted'
      );
    }

    if (message.get('unread')) {
      conversation.notify(message);
    }

    if (confirm) {
      confirm();
    }
  } catch (error) {
    const errorForLog = error && error.stack ? error.stack : error;
    window.log.error(
      'handleDataMessage',
      message.idForLogging(),
      'error:',
      errorForLog
    );
    throw error;
  }
}
