import { SignalService } from '../../../../../../protobuf';
import {
  ClosedGroupMessage,
  ClosedGroupMessageParams,
} from './ClosedGroupMessage';
import { fromHexToArray } from '../../../../../utils/String';

export interface ClosedGroupUpdateMessageParams
  extends ClosedGroupMessageParams {
  name: string;
  members: Array<string>;
  expireTimer: number;
}

export class ClosedGroupUpdateMessage extends ClosedGroupMessage {
  private readonly name: string;
  private readonly members: Array<string>;

  constructor(params: ClosedGroupUpdateMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
      expireTimer: params.expireTimer,
    });
    this.name = params.name;
    this.members = params.members;

    // members can be empty. It means noone is in the group anymore and it happens when an admin leaves the group
    if (!params.members) {
      throw new Error('Members must be set');
    }
    if (!params.name || params.name.length === 0) {
      throw new Error('Name must cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupControlMessage = new SignalService.DataMessage.ClosedGroupControlMessage();
    dataMessage.closedGroupControlMessage.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.UPDATE;
    dataMessage.closedGroupControlMessage.name = this.name;
    dataMessage.closedGroupControlMessage.members = this.members.map(
      fromHexToArray
    );

    return dataMessage;
  }
}
