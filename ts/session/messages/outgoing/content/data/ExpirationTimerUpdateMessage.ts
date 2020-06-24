import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils } from '../../../../utils';
import { DataMessage } from './DataMessage';
import { PubKey } from '../../../../types';

interface ExpirationTimerUpdateMessageParams extends MessageParams {
  groupId?: string | PubKey;
  expireTimer: number | null;
  profileKey?: Uint8Array;
}

export class ExpirationTimerUpdateMessage extends DataMessage {
  public readonly groupId?: PubKey;
  public readonly expireTimer: number | null;
  public readonly profileKey?: Uint8Array;

  constructor(params: ExpirationTimerUpdateMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.expireTimer = params.expireTimer;
    this.profileKey = params.profileKey;

    const { groupId } = params;
    this.groupId = groupId ? PubKey.cast(groupId) : undefined;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected dataProto(): SignalService.DataMessage {
    const data = new SignalService.DataMessage();

    const groupMessage = new SignalService.GroupContext();
    if (this.groupId) {
      groupMessage.id = new Uint8Array(
        StringUtils.encode(this.groupId.key, 'utf8')
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
