import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';

export class ClosedGroupMessage extends DataMessage {

  protected dataProto(): SignalService.DataMessage {
    throw new Error('Not implemented');
  }
}
