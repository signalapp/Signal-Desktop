import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';

export class ClosedGroupMessage extends DataMessage {

  public ttl(): number {
    return this.getDefaultTTL();
  }

  protected dataProto(): SignalService.DataMessage {
    throw new Error('Not implemented');
  }
}
