import { SignalService } from '../../../protobuf';
import { ExpirableMessage } from './ExpirableMessage';

export abstract class DataMessage extends ExpirableMessage {
  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      ...super.contentProto(),
      dataMessage: this.dataProto(),
    });
  }
}
