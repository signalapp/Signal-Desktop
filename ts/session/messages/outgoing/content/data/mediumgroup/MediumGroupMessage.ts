import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { MessageParams } from '../../../Message';
import { PubKey } from '../../../../../types';
import { StringUtils } from '../../../../../utils';
import { Constants } from '../../../../..';

export interface MediumGroupMessageParams extends MessageParams {
  groupId: string | PubKey;
}

export abstract class MediumGroupMessage extends DataMessage {
  public readonly groupId: PubKey;

  constructor(params: MediumGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
    this.groupId = PubKey.cast(params.groupId);
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.mediumGroupUpdate = this.mediumGroupContext();

    return dataMessage;
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const groupPublicKey = new Uint8Array(
      StringUtils.encode(this.groupId.key, 'hex')
    );
    return new SignalService.MediumGroupUpdate({ groupPublicKey });
  }
}
