import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export class SessionEstablishedMessage extends ContentMessage {

  public ttl(): number {
    return 5 * 60 * 1000;
  }

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
