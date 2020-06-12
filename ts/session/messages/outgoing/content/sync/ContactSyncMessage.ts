import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { SyncMessage } from '../';
import { PubKey } from '../../../../types';
import { DataMessage } from '../data';


interface ContactSyncMessageParams extends MessageParams {
  // Send to our devices
  contacts: Array<PubKey>;
  dataMessage?: DataMessage;
}

export class ContactSyncMessage extends SyncMessage {
  private readonly contacts: Array<PubKey>;
  private readonly dataMessage?: DataMessage;

  constructor(params: ContactSyncMessageParams) {
    super(params);

    // Stubbed for now
    this.contacts = params.contacts;
    this.dataMessage = params.dataMessage;

    this.syncProto();
  }

  protected syncProto(): SignalService.SyncMessage {
    return new SignalService.SyncMessage();
  }
}
