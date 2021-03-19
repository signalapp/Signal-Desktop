import { Constants } from '../../../..';
import { SignalService } from '../../../../../protobuf';
import { ClosedGroupMessage } from './ClosedGroupMessage';

export class ClosedGroupMemberLeftMessage extends ClosedGroupMessage {
  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    // tslint:disable: no-non-null-assertion
    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.MEMBER_LEFT;

    return dataMessage;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }
}
