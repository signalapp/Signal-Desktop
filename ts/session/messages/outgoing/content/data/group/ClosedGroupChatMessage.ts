import { SignalService } from '../../../../../../protobuf';
import { ChatMessage } from '../ChatMessage';
import { ClosedGroupMessage } from './ClosedGroupMessage';

interface ClosedGroupChatMessageParams {
  identifier?: string;
  groupId: string;
  chatMessage: ChatMessage;
}

export class ClosedGroupChatMessage extends ClosedGroupMessage {
  private readonly chatMessage: ChatMessage;

  constructor(params: ClosedGroupChatMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
    });
    this.chatMessage = params.chatMessage;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected groupContextType(): SignalService.GroupContext.Type {
    return SignalService.GroupContext.Type.DELIVER;
  }

  protected dataProto(): SignalService.DataMessage {
    const messageProto = this.chatMessage.dataProto();
    messageProto.group = this.groupContext();

    return messageProto;
  }
}
