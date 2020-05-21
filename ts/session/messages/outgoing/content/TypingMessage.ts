import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export abstract class TypingMessage extends ContentMessage {

  public ttl(): number {
    return 60 * 1000; // 1 minute for typing indicators
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      typingMessage: this.typingProto(),
    });
  }

  protected abstract typingProto(): SignalService.TypingMessage;

}
