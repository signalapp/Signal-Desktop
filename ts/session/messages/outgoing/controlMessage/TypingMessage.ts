import { ContentMessage } from '..';
import { Constants } from '../../..';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';

interface TypingMessageParams extends MessageParams {
  isTyping: boolean;
  typingTimestamp?: number;
}

export class TypingMessage extends ContentMessage {
  public readonly isTyping: boolean;
  public readonly typingTimestamp?: number;

  constructor(params: TypingMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.isTyping = params.isTyping;
    this.typingTimestamp = params.typingTimestamp;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.TYPING_MESSAGE;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      typingMessage: this.typingProto(),
    });
  }

  protected typingProto(): SignalService.TypingMessage {
    const ACTION_ENUM = SignalService.TypingMessage.Action;

    const action = this.isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;
    const finalTimestamp = this.typingTimestamp || Date.now();

    const typingMessage = new SignalService.TypingMessage();
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    return typingMessage;
  }
}
