import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class RequestContactSyncMessage extends SyncMessage {
  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected syncProto(): SignalService.SyncMessage {
    const { CONTACTS } = SignalService.SyncMessage.Request.Type;
    const syncMessage = this.createSyncMessage();
    syncMessage.request = new SignalService.SyncMessage.Request({type: CONTACTS});


    return syncMessage;
  }
}
