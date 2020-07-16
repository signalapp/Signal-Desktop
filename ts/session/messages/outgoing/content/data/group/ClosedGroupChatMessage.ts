import { SignalService } from '../../../../../../protobuf';
import { ChatMessage } from '../ChatMessage';
import { ClosedGroupMessage } from './ClosedGroupMessage';
import { PubKey } from '../../../../../types';

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
    });
    this.chatMessage = params.chatMessage;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  public dataProto(): SignalService.DataMessage {
    const messageProto = this.chatMessage.dataProto();
    messageProto.group = this.groupContext();

    return messageProto;
  }

  protected groupContext(): SignalService.GroupContext {
    // use the parent method to fill id correctly
    const groupContext = super.groupContext();
    groupContext.type = SignalService.GroupContext.Type.DELIVER;

    return groupContext;
  }
}
