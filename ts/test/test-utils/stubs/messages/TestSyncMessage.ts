import { SyncMessage } from '../../../../session/messages/outgoing';
import { SignalService } from '../../../../protobuf';
export class TestSyncMessage extends SyncMessage {
  protected syncProto(): SignalService.SyncMessage {
    return SignalService.SyncMessage.create({});
  }
}
