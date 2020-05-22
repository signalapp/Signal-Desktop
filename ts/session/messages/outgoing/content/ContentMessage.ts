import { Message } from '../Message';
import { SignalService } from '../../../../protobuf';

export abstract class ContentMessage implements Message {
  public readonly timestamp: number;
  public readonly identifier: string;

  constructor(timestamp: number, identifier: string) {
    this.timestamp = timestamp;
    this.identifier = identifier;
  }

  public plainTextBuffer(): Uint8Array {
    return SignalService.Content.encode(this.contentProto()).finish();
  }

  public abstract ttl(): number;
  protected abstract contentProto(): SignalService.Content;

  /**
   * If the message is not a message with a specific TTL,
   * this value can be used in all child classes
   */
  protected getDefaultTTL(): number {
    // 1 day default for any other message
    return  24 * 60 * 60 * 1000;
  }
}
