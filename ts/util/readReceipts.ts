import { MessageCollection } from '../models/message';

import { Data } from '../data/data';
import { getConversationController } from '../session/conversations';

async function getTargetMessage(reader: string, messages: MessageCollection) {
  if (messages.length === 0) {
    return null;
  }
  const message = messages.find(msg => msg.isOutgoing() && reader === msg.get('conversationId'));
  if (message) {
    return message;
  }

  // we do not support read messages for groups
  return null;
}

async function onReadReceipt(receipt: { source: string; timestamp: number; readAt: number }) {
  try {
    const messages = await Data.getMessagesBySentAt(receipt.timestamp);

    const message = await getTargetMessage(receipt.source, messages);

    if (!message) {
      window.log.info('No message for read receipt', receipt.source, receipt.timestamp);
      return;
    }
    const convoId = message.get('conversationId'); // this might be a group and we don't want to handle them
    if (
      !convoId ||
      !getConversationController().get(convoId) ||
      !getConversationController().get(convoId).isPrivate()
    ) {
      window.log.info(
        'Convo is undefined or not a private chat for read receipt in convo',
        convoId
      );
      return;
    }

    // readBy is only used for private conversations
    // we do not care of who read it. If the length is > 0 , it is read and false otherwise
    let readBy = message.get('read_by') || [];

    if (!readBy.length) {
      readBy.push(receipt.source);
    }
    if (readBy.length > 1) {
      readBy = readBy.slice(0, 1);
    }

    message.set({
      read_by: readBy,
      sent: true,
    });

    await message.commit();

    // notify frontend listeners
    const conversation = getConversationController().get(message.get('conversationId'));
    if (conversation) {
      conversation.updateLastMessage();
    }
  } catch (error) {
    window.log.error('ReadReceipts.onReceipt error:', error && error.stack ? error.stack : error);
  }
}

export const ReadReceipts = { onReadReceipt };
