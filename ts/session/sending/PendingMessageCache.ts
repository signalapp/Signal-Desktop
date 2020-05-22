import { RawMessage } from '../types/RawMessage';
import { OutgoingContentMessage } from '../messages/outgoing';

// TODO: We should be able to import functions straight from the db here without going through the window object

export class PendingMessageCache {
  private cachedMessages: Array<RawMessage> = [];

  constructor() {
    // TODO: We should load pending messages from db here
  }

  public addPendingMessage(
    device: string,
    message: OutgoingContentMessage
  ): RawMessage {
    // TODO: Maybe have a util for converting OutgoingContentMessage to RawMessage?
    // TODO: Raw message has uuid, how are we going to set that? maybe use a different identifier?
    // One could be device + timestamp would make a unique identifier
    // TODO: Return previous pending message if it exists
    return {} as RawMessage;
  }

  public removePendingMessage(message: RawMessage) {
    // TODO: implement
  }

  public getPendingDevices(): Array<String> {
    // TODO: this should return all devices which have pending messages
    return [];
  }

  public getPendingMessages(device: string): Array<RawMessage> {
    return [];
  }
}
