import { Message } from '.';
import { SignalService } from '../../../protobuf';
import { TTL_DEFAULT } from '../../constants';

export abstract class ContentMessage extends Message {
  public plainTextBuffer(): Uint8Array {
    return SignalService.Content.encode(this.contentProto()).finish();
  }

  public ttl(): number {
    return TTL_DEFAULT.TTL_MAX;
  }
  public abstract contentProto(): SignalService.Content;
}
