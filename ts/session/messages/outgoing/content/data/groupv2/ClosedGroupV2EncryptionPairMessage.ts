import { Constants } from '../../../../..';
import { SignalService } from '../../../../../../protobuf';
import { PubKey } from '../../../../../types';
import { fromHexToArray } from '../../../../../utils/String';
import {
  ClosedGroupV2Message,
  ClosedGroupV2MessageParams,
} from './ClosedGroupV2Message';

interface ClosedGroupV2EncryptionPairMessageParams
  extends ClosedGroupV2MessageParams {
  encryptedKeyPairs: Array<SignalService.ClosedGroupUpdateV2.KeyPairWrapper>;
}

export class ClosedGroupV2EncryptionPairMessage extends ClosedGroupV2Message {
  private readonly encryptedKeyPairs: Array<
    SignalService.ClosedGroupUpdateV2.KeyPairWrapper
  >;

  constructor(params: ClosedGroupV2EncryptionPairMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
      expireTimer: params.expireTimer,
    });
    this.encryptedKeyPairs = params.encryptedKeyPairs;
    if (this.encryptedKeyPairs.length === 0) {
      throw new Error('EncryptedKeyPairs cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    // tslint:disable: no-non-null-assertion
    dataMessage.closedGroupUpdateV2!.type =
      SignalService.ClosedGroupUpdateV2.Type.ENCRYPTION_KEY_PAIR;
    dataMessage.closedGroupUpdateV2!.wrappers = this.encryptedKeyPairs.map(
      w => {
        const { publicKey, encryptedKeyPair } = w;
        return {
          publicKey: publicKey,
          encryptedKeyPair,
        };
      }
    );

    return dataMessage;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.ENCRYPTION_PAIR_V2_GROUP;
  }
}
