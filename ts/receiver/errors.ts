import { initIncomingMessage } from './dataMessage';
import { toNumber } from 'lodash';
import { SessionProtocol } from '../session/protocols';
import { PubKey } from '../session/types';
import { ConversationController } from '../session/conversations';

async function onNoSession(ev: any) {
  const pubkey = ev.proto.source;

  const convo = await ConversationController.getInstance().getOrCreateAndWait(
    pubkey,
    'private'
  );

  if (!convo.get('sessionRestoreSeen')) {
    convo.set({ sessionRestoreSeen: true });

    await convo.commit();

    await SessionProtocol.sendSessionRequestIfNeeded(new PubKey(pubkey));
  } else {
    window.log.debug(`Already seen session restore for pubkey: ${pubkey}`);
    if (ev.confirm) {
      ev.confirm();
    }
  }
}

export async function onError(ev: any) {
  const noSession =
    ev.error &&
    ev.error.message &&
    ev.error.message.indexOf('No record for device') === 0;

  if (noSession) {
    await onNoSession(ev);

    // We don't want to display any failed messages in the conversation:
    return;
  }

  const { error } = ev;
  window.log.error(
    'background onError:',
    window.Signal.Errors.toLogFormat(error)
  );

  if (ev.proto) {
    if (error && error.name === 'MessageCounterError') {
      if (ev.confirm) {
        ev.confirm();
      }
      // Ignore this message. It is likely a duplicate delivery
      // because the server lost our ack the first time.
      return;
    }
    const envelope = ev.proto;

    const message = initIncomingMessage(envelope);

    message.saveErrors(error || new Error('Error was null'));
    const id = message.get('conversationId');
    const conversation = await ConversationController.getInstance().getOrCreateAndWait(
      id,
      'private'
    );
    // force conversation unread count to be > 0 so it is highlighted
    conversation.set({
      active_at: Date.now(),
      unreadCount: toNumber(conversation.get('unreadCount')) + 1,
    });

    const conversationTimestamp = conversation.get('timestamp');
    const messageTimestamp = message.get('timestamp');
    if (!conversationTimestamp || messageTimestamp > conversationTimestamp) {
      conversation.set({ timestamp: message.get('sent_at') });
    }

    conversation.trigger('newmessage', message);
    conversation.notify(message);

    if (ev.confirm) {
      ev.confirm();
    }
    await conversation.commit();
  }

  throw error;
}
