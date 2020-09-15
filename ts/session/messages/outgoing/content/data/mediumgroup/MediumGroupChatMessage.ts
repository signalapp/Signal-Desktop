import { ChatMessage } from '../ChatMessage';
import { PubKey } from '../../../../../types';
import { ClosedGroupChatMessage } from '../group/ClosedGroupChatMessage';

interface MediumGroupChatMessageParams {
  identifier?: string;
  groupId: string | PubKey;
  chatMessage: ChatMessage;
}

export class MediumGroupChatMessage extends ClosedGroupChatMessage {
  constructor(params: MediumGroupChatMessageParams) {
    super({
      identifier: params.identifier ?? params.chatMessage.identifier,
      groupId: params.groupId,
      chatMessage: params.chatMessage,
    });
  }
}
