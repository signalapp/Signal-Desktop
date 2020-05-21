import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';

export class DeviceUnlinkMessage extends DataMessage {

  protected dataProto(): SignalService.DataMessage {
    throw new Error('Not implemented');
  }
}
