import { DataMessage } from '../DataMessage';
import { MessageParams } from '../../../Message';
import { SignalService } from '../../../../../../protobuf';
import { PubKey } from '../../../../../types/PubKey';

export interface ClosedGroupV2MessageParams extends MessageParams {
  groupId: string | PubKey;
  expireTimer: number;
}

export abstract class ClosedGroupV2Message extends DataMessage {
  public readonly groupId: PubKey;
  public readonly expireTimer: number;

  constructor(params: ClosedGroupV2MessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });

    this.groupId = PubKey.cast(params.groupId);
    this.expireTimer = params.expireTimer;
    if (!this.groupId || this.groupId.key.length === 0) {
      throw new Error('groupId must be set');
    }
  }

  public static areAdminsMembers(
    admins: Array<string>,
    members: Array<string>
  ) {
    return admins.every(a => members.includes(a));
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupUpdateV2 = new SignalService.DataMessage.ClosedGroupUpdateV2();
    dataMessage.expireTimer = this.expireTimer;

    return dataMessage;
  }
}
