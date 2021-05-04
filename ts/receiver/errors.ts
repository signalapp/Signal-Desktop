import { initIncomingMessage } from './dataMessage';
import { toNumber } from 'lodash';
import { ConversationController } from '../session/conversations';
import { MessageController } from '../session/messages';
import { actions as conversationActions } from '../state/ducks/conversations';
import { ConversationTypeEnum } from '../models/conversation';

export async function onError(ev: any) {
  const { error } = ev;
  window.log.error('background onError:', window.Signal.Errors.toLogFormat(error));

  if (ev.proto) {
    const envelope = ev.proto;

    const message = initIncomingMessage(envelope);

    await message.saveErrors(error || new Error('Error was null'));
    const id = message.get('conversationId');
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      id,
      ConversationTypeEnum.PRIVATE
    );
    // force conversation unread count to be > 0 so it is highlighted
    conversation.set({
      active_at: Date.now(),
      unreadCount: toNumber(conversation.get('unreadCount')) + 1,
    });

    const conversationActiveAt = conversation.get('active_at');
    const messageTimestamp = message.get('timestamp') || 0;
    if (!conversationActiveAt || messageTimestamp > conversationActiveAt) {
      conversation.set({ active_at: message.get('sent_at') });
    }

    conversation.updateLastMessage();
    await conversation.notify(message);
    MessageController.getInstance().register(message.id, message);
    window.inboxStore?.dispatch(
      conversationActions.messageAdded({
        conversationKey: conversation.id,
        messageModel: message,
      })
    );

    if (ev.confirm) {
      ev.confirm();
    }
    await conversation.commit();
  }

  throw error;
}
