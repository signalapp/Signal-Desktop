import { SignalService } from '../../../../../protobuf';
import { fromHexToArray } from '../../../../utils/String';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';

interface ClosedGroupRemovedMembersMessageParams extends ClosedGroupMessageParams {
  removedMembers: Array<string>;
}

export class ClosedGroupRemovedMembersMessage extends ClosedGroupMessage {
  private readonly removedMembers: Array<string>;

  constructor(params: ClosedGroupRemovedMembersMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });
    this.removedMembers = params.removedMembers;
    if (!this.removedMembers?.length) {
      throw new Error('removedMembers cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.MEMBERS_REMOVED;
    dataMessage.closedGroupControlMessage!.members = this.removedMembers.map(fromHexToArray);

    return dataMessage;
  }
}
