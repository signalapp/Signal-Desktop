import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';

export class DeviceUnlinkMessage extends DataMessage {
  public ttl(): number {
    return 4 * 24 * 60 * 60 * 1000; // 4 days for device unlinking
  }

  protected dataProto(): SignalService.DataMessage {
    const flags = SignalService.DataMessage.Flags.UNPAIRING_REQUEST;

    return new SignalService.DataMessage({
      flags,
    });
  }
}
