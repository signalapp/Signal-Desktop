// You can see MessageController for in memory registered messages.
// Ee register messages to it everytime we send one, so that when an event happens we can find which message it was based on this id.

import { MessageModel } from '../../../js/models/messages';

type MessageControllerEntry = {
  message: MessageModel;
  timestamp: number;
};

// It's not only data from the db which is stored on the MessageController entries, we could fetch this again. What we cannot fetch from the db and which is stored here is all listeners a particular messages is linked to for instance. We will be able to get rid of this once we don't use backbone models at all
export class MessageController {
  private static instance: MessageController | null;
  private readonly messageLookup: Map<string, MessageControllerEntry>;

  private constructor() {
    this.messageLookup = new Map();
    // cleanup every hour the cache
    setInterval(this.cleanup, 3600 * 1000);
  }

  public static getInstance() {
    if (MessageController.instance) {
      return MessageController.instance;
    }
    MessageController.instance = new MessageController();
    return MessageController.instance;
  }

  public register(id: string, message: MessageModel) {
    const existing = this.messageLookup.get(id);
    if (existing) {
      this.messageLookup.set(id, {
        message: existing.message,
        timestamp: Date.now(),
      });
      return existing.message;
    }

    this.messageLookup.set(id, {
      message,
      timestamp: Date.now(),
    });

    return message;
  }

  public unregister(id: string) {
    this.messageLookup.delete(id);
  }

  public cleanup() {
    window.log.warn('Cleaning up getMessageController() oldest messages...');
    const now = Date.now();

    (this.messageLookup || []).forEach(messageEntry => {
      const { message, timestamp } = messageEntry;
      const conversation = message.getConversation();

      if (
        now - timestamp > 5 * 60 * 1000 &&
        (!conversation || !conversation.messageCollection.length)
      ) {
        this.unregister(message.id);
      }
    });
  }

  // tslint:disable-next-line: function-name
  public get(identifier: string) {
    return this.messageLookup.get(identifier);
  }
}
