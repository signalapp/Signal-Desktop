import { SignalService } from '../../../../../../protobuf';
import { ChatMessage } from '../ChatMessage';
import { PubKey } from '../../../../../types';
import { MediumGroupMessage } from './MediumGroupMessage';

interface MediumGroupChatMessageParams {
  identifier?: string;
  groupId: string | PubKey;
  chatMessage: ChatMessage;
}

export class MediumGroupChatMessage extends MediumGroupMessage {
  private readonly chatMessage: ChatMessage;

  constructor(params: MediumGroupChatMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier ?? params.chatMessage.identifier,
      groupId: params.groupId,
    });
    this.chatMessage = params.chatMessage;
  }

  public dataProto(): SignalService.DataMessage {
    const messageProto = this.chatMessage.dataProto();
    messageProto.mediumGroupUpdate = super.dataProto().mediumGroupUpdate;

    return messageProto;
  }
}
