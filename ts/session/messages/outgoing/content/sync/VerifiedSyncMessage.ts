import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { PubKey } from '../../../../types';

interface VerifiedSyncMessageParams extends MessageParams {
  padding: Buffer;
  identityKey: Uint8Array;
  destination: PubKey;
  state: SignalService.Verified.State;
}

export abstract class VerifiedSyncMessage extends SyncMessage {
  public readonly state: SignalService.Verified.State;
  public readonly destination: PubKey;
  public readonly identityKey: Uint8Array;
  public readonly padding: Buffer;

  constructor(params: VerifiedSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.state = params.state;
    this.destination = params.destination;
    this.identityKey = params.identityKey;
    this.padding = params.padding;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.verified = new SignalService.Verified();
    syncMessage.verified.state = this.state;
    syncMessage.verified.destination = this.destination.key;
    syncMessage.verified.identityKey = this.identityKey;
    syncMessage.verified.nullMessage = this.padding;

    return syncMessage;
  }
}
