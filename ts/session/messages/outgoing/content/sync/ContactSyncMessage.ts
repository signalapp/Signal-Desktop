import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { SyncMessageUtils } from '../../../../utils';

interface RawContact {
  name: string;
  number: string;
  nickname?: string;
  blocked: boolean;
  expireTimer?: number;
}
interface ContactSyncMessageParams extends MessageParams {
  rawContacts: [RawContact];
}

export abstract class ContactSyncMessage extends SyncMessage {
  public readonly rawContacts: [RawContact];

  constructor(params: ContactSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.rawContacts = params.rawContacts;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    const contactsWithoutVerified = this.rawContacts.map(c => {
      return {
        name: c.name,
        number: c.number,
        nickname: c.nickname,
        blocked: c.blocked,
        expireTimer: c.expireTimer,
      };
    });

    // Convert raw contacts to an array of buffers
    const contactDetails = contactsWithoutVerified
      .map(x => new SignalService.ContactDetails(x))
      .map(x => SignalService.ContactDetails.encode(x).finish());

    // Serialise array of byteBuffers into 1 byteBuffer
    const byteBuffer = SyncMessageUtils.serialiseByteBuffers(contactDetails);
    const data = new Uint8Array(byteBuffer.toArrayBuffer());

    syncMessage.contacts = new SignalService.SyncMessage.Contacts({
      data,
    });
    return syncMessage;
  }
}
