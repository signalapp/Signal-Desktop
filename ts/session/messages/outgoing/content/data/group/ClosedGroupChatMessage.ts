import { SignalService } from '../../../../../../protobuf';
import { ChatMessage } from '../ChatMessage';
import { ClosedGroupMessage } from './ClosedGroupMessage';
import { PubKey } from '../../../../../types';
import { Constants } from '../../../../..';
import { StringUtils } from '../../../../../utils';

interface ClosedGroupChatMessageParams {
  identifier?: string;
  groupId: string | PubKey;
  chatMessage: ChatMessage;
}

export class ClosedGroupChatMessage extends ClosedGroupMessage {
  private readonly chatMessage: ChatMessage;

  constructor(params: ClosedGroupChatMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier ?? params.chatMessage.identifier,
      groupId: params.groupId,
      expireTimer: params.chatMessage.expireTimer || 0,
    });
    this.chatMessage = params.chatMessage;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  public dataProto(): SignalService.DataMessage {
    const dataProto = this.chatMessage.dataProto();

    if (this.groupId) {
      const groupMessage = new SignalService.GroupContext();
      const groupIdWithPrefix = PubKey.addTextSecurePrefixIfNeeded(
        this.groupId.key
      );
      const encoded = StringUtils.encode(groupIdWithPrefix, 'utf8');
      const id = new Uint8Array(encoded);
      groupMessage.id = id;
      groupMessage.type = SignalService.GroupContext.Type.DELIVER;

      dataProto.group = groupMessage;
    }

    return dataProto;
  }
}
