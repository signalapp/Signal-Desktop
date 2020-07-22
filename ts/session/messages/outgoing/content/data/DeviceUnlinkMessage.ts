import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';
import { Constants } from '../../../..';

export class DeviceUnlinkMessage extends DataMessage {
  public ttl(): number {
    return Constants.TTL_DEFAULT.DEVICE_UNPAIRING;
  }

  public dataProto(): SignalService.DataMessage {
    const flags = SignalService.DataMessage.Flags.UNPAIRING_REQUEST;

    return new SignalService.DataMessage({
      flags,
    });
  }
}
