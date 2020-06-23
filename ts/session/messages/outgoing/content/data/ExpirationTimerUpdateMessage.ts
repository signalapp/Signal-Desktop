import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils } from '../../../../utils';
import { DataMessage } from './DataMessage';

interface ExpirationTimerUpdateMessageParams extends MessageParams {
  groupId?: string;
  expireTimer: number | null;
  profileKey?: Uint8Array;
}

export class ExpirationTimerUpdateMessage extends DataMessage {
  private readonly groupId?: string;
  private readonly expireTimer: number | null;
  private readonly profileKey?: Uint8Array;

  constructor(params: ExpirationTimerUpdateMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.groupId = params.groupId;
    this.expireTimer = params.expireTimer;
    this.profileKey = params.profileKey;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected dataProto(): SignalService.DataMessage {
    const data = new SignalService.DataMessage();

    const groupMessage = new SignalService.GroupContext();
    if (this.groupId) {
      groupMessage.id = new Uint8Array(
        StringUtils.encode(this.groupId, 'utf8')
      );
      groupMessage.type = SignalService.GroupContext.Type.DELIVER;
    }
    data.flags = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;
    if (this.expireTimer) {
      data.expireTimer = this.expireTimer;
    }
    if (this.profileKey) {
      data.profileKey = this.profileKey;
    }

    return data;
  }
}
