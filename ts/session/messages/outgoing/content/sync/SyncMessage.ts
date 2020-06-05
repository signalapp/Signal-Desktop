import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class SyncMessage extends ContentMessage {
  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected syncProto(): SignalService.SyncMessage {
    return new SignalService.SyncMessage({});
  }
}
