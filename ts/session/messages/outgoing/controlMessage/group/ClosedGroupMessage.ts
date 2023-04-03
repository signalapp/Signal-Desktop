import { SignalService } from '../../../../../protobuf';
import { PubKey } from '../../../../types';
import { ExpirableMessage, ExpirableMessageParams } from '../../ExpirableMessage';

export interface ClosedGroupMessageParams extends ExpirableMessageParams {
  groupId: string | PubKey;
}

export abstract class ClosedGroupMessage extends ExpirableMessage {
  public readonly groupId: PubKey;

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });

    this.groupId = PubKey.cast(params.groupId);
    if (!this.groupId || this.groupId.key.length === 0) {
      throw new Error('groupId must be set');
    }
  }

  public static areAdminsMembers(admins: Array<string>, members: Array<string>) {
    return admins.every(a => members.includes(a));
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
      ...super.contentProto(),
      // Closed Groups only support 'deleteAfterSend'
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : undefined,
    });
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupControlMessage = new SignalService.DataMessage.ClosedGroupControlMessage();

    return dataMessage;
  }
}
