import { SessionResetMessage } from './SessionResetMessage';
import { SignalService } from '../../../../protobuf';

export class EndSessionMessage extends SessionResetMessage {

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
