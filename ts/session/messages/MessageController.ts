// You can see MessageController for in memory registered messages.
// Ee register messages to it everytime we send one, so that when an event happens we can find which message it was based on this id.

import { MessageModel } from '../../models/message';

type MessageControllerEntry = {
  message: MessageModel;
  timestamp: number;
};
let messageControllerInstance: MessageController | null;

export const getMessageController = () => {
  if (messageControllerInstance) {
    return messageControllerInstance;
  }
  messageControllerInstance = new MessageController();
  return messageControllerInstance;
};

// It's not only data from the db which is stored on the MessageController entries, we could fetch this again. What we cannot fetch from the db and which is stored here is all listeners a particular messages is linked to for instance. We will be able to get rid of this once we don't use backbone models at all
export class MessageController {
  private readonly messageLookup: Map<string, MessageControllerEntry>;

  /**
   * Not to be used directly. Instead call getMessageController()
   */
  constructor() {
    this.messageLookup = new Map();
    // cleanup every hour the cache
    setInterval(this.cleanup, 3600 * 1000);
  }

  public register(id: string, message: MessageModel) {
    if (!(message instanceof MessageModel)) {
      throw new Error('Only MessageModels can be registered to the MessageController.');
    }
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
    window?.log?.warn('Cleaning up MessageController singleton oldest messages...');
    const now = Date.now();

    (this.messageLookup || []).forEach(messageEntry => {
      const { message, timestamp } = messageEntry;
      const conversation = message.getConversation();

      if (now - timestamp > 5 * 60 * 1000 && !conversation) {
        this.unregister(message.id);
      }
    });
  }

  public get(identifier: string) {
    return this.messageLookup.get(identifier);
  }
}
