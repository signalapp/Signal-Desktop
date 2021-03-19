import { Message } from '.';
import { SignalService } from '../../../protobuf';

export abstract class ContentMessage extends Message {
  public plainTextBuffer(): Uint8Array {
    return SignalService.Content.encode(this.contentProto()).finish();
  }

  public abstract ttl(): number;
  public abstract contentProto(): SignalService.Content;
}
