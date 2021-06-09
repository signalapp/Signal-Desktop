import { SignalService } from '../../../../../protobuf';
import { PubKey } from '../../../../types';
import { DataMessage } from '../../DataMessage';
import { MessageParams } from '../../Message';

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
    if (!this.groupId || this.groupId.key.length === 0) {
      throw new Error('groupId must be set');
    }
  }

  public static areAdminsMembers(admins: Array<string>, members: Array<string>) {
    return admins.every(a => members.includes(a));
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupControlMessage = new SignalService.DataMessage.ClosedGroupControlMessage();

    return dataMessage;
  }
}
