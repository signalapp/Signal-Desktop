import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import * as crypto from 'crypto';

export abstract class SyncMessage extends ContentMessage {
  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      syncMessage: this.syncProto(),
    });
  }

  protected createSyncMessage(): SignalService.SyncMessage {
    const syncMessage = new SignalService.SyncMessage();

    // Generate a random int from 1 and 512
    const buffer = crypto.randomBytes(1);

    // tslint:disable-next-line: no-bitwise
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = crypto.randomBytes(paddingLength);

    return syncMessage;
  }

  protected abstract syncProto(): SignalService.SyncMessage;
}
