import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class SyncMessage extends ContentMessage {
  public static canSync(message: ContentMessage): boolean {
    // TODO: implement
    return true;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected abstract syncProto(): SignalService.SyncMessage;
}
