import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export class SessionEstablishedMessage extends ContentMessage {

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
