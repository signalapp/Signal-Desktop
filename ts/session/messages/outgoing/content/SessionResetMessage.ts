import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export class SessionResetMessage extends ContentMessage {

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
