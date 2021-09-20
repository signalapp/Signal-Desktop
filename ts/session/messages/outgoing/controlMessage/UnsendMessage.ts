import { SignalService } from '../../../../protobuf';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';

interface UnsendMessageParams extends MessageParams {
  timestamp: number;
  author: string;
}

export class UnsendMessage extends ContentMessage {
  private readonly author: string;

  constructor(params: UnsendMessageParams) {
    super({ timestamp: params.timestamp, author: params.author } as MessageParams);
    this.author = params.author;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      unsendMessage: this.unsendProto(),
    });
  }

  public unsendProto(): SignalService.Unsend {
    return new SignalService.Unsend({
      timestamp: this.timestamp,
      author: this.author,
    });
  }
}
