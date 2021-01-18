import { SignalService } from '../../../../../../protobuf';
import {
  ClosedGroupV2Message,
  ClosedGroupV2MessageParams,
} from './ClosedGroupV2Message';
import { fromHexToArray } from '../../../../../utils/String';

export interface ClosedGroupV2UpdateMessageParams
  extends ClosedGroupV2MessageParams {
  name: string;
  members: Array<string>;
  expireTimer: number;
}

export class ClosedGroupV2UpdateMessage extends ClosedGroupV2Message {
  private readonly name: string;
  private readonly members: Array<string>;

  constructor(params: ClosedGroupV2UpdateMessageParams) {
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

    dataMessage.closedGroupUpdateV2 = new SignalService.ClosedGroupUpdateV2();
    dataMessage.closedGroupUpdateV2.type =
      SignalService.ClosedGroupUpdateV2.Type.UPDATE;
    dataMessage.closedGroupUpdateV2.name = this.name;
    dataMessage.closedGroupUpdateV2.members = this.members.map(fromHexToArray);

    return dataMessage;
  }
}
