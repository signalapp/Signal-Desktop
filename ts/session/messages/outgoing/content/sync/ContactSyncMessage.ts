import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';

interface ContactSyncMessageParams extends MessageParams {
  data: Uint8Array;
}

export abstract class ContactSyncMessage extends SyncMessage {
  public readonly data: Uint8Array;

  constructor(params: ContactSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.data = params.data;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.contacts = new SignalService.SyncMessage.Contacts({
      data: this.data,
    });
    return syncMessage;
  }
}
