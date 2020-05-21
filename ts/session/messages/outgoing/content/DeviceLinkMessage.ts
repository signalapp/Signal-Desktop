import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';

export class DeviceLinkMessage extends ContentMessage {

  public ttl(): number {
    return 2 * 60 * 1000; // 2 minutes for linking requests
  }

  protected contentProto(): SignalService.Content {
    throw new Error('Not implemented');
  }
}
