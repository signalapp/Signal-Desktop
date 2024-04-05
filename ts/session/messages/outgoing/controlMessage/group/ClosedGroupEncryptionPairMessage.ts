import { SignalService } from '../../../../../protobuf';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';

export interface ClosedGroupEncryptionPairMessageParams extends ClosedGroupMessageParams {
  encryptedKeyPairs: Array<SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper>;
}

export class ClosedGroupEncryptionPairMessage extends ClosedGroupMessage {
  private readonly encryptedKeyPairs: Array<SignalService.DataMessage.ClosedGroupControlMessage.KeyPairWrapper>;

  constructor(params: ClosedGroupEncryptionPairMessageParams) {
    super(params);
    this.encryptedKeyPairs = params.encryptedKeyPairs;
    if (this.encryptedKeyPairs.length === 0) {
      throw new Error('EncryptedKeyPairs cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.ENCRYPTION_KEY_PAIR;
    dataMessage.closedGroupControlMessage!.wrappers = this.encryptedKeyPairs.map(w => {
      const { publicKey, encryptedKeyPair } = w;
      return {
        publicKey,
        encryptedKeyPair,
      };
    });

    return dataMessage;
  }
}
