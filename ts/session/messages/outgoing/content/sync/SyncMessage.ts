import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class SyncMessage extends ContentMessage {

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected abstract syncProto(): SignalService.SyncMessage;
}
