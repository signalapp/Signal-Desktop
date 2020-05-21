import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export abstract class TypingMessage extends ContentMessage {

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      typingMessage: this.typingProto(),
    });
  }

  protected abstract typingProto(): SignalService.TypingMessage;
}
