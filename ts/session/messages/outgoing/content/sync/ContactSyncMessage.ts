import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils, SyncMessageUtils } from '../../../../utils';

interface RawContact {
  name: string;
  number: string;
  nickname?: string;
  blocked: boolean;
  expireTimer?: number;
  verifiedStatus: number;
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
    const contactsWithVerified = this.rawContacts.map(c => {
      let protoState = SignalService.Verified.State.DEFAULT;

      if (c.verifiedStatus === 1 || c.verifiedStatus === 2) {
        protoState = SignalService.Verified.State.VERIFIED;
      }
      const verified = new SignalService.Verified({
        state: protoState,
        destination: c.number,
        identityKey: new Uint8Array(StringUtils.encode(c.number, 'hex')),
      });

      return {
        name: c.name,
        verified,
        number: c.number,
        nickname: c.nickname,
        blocked: c.blocked,
        expireTimer: c.expireTimer,
      };
    });

    // Convert raw contacts to an array of buffers
    const contactDetails = contactsWithVerified
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
