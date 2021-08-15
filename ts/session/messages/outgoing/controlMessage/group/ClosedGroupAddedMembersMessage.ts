import { SignalService } from '../../../../../protobuf';
import { fromHexToArray } from '../../../../utils/String';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';

interface ClosedGroupAddedMembersMessageParams extends ClosedGroupMessageParams {
  addedMembers: Array<string>;
}

export class ClosedGroupAddedMembersMessage extends ClosedGroupMessage {
  private readonly addedMembers: Array<string>;

  constructor(params: ClosedGroupAddedMembersMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
    });
    this.addedMembers = params.addedMembers;
    if (!this.addedMembers?.length) {
      throw new Error('addedMembers cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    // tslint:disable: no-non-null-assertion
    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.MEMBERS_ADDED;
    dataMessage.closedGroupControlMessage!.members = this.addedMembers.map(fromHexToArray);

    return dataMessage;
  }
}
