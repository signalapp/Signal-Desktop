import { Message } from '../Message';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../..';

export abstract class ContentMessage extends Message {
  public plainTextBuffer(): Uint8Array {
    return SignalService.Content.encode(this.contentProto()).finish();
  }

  public abstract ttl(): number;
  protected abstract contentProto(): SignalService.Content;
}
