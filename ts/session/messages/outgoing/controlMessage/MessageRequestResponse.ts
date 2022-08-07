import { SignalService } from '../../../../protobuf';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';

// tslint:disable-next-line: no-empty-interface
export interface MessageRequestResponseParams extends MessageParams {}

export class MessageRequestResponse extends ContentMessage {
  // we actually send a response only if it is an accept
  // private readonly isApproved: boolean;

  constructor(params: MessageRequestResponseParams) {
    super({
      timestamp: params.timestamp,
    } as MessageRequestResponseParams);
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      messageRequestResponse: this.messageRequestResponseProto(),
    });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    return new SignalService.MessageRequestResponse({
      isApproved: true,
    });
  }
}
