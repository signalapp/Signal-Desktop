import { SignalService } from '../../../../../protobuf';
import { DisappearingMessageType } from '../../../../../util/expiringMessages';
import { PubKey } from '../../../../types';
import { ContentMessage } from '../../ContentMessage';
import { MessageParams } from '../../Message';

export interface ClosedGroupMessageParams extends MessageParams {
  groupId: string | PubKey;
  expirationType?: DisappearingMessageType;
  expireTimer?: number;
}

export abstract class ClosedGroupMessage extends ContentMessage {
  public readonly groupId: PubKey;
  public readonly expirationType?: DisappearingMessageType;
  public readonly expireTimer?: number;

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });

    this.groupId = PubKey.cast(params.groupId);
    if (!this.groupId || this.groupId.key.length === 0) {
      throw new Error('groupId must be set');
    }
    this.expirationType = params.expirationType;
    this.expireTimer = params.expireTimer;
  }

  public static areAdminsMembers(admins: Array<string>, members: Array<string>) {
    return admins.every(a => members.includes(a));
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
      expirationType:
        this.expirationType === 'deleteAfterSend'
          ? SignalService.Content.ExpirationType.DELETE_AFTER_SEND
          : undefined,
      expirationTimer: this.expireTimer,
    });
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupControlMessage = new SignalService.DataMessage.ClosedGroupControlMessage();

    return dataMessage;
  }
}
