import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { MessageParams } from '../../../Message';
import { PubKey } from '../../../../../types';
import { StringUtils } from '../../../../../utils';
import { Constants } from '../../../../..';

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
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.group = this.groupContext();

    return dataMessage;
  }

  protected groupContext(): SignalService.GroupContext {
    let groupIdWithPrefix: string = this.groupId.key;
    if (!this.groupId.key.startsWith(PubKey.PREFIX_GROUP_TEXTSECURE)) {
      groupIdWithPrefix = PubKey.PREFIX_GROUP_TEXTSECURE + this.groupId.key;
    }
    const encoded = StringUtils.encode(groupIdWithPrefix, 'utf8');
    const id = new Uint8Array(encoded);

    return new SignalService.GroupContext({ id });
  }
}
