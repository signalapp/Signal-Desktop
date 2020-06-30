import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { MessageParams } from '../../../Message';
import { PubKey } from '../../../../../types';
import { StringUtils } from '../../../../../utils';

export interface ClosedGroupMessageParams extends MessageParams {
  groupId: string | PubKey;
}

export abstract class ClosedGroupMessage extends DataMessage {
  public readonly groupId: PubKey;

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
    this.groupId = PubKey.cast(params.groupId);
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.group = this.groupContext();

    return dataMessage;
  }

  protected groupContext(): SignalService.GroupContext {
    const id = new Uint8Array(StringUtils.encode(this.groupId.key, 'utf8'));

    return new SignalService.GroupContext({ id });
  }
}
