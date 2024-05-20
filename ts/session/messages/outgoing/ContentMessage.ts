import { SignalService } from '../../../protobuf';
import { TTL_DEFAULT } from '../../constants';
import { Message } from './Message';

export abstract class ContentMessage extends Message {
  public plainTextBuffer(): Uint8Array {
    return SignalService.Content.encode(this.contentProto()).finish();
  }

  public ttl(): number {
    return TTL_DEFAULT.CONTENT_MESSAGE;
  }

  public abstract contentProto(): SignalService.Content;
}
