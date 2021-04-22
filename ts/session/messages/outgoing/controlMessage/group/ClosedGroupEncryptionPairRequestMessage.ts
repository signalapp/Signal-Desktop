import { Constants } from '../../../..';
import { SignalService } from '../../../../../protobuf';
import { ClosedGroupMessage } from './ClosedGroupMessage';

export class ClosedGroupEncryptionPairRequestMessage extends ClosedGroupMessage {
  public dataProto(): SignalService.DataMessage {
    throw new Error('ClosedGroupEncryptionPairRequestMessage: This is unused for now ');
    const dataMessage = super.dataProto();

    // tslint:disable: no-non-null-assertion
    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.ENCRYPTION_KEY_PAIR_REQUEST;

    return dataMessage;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.ENCRYPTION_PAIR_GROUP;
  }
}
