import { Message } from '../Message';
import { SignalService } from '../../../../protobuf';

export abstract class ContentMessage extends Message {

  constructor({ timestamp, identifier }: { timestamp: number; identifier: string }) {
    super({timestamp, identifier});
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
