import { SignalService } from '../../../../../../protobuf';
import { GroupMessage, GroupMessageParams } from './GroupMessage';

interface GroupMemberLeftMessageParams extends GroupMessageParams {}

export class GroupMemberLeftMessage extends GroupMessage {
  constructor(params: GroupMemberLeftMessageParams) {
    super(params);
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.groupMessage = super.groupMessage();
    dataMessage.groupMessage.memberLeftMessage = new SignalService.GroupMemberLeftMessage();

    return dataMessage;
  }
}
