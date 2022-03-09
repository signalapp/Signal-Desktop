import { SignalService } from '../../../../protobuf';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';

interface MessageRequestResponseParams extends MessageParams {
  isApproved: boolean;
}

export class MessageRequestResponse extends ContentMessage {
  private readonly isApproved: boolean;

  constructor(params: MessageRequestResponseParams) {
    super({
      timestamp: params.timestamp,
      isApproved: params.isApproved,
    } as MessageRequestResponseParams);
    this.isApproved = params.isApproved;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      messageRequestResponse: this.messageRequestResponseProto(),
    });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    return new SignalService.MessageRequestResponse({
      isApproved: this.isApproved,
    });
  }
}
