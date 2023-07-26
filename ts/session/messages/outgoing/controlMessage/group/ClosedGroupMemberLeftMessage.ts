import { SignalService } from '../../../../../protobuf';
import { ClosedGroupMessage } from './ClosedGroupMessage';

export class ClosedGroupMemberLeftMessage extends ClosedGroupMessage {
  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.MEMBER_LEFT;

    return dataMessage;
  }
}
