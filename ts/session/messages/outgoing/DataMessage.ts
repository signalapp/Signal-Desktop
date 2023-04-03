import { SignalService } from '../../../protobuf';
import { ExpirableMessage } from './ExpirableMessage';

export abstract class DataMessage extends ExpirableMessage {
  public abstract dataProto(): SignalService.DataMessage;

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      ...super.contentProto(),
      dataMessage: this.dataProto(),
    });
  }
}
