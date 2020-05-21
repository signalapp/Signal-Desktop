import { SessionResetMessage } from './SessionResetMessage';
import { SignalService } from '../../../../protobuf';

export class EndSessionMessage extends SessionResetMessage {

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
