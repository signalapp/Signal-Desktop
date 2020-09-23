import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils } from '../../../../utils';
import { DataMessage } from './DataMessage';
import { PubKey } from '../../../../types';
import { Constants } from '../../../..';

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
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  public dataProto(): SignalService.DataMessage {
    const data = new SignalService.DataMessage();

    data.flags = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

    if (this.groupId) {
      const groupMessage = new SignalService.GroupContext();
      groupMessage.id = new Uint8Array(
        StringUtils.encode(this.groupId.key, 'utf8')
      );
      groupMessage.type = SignalService.GroupContext.Type.DELIVER;

      data.group = groupMessage;
    }

    if (this.expireTimer) {
      data.expireTimer = this.expireTimer;
    }
    if (this.profileKey && this.profileKey.length) {
      data.profileKey = this.profileKey;
    }

    return data;
  }
}
