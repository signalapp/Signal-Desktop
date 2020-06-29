import { SignalService } from '../../../../../../protobuf';
import { MediumGroupMessage, MediumGroupMessageParams } from '.';

export interface MediumGroupResponseKeysParams
  extends MediumGroupMessageParams {
  chainKey: string;
  keyIdx: number;
}

export class MediumGroupResponseKeysMessage extends MediumGroupMessage {
  public readonly chainKey: string;
  public readonly keyIdx: number;

  constructor({
    timestamp,
    identifier,
    groupId,
    chainKey,
    keyIdx,
  }: MediumGroupResponseKeysParams) {
    super({ timestamp, identifier, groupId });
    this.chainKey = chainKey;
    this.keyIdx = keyIdx;
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.SENDER_KEY;
    mediumGroupContext.senderKey = new SignalService.SenderKey({
      chainKey: this.chainKey,
      keyIdx: this.keyIdx,
    });

    return mediumGroupContext;
  }
}
