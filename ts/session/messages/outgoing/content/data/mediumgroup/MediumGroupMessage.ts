import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { MessageParams } from '../../../Message';
import { PubKey } from '../../../../../types';
import { StringUtils } from '../../../../../utils';

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
    return this.getDefaultTTL();
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    return new SignalService.MediumGroupUpdate({ groupId: this.groupId.key });
  }

  protected dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.mediumGroupUpdate = this.mediumGroupContext();

    return dataMessage;
  }
}
