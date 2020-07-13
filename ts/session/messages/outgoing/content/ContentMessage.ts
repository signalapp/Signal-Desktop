import { Message } from '../Message';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../..';

export abstract class ContentMessage extends Message {
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
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }
}
