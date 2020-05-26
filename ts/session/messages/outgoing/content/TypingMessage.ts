import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { TextEncoder } from 'util';
import { MessageParams } from '../Message';

interface TypingMessageParams extends MessageParams {
  isTyping: boolean;
  typingTimestamp?: number;
  groupId?: string;
}

export class TypingMessage extends ContentMessage {
  private readonly isTyping: boolean;
  private readonly typingTimestamp?: number;
  private readonly groupId?: string;

  constructor(params: TypingMessageParams) {
    super({timestamp: params.timestamp, identifier: params.identifier});
    this.isTyping = params.isTyping;
    this.typingTimestamp = params.typingTimestamp;
    this.groupId = params.groupId;
  }


  public ttl(): number {
    return 60 * 1000; // 1 minute for typing indicators
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      typingMessage: this.typingProto(),
    });
  }

  protected typingProto(): SignalService.TypingMessage {
    const ACTION_ENUM = SignalService.TypingMessage.Action;

    const action = this.isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;
    const finalTimestamp = this.typingTimestamp || Date.now();

    const typingMessage = new SignalService.TypingMessage();
    if (this.groupId) {
      typingMessage.groupId = new TextEncoder().encode(this.groupId);
    }
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    return typingMessage;
  }
}
