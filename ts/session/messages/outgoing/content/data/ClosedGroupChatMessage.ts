import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';
import { ChatMessage } from './ChatMessage';
import { TextEncoder } from 'util';

interface ClosedGroupChatMessageParams {
  identifier?: string;
  groupId: string;
  chatMessage: ChatMessage;
}

export class ClosedGroupChatMessage extends DataMessage {
  private readonly groupId: string;
  private readonly chatMessage: ChatMessage;

  constructor(params: ClosedGroupChatMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier,
    });
    this.groupId = params.groupId;
    this.chatMessage = params.chatMessage;
  }

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected dataProto(): SignalService.DataMessage {
    const messageProto = this.chatMessage.dataProto();
    const id = new TextEncoder().encode(this.groupId);
    const type = SignalService.GroupContext.Type.DELIVER;
    messageProto.group = new SignalService.GroupContext({ id, type });

    return messageProto;
  }
}
