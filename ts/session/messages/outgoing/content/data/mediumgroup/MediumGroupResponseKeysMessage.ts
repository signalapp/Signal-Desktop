import { SignalService } from '../../../../../../protobuf';
import { MediumGroupMessage, MediumGroupMessageParams } from '.';
import { RatchetState } from '../../../../../medium_group/senderKeys';

export interface MediumGroupResponseKeysParams
  extends MediumGroupMessageParams {
  senderKey: RatchetState;
}

export class MediumGroupResponseKeysMessage extends MediumGroupMessage {
  public readonly senderKey: RatchetState;

  constructor({
    timestamp,
    identifier,
    groupId,
    senderKey,
  }: MediumGroupResponseKeysParams) {
    super({ timestamp, identifier, groupId });
    this.senderKey = senderKey;
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.SENDER_KEY;
    const senderKey = new SignalService.MediumGroupUpdate.SenderKey({
      chainKey: this.senderKey.chainKey,
      keyIndex: this.senderKey.keyIdx,
      publicKey: this.senderKey.pubKey,
    });
    mediumGroupContext.senderKeys = [senderKey];

    return mediumGroupContext;
  }
}
