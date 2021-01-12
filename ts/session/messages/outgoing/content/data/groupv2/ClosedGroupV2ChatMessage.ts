import { SignalService } from '../../../../../../protobuf';
import { ChatMessage } from '../ChatMessage';
import { ClosedGroupV2Message } from './ClosedGroupV2Message';
import { PubKey } from '../../../../../types';
import { Constants } from '../../../../..';

interface ClosedGroupV2ChatMessageParams {
  identifier?: string;
  groupId: string | PubKey;
  chatMessage: ChatMessage;
}

export class ClosedGroupV2ChatMessage extends ClosedGroupV2Message {
  private readonly chatMessage: ChatMessage;

  constructor(params: ClosedGroupV2ChatMessageParams) {
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
    const messageProto = this.chatMessage.dataProto();

    return messageProto;
  }
}
