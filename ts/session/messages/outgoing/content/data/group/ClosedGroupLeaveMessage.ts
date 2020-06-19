import { SignalService } from '../../../../../../protobuf';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';


export class ClosedGroupLeaveMessage extends ClosedGroupMessage {

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
    });
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected groupContextType(): SignalService.GroupContext.Type {
    return SignalService.GroupContext.Type.QUIT;
  }

  protected dataProto(): SignalService.DataMessage {
    const messageProto = new SignalService.DataMessage();
    messageProto.group = this.groupContext();

    return messageProto;
  }
}
