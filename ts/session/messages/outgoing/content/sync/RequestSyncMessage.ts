import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { Constants } from '../../../..';

interface RequestSyncMessageParams extends MessageParams {
  requestType: SignalService.SyncMessage.Request.Type;
}

export abstract class RequestSyncMessage extends SyncMessage {
  private readonly requestType: SignalService.SyncMessage.Request.Type;

  constructor(params: RequestSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.requestType = params.requestType;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.request = new SignalService.SyncMessage.Request({
      type: this.requestType,
    });

    return syncMessage;
  }
}
