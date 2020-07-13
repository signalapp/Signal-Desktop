import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { TextEncoder } from 'util';
import { MessageParams } from '../Message';
import { StringUtils } from '../../../utils';
import { PubKey } from '../../../types';
import { Constants } from '../../..';

interface TypingMessageParams extends MessageParams {
  isTyping: boolean;
  typingTimestamp?: number;
  groupId?: string | PubKey;
}

export class TypingMessage extends ContentMessage {
  public readonly isTyping: boolean;
  public readonly typingTimestamp?: number;
  public readonly groupId?: PubKey;

  constructor(params: TypingMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.isTyping = params.isTyping;
    this.typingTimestamp = params.typingTimestamp;

    const { groupId } = params;
    this.groupId = groupId ? PubKey.cast(groupId) : undefined;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.TYPING_MESSAGE;
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
      typingMessage.groupId = new Uint8Array(
        StringUtils.encode(this.groupId.key, 'utf8')
      );
    }
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    return typingMessage;
  }
}
