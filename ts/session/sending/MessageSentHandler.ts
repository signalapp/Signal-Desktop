import { getMessageById } from '../../data/data';
import { MessageController } from '../messages';
import { OpenGroupMessage } from '../messages/outgoing';
import { RawMessage } from '../types';

export class MessageSentHandler {
  /**
   * This function tries to find a message by messageId by first looking on the MessageController.
   * The MessageController holds all messages being in memory.
   * Those are the messages sent recently, recieved recently, or the one shown to the user.
   *
   * If the app restarted, it's very likely those messages won't be on the memory anymore.
   * In this case, this function will look for it in the database and return it.
   * If the message is found on the db, it will also register it to the MessageController so our subsequent calls are quicker.
   */
  private static async fetchHandleMessageSentData(
    m: RawMessage | OpenGroupMessage
  ) {
    // if a message was sent and this message was created after the last app restart,
    // this message is still in memory in the MessageController
    const msg = MessageController.getInstance().get(m.identifier);

    if (!msg || !msg.message) {
      // otherwise, look for it in the database
      // nobody is listening to this freshly fetched message .trigger calls
      const dbMessage = await getMessageById(m.identifier);

      if (!dbMessage) {
        return null;
      }
      MessageController.getInstance().register(m.identifier, dbMessage);
      return dbMessage;
    }

    return msg.message;
  }

  public static async handlePublicMessageSentSuccess(
    sentMessage: OpenGroupMessage,
    result: { serverId: number; serverTimestamp: number }
  ) {
    const { serverId, serverTimestamp } = result;
    try {
      const foundMessage = await MessageSentHandler.fetchHandleMessageSentData(
        sentMessage
      );

      if (!foundMessage) {
        throw new Error(
          'handlePublicMessageSentSuccess(): The message should be in memory for an openGroup message'
        );
      }

      foundMessage.set({
        serverTimestamp,
        serverId,
        isPublic: true,
      });
      await foundMessage.commit();
    } catch (e) {
      window.log.error('Error setting public on message');
    }
  }

  public static async handleMessageSentSuccess(
    sentMessage: RawMessage | OpenGroupMessage,
    wrappedEnvelope?: Uint8Array
  ) {
    // The wrappedEnvelope will be set only if the message is not one of OpenGroupMessage type.
    const fetchedMessage = await MessageSentHandler.fetchHandleMessageSentData(
      sentMessage
    );
    if (!fetchedMessage) {
      return;
    }

    void fetchedMessage.handleMessageSentSuccess(sentMessage, wrappedEnvelope);
  }

  public static async handleMessageSentFailure(
    sentMessage: RawMessage | OpenGroupMessage,
    error: any
  ) {
    const fetchedMessage = await MessageSentHandler.fetchHandleMessageSentData(
      sentMessage
    );
    if (!fetchedMessage) {
      return;
    }

    await fetchedMessage.handleMessageSentFailure(sentMessage, error);
  }
}
