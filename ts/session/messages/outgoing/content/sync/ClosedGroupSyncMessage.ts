import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { PubKey } from '../../../../types';

interface ClosedGroupSyncMessageParams extends MessageParams {
  data: Uint8Array;
}

export abstract class ClosedGroupSyncMessage extends SyncMessage {
  public readonly data: Uint8Array;

  constructor(params: ClosedGroupSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.data = params.data;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.groups = new SignalService.SyncMessage.Groups({
      data: this.data,
    });
    return syncMessage;
  }
}
